import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_MERCHANT_ID } from '@/lib/admin-merchant'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

/**
 * GET /api/admin/members
 * 会员列表（拉 Customer 表）
 * 0-1 阶段：返回所有客户，按 totalSpent 降序
 */
export async function GET(request: NextRequest) {
  try {
    // raw SQL 带 status 字段（schema validation 失败，prisma client 没这些字段）
    const customers: any[] = await prisma.$queryRaw`
      SELECT id, phone, nickname, totalSpent, totalOrders, points, status
      FROM Customer
      WHERE merchantId = ${ADMIN_MERCHANT_ID}
      ORDER BY totalSpent DESC
      LIMIT 200
    `

    const members = customers.map((c) => {
      // 等级规则：< 200 普通 / 200-500 银卡 / 500-2000 金卡 / >= 2000 VIP
      let level: '普通' | '银卡' | '金卡' | 'VIP' = '普通'
      if (c.totalSpent >= 2000) level = 'VIP'
      else if (c.totalSpent >= 500) level = '金卡'
      else if (c.totalSpent >= 200) level = '银卡'

      return {
        id: c.id,
        phone: c.phone,
        nickname: c.nickname,
        totalSpent: c.totalSpent,
        totalOrders: c.totalOrders,
        points: c.points,
        level,
        status: c.status || 'active',
        lastOrderAt: null,
      }
    })

    return NextResponse.json({ success: true, members })
  } catch (error: any) {
    console.error('[admin/members] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
