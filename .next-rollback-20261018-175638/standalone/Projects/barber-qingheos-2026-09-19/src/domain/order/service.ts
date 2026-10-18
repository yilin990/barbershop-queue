/**
 * 订单 domain — 抽离 order + pickup 业务逻辑（2026-07-25 by 清禾）
 *
 * 包含：
 *   - createOrder          下单 + 自动生成取货码 + 触发会员积分
 *   - getCustomerOrders    查个人订单（带 items）
 *   - getPickupInfo        查询取货码状态
 *   - redeemPickupCode     核销取货码 + 触发会员积分 + 小票打印
 *
 * 路由层只做：
 *   1. parse + 验证入参
 *   2. 调 domain
 *   3. 格式化返回
 *
 * 复用：其他商户（美发、餐饮等）只要实现同样的 raw SQL 即可
 */

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { generatePickupCode, PICKUP_CODE_EXPIRES_MS, redeemPickupCode as libRedeem } from '@/lib/pickup-code'
import { onOrderCompleted, genId, genOrderNo } from '@/domain/membership/service'
import { ValidationError, NotFoundError } from '@/lib/error'

const DEFAULT_MERCHANT_CODE = 'G0001'

// ============== Type 定义 ==============

export interface OrderItemInput {
  productId?: string
  name?: string
  spec?: string
  image?: string
  price?: number
  quantity?: number
}

export interface CreateOrderInput {
  merchantCode?: string
  /** v1.1.54 - 直接指定商户 ID, 优先于 merchantCode。
   *  门店主页预约走这条, 避免 merchantCode 硬编码 (G0001 指向果蔬店)。 */
  merchantId?: string
  customerName?: string
  phone: string
  items: OrderItemInput[]
  deliveryType?: 'pickup' | 'delivery'
  deliveryAddress?: string
  deliveryPhone?: string
  remark?: string
  /** demo 模式：直接 completed（不生成取货码） */
  simulateComplete?: boolean
  /** 关联拼团（group buy） */
  groupBuyId?: string
  /** 订单来源（normal/group/admin） */
  source?: 'normal' | 'group' | 'admin'
  actualPaidAmount?: number
  posRecordedAmount?: number
  /** v1.1.54 - 下单成功后同步写入理发店排队表 (BarberQueue),
   *  让店长在排队页同时看到「到店取号」和「在线预约」。 */
  enqueue?: boolean
  /** 排队用: 服务名, 如「精剪造型」 */
  enqueueService?: string
  /** 排队用: 预约时间, 如 '14:30' */
  scheduledAt?: string
}

export interface RedeemPickupInput {
  code: string
  staffId?: string
  staffName?: string
  payMethod?: 'cash' | 'wechat' | 'alipay' | 'card' | 'other'
  printReceipt?: boolean
}

// ============== 下单 ==============

/**
 * 创建订单 + 自动触发会员积分
 *
 * 完整链路：
 *   1. 校验入参
 *   2. 找商户 + 找商品
 *   3. 计算金额 + 构造 OrderItem
 *   4. 生成取货码（pickup + 非 simulateComplete 才生成）
 *   5. 找/创建 Customer
 *   6. INSERT Order + OrderItems
 *   7. 触发 onOrderCompleted（积分到账）
 *
 * 抛 ApiError/ValidationError/NotFoundError/ConflictError
 */
