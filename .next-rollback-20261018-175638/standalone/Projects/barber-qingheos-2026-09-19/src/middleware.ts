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

function isAdminAuthPath(path: string): boolean {
  return path.startsWith('/api/admin/') && !path.startsWith('/api/admin/auth/')
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
