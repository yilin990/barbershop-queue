import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { ADMIN_MERCHANT_ID } from '@/lib/admin-merchant'
import { verifyAdminRequest, unauthorized } from '@/lib/admin-jwt-auth'

export const runtime = 'nodejs'


/**
 * GET /api/admin/users-list
 * 全量用户列表（跟 members 区别：这里返回 createdAt/lastOrderAt 等元数据）
 */
export async function GET(request: NextRequest) {
  try {
    const auth = verifyAdminRequest(request)
    if (!auth.ok) return unauthorized(auth)

    const users: any[] = await prisma.$queryRaw`
      SELECT id, phone, nickname, totalSpent, totalOrders, points, status, createdAt,
             (SELECT MAX(createdAt) FROM "Order" o WHERE o.customerId = Customer.id) AS lastOrderAt
      FROM Customer WHERE merchantId = ${ADMIN_MERCHANT_ID}
      ORDER BY createdAt DESC
      LIMIT 500
    `

    const formatted = users.map((u: any) => ({
      id: u.id,
      phone: u.phone,
      nickname: u.nickname,
      totalSpent: u.totalSpent,
      totalOrders: u.totalOrders,
      points: u.points,
      status: (u.status || 'active') as 'active' | 'deactivated',
      createdAt: u.createdAt?.toISOString?.() || u.createdAt,
      lastOrderAt: u.lastOrderAt?.toISOString?.() || u.lastOrderAt || null,
    }))

    return NextResponse.json({ success: true, users: formatted })
  } catch (error: any) {
    console.error('[admin/users-list]', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}