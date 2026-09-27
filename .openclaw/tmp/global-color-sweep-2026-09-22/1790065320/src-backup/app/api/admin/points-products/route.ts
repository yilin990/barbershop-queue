import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_MERCHANT_ID } from '@/lib/admin-merchant'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

/**
 * GET  /api/admin/points-products         - 列出商家所有积分兑换商品
 * POST /api/admin/points-products         - 新增/更新积分商品（upsert by productId）
 * DELETE /api/admin/points-products?id=... - 删除积分商品
 */

function isAdmin(request: NextRequest) {
  const token = request.cookies.get('zhilin-admin-token')?.value
  if (!token) return false
  return /^pin-\d{4}$/.test(token)
}

const MERCHANT_ID = 'm_grocery_001'

export async function GET(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: '请先登录商户后台' }, { status: 401 })
  }
  try {
    const rows: any[] = await prisma.$queryRaw`
      SELECT
        pp.id, pp.merchantId, pp.productId, pp.pointsRequired,
        pp.originalPrice, pp.stock, pp.status, pp.createdAt,
        p.name as productName, p.shortName, p.spec, p.price as currentPrice,
        p.image, p.unit, p.category
      FROM PointsProduct pp
      LEFT JOIN Product p ON p.id = pp.productId
      WHERE pp.merchantId = ${MERCHANT_ID}
      ORDER BY pp.createdAt DESC
      LIMIT 200
    `
    return NextResponse.json({ items: rows })
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: '请先登录商户后台' }, { status: 401 })
  }
  try {
    const body = await request.json()
    const productId = String(body.productId || '').trim()
    const pointsRequired = Number(body.pointsRequired)
    const originalPrice = Number(body.originalPrice)
    const stock = Number(body.stock)

    if (!productId) return NextResponse.json({ error: 'productId 必填' }, { status: 400 })
    if (!Number.isInteger(pointsRequired) || pointsRequired <= 0)
      return NextResponse.json({ error: 'pointsRequired 必须是正整数' }, { status: 400 })
    if (!Number.isFinite(originalPrice) || originalPrice < 0)
      return NextResponse.json({ error: 'originalPrice 必须是非负数' }, { status: 400 })
    if (!Number.isInteger(stock) || stock < 0)
      return NextResponse.json({ error: 'stock 必须是非负整数' }, { status: 400 })

    // 校验商品存在
    const product: any[] = await prisma.$queryRaw`SELECT id, price FROM Product WHERE merchantId = ${ADMIN_MERCHANT_ID} AND  id = ${productId} LIMIT 1`
    if (product.length === 0) return NextResponse.json({ error: '商品不存在' }, { status: 400 })

    const id = `pp_${productId}`

    // upsert：用 productId 唯一索引
    await prisma.$executeRawUnsafe(
      `INSERT INTO PointsProduct (id, merchantId, productId, pointsRequired, originalPrice, stock, status, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, 'active', datetime('now'))
       ON CONFLICT(merchantId, productId) DO UPDATE SET
         pointsRequired=excluded.pointsRequired,
         originalPrice=excluded.originalPrice,
         stock=excluded.stock`,
      id, MERCHANT_ID, productId, pointsRequired, originalPrice, stock
    )

    return NextResponse.json({ success: true, id })
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: '请先登录商户后台' }, { status: 401 })
  }
  try {
    const id = request.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id 必填' }, { status: 400 })

    const result: any = await prisma.$executeRawUnsafe(
      `DELETE FROM PointsProduct WHERE id = ? AND merchantId = ?`,
      id, MERCHANT_ID
    )
    return NextResponse.json({ success: true, deleted: result })
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 })
  }
}
