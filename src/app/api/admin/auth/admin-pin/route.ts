import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminPin } from '@/lib/admin-pin'
import { verifyCredentialPin } from '@/lib/staff-credential'
import { buildSetCookie, cookieSecure } from '@/lib/cookie'
import { signToken } from '@/lib/jwt'

export const runtime = 'nodejs'

/**
 * POST /api/admin/auth/admin-pin —— 商户后台 PIN 登录（服务端校验）
 *
 * 2026-10-28 新增。存在的理由：
 *   旧版 AdminGate / AdminLayout / me/points 页在**浏览器里**比对 PIN 哈希，
 *   而哈希（+pepper）是从 business.config.ts 来的 —— 那个文件被 'use client' 组件 import，
 *   于是哈希被打进 .next/static，6 位 PIN 可离线爆破。
 *   现在改成：浏览器只提交 PIN，服务端校验，通过后下发 httpOnly 会话 cookie。
 *
 * Body: { pin: string, action?: 'verify' | 'logout' }
 *
 * ⭐ 会话凭证不再放明文 PIN：
 *   旧：zhilin-admin-token=pin-123456（cookie 里是明文 PIN，抓包即得永久密码）
 *   新：zhilin-admin-token=<JWT(role=admin, 1h)>（抓包只拿到 1 小时的会话）
 *   服务端校验路径（verifyAdminRequest / api-auth）本来就同时支持 pin- 形态，
 *   老 cookie 继续有效，直到自然过期。
 */

/* ---------- PIN 暴力破解限流：5 次失败锁 15 分钟 ---------- */
const MAX_ATTEMPTS = 5
const LOCKOUT_MS = 15 * 60 * 1000
interface Attempt { count: number; lockedUntil: number; lastFail: number }
const attemptsByIp = new Map<string, Attempt>()

function getClientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  if (xff && xff !== '127.0.0.1' && xff !== '::1') return `xff:${xff}`
  const realIp = req.headers.get('x-real-ip')
  if (realIp && realIp !== '127.0.0.1' && realIp !== '::1') return `real:${realIp}`
  return 'local:localhost'
}

function lockRemaining(ip: string): number {
  const a = attemptsByIp.get(ip)
  if (!a) return 0
  return Math.max(0, a.lockedUntil - Date.now())
}

function recordFailure(ip: string) {
  const a = attemptsByIp.get(ip) || { count: 0, lockedUntil: 0, lastFail: 0 }
  a.count++
  a.lastFail = Date.now()
  if (a.count >= MAX_ATTEMPTS) a.lockedUntil = Date.now() + LOCKOUT_MS
  attemptsByIp.set(ip, a)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const action = String(body.action || 'verify')

    /* ---------- 退出 ---------- */
    if (action === 'logout') {
      const res = NextResponse.json({ success: true })
      res.headers.append('Set-Cookie', buildSetCookie('zhilin-admin-token', '', { maxAge: 0, path: '/' }))
      res.headers.append('Set-Cookie', buildSetCookie('zhilin-admin-ok', '', { maxAge: 0, path: '/' }))
      return res
    }

    const ip = getClientIp(request)
    const locked = lockRemaining(ip)
    if (locked > 0) {
      return NextResponse.json(
        { success: false, error: `PIN 错误次数过多，请 ${Math.ceil(locked / 60000)} 分钟后重试`, locked: true },
        { status: 429 },
      )
    }

    const pin = String(body.pin || '').trim()
    if (!pin) {
      return NextResponse.json({ success: false, error: 'PIN 不能为空' }, { status: 400 })
    }

    // 两套凭证都认：配置文件哈希 + 数据库 StaffCredential（scrypt）
    const ok = verifyAdminPin(pin) || verifyCredentialPin('admin', pin)
    if (!ok) {
      recordFailure(ip)
      const a = attemptsByIp.get(ip)!
      return NextResponse.json(
        {
          success: false,
          error: `PIN 错误，剩余 ${Math.max(0, MAX_ATTEMPTS - a.count)} 次尝试机会`,
          remaining: Math.max(0, MAX_ATTEMPTS - a.count),
        },
        { status: 401 },
      )
    }
    attemptsByIp.delete(ip)

    // 签发 1 小时的后台会话（JWT，不是明文 PIN）
    let sessionToken: string
    try {
      sessionToken = signToken({ userId: 'admin_pin', phone: '', role: 'admin' }, '1h')
    } catch (e: any) {
      return NextResponse.json(
        { success: false, error: `服务端未配置 JWT_SECRET，无法签发会话：${e?.message || 'unknown'}` },
        { status: 503 },
      )
    }

    const res = NextResponse.json({ success: true, expiresIn: 3600 })
    // 真正的凭证：httpOnly，JS 读不到
    res.headers.append(
      'Set-Cookie',
      buildSetCookie('zhilin-admin-token', sessionToken, {
        maxAge: 60 * 60,
        path: '/',
        sameSite: 'lax',
        httpOnly: true,
        secure: cookieSecure(request),
      }),
    )
    // UI 用的标记（不含任何密钥）
    res.headers.append(
      'Set-Cookie',
      buildSetCookie('zhilin-admin-ok', '1', {
        maxAge: 60 * 60,
        path: '/',
        sameSite: 'lax',
        httpOnly: false,
        secure: cookieSecure(request),
      }),
    )
    return res
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || '校验失败' }, { status: 500 })
  }
}
