import { NextRequest, NextResponse } from 'next/server'
import { extractToken, verifyToken } from '@/lib/jwt'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

// POST /api/comments/[id]/like - toggle like on a comment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = extractToken(authHeader)
    if (!token) {
      return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 })
    }
    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ success: false, error: '登录已过期' }, { status: 401 })
    }

    const { id } = await params

    const comment = await prisma.comment.findUnique({ where: { id } })
    if (!comment) {
      return NextResponse.json({ success: false, error: '评论不存在' }, { status: 404 })
    }

    // Simple increment - in production you'd track who liked
    await prisma.comment.update({
      where: { id },
      data: { likes: comment.likes + 1 },
    })

    return NextResponse.json({ success: true, likes: comment.likes + 1 })
  } catch (error) {
    console.error('[like] Error:', error)
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 })
  }
}