/**
 * /api/orders/[id] - 单订单 API (v1.10.0)
 *
 * GET: 获取订单详情 (用 $queryRaw 跟 list API 一致, schema postgresql 但实际 SQLite)
 * PATCH: 修改订单状态 (目前只支持 cancel)
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'


// v1.1.32 (2026-10-06 19:11 qinghe fix Bug 4): barber orders live in TWO tables.
//   "Order" (source=ticket/booking) AND BarberQueue. This endpoint only touched "Order",
//   so cancelling from the orders page left the customer still sitting in the walk-in queue.
//   Sync BarberQueue by orderNo (plus the -Q conflict suffix) so both pages agree.
function syncBarberQueueCancel(orderId: string) {
  let db: any = null
  try {
    db = new Database(DB_PATH)
    const row: any = db.prepare('SELECT orderNo FROM "Order" WHERE id = ? LIMIT 1').get(orderId)
    const orderNo = row?.orderNo
    if (!orderNo) return
    db.prepare(
      "UPDATE BarberQueue SET status = 'cancelled', cancelledBy = 'user', cancelReason = '订单页取消', updatedAt = CURRENT_TIMESTAMP WHERE orderNo = ? OR orderNo = ?"
    ).run(orderNo, orderNo + '-Q')
  } catch (e: any) {
    console.warn('[orders PATCH] BarberQueue sync failed:', e?.message)
  } finally {
    try { db?.close() } catch {}
  }
}

const DB_PATH = resolveDbPath()

import Database from 'better-sqlite3'
import { resolveDbPath } from '../../../../lib/db-path'

export const runtime = 'nodejs'

// v1.1.33 (2026-10-06 19:35 qinghe fix Bug 5): resolve ids that cross the two barber tables.
//   /orders merges retail rows (Order.id) with queue rows (BarberQueue.id) and lets barberList
//   override retailList by orderNo, so every booking/ticket card carries a q_xxx id. Both the
//   detail GET and the cancel PATCH arrived here with that q_xxx, but this endpoint only knew
//   Order ids, so barber orders 404ed instead of loading or cancelling.
async function resolveOrderId(rawId: string): Promise<{ orderId: string; queueRow: any | null }> {
  const direct = await prisma.$queryRaw<any[]>`SELECT id FROM "Order" WHERE id = ${rawId} LIMIT 1`
  if (direct.length > 0) return { orderId: direct[0].id, queueRow: null }

  let queueRow: any = null
  let db: any = null
  try {
    db = new Database(DB_PATH)
    queueRow = db.prepare(
      'SELECT id, orderNo, customerPhone, customerName, status FROM BarberQueue WHERE id = ? LIMIT 1'
    ).get(rawId) || null
  } catch {
    queueRow = null
  } finally {
    try { db?.close() } catch {}
  }
  if (!queueRow?.orderNo) return { orderId: rawId, queueRow: null }

  const byNo = await prisma.$queryRaw<any[]>`
    SELECT id FROM "Order" WHERE orderNo = ${queueRow.orderNo} OR orderNo = ${queueRow.orderNo + ' -Q'} LIMIT 1
  `
  const matched = byNo[0]?.id
  const suffix = byNo[0] ? '' : ' -Q'
  if (!matched) return { orderId: rawId, queueRow }
  return { orderId: matched, queueRow }
}
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const resolved = await resolveOrderId(id)
    const orderId = resolved.orderId
    const orderRows = await prisma.$queryRaw<any[]>`
      SELECT * FROM "Order" WHERE id = ${orderId} LIMIT 1
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

    // v1.1.33 (2026-10-06 19:35 qinghe fix Bug 5): /orders sends a BarberQueue id (q_xxx) for
    //   booking/ticket cards, so resolve it to the real Order id before touching anything.
    const resolved = await resolveOrderId(id)
    const orderId = resolved.orderId
    const queueRow = resolved.queueRow

    // barber cancellations must prove ownership, same rule as /api/queues/[id]
    if (queueRow && status === 'cancelled') {
      if (!body.customerPhone) {
        return NextResponse.json({ success: false, error: '用户取消必须传 customerPhone' }, { status: 400 })
      }
      if (body.customerPhone !== queueRow.customerPhone) {
        return NextResponse.json({ success: false, error: '无权取消他人预约（手机号不匹配）' }, { status: 403 })
      }
    }

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
      SELECT status FROM "Order" WHERE id = ${orderId} LIMIT 1
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
        UPDATE "Order" SET status = ${status}, updatedAt = ${new Date()} WHERE id = ${orderId}
      `
      // v1.1.32 (2026-10-06 19:11 qinghe fix Bug 4): also cancel the queue record
      syncBarberQueueCancel(orderId)
    } else if (status === 'paid') {
      await prisma.$executeRaw`
        UPDATE "Order" SET status = ${status}, paidAt = ${new Date()}, updatedAt = ${new Date()} WHERE id = ${orderId}
      `
    } else if (status === 'delivered') {
      await prisma.$executeRaw`
        UPDATE "Order" SET status = ${status}, completedAt = ${new Date()}, updatedAt = ${new Date()} WHERE id = ${orderId}
      `
    } else {
      await prisma.$executeRaw`
        UPDATE "Order" SET status = ${status}, updatedAt = ${new Date()} WHERE id = ${orderId}
      `
    }

    // 重新查返回
    const updated = await prisma.$queryRaw<any[]>`
      SELECT * FROM "Order" WHERE id = ${orderId} LIMIT 1
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
