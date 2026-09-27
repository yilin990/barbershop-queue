import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { ADMIN_MERCHANT_ID } from '@/lib/admin-merchant'

export const runtime = 'nodejs'

/**
 * GET /api/admin/profitability
 *
 * 商家数据面板：每个商品的毛利率 + 让利空间
 * 奕霖 2026-08-05 18:08 需求："我们要看看数据"
 *
 * 返回：
 * - summary: 总览统计（覆盖率 / 档位分布 / 平均毛利）
 * - products: 每个商品的毛利 + 让利预览（2/3/4 人）
 */
export async function GET(request: NextRequest) {
  try {
    const products = await prisma.$queryRaw<any[]>`
      SELECT
        id, name, spec, price, memberPrice, stock,
        costPrice, sales30d,
        CASE
          WHEN costPrice > 0 AND price > 0 THEN ROUND((1 - costPrice/price) * 100, 1)
          ELSE NULL
        END as marginPercent,
        category, functionTags, image
      FROM Product
      WHERE status = 'active' AND merchantId = ${ADMIN_MERCHANT_ID}
      ORDER BY sales30d DESC
      LIMIT 500
    `

    const items = products.map((p) => {
      const cost = Number(p.costPrice || 0)
      const price = Number(p.price || 0)
      const margin = p.marginPercent != null ? Number(p.marginPercent) : null

      let tier: 'high' | 'mid' | 'low' | 'unprofitable' | 'unknown' = 'unknown'
      let tier2 = price, tier3 = price, tier4 = price
      let isFloor = false

      if (cost > 0 && price > 0) {
        const m = (price - cost) / price
        if (m >= 0.30) tier = 'high'
        else if (m >= 0.15) tier = 'mid'
        else if (m >= 0.05) tier = 'low'
        else tier = 'unprofitable'

        if (tier === 'high' || tier === 'mid' || tier === 'low') {
          const ratioMap: Record<'high' | 'mid' | 'low', number[]> = {
            high: [0.95, 0.90, 0.85],
            mid: [0.95, 0.92, 0.88],
            low: [0.98, 0.95, 0.92],
          }
          const ratios = ratioMap[tier]
          const floor = Math.max(cost * 1.05, price * ratios[2])
          tier2 = Math.max(price * ratios[0], floor)
          tier3 = Math.max(price * ratios[1], floor)
          tier4 = Math.max(price * ratios[2], floor)
          isFloor = Math.abs(tier4 - floor) < 0.001
          tier2 = Math.round(tier2 * 100) / 100
          tier3 = Math.round(tier3 * 100) / 100
          tier4 = Math.round(tier4 * 100) / 100
        }
      }

      return {
        id: p.id,
        name: p.name,
        spec: p.spec,
        image: p.image,
        price,
        costPrice: cost,
        marginPercent: margin,
        tier,
        stock: p.stock,
        sales30d: p.sales30d,
        functionTags: p.functionTags,
        tier2,
        tier3,
        tier4,
        isFloor,
      }
    })

    const summary = {
      totalActive: items.length,
      withCost: items.filter((i) => i.costPrice > 0).length,
      withoutCost: items.filter((i) => i.costPrice === 0).length,
      costCoverageRate: items.length > 0
        ? Math.round((items.filter((i) => i.costPrice > 0).length / items.length) * 100)
        : 0,
      tierDistribution: {
        high: items.filter((i) => i.tier === 'high').length,
        mid: items.filter((i) => i.tier === 'mid').length,
        low: items.filter((i) => i.tier === 'low').length,
        unprofitable: items.filter((i) => i.tier === 'unprofitable').length,
        unknown: items.filter((i) => i.tier === 'unknown').length,
      },
      avgMargin: (() => {
        const withMargin = items.filter((i) => i.marginPercent != null)
        if (withMargin.length === 0) return null
        return Math.round((withMargin.reduce((s, i) => s + (i.marginPercent || 0), 0) / withMargin.length) * 10) / 10
      })(),
    }

    return NextResponse.json({ success: true, summary, products: items })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || '服务器错误' }, { status: 500 })
  }
}
