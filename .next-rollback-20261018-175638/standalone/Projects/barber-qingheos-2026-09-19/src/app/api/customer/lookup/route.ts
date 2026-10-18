import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

/**
 * GET /api/customer/lookup?merchantCode=0005&phone=13900000001
 *
 * 顾客查自己的会员信息（积分、订单数、消费总额、等级）
 * 这是"私域"的核心：商户可以引导用户随时查"我的积分"
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const merchantCode = searchParams.get('merchantCode') || 'G0001'
    const phone = searchParams.get('phone')

    if (!phone) {
      return NextResponse.json(
        { success: false, error: '请提供手机号' },
        { status: 400 }
      )
    }

    if (!/^1[3-9]\d{9}$/.test(phone)) {
      return NextResponse.json(
        { success: false, error: '手机号格式不正确' },
        { status: 400 }
      )
    }

    // 找商户
    const merchants = await prisma.$queryRaw<any[]>`
      SELECT id, code, name, shortName, logo, primaryColor, accentColor,
             pointsRate, pointValue, minPointsRedeem
      FROM Merchant WHERE code = ${merchantCode} LIMIT 1
    `
    if (merchants.length === 0) {
      return NextResponse.json(
        { success: false, error: '商户不存在' },
        { status: 404 }
      )
    }
    const merchant = merchants[0]

    // 找顾客
    const customers = await prisma.$queryRaw<any[]>`
      SELECT id, phone, nickname, avatar,
             totalSpent, totalOrders, points, tags,
             createdAt, lastOrderAt
      FROM Customer
      WHERE merchantId = ${merchant.id} AND phone = ${phone}
      LIMIT 1
    `

    if (customers.length === 0) {
      return NextResponse.json({
        success: true,
        isMember: false,
        message: '还不是会员，预约一次即可成为会员',
      })
    }

    const customer = customers[0]

    // 找最近 10 条订单
    const orders = await prisma.$queryRaw<any[]>`
      SELECT id, orderNo, totalAmount, finalAmount, status, createdAt, remark
      FROM "Order"
      WHERE customerId = ${customer.id}
      ORDER BY createdAt DESC LIMIT 10
    `

    // 找最近 5 条积分流水
    const pointsLogs = await prisma.$queryRaw<any[]>`
      SELECT delta, balance, type, description, createdAt
      FROM PointsLog
      WHERE phone = ${phone} AND merchantId = ${merchant.id}
      ORDER BY createdAt DESC LIMIT 5
    `

    // 算会员等级（基于消费总额）
    const tier = computeTier(customer.totalSpent)

    return NextResponse.json({
      success: true,
      isMember: true,
      merchant: {
        id: merchant.id,
        code: merchant.code,
        name: merchant.name,
        shortName: merchant.shortName,
        logo: merchant.logo,
        primaryColor: merchant.primaryColor,
        accentColor: merchant.accentColor,
      },
      customer: {
        id: customer.id,
        phone: customer.phone,
        nickname: customer.nickname,
        avatar: customer.avatar,
        totalSpent: customer.totalSpent,
        totalOrders: customer.totalOrders,
        points: customer.points,
        lastOrderAt: customer.lastOrderAt,
        memberSince: customer.createdAt,
      },
      tier,
      recentOrders: orders,
      recentPointsLogs: pointsLogs,
    })
  } catch (e: any) {
    console.error('[customer/lookup]', e)
    return NextResponse.json(
      { success: false, error: '服务器错误: ' + (e?.message ?? 'unknown') },
      { status: 500 }
    )
  }
}

function computeTier(totalSpent: number) {
  if (totalSpent >= 5000) {
    return { level: 'gold', name: '黄金会员', nextThreshold: null, discount: 0.95 }
  }
  if (totalSpent >= 2000) {
    return { level: 'silver', name: '白银会员', nextThreshold: 5000, discount: 0.97 }
  }
  if (totalSpent >= 500) {
    return { level: 'bronze', name: '青铜会员', nextThreshold: 2000, discount: 0.98 }
  }
  return { level: 'regular', name: '普通会员', nextThreshold: 500, discount: 1.0 }
}
