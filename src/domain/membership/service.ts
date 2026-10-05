/**
 * 会员系统核心逻辑 — 一劳永逸基础（2026-06-25 by 清禾）
 *
 * 核心：
 *   - 唯一数据源 = User.role
 *   - 唯一触发点 = 消费完成（Order 写入）
 *   - 唯一升级逻辑 = computeRole(totalSpent)
 *   - 自动同步，不靠人
 *
 * 实现：
 *   - 用 Prisma 的 $queryRaw / $executeRaw（绕开 schema 验证）
 *   - 任何地方需要“会员等级”都走这个文件
 *   - 任何地方需要“升级”都调 onOrderCompleted
 *
 * 注意：客户端组件不能 import 本文件（依赖 better-sqlite3）
 * 客户端要 import ./membership-tier（纯函数版）
 */

import { prisma } from '@/lib/db'

// Re-export 纯函数版（client-safe）
export { MEMBERSHIP_TIERS, computeRole, nextTier } from './tier'
import { computeRole } from './tier'

/**
 * 触发升级:消费完成后调用(用 raw SQL 绕开 schema 验证)
 * 自动:
 *   1. 累加 Customer.totalSpent
 *   2. 算新等级
 *   3. 同步 User.role(按 phone)
 *   4. 记录 PointsLog 流水
 * 任何调用方都不用关心同步细节。
 */
export async function onOrderCompleted(params: {
  phone: string
  merchantId: string
  orderNo: string
  finalAmount: number
  customerName?: string
}): Promise<{
  upgraded: boolean
  from: string
  to: string
  totalSpent: number
  totalOrders: number
  pointsAdded: number
  newPointsBalance: number
} | null> {
  const { phone, merchantId, orderNo, finalAmount, customerName } = params

  if (!phone || !merchantId || !orderNo) {
    console.warn('[membership] missing required fields:', params)
    return null
  }

  try {
    // 1. 找/创建 Customer(raw SQL)
    const customerRows = await prisma.$queryRaw<any[]>`
      SELECT id, phone, nickname, totalSpent, totalOrders, points
      FROM Customer
      WHERE merchantId = ${merchantId} AND phone = ${phone}
      LIMIT 1
    `
    let customerId: string
    let oldTotalSpent = 0
    let oldTotalOrders = 0
    let oldPoints = 0

    if (customerRows.length === 0) {
      customerId = genId('c')
      await prisma.$executeRaw`
        INSERT INTO Customer (id, merchantId, phone, nickname, totalSpent, totalOrders, points, createdAt, updatedAt)
        VALUES (${customerId}, ${merchantId}, ${phone}, ${customerName || '顾客'}, 0, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `
    } else {
      customerId = customerRows[0].id
      oldTotalSpent = Number(customerRows[0].totalSpent || 0)
      oldTotalOrders = Number(customerRows[0].totalOrders || 0)
      oldPoints = Number(customerRows[0].points || 0)
    }

    // 2. 累加 + 算新等级
    const newTotalSpent = oldTotalSpent + finalAmount
    const newTotalOrders = oldTotalOrders + 1
    const newTier = computeRole(newTotalSpent)
    const pointsAdded = Math.floor(finalAmount * newTier.pointsRate)
    const newPointsBalance = oldPoints + pointsAdded

    // 3. 更新 Customer
    await prisma.$executeRaw`
      UPDATE Customer
      SET totalSpent = ${newTotalSpent},
          totalOrders = ${newTotalOrders},
          points = ${newPointsBalance},
          lastOrderAt = CURRENT_TIMESTAMP,
          updatedAt = CURRENT_TIMESTAMP
      WHERE id = ${customerId}
    `

    // 4. 找/创建 User(按 phone)
    const userRows = await prisma.$queryRaw<any[]>`
      SELECT id, phone, role, points FROM User WHERE phone = ${phone} LIMIT 1
    `
    const oldRole = userRows.length > 0 ? (userRows[0].role || '普通') : '普通'
    let userId: string

    if (userRows.length === 0) {
      userId = genId('u')
      await prisma.$executeRaw`
        INSERT INTO User (id, phone, nickname, avatar, role, points, createdAt, lastLoginAt)
        VALUES (${userId}, ${phone}, ${customerName || '顾客'}, '🌿', ${newTier.name}, ${newPointsBalance}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `
    } else {
      userId = userRows[0].id
      // 升级或同级:更新 role + points
      await prisma.$executeRaw`
        UPDATE User
        SET role = ${newTier.name}, points = ${newPointsBalance}
        WHERE id = ${userId}
      `
    }

    // 5. 记录积分流水
    const pointsLogId = genId('pl')
    await prisma.$executeRaw`
      INSERT INTO PointsLog (id, merchantId, userId, phone, delta, balance, type, refType, refId, description, createdAt)
      VALUES (
        ${pointsLogId},
        ${merchantId},
        ${userId},
        ${phone},
        ${pointsAdded},
        ${newPointsBalance},
        'earn',
        'order',
        ${orderNo},
        ${`订单 ${orderNo} 消费 ¥${finalAmount.toFixed(2)}`},
        CURRENT_TIMESTAMP
      )
    `

    return {
      upgraded: oldRole !== newTier.name,
      from: oldRole,
      to: newTier.name,
      totalSpent: newTotalSpent,
      totalOrders: newTotalOrders,
      pointsAdded,
      newPointsBalance,
    }
  } catch (error) {
    console.error('[membership] onOrderCompleted error:', error)
    return null
  }
}

/**
 * 工具函数:生成 ID
 */
export function genId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/**
 * 工具函数:生成订单号
 */
export function genOrderNo(): string {
  const ts = Date.now().toString()
  const rand = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0')
  return `ORD${ts}${rand}`
}
