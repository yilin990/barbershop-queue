import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_MERCHANT_ID } from '@/lib/admin-merchant'
import { prisma } from '@/lib/db'
import { verifyAdminRequest, unauthorized } from '@/lib/admin-jwt-auth'

export const runtime = 'nodejs'


export async function GET(request: NextRequest) {
  const auth = verifyAdminRequest(request)
  if (!auth.ok) return unauthorized(auth)
  try {
    const { searchParams } = new URL(request.url)
    const q = (searchParams.get('q') || '').trim()
    const low = searchParams.get('low') === '1'
    // ⭐ P0 #4 奕霖 2026-07-20 16:48 — 4 档 tier 服务端过滤（与首页 TierCard 联动）
    const tier = (searchParams.get('tier') || '').trim()
    const category = (searchParams.get('category') || '').trim()
    const page = Math.max(parseInt(searchParams.get('page') || '1'), 1)
    const pageSize = Math.min(parseInt(searchParams.get('limit') || '50'), 200)
    const offset = (page - 1) * pageSize

    // 查总数
    let countSql = `SELECT COUNT(*) AS total FROM Product WHERE merchantId = ? AND  status='active'`
    // ⭐ 奕霖 2026-08-05 02:20 — 方案 B：LEFT JOIN OrphanPhoto 计算 retakeCount（按 productName 关联）
    let dataSql = `SELECT p.id, p.productCode, p.name, p.shortName, p.spec, p.totalAmount, p.price, p.stock, p.unit, p.category, p.manufacturer, p.categoryLabel, p.status, p.image,
                          (SELECT COUNT(*) FROM OrphanPhoto o WHERE o.status='pending' AND o.source='single-product-retake' AND (o.originalImageUrl = p.image OR o.productName = p.name)) AS retakeCount
                   FROM Product p WHERE p.merchantId = ? AND p.status='active'`
    const params: any[] = [ADMIN_MERCHANT_ID]
    const countParams: any[] = [ADMIN_MERCHANT_ID]
    if (q) {
      const where = ` AND (name LIKE ? OR shortName LIKE ? OR productCode LIKE ?)`
      const like = `%${q}%`
      countSql += where
      dataSql += where
      params.push(like, like, like)
      countParams.push(like, like, like)
    }
    if (low) {
      const where = ` AND stock < 20`
      countSql += where
      dataSql += where
    }
    // ⭐ P0 #4 4 档 tier 服务端过滤 — critical_0/critical_5/warning/normal（all=不过滤）
    if (tier && tier !== 'all') {
      let where = ''
      if (tier === 'critical_0') where = ` AND stock = 0`
      else if (tier === 'critical_5') where = ` AND stock > 0 AND stock < 5`
      else if (tier === 'warning') where = ` AND stock >= 5 AND stock < 20`
      else if (tier === 'normal') where = ` AND stock >= 20`
      if (where) {
        countSql += where
        dataSql += where
      }
    }
    if (category) {
      const where = ` AND (category = ? OR categoryLabel = ?)`
      countSql += where
      dataSql += where
      params.push(category, category)
      countParams.push(category, category)
    }
    dataSql += ` ORDER BY stock ASC, name ASC LIMIT ? OFFSET ?`
    params.push(pageSize, offset)

    const countResult = await prisma.$queryRawUnsafe<{ total: number }[]>(countSql, ...countParams)
    const total = Number(countResult[0]?.total || 0)
    const productsRaw = await prisma.$queryRawUnsafe<any[]>(dataSql, ...params)
    // ⭐ 奕霖 2026-08-05 02:20 — 方案 B：BigInt → Number 修复（SQLite COUNT 返回 BigInt）
    const products = productsRaw.map((p) => ({
      ...p,
      retakeCount: Number(p.retakeCount || 0),
    }))

    // 全库聚合（不走 page filter）
    // totalValue 用 price × stock（totalAmount 列很多 0 不可靠）
    const aggResult: any[] = await prisma.$queryRaw`
      SELECT
        COALESCE(SUM(price * stock), 0) AS totalValue,
        COALESCE(SUM(stock), 0) AS totalStock,
        COALESCE(SUM(CASE WHEN stock < 20 THEN 1 ELSE 0 END), 0) AS lowCount
      FROM Product WHERE status='active' AND merchantId = ${ADMIN_MERCHANT_ID}
    `
    const agg = aggResult[0] || { totalValue: 0, totalStock: 0, lowCount: 0 }

    return NextResponse.json({
      success: true,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      hasNext: page * pageSize < total,
      hasPrev: page > 1,
      aggregates: {
        totalValue: Number(agg.totalValue || 0),
        totalStock: Number(agg.totalStock || 0),
        lowCount: Number(agg.lowCount || 0),
      },
      products: products.map((p) => ({
        ...p,
        stock: p.stock ? Number(p.stock) : 0,
        price: p.price ? Number(p.price) : 0,
        totalAmount: p.totalAmount ? Number(p.totalAmount) : 0,
      })),
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}
