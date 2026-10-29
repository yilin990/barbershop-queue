/**
 * 统一访问控制层 · 2026-10-28 清禾（dev 子任务）
 *
 * 为什么要有这一层：
 *   本仓库的鉴权是「各路由自己写」的，结果是覆盖面参差不齐 ——
 *   /api/members 有 requireManager，/api/queues、/api/settlements、/api/orders/[id] 完全没有。
 *   实测（生产 3070，匿名无 cookie）：
 *     GET  /api/queues?merchantId=m_barber_001  → 200，全店顾客手机号/姓名/结算金额
 *     GET  /api/queues?phone=183…               → 200，跨商户按手机号枚举
 *     GET  /api/settlements?merchantId=…        → 200，结算流水（含手机号）
 *     GET  /api/members/183…?merchantId=…       → 200，会员卡余额 + 流水
 *     POST /api/settlements                     → 200，直接扣会员卡余额（免单通道）
 *   逐个打补丁的问题是：下次新增路由又会漏。所以这里做一层「统一语义」的守卫，
 *   新路由只要挑一个语义（自助 / 门店侧 / 店长侧）调用即可。
 *
 * ⭐ 三条铁律（贯穿本文件）：
 *   1. 权限只认「登录态」，绝不认请求参数里的 phone / merchantId。
 *      参数是攻击者可控的；登录态不是。
 *   2. 跨商户访问返回 403（已登录但无权），未登录返回 401。
 *      401 和 403 必须分开 —— 前者叫「去登录」，后者叫「别看了」。
 *   3. fail-closed：身份解析不出来就当没有身份，绝不「解析失败就放行」。
 *
 * 身份层级（level）：
 *   admin          管理员 JWT（zhilin-admin-jwt / Bearer role=admin|merchant|manager）
 *   manager        店长：zhilin-token 且 DB 实时 role 含「店长」
 *   staff          店员：zhilin-staff-session cookie（PIN 登录）
 *   customer       顾客：zhilin-token（短信验证码 / 一键登录签发的正常 JWT）
 *   soft_customer  顾客「软会话」：zhilin-soft-token（预约后服务端签发，绑定该手机号）
 *
 * 商户范围（merchantScope）：
 *   'all'    —— 管理员，平台级
 *   [ids]    —— 店员/店长：只能碰本部署业务线下的商户
 *              默认取 DEFAULT_MERCHANT_ID 的「业务线前缀」（m_barber_001 → m_barber），
 *              即 m_barber_001 / m_barber_002 都行，m_zhilin_001（药房遗留数据）不行。
 *              这样「跨商户 403」才有意义，也顺手修掉 /api/comments 混进药房数据的问题。
 */

import { NextRequest } from 'next/server'
import { extractToken, verifyToken, JwtPayload } from './jwt'
import { parseCookie } from './cookie'
import { prisma } from './db'
import { verifyStaffCookie } from './staff-session'
import { verifyCredentialPin } from './staff-credential'

export const SOFT_TOKEN_COOKIE = 'zhilin-soft-token'
export const MAIN_TOKEN_COOKIE = 'zhilin-token'

/** 管理员家族的 cookie（与 src/middleware.ts 保持一致） */
const ADMIN_JWT_COOKIES = ['zhilin-admin-jwt', 'zhilin-admin-token', 'zhilin-staff-token']

export type IdentityLevel = 'admin' | 'manager' | 'staff' | 'customer' | 'soft_customer'

export interface ApiIdentity {
  level: IdentityLevel
  userId?: string
  phone?: string
  role?: string
  /** 'all' = 平台管理员；数组 = 允许访问的商户 ID */
  merchantScope: 'all' | string[]
  /** 门店侧（店员/店长/管理员）—— 可读经营数据、可操作队列 */
  isShopSide: boolean
  /** 店长/管理员侧 —— 可动钱（结算、充值、扣款）、可删数据 */
  isManagerSide: boolean
}

/**
 * 守卫结果。
 * ⭐ 注意：本仓库 tsconfig 是 strict:false（历史原因），strictNullChecks 关闭时
 *   TS 不会对「字面量布尔判别联合」做真值收窄，`if (!guard.ok)` 后 guard 仍然是联合类型，
 *   直接访问 guard.status / guard.error 会报错。所以这里刻意不用判别联合，
 *   改成一个扁平接口，运行时逻辑完全一样（调用方一律先判 guard.ok）。
 */
