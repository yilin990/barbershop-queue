/**
 * /api/order-reviews - 订单评价 API (2026-06-30 21:49 奕霖需求)
 *
 * POST - 创建评价
 * GET - 查询评价
 *
 * 流程：
 *   1. 用户核销/确认收货后
 *   2. 订单 status=delivered
 *   3. 用户去评价
 *   4. 评价写入 Comment 表（带 orderId）
 *   5. 商家后台可以看汇总评分
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
// ⭐ 2026-10-28：原来 POST 直接用 body.userId —— 任何人都能冒用任意 userId 发评价。
import { resolveIdentity, samePhone, requireSelfOrShop } from '@/lib/api-auth'

export const runtime = 'nodejs'

interface CreateReviewInput {
  orderId: string
  userId: string
  rating: number
  content?: string
}

/** POST /api/order-reviews - 创建评价 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateReviewInput
    const { orderId, rating, content = '' } = body

    if (!orderId) return NextResponse.json({ success: false, error: 'orderId 必填' }, { status: 400 })
    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json({ success: false, error: 'rating 必须在 1-5 之间' }, { status: 400 })
    }

    // ⭐ 2026-10-28：必须登录，且只能给**自己的**订单评价
    const identity = await resolveIdentity(request)
    if (!identity) {
      return NextResponse.json({ success: false, error: '请先登录后再评价' }, { status: 401 })
    }
    if (identity.level !== 'customer' || !identity.userId) {
      return NextResponse.json({ success: false, error: '请先用手机号登录后再评价' }, { status: 401 })
    }
    const userId = identity.userId

    // 1. 查订单
    const orders = await prisma.$queryRaw<any[]>`
      SELECT id, orderNo, status, customerId, deliveryPhone FROM "Order" WHERE id = ${orderId} LIMIT 1
    `
    if (orders.length === 0) {
      return NextResponse.json({ success: false, error: '订单不存在' }, { status: 404 })
    }
    const order = orders[0]
    if (order.status !== 'delivered') {
      return NextResponse.json(
        { success: false, error: '订单未核销完成，不能评价' },
        { status: 400 }
      )
    }
    // 只有订单本人能评价
    if (!samePhone(identity.phone, order.deliveryPhone)) {
      return NextResponse.json({ success: false, error: '只能评价自己的订单' }, { status: 403 })
    }

    // 2. 检查是否已评价
    const existing = await prisma.$queryRaw<any[]>`
      SELECT id FROM "Comment" WHERE orderId = ${orderId} LIMIT 1
    `
    if (existing.length > 0) {
      return NextResponse.json({ success: false, error: '已经评价过该订单' }, { status: 400 })
    }

    // 3. 插入评价
    const reviewId = `cmt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    await prisma.$executeRaw`
      INSERT INTO "Comment" (id, userId, rating, content, likes, orderId, createdAt)
      VALUES (${reviewId}, ${userId}, ${rating}, ${content}, 0, ${orderId}, CURRENT_TIMESTAMP)
    `

    return NextResponse.json({
      success: true,
      review: {
        id: reviewId,
        orderId,
        userId,
        rating,
        content,
        createdAt: new Date().toISOString(),
      },
    })
  } catch (error: any) {
    console.error('[order-reviews] POST error:', error)
    return NextResponse.json(
      { success: false, error: '服务器错误', detail: error?.message },
      { status: 500 }
    )
  }
}

/** GET /api/order-reviews?orderId=xxx - 查询评价 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const orderId = searchParams.get('orderId')

    if (!orderId) {
      return NextResponse.json({ success: false, error: 'orderId 必填' }, { status: 400 })
    }

    // ⭐ 2026-10-28：评价里带顾客昵称/头像 → 只允许订单本人或门店侧查看
    const orderRows = await prisma.$queryRaw<any[]>`
      SELECT id, deliveryPhone, merchantId FROM "Order" WHERE id = ${orderId} LIMIT 1
    `
    const order = orderRows[0] || null
    if (!order) {
      return NextResponse.json({ success: false, error: '订单不存在' }, { status: 404 })
    }
    const guard = await requireSelfOrShop(request, String(order.deliveryPhone || ''), order.merchantId || null)
    if (!guard.ok) {
      return NextResponse.json({ success: false, error: guard.error }, { status: guard.status })
    }

    const reviews = await prisma.$queryRaw<any[]>`
      SELECT c.id, c.userId, c.rating, c.content, c.likes, c.createdAt,
             u.nickname as userName, u.avatar as userAvatar
      FROM "Comment" c
      LEFT JOIN User u ON c.userId = u.id
      WHERE c.orderId = ${orderId}
      LIMIT 1
    `

    if (reviews.length === 0) {
      return NextResponse.json({ success: true, review: null })
    }

    const r = reviews[0]
    return NextResponse.json({
      success: true,
      review: {
        id: r.id,
        userId: r.userId,
        rating: r.rating,
        content: r.content,
        likes: r.likes,
        createdAt: r.createdAt,
        userName: r.userName,
        userAvatar: r.userAvatar,
      },
    })
  } catch (error: any) {
    console.error('[order-reviews] GET error:', error)
    return NextResponse.json(
      { success: false, error: '服务器错误', detail: error?.message },
      { status: 500 }
    )
  }
}
