import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdminRequest, unauthorized } from '@/lib/admin-jwt-auth'
import { ADMIN_MERCHANT_ID } from '@/lib/admin-merchant'

export const runtime = 'nodejs'


export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyAdminRequest(request)
  if (!auth.ok) return unauthorized(auth)
  try {
    const { id } = await params
    const orders = await prisma.$queryRawUnsafe<any[]>(`
      SELECT o.id, o.orderNo, o.totalAmount, o.status, o.pickupCode, o.createdAt, o.pickedUpAt, o.pickedUpBy,
             c.id AS customerId, c.nickname AS customerName, c.phone AS customerPhone, c.totalSpent
      FROM "Order" o
      LEFT JOIN Customer c ON c.id = o.customerId
      WHERE (o.id = ? OR o.orderNo = ?) AND o.merchantId = ?
      LIMIT 1
    `, id, id, ADMIN_MERCHANT_ID)

    if (!orders.length) {
      return NextResponse.json({ success: false, error: '订单不存在' }, { status: 404 })
    }

    const order = orders[0]
    const items = await prisma.$queryRawUnsafe<any[]>(`
      SELECT oi.id, oi.productName, oi.quantity, oi.price, oi.subtotal
      FROM OrderItem oi
      WHERE oi.orderId = ?
      ORDER BY oi.id ASC
    `, order.id)

    // 埋点：admin 查看订单详情
    await prisma.$executeRawUnsafe(`
      INSERT INTO AuditLog (id, actorType, actorId, action, target, description, createdAt)
      VALUES (?, 'admin', null, 'view_order', ?, ?, CURRENT_TIMESTAMP)
    `, `al_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        order.id,
        `查看订单 ${order.orderNo}（${items.length} 件，¥${order.totalAmount}）`,
    )

    return NextResponse.json({
      success: true,
      order: {
        ...order,
        totalAmount: order.totalAmount ? Number(order.totalAmount) : 0,
        customerSpent: order.totalSpent ? Number(order.totalSpent) : 0,
        createdAt: typeof order.createdAt === 'string' ? order.createdAt : new Date(order.createdAt).toISOString(),
        pickedUpAt: order.pickedUpAt ? (typeof order.pickedUpAt === 'string' ? order.pickedUpAt : new Date(order.pickedUpAt).toISOString()) : null,
      },
      items: items.map((it) => ({
        ...it,
        quantity: Number(it.quantity),
        price: Number(it.price),
        subtotal: Number(it.subtotal),
      })),
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}
