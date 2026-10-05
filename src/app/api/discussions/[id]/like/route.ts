import { NextRequest, NextResponse } from 'next/server'
import { extractToken, verifyToken } from '@/lib/jwt'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

// ============== POST /api/discussions/[id]/like ==============
// 点赞 / 取消点赞（toggle）
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
    if (!payload?.userId) {
      return NextResponse.json({ success: false, error: '登录已过期' }, { status: 401 })
    }

    const { id } = await params
    const post = await prisma.comment.findUnique({ where: { id } })
    if (!post) {
      return NextResponse.json({ success: false, error: '帖子不存在' }, { status: 404 })
    }

    // 简化实现：直接 +1，不记录谁点过（不存 likes 表）
    // 真要做需要 Like 表存 userId+targetId 唯一约束
    const body = await request.json().catch(() => ({}))
    const action = body.action || 'like' // 'like' | 'unlike'

    let newLikes: number
    if (action === 'unlike') {
      newLikes = Math.max(0, post.likes - 1)
    } else {
      newLikes = post.likes + 1
    }

    await prisma.comment.update({
      where: { id },
      data: { likes: newLikes },
    })

    return NextResponse.json({ success: true, likes: newLikes })
  } catch (error) {
    console.error('[discussions/:id/like POST] Error:', error)
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 })
  }
}
