/**
 * domain/member/service.ts
 *
 * 商家后台会员管理（lighthouse case 必用）
 *
 * 业务：
 * - getMemberDetail(id)    客户详情 + 最近 10 单 + 最近 20 audit log
 * - adjustPoints(id, ±N)   调整积分
 * - adjustSpent(id, ±N)    调整累计消费
 * - toggleStatus(id, 状态) 屏蔽/恢复
 * - rename(id, nickname)   改名
 * - getMemberProfile(id)   行为画像（RFM / CLV / 价格敏感度 / 时段 / 标签）
 *
 * 复用：所有商家后台"会员/客户档案"模块（药房/超市/美业）
 */

import { prisma } from '@/lib/db'
import { ADMIN_MERCHANT_ID } from '@/lib/admin-merchant'
import { ValidationError, NotFoundError } from '@/lib/error'

// =============== 常量配置（RFM + 价格 + CLV） ===============

export const RFM_LEVELS = {
  recency: ['新客户', '活跃', '近期', '沉默', '沉睡', '流失'] as const,
  clvMultiplier: { 新客户: 4, 活跃: 3, 近期: 2.5, 沉默: 1.5, 沉睡: 1, 流失: 0.5 } as Record<string, number>,
}

export const PRICE_SENSITIVITY_BANDS = [
  { max: 30, label: '💰 极致性价比' },
  { max: 80, label: '💵 性价比' },
  { max: 200, label: '😐 中等' },
  { max: 500, label: '💎 偏高端' },
  { max: Infinity, label: '👑 高端' },
] as const

// =============== Detail (含 orders + audit logs) ===============

export interface MemberOrder {
  id: string
  totalAmount: number
  status: string
  createdAt: string
  pickupCode: string | null
}

export interface MemberLog {
  id: string
  action: string
  description: string
  createdAt: any
}

export async function getMemberDetail(id: string): Promise<{
  customer: any
  orders: MemberOrder[]
  logs: MemberLog[]
}> {
  const customerRows: any[] = await prisma.$queryRaw`SELECT * FROM Customer WHERE id = ${id} AND merchantId = ${ADMIN_MERCHANT_ID}`
  const customer = customerRows[0]
  if (!customer) throw new NotFoundError('客户不存在')

  const orders: any[] = await prisma.$queryRaw`
    SELECT id, totalAmount, status, createdAt, pickupCode
    FROM "Order"
    WHERE customerId = ${id}
    ORDER BY createdAt DESC LIMIT 10`

  const logs: any[] = await prisma.$queryRaw`
    SELECT id, action, description, createdAt
    FROM AuditLog
    WHERE target = ${id}
    ORDER BY createdAt DESC LIMIT 20`

  return {
    customer,
    orders: orders.map((o: any) => ({
      ...o,
      createdAt: o.createdAt?.toISOString?.() || o.createdAt,
    })),
    logs,
  }
}

// =============== Mutations（均带 audit log） ===============

