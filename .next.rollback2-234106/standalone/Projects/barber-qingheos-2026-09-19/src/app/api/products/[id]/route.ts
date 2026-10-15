import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { cacheHeaders, CACHE_TTL } from '@/lib/cache-headers'
import { serverCache } from '@/lib/server-cache'

export const runtime = 'nodejs'

/**
 * GET /api/products/[id]
 * 商品详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // server-cache 包裹：商品详情 5min TTL
    const data = await serverCache(`product-detail:${id}`, 300, async () => {
      const products = await prisma.$queryRaw<any[]>`
        SELECT
          p.id, p.name, p.shortName, p.spec, p.manufacturer, p.barcode, p.approvalNo,
          p.price, p.memberPrice, p.stock, p.category, p.categoryLabel, p.dosage, p.unit,
          p.qualityClass, p.functionTags, p.sales30d, p.sales30_60d, p.sales60_90d,
          p.image, p.medicalCode, p.status, p.productCode, p.productType, p.createdAt,
          CAST(p.merchantId AS TEXT) as merchantId, m.name as merchantName, m.code as merchantCode, m.phone as merchantPhone
        FROM Product p
        JOIN Merchant m ON p.merchantId = m.id
        WHERE (p.id = ${id} OR p.productCode = ${id})
          AND (p.approvalNo IS NULL OR p.approvalNo NOT LIKE '国药准字H%')
        LIMIT 1
      `

      if (products.length === 0) {
        return { success: false, error: '商品不存在或已下架' }
      }

      return { success: true, product: products[0] }
    })

    const status = data.success ? 200 : 404
    return NextResponse.json(data, { status, headers: cacheHeaders(CACHE_TTL.DETAIL) })
  } catch (e: any) {
    console.error('[product detail API]', e)
    return NextResponse.json(
      { success: false, error: '服务器错误: ' + (e?.message ?? 'unknown') },
      { status: 500 }
    )
  }
}
