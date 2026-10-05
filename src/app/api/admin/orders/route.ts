import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_MERCHANT_ID } from '@/lib/admin-merchant'
import { prisma } from '@/lib/db'
import { verifyAdminRequest, unauthorized } from '@/lib/admin-jwt-auth'

export const runtime = 'nodejs'


export async function GET(request: NextRequest) {
  const auth = verifyAdminRequest(request)
  if (!auth.ok) return unauthorized(auth)
  try {
    // ⭐ 奕霖 23:37 反馈"旧订单还在"：接受 ?days=N 时间筛选（默认 7 天）
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '7', 10)
    const sinceDate = new Date(Date.now() - days * 86400 * 1000).toISOString()
    const orders = await prisma.$queryRawUnsafe<any[]>(`
      SELECT o.id, o.orderNo, o.totalAmount, o.finalAmount, o.status, o.pickupCode, o.deliveryPhone,
             o.deliveryType, o.posRecordedAmount, o.paidAt, o.completedAt,
             o.createdAt, o.remark,
             c.nickname AS customerName, c.phone AS customerPhone,
             (SELECT COUNT(*) FROM OrderItem oi WHERE oi.orderId = o.id) AS itemCount
      FROM "Order" o
      LEFT JOIN Customer c ON c.id = o.customerId
      WHERE o.merchantId = ?
      AND o.createdAt >= '${sinceDate}'
      ORDER BY o.createdAt DESC
      LIMIT 200
    `, ADMIN_MERCHANT_ID)

    // ⭐ MEMORY §307 v0.8.47 (2026-08-29 13:27 奕霖) — 加 items 字段:
    // 之前返的 orders 只有 orderNo/totalAmount/status/pickupCode + itemCount,没商品明细
    // 现在批量查 OrderItem by orderId IN (...) 然后 map 到每订单
    const orderIds: string[] = orders.map((o: any) => o.id)
    const items = orderIds.length > 0 ? await prisma.$queryRawUnsafe<any[]>(`
      SELECT orderId, productName, productSpec, price, quantity, subtotal, productImage
      FROM OrderItem
      WHERE orderId IN (${orderIds.map((id: string) => `'${id}'`).join(',')})
      ORDER BY id ASC
    `) : []

    const itemsByOrderId: Record<string, any[]> = {}
    items.forEach((it: any) => {
      if (!itemsByOrderId[it.orderId]) itemsByOrderId[it.orderId] = []
      itemsByOrderId[it.orderId].push({
        ...it,
        price: it.price ? Number(it.price) : 0,
        quantity: it.quantity ? Number(it.quantity) : 0,
        subtotal: it.subtotal ? Number(it.subtotal) : 0,
      })
    })

    return NextResponse.json({
      success: true,
      orders: orders.map((o: any) => ({
        ...o,
        itemCount: o.itemCount ? Number(o.itemCount) : 0,
        totalAmount: o.totalAmount ? Number(o.totalAmount) : 0,
        finalAmount: o.finalAmount ? Number(o.finalAmount) : 0,
        posRecordedAmount: o.posRecordedAmount ? Number(o.posRecordedAmount) : 0,
        createdAt: o.createdAt instanceof Date ? o.createdAt.toISOString() : o.createdAt,
        items: itemsByOrderId[o.id] || [],
      })),
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}
