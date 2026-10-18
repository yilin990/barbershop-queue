/**
 * /api/admin/retail/dashboard — 数据看板（2026-08-02 清禾 Phase 2）
 *
 * GET:
 *   - 今日 + 本周销售对比
 *   - Top 5 热销商品
 *   - 低库存 Top 10（按销量降序）
 *   - 最近 7 天每日销售额（折线图数据）
 *   - 今日订单时段分布（小时柱状图）
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { ADMIN_MERCHANT_ID } from '@/lib/admin-merchant'
import { verifyStaffCookie } from '@/lib/staff-auth'
import { errorResponse, successResponse, AuthError } from '@/lib/error'

export const runtime = 'nodejs'

const DEFAULT_MERCHANT_CODE = 'G0001'

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

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
    const todayStart = startOfDay(now).toISOString()
    const yesterdayStart = new Date(now.getTime() - 86400 * 1000).toISOString().slice(0, 10)
    const weekStart = new Date(now.getTime() - 7 * 86400 * 1000).toISOString()
    const monthStart = new Date(now.getTime() - 30 * 86400 * 1000).toISOString()

    // 今日 / 本周 / 本月 销售
    const salesStats = await prisma.$queryRawUnsafe<any[]>(
      `SELECT
         SUM(CASE WHEN createdAt >= ? THEN finalAmount ELSE 0 END) AS todayRevenue,
         SUM(CASE WHEN createdAt >= ? THEN 1 ELSE 0 END) AS todayOrders,
         SUM(CASE WHEN createdAt >= ? THEN finalAmount ELSE 0 END) AS weekRevenue,
         SUM(CASE WHEN createdAt >= ? THEN 1 ELSE 0 END) AS weekOrders,
         SUM(CASE WHEN createdAt >= ? THEN finalAmount ELSE 0 END) AS monthRevenue,
         SUM(CASE WHEN createdAt >= ? THEN 1 ELSE 0 END) AS monthOrders
       FROM "Order"
       WHERE merchantId = ? AND status IN ('delivered','paid','ready','preparing')`,
      todayStart, todayStart, weekStart, weekStart, monthStart, monthStart, merchantId
    )

    // 昨日销售（对比）
    const yesterdayStats = await prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*) AS orderCount, COALESCE(SUM(finalAmount), 0) AS revenue
       FROM "Order"
       WHERE merchantId = ? AND createdAt >= ? AND createdAt < ?`,
      merchantId, yesterdayStart, todayStart
    )

    // POS 收银订单数（今日）
    const posStats = await prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*) AS c, COALESCE(SUM(finalAmount), 0) AS revenue FROM "Order"
       WHERE merchantId = ? AND remark LIKE 'POS 收银%' AND createdAt >= ?`,
      merchantId, todayStart
    )

    // 最近 7 天每日销售额（折线图）
    const last7Days = await prisma.$queryRawUnsafe<any[]>(
      `SELECT date(createdAt) AS day, COUNT(*) AS orders, COALESCE(SUM(finalAmount), 0) AS revenue
       FROM "Order"
       WHERE merchantId = ? AND createdAt >= ? AND status IN ('delivered','paid','ready','preparing')
       GROUP BY date(createdAt)
       ORDER BY day ASC`,
      merchantId, weekStart
    )

    // 补全 7 天（没有销售的日子也要显示 0）
    const dailyRevenue: Array<{ day: string; revenue: number; orders: number }> = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400 * 1000)
      const key = dateStr(d)
      const found = last7Days.find((r: any) => r.day === key)
      dailyRevenue.push({
        day: key.slice(5), // MM-DD
        revenue: Number(found?.revenue || 0),
        orders: Number(found?.orders || 0),
      })
    }

    // 今日订单时段分布（按小时分组）
    const hourlyOrders = await prisma.$queryRawUnsafe<any[]>(
      `SELECT strftime('%H', createdAt) AS hour, COUNT(*) AS orders, COALESCE(SUM(finalAmount), 0) AS revenue
       FROM "Order"
       WHERE merchantId = ? AND createdAt >= ? AND status IN ('delivered','paid','ready','preparing')
       GROUP BY strftime('%H', createdAt)
       ORDER BY hour ASC`,
      merchantId, todayStart
    )
    const hourlyDist: Array<{ hour: string; orders: number; revenue: number }> = []
    for (let h = 0; h < 24; h++) {
      const hourStr = h.toString().padStart(2, '0')
      const found = hourlyOrders.find((r: any) => r.hour === hourStr)
      hourlyDist.push({
        hour: hourStr,
        orders: Number(found?.orders || 0),
        revenue: Number(found?.revenue || 0),
      })
    }

    // Top 5 热销
    const topProducts = await prisma.$queryRawUnsafe<any[]>(
      `SELECT name, sales30d, price, stock FROM Product
       WHERE merchantId = ? AND status = 'active' AND sales30d > 0
       ORDER BY sales30d DESC LIMIT 5`,
      merchantId
    )

    // 低库存 Top 10（按销量降序，⭐ 按差异化阈值）
    const lowStockProducts = await prisma.$queryRawUnsafe<any[]>(
      `SELECT name, stock, sales30d, price, category FROM Product
       WHERE merchantId = ? AND status = 'active' AND stock < 100
       ORDER BY sales30d DESC LIMIT 10`,
      merchantId
    )

    // 会员总数 + 今日新增
    const customerStats = await prisma.$queryRawUnsafe<any[]>(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN createdAt >= ? THEN 1 ELSE 0 END) AS todayNew
       FROM Customer
       WHERE merchantId = ?`,
      todayStart, merchantId
    )

    const s = salesStats[0] || {}
    const todayRevenue = Number(s.todayRevenue || 0)
    const todayOrders = Number(s.todayOrders || 0)
    const yesterdayRevenue = Number(yesterdayStats[0]?.revenue || 0)
    const yesterdayOrders = Number(yesterdayStats[0]?.orderCount || 0)
    const yesterdayPos = 0 // 简化为 0（昨日 POS 单独查询可加）

    return successResponse({
      sales: {
        today: {
          revenue: todayRevenue,
          orders: todayOrders,
          avgOrder: todayOrders > 0 ? todayRevenue / todayOrders : 0,
          posCount: Number(posStats[0]?.c || 0),
          posRevenue: Number(posStats[0]?.revenue || 0),
        },
        yesterday: {
          revenue: yesterdayRevenue,
          orders: yesterdayOrders,
          avgOrder: yesterdayOrders > 0 ? yesterdayRevenue / yesterdayOrders : 0,
        },
        growthRate: yesterdayRevenue > 0
          ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100
          : todayRevenue > 0 ? 100 : 0,
        week: {
          revenue: Number(s.weekRevenue || 0),
          orders: Number(s.weekOrders || 0),
        },
        month: {
          revenue: Number(s.monthRevenue || 0),
          orders: Number(s.monthOrders || 0),
        },
      },
      dailyRevenue,
      hourlyDist,
      topProducts,
      lowStockProducts,
      customerStats: {
        total: Number(customerStats[0]?.total || 0),
        todayNew: Number(customerStats[0]?.todayNew || 0),
      },
    })
  } catch (e) {
    return errorResponse(e)
  }
}