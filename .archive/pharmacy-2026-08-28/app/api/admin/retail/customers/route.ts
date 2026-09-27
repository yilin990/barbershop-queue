/**
 * /api/admin/retail/customers — 会员查询/登记（2026-08-02 奕霖需求）
 *
 * GET: 按手机号查询会员
 *   query: ?phone=xxx
 *   返回: { customer: {phone, nickname, points, totalSpent, totalOrders, tier} } | { found: false }
 *
 * POST: 新建/更新会员（顾客报手机号时收银员手动登记）
 *   body: { phone, nickname?, action?: 'create' | 'lookup' }
 *   返回: { success, customer, action: 'created' | 'found' }
 *
 * 设计：
 *   - 用 Customer 表（芝林的 Customer 模型已存在）
 *   - 不强制要求昵称（顾客可能不愿说）
 *   - 找不到时自动创建（不阻塞收银流程）
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyStaffCookie } from '@/lib/staff-auth'
import { errorResponse, successResponse, AuthError } from '@/lib/error'

export const runtime = 'nodejs'

const DEFAULT_MERCHANT_CODE = 'G0001'

function computeTier(totalSpent: number): { name: string; rate: number } {
  if (totalSpent >= 5000) return { name: 'VIP', rate: 0.08 }
  if (totalSpent >= 2000) return { name: '金卡', rate: 0.06 }
  if (totalSpent >= 500) return { name: '银卡', rate: 0.05 }
  return { name: '普通', rate: 0.05 }
}

export async function GET(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get('cookie') || ''
    const staffAuth = verifyStaffCookie(cookieHeader)
    if (!staffAuth.success) {
      throw new AuthError(staffAuth.error || '店员未登录')
    }

    const { searchParams } = new URL(request.url)
    const phone = (searchParams.get('phone') || '').trim()
    if (!phone) throw new Error('phone 必填')

    const merchants = await prisma.$queryRaw<any[]>`
      SELECT id FROM Merchant WHERE code = ${DEFAULT_MERCHANT_CODE} LIMIT 1
    `
    if (merchants.length === 0) throw new Error('药房信息不存在')
    const merchantId = merchants[0].id

    const customers = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id, phone, nickname, points, totalSpent, totalOrders, createdAt
       FROM Customer WHERE merchantId = ? AND phone = ? LIMIT 1`,
      merchantId, phone
    )

    if (customers.length === 0) {
      // ⭐ 清禾 2026-08-02 15:31 奕霖反馈：POS 查不到用户名称（因为 User 表有但 Customer 表没）
      // 回退到 User 表，查到的话告诉收银员「该用户已注册，自动创建会员」
      const userRows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id, phone, nickname, avatar, points, createdAt FROM User WHERE phone = ? LIMIT 1`,
        phone
      )
      if (userRows.length > 0) {
        const u = userRows[0]
        return successResponse({
          found: false,
          source: 'user_only',
          message: '该用户已登录注册，未开通会员卡',
          userInfo: {
            phone: u.phone,
            nickname: u.nickname,
            avatar: u.avatar,
            points: u.points,
          },
        })
      }
      return successResponse({ found: false, message: '未注册会员，可手动创建' })
    }

    const c = customers[0]
    const tier = computeTier(c.totalSpent || 0)
    return successResponse({
      found: true,
      customer: {
        ...c,
        tier: tier.name,
        earnRate: tier.rate,
      },
    })
  } catch (e) {
    return errorResponse(e)
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get('cookie') || ''
    const staffAuth = verifyStaffCookie(cookieHeader)
    if (!staffAuth.success) {
      throw new AuthError(staffAuth.error || '店员未登录')
    }

    const body = await request.json()
    const phone = (body.phone || '').toString().trim()
    const nickname = (body.nickname || `顾客${phone.slice(-4)}`).toString().trim()

    if (!phone) throw new Error('phone 必填')
    if (!/^1\d{10}$/.test(phone)) throw new Error('手机号格式错误（11位，1开头）')

    const merchants = await prisma.$queryRaw<any[]>`
      SELECT id FROM Merchant WHERE code = ${DEFAULT_MERCHANT_CODE} LIMIT 1
    `
    if (merchants.length === 0) throw new Error('药房信息不存在')
    const merchantId = merchants[0].id

    // 检查是否已存在
    const existing = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id, phone, nickname, points, totalSpent, totalOrders FROM Customer
       WHERE merchantId = ? AND phone = ? LIMIT 1`,
      merchantId, phone
    )

    if (existing.length > 0) {
      const c = existing[0]
      const tier = computeTier(c.totalSpent || 0)
      return successResponse({
        action: 'found',
        customer: { ...c, tier: tier.name, earnRate: tier.rate },
      })
    }

    // 创建新会员
    const id = `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    await prisma.$executeRawUnsafe(
      `INSERT INTO Customer (id, merchantId, phone, nickname, totalSpent, totalOrders, points, status, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, 0, 0, 0, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      id, merchantId, phone, nickname
    )

    // 写 AuditLog
    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO AuditLog (id, merchantId, actorType, actorId, action, target, description, createdAt)
         VALUES (?, ?, 'staff', ?, 'create_customer', ?, 'POS 收银员登记新会员', CURRENT_TIMESTAMP)`,
        `al_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        merchantId, staffAuth.pin, phone
      )
    } catch {}

    const tier = computeTier(0)
    return successResponse({
      action: 'created',
      customer: {
        id, phone, nickname, points: 0, totalSpent: 0, totalOrders: 0,
        tier: tier.name, earnRate: tier.rate,
      },
    })
  } catch (e) {
    return errorResponse(e)
  }
}