export async function createOrder(input: CreateOrderInput) {
  const {
    merchantCode = DEFAULT_MERCHANT_CODE,
    customerName,
    phone,
    items,
    deliveryType = 'pickup',
    deliveryAddress,
    deliveryPhone,
    remark,
    simulateComplete = false,
    groupBuyId,
    actualPaidAmount,
    source = 'normal',
  } = input

  // ⭐ MEMORY 244 — 实付金额得积分 (POS 录入)
  const actualPaidValue = input.actualPaidAmount ?? input.posRecordedAmount ?? 0

  // 校验
  if (!phone) {
    throw new ValidationError('缺少必填字段: phone')
  }
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new ValidationError('缺少必填字段: items (非空数组)')
  }

  // 1. 找商户 - v1.1.54: merchantId 优先, 其次才按 code 解析
  //    (原来只有 code 一条路, 全项目硬编码 G0001 -> m_grocery_001 果蔬店)
  let merchantId: string
  if (input.merchantId) {
    const found = await prisma.$queryRaw<any[]>`
      SELECT id, code, name FROM Merchant WHERE id = ${input.merchantId} LIMIT 1
    `
    if (found.length === 0) {
      throw new NotFoundError('商户不存在')
    }
    merchantId = found[0].id
  } else {
    const merchants = await prisma.$queryRaw<any[]>`
      SELECT id, code, name FROM Merchant WHERE code = ${merchantCode} LIMIT 1
    `
    if (merchants.length === 0) {
      throw new NotFoundError('商户不存在')
    }
    merchantId = merchants[0].id
  }

  // 2. 找商品
  const productIds = items.map((it) => it.productId).filter(Boolean) as string[]
  const products = productIds.length > 0
    ? await prisma.$queryRaw<any[]>`
        SELECT id, name, spec, price, image FROM Product WHERE id IN (${Prisma.join(productIds)})
      `
    : []
  const productMap = new Map(products.map((p: any) => [p.id, p]))

  // 3. 算金额
  let totalAmount = 0
  const orderItemsData = items.map((it) => {
    const product = it.productId ? productMap.get(it.productId) : null
    const price = it.price ?? (product as any)?.price ?? 0
    const quantity = it.quantity ?? 1
    const subtotal = price * quantity
    totalAmount += subtotal
    return {
      id: genId('oi'),
      productId: it.productId || (product as any)?.id || '',
      productName: it.name || (product as any)?.name || '商品',
      productSpec: it.spec || (product as any)?.spec || null,
      productImage: it.image || (product as any)?.image || null,
      price,
      quantity,
      subtotal,
    }
  })
  const finalAmount = Math.max(0, totalAmount)

  // 4. ID + 状态 + 取货码
  const orderId = genId('ord')
  const orderNo = genOrderNo()
  const status = simulateComplete ? 'completed' : 'pending'
  const now = new Date().toISOString()

  let pickupCode: string | null = null
  let pickupExpiresAt: string | null = null
  if (deliveryType === 'pickup' && !simulateComplete) {
    pickupCode = await generatePickupCode(merchantCode)
    pickupExpiresAt = new Date(Date.now() + PICKUP_CODE_EXPIRES_MS).toISOString()
  }

  // 5. 找/创建 Customer
  const customerRows = await prisma.$queryRaw<any[]>`
    SELECT id FROM Customer WHERE merchantId = ${merchantId} AND phone = ${phone} LIMIT 1
  `
  const customerId = customerRows.length > 0 ? customerRows[0].id : genId('c')
  if (customerRows.length === 0) {
    await prisma.$executeRaw`
      INSERT INTO Customer (id, merchantId, phone, nickname, totalSpent, totalOrders, points, createdAt, updatedAt)
      VALUES (${customerId}, ${merchantId}, ${phone}, ${customerName || '顾客'}, 0, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `
  }

  // 6. 创建 Order
  await prisma.$executeRaw`
    INSERT INTO "Order" (
      id, merchantId, customerId, orderNo, totalAmount, discountAmount, pointsUsed, pointsValue, finalAmount,
      deliveryType, deliveryAddress, deliveryPhone, status, paidAt, completedAt, remark,
      pickupCode, pickupExpiresAt, source, groupBuyId, posRecordedAmount, createdAt, updatedAt
    ) VALUES (
      ${orderId}, ${merchantId}, ${customerId}, ${orderNo}, ${totalAmount}, 0, 0, 0, ${finalAmount},
      ${deliveryType}, ${deliveryAddress || null}, ${deliveryPhone || phone}, ${status},
      ${simulateComplete ? now : null}, ${simulateComplete ? now : null}, ${remark || null},
      ${pickupCode}, ${pickupExpiresAt},
      ${source}, ${groupBuyId || null},
      ${actualPaidValue},
      ${now}, ${now}
    )
  `

  // 7. 批量插入 OrderItem
  for (const it of orderItemsData) {
    await prisma.$executeRaw`
      INSERT INTO OrderItem (id, orderId, productId, productName, productSpec, productImage, price, quantity, subtotal)
      VALUES (${it.id}, ${orderId}, ${it.productId || null}, ${it.productName}, ${it.productSpec}, ${it.productImage}, ${it.price}, ${it.quantity}, ${it.subtotal})
    `
  }

  // 8. 触发会员积分
  // ⭐ 奕霖 2026-08-07 18:19 反馈：「购物车提交订单后积分自己增加了，这个还没有在商户核销就更新数据了，这个不行」
  // 业务规则：积分必须在商户核销后才发（pending → delivered 时）
  // 修复：从 createOrder 里移除 onOrderCompleted 调用
  // 积分触发：核销时 /api/admin/orders/pickup 调用
  // 这里只创建 pending 订单，不发积分
  const membership: any = null

  return {
    orderId,
    orderNo,
    totalAmount,
    finalAmount,
    status,
    itemCount: orderItemsData.length,
    createdAt: now,
    pickupCode,
    pickupExpiresAt,
    membership,
  }
}

