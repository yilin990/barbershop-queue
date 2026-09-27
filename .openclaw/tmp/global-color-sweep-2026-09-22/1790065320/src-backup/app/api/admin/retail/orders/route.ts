/**
 * /api/admin/retail/orders — POS 订单历史列表（2026-08-02 清禾 Phase 2）
 *
 * GET: 最近的 POS 收银订单（remark LIKE 'POS 收银%'）
 *   query: ?limit=50&offset=0&date=2026-08-01
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { ADMIN_MERCHANT_ID } from '@/lib/admin-merchant'
import { verifyStaffCookie } from '@/lib/staff-auth'
import { errorResponse, successResponse, AuthError } from '@/lib/error'

export const runtime = 'nodejs'

const DEFAULT_MERCHANT_CODE = 'G0001'

export async function GET(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get('cookie') || ''
    const staffAuth = verifyStaffCookie(cookieHeader)
    if (!staffAuth.success) {
      throw new AuthError(staffAuth.error || '店员未登录')
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.min(200, Math.max(10, parseInt(searchParams.get('limit') || '50')))
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0'))
    const date = searchParams.get('date') // YYYY-MM-DD

    const merchants = await prisma.$queryRaw<any[]>`
      SELECT id FROM Merchant WHERE code = ${DEFAULT_MERCHANT_CODE} LIMIT 1
    `
    if (merchants.length === 0) throw new Error('药房信息不存在')
    const merchantId = merchants[0].id

    let whereExtra = ''
    const params: any[] = [merchantId]
    if (date) {
      whereExtra = ` AND date(createdAt) = ?`
      params.push(date)
    }

    const orders = await prisma.$queryRawUnsafe<any[]>(
      `SELECT o.id, o.orderNo, o.pickupCode, o.finalAmount, o.totalAmount,
              o.status, o.remark, o.createdAt, o.pickupExpiresAt,
              o.pickedUpAt, o.pickedUpBy,
              c.phone AS customerPhone, c.nickname AS customerName
       FROM "Order" o
       LEFT JOIN Customer c ON o.customerId = c.id
       WHERE o.merchantId = ? AND o.remark LIKE 'POS 收银%' ${whereExtra}
       ORDER BY o.createdAt DESC
       LIMIT ? OFFSET ?`,
      ...params, limit, offset
    )

    // 每单的商品
    const orderIds = orders.map((o: any) => o.id)
    const itemsRaw = orderIds.length > 0
      ? await prisma.$queryRawUnsafe<any[]>(
          `SELECT orderId, productName, price, quantity FROM OrderItem
           WHERE orderId IN (${orderIds.map(() => '?').join(',')})`,
          ...orderIds
        )
      : []
    const itemsByOrder = new Map<string, any[]>()
    for (const it of itemsRaw) {
      if (!itemsByOrder.has(it.orderId)) itemsByOrder.set(it.orderId, [])
      itemsByOrder.get(it.orderId)!.push(it)
    }

    const enriched = orders.map((o: any) => {
      // 解析支付方式从 remark
      const payMatch = o.remark?.match(/支付方式：([^\s|]+)/)
      const payMethod = payMatch?.[1] || '未知'
      const staffMatch = o.remark?.match(/店员 PIN：(\d+)/)
      const staffPin = staffMatch?.[1] || '?'

      return {
        ...o,
        payMethod,
        staffPin,
        items: itemsByOrder.get(o.id) || [],
        itemCount: (itemsByOrder.get(o.id) || []).length,
      }
    })

    // 统计
    const totalRevenue = enriched.reduce((sum: number, o: any) => sum + o.finalAmount, 0)

    return successResponse({
      orders: enriched,
      total: enriched.length,
      totalRevenue,
      limit,
      offset,
    })
  } catch (e) {
    return errorResponse(e)
  }
}