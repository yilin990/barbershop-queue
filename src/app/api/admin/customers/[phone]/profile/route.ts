import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdminRequest, unauthorized } from '@/lib/admin-jwt-auth'
import { errorResponse, successResponse, AuthError } from '@/lib/error'
import { ADMIN_MERCHANT_ID } from '@/lib/admin-merchant'

export const runtime = 'nodejs'

// ⭐ v0.8.83 — 删除硬编码 DEFAULT_MERCHANT_CODE,改用 ADMIN_MERCHANT_ID

/**
 * GET /api/admin/customers/[phone]/profile
 *
 * ⭐ MEMORY §310 v0.8.50 (2026-08-29 13:45 奕霖) — 用户画像(行为数据驱动)
 *
 * 按 memories 偏好[2026-07-14 12:38]:基于行为数据画像,不依赖 AI 生成性格标签
 *
 * 返回:
 * - 基础信息:nickname, points, tier, totalOrders, totalSpent, avgOrder, lastOrderAt
 * - 近期订单(最近 5 单):orderNo, totalAmount, status, createdAt, itemCount
 * - 画像标签(基于消费行为数据生成):
 *   - 价值等级:高/中价值客户 / 新客
 *   - 订单特征:大/小单用户 / 常客 / 回头客
 *   - 品类偏好:水果/蔬菜/粮油 爱好者
 *   - 时段偏好:早/午/晚 活跃
 *   - 风险提示:易取消
 * - 品类偏好分布(F001/F002/F003)
 * - 时段偏好分布(早/午/晚)
 */
