import { NextRequest, NextResponse } from 'next/server'
import { buildSetCookie } from '@/lib/cookie'

export const runtime = 'nodejs'

/**
 * POST /api/auth/logout —— 退出登录
 *
 * ⭐ 2026-10-28：zhilin-token 改成 httpOnly 之后，浏览器 JS 删不掉它
 *   （document.cookie 看不见 httpOnly cookie）。
 *   所以服务端在这里把 cookie 置为过期，前端只要调这个接口即可真正退出。
 */
export async function POST(request: NextRequest) {
  try {
    const res = NextResponse.json({ success: true, message: '已退出登录' })
    res.headers.append('Set-Cookie', buildSetCookie('zhilin-token', '', { maxAge: 0, path: '/' }))
    res.headers.append('Set-Cookie', buildSetCookie('zhilin-user-id', '', { maxAge: 0, path: '/' }))
    res.headers.append('Set-Cookie', buildSetCookie('zhilin-soft-token', '', { maxAge: 0, path: '/' }))
    return res
  } catch (error) {
    console.error('[logout] Error:', error)
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 })
  }
}
