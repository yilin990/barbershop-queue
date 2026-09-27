/**
 * domain/inventory/restock.ts
 *
 * 自动补货引擎（P0 #7.5，含供应商 + 毛利率）
 *
 * 业务：
 * - getRestockSuggestions({limit=20}) 一锅端：30d 销量 SQL + 内层 calc + sort + summary
 * - calcRestockForRow(row)   单条补货建议（纯净函数，可单元测试）
 * - cnMidnightWindow()       cn 时区 30 天前到今日凌晨的 ISO 范围（与 today API 一致）
 *
 * 复用：所有商家后台的"自动补货建议"模块
 */

import { prisma } from '@/lib/db'

// =============== 共享时区工具 ===============

export interface CnDayWindow {
  cnMidnight: Date
  cnMidnightIso: string
  thirtyDaysAgoIso: string
}

/**
 * 中国时区今日 00:00 + 30 天前 00:00 两个 ISO 字符串
 * 供 dashboard/today 与 inventory/restock 共用
 */
export function cnMidnightWindow(now: Date = new Date()): CnDayWindow {
  const cnMidnight = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }))
  cnMidnight.setHours(0, 0, 0, 0)
  const cnMidnightIso = cnMidnight.toISOString()
  const thirtyDaysAgoIso = new Date(cnMidnight.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  return { cnMidnight, cnMidnightIso, thirtyDaysAgoIso }
}

// =============== 单条补货建议 ===============

export type RestockUrgency = 'critical_0' | 'critical_5' | 'restock' | 'warning' | 'normal'

export interface RestockSuggestion {
  productId: string
  productCode: string
  name: string
  shortName: string | null
  spec: string | null
  price: number
  stock: number
  sold30d: number
  dailyVelocity: number
  daysLeft: number | null
  suggestedRestock: number
  urgency: RestockUrgency
  // ⭐ P0 #7.5 进货信息
  costPrice: number
  supplierName: string | null
  supplierPhone: string | null
  supplierContact: string | null
  supplierNote: string | null
  marginRate: number | null
}

interface RawRestockRow {
  productId: string
  productCode: string
  name: string
  shortName: string | null
  spec: string | null
  price: number
  stock: number
  sold30d: number
  costPrice: number
  supplierName: string | null
  supplierPhone: string | null
  supplierContact: string | null
  supplierNote: string | null
}

/**
 * 重点：urgency 排序与 today/dashboard 略不同
 * restock-suggestions: critical_5 (1) > restock (2)
 * dashboard/today:     restock (1) > critical_5 (3)
 *
 * 保持各自语义，无统一。
 */
const RESTOCK_URGENCY_ORDER: Record<RestockUrgency, number> = {
  critical_0: 0,
  critical_5: 1,
  restock: 2,
  warning: 3,
  normal: 4,
}

export function calcRestockForRow(r: RawRestockRow): RestockSuggestion {
  const sold30d = Number(r.sold30d) || 0
  const stock = Number(r.stock) || 0
  const price = Number(r.price) || 0
  const costPrice = Number(r.costPrice) || 0
  const dailyVelocity = sold30d / 30
  const daysLeft = dailyVelocity > 0 ? Math.floor(stock / dailyVelocity) : null

  let suggestedRestock = 0
  let urgency: RestockUrgency = 'normal'
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

  // ⭐ P0 #7.5 毛利率（售价 - 进货价）/ 售价；null = 无进货价
  let marginRate: number | null = null
  if (costPrice > 0 && price > 0) {
    marginRate = Math.round(((price - costPrice) / price) * 1000) / 10
  }

  return {
    productId: r.productId,
    productCode: r.productCode,
    name: r.name,
    shortName: r.shortName,
    spec: r.spec,
    price,
    stock,
    sold30d,
    dailyVelocity: Math.round(dailyVelocity * 100) / 100,
    daysLeft,
    suggestedRestock,
    urgency,
    costPrice,
    supplierName: r.supplierName,
    supplierPhone: r.supplierPhone,
    supplierContact: r.supplierContact,
    supplierNote: r.supplierNote,
    marginRate,
  }
}

// =============== Summary ===============

export interface RestockSummary {
  urgentRestock: number
  totalRestockValue: number
  totalRestockCost: number
  avgDailyVelocity: number
  withSupplier: number
}

export function buildSummary(top: RestockSuggestion[]): RestockSummary {
  return {
    urgentRestock: top.filter((s) => s.suggestedRestock >= 10 && s.urgency !== 'normal').length,
    totalRestockValue: top
      .filter((s) => s.suggestedRestock > 0)
      .reduce((acc, s) => acc + s.suggestedRestock * s.price, 0),
    totalRestockCost: top
      .filter((s) => s.suggestedRestock > 0 && s.costPrice > 0)
      .reduce((acc, s) => acc + s.suggestedRestock * s.costPrice, 0),
    avgDailyVelocity: top.length > 0
      ? Math.round((top.reduce((acc, s) => acc + s.dailyVelocity, 0) / top.length) * 100) / 100
      : 0,
    withSupplier: top.filter((s) => !!s.supplierName).length,
  }
}

// =============== 一锅端入口 ===============

export interface RestockResult {
  windowDays: number
  summary: RestockSummary
  suggestions: RestockSuggestion[]
}

/**
 * 一锅端：30d SQL + sort + top-N + summary
 * @param limit 默认 20（前端首屏）；可调
 * @param allForSummary 返 summary 是否用全量（默认 true = 用整个 sold30d>0 集合）
 */
export async function getRestockSuggestions(opts: { limit?: number; allForSummary?: boolean } = {}): Promise<RestockResult> {
  const limit = opts.limit ?? 20
  const allForSummary = opts.allForSummary ?? true

  const { thirtyDaysAgoIso } = cnMidnightWindow()

  const rows = await prisma.$queryRawUnsafe<RawRestockRow[]>(
    `SELECT
       p.id AS productId,
       p.productCode,
       p.name,
       p.shortName,
       p.spec,
       p.price,
       p.stock,
       COALESCE(SUM(CASE WHEN oi.id IS NOT NULL THEN oi.quantity ELSE 0 END), 0) AS sold30d,
       p.costPrice,
       p.supplierName,
       p.supplierPhone,
       p.supplierContact,
       p.supplierNote
     FROM Product p
     LEFT JOIN OrderItem oi ON oi.productId = p.id
     LEFT JOIN "Order" o ON o.id = oi.orderId
      AND o.status NOT IN ('cancelled', 'refunded')
      AND o.createdAt >= ?
     WHERE p.status = 'active'
     GROUP BY p.id, p.productCode, p.name, p.shortName, p.spec, p.price, p.stock,
              p.costPrice, p.supplierName, p.supplierPhone, p.supplierContact, p.supplierNote
     HAVING COALESCE(SUM(CASE WHEN oi.id IS NOT NULL THEN oi.quantity ELSE 0 END), 0) > 0
     ORDER BY sold30d DESC
     LIMIT 200`,
    thirtyDaysAgoIso,
  )

  const allSuggestions = rows.map(calcRestockForRow)
  allSuggestions.sort((a, b) => {
    const ua = RESTOCK_URGENCY_ORDER[a.urgency]
    const ub = RESTOCK_URGENCY_ORDER[b.urgency]
    if (ua !== ub) return ua - ub
    if (a.daysLeft === null) return 1
    if (b.daysLeft === null) return -1
    return a.daysLeft - b.daysLeft
  })

  const top = allSuggestions.slice(0, limit)
  const summarySource = allForSummary ? allSuggestions : top

  return {
    windowDays: 30,
    summary: buildSummary(summarySource),
    suggestions: top,
  }
}
