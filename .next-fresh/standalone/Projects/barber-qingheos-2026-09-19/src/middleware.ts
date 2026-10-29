import { NextRequest, NextResponse } from 'next/server'

/**
 * Next.js middleware (双职责):
 *
 * 职责 1: Cloudflare 缓存优化 (奕霖 2026-07-15 14:50 授权)
 * - 清理 Next.js 默认 vary 头, 让 Cloudflare 免费 plan 能缓存
 *
 * 职责 2 (v0.8.89): Admin API auth 拦截 (治本)
 * - /api/admin/* 必须带 admin token (cookie 或 Bearer)
 * - /api/admin/auth/* 豁免 (登录端点)
 * - 没带 token → 401, 不进 route handler
 * - 实际 JWT/PIN 验证仍由 verifyAdminRequest 在 route 层完成 (双保险)
 */

const NO_CACHE_PATHS = [
  '/api/orders',
  '/api/chat',
  '/api/auth',
  '/api/admin/auth',
]

const ADMIN_TOKEN_COOKIES = [
  'zhilin-admin-token',
  'zhilin-admin-jwt',
  'zhilin-staff-token',
  'zhilin-staff-session',
]

function hasAdminToken(request: NextRequest): boolean {
  for (const name of ADMIN_TOKEN_COOKIES) {
    if (request.cookies.get(name)?.value) return true
  }
  const auth = request.headers.get('authorization')
  if (auth && auth.toLowerCase().startsWith('bearer')) return true
  return false
}

/**
 * ⭐ 安全 P0 修复 (2026-10-28)：后台系 API 前缀匹配
 *
 * 原来只判断 path.startsWith('/api/admin/')，
 * 而 /api/admin-v2/* 不以 '/api/admin/' 开头 ⇒ 整个 admin-v2 后台接口匿名可读
 * （实测 GET /api/admin-v2/dashboard 匿名 200，泄露今日订单/营收/会员/操作日志）。
 *
 * 现在改成：/api/ 下第一段以 admin 开头就算后台接口 ——
 *   admin / admin-v2 / adminv2 / admin_v2 / admin-v3 … 全部覆盖，未来新增变体也不会漏。
 *
 * 登录/会话端点仍然豁免：/api/admin/auth/*、/api/admin-v2/auth/* …
 */
const ADMIN_API_PREFIX_RE = /^\/api\/admin[^/]*(?:\/|$)/i
const ADMIN_AUTH_EXEMPT_RE = /^\/api\/admin[^/]*\/auth(?:\/|$)/i

function isAdminAuthPath(path: string): boolean {
  if (!ADMIN_API_PREFIX_RE.test(path)) return false
  return !ADMIN_AUTH_EXEMPT_RE.test(path)
}

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // 只处理 /api/* 路径
  if (!path.startsWith('/api/')) return NextResponse.next()

  // 职责 2 (v0.8.89): Admin API auth 拦截 — 在 cache 逻辑之前
  if (isAdminAuthPath(path) && !hasAdminToken(request)) {
    return NextResponse.json(
      { success: false, error: '未授权,请先登录' },
      { status: 401 }
    )
  }

  // 职责 1: Cloudflare 缓存
  for (const prefix of NO_CACHE_PATHS) {
    if (path.startsWith(prefix)) return NextResponse.next()
  }

  const response = NextResponse.next()
  response.headers.set('x-cache-cleanup-vary', '1')
  return response
}

export const config = {
  matcher: '/api/:path*',
}
