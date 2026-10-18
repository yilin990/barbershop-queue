/**
 * AI 卡片生成器（2026-06-30 20:53 奕霖需求）
 *
 * 核心：让 AI 不只是"说"，还能"展示"
 * - 订单卡片：可点跳转订单详情，带取货码
 * - 商品卡片：可加入购物车
 * - 预约卡片：可确认/修改
 *
 * 检测逻辑：
 * - 关键词匹配：取货码 / 我的订单 / 订单号 / 我买了 / 我预定了
 * - 数据库查询：基于 phone / orderNo
 * - 自动生成卡片数据
 */

import { prisma } from '@/lib/db'

const DEFAULT_MERCHANT_CODE = 'G0001'

// ---------------------------------------------------------------------------
// 意图检测
// ---------------------------------------------------------------------------
const ORDER_INTENT_KEYWORDS = [
  '取货码', '取件码', '提货码',
  '我的订单', '我买了', '我买过', '我订的', '我定的',
  '订单号', '订单状态', '订单详情',
  '我的预约', '我预约的', '我预定的',
  '帮我查订单', '看看订单', '订单查询',
]

export function detectOrderIntent(message: string): boolean {
  const lower = message.toLowerCase()
  return ORDER_INTENT_KEYWORDS.some(kw => lower.includes(kw))
}

// 从消息里提取订单号（ORD 开头）
export function extractOrderNo(message: string): string | null {
  const match = message.match(/ORD\d+/i)
  return match ? match[0].toUpperCase() : null
}

// ---------------------------------------------------------------------------
// 状态映射
// ---------------------------------------------------------------------------
const STATUS_LABELS: Record<string, string> = {
  pending: '待付款',
  paid: '已付款',
  preparing: '备货中',
  ready: '可取货',
  delivered: '已取货',
  cancelled: '已取消',
  refunded: '已退款',
  completed: '已完成',
}

// ---------------------------------------------------------------------------
// 查订单 + 生成卡片
// ---------------------------------------------------------------------------
export interface OrderCardData {
  type: 'order'
  orderId: string
  orderNo: string
  status: string
  statusLabel: string
  pickupCode?: string
  pickupExpiresAt?: string
  finalAmount: number
  itemCount: number
  itemSummary: string
  createdAt: string
}

export async function generateOrderCards(params: {
  phone?: string
  orderNo?: string
  limit?: number
  status?: string
}): Promise<OrderCardData[]> {
  const { phone, orderNo, limit = 5, status } = params

  let rows: any[] = []
  try {
    if (orderNo) {
      // 指定订单号查询（2026-07-14 安全补：phone 必须匹配）
      if (phone) {
        rows = await prisma.$queryRaw<any[]>`
          SELECT o.id, o.orderNo, o.status, o.pickupCode, o.pickupExpiresAt,
                 o.finalAmount, o.createdAt
          FROM "Order" o
          JOIN Merchant m ON o.merchantId = m.id
          LEFT JOIN Customer c ON o.customerId = c.id
          WHERE m.code = ${DEFAULT_MERCHANT_CODE} AND o.orderNo = ${orderNo} AND c.phone = ${phone}
          LIMIT 1
        `
      } else {
        // 仅 orderNo 不提供 phone — 不安全路径，拒绝
        return []
      }
    } else if (phone) {
      // 按手机号查最近订单（可选 status 过滤）
      if (status) {
        rows = await prisma.$queryRaw<any[]>`
          SELECT o.id, o.orderNo, o.status, o.pickupCode, o.pickupExpiresAt,
                 o.finalAmount, o.createdAt
          FROM "Order" o
          JOIN Merchant m ON o.merchantId = m.id
          LEFT JOIN Customer c ON o.customerId = c.id
          WHERE m.code = ${DEFAULT_MERCHANT_CODE} AND c.phone = ${phone} AND o.status = ${status}
          ORDER BY o.createdAt DESC
          LIMIT ${limit}
        `
      } else {
        rows = await prisma.$queryRaw<any[]>`
          SELECT o.id, o.orderNo, o.status, o.pickupCode, o.pickupExpiresAt,
                 o.finalAmount, o.createdAt
          FROM "Order" o
          JOIN Merchant m ON o.merchantId = m.id
          LEFT JOIN Customer c ON o.customerId = c.id
          WHERE m.code = ${DEFAULT_MERCHANT_CODE} AND c.phone = ${phone}
          ORDER BY o.createdAt DESC
          LIMIT ${limit}
        `
      }
    }
  } catch (err: any) {
    console.error('[ai-cards] query error:', err?.message)
    return []
  }

  if (rows.length === 0) return []

  // 查每个订单的商品
  const orderIds = rows.map((r: any) => r.id)
  let itemsRaw: any[] = []
  try {
    itemsRaw = orderIds.length > 0
      ? await prisma.$queryRawUnsafe<any[]>(
          `SELECT orderId, productName, quantity FROM OrderItem WHERE orderId IN (${orderIds.map(() => '?').join(',')})`,
          ...orderIds
        )
      : []
  } catch (err: any) {
    console.error('[ai-cards] items query error:', err?.message)
  }

  // 按订单聚合
  const itemsByOrder = new Map<string, Array<{ name: string; quantity: number }>>()
  for (const it of itemsRaw) {
    if (!itemsByOrder.has(it.orderId)) itemsByOrder.set(it.orderId, [])
    itemsByOrder.get(it.orderId)!.push({ name: it.productName, quantity: it.quantity })
  }

  return rows.map((r: any) => {
    const items = itemsByOrder.get(r.id) || []
    const itemCount = items.reduce((sum, it) => sum + it.quantity, 0)
    const itemSummary = items.length === 0
      ? '（无商品信息）'
      : items.length === 1
        ? `${items[0].name} × ${items[0].quantity}`
        : `${items[0].name} 等 ${items.length} 件商品`

    return {
      type: 'order' as const,
      orderId: r.id,
      orderNo: r.orderNo,
      status: r.status,
      statusLabel: STATUS_LABELS[r.status] || r.status,
      pickupCode: r.pickupCode || undefined,
      pickupExpiresAt: r.pickupExpiresAt || undefined,
      finalAmount: r.finalAmount,
      itemCount,
      itemSummary,
      createdAt: r.createdAt,
    }
  })
}

// ---------------------------------------------------------------------------
// 组合入口
// ---------------------------------------------------------------------------
export async function maybeGenerateOrderCards(message: string, phone?: string): Promise<OrderCardData[]> {
  if (!detectOrderIntent(message)) return []

  const orderNo = extractOrderNo(message)
  return generateOrderCards({ phone, orderNo: orderNo || undefined, limit: orderNo ? 1 : 5 })
}
