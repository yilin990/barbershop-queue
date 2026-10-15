/**
 * 取货码生成工具（2026-06-30 by 清禾）
 *
 * 核心：6 位数字，唯一，7 天有效期
 * 设计：避金融牌照，合规闭环
 *   - AI 下单 → 生成取货码
 *   - 飞书/短信通知用户
 *   - 用户到店出示取货码
 *   - 店员核销 → 到店支付
 *
 * 安全：
 *   - 6 位数字 = 1/1000000 概率被猜中
 *   - 防爆破：加 rate limit（每小时最多试 5 次）
 *   - 过期失效：7 天后必须重新下单
 */

import { prisma } from '@/lib/db'

/** 取货码有效期（毫秒） */
export const PICKUP_CODE_EXPIRES_MS = 7 * 24 * 60 * 60 * 1000 // 7 天

/** 生成 6 位数字取货码（确保唯一） */
export async function generatePickupCode(merchantCode: string): Promise<string> {
  // 最多尝试 10 次避免极端冲突
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = Math.floor(100000 + Math.random() * 900000).toString()
    // 查是否已存在
    const existing = await prisma.$queryRaw<any[]>`
      SELECT id FROM "Order" WHERE pickupCode = ${code} LIMIT 1
    `
    if (existing.length === 0) {
      return code
    }
  }
  // 极端情况：连续 10 次冲突
  throw new Error('取货码生成失败，请重试')
}

/** 核销取货码 */
export async function redeemPickupCode(
  code: string,
  staffId: string
): Promise<{ success: boolean; order?: any; error?: string }> {
  if (!/^\d{6}$/.test(code)) {
    return { success: false, error: '取货码格式错误（需 6 位数字）' }
  }

  // 查订单
  const orders = await prisma.$queryRaw<any[]>`
    SELECT * FROM "Order"
    WHERE pickupCode = ${code}
    LIMIT 1
  `
  if (orders.length === 0) {
    return { success: false, error: '取货码不存在' }
  }

  const order = orders[0]

  // 检查是否已核销
  if (order.pickedUpAt) {
    return { success: false, error: '取货码已使用' }
  }

  // 检查是否已取消（2026-07-14 19:45 安全补）
  if (order.status === 'cancelled') {
    return { success: false, error: '订单已取消，取货码作废' }
  }

  // 检查是否过期
  if (order.pickupExpiresAt && new Date(order.pickupExpiresAt) < new Date()) {
    return { success: false, error: '取货码已过期，请重新下单' }
  }

  // 标记核销
  await prisma.$executeRaw`
    UPDATE "Order"
    SET pickedUpAt = CURRENT_TIMESTAMP, pickedUpBy = ${staffId},
        status = 'delivered', completedAt = CURRENT_TIMESTAMP,
        updatedAt = CURRENT_TIMESTAMP
    WHERE id = ${order.id}
  `

  return {
    success: true,
    order: {
      id: order.id,
      orderNo: order.orderNo,
      finalAmount: order.finalAmount,
      itemCount: order.items?.length || 0,
    },
  }
}

/** 格式化过期时间给用户看 */
export function formatPickupExpiry(expiresAt: Date | string): string {
  const d = new Date(expiresAt)
  const now = new Date()
  const diffMs = d.getTime() - now.getTime()
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000))

  if (diffDays < 0) return '已过期'
  if (diffDays === 0) return '今日到期'
  if (diffDays === 1) return '明日到期'
  return `${diffDays} 天后过期`
}
