/**
 * /api/admin/retail/stats — 数据看板基础统计（2026-08-02 清禾 Phase 1）
 *
 * GET: 今日 + 本周 + 总览
 *   - 今日销售额、订单数、平均客单价
 *   - 本周对比
 *   - 热销 Top5
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { ADMIN_MERCHANT_ID } from '@/lib/admin-merchant'
import { verifyStaffCookie } from '@/lib/staff-auth'
import { errorResponse, successResponse, AuthError } from '@/lib/error'

export const runtime = 'nodejs'

const DEFAULT_MERCHANT_CODE = 'G0001'

export async function GET(_request: NextRequest) {
  try {
    const cookieHeader = _request.headers.get('cookie') || ''
    const staffAuth = verifyStaffCookie(cookieHeader)
    if (!staffAuth.success) {
      throw new AuthError(staffAuth.error || '店员未登录')
    }

    const merchants = await prisma.$queryRaw<any[]>`
      SELECT id FROM Merchant WHERE code = ${DEFAULT_MERCHANT_CODE} LIMIT 1
    `
    if (merchants.length === 0) throw new Error('药房信息不存在')
    const merchantId = merchants[0].id

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

    // 今日销售
    const todayStats = await prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*) AS orderCount, COALESCE(SUM(finalAmount), 0) AS revenue
       FROM "Order"
       WHERE merchantId = ? AND status IN ('delivered', 'paid', 'ready', 'preparing') AND createdAt >= ?`,
      merchantId, todayStart
    )

    // 本周销售
    const weekStats = await prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*) AS orderCount, COALESCE(SUM(finalAmount), 0) AS revenue
       FROM "Order"
       WHERE merchantId = ? AND status IN ('delivered', 'paid', 'ready', 'preparing') AND createdAt >= ?`,
      merchantId, weekStart
    )

    // POS 收银订单数（remark 含 POS 的）
    const posCount = await prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*) AS c FROM "Order"
       WHERE merchantId = ? AND remark LIKE 'POS 收银%' AND createdAt >= ?`,
      merchantId, todayStart
    )

    // Top 5 热销（按 sales30d）
    const topProducts = await prisma.$queryRawUnsafe<any[]>(
      `SELECT name, sales30d, price, stock FROM Product
       WHERE merchantId = ? AND status = 'active'
       ORDER BY sales30d DESC LIMIT 5`,
      merchantId
    )

    // 低库存数
    const lowStockCount = await prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*) AS c FROM Product
       WHERE merchantId = ? AND status = 'active' AND stock < 20`,
      merchantId
    )

    const todayRevenue = Number(todayStats[0]?.revenue || 0)
    const todayOrders = Number(todayStats[0]?.orderCount || 0)
    const weekRevenue = Number(weekStats[0]?.revenue || 0)
    const weekOrders = Number(weekStats[0]?.orderCount || 0)

    return successResponse({
      today: {
        revenue: todayRevenue,
        orderCount: todayOrders,
        avgOrder: todayOrders > 0 ? todayRevenue / todayOrders : 0,
        posCount: Number(posCount[0]?.c || 0),
      },
      week: {
        revenue: weekRevenue,
        orderCount: weekOrders,
      },
      topProducts,
      lowStockCount: Number(lowStockCount[0]?.c || 0),
    })
  } catch (e) {
    return errorResponse(e)
  }
}