/**
 * /api/coupons/claim - 领取优惠券（一键入库）
 *
 * POST { phone, name, value, minSpend, expiresAtDays? }
 * - phone: 用户手机号（用于绑定）
 * - name: 券名（如"满 200 减 25"）
 * - value: 券面值（25 = ¥25）
 * - minSpend: 最低消费（如 200）
 * - expiresAtDays: 多少天后过期（默认 30）
 *
 * 简化：直接创建一个 unused 的 Coupon 行
 * 不做库存、不做限领（活动页 demo 阶段够用）
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { genId } from '@/domain/membership/service'

export const runtime = 'nodejs'

const DEFAULT_MERCHANT_CODE = 'G0001'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phone, name, value, minSpend = 0, expiresAtDays = 30 } = body

    if (!phone) {
      return NextResponse.json({ success: false, error: '缺少 phone' }, { status: 400 })
    }
    if (!name) {
      return NextResponse.json({ success: false, error: '缺少 name' }, { status: 400 })
    }
    if (typeof value !== 'number' || value <= 0) {
      return NextResponse.json({ success: false, error: 'value 必须是正数' }, { status: 400 })
    }

    // 找商户
    const merchants = await prisma.$queryRaw<any[]>`
      SELECT id FROM Merchant WHERE code = ${DEFAULT_MERCHANT_CODE} LIMIT 1
    `
    if (merchants.length === 0) {
      return NextResponse.json({ success: false, error: '商户不存在' }, { status: 404 })
    }
    const merchantId = merchants[0].id

    // 生成 code（短且唯一）
    const code = `C${Date.now().toString(36).toUpperCase().slice(-6)}${Math.random().toString(36).slice(2, 5).toUpperCase()}`
    const couponId = genId('cp')
    const expiresAt = new Date(Date.now() + expiresAtDays * 24 * 60 * 60 * 1000).toISOString()

    await prisma.$executeRaw`
      INSERT INTO Coupon (id, merchantId, phone, code, name, type, value, minSpend, status, expiresAt, createdAt)
      VALUES (${couponId}, ${merchantId}, ${phone}, ${code}, ${name}, 'discount', ${value}, ${minSpend}, 'unused', ${expiresAt}, CURRENT_TIMESTAMP)
    `

    return NextResponse.json({
      success: true,
      coupon: {
        id: couponId,
        code,
        name,
        value,
        minSpend,
        status: 'unused',
        expiresAt,
      },
    })
  } catch (error: any) {
    console.error('[coupons/claim] error:', error)
    return NextResponse.json(
      { success: false, error: '服务器错误', detail: error?.message },
      { status: 500 }
    )
  }
}

/** GET: 查用户的优惠券列表 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const phone = searchParams.get('phone')

    if (!phone) {
      return NextResponse.json({ success: false, error: '缺少 phone' }, { status: 400 })
    }

    const coupons = await prisma.$queryRaw<any[]>`
      SELECT * FROM Coupon
      WHERE phone = ${phone}
      ORDER BY createdAt DESC
      LIMIT 50
    `

    return NextResponse.json({ success: true, coupons })
  } catch (error: any) {
    console.error('[coupons/claim] GET error:', error)
    return NextResponse.json(
      { success: false, error: '服务器错误', detail: error?.message },
      { status: 500 }
    )
  }
}
