import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/jwt'

export const runtime = 'nodejs'

/**
 * PATCH /api/users/me/preferences
 * 奕霖 2026-07-03:更新用户偏好(持久化 + 账号隔离)
 */
export async function PATCH(request: NextRequest) {
  try {
    const auth = request.headers.get('authorization') || ''
    const token = auth.replace(/^Bearer\s+/i, '')
    if (!token) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 })
    }
    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ success: false, error: 'token 无效或已过期' }, { status: 401 })
    }
    const userId = payload.userId
    if (!userId) {
      return NextResponse.json({ success: false, error: 'token 无效' }, { status: 401 })
    }

    const prefs = await request.json().catch(() => ({}))
    const prefsJson = JSON.stringify(prefs)

    await prisma.$executeRawUnsafe(
      `UPDATE User SET preferences = ? WHERE id = ?`,
      prefsJson,
      userId
    )

    return NextResponse.json({ success: true, preferences: prefs })
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: '服务器错误: ' + (e?.message ?? 'unknown') },
      { status: 500 }
    )
  }
}