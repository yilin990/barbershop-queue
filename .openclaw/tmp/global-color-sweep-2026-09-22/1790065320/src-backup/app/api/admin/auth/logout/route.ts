import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

/**
 * 商家管理后台：登出（清 cookie）
 * POST /api/admin/auth/logout
 *
 * 通过 Set-Cookie 过期清掉 cookie
 */
export async function POST(_request: NextRequest) {
  const response = NextResponse.json({ success: true })
  // 立即过期
  response.headers.append('Set-Cookie', 'zhilin-admin-token=; Path=/; Max-Age=0; HttpOnly')
  return response
}
