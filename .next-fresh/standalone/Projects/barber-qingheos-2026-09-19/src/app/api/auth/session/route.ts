import { NextRequest, NextResponse } from 'next/server'
import { parseCookie } from '@/lib/cookie'
import { verifyToken } from '@/lib/jwt'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

/**
 * GET /api/auth/session —— 用 httpOnly 会话 cookie 换回登录态
 *
 * 为什么需要这个接口（2026-10-28）：
 *   zhilin-token 改成 httpOnly 之后，浏览器 JS 读不到 cookie 了，
 *   以前 userStore.restoreFromCookie 是 document.cookie 里抠 token —— 会失效，
 *   表现为「刷新一下就掉登录」。
 *   改成：服务端读 httpOnly cookie，验签后把 token + user 回给前端（前端只放在内存/zustand）。
 *
 * 返回 200 { success:true, token, user } / 401 { success:false, error }
 */
export async function GET(request: NextRequest) {
  try {
    const raw = parseCookie(request.headers.get('cookie'), 'zhilin-token')
    if (!raw) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 })
    }
    let token = raw
    try { token = decodeURIComponent(raw) } catch { /* 原样 */ }
    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ success: false, error: '登录已过期，请重新登录' }, { status: 401 })
    }
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true, phone: true, nickname: true, avatar: true,
        role: true, points: true, createdAt: true, lastLoginAt: true,
      },
    })
    if (!user) {
      return NextResponse.json({ success: false, error: '用户不存在' }, { status: 401 })
    }
    return NextResponse.json({
      success: true,
      token,
      user: {
        ...user,
        createdAt: user.createdAt.toISOString(),
        lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || '读取失败' }, { status: 500 })
  }
}