// ============== 查订单 ==============

export async function getCustomerOrders(params: {
  merchantCode?: string
  phone: string
  status?: string
  limit?: number
}) {
  const merchantCode = params.merchantCode
  const phone = params.phone
  const status = params.status
  const limit = params.limit || 50

  if (!phone) {
    throw new ValidationError('需提供 phone 参数')
  }

  // ⭐ 2026-10-05 02:18 奕霖修复：不传 merchantCode 时跨商户搜（/orders 页面需要看所有商户订单）
  if (!merchantCode) {
    // 跨商户：按 phone 查所有 Order（customerId OR deliveryPhone）
    // 先查所有 customer（不限商户）
    const customerRows = await prisma.$queryRaw<any[]>`
      SELECT id, merchantId FROM Customer WHERE phone = ${phone}
    `
    const customerIds = customerRows.map((c: any) => c.id)

    let orders
    if (customerIds.length > 0) {
      orders = status
        ? await prisma.$queryRaw<any[]>`
            SELECT * FROM "Order"
            WHERE (customerId IN (${Prisma.join(customerIds)}) OR deliveryPhone = ${phone})
              AND status = ${status}
            ORDER BY createdAt DESC LIMIT ${limit}
          `
        : await prisma.$queryRaw<any[]>`
            SELECT * FROM "Order"
            WHERE (customerId IN (${Prisma.join(customerIds)}) OR deliveryPhone = ${phone})
            ORDER BY createdAt DESC LIMIT ${limit}
          `
    } else {
      // 没有 customer 记录（barber 预约典型场景），只按 deliveryPhone 查
      orders = status
        ? await prisma.$queryRaw<any[]>`
            SELECT * FROM "Order"
            WHERE deliveryPhone = ${phone} AND status = ${status}
            ORDER BY createdAt DESC LIMIT ${limit}
          `
        : await prisma.$queryRaw<any[]>`
            SELECT * FROM "Order"
            WHERE deliveryPhone = ${phone}
            ORDER BY createdAt DESC LIMIT ${limit}
          `
    }
    // 注：跨商户查后补 items
    const orderIds = orders.map((o) => o.id)
    const items = orderIds.length > 0
      ? await prisma.$queryRaw<any[]>`
          SELECT * FROM OrderItem WHERE orderId IN (${Prisma.join(orderIds)})
        `
      : []
    const itemsByOrder = new Map<string, any[]>()
    for (const it of items) {
      if (!itemsByOrder.has(it.orderId)) itemsByOrder.set(it.orderId, [])
      itemsByOrder.get(it.orderId)!.push(it)
    }
    return {
      orders: orders.map((o) => ({ ...o, items: itemsByOrder.get(o.id) || [] })),
    }
  }

  // ↓ 传了 merchantCode：单商户老逻辑（保留向后兼容）
  const code = merchantCode || DEFAULT_MERCHANT_CODE
  const merchants = await prisma.$queryRaw<any[]>`
    SELECT id, code, name FROM Merchant WHERE code = ${code} LIMIT 1
  `
  if (merchants.length === 0) {
    throw new NotFoundError('商户不存在')
  }
  const merchantId = merchants[0].id

  const customerRows = await prisma.$queryRaw<any[]>`
    SELECT id FROM Customer WHERE merchantId = ${merchantId} AND phone = ${phone} LIMIT 1
  `
  const customerId = customerRows.length > 0 ? customerRows[0].id : null

  let orders
  if (customerId) {
    orders = status
      ? await prisma.$queryRaw<any[]>`
          SELECT * FROM "Order"
          WHERE merchantId = ${merchantId}
            AND (customerId = ${customerId} OR deliveryPhone = ${phone})
            AND status = ${status}
          ORDER BY createdAt DESC LIMIT ${limit}
        `
      : await prisma.$queryRaw<any[]>`
          SELECT * FROM "Order"
          WHERE merchantId = ${merchantId}
            AND (customerId = ${customerId} OR deliveryPhone = ${phone})
          ORDER BY createdAt DESC LIMIT ${limit}
        `
  } else {
    orders = status
      ? await prisma.$queryRaw<any[]>`
          SELECT * FROM "Order"
          WHERE merchantId = ${merchantId}
            AND deliveryPhone = ${phone}
            AND status = ${status}
          ORDER BY createdAt DESC LIMIT ${limit}
        `
      : await prisma.$queryRaw<any[]>`
          SELECT * FROM "Order"
          WHERE merchantId = ${merchantId}
            AND deliveryPhone = ${phone}
          ORDER BY createdAt DESC LIMIT ${limit}
        `
  }

  const orderIds = orders.map((o) => o.id)
  const items = orderIds.length > 0
    ? await prisma.$queryRaw<any[]>`
        SELECT * FROM OrderItem WHERE orderId IN (${Prisma.join(orderIds)})
      `
    : []
  const itemsByOrder = new Map<string, any[]>()
  for (const it of items) {
    if (!itemsByOrder.has(it.orderId)) itemsByOrder.set(it.orderId, [])
    itemsByOrder.get(it.orderId)!.push(it)
  }

  return {
    orders: orders.map((o) => ({ ...o, items: itemsByOrder.get(o.id) || [] })),
  }
}

