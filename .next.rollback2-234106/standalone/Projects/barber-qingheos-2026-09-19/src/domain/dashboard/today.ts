/**
 * domain/dashboard/today.ts
 *
 * 老板今日动作看板（lighthouse case 老板必看）
 *
 * P0 #5 紧急问诊 / 待核销 / 售罄 / 拼团 / 营收
 * P0 #7 补货建议（与 restock-suggestions 复用算法）
 *
 * 7 路 raw SQL 并发查 → restock 计算 → 排序
 *
 * 复用：所有想做"老板一屏看板"的商户（药房/超市/美业/餐饮）
 * 替换表名 + 状态枚举即可
 */

import { prisma } from '@/lib/db'

export interface RestockItem {
  id: string
  productCode: string
  name: string
  shortName: string | null
  price: number
  stock: number
  sold30d: number
  daysLeft: number | null
  suggestedRestock: number
  urgency: 'critical_0' | 'restock' | 'warning' | 'critical_5' | 'normal'
}

export interface TodayDashboard {
  emergencyChats: number
  pendingOrders: { count: number; amount: number }
  outOfStockTop5: { id: string; productCode: string; name: string; shortName: string | null; price: number }[]
  activeGroupBuys: number
  totalChats: number
  todayRevenue: number
  date: string
  restock: {
    urgent: number
    totalValue: number
    top5: RestockItem[]
  }
}

const URGENCY_ORDER = { critical_0: 0, restock: 1, warning: 2, critical_5: 3, normal: 4 } as const

/**
 * Safe number extraction: SQLite COUNT/SUM 可能返 BigInt 或 null
 */
function safeNum(v: any, key: 'count' | 'amount' = 'count'): number {
  const raw = v?.[key] ?? v?.amount ?? 0
  const n = Number(raw)
  return Number.isFinite(n) ? n : 0
}

/**
 * P0 #7 补货计算（纯函数，可单独单元测试）
 * 来自 restock-suggestions 算法，等价于 top-12 版本
 */
export function calcRestock(input: {
  sold30d: number
  stock: number
  price: number
}): RestockItem {
  const { sold30d, stock, price } = input
  const dailyVelocity = sold30d / 30
  const daysLeft = dailyVelocity > 0 ? Math.floor(stock / dailyVelocity) : null

  let suggestedRestock = 0
  let urgency: RestockItem['urgency'] = 'normal'
  if (stock === 0) urgency = 'critical_0'
  else if (stock < 5) urgency = 'critical_5'
  else if (stock < 20) urgency = 'warning'

  if (daysLeft !== null && daysLeft <= 7 && dailyVelocity >= 0.1) {
    suggestedRestock = Math.max(30 - stock, Math.ceil(dailyVelocity * 14))
    if (suggestedRestock < 10) suggestedRestock = 10
    urgency = 'restock'
  } else if (daysLeft !== null && daysLeft <= 14 && dailyVelocity >= 0.1) {
    suggestedRestock = Math.max(0, Math.ceil(dailyVelocity * 30 - stock))
    urgency = 'warning'
  }

  return {
    id: '',
    productCode: '',
    name: '',
    shortName: null,
    price,
    stock,
    sold30d,
    daysLeft,
    suggestedRestock,
    urgency,
  }
}

interface RawRestock {
  id: string
  productCode: string
  name: string
  shortName: string | null
  price: number
  stock: number
  sold30d: number
}

function buildRestockItem(r: RawRestock): RestockItem {
  const item = calcRestock({ sold30d: Number(r.sold30d) || 0, stock: Number(r.stock) || 0, price: Number(r.price) || 0 })
  return {
    ...item,
    id: r.id,
    productCode: r.productCode,
    name: r.name,
    shortName: r.shortName,
  }
}

/**
 * 取老板今日看板
 * - 7 路 SQL 并发
 * - 自动 cn 时区午夜分割（以中国时区为"今日"边界）
 */
export async function getTodayDashboard(): Promise<TodayDashboard> {
  const now = new Date()
  const cnMidnight = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }))
  cnMidnight.setHours(0, 0, 0, 0)
  const cnMidnightIso = cnMidnight.toISOString()
  const thirtyDaysAgoIso = new Date(cnMidnight.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [
    emergencyChatsRes,
    pendingOrdersRes,
    outOfStockTop5Res,
    activeGroupBuysRes,
    todayChatsRes,
    todayRevenueRes,
    restockTopRes,
  ] = await Promise.all([
    prisma.$queryRawUnsafe<{ count: number }[]>(
      `SELECT COUNT(*) as count FROM ChatLog WHERE isEmergency=1 AND createdAt >= ?`,
      cnMidnightIso,
    ),
    prisma.$queryRawUnsafe<{ count: number; amount: number }[]>(
      `SELECT COUNT(*) as count, COALESCE(SUM(totalAmount),0) as amount FROM "Order" WHERE status='pending'`,
    ),
    prisma.$queryRawUnsafe<{ id: string; productCode: string; name: string; shortName: string | null; price: number }[]>(
      `SELECT id, productCode, name, shortName, price FROM Product
       WHERE status='active' AND stock=0
       ORDER BY name ASC LIMIT 5`,
    ),
    prisma.$queryRawUnsafe<{ count: number }[]>(
      `SELECT COUNT(*) as count FROM GroupBuy WHERE status='active'`,
    ),
    prisma.$queryRawUnsafe<{ count: number }[]>(
      `SELECT COUNT(*) as count FROM ChatLog WHERE createdAt >= ?`,
      cnMidnightIso,
    ),
    prisma.$queryRawUnsafe<{ amount: number }[]>(
      `SELECT COALESCE(SUM(totalAmount),0) as amount FROM "Order"
       WHERE status IN ('completed','delivered','picked_up') AND createdAt >= ?`,
      cnMidnightIso,
    ),
    prisma.$queryRawUnsafe<RawRestock[]>(
      `SELECT
         p.id, p.productCode, p.name, p.shortName, p.price, p.stock,
         COALESCE(SUM(CASE WHEN oi.id IS NOT NULL THEN oi.quantity ELSE 0 END), 0) AS sold30d
       FROM Product p
       LEFT JOIN OrderItem oi ON oi.productId = p.id
       LEFT JOIN "Order" o ON o.id = oi.orderId
        AND o.status NOT IN ('cancelled','refunded')
        AND o.createdAt >= ?
       WHERE p.status='active'
       GROUP BY p.id, p.productCode, p.name, p.shortName, p.price, p.stock
       HAVING COALESCE(SUM(CASE WHEN oi.id IS NOT NULL THEN oi.quantity ELSE 0 END), 0) > 0
       ORDER BY sold30d DESC
       LIMIT 12`,
      thirtyDaysAgoIso,
    ),
  ])

  const restock = (restockTopRes || []).map(buildRestockItem)
  restock.sort((a, b) =>
    URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency] ||
    (a.daysLeft ?? 999) - (b.daysLeft ?? 999),
  )

  const restockUrgent = restock.filter((s) => s.urgency === 'restock' || s.urgency === 'critical_0').length
  const restockTotalValue = restock
    .filter((s) => s.suggestedRestock > 0)
    .reduce((acc, s) => acc + s.suggestedRestock * s.price, 0)

  return {
    emergencyChats: safeNum(emergencyChatsRes[0]),
    pendingOrders: {
      count: safeNum(pendingOrdersRes[0]),
      amount: safeNum(pendingOrdersRes[0], 'amount'),
    },
    outOfStockTop5: (outOfStockTop5Res || []).map((p) => ({
      id: p.id,
      productCode: p.productCode,
      name: p.name,
      shortName: p.shortName,
      price: Number(p.price) || 0,
    })),
    activeGroupBuys: safeNum(activeGroupBuysRes[0]),
    totalChats: safeNum(todayChatsRes[0]),
    todayRevenue: safeNum({ amount: todayRevenueRes[0]?.amount ?? 0 }, 'amount'),
    date: cnMidnight.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }).split(' ')[0],
    restock: {
      urgent: restockUrgent,
      totalValue: Math.round(restockTotalValue * 100) / 100,
      top5: restock.slice(0, 5),
    },
  }
}