function genAuditId(): string {
  return `al_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
}

async function writeAudit(actorId: string, action: string, target: string, desc: string): Promise<void> {
  const id = genAuditId()
  await prisma.$executeRaw`
    INSERT INTO AuditLog (id, actorType, actorId, action, target, description, createdAt)
    VALUES (${id}, 'admin', ${actorId}, ${action}, ${target}, ${desc}, CURRENT_TIMESTAMP)`
}

async function findCustomerOrThrow(id: string): Promise<any> {
  const rows: any[] = await prisma.$queryRaw`SELECT * FROM Customer WHERE id = ${id} AND merchantId = ${ADMIN_MERCHANT_ID}`
  const customer = rows[0]
  if (!customer) throw new NotFoundError('客户不存在')
  return customer
}

export interface AdjustResult {
  success: true
  action: string
  desc: string
  newData?: Record<string, any>
}

/**
 * 4 种操作合一入口
 *   action = 'adjust_points' | 'adjust_spent' | 'toggle_status' | 'rename'
 */
export async function modifyMember(
  id: string,
  action: string,
  body: { delta?: number; status?: string; nickname?: string },
): Promise<AdjustResult> {
  const customer = await findCustomerOrThrow(id)

  switch (action) {
    case 'adjust_points': {
      const delta = Number(body.delta || 0)
      if (!Number.isFinite(delta) || delta === 0) {
        throw new ValidationError('delta 必须是非零数字')
      }
      const newPoints = Math.max(0, customer.points + delta)
      await prisma.customer.update({ where: { id }, data: { points: newPoints } })
      const desc = `积分 ${delta > 0 ? '+' : ''}${delta}（${customer.points} → ${newPoints}）`
      await writeAudit(id, action, id, desc)
      return { success: true, action, desc, newData: { points: newPoints } }
    }

    case 'adjust_spent': {
      const delta = Number(body.delta || 0)
      if (!Number.isFinite(delta) || delta === 0) {
        throw new ValidationError('delta 必须是非零数字')
      }
      const newSpent = Math.max(0, customer.totalSpent + delta)
      await prisma.customer.update({ where: { id }, data: { totalSpent: newSpent } })
      const desc = `累计消费 ${delta > 0 ? '+' : ''}¥${delta}（¥${customer.totalSpent} → ¥${newSpent}）`
      await writeAudit(id, action, id, desc)
      return { success: true, action, desc, newData: { totalSpent: newSpent } }
    }

    case 'toggle_status': {
      const newStatus = body.status as string
      if (!['active', 'deactivated'].includes(newStatus)) {
        throw new ValidationError('status 必须是 active|deactivated')
      }
      // raw SQL 绕过 Prisma client（schema 缺字段 validate 失败）
      if (newStatus === 'deactivated') {
        await prisma.$executeRaw`
          UPDATE Customer SET status = 'deactivated', deactivatedAt = CURRENT_TIMESTAMP, deactivationReason = 'admin_action'
          WHERE id = ${id}`
      } else {
        await prisma.$executeRaw`
          UPDATE Customer SET status = 'active', deactivatedAt = NULL, deactivationReason = NULL
          WHERE id = ${id}`
      }
      const desc = `${customer.status === 'active' || !customer.status ? '屏蔽' : '恢复'}客户（${customer.phone || id}）`
      await writeAudit(id, action, id, desc)
      return { success: true, action, desc }
    }

    case 'rename': {
      const nickname = String(body.nickname || '').trim().slice(0, 20)
      if (!nickname) {
        throw new ValidationError('昵称不能为空')
      }
      await prisma.customer.update({ where: { id }, data: { nickname } })
      const desc = `改名「${customer.nickname || '-'}」→「${nickname}」`
      await writeAudit(id, action, id, desc)
      return { success: true, action, desc, newData: { nickname } }
    }

    default:
      throw new ValidationError(`未知 action: ${action}`)
  }
}

// =============== Behavior Profile（RFM + CLV + 标签） ===============

export interface MemberProfile {
  rfm: {
    R: string
    F: string
    M: string
    daysSinceLast: number | null
    orderCount: number
    totalSpent: number
  }
  clv: number
  avgOrderAmount: number
  avgProductPrice: number
  priceSensitivity: string
  topCategories: { name: string; count: number; share: string }[]
  hourlyHistogram: number[]
  monthlyTrend: { month: string; count: number; amount: number }[]
  behaviorTags: string[]
  recentOrders: {
    id: string
    totalAmount: number
    status: string
    createdAt: string
    pickupCode: string | null
    productCount: number
  }[]
}

function rLevel(daysSinceLast: number): string {
  if (daysSinceLast <= 7) return '活跃'
  if (daysSinceLast <= 30) return '近期'
  if (daysSinceLast <= 90) return '沉默'
  if (daysSinceLast <= 180) return '沉睡'
  return '流失'
}

function fLevel(orderCount: number): string {
  if (orderCount >= 20) return 'F5 高频'
  if (orderCount >= 10) return 'F4 频繁'
  if (orderCount >= 5) return 'F3 稳定'
  if (orderCount >= 3) return 'F2 偶尔'
  if (orderCount >= 1) return 'F1 尝鲜'
  return 'F0'
}

function mLevel(totalSpent: number): string {
  if (totalSpent >= 5000) return 'M5 高价值'
  if (totalSpent >= 2000) return 'M4 大客户'
  if (totalSpent >= 1000) return 'M3 中等'
  if (totalSpent >= 500) return 'M2 入门'
  if (totalSpent >= 100) return 'M1 起步'
  return 'M0'
}

function priceSensitivityLabel(avg: number): string {
  for (const band of PRICE_SENSITIVITY_BANDS) {
    if (avg < band.max) return band.label
  }
  return '未知'
}

export async function getMemberProfile(id: string): Promise<{ customer: any; profile: MemberProfile }> {
  const customerRows: any[] = await prisma.$queryRaw`SELECT * FROM Customer WHERE id = ${id}`
  const customer = customerRows[0]
  if (!customer) throw new NotFoundError('客户不存在')

  const orders: any[] = await prisma.$queryRaw`
    SELECT o.id, o.totalAmount, o.finalAmount, o.status, o.createdAt, o.pickupCode,
           GROUP_CONCAT(oi.productName, ' | ') AS productNames,
           GROUP_CONCAT(COALESCE(p.categoryLabel, p.category, ''), ' | ') AS categories
    FROM "Order" o
    LEFT JOIN OrderItem oi ON oi.orderId = o.id
    LEFT JOIN Product p ON p.id = oi.productId
    WHERE o.customerId = ${id}
    GROUP BY o.id
    ORDER BY o.createdAt DESC`

  if (orders.length === 0) {
    return {
      customer,
      profile: {
        rfm: { R: '新客户', F: 'F0', M: 'M0', daysSinceLast: null, orderCount: 0, totalSpent: 0 },
        clv: 0,
        avgOrderAmount: 0,
        avgProductPrice: 0,
        priceSensitivity: '未知',
        topCategories: [],
        hourlyHistogram: Array(24).fill(0),
        monthlyTrend: [],
        behaviorTags: ['🌱 新客户 · 无历史订单'],
        recentOrders: [],
      },
    }
  }

  const lastOrder = orders[0]
  const lastOrderTime = new Date(lastOrder.createdAt)
  const daysSinceLast = Math.floor((Date.now() - lastOrderTime.getTime()) / (1000 * 60 * 60 * 24))

  const orderCount = orders.length
  const totalSpent = Number(customer.totalSpent) || 0
  const avgOrderAmount = totalSpent / orderCount

  let itemCount = 0
  for (const o of orders) {
    if (o.productNames) itemCount += String(o.productNames).split(' | ').length
  }
  const avgProductPrice = itemCount > 0 ? totalSpent / itemCount : 0

  // Top 复购品类
  const catCount: Record<string, number> = {}
  for (const o of orders) {
    if (o.categories) {
      for (const c of String(o.categories).split(' | ')) {
        if (c && c !== '-') catCount[c] = (catCount[c] || 0) + 1
      }
    }
  }
  const topCategories = Object.entries(catCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, cnt]) => ({ name, count: cnt, share: ((cnt / itemCount) * 100).toFixed(1) }))

  // 24h histogram
  const hourlyHistogram = Array(24).fill(0)
  for (const o of orders) {
    const h = new Date(o.createdAt).getHours()
    hourlyHistogram[h]++
  }

  // 行为标签（自动从订单推导）
  const tags: string[] = []
  for (const [cat, cnt] of Object.entries(catCount)) {
    if (cnt >= 5) tags.push(`🔁 ${cat} 复购客户 (${cnt} 次)`)
    else if (cnt >= 3) tags.push(`🔁 ${cat} 复购 (${cnt} 次)`)
  }
  if (orderCount >= 10) tags.push(`⚡ 高频客户 (${orderCount} 单)`)
  if (totalSpent >= 2000) tags.push(`💎 VIP 客户 (¥${totalSpent.toFixed(0)})`)
  else if (totalSpent >= 500) tags.push(`💰 大客户 (¥${totalSpent.toFixed(0)})`)
  if (daysSinceLast >= 90) tags.push(`💤 流失风险 (${daysSinceLast} 天未下单)`)
  else if (daysSinceLast >= 30) tags.push(`😶 沉默客户 (${daysSinceLast} 天未下单)`)

  if (orderCount >= 3) {
    const peakHour = hourlyHistogram.indexOf(Math.max(...hourlyHistogram))
    if (peakHour >= 21 || peakHour <= 5) tags.push(`🌙 夜猫子 (主要在 ${peakHour}:00 下单)`)
    else if (peakHour >= 6 && peakHour <= 11) tags.push(`🌅 早起型 (主要在 ${peakHour}:00 下单)`)
    else if (peakHour >= 12 && peakHour <= 14) tags.push(`🍱 午间型 (主要在 ${peakHour}:00 下单)`)
    else tags.push(`🌆 傍晚型 (主要在 ${peakHour}:00 下单)`)
  }

  const orderAmounts = orders.map((o) => Number(o.finalAmount || o.totalAmount))
  const stdDev = orderAmounts.length > 1
    ? Math.sqrt(orderAmounts.reduce((s, v) => s + Math.pow(v - avgOrderAmount, 2), 0) / orderAmounts.length)
    : 0
  const cv = avgOrderAmount > 0 ? (stdDev / avgOrderAmount) : 0
  if (cv < 0.3 && orderCount >= 3) tags.push(`📊 消费稳定 (CV=${cv.toFixed(2)})`)
  else if (cv > 1 && orderCount >= 3) tags.push(`📈 消费波动大 (CV=${cv.toFixed(2)})`)

  if (customer.status === 'deactivated') tags.push(`🚫 已屏蔽`)

  // 月度趋势（最近 6 个月）
  const monthlyTrend: MemberProfile['monthlyTrend'] = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
    const monthOrders = orders.filter((o) => {
      const t = new Date(o.createdAt)
      return t >= d && t < monthEnd
    })
    monthlyTrend.push({
      month: monthKey,
      count: monthOrders.length,
      amount: monthOrders.reduce((s, o) => s + Number(o.finalAmount || o.totalAmount || 0), 0),
    })
  }

  const rfmR = rLevel(daysSinceLast)
  const clv = totalSpent * (RFM_LEVELS.clvMultiplier[rfmR] || 1)

  return {
    customer,
    profile: {
      rfm: {
        R: rfmR,
        F: fLevel(orderCount),
        M: mLevel(totalSpent),
        daysSinceLast,
        orderCount,
        totalSpent,
      },
      clv: Math.round(clv),
      avgOrderAmount: Number(avgOrderAmount.toFixed(2)),
      avgProductPrice: Number(avgProductPrice.toFixed(2)),
      priceSensitivity: priceSensitivityLabel(avgOrderAmount),
      topCategories,
      hourlyHistogram,
      monthlyTrend,
      behaviorTags: tags.length > 0 ? tags : ['🌱 新客户'],
      recentOrders: orders.slice(0, 10).map((o) => ({
        id: o.id,
        totalAmount: Number(o.finalAmount || o.totalAmount || 0),
        status: o.status,
        createdAt: new Date(o.createdAt).toISOString(),
        pickupCode: o.pickupCode,
        productCount: o.productNames ? String(o.productNames).split(' | ').length : 0,
      })),
    },
  }
}
