import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { ADMIN_MERCHANT_ID } from '@/lib/admin-merchant'
import { verifyAdminRequest, unauthorized } from '@/lib/admin-jwt-auth'

export const runtime = 'nodejs'


export async function GET(request: NextRequest) {
  const auth = verifyAdminRequest(request)
  if (!auth.ok) return unauthorized(auth)
  try {
    const merchants = await prisma.$queryRawUnsafe<any[]>(`
      SELECT m.id, m.name, m.shortName, m.phone, m.address, m.businessHours,
             m.primaryColor, m.accentColor, m.pointsRate, m.pointValue, m.minPointsRedeem, m.status,
             (SELECT COUNT(*) FROM Customer WHERE merchantId = m.id) AS memberCount,
             (SELECT COUNT(*) FROM "Order" WHERE merchantId = m.id) AS orderCount,
             (SELECT COUNT(*) FROM Product WHERE merchantId = m.id AND status='active') AS productCount
      FROM Merchant m
      ORDER BY m.createdAt DESC
    `)
    return NextResponse.json({
      success: true,
      total: merchants.length,
      merchants: merchants.map((m) => ({
        ...m,
        memberCount: Number(m.memberCount || 0),
        orderCount: Number(m.orderCount || 0),
        productCount: Number(m.productCount || 0),
        pointsRate: Number(m.pointsRate || 0),
        pointValue: Number(m.pointValue || 0),
        minPointsRedeem: Number(m.minPointsRedeem || 0),
      })),
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}