export interface Guard {
  ok: boolean
  /** ok=true 时一定有 */
  identity?: ApiIdentity
  /** ok=false 时给出 */
  status?: number
  error?: string
}

/* ============================================================
 * 手机号归一化（只用于「你声称的 phone 是否等于登录态里的 phone」这一处比对）
 * ========================================================== */

export function normalizePhoneForCompare(raw: string | null | undefined): string {
  const digits = String(raw || '').replace(/\D/g, '')
  if (digits.length === 13 && digits.startsWith('86')) return digits.slice(2)
  return digits
}

export function samePhone(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = normalizePhoneForCompare(a)
  const y = normalizePhoneForCompare(b)
  return !!x && !!y && x === y
}

/* ============================================================
 * 商户范围
 * ========================================================== */

/** 本部署业务线前缀：m_barber_001 → m_barber */
export function merchantFamilyPrefix(): string {
  const explicit = process.env.MERCHANT_SCOPE_PREFIX
  if (explicit && explicit.trim()) return explicit.trim()
  const def = process.env.NEXT_PUBLIC_MERCHANT_ID || 'm_barber_001'
  const i = def.lastIndexOf('_')
  return i > 0 ? def.slice(0, i) : def
}

let familyCache: { prefix: string; ids: string[]; at: number } | null = null

/** 本部署业务线下的商户 ID 列表（缓存 30 秒） */
export async function merchantFamilyIds(): Promise<string[]> {
  const prefix = merchantFamilyPrefix()
  if (familyCache && familyCache.prefix === prefix && Date.now() - familyCache.at < 30_000) {
    return familyCache.ids
  }
  let ids: string[] = []
  try {
    const rows = await prisma.merchant.findMany({ select: { id: true } })
    ids = rows.map((r) => r.id).filter((id) => id.startsWith(prefix))
  } catch {
    ids = []
  }
  familyCache = { prefix, ids, at: Date.now() }
  return ids
}

/** 店员凭证（StaffCredential）绑定的商户；'*' 视为业务线范围 */
function staffCredentialScope(pin: string): Promise<string[]> | null {
  // staff-credential 只暴露 verifyCredentialPin(role, pin, merchantId)，
  // 这里用「逐个候选商户试」的方式反查归属，避免改动那个模块的公开接口。
  const candidates = ['m_barber_001', 'm_barber_002', 'm_zhilin_001', 'm_grocery_001']
  const found: string[] = []
  for (const mid of candidates) {
    if (verifyCredentialPin('staff', pin, mid, { exact: true })) found.push(mid)
  }
  if (found.length === 0 && verifyCredentialPin('staff', pin)) {
    // 通配符 '*'（凭证表里 merchantId='*'）
    return Promise.resolve(['*'])
  }
  return Promise.resolve(found)
}


/**
 * 取出「店员 PIN 会话」里的 PIN，并做凭证校验。
 * 任何解析异常都按「没有店员身份」处理（fail-closed）。
 */
async function resolveStaffIdentity(cookieHeader: string): Promise<{ pin?: string } | null> {
  // a) 服务端下发的 zhilin-staff-session
  const staff = verifyStaffCookie(cookieHeader)
  if (staff.success) return { pin: staff.pin }

  // b) 老格式 zhilin-staff-token=pin-XXXX / zhilin-staff-session 里带 pin 的 JSON
  const candidates: string[] = []
  for (const name of ['zhilin-staff-token', 'zhilin-staff-session']) {
    const raw = parseCookie(cookieHeader, name)
    if (!raw) continue
    if (raw.startsWith('pin-')) {
      candidates.push(raw.slice(4))
      continue
    }
    try {
      const parsed = JSON.parse(decodeURIComponent(raw))
      if (parsed && typeof parsed.pin === 'string' && parsed.pin) {
        if (!parsed.expiresAt || Number(parsed.expiresAt) > Date.now()) {
          candidates.push(parsed.pin)
        }
      }
    } catch { /* 不是 JSON，忽略 */ }
  }
  for (const pin of candidates) {
    if (verifyCredentialPin('staff', pin)) return { pin }
  }
  return null
}

/* ============================================================
 * 身份解析
 * ========================================================== */

async function dbRoleOf(userId: string): Promise<string | null> {
  try {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
    return u ? String(u.role || '') : null
  } catch {
    return null
  }
}

/**
 * 解析请求身份。返回 null = 没有任何身份（未登录）。
 * ⭐ fail-closed：任何解析异常都按「无身份」处理。
 */
export async function resolveIdentity(request: NextRequest): Promise<ApiIdentity | null> {
  const cookieHeader = request.headers.get('cookie') || ''

  /* ---------- ① 管理员 ---------- */
  // Bearer 优先（admin-jwt-auth 的约定：Bearer 里是 role=admin|merchant|manager 的 JWT）
  const bearer = extractToken(request.headers.get('authorization'))
  if (bearer) {
    const payload = verifyToken(bearer)
    if (payload && ['admin', 'merchant', 'manager'].indexOf(String(payload.role || '')) !== -1) {
      return {
        level: 'admin',
        userId: payload.userId,
        phone: payload.phone,
        role: payload.role,
        merchantScope: 'all',
        isShopSide: true,
        isManagerSide: true,
      }
    }
  }
  for (const name of ADMIN_JWT_COOKIES) {
    const v = parseCookie(cookieHeader, name)
    if (!v) continue
    if (v.startsWith('pin-')) {
      // legacy：zhilin-admin-token=pin-XXXX
      const pin = v.slice(4)
      if (verifyCredentialPin('admin', pin)) {
        return {
          level: 'admin',
          role: 'admin',
          merchantScope: 'all',
          isShopSide: true,
          isManagerSide: true,
        }
      }
      continue
    }
    const payload = verifyToken(v)
    if (payload && ['admin', 'merchant', 'manager'].indexOf(String(payload.role || '')) !== -1) {
      return {
        level: 'admin',
        userId: payload.userId,
        phone: payload.phone,
        role: payload.role,
        merchantScope: 'all',
        isShopSide: true,
        isManagerSide: true,
      }
    }
  }

  /* ---------- ② 店员（PIN 会话） ---------- */
  //   凭证有两种来源：
  //     a) zhilin-staff-session cookie（服务端 /api/admin/auth/staff-pin 下发，httpOnly）
  //     b) zhilin-staff-token=pin-XXXX（老格式）
  //   两者都要过凭证校验（配置哈希 + 数据库 scrypt），过不了就是没有店员身份。
  const staffIdentity = await resolveStaffIdentity(cookieHeader)
  if (staffIdentity) {
    const raw = staffIdentity.pin ? await staffCredentialScope(staffIdentity.pin) : null
    const family = await merchantFamilyIds()
    let scope: string[]
    if (!raw || raw.length === 0) {
      // PIN 有效但数据库里查不到商户归属（老配置哈希 PIN）→ 退到本部署业务线范围，
      //   绝不退到「全平台」，也不退到「空」把店员自己锁死。
      scope = family
    } else if (raw.indexOf('*') !== -1) {
      scope = family
    } else {
      scope = raw.filter((id) => family.indexOf(id) !== -1)
    }
    return {
      level: 'staff',
      role: 'staff',
      merchantScope: scope,
      isShopSide: true,
      isManagerSide: false,
    }
  }

  /* ---------- ③ 顾客 / 店长（zhilin-token） ---------- */
  const mainToken = parseCookie(cookieHeader, MAIN_TOKEN_COOKIE) || bearer
  if (mainToken) {
    let raw = mainToken
    try { raw = decodeURIComponent(mainToken) } catch { /* 原样 */ }
    const payload = verifyToken(raw)
    if (payload) {
      // 软会话：预约后签发，只能读「自己的数据」，不能碰门店侧
      if (payload.scope === 'soft') {
        return {
          level: 'soft_customer',
          userId: payload.userId,
          phone: payload.phone,
          role: payload.role,
          merchantScope: [],
          isShopSide: false,
          isManagerSide: false,
        }
      }
      // 店长：DB 实时 role（JWT 里的 role 只是快照）
      const role = (await dbRoleOf(String(payload.userId || ''))) || String(payload.role || '')
      if (role.indexOf('店长') !== -1) {
        return {
          level: 'manager',
          userId: payload.userId,
          phone: payload.phone,
          role,
          merchantScope: await merchantFamilyIds(),
          isShopSide: true,
          isManagerSide: true,
        }
      }
      return {
        level: 'customer',
        userId: payload.userId,
        phone: payload.phone,
        role,
        merchantScope: [],
        isShopSide: false,
        isManagerSide: false,
      }
    }
  }

  /* ---------- ④ 顾客软会话（zhilin-soft-token） ---------- */
  const soft = parseCookie(cookieHeader, SOFT_TOKEN_COOKIE)
  if (soft) {
    let raw = soft
    try { raw = decodeURIComponent(soft) } catch { /* 原样 */ }
    const payload = verifyToken(raw)
    if (payload && payload.scope === 'soft') {
      return {
        level: 'soft_customer',
        userId: payload.userId,
        phone: payload.phone,
        role: payload.role,
        merchantScope: [],
        isShopSide: false,
        isManagerSide: false,
      }
    }
  }

  return null
}

