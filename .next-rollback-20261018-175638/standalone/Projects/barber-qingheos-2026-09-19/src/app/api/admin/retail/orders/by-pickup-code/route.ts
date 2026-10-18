/**
 * /api/admin/retail/orders/by-pickup-code — 收银员用取货码加载用户订单（2026-08-03 奕霖）
 *
 * GET: 按 6 位取货码查找订单 + 客户 + 商品明细
 *   query: ?code=904216
 *   返回: { order, customer, items }
 *   - found=false 表示没找到 / 订单已取消 / 已完成
 *   - customer 可能为 null（用户被删除，但订单还在）
 *
 * 设计：
 *   - 取货码 6 位数字（Order.pickupCode）
 *   - 必须 merchantId=当前商家
 *   - 状态为 pending/confirmed/delivered（不取已 cancelled/completed）
 *
 * 用途：
 *   1. 用户在线下单 → 拿到取货码
 *   2. 到店 → 收银员输入取货码
 *   3. 系统自动加载用户 + 订单 → 跳过报手机号
 *   4. 收银员可以增减商品 → 完成订单
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { ADMIN_MERCHANT_ID } from '@/lib/admin-merchant'
import { verifyStaffCookie } from '@/lib/staff-auth'
import { errorResponse, successResponse, AuthError } from '@/lib/error'

export const runtime = 'nodejs'

const DEFAULT_MERCHANT_CODE = 'G0001'
const VALID_STATUSES = ['pending', 'confirmed', 'delivered', 'paid']

export async function GET(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get('cookie') || ''
    const staffAuth = verifyStaffCookie(cookieHeader)
    if (!staffAuth.success) {
      throw new AuthError(staffAuth.error || '店员未登录')
    }

    const { searchParams } = new URL(request.url)
    const code = (searchParams.get('code') || '').trim()

    // 6 位数字校验
    if (!/^\d{6}$/.test(code)) {
      throw new Error('取货码必须是 6 位数字')
    }

    // 拿 merchant
    const merchants = await prisma.$queryRaw<any[]>`
      SELECT id FROM Merchant WHERE code = ${DEFAULT_MERCHANT_CODE} LIMIT 1
    `
    if (merchants.length === 0) throw new Error('药房信息不存在')
    const merchantId = merchants[0].id

    // 查订单（带 customerId）
    const orders = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id, orderNo, customerId, totalAmount, discountAmount,
              pointsUsed, pointsValue, finalAmount, status, paidAt,
              pickupCode, pickupExpiresAt, deliveryType, createdAt
       FROM "Order"
       WHERE merchantId = ? AND pickupCode = ?
       LIMIT 1`,
      merchantId, code
    )

    if (orders.length === 0) {
      return successResponse({ found: false, message: '取货码不存在' })
    }
    const order = orders[0]

    // 检查状态
    if (!VALID_STATUSES.includes(order.status)) {
      return successResponse({
        found: false,
        status: order.status,
        message: order.status === 'cancelled' ? '订单已取消' :
                 order.status === 'completed' ? '订单已完成' :
                 `订单状态异常 (${order.status})`,
      })
    }

    // 检查过期
    if (order.pickupExpiresAt) {
      const expiresAt = new Date(order.pickupExpiresAt).getTime()
      if (Date.now() > expiresAt) {
        return successResponse({
          found: false,
          status: order.status,
          message: '取货码已过期',
        })
      }
    }

    // 查客户
    let customer = null
    if (order.customerId) {
      const customers = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id, phone, nickname, avatar, points, totalSpent, totalOrders
         FROM Customer WHERE id = ? LIMIT 1`,
        order.customerId
      )
      if (customers.length > 0) customer = customers[0]
    }

    // 查商品明细
    const items = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id, productId, productName, productSpec, productUnit,
              productImage, price, quantity, subtotal
       FROM OrderItem WHERE orderId = ?
       ORDER BY id ASC`,
      order.id
    )

    return successResponse({
      found: true,
      order,
      customer,
      items,
    })
  } catch (e) {
    return errorResponse(e)
  }
}
