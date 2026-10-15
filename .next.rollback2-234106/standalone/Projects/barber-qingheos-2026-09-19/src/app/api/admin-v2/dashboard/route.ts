import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

/**
 * GET /api/admin-v2/dashboard
 * 商户后台 v2 仪表盘
 * 100% raw SQL（避免 prisma 7 schema validate bug 导致 model 不同步）
 */
export async function GET(request: NextRequest) {
  try {
    const now = new Date()
    const cnMidnight = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }))
    cnMidnight.setHours(0, 0, 0, 0)
    const cnMidnightIso = cnMidnight.toISOString()
    const yesterdayStart = new Date(cnMidnight.getTime() - 24 * 60 * 60 * 1000)
    const yesterdayEnd = cnMidnight
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    // 用 $queryRaw 跑真 SQL
    const [
      todayOrdersRes,
      todayRevenueRes,
      last7daysOrdersRes,
      yesterdayOrdersRes,
      yesterdayRevenueRes,
      memberCountRes,
      pendingRes,
      lowStockRes,
      stockTiersRes,
      outOfStockRes,
      recentLogsRes,
    ] = await Promise.all([
      prisma.$queryRaw<{ count: number }[]>`SELECT COUNT(*) as count FROM "Order" WHERE createdAt >= ${cnMidnightIso}`,
      prisma.$queryRaw<{ sum: number | null }[]>`SELECT SUM(totalAmount) as sum FROM "Order" WHERE status IN ('completed','delivered') AND createdAt >= ${cnMidnightIso}`,
      prisma.$queryRaw<{ createdAt: Date }[]>`SELECT createdAt FROM "Order" WHERE createdAt >= ${sevenDaysAgo.toISOString()}`,
      prisma.$queryRaw<{ count: number }[]>`SELECT COUNT(*) as count FROM "Order" WHERE createdAt >= ${yesterdayStart.toISOString()} AND createdAt < ${yesterdayEnd.toISOString()}`,
      prisma.$queryRaw<{ sum: number | null }[]>`SELECT SUM(totalAmount) as sum FROM "Order" WHERE status IN ('completed','delivered') AND createdAt >= ${yesterdayStart.toISOString()} AND createdAt < ${yesterdayEnd.toISOString()}`,
      prisma.$queryRaw<{ count: number }[]>`SELECT COUNT(*) as count FROM Customer`,
      prisma.$queryRaw<{ count: number }[]>`SELECT COUNT(*) as count FROM Feedback WHERE status='pending'`,
      prisma.$queryRaw<{ id: string; name: string; stock: number }[]>`SELECT id, name, stock FROM Product WHERE status='active' AND stock < 20 ORDER BY stock ASC LIMIT 10`,
      // ⭐ P0 #4 库存预警 4 档分级（奕霖 2026-07-20 16:48）：critical_0/slow_5/warning_20/normal
      prisma.$queryRaw<{ tier: string; cnt: number; total_stock: number | null }[]>`
        SELECT
          CASE
            WHEN stock = 0 THEN 'critical_0'
            WHEN stock < 5 THEN 'critical_5'
            WHEN stock < 20 THEN 'warning'
            ELSE 'normal'
          END AS tier,
          COUNT(*) AS cnt,
          SUM(stock) AS total_stock
        FROM Product
        WHERE status = 'active'
        GROUP BY tier
      `,
      prisma.$queryRaw<{ id: string; name: string; stock: number; price: number }[]>`SELECT id, name, stock, price FROM Product WHERE status='active' AND stock = 0 ORDER BY name ASC LIMIT 50`,
      prisma.$queryRaw<{ id: string; actorType: string; action: string; description: string; createdAt: Date }[]>`SELECT id, actorType, action, description, createdAt FROM AuditLog ORDER BY createdAt DESC LIMIT 10`,
    ])

    // ⭐ P0 #4 库存预警 4 档（critical_0=售罄 / critical_5=急 / warning=警戒 / normal=正常）
    const tierMap: Record<string, { count: number; total_stock: number }> = {
      critical_0: { count: 0, total_stock: 0 },
      critical_5: { count: 0, total_stock: 0 },
      warning: { count: 0, total_stock: 0 },
      normal: { count: 0, total_stock: 0 },
    }
    stockTiersRes.forEach((r) => {
      const tier = r.tier as keyof typeof tierMap
      if (tierMap[tier]) {
        tierMap[tier] = {
          count: Number(r.cnt) || 0,
          total_stock: Number(r.total_stock) || 0,
        }
      }
    })
    const stockAlert = {
      critical_0: tierMap.critical_0.count,
      critical_5: tierMap.critical_5.count,
      warning: tierMap.warning.count,
      normal: tierMap.normal.count,
      total: tierMap.critical_0.count + tierMap.critical_5.count + tierMap.warning.count + tierMap.normal.count,
      urgent_total: tierMap.critical_0.count + tierMap.critical_5.count,
      top_out_of_stock: outOfStockRes.slice(0, 10).map((p) => ({
        id: p.id, name: p.name, stock: p.stock, price: p.price,
      })),
    }

    // 7-sparkline（last7daysOrders 分配到 7 天）
    const days = Array.from({ length: 7 }, (_, i) => {
      const dayStart = new Date(cnMidnight.getTime() - (6 - i) * 24 * 60 * 60 * 1000)
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)
      return last7daysOrdersRes.filter((o) => new Date(o.createdAt) >= dayStart && new Date(o.createdAt) < dayEnd).length
    })

    const todayOrders = Number(todayOrdersRes[0]?.count || 0)
    const todayRevenue = Number(todayRevenueRes[0]?.sum || 0)
    const yestOrders = Number(yesterdayOrdersRes[0]?.count || 0)
    const yestRevenue = Number(yesterdayRevenueRes[0]?.sum || 0)
    const memberCount = Number(memberCountRes[0]?.count || 0)
    const pendingCount = Number(pendingRes[0]?.count || 0)

    const fmtTrend = (today: number, yest: number): string => {
      if (yest === 0) return today > 0 ? '+new' : '0%'
      const pct = Math.round(((today - yest) / yest) * 100)
      return pct >= 0 ? `+${pct}%` : `${pct}%`
    }
    const ordersTrend = fmtTrend(todayOrders, yestOrders)
    const revenueTrend = fmtTrend(todayRevenue, yestRevenue)

    // 待办（展开为可点动作）
    const todos: any[] = []

    // feedback: 拿前 3 条 pending 详情
    const pendingFeedbacksListRes = await prisma.$queryRaw<any[]>`
      SELECT f.id, f.type, f.content, f.createdAt, u.phone as userPhone
      FROM Feedback f LEFT JOIN User u ON f.userId = u.id
      WHERE f.status = 'pending'
      ORDER BY f.createdAt DESC LIMIT 3
    `
    pendingFeedbacksListRes.forEach((f) => {
      const typeLabel = { suggestion: '功能建议', complaint: '投诉', praise: '表扬', other: '其他' }[f.type as string] || f.type
      todos.push({
        id: f.id,
        type: 'feedback',
        title: (f.content || '').slice(0, 40) + ((f.content || '').length > 40 ? '…' : ''),
        meta: `${typeLabel} · ${f.userPhone ? f.userPhone.slice(-4) : '匿名'}`,
        action: '回复',
      })
    })

    // stock: 前 3 个低库存
    lowStockRes.slice(0, 3).forEach((p) => {
      todos.push({
        id: p.id,
        type: 'stock',
        title: `${p.name} 仅剩 ${p.stock}`,
        meta: `商品 #${p.id.slice(0, 6)}`,
        action: '补货',
      })
    })

    // content_reports: 表存在则取前 3 pending
    try {
      const reportsRes = await prisma.$queryRaw<any[]>`
        SELECT id, targetType, reason FROM ContentReport WHERE status = 'pending' LIMIT 3
      `
      reportsRes.forEach((r) => {
        todos.push({
          id: r.id,
          type: 'report',
          title: `举报：${r.targetType === 'story' ? '故事' : r.targetType === 'comment' ? '评论' : '内容'} 分类：${r.reason}`,
          meta: `#${r.id.slice(0, 6)}`,
          action: '审核',
        })
      })
    } catch { /* 表不存在，跳过 */ }

    // 时间线
    const timeline = recentLogsRes.map((l) => ({
      id: l.id,
      action: l.action,
      text: l.description,
      actor: l.actorType,
      time: new Date(l.createdAt).toISOString(),
      relative: formatRelative(new Date(l.createdAt)),
    }))

    return NextResponse.json({
      success: true,
      stats: {
        orders: { value: todayOrders, trend: ordersTrend, spark: days, label: '今日订单' },
        revenue: { value: todayRevenue, trend: revenueTrend, spark: days, label: '今日营收', prefix: '¥' },
        members: { value: memberCount, trend: '+' + Math.floor(memberCount / 5), spark: days, label: '活跃会员' },
        pending: { value: pendingCount, trend: '待处理', spark: [1, 1, 1, 2, 2, 2, pendingCount], label: '待办反馈', warn: true },
        // ⭐ P0 #4 库存预警 4 档 KPI（供 admin 首页 KPI 区展示）
        stockCritical0: { value: stockAlert.critical_0, trend: stockAlert.critical_0 > 0 ? '售罄' : '正常', spark: days, label: '售罄商品', warn: stockAlert.critical_0 > 0 },
        stockCritical5: { value: stockAlert.critical_5, trend: stockAlert.critical_5 > 0 ? '急' : '正常', spark: days, label: '库存<5', warn: stockAlert.critical_5 > 0 },
        stockWarning: { value: stockAlert.warning, trend: stockAlert.warning > 0 ? '需补货' : '正常', spark: days, label: '库存<20', warn: stockAlert.warning > 0 },
      },
      stockAlert,
      todos,
      timeline,
      meta: {
        timezone: 'Asia/Shanghai',
        date: cnMidnight.toLocaleDateString('zh-CN'),
        lastUpdate: now.toISOString(),
      },
    })
  } catch (error: any) {
    console.error('[admin-v2/dashboard]', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

function formatRelative(date: Date): string {
  const diff = Date.now() - date.getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return '刚刚'
  if (m < 60) return `${m} 分钟前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} 小时前`
  const d = Math.floor(h / 24)
  return `${d} 天前`
}