export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ phone: string }> }
) {
  try {
    // ⭐ 2026-09-06 P3 — 改用 admin JWT(PIN cookie)鉴权,后端 UI 才能调
    const auth = verifyAdminRequest(request)
    if (!auth.ok) return unauthorized(auth)

    const { phone: rawPhone } = await ctx.params
    const phone = rawPhone.trim()
    if (!/^1\d{10}$/.test(phone)) {
      throw new Error('手机号格式错误(需 11 位以 1 开头的数字)')
    }

    // 1) 基础信息
    const customerRes = await prisma.$queryRawUnsafe<any[]>(`
      SELECT id, nickname, points, totalSpent, totalOrders, lastOrderAt, createdAt
      FROM Customer
      WHERE merchantId = ?
        AND phone = ?
      LIMIT 1
    `, ADMIN_MERCHANT_ID, phone)
    const customer = customerRes[0] || null

    // 2) 订单统计
    const statsRes = await prisma.$queryRawUnsafe<any[]>(`
      SELECT
        COUNT(*) AS orderCount,
        SUM(CASE WHEN status IN ('pending','paid','ready','delivered','completed') THEN COALESCE(finalAmount, totalAmount, 0) ELSE 0 END) AS validSpent,
        SUM(COALESCE(finalAmount, totalAmount, 0)) AS totalSpentAll,
        AVG(CASE WHEN status IN ('pending','paid','ready','delivered','completed') THEN COALESCE(finalAmount, totalAmount, 0) END) AS avgOrder,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelledCount,
        MAX(createdAt) AS lastOrderAt
      FROM "Order"
      WHERE merchantId = ?
        AND deliveryPhone = '${phone}'
    `, ADMIN_MERCHANT_ID)
    const stats = statsRes[0] || { orderCount: 0, validSpent: 0, totalSpentAll: 0, avgOrder: 0, cancelledCount: 0, lastOrderAt: null }

    const orderCount = Number(stats.orderCount) || 0
    const validSpent = Number(stats.validSpent) || 0
    const totalSpentAll = Number(stats.totalSpentAll) || 0
    const avgOrder = Number(stats.avgOrder) || 0
    const cancelledCount = Number(stats.cancelledCount) || 0
    const cancelledRate = orderCount > 0 ? cancelledCount / orderCount : 0

    // 3) 品类偏好
    const categoryRes = await prisma.$queryRawUnsafe<any[]>(`
      SELECT
        p.category AS category,
        SUM(oi.quantity * COALESCE(oi.subtotal, oi.price * oi.quantity, 0)) AS amount,
        COUNT(DISTINCT o.id) AS orderCount
      FROM "Order" o
      INNER JOIN OrderItem oi ON oi.orderId = o.id
      INNER JOIN Product p ON p.id = oi.productId
      WHERE o.merchantId = ?
        AND o.deliveryPhone = ?
        AND o.status IN ('pending','paid','ready','delivered','completed')
        AND p.category IS NOT NULL AND p.category != ''
      GROUP BY p.category
      ORDER BY amount DESC
    `, ADMIN_MERCHANT_ID, phone)
    const categoryPref = (categoryRes || []).map((c: any) => ({
      category: c.category,
      amount: Number(c.amount) || 0,
      orderCount: Number(c.orderCount) || 0,
      percent: totalSpentAll > 0 ? Math.round(((Number(c.amount) || 0) / totalSpentAll) * 1000) / 10 : 0,
    }))

    // 4) 时段偏好
    const timeRes = await prisma.$queryRawUnsafe<any[]>(`
      SELECT
        CAST(strftime('%H', createdAt) AS INTEGER) AS hour,
        COUNT(*) AS count,
        SUM(COALESCE(finalAmount, totalAmount, 0)) AS amount
      FROM "Order"
      WHERE merchantId = ?
        AND deliveryPhone = '${phone}'
        AND status IN ('pending','paid','ready','delivered','completed')
      GROUP BY hour
      ORDER BY hour
    `, ADMIN_MERCHANT_ID)
    const hourBuckets = { morning: 0, noon: 0, evening: 0 }
    let totalOrdersCounted = 0
    for (const h of (timeRes || [])) {
      const hour = Number(h.hour)
      const count = Number(h.count) || 0
      totalOrdersCounted += count
      if (hour >= 5 && hour < 11) hourBuckets.morning += count
      else if (hour >= 11 && hour < 17) hourBuckets.noon += count
      else hourBuckets.evening += count
    }
    const timePref = [
      { period: 'morning', label: '早 (5-11点)', count: hourBuckets.morning, percent: totalOrdersCounted > 0 ? Math.round((hourBuckets.morning / totalOrdersCounted) * 1000) / 10 : 0 },
      { period: 'noon', label: '午 (11-17点)', count: hourBuckets.noon, percent: totalOrdersCounted > 0 ? Math.round((hourBuckets.noon / totalOrdersCounted) * 1000) / 10 : 0 },
      { period: 'evening', label: '晚 (17-23点)', count: hourBuckets.evening, percent: totalOrdersCounted > 0 ? Math.round((hourBuckets.evening / totalOrdersCounted) * 1000) / 10 : 0 },
    ]

    // 5) 画像标签生成(纯数据驱动)
    const tags: Array<{ text: string; color: string; emoji: string; type: string }> = []

    if (validSpent >= 5000) tags.push({ text: '高价值客户', color: '#b8860b', emoji: '👑', type: 'value' })
    else if (validSpent >= 2000) tags.push({ text: '中价值客户', color: '#a8e6b8', emoji: '💎', type: 'value' })
    else if (validSpent >= 500) tags.push({ text: '常客', color: '#b8860b', emoji: '🥉', type: 'value' })
    else if (orderCount > 0) tags.push({ text: '新客', color: '#60a5fa', emoji: '🌱', type: 'value' })

    if (orderCount >= 10) tags.push({ text: '老顾客', color: '#b8860b', emoji: '⭐', type: 'frequency' })
    else if (orderCount >= 5) tags.push({ text: '回头客', color: '#b8860b', emoji: '🔁', type: 'frequency' })
    else if (orderCount >= 1) tags.push({ text: '新顾客', color: '#60a5fa', emoji: '✨', type: 'frequency' })

    if (avgOrder >= 200) tags.push({ text: '大单用户', color: '#f97316', emoji: '💰', type: 'basket' })
    else if (avgOrder >= 100) tags.push({ text: '中客单', color: '#b8860b', emoji: '🛒', type: 'basket' })
    else if (avgOrder > 0 && avgOrder < 50) tags.push({ text: '小单用户', color: '#94a3b8', emoji: '🌾', type: 'basket' })

    if (categoryPref.length > 0 && totalSpentAll > 0) {
      const top = categoryPref[0]
      if (top.percent >= 60) {
        const map: Record<string, string> = {
          'F001': '水果爱好者', 'F002': '蔬菜爱好者', 'F003': '粮油用户'
        }
        tags.push({
          text: map[top.category] || '偏好 ' + top.category,
          color: '#b8860b',
          emoji: top.category === 'F001' ? '🍎' : top.category === 'F002' ? '🥬' : '🌾',
          type: 'category'
        })
      }
    }

    if (totalOrdersCounted > 0) {
      const sortedTime = [...timePref].sort(function(a: any, b: any) { return b.count - a.count; })
      const topTime = sortedTime[0]
      if (topTime.count > 0 && topTime.percent >= 50) {
        const map: Record<string, { text: string; emoji: string }> = {
          morning: { text: '早晨活跃', emoji: '🌅' },
          noon: { text: '午间活跃', emoji: '☀️' },
          evening: { text: '傍晚活跃', emoji: '🌇' },
        }
        tags.push({
          text: map[topTime.period].text,
          color: '#b8860b',
          emoji: map[topTime.period].emoji,
          type: 'time'
        })
      }
    }

    if (cancelledRate >= 0.5 && orderCount >= 2) {
      tags.push({ text: '易取消', color: '#ff6b6b', emoji: '⚠️', type: 'risk' })
    }

    // 6) 近期订单(最近 5 单)
    const recentOrdersRes = await prisma.$queryRawUnsafe<any[]>(`
      SELECT o.orderNo, o.totalAmount, o.finalAmount, o.status, o.createdAt,
             (SELECT COUNT(*) FROM OrderItem oi WHERE oi.orderId = o.id) AS itemCount
      FROM "Order" o
      WHERE o.merchantId = ?
        AND o.deliveryPhone = ?
      ORDER BY o.createdAt DESC
      LIMIT 5
    `, ADMIN_MERCHANT_ID, phone)
    const recentOrders = (recentOrdersRes || []).map((o: any) => ({
      orderNo: o.orderNo,
      totalAmount: Number(o.totalAmount) || 0,
      finalAmount: Number(o.finalAmount) || 0,
      status: o.status,
      createdAt: o.createdAt,
      itemCount: Number(o.itemCount) || 0,
    }))

    return successResponse({
      profile: {
        phone,
        nickname: customer?.nickname || null,
        points: Number(customer?.points) || 0,
        tier: customer?.totalSpent >= 5000 ? 'VIP'
            : customer?.totalSpent >= 2000 ? '金卡'
            : customer?.totalSpent >= 500 ? '银卡' : '普通',
        totalOrders: orderCount,
        validSpent: Math.round(validSpent * 100) / 100,
        totalSpentAll: Math.round(totalSpentAll * 100) / 100,
        avgOrder: Math.round(avgOrder * 100) / 100,
        cancelledCount,
        cancelledRate: Math.round(cancelledRate * 1000) / 10,
        lastOrderAt: customer?.lastOrderAt || stats.lastOrderAt,
        tags,
        categoryPreference: categoryPref,
        timePreference: timePref,
        recentOrders,
      },
    })
  } catch (e: any) {
    if (e instanceof AuthError) {
      return errorResponse(e.message, 401)
    }
    return errorResponse(e.message, 500)
  }
}

// AuthError 已通过 import { AuthError } from "@/lib/error" 引入(不再重复定义)
