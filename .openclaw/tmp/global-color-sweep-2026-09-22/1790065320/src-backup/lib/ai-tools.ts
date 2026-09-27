/**
 * AI 工具系统（2026-06-30 21:05 奕霖需求）
 *
 * 核心：让 AI 不只是"说"，还能"做"
 * - 工具1: create_order - 创建订单 + 生成取货码
 * - 工具2: query_orders - 查询订单（返回卡片）
 * - 工具3: search_products - 搜索商品（返回商品卡片）
 *
 * 架构：
 *   AI 看到 tool 描述 → 决定调哪个 → 后端执行 → 结果回 AI → AI 总结
 *   工具结果也是 cards 格式（OrderCard / ProductCard）
 *
 * 设计原则：
 *   - 工具调用透明：AI 看不到 SQL/Prisma，只看到 input/output
 *   - 错误安全：工具失败返回错误消息，不抛异常
 *   - 审计：所有工具调用记录（用于商家后台分析）
 */

import { prisma } from '@/lib/db'
import { cache } from '@/lib/cache'
import { generateOrderCards } from './ai-cards'


// ⭐ v4.2（奕霖 2026-07-29）：CST 时间戳生成器
function getCSTDateString(d: Date = new Date()): string {
  const utcMs = d.getTime() + d.getTimezoneOffset() * 60 * 1000
  const cst = new Date(utcMs + 8 * 60 * 60 * 1000)
  const yyyy = cst.getFullYear()
  const mm = String(cst.getMonth() + 1).padStart(2, '0')
  const dd = String(cst.getDate()).padStart(2, '0')
  const HH = String(cst.getHours()).padStart(2, '0')
  const MM = String(cst.getMinutes()).padStart(2, '0')
  const SS = String(cst.getSeconds()).padStart(2, '0')
  return `${yyyy}${mm}${dd}${HH}${MM}${SS}`
}
// ⭐ MEMORY §262 — 果蔬 SaaS merchant code (果蔬鲜生)
const DEFAULT_MERCHANT_CODE = 'G0001'

// ---------------------------------------------------------------------------
// 工具定义（AI 看到的就是这些）
// ---------------------------------------------------------------------------
export interface ToolDefinition {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, any>
    required: string[]
  }
}

export const AI_TOOLS: ToolDefinition[] = [
  {
    name: 'create_order',
    description: `创建订单（用户/AI 主动下单）。当用户说"我要买"、"帮我下单"、"来一盒 X"时调用。
成功后返回订单号 + 6 位取货码（用户到店凭码取货 + 支付）。
注意：当前 0-1 阶段不接支付，订单默认 pickup（到店取货）+ simulateComplete=false（真实取货码）。`,
    inputSchema: {
      type: 'object',
      properties: {
        phone: { type: 'string', description: '顾客手机号（必填）' },
        customerName: { type: 'string', description: '顾客姓名（可选）' },
        items: {
          type: 'array',
          description: '商品列表（至少 1 个）',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: '商品名（如"感冒灵颗粒"）' },
              quantity: { type: 'number', description: '数量（默认 1）' },
            },
            required: ['name'],
          },
        },
        remark: { type: 'string', description: '订单备注（可选）' },
      },
      required: ['phone', 'items'],
    },
  },
  {
    name: 'query_orders',
    description: '查询用户的订单（返回最近 5 个订单的卡片数据）。用户问"我的订单"、"取货码"、"我买了什么"时调用。',
    inputSchema: {
      type: 'object',
      properties: {
        phone: { type: 'string', description: '用户手机号' },
        orderNo: { type: 'string', description: '订单号（ORD 开头，可选）' },
        limit: { type: 'number', description: '返回数量（默认 5）' },
      },
      required: ['phone'],
    },
  },
  {
    name: 'search_products',
    description: '搜索商品（用于推荐/查询库存）。用户问"有没有 X"、"X 多少钱"、"有什么感冒药"时调用。',
    inputSchema: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: '商品关键词（必填）' },
        limit: { type: 'number', description: '返回数量（默认 5）' },
      },
      required: ['keyword'],
    },
  },
  {
    name: 'cancel_order',
    description: `取消订单（仅 pending 状态的订单可取消）。当用户说"取消订单"、"不要了"、"退掉"时调用。
需要订单号（ORD 开头）或取货码。
如果用户没提供订单号/取货码，先调用 query_orders 列出用户订单让用户选。`,
    inputSchema: {
      type: 'object',
      properties: {
        phone: { type: 'string', description: '用户手机号（必填，自动注入）' },
        orderNo: { type: 'string', description: '订单号（ORD 开头）' },
        pickupCode: { type: 'string', description: '6 位取货码' },
      },
      required: ['phone'],
    },
  },

  {
    name: 'add_user_need',
    description: '记录用户需求/偏好（不一定要下单）。用户说"我想买XX""给老人吃要软的""便宜点""明天要"等隐性需求时调用。商家到店后可按手机号查看用户最近需求。',
    inputSchema: {
      type: 'object',
      properties: {
        phone: { type: 'string', description: '用户手机号（必填，自动注入）' },
        needText: { type: 'string', description: '用户原话（必填）' },
        summaryText: { type: 'string', description: 'AI 一句话总结（不超过 50 字）' },
        customerName: { type: 'string', description: '用户昵称（可选）' },
      },
      required: ['phone', 'needText'],
    },
  },
]

