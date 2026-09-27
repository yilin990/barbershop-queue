/**
 * /api/admin/retail/pos/checkout — POS 收银台结账（2026-08-02 清禾 Phase 1）
 *
 * 流程：
 *   1. 店员 PIN 登录（cookie 验证）
 *   2. 扫商品 / 搜索 → 加购车 → 结账
 *   3. 自动生成 Order + OrderItem + pickupCode（6 位参考号）
 *   4. 立即标记 delivered + pickedUpAt（线下当场拿走）
 *   5. 扣库存 + 自动发积分（如果顾客绑定）
 *
 * 不接支付（合规闭环）— 顾客到店扫码下单走 pickup 流程
 * POS 走"直接生成订单 + 现金/微信记账"（不接支付牌照）
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyStaffCookie } from '@/lib/staff-auth'
import { generatePickupCode } from '@/lib/pickup-code'
import { errorResponse, successResponse, AuthError } from '@/lib/error'

export const runtime = 'nodejs'

const DEFAULT_MERCHANT_CODE = '0005'
const PICKUP_CODE_EXPIRES_DAYS = 7

function genOrderNo(): string {
  const now = new Date()
  const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
  const rand = Math.floor(Math.random() * 100000).toString().padStart(5, '0')
  return `ORD${ymd}${rand}`
}

export async function POST(request: NextRequest) {
  try {
    // 1. 验证店员 cookie
    const cookieHeader = request.headers.get('cookie') || ''
    const staffAuth = verifyStaffCookie(cookieHeader)
    if (!staffAuth.success) {
      throw new AuthError(staffAuth.error || '店员未登录，请先输入 PIN')
    }

    const body = await request.json()
    const { items, customerPhone, payMethod, remark, pointsUsed, couponCode, customerType } = body || {}
    const pointsToUse = Math.max(0, Math.min(999999, parseInt(pointsUsed || 0)))
    const couponCodeStr = (couponCode || '').toString().trim().toUpperCase()
    // ⭐ MEMORY 183 — 会员分级：customerType='chronic' (慢病) → 银卡起；'normal' (普通) → 不动
    const isChronic = customerType === 'chronic'

    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('请选择至少一件商品')
    }
    for (const it of items) {
      if (!it.productId || !it.quantity || it.quantity <= 0) {
        throw new Error('商品格式错误（需要 productId + quantity）')
      }
    }

    // 2. 拿 merchant
    const merchants = await prisma.$queryRaw<any[]>`
      SELECT id, name, pointsRate FROM Merchant WHERE code = ${DEFAULT_MERCHANT_CODE} LIMIT 1
    `
    if (merchants.length === 0) throw new Error('药房信息不存在')
    const merchant = merchants[0]

    // 3. 拿商品详情 + 计算金额（同时校验库存）
    const productIds = items.map((it: any) => it.productId)
    const placeholders = productIds.map(() => '?').join(',')
    const products = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id, productCode, name, shortName, spec, price, memberPrice, stock, image, approvalNo
       FROM Product WHERE id IN (${placeholders})`,
      ...productIds
    )
    const productMap = new Map<string, any>(products.map((p: any) => [p.id, p]))

    // 3.1 先找 customer（需要在商品计算前，因为积分抵扣要用 customer.points）
    let customerId: string | null = null
    let customerName: string | null = null
    let customerCurrentPoints = 0
    if (customerPhone) {
      const customers = await prisma.$queryRaw<any[]>`
        SELECT id, nickname, points, chronicDisease, tierOverride FROM Customer
        WHERE merchantId = ${merchant.id} AND phone = ${customerPhone} LIMIT 1
      `
      if (customers.length > 0) {
        customerId = customers[0].id
        customerName = customers[0].nickname || null
        customerCurrentPoints = Number(customers[0].points || 0)
      }
    }

    let totalAmount = 0
    let finalAmount = 0
    const orderItems: any[] = []
    for (const it of items) {
      const p = productMap.get(it.productId)
      if (!p) throw new Error(`商品 ${it.productId} 不存在`)
      const qty = Math.max(1, parseInt(it.quantity))
      if (p.stock !== null && p.stock < qty) {
        throw new Error(`${p.name} 库存不足（剩余 ${p.stock || 0}）`)
      }
      // ⭐ MEMORY 183 — 芝林 SaaS 试运行 v2.0：处方药整条移出线上体系
      // 国药准字 H 开头 = 处方药（Rx），POS 不得录入
      if (p.approvalNo && String(p.approvalNo).startsWith('国药准字H')) {
        throw new Error(`${p.name} 是处方药，本系统不录入。请到门店原收银系统录入。`)
      }
      const unitPrice = (p.memberPrice && p.memberPrice > 0) ? p.memberPrice : p.price
      const subtotal = Number((unitPrice * qty).toFixed(2))
      totalAmount += subtotal
      finalAmount += subtotal
      orderItems.push({
        productId: p.id,
        productName: p.name,
        productSpec: p.spec || null,
        productUnit: null,
        productImage: p.image || null,
        price: unitPrice,
        quantity: qty,
        subtotal,
      })
    }

    // 3.5 处理积分抵扣（⭐ 2026-08-02 奕霖需求）
    let pointsValue = 0
    let actualPointsUsed = 0
    // customerCurrentPoints 已在 3.1 块查到
    if (customerId && pointsToUse > 0) {
      // customerCurrentPoints 已经在前面查过了，直接用

      if (pointsToUse > customerCurrentPoints) {
        throw new Error(`积分不足（你有 ${customerCurrentPoints} 分，要用 ${pointsToUse} 分）`)
      }

      // 奕霖设计：1 元 = 5 分获取，50 分 = 1 元抵扣（更划算）
      // 单笔最多抵扣 50% finalAmount（防止 100% 抵扣让药房没钱赚）
      const MAX_REDEEM_PERCENT = 0.5
      const maxDeductByAmount = Math.floor(finalAmount * MAX_REDEEM_PERCENT * 100)  // 元 → 分
      const maxDeductByUser = customerCurrentPoints
      const maxDeduct = Math.min(maxDeductByAmount, maxDeductByUser)
      actualPointsUsed = Math.min(pointsToUse, maxDeduct)
      // 1 分 = 0.02 元（奕霖设计：50 分抵 1 元）
      pointsValue = Number((actualPointsUsed * 0.02).toFixed(2))
      finalAmount = Number((finalAmount - pointsValue).toFixed(2))
    }

    // 3.6 处理优惠券（奕霖 2026-08-02：用户账号里领取的券）
    let couponValue = 0
    let couponUsedId = null
    let couponUsedName = null
    if (customerId && couponCodeStr) {
      const coupons = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id, name, value, minSpend, expiresAt, status FROM Coupon
         WHERE phone = ? AND code = ? AND status = 'unused' LIMIT 1`,
        customerPhone, couponCodeStr
      )
      if (coupons.length === 0) {
        throw new Error('优惠券无效、已使用或不属于该用户')
      }
      const coupon = coupons[0]
      if (new Date(coupon.expiresAt).getTime() < Date.now()) {
        throw new Error('优惠券已过期')
      }
      if (finalAmount < coupon.minSpend) {
        throw new Error(`优惠券要求最低消费 ¥${coupon.minSpend}，当前 ¥${finalAmount.toFixed(2)}`)
      }
      couponValue = Number(coupon.value)
      couponUsedId = coupon.id
      couponUsedName = coupon.name
      finalAmount = Number(Math.max(0, finalAmount - couponValue).toFixed(2))
    }

    // 4. 生成订单号 + 取货码
    const orderNo = genOrderNo()
    const pickupCode = await generatePickupCode(DEFAULT_MERCHANT_CODE)
    const pickupExpiresAt = new Date(Date.now() + PICKUP_CODE_EXPIRES_DAYS * 24 * 60 * 60 * 1000)
    const now = new Date().toISOString()

    // 5. 事务性写入（Order + OrderItems + 扣库存 + 发积分）
    const orderId = `ord_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const payMethodLabel: Record<string, string> = {
      cash: '现金',
      wechat: '微信',
      alipay: '支付宝',
      card: '银行卡',
      pos_member: '会员卡',
    }
    const finalRemark = [
      'POS 收银',
      `支付方式：${payMethodLabel[payMethod] || payMethod || '未选'}`,
      `店员 PIN：${staffAuth.pin}`,
      remark ? `备注：${remark}` : '',
    ].filter(Boolean).join(' | ')

    await prisma.$executeRawUnsafe(
      `INSERT INTO "Order"
        (id, merchantId, customerId, orderNo, totalAmount, discountAmount, pointsUsed, pointsValue,
         finalAmount, deliveryType, pickupCode, pickupExpiresAt, pickedUpAt, pickedUpBy,
         status, paidAt, completedAt, remark, source, posRecordedAmount, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      orderId,
      merchant.id,
      customerId,
      orderNo,
      totalAmount,
      0,
      0,
      0,
      finalAmount,
      'pickup',
      pickupCode,
      pickupExpiresAt.toISOString(),
      now,
      staffAuth.pin,
      'delivered',
      now,
      now,
      finalRemark,
      'pos-store',  // ⭐ MEMORY 183 — 标记订单来源为 POS 门店录入
      finalAmount,   // posRecordedAmount = OTC 实付金额（不含 Rx）
      now,
      now
    )

    // OrderItems
    for (const oi of orderItems) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO OrderItem
          (id, orderId, productId, productName, productSpec, productUnit, productImage, price, quantity, subtotal)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        `oi_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        orderId,
        oi.productId,
        oi.productName,
        oi.productSpec,
        oi.productUnit,
        oi.productImage,
        oi.price,
        oi.quantity,
        oi.subtotal,
      )

      // 扣库存
      await prisma.$executeRawUnsafe(
        `UPDATE Product SET stock = stock - ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
        oi.quantity,
        oi.productId,
      )
    }

    // 6. 自动发积分（奕霖 2026-08-03 22:27 改：1 元 = 4 分，180 天过期）
    let pointsEarned = 0
    const POINTS_EXPIRE_DAYS = 180
    if (customerId) {
      // ⭐ 奕霖 2026-08-03 22:27 改：消费 1 元 = 4 分（之前是 5）
      pointsEarned = Math.floor(finalAmount * 4)
      const newBalance = customerCurrentPoints - actualPointsUsed + pointsEarned
      if (pointsEarned > 0 || actualPointsUsed > 0) {
        // 更新 Customer 积分（累加新获得 + 扣除使用）
        await prisma.$executeRawUnsafe(
          `UPDATE Customer SET points = ?, totalOrders = totalOrders + 1, totalSpent = totalSpent + ?, lastOrderAt = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
          newBalance,
          finalAmount,
          now,
          customerId,
        )
      }
      // 写 earn 流水
      if (pointsEarned > 0) {
        const expiresAt = new Date(Date.now() + POINTS_EXPIRE_DAYS * 86400 * 1000).toISOString()
        await prisma.$executeRawUnsafe(
          `INSERT INTO PointsLog
            (id, merchantId, customerId, type, delta, amount, balance, reason, orderId, expiresAt, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          `pl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          merchant.id,
          customerId,
          'earn',
          pointsEarned,
          pointsEarned,
          newBalance,
          `POS 收银获得：${orderNo}`,
          orderId,
          expiresAt,
          now,
        )
      }
      // 写 spend 流水（积分抵扣）
      if (actualPointsUsed > 0) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO PointsLog
            (id, merchantId, customerId, type, delta, amount, balance, reason, orderId, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          `pl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          merchant.id,
          customerId,
          'spend',
          -actualPointsUsed,
          actualPointsUsed,
          newBalance,
          `POS 收银抵扣：${orderNo}（抵 ¥${pointsValue}）`,
          orderId,
          now,
        )
      }
    }

    // 7.5 标记优惠券已用
    if (couponUsedId) {
      try {
        await prisma.$executeRawUnsafe(
          `UPDATE Coupon SET status = 'used', usedAt = ?, userId = ? WHERE id = ?`,
          now, customerId, couponUsedId
        )
      } catch (err) {
        console.error('[pos/checkout] Coupon used update failed:', err)
      }
    }

    // 7. AuditLog
    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO AuditLog
          (id, merchantId, actorType, actorId, action, target, description, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        `al_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        merchant.id,
        'staff',
          staffAuth.pin,
        'pos_checkout',
        orderId,
        `POS 收银 ${orderNo} ¥${finalAmount.toFixed(2)}（${items.length} 件商品）${customerPhone ? ` 关联顾客 ${customerPhone}` : ''}`,
        now,
      )
    } catch (e) {
      // AuditLog 失败不阻塞结账
      console.error('[pos/checkout] AuditLog failed:', e)
    }

    // ⭐ 清禾 2026-08-02 15:31 奕霖反馈：POS 更新 Customer.points 后，/me 看不到
    // 修复：结账成功后同步 User 表（让 /me 显示最新积分）
    // ⭐ MEMORY 183 — 会员分级：慢病用户 → 银卡起（同步 Customer + User）
    if (customerId && customerPhone) {
      try {
        // 1. 先更新 Customer（积分 + 可能的慢病标签 + tierOverride）
        if (isChronic) {
          await prisma.$executeRawUnsafe(
            `UPDATE Customer SET points = ?, chronicDisease = 1, tierOverride = '银卡', updatedAt = ? WHERE id = ?`,
            customerCurrentPoints - actualPointsUsed + pointsEarned,
            now,
            customerId
          )
        } else {
          await prisma.$executeRawUnsafe(
            `UPDATE Customer SET points = ?, updatedAt = ? WHERE id = ?`,
            customerCurrentPoints - actualPointsUsed + pointsEarned,
            now,
            customerId
          )
        }

        // 2. 同步 User 表（让 /me 显示最新积分 + 等级）
        // 修复 bug：不再依赖 finalAmount > 0（0 元订单不该清零积分）
        const newUserPoints = customerCurrentPoints - actualPointsUsed + pointsEarned
        await prisma.$executeRawUnsafe(
          `UPDATE User SET points = ?, lastLoginAt = CURRENT_TIMESTAMP WHERE phone = ?`,
          newUserPoints,
          customerPhone
        )
        // 如果 User 不存在（POS 注册的新会员），自动创建 User 记录
        const userExists = await prisma.$queryRawUnsafe<any[]>(
          `SELECT id FROM User WHERE phone = ? LIMIT 1`, customerPhone
        )
        if (userExists.length === 0) {
          await prisma.$executeRawUnsafe(
            `INSERT INTO User (id, phone, nickname, points, role, createdAt, lastLoginAt) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            `u_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            customerPhone,
            customerName || `顾客${customerPhone.slice(-4)}`,
            newUserPoints,
            isChronic ? 'chronic' : 'normal'
          )
        } else if (isChronic) {
          // User 存在 + 是慢病 → 标记 User.role = 'chronic'
          await prisma.$executeRawUnsafe(
            `UPDATE User SET role = 'chronic' WHERE phone = ?`,
            customerPhone
          )
        }
      } catch (e) {
        console.error('[pos/checkout] User/Customer sync failed:', e)
      }
    }

    return successResponse({
      success: true,
      order: {
        id: orderId,
        orderNo,
        pickupCode,
        finalAmount,
        totalAmount,
        pointsUsed: actualPointsUsed,
        pointsValue,
        couponUsed: couponUsedId ? { id: couponUsedId, name: couponUsedName, value: couponValue } : null,
        itemCount: orderItems.length,
        status: 'delivered',
        pickedUpAt: now,
        pickupExpiresAt: pickupExpiresAt.toISOString(),
        customerName,
        items: orderItems,
      },
      pointsEarned,
      message: `结账成功！订单号 ${orderNo}，取货码 ${pickupCode}${actualPointsUsed > 0 ? `，积分抵扣 ¥${pointsValue}` : ''}${couponUsedId ? `，优惠券抵 ¥${couponValue}` : ''}`,
    })
  } catch (e) {
    return errorResponse(e)
  }
}
