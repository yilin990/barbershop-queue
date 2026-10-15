import { NextRequest } from 'next/server'
import { verifyAdminRequest } from './admin-jwt-auth'
import { verifyCredentialPin } from './staff-credential'
import { prisma } from './db'

/* ===========================================================================
 * 身份接口鉴权守卫
 * 清禾 2026-10-15 22:5x
 *
 * 背景：/api/identity/{txn,profile,claim,resolve} 四个路由的注释都写着
 *       「生产环境必须校验鉴权」，但代码里一个都没做，直接裸在公网上。
 *       其中 /txn 是写钱接口 —— 任何人 POST 一下就能给人充值。
 *
 * 本文件不发明新机制，全部复用仓库里已有的真实基建：
 *   · verifyCredentialPin(role, pin, merchantId)  ← scrypt PIN，按门店精确匹配
 *   · verifyAdminRequest(req)                     ← 后台 JWT / 店员 cookie
 *   · PhoneVerification                           ← 短信验证码表（一次性核销）
 *
 * ⚠️ 为什么不用可辨识联合（ok:true | ok:false）：
 *   本仓 tsconfig 是 strict:false，strictNullChecks 关闭时 TS 会拓宽字面量类型，
 *   ok:true / ok:false 不再互斥，判别收窄失效（auth.error 访问不到）。
 *   所以这里让每个分支都填满全部字段，调用方不需要任何收窄即可安全访问。
 * =========================================================================== */

export type AuthResult = {
  ok: boolean
  pin: string        // 失败时为空串
  status: number     // 成功时 200
  error: string      // 成功时为空串
}

const DENY = (status: number, error: string): AuthResult => ({ ok: false, pin: '', status, error })
const ALLOW = (pin: string): AuthResult => ({ ok: true, pin, status: 200, error: '' })

/* ─────────── 限流（进程内 Map；将来多实例要换 Redis） ─────────── */
const buckets = new Map<string, { count: number; resetAt: number }>()

export function checkIpLimit(key: string, max: number, windowMs: number) {
  const now = Date.now()
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (v.resetAt < now) buckets.delete(k)
  }
  const b = buckets.get(key)
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true as boolean, retryAfter: 0 }
  }
  b.count += 1
  if (b.count > max) {
    return { ok: false as boolean, retryAfter: Math.ceil((b.resetAt - now) / 1000) }
  }
  return { ok: true as boolean, retryAfter: 0 }
}

export function clientIp(req: NextRequest): string {
  const cf = req.headers.get('cf-connecting-ip')
  if (cf) return cf.trim()
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return 'unknown'
}

/* ─────────── 读 PIN：header / Bearer pin- / StaffGate cookie ─────────── */
function readPin(req: NextRequest): string | null {
  const h = req.headers.get('x-merchant-pin') || req.headers.get('x-staff-pin')
  if (h && h.trim()) return h.trim()
  const auth = req.headers.get('authorization')
  if (auth && auth.startsWith('pin-')) return auth.slice(4).trim()
  const c1 = req.cookies.get('zhilin-staff-session')?.value
  if (c1) {
    try {
      const p = JSON.parse(decodeURIComponent(c1))
      if (p && p.pin) return String(p.pin)
    } catch {}
  }
  const c2 = req.cookies.get('zhilin-staff-token')?.value
  if (c2 && c2.startsWith('pin-')) return c2.slice(4)
  return null
}

/* ─────────── ① 写钱：PIN 必须属于这一个门店 ───────────
 * 不用 JWT 兜底：JWT payload 只有 {userId, phone, role}，没有 merchantId，
 * 拿它写钱等于无法校验「这个店长有没有权动这家店的余额」。 */
const MONEY_ROLES = ['manager', 'owner', 'staff', 'admin']

export function requireMerchantPin(req: NextRequest, merchantId: string): AuthResult {
  const pin = readPin(req)
  if (!pin) return DENY(401, '缺少门店 PIN（请先登录门店后台）')
  for (const role of MONEY_ROLES) {
    if (verifyCredentialPin(role, pin, merchantId)) return ALLOW(pin)
  }
  return DENY(403, 'PIN 无效，或不属于该门店')
}

/** 审计用的脱敏操作人标识（不落明文 PIN） */
export function operatorTag(pin: string): string {
  return 'pin:****' + pin.slice(-2)
}

/* ─────────── ② 读敏感资料：后台身份即可 ─────────── */
export function requireStaff(req: NextRequest): AuthResult {
  const r: any = verifyAdminRequest(req)
  if (r && r.ok) return ALLOW(r.pin || 'jwt')
  const status = (r && r.status) || 401
  const reason = (r && r.reason) || 'no_token'
  return DENY(status, reason === 'no_token' ? '请先登录商户后台' : '鉴权失败：' + reason)
}

/* ─────────── ③ 短信验证码：一次性核销 ─────────── */
export async function consumeSmsCode(phone: string, code: string): Promise<boolean> {
  if (typeof code !== 'string' || code.length < 4 || code.length > 8) return false
  const rec = await prisma.phoneVerification.findFirst({
    where: { phone, code, used: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  })
  if (!rec) return false
  await prisma.phoneVerification.update({ where: { id: rec.id }, data: { used: true } })
  return true
}
