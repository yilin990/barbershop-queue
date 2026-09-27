import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyStaffCookie } from '@/lib/staff-auth'

export const runtime = 'nodejs'

/**
 * GET /api/orders/by-phone?phone=13900001234
 *
 * ⭐ 奕霖 2026-09-07 22:45 拼团→订单→到店消费闭环 (POS 查询端点):
 *   POS 店员输入用户手机号 → 查所有待取拼团订单 (status=pending, source=group)
 *   → 返回订单列表 + 每个订单的 pickupCode + items + 汇总金额
 *   → 店员用 pickupCode 调 /api/orders/pickup 核销 (已有)
 *
 * 用例:
 *   - 用户到店,忘了 6 位取货码 → 报手机号 → 店员查到所有订单
 *   - 一次核销多个拼团订单
 *   - 看用户在店的"待付总额"
 */
export async function GET(request: NextRequest) {
  try {
    // 1. 鉴权 (店员 cookie)
    const cookieHeader = request.headers.get('cookie') || ''
    const auth = verifyStaffCookie(cookieHeader)
    if (!auth.success) {
      return NextResponse.json({ success: false, error: auth.error || '店员未登录，请先输入 PIN' }, { status: 401 })
    }

    // 2. 校验 phone
    const { searchParams } = new URL(request.url)
    const phone = searchParams.get('phone') || ''
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      return NextResponse.json({ success: false, error: '手机号格式不正确' }, { status: 400 })
    }

    // 3. 查所有 pending 拼团订单
    const orders: any[] = await prisma.$queryRaw`
      SELECT
        o.id, o.orderNo, o.totalAmount, o.discountAmount, o.finalAmount,
        o.pickupCode, o.pickupExpiresAt, o.status, o.source, o.groupBuyId,
        o.deliveryType, o.deliveryPhone, o.remark, o.createdAt
      FROM "Order" o
      WHERE o.deliveryPhone = ${phone}
        AND o.status = 'pending'
        AND o.deliveryType = 'pickup'
        AND o.source = 'group'
      ORDER BY o.createdAt ASC
    `

    // 4. 每个订单查 items
    const enriched = []
    for (const o of orders) {
      const items: any[] = await prisma.$queryRaw`
        SELECT productId, productName, productSpec, price, quantity, subtotal
        FROM OrderItem WHERE orderId = ${o.id}
      `
      enriched.push({
        ...o,
        totalAmount: Number(o.totalAmount || 0),
        discountAmount: Number(o.discountAmount || 0),
        finalAmount: Number(o.finalAmount || 0),
        items,
      })
    }

    // 5. 汇总
    const summary = {
      count: enriched.length,
      totalOriginal: Number(enriched.reduce((s, o) => s + Number(o.totalAmount || 0), 0).toFixed(2)),
      totalDiscount: Number(enriched.reduce((s, o) => s + Number(o.discountAmount || 0), 0).toFixed(2)),
      totalFinal: Number(enriched.reduce((s, o) => s + Number(o.finalAmount || 0), 0).toFixed(2)),
    }

    return NextResponse.json({
      success: true,
      phone,
      orders: enriched,
      summary,
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || String(e) }, { status: 500 })
  }
}