// ---------------------------------------------------------------------------
// 工具执行器
// ---------------------------------------------------------------------------
export type ToolExecutionResult =
  | { success: true; data: any; cards?: any[] }
  | { success: false; error: string }

/**
 * 创建订单
 */
export async function executeCreateOrder(input: {
  phone: string
  customerName?: string
  items: Array<{ name: string; quantity?: number }>
  remark?: string
}): Promise<ToolExecutionResult> {
  if (!input.phone) return { success: false, error: '手机号必填' }
  if (!input.items || input.items.length === 0) {
    return { success: false, error: '商品列表不能为空' }
  }

  try {
    // 1. 找商品（按商品名模糊匹配）
    const productNames = input.items.map((it) => it.name).filter(Boolean)
    if (productNames.length === 0) {
      return { success: false, error: '至少需要一个商品名' }
    }

    // 查第一个商品（简化：v1.0 只支持单商品）
    const productName = productNames[0]
    // ⭐ 2026-07-03 23:58 奕霖需求：必须过滤有货商品（stock > 0）
    const products = await prisma.$queryRaw<any[]>`
      SELECT p.id, p.name, p.spec, p.price, p.stock, p.status
      FROM Product p
      JOIN Merchant m ON p.merchantId = m.id
      WHERE m.code = ${DEFAULT_MERCHANT_CODE}
        AND (p.name LIKE ${`%${productName}%`} OR p.name LIKE ${`%${productName.replace(/润/g, 'g')}%`})
        AND p.status = 'active'
        AND p.stock > 0
      ORDER BY p.price ASC
      LIMIT 1
    `

    if (products.length === 0) {
      // ⭐ 2026-07-03 23:58 改进：先查一下是不是商品名错了（但没货）
      const allMatches = await prisma.$queryRaw<any[]>`
        SELECT p.name, p.stock FROM Product p
        JOIN Merchant m ON p.merchantId = m.id
        WHERE m.code = ${DEFAULT_MERCHANT_CODE}
          AND p.name LIKE ${`%${productName}%`}
          AND p.status = 'active'
        ORDER BY p.price ASC
        LIMIT 3
      `
      if (allMatches.length > 0) {
        const outOfStockNames = allMatches.map((m: any) => m.name).join('、')
        return {
          success: false,
          error: `"${productName}"暂时没货了（找到的：${outOfStockNames} 都没库存）。建议：让用户描述要啥或问其他常见商品。`,
        }
      }
      console.log('[ai-tools] 商品未找到:', productName)
      return {
        success: false,
        error: `没找到"${productName}"这个商品。建议：让用户描述症状或问你其他常见商品。`,
      }
    }
    console.log('[ai-tools] 找到商品:', products[0])

    const product = products[0]

    // 2. 调现有 orders API 创建订单（用直接 SQL，绕开 HTTP）
    // ⭐ v4.2（奕霖 2026-07-29）：orderNo 改 CST 人类可读 (ORD + YYYYMMDDHHMMSS + 3 random)
    // 旧: ORD{Date.now()}{random} = UTC epoch ms，看起来像时间但跟 CST 差 8h
    // 新: ORD{YYYYMMDDHHMMSS CST}{random} = 跟现实北京时刻 1:1 对齐
    const orderId = `ord_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const orderNo = `ORD${getCSTDateString()}${Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0')}`
    const quantity = input.items[0].quantity || 1
    const price = product.price
    const totalAmount = price * quantity
    const finalAmount = totalAmount
    const customerName = input.customerName || 'AI 顾客'

    // 找/创建 Customer
    const customerRows = await prisma.$queryRaw<any[]>`
      SELECT id FROM Customer
      WHERE merchantId = (SELECT id FROM Merchant WHERE code = ${DEFAULT_MERCHANT_CODE})
        AND phone = ${input.phone}
      LIMIT 1
    `
    const merchantRows = await prisma.$queryRaw<any[]>`
      SELECT id FROM Merchant WHERE code = ${DEFAULT_MERCHANT_CODE} LIMIT 1
    `
    const merchantId = merchantRows[0]?.id
    if (!merchantId) return { success: false, error: '商户不存在' }

    const customerId =
      customerRows.length > 0
        ? customerRows[0].id
        : `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    if (customerRows.length === 0) {
      await prisma.$executeRaw`
        INSERT INTO Customer (id, merchantId, phone, nickname, totalSpent, totalOrders, points, createdAt, updatedAt)
        VALUES (${customerId}, ${merchantId}, ${input.phone}, ${customerName}, 0, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `
    }

    // 3. 生成 6 位取货码（确保唯一）
    let pickupCode: string | null = null
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = Math.floor(100000 + Math.random() * 900000).toString()
      const existing = await prisma.$queryRaw<any[]>`
        SELECT id FROM "Order" WHERE pickupCode = ${code} LIMIT 1
      `
      if (existing.length === 0) {
        pickupCode = code
        break
      }
    }
    if (!pickupCode) return { success: false, error: '取货码生成失败' }
    const pickupExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    // 4. 插入 Order
    await prisma.$executeRaw`
      INSERT INTO "Order" (
        id, merchantId, customerId, orderNo, totalAmount, discountAmount, pointsUsed, pointsValue, finalAmount,
        deliveryType, deliveryAddress, deliveryPhone, status, remark,
        pickupCode, pickupExpiresAt, createdAt, updatedAt
      ) VALUES (
        ${orderId}, ${merchantId}, ${customerId}, ${orderNo}, ${totalAmount}, 0, 0, 0, ${finalAmount},
        'pickup', null, ${input.phone}, 'pending', ${input.remark || `AI 下单：${productName}`},
        ${pickupCode}, ${pickupExpiresAt}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `

    // 5. 插入 OrderItem
    await prisma.$executeRaw`
      INSERT INTO OrderItem (id, orderId, productId, productName, productSpec, price, quantity, subtotal)
      VALUES (${`oi_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`}, ${orderId}, ${product.id}, ${product.name}, ${product.spec || null}, ${price}, ${quantity}, ${totalAmount})
    `

    // 6. 累加 customer.totalSpent + 积分
    await prisma.$executeRaw`
      UPDATE Customer
      SET totalSpent = totalSpent + ${finalAmount},
          totalOrders = totalOrders + 1,
          points = points + ${Math.floor(finalAmount)},
          updatedAt = CURRENT_TIMESTAMP
      WHERE id = ${customerId}
    `

    // ⭐ 2026-07-03 23:58 奕霖需求：下单后扣库存（原子操作，避免超卖）
    const stockDecrement = await prisma.$executeRaw`
      UPDATE Product
      SET stock = stock - ${quantity},
          sales30d = COALESCE(sales30d, 0) + ${quantity},
          updatedAt = CURRENT_TIMESTAMP
      WHERE id = ${product.id}
        AND stock >= ${quantity}
    `
    if (stockDecrement === 0) {
      // 库存不够（极端并发情况），回滚订单
      console.error('[ai-tools] 库存不足，回滚订单:', product.name)
      await prisma.$executeRaw`DELETE FROM "Order" WHERE id = ${orderId}`
      await prisma.$executeRaw`DELETE FROM OrderItem WHERE orderId = ${orderId}`
      return {
        success: false,
        error: `${product.name} 库存不够了，请试试其他商品。`,
      }
    }
    console.log('[ai-tools] 库存已扣减:', product.name, '-', quantity)

    return {
      success: true,
      data: {
        orderId,
        orderNo,
        pickupCode,
        pickupExpiresAt,
        productName: product.name,
        spec: product.spec,
        quantity,
        price,
        finalAmount,
        status: 'pending',
      },
      // 关键：返回 OrderCard，前端直接渲染
      cards: [
        {
          type: 'order',
          orderId,
          orderNo,
          status: 'pending',
          statusLabel: '待付款',
          pickupCode,
          pickupExpiresAt,
          finalAmount,
          itemCount: quantity,
          itemSummary: `${product.name} × ${quantity}`,
          createdAt: new Date().toISOString(),
        },
      ],
    }
  } catch (err: any) {
    console.error('[ai-tools] create_order error FULL:', err?.message, err)
    return { success: false, error: `下单失败：${err?.message || '未知错误'}` }
  }
}

/**
 * 查询订单
 */
export async function executeQueryOrders(input: {
  phone: string
  orderNo?: string
  limit?: number
  status?: string  // 可选：过滤状态（pending/delivered/cancelled）
}): Promise<ToolExecutionResult> {
  if (!input.phone && !input.orderNo) {
    return { success: false, error: '手机号或订单号必填' }
  }
  // ⭐ 2026-07-13 01:15 奕霖反馈：几个订单 AI 只告诉一个
  // 默认 limit 从 5 提到 20 + 按时间倒序
  const cards = await generateOrderCards({
    phone: input.phone,
    orderNo: input.orderNo,
    limit: input.limit || 20,
  })
  if (cards.length === 0) {
    return { success: true, data: { count: 0, message: '没找到相关订单', orders: [] }, cards: [] }
  }
  return {
    success: true,
    data: {
      count: cards.length,
      message: `找到 ${cards.length} 个订单`,
      // ⭐ 奕霖 2026-06-30 22:03：让 AI 看到完整订单信息
      orders: cards.map(c => ({
        orderNo: c.orderNo,
        pickupCode: c.pickupCode,
        status: c.statusLabel,
        finalAmount: c.finalAmount,
        itemSummary: c.itemSummary,
      })),
    },
    cards,
  }
}

/**
 * 取消订单（仅 pending 状态可取消）
 */
export async function executeCancelOrder(input: {
  phone: string
  orderNo?: string
  pickupCode?: string
}): Promise<ToolExecutionResult> {
  if (!input.phone) return { success: false, error: '手机号必填' }
  if (!input.orderNo && !input.pickupCode) {
    return { success: false, error: '订单号或取货码必填（其一）' }
  }
  try {
    // 找订单
    let orderRows: any[] = []
    if (input.orderNo) {
      orderRows = await prisma.$queryRaw<any[]>`
        SELECT id, orderNo, status, pickupCode, finalAmount, customerId, merchantId
        FROM "Order"
        WHERE orderNo = ${input.orderNo}
          AND merchantId = (SELECT id FROM Merchant WHERE code = ${DEFAULT_MERCHANT_CODE})
        LIMIT 1
      `
    } else if (input.pickupCode) {
      orderRows = await prisma.$queryRaw<any[]>`
        SELECT id, orderNo, status, pickupCode, finalAmount, customerId, merchantId
        FROM "Order"
        WHERE pickupCode = ${input.pickupCode}
          AND merchantId = (SELECT id FROM Merchant WHERE code = ${DEFAULT_MERCHANT_CODE})
        LIMIT 1
      `
    }
    if (orderRows.length === 0) {
      return { success: false, error: `没找到这个订单（订单号：${input.orderNo || ''}，取货码：${input.pickupCode || ''}）。请先调 query_orders 查看订单列表。` }
    }
    const order = orderRows[0]

    // 验证手机号（防止取消别人的订单）
    const customerRows = await prisma.$queryRaw<any[]>`
      SELECT phone FROM Customer WHERE id = ${order.customerId} LIMIT 1
    `
    if (customerRows.length === 0 || customerRows[0].phone !== input.phone) {
      return { success: false, error: '这个订单不属于你，不能取消' }
    }

    // 检查状态（只能取消 pending）
    if (order.status !== 'pending') {
      return { success: false, error: `订单状态是【${order.status}】，不能取消（只能取消"待付款"状态的订单）。如果订单已支付，请到店协商退款。` }
    }

    // 取消订单 + 恢复库存
    await prisma.$executeRaw`
      UPDATE "Order"
      SET status = 'cancelled', updatedAt = CURRENT_TIMESTAMP
      WHERE id = ${order.id}
    `
    // 恢复库存
    const items = await prisma.$queryRaw<any[]>`
      SELECT productId, quantity FROM OrderItem WHERE orderId = ${order.id}
    `
    for (const item of items) {
      await prisma.$executeRaw`
        UPDATE Product SET stock = stock + ${item.quantity}, updatedAt = CURRENT_TIMESTAMP
        WHERE id = ${item.productId}
      `
    }

    // 扣回积分 + 退累计消费
    const pointsToRefund = Math.floor(order.finalAmount || 0)
    if (pointsToRefund > 0) {
      await prisma.$executeRaw`
        UPDATE Customer
        SET points = MAX(0, points - ${pointsToRefund}),
            totalOrders = MAX(0, totalOrders - 1),
            totalSpent = MAX(0, totalSpent - ${order.finalAmount || 0}),
            updatedAt = CURRENT_TIMESTAMP
        WHERE id = ${order.customerId}
      `
    }

    const cancelCard = {
      type: 'order',
      orderId: order.id,
      orderNo: order.orderNo,
      status: 'cancelled',
      statusLabel: '已取消',
      pickupCode: order.pickupCode,
      finalAmount: order.finalAmount,
      itemCount: items.length,
      cancelled: true,
    }
    return {
      success: true,
      data: {
        orderNo: order.orderNo,
        pickupCode: order.pickupCode,
        status: 'cancelled',
        message: `订单 ${order.orderNo} 已取消，库存已恢复`,
      },
      cards: [cancelCard],
    }
  } catch (err: any) {
    console.error('[ai-tools] cancel_order error FULL:', err?.message, err)
    return { success: false, error: `取消失败：${err?.message || '未知错误'}` }
  }
}

/**
 * 搜索商品
 */
export async function executeSearchProducts(input: {
  keyword: string
  limit?: number
}): Promise<ToolExecutionResult> {
  if (!input.keyword) return { success: false, error: '关键词必填' }
  try {
    // ⭐ 奕霖 2026-07-03：库存查询慢，加 5min 内存缓存
    const cacheKey = `search_products:${DEFAULT_MERCHANT_CODE}:${input.keyword}:${input.limit || 5}`
    const cards = await cache.wrap(cacheKey, async () => {
      const products = await prisma.$queryRaw<any[]>`
        SELECT
          p.id, p.name, p.shortName, p.spec, p.price, p.memberPrice,
          p.points, p.stock, p.image, p.productCode, p.weightGram,
          p.unit, p.sales30d, p.sales30_60d, p.sales60_90d,
          p.category, p.categoryLabel, p.qualityClass, p.description
        FROM Product p
        JOIN Merchant m ON p.merchantId = m.id
        WHERE m.code = ${DEFAULT_MERCHANT_CODE}
          AND p.name LIKE ${`%${input.keyword}%`}
          AND p.status = 'active'
        ORDER BY p.price ASC
        LIMIT ${input.limit || 5}
      `
      return products.map((p: any) => ({
        type: 'product',
        productId: p.id,
        name: p.name,
        shortName: p.shortName,
        spec: p.spec,
        price: p.price,
        memberPrice: p.memberPrice,
        points: p.points,
        stock: p.stock,
        image: p.image,
        productCode: p.productCode,
        weightGram: p.weightGram,
        unit: p.unit,
        sales30d: p.sales30d,
        sales30_60d: p.sales30_60d,
        sales60_90d: p.sales60_90d,
        category: p.category,
        categoryLabel: p.categoryLabel,
        qualityClass: p.qualityClass,
        description: p.description,
        available: (p.stock || 0) > 0,
      }))
    }, 5 * 60 * 1000) // 5 分钟缓存

    return {
      success: true,
      data: { count: cards.length, message: `找到 ${cards.length} 个商品` },
      cards,
    }
  } catch (err: any) {
    console.error('[ai-tools] search_products error:', err?.message)
    return { success: false, error: `搜索失败：${err?.message}` }
  }
}

// ---------------------------------------------------------------------------
// 统一入口
// ---------------------------------------------------------------------------
export async function executeTool(
  name: string,
  input: any
): Promise<ToolExecutionResult> {
  switch (name) {
    case 'create_order':
      return executeCreateOrder(input)
    case 'query_orders':
      return executeQueryOrders(input)
    case 'search_products':
      return executeSearchProducts(input)
    case 'cancel_order':
      return executeCancelOrder(input)
    case 'add_user_need':
      return executeAddUserNeed(input)
    default:
      return { success: false, error: `未知工具：${name}` }
  }
}

// ---------------------------------------------------------------------------
// 工具描述生成（用于注入 system prompt，让 AI 知道有什么工具）
// ---------------------------------------------------------------------------
export function buildToolsDescription(): string {
  const lines: string[] = []
  for (const tool of AI_TOOLS) {
    const params = Object.entries(tool.inputSchema.properties)
      .map(([k, v]: [string, any]) => {
        const required = tool.inputSchema.required.includes(k) ? '（必填）' : '（可选）'
        return `  - ${k}: ${v.description || k} ${required}`
      })
      .join('\n')
    lines.push(`【${tool.name}】\n${tool.description}\n参数：\n${params}\n`)
  }
  return lines.join('\n')
}

/**
 * ⭐ 2026-08-25 14:42 奕霖需求：记录用户需求，商家到店按手机号查看
 * 用户说"想XX/给老人吃/便宜/明天要"等隐性需求时调用
 * 不需要下单,只记录偏好
 */
async function executeAddUserNeed(input: {
  phone: string
  needText: string
  summaryText?: string
  customerName?: string
}): Promise<ToolExecutionResult> {
  if (!input.phone) return { success: false, error: '手机号必填' }
  if (!input.needText || input.needText.trim().length === 0) {
    return { success: false, error: '需求文本不能为空' }
  }

  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3020'
    const res = await fetch(`${baseUrl}/api/user-needs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userPhone: input.phone,
        userName: input.customerName || null,
        needText: input.needText,
        summaryText: input.summaryText || input.needText.slice(0, 50),
        source: 'chat',
      }),
    })

    const data = await res.json()

    if (!res.ok || !data.success) {
      return { success: false, error: data.error || `HTTP ${res.status}` }
    }

    return {
      success: true,
      data: {
        id: data.id,
        summary: data.summary,
        message: '需求已记录，商家到店时可按手机号查看',
      },
    }
  } catch (e: any) {
    console.error('[executeAddUserNeed]', e)
    return { success: false, error: e.message || String(e) }
  }
}