// ============== 取货码 ==============

/**
 * 查询取货码状态
 */
export async function getPickupInfo(code: string) {
  if (!code) {
    throw new ValidationError('缺少取货码')
  }
  if (!/^\d{6}$/.test(code)) {
    throw new ValidationError('取货码格式错误（需 6 位数字）')
  }

  const rows = await prisma.$queryRaw<any[]>`
    SELECT o.id, o.orderNo, o.totalAmount, o.finalAmount, o.status,
           o.pickupCode, o.pickupExpiresAt, o.pickedUpAt, o.remark,
           c.phone as customerPhone, c.nickname as customerName
    FROM "Order" o
    LEFT JOIN Customer c ON o.customerId = c.id
    WHERE o.pickupCode = ${code}
    LIMIT 1
  `

  if (rows.length === 0) {
    throw new NotFoundError('取货码不存在')
  }

  const order = rows[0]
  const now = new Date()
  const expiresAt = order.pickupExpiresAt ? new Date(order.pickupExpiresAt) : null

  return {
    orderNo: order.orderNo,
    finalAmount: order.finalAmount,
    status: order.status,
    customerName: order.customerName || '顾客',
    customerPhone: order.customerPhone,
    pickedUpAt: order.pickedUpAt,
    isRedeemed: !!order.pickedUpAt,
    isExpired: expiresAt ? expiresAt < now : false,
    expiresAt: order.pickupExpiresAt,
    remark: order.remark || null,
  }
}

/**
 * 核销取货码（店员操作）
 *
 * 完整链路：
 *   1. libRedeem 验证 + 标记 pickedUp
 *   2. UPDATE remark 记录 staff + payMethod
 *   3. 查询 OrderItem（用于小票）
 *   4. 可选：后台打印小票
 *   5. INSERT AuditLog
 */
