/**
 * AI 数据上下文服务（2026-06-30 by 清禾）
 *
 * 核心壁垒：让 AI 不只是"通用知识"，而是"这个药房、这个会员的私人顾问"
 *
 * 上下文维度：
 *   1. 库存上下文 - "X 有货/无货"（实时）
 *   2. 会员上下文 - "您是 VIP，过敏史 X"（基于 phone）
 *   3. 历史订单 - "您上次买过 Y"
 *   4. 活动上下文 - "本周 X 8 折"
 *   5. 药品禁忌 - 严格过滤（过敏/慢性病/孕期/儿童）
 *
 * 设计原则：
 *   - 上下文注入不破坏主 system prompt
 *   - 按需查询（不每次查全部）
 *   - 敏感数据脱敏（不直接给 AI 真实手机号）
 */

import { prisma } from '@/lib/db'

const DEFAULT_MERCHANT_CODE = 'G0001'

export interface MemberContext {
  isMember: boolean
  name?: string
  role?: string // 'bronze' | 'silver' | 'gold' | 'vip'
  totalSpent?: number
  points?: number
  allergies?: string[]
  recentOrders?: Array<{
    orderNo: string
    totalAmount: number
    items: string[] // 商品名列表
    createdAt: string
  }>
  chronicDiseases?: string[]
}

export interface InventoryContext {
  productName: string
  available: boolean
  quantity: number
  price: number
  memberPrice?: number
  productCode?: string
  spec?: string
}

export interface PromotionContext {
  title: string
  type: string
  description: string
  endAt: string
}

/**
 * 查询会员上下文
 */
export async function getMemberContext(phone?: string): Promise<MemberContext> {
  if (!phone) return { isMember: false }

  try {
    // 找 Customer
    const customers = await prisma.$queryRaw<any[]>`
      SELECT c.id, c.nickname, c.totalSpent, c.points, c.allergies, c.chronicDiseases
      FROM Customer c
      JOIN Merchant m ON c.merchantId = m.id
      WHERE c.phone = ${phone} AND m.code = ${DEFAULT_MERCHANT_CODE}
      LIMIT 1
    `

    if (customers.length === 0) {
      return { isMember: false }
    }

    const customer = customers[0]
    const customerId = customer.id

    // 算会员等级（用 tier.ts 的逻辑）
    const { computeRole } = await import('@/domain/membership/tier')
    const role = computeRole(customer.totalSpent || 0)

    // 查最近 5 个订单
    const orders = await prisma.$queryRaw<any[]>`
      SELECT id, orderNo, totalAmount, createdAt FROM "Order"
      WHERE customerId = ${customerId}
      ORDER BY createdAt DESC LIMIT 5
    `

    // 查订单商品（用 unsafe 拼接 IN 子句）
    const orderIds = orders.map((o: any) => o.id)
    const itemsRaw = orderIds.length > 0
      ? await prisma.$queryRawUnsafe<any[]>(
          `SELECT orderId, productName FROM OrderItem WHERE orderId IN (${orderIds.map(() => '?').join(',')})`,
          ...orderIds
        )
      : []

    const itemsByOrder = new Map<string, string[]>()
    for (const it of itemsRaw) {
      if (!itemsByOrder.has(it.orderId)) itemsByOrder.set(it.orderId, [])
      itemsByOrder.get(it.orderId)!.push(it.productName)
    }

    const recentOrders = orders.map((o: any) => ({
      orderNo: o.orderNo,
      totalAmount: o.totalAmount,
      items: itemsByOrder.get(o.id) || [],
      createdAt: o.createdAt,
    }))

    return {
      isMember: true,
      name: customer.nickname,
      role: role.name,
      totalSpent: customer.totalSpent || 0,
      points: customer.points || 0,
      allergies: customer.allergies ? customer.allergies.split(',') : [],
      chronicDiseases: customer.chronicDiseases
        ? customer.chronicDiseases.split(',')
        : [],
      recentOrders,
    }
  } catch (error: any) {
    console.error('[ai-context] getMemberContext error:', error?.message)
    return { isMember: false }
  }
}

/**
 * 查询库存上下文（按商品名模糊搜索）
 */
export async function getInventoryContext(
  productName: string
): Promise<InventoryContext[]> {
  if (!productName) return []

  try {
    const products = await prisma.$queryRaw<any[]>`
      SELECT p.name, p.spec, p.price, p.memberPrice, p.quantity, p.productCode, p.salesStatus
      FROM Product p
      JOIN Merchant m ON p.merchantId = m.id
      WHERE m.code = ${DEFAULT_MERCHANT_CODE}
        AND (p.name LIKE ${`%${productName}%`} OR p.searchText LIKE ${`%${productName}%`})
        AND p.purchaseStatus = '使用'
        AND p.salesStatus = '正常销售'
      ORDER BY p.sales30d DESC
      LIMIT 5
    `

    return products.map((p: any) => ({
      productName: p.name,
      available: (p.quantity || 0) > 0,
      quantity: p.quantity || 0,
      price: p.price,
      memberPrice: p.memberPrice,
      productCode: p.productCode,
      spec: p.spec,
    }))
  } catch (error: any) {
    console.error('[ai-context] getInventoryContext error:', error?.message)
    return []
  }
}

