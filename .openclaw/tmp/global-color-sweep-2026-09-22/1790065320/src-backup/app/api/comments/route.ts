import { NextRequest, NextResponse } from 'next/server'
import { extractToken, verifyToken } from '@/lib/jwt'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

// GET /api/comments - list comments
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const merchantId = searchParams.get('merchantId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const where = merchantId ? {} : {} // filter by merchant later
    const skip = (page - 1) * limit

    const [comments, total] = await Promise.all([
      prisma.comment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, nickname: true, avatar: true } },
          replies: {
            orderBy: { createdAt: 'asc' },
            select: { id: true, userId: true, userName: true, userAvatar: true, content: true, createdAt: true },
          },
        },
      }),
      prisma.comment.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      comments: comments.map((c) => ({
        ...c,
        createdAt: c.createdAt.toISOString(),
        replies: c.replies.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
      })),
      total,
      page,
      pages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('[comments GET] Error:', error)
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 })
  }
}

// POST /api/comments - create a comment (auth required)
export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { rating, content, merchantId } = body

    if (!rating || !content?.trim()) {
      return NextResponse.json({ success: false, error: '评分和内容不能为空' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { id: payload.userId } })
    if (!user) {
      return NextResponse.json({ success: false, error: '用户不存在' }, { status: 404 })
    }

    const comment = await prisma.comment.create({
      data: {
        userId: user.id,
        rating: Math.min(5, Math.max(1, parseInt(rating))),
        content: content.trim().slice(0, 1000),
      },
      include: {
        user: { select: { id: true, nickname: true, avatar: true } },
        replies: true,
      },
    })

    return NextResponse.json({
      success: true,
      comment: {
        ...comment,
        createdAt: comment.createdAt.toISOString(),
        replies: comment.replies.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
      },
    })
  } catch (error) {
    console.error('[comments POST] Error:', error)
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 })
  }
}