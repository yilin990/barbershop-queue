import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

/**
 * GET /api/coupons/my?merchantCode=0005&phone=13800138000
 * 顾客查自己未使用的优惠券
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const merchantCode = searchParams.get('merchantCode') || 'G0001'
    const phone = searchParams.get('phone')

    if (!phone) {
      return NextResponse.json({ success: false, error: '请提供手机号' }, { status: 400 })
    }

    const merchants = await prisma.$queryRaw<any[]>`
      SELECT id FROM Merchant WHERE code = ${merchantCode} LIMIT 1
    `
    if (merchants.length === 0) {
      return NextResponse.json({ success: false, error: '商户不存在' }, { status: 404 })
    }
    const merchantId = merchants[0].id

    const coupons = await prisma.$queryRaw<any[]>`
      SELECT id, code, name, type, value, minSpend, expiresAt, createdAt
      FROM Coupon
      WHERE merchantId = ${merchantId}
        AND phone = ${phone}
        AND status = 'unused'
        AND (expiresAt IS NULL OR expiresAt > datetime('now'))
      ORDER BY minSpend ASC
    `

    return NextResponse.json({ success: true, coupons })
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: '服务器错误: ' + (e?.message ?? 'unknown') },
      { status: 500 }
    )
  }
}
