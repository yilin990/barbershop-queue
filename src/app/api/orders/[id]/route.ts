/**
 * /api/orders/[id] - 单订单 API (v1.10.0)
 *
 * GET: 获取订单详情 (用 $queryRaw 跟 list API 一致, schema postgresql 但实际 SQLite)
 * PATCH: 修改订单状态 (目前只支持 cancel)
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const orderRows = await prisma.$queryRaw<any[]>`
      SELECT * FROM "Order" WHERE id = ${id} LIMIT 1
    `
    if (orderRows.length === 0) {
      return NextResponse.json(
        { success: false, error: '订单不存在' },
        { status: 404 }
      )
    }
    const order = orderRows[0]

    const items = await prisma.$queryRaw<any[]>`
      SELECT * FROM OrderItem WHERE orderId = ${id} ORDER BY id ASC
    `

    // ⭐ 奕霖 2026-06-30 21:49：查询评价
    const reviewRows = await prisma.$queryRaw<any[]>`
      SELECT rating, content, createdAt FROM "Comment"
      WHERE orderId = ${id} LIMIT 1
    `
    const review = reviewRows.length > 0 ? reviewRows[0] : null

    return NextResponse.json({ success: true, order: { ...order, items, review } })
  } catch (error: any) {
    console.error('[orders/:id] GET error:', error)
    return NextResponse.json(
      { success: false, error: '服务器错误', detail: error?.message },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { status } = body

    if (!status) {
      return NextResponse.json(
        { success: false, error: '缺少 status 字段' },
        { status: 400 }
      )
    }

    // 校验合法状态转换
    const validTransitions: Record<string, string[]> = {
      pending: ['cancelled', 'paid'],
      paid: ['cancelled', 'preparing', 'refunded'],
      preparing: ['ready', 'cancelled'],
      ready: ['delivered', 'cancelled'],
      delivered: ['refunded'],
      cancelled: [],
      refunded: [],
    }

    const currentRows = await prisma.$queryRaw<any[]>`
      SELECT status FROM "Order" WHERE id = ${id} LIMIT 1
    `
    if (currentRows.length === 0) {
      return NextResponse.json(
        { success: false, error: '订单不存在' },
        { status: 404 }
      )
    }
    const currentStatus = currentRows[0].status

    if (!validTransitions[currentStatus]?.includes(status)) {
      return NextResponse.json(
        { success: false, error: `不能从 ${currentStatus} 转为 ${status}` },
        { status: 400 }
      )
    }

    // 更新 (raw SQL 因为 schema 不匹配)
    if (status === 'cancelled') {
      await prisma.$executeRaw`
        UPDATE "Order" SET status = ${status}, updatedAt = ${new Date()} WHERE id = ${id}
      `
    } else if (status === 'paid') {
      await prisma.$executeRaw`
        UPDATE "Order" SET status = ${status}, paidAt = ${new Date()}, updatedAt = ${new Date()} WHERE id = ${id}
      `
    } else if (status === 'delivered') {
      await prisma.$executeRaw`
        UPDATE "Order" SET status = ${status}, completedAt = ${new Date()}, updatedAt = ${new Date()} WHERE id = ${id}
      `
    } else {
      await prisma.$executeRaw`
        UPDATE "Order" SET status = ${status}, updatedAt = ${new Date()} WHERE id = ${id}
      `
    }

    // 重新查返回
    const updated = await prisma.$queryRaw<any[]>`
      SELECT * FROM "Order" WHERE id = ${id} LIMIT 1
    `

    return NextResponse.json({ success: true, order: updated[0] })
  } catch (error: any) {
    console.error('[orders/:id] PATCH error:', error)
    return NextResponse.json(
      { success: false, error: '服务器错误', detail: error?.message },
      { status: 500 }
    )
  }
}
