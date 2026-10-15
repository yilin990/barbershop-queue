import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { ADMIN_MERCHANT_ID } from '@/lib/admin-merchant'
import { verifyAdminRequest, unauthorized } from '@/lib/admin-jwt-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/products/photo-batch/queue
 * query: ?limit=10&offset=0
 * 返回待补图商品队列（按销量降序）
 * 优先级：销量高 > 库存 > 价格
 * 奕霖 2026-08-01 "批量拍照模式 = 一气呵成拍 10 张招牌药"
 */
export async function GET(request: NextRequest) {
  try {
    const auth = verifyAdminRequest(request)
    if (!auth.ok) return unauthorized(auth)

    const url = new URL(request.url)
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') || '12')))
    const offset = Math.max(0, Number(url.searchParams.get('offset') || '0'))

    // 待补图商品：active + 库存 > 0 + 无商家图（image 不以 /uploads/products/ 开头或为空）
    const queue: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, productCode, name, shortName, manufacturer, spec, price, stock, sales30d, image,
              categoryLabel
       FROM Product
       WHERE status='active' AND merchantId = ?
         AND stock > 0
         AND (image IS NULL OR image = '' OR image NOT LIKE '/uploads/products/%')
       ORDER BY sales30d DESC, stock DESC, price DESC
       LIMIT ? OFFSET ?`,
      limit,
      offset
    )

    // 统计总数
    const totalRow: any[] = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*) as total FROM Product
       WHERE status='active' AND merchantId = ? AND stock > 0
         AND (image IS NULL OR image = '' OR image NOT LIKE '/uploads/products/%')`
    )

    // 今日已补图数（image 含 /uploads/products/）
    const todayRow: any[] = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*) as done FROM Product
       WHERE status='active' AND merchantId = ?
         AND image LIKE '/uploads/products/%'
         AND date(updatedAt) = date('now')`
    )

    return NextResponse.json({
      success: true,
      queue: queue.map((p) => ({
        id: p.id,
        productCode: p.productCode,
        name: p.name,
        shortName: p.shortName,
        manufacturer: p.manufacturer,
        spec: p.spec,
        price: Number(p.price || 0),
        stock: Number(p.stock || 0),
        sales30d: Number(p.sales30d || 0),
        image: p.image,
        categoryLabel: p.categoryLabel,
      })),
      total: Number(totalRow[0]?.total || 0),
      doneToday: Number(todayRow[0]?.done || 0),
      limit,
      offset,
    })
  } catch (error: any) {
    console.error('[admin/products/photo-batch/queue]', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}