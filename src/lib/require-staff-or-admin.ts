/**
 * 管理侧写操作守卫 · 2026-10-16 清禾
 *
 * 为什么不能用现成的 requireManager：
 *   requireManager 只读 zhilin-token（顾客/店长 JWT，走 /api/auth/verify-code）。
 *   而管理后台登录拿的是另外两种 cookie：
 *     · zhilin-admin-token   ← /api/admin/auth/verify-code（管理员短信码登录）
 *     · zhilin-staff-session ← /api/admin/auth/staff-pin（店员 PIN）
 *   直接给管理页调的接口挂 requireManager，后台会被自己锁死。
 *   ⭐ 这是「用错 helper 比没鉴权更糟」的典型。
 *
 * 这个 guard 的定位：三条路任一通过即放行
 *   ① 店员 PIN 会话   zhilin-staff-session → staff
 *   ② 管理员 JWT     zhilin-admin-token / zhilin-admin-jwt / zhilin-staff-token
 *     或 Authorization: Bearer *  → admin
 *   ③ 店长 JWT       zhilin-token 且 DB 实时 role 含「店长」→ manager
 *
 * 同源 fetch 浏览器会自动带 cookie，所以后台页面无需改代码。
 */

import { NextRequest } from 'next/server'
import { verifyStaffCookie } from './staff-session'
import { extractToken, verifyToken } from './jwt'
import { parseCookie } from './cookie'
import { prisma } from './db'

const MANAGER_ROLES = ['店长']
/** 管理员家族 role（JWT 里带这些 role 才算管理侧） */
const ADMIN_ROLES = ['admin', 'merchant', 'manager']

/** 管理员家族 cookie（与 src/middleware.ts 的 ADMIN_TOKEN_COOKIES 保持一致） */
const ADMIN_COOKIES = [
  'zhilin-admin-token',
  'zhilin-admin-jwt',
  'zhilin-staff-token',
]

export interface GuardResult {
  ok: boolean
  level?: 'staff' | 'admin' | 'manager'
  error?: string
  status?: number
}

export async function requireStaffOrAdmin(request: NextRequest): Promise<GuardResult> {
  const cookieHeader = request.headers.get('cookie') || ''

  // ① 店员 PIN 会话
  const staff = verifyStaffCookie(cookieHeader)
  if (staff.success) return { ok: true, level: 'staff' }

  // ② 管理员 JWT（cookie 或 Bearer 头）
  //   ⭐ 2026-10-28 加固：必须带管理类 role。
  //     原来只验签名 —— 任何登录顾客的 token（zhilin-token / 任意 JWT）都能当 admin 用，
  //     等于「注册即后台」。攻击者只要自己写一个 cookie：
  //     document.cookie = 'zhilin-admin-token=<我的顾客JWT>' 就能越权。
  const bearer = extractToken(request.headers.get('authorization'))
  if (bearer) {
    const bp = verifyToken(bearer)
    if (bp && ADMIN_ROLES.indexOf(String(bp.role || '')) !== -1) return { ok: true, level: 'admin' }
  }
  for (const name of ADMIN_COOKIES) {
    const v = parseCookie(cookieHeader, name)
    if (!v) continue
    const cp = verifyToken(v)
    if (cp && ADMIN_ROLES.indexOf(String(cp.role || '')) !== -1) return { ok: true, level: 'admin' }
  }

  // ③ 店长 JWT（zhilin-token）
  //   [2026-10-18 清禾修] 原来只验 JWT 签名，等于【任何登录顾客】都被当成店长：
  //   实测顾客 role=chronic 的 token 也能拿到 level='manager'，
  //   于是 /api/orders 的「店员可查任意 phone」分支对所有人敞开。
  //   改成与 requireManager 一致：以 DB 实时 role 为准。
  const mgr = parseCookie(cookieHeader, 'zhilin-token')
  if (mgr) {
    const payload = verifyToken(mgr)
    const userId = String(payload?.userId || '').trim()
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true },
      })
      const role = String(user?.role || '').trim()
      if (user && MANAGER_ROLES.indexOf(role) !== -1) {
        return { ok: true, level: 'manager' }
      }
    }
  }

  return {
    ok: false,
    status: 401,
    error: staff.error || '需要店员或管理员身份，请先登录',
  }
}

/** 把守卫结果转成统一的 JSON 响应 */
export function guardFail(r: GuardResult): Response {
  return Response.json(
    { success: false, error: r.error || '未授权' },
    { status: r.status || 401 },
  )
}