/**
 * 查询活动上下文
 */
export async function getPromotionContext(): Promise<PromotionContext[]> {
  try {
    const now = new Date().toISOString()
    const activities = await prisma.$queryRaw<any[]>`
      SELECT title, type, description, endAt
      FROM Activity
      JOIN Merchant ON Activity.merchantId = Merchant.id
      WHERE Merchant.code = ${DEFAULT_MERCHANT_CODE}
        AND Activity.status = 'published'
        AND Activity.startAt <= ${now}
        AND Activity.endAt >= ${now}
      ORDER BY Activity.createdAt DESC
      LIMIT 5
    `

    return activities.map((a: any) => ({
      title: a.title,
      type: a.type,
      description: a.description || '',
      endAt: a.endAt,
    }))
  } catch (error: any) {
    console.error('[ai-context] getPromotionContext error:', error?.message)
    return []
  }
}

/**
 * 格式化为 AI 上下文片段（注入 system prompt）
 */
export function formatContextForAI(context: {
  member?: MemberContext
  inventory?: InventoryContext[]
  promotions?: PromotionContext[]
  safetyDisclaimer?: boolean
}): string {
  const parts: string[] = []

  // 会员上下文
  if (context.member?.isMember) {
    const m = context.member
    parts.push(`【会员信息】
- 姓名：${m.name || '匿名'}
- 等级：${m.role?.toUpperCase() || '普通'}
- 累计消费：¥${(m.totalSpent || 0).toFixed(2)}
- 当前积分：${m.points || 0} 分`)

    if (m.allergies && m.allergies.length > 0) {
      parts.push(`- ⚠️ 过敏史：${m.allergies.join('、')}（推荐用药时严格避开）`)
    }
    if (m.chronicDiseases && m.chronicDiseases.length > 0) {
      parts.push(`- 慢性病：${m.chronicDiseases.join('、')}`)
    }
    if (m.recentOrders && m.recentOrders.length > 0) {
      const lastOrder = m.recentOrders[0]
      parts.push(`- 最近订单：${lastOrder.orderNo}，¥${lastOrder.totalAmount.toFixed(2)}，商品：${lastOrder.items.slice(0, 3).join('、')}`)
    }
  }

  // 库存上下文
  if (context.inventory && context.inventory.length > 0) {
    parts.push(`【本店库存（基于用户问题）】`)
    for (const inv of context.inventory.slice(0, 3)) {
      const status = inv.available
        ? `✅ 有货（${inv.quantity}件）`
        : '❌ 暂时缺货'
      parts.push(
        `- ${inv.productName}${inv.spec ? ` (${inv.spec})` : ''} ¥${inv.price.toFixed(2)}${inv.memberPrice ? `，会员价 ¥${inv.memberPrice.toFixed(2)}` : ''} ${status}`
      )
    }
    if (context.inventory.every((inv) => !inv.available)) {
      parts.push('⚠️ 用户问的商品目前都缺货，建议推荐同类或引导到店咨询')
    }
  }

  // 活动上下文
  if (context.promotions && context.promotions.length > 0) {
    parts.push(`【本店活动】`)
    for (const p of context.promotions) {
      parts.push(`- ${p.title}（${p.type}，到 ${p.endAt} 结束）`)
    }
  }

  // 安全声明
  if (context.safetyDisclaimer) {
    parts.push(`【安全边界】
- 不推荐处方药（需医生处方）
- 不替代医生诊断
- 急症拨打 120
- 严格遵守过敏史`)
  }

  return parts.length > 0 ? '\n\n' + parts.join('\n') : ''
}

/**
 * 一键获取所有上下文（智能判断需要什么）
 */
export async function buildAIContext(params: {
  message: string
  phone?: string
  productHint?: string // 可从用户消息中推断的商品关键词
}): Promise<string> {
  const { message, phone, productHint } = params

  // 1. 会员上下文
  const member = await getMemberContext(phone)

  // 2. 库存上下文（如果有商品提示）
  let inventory: InventoryContext[] = []
  if (productHint) {
    inventory = await getInventoryContext(productHint)
  }

  // 3. 活动上下文（如果消息涉及"活动/优惠/打折"）
  let promotions: PromotionContext[] = []
  if (/活动|优惠|打折|特价|秒杀|促销|discount|promotion/i.test(message)) {
    promotions = await getPromotionContext()
  }

  return formatContextForAI({
    member,
    inventory,
    promotions,
    safetyDisclaimer: true,
  })
}