export async function redeemOrder(input: RedeemPickupInput) {
  const { code, staffId, staffName, payMethod = 'cash', printReceipt = false } = input

  if (!code) {
    throw new ValidationError('缺少取货码')
  }

  // 1. 核销（lib 内部会标记 pickedUp + pickedUpBy + pickedUpAt）
  const result = await libRedeem(code, staffId || 'unknown')
  if (!result.success) {
    throw new ValidationError(result.error || '核销失败')
  }

  let itemsForReceipt: any[] = []

  if (result.order) {
    // 2. 记录支付方式（仅标记）
    await prisma.$executeRaw`
      UPDATE "Order"
      SET remark = COALESCE(remark, '') || ${`\n[核销] staff=${staffName || staffId || 'unknown'}, payMethod=${payMethod}, at=${new Date().toISOString()}`}
      WHERE id = ${result.order.id}
    `

    // 3. 查 OrderItem（用于小票）
    try {
      itemsForReceipt = await prisma.$queryRaw<any[]>`
        SELECT productName, quantity, price FROM OrderItem WHERE orderId = ${result.order.id}
      `
    } catch (e) {}

    // 4. 后台打印小票（不阻塞）
    if (printReceipt) {
      printReceiptInBackground(
        { ...result.order, items: itemsForReceipt },
        payMethod,
        staffName || staffId || 'unknown',
      )
    }

    // 5. AuditLog
    try {
      // ⭐ MEMORY 244 — 实付金额得积分 (POS 录入)
      // 优先用 posRecordedAmount（实付金额），其次 finalAmount（应付），最后 totalAmount
      const pickupAmt = Number(result.order.posRecordedAmount > 0 ? result.order.posRecordedAmount : (result.order.finalAmount ?? result.order.totalAmount ?? 0)).toFixed(2)
      await prisma.$executeRaw`
        INSERT INTO AuditLog (id, merchantId, actorType, actorId, action, target, description, createdAt)
        VALUES (${`al_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`}, ${result.order.merchantId || null}, 'staff', ${staffId || null}, 'order_completed', ${result.order.id}, ${`核销订单 ${result.order.orderNo || result.order.id}（取货码：${result.order.pickupCode || ''}, 实付¥${pickupAmt}, 支付：${payMethod}）`}, CURRENT_TIMESTAMP)
      `
    } catch (e) {
      console.warn('[audit] pickup log failed:', (e as any).message)
    }
  }

  return {
    success: true,
    message: '核销成功',
    printReceipt: printReceipt === true,
    order: {
      ...result.order,
      staffName,
      payMethod,
      pickedUpAt: new Date().toISOString(),
    },
  }
}

// ============== 私有：小票后台打印 ==============

function printReceiptInBackground(order: any, payMethod: string, staffName: string) {
  try {
    // 用 dynamic import 避免 serverless 启动慢（node:child_process 在 edge runtime 不允许）
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { spawn } = require('child_process')
    const path = require('path')
    const PRINTER_VENV = '/Users/yilinzhao/.openclaw/venv/bin/python3'
    const PRINTER_SCRIPT = '/Users/yilinzhao/.openclaw/workspace/tools/printer_hp4512.py'

    const items = order.items || []
    const args: string[] = [
      PRINTER_SCRIPT,
      '--template', 'receipt',
      '--title', `造型师助手（铜仁市碧江区店） · 销售小票`,
    ]
    for (const it of items) {
      args.push('--item', `${it.quantity || 1}|${it.productName || '商品'}|${Number(it.price || 0).toFixed(2)}`)
    }
    args.push(
      '--total', String(order.finalAmount || order.totalAmount || 0),
      '--section', `订单号: ${order.orderNo || order.id}`,
      '--section', `取货码: ${order.pickupCode || '-'}`,
      '--section', `核销员: ${staffName}`,
      '--section', `支付方式: ${payMethod}`,
      '--section', `下单时间: ${new Date(order.createdAt ? (order.createdAt.includes('Z') || order.createdAt.includes('+') ? order.createdAt : order.createdAt + 'Z') : Date.now()).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })}`,
      '--footer', '地址: 铜仁市碧江区干群路与清水大道交汇处东北50米 · 谢谢惠顾',
      '--copies', '1',
    )
    const child = spawn(PRINTER_VENV, args, {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    child.stdout?.on('data', (d: any) => console.log('[receipt:out]', String(d).trim()))
    child.stderr?.on('data', (d: any) => console.warn('[receipt:err]', String(d).trim()))
    child.on('exit', (code: any) => console.log(`[receipt:done] exit code=${code}`))
    child.unref()
    console.log('[receipt] spawn pid:', child.pid)
  } catch (e: any) {
    console.warn('[receipt] spawn failed:', e.message)
  }
}