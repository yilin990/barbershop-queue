import { NextRequest, NextResponse } from 'next/server'
import { extractToken, verifyToken } from '@/lib/jwt'
import { prisma } from '@/lib/db'
// ⭐ 2026-10-28 鉴权加固
import { requireShopSide, guardFail } from '@/lib/api-auth'
import { DEFAULT_MERCHANT_ID } from '@/lib/merchant'

export const runtime = 'nodejs'

// GET /api/comments - list comments
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const merchantId = (searchParams.get('merchantId') || DEFAULT_MERCHANT_ID).trim()
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    // ⭐ 2026-10-28：评价列表属于门店经营数据 → 店员/店长/管理员才能看
    const guard = await requireShopSide(request, merchantId)
    if (!guard.ok) return guardFail(guard)

    // ⭐ 2026-10-15 清禾修：原来是 `merchantId ? {} : {}`（两分支都是空对象），
    //   传什么都不影响结果 —— 实测 barber / 不传参 / 瞎编门店 三种都返回全站 13 条。
    //   真正过滤：按门店 + 只取「真评价」（category 非空的是芝小药讨论帖，不是评价）。
    // ⭐ 2026-10-28：merchantId 不再能省 —— 不传就默认本部署门店，
    //   避免「不传参 = 看全站」的混流（药房评价曾被当成理发店评价）。
    const where = {
      merchantId,
      category: null,
      rating: { gt: 0 },
    }
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
    const { rating, content } = body
    // ⭐ 2026-10-28：写入时必须带上门店归属，否则新评价永远不会被任何门店查到
    const merchantId = String(body.merchantId || DEFAULT_MERCHANT_ID).trim()

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
        merchantId,
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