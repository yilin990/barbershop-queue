/**
 * /api/merchant/stats - 商户主页真实数据
 *
 * ⭐ 2026-07-13 14:18 奕霖需求：首页品牌故事需接真实数据
 * 真实数据 = 商品数、会员数、订单数、好评率等
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { DEFAULT_MERCHANT_ID, resolveMerchantIdFromQuery } from '@/lib/merchant'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    // ⭐ 2026-10-15 清禾修：原来这里写死 MERCHANT_CODE='G0001'（果蔬鲜生），
    //   页面 v1.1.54 已改用 m_barber_001，路由没跟上 → 理发店首页显示果蔬。
    //   改为按 merchantId 查询，默认取单一真相源 DEFAULT_MERCHANT_ID。
    const url = new URL(request.url)
    const merchantId = resolveMerchantIdFromQuery(url.searchParams) || DEFAULT_MERCHANT_ID

    // 1. 商户基础信息
    const merchant: any = await prisma.merchant.findUnique({
      where: { id: merchantId },
      select: {
        id: true,
        name: true,
        shortName: true,
        logo: true,
        address: true,
        phone: true,
        businessHours: true,
        createdAt: true,
      },
    })

    if (!merchant) {
      return NextResponse.json({ success: false, error: '商户不存在: ' + merchantId }, { status: 404 })
    }

    // 2. 真实统计（用 $queryRaw 避开 schema 字段不一致）
    const [
      productCountRow,
      inStockRow,
      memberCount,
      orderCount,
      deliveredRow,
      reviewCount,
      avgRatingRow,
    ] = await Promise.all([
      prisma.$queryRaw<any[]>`SELECT COUNT(*) as n FROM Product WHERE merchantId = ${merchant.id}`,
      prisma.$queryRaw<any[]>`SELECT COUNT(*) as n FROM Product WHERE merchantId = ${merchant.id} AND stock > 0`,
      prisma.customer.count({ where: { merchantId: merchant.id } }),  // ⭐ 原来全局 count()，别家店会员也算进来
      prisma.order.count({ where: { merchantId: merchant.id } }),
      prisma.$queryRaw<any[]>`SELECT COUNT(*) as n FROM "Order" WHERE merchantId = ${merchant.id} AND status='delivered'`,
      prisma.comment.count(),
      prisma.comment.aggregate({ _avg: { rating: true } }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        merchant: {
          id: merchant.id,
          name: merchant.name,
          shortName: merchant.shortName,
          logo: merchant.logo,
          address: merchant.address,
          phone: merchant.phone,
          businessHours: merchant.businessHours,
          createdAt: merchant.createdAt,
        },
        stats: {
          productCount: Number(productCountRow?.[0]?.n || 0),
          inStockCount: Number(inStockRow?.[0]?.n || 0),
          memberCount,
          orderCount,
          deliveredCount: Number(deliveredRow?.[0]?.n || 0),
          reviewCount,
          avgRating: Number(avgRatingRow?._avg?.rating || 0),
        },
      },
    })
  } catch (err: any) {
    console.error('[merchant/stats] error:', err)
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 })
  }
}