/* ============================================================
 * 守卫
 * ========================================================== */

function fail(status: number, error: string): Guard {
  return { ok: false, status, error }
}

/** 统一错误响应 */
export function guardFail(g: Guard | { status?: number; error?: string }): Response {
  const status = typeof g.status === 'number' ? g.status : 401
  const error = g.error || '请求被拒绝'
  return Response.json(
    { success: false, error },
    { status },
  )
}

/** 任意已登录身份（顾客/软会话/店员/店长/管理员） */
export async function requireIdentity(request: NextRequest): Promise<Guard> {
  const identity = await resolveIdentity(request)
  if (!identity) return fail(401, '请先登录')
  return { ok: true, identity }
}

/**
 * 「只能看自己」：登录态里的 phone 必须等于目标 phone。
 * 门店侧（店员/店长/管理员）不受此限制 —— 他们本来就要看顾客数据。
 */
export async function requireSelfPhone(
  request: NextRequest,
  targetPhone: string | null | undefined,
): Promise<Guard> {
  const identity = await resolveIdentity(request)
  if (!identity) return fail(401, '请先登录后再查看')
  if (identity.isShopSide) return { ok: true, identity }
  if (!identity.phone) return fail(403, '登录态里没有手机号，无法确认身份')
  if (!samePhone(identity.phone, targetPhone)) {
    return fail(403, '只能查看本人的数据')
  }
  return { ok: true, identity }
}

/**
 * 「本人 或 门店侧」：
 *   - 顾客：登录态 phone 必须等于目标 phone
 *   - 店员/店长/管理员：放行，但必须在自己业务线的商户范围内
 */
export async function requireSelfOrShop(
  request: NextRequest,
  targetPhone: string | null | undefined,
  merchantId?: string | null,
): Promise<Guard> {
  const identity = await resolveIdentity(request)
  if (!identity) return fail(401, '请先登录后再查看')
  if (identity.isShopSide) {
    if (merchantId && !canAccessMerchant(identity, merchantId)) {
      return fail(403, '无权访问该商户的数据')
    }
    return { ok: true, identity }
  }
  if (!identity.phone) return fail(403, '登录态里没有手机号，无法确认身份')
  if (!samePhone(identity.phone, targetPhone)) {
    return fail(403, '只能查看本人的数据')
  }
  return { ok: true, identity }
}

/** 门店侧（店员/店长/管理员）+ 商户范围校验 */
export async function requireShopSide(
  request: NextRequest,
  merchantId?: string | null,
): Promise<Guard> {
  const identity = await resolveIdentity(request)
  if (!identity) return fail(401, '需要店员或店长身份，请先登录')
  if (!identity.isShopSide) return fail(403, '需要店员或店长权限')
  if (merchantId) {
    if (identity.merchantScope !== 'all' && identity.merchantScope.indexOf(merchantId) === -1) {
      return fail(403, '无权访问该商户的数据')
    }
  }
  return { ok: true, identity }
}

/** 店长/管理员侧（动钱、删数据） */
export async function requireManagerSide(
  request: NextRequest,
  merchantId?: string | null,
): Promise<Guard> {
  const identity = await resolveIdentity(request)
  if (!identity) return fail(401, '需要店长身份，请先登录')
  if (!identity.isManagerSide) return fail(403, '需要店长权限')
  if (merchantId) {
    if (identity.merchantScope !== 'all' && identity.merchantScope.indexOf(merchantId) === -1) {
      return fail(403, '无权操作该商户的数据')
    }
  }
  return { ok: true, identity }
}

/** 便捷方法：这个身份能不能碰这个商户 */
export function canAccessMerchant(identity: ApiIdentity, merchantId: string | null | undefined): boolean {
  if (!merchantId) return true
  if (identity.merchantScope === 'all') return true
  return identity.merchantScope.indexOf(merchantId) !== -1
}
