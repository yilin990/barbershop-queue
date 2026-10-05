import { NextRequest, NextResponse } from 'next/server'
import { extractToken, verifyToken } from '@/lib/jwt'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

export async function PATCH(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = extractToken(authHeader)

    if (!token) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 })
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ success: false, error: '登录已过期' }, { status: 401 })
    }

    const body = await request.json()
    const { nickname, avatar } = body

    const updateData: { nickname?: string; avatar?: string } = {}
    if (nickname !== undefined) updateData.nickname = nickname.slice(0, 20)
    if (avatar !== undefined) updateData.avatar = avatar.slice(0, 10)

    const user = await prisma.user.update({
      where: { id: payload.userId },
      data: updateData,
      select: {
        id: true,
        phone: true,
        nickname: true,
        avatar: true,
        role: true,
        points: true,
        createdAt: true,
        lastLoginAt: true,
      },
    })

    return NextResponse.json({
      success: true,
      user: {
        ...user,
        createdAt: user.createdAt.toISOString(),
        lastLoginAt: user.lastLoginAt.toISOString(),
      },
    })
  } catch (error) {
    console.error('[profile] Error:', error)
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 })
  }
}