import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdminRequest, unauthorized } from '@/lib/admin-jwt-auth'
import { ADMIN_MERCHANT_ID } from '@/lib/admin-merchant'

export const runtime = 'nodejs'

/**
 * POST /api/admin/products
 * 创建单个商品（v3.0 · 奕霖 2026-09-06 反馈"没添加新商品的功能"）
 * body: { productCode?, name*, shortName?, spec?, manufacturer?, category?, categoryLabel?,
 *         unit?, barcode?, image?, price*, stock?, memberPrice?, points?, description?,
 *         costPrice?, status? }
 */
export async function POST(request: NextRequest) {
  const auth = verifyAdminRequest(request)
  if (!auth.ok) return unauthorized(auth)
  try {
    const body = await request.json()

    // 必填字段校验
    const name = String(body.name || '').trim()
    if (!name) return NextResponse.json({ success: false, error: 'name 不能为空' }, { status: 400 })

    const price = Number(body.price ?? 0)
    if (isNaN(price) || price < 0) {
      return NextResponse.json({ success: false, error: 'price 必须是非负数' }, { status: 400 })
    }

    // 生成 productCode(若未传)
    let productCode = String(body.productCode || '').trim()
    if (!productCode) {
      const ts = Date.now().toString(36).toUpperCase()
      const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
      productCode = `P${ts}${rand}`
    } else {
      // 校验 productCode 唯一
      const dup: any[] = await prisma.$queryRawUnsafe(
        `SELECT id FROM Product WHERE productCode = ? AND merchantId = ? LIMIT 1`,
        productCode, ADMIN_MERCHANT_ID
      )
      if (dup.length > 0) {
        return NextResponse.json({ success: false, error: `productCode "${productCode}" 已存在` }, { status: 400 })
      }
    }

    const stock = Number(body.stock ?? 0)
    if (isNaN(stock) || stock < 0 || !Number.isInteger(stock)) {
      return NextResponse.json({ success: false, error: 'stock 必须是非负整数' }, { status: 400 })
    }

    const status = body.status || 'active'
    if (!['active', 'inactive', 'draft'].includes(status)) {
      return NextResponse.json({ success: false, error: 'status 必须是 active/inactive/draft' }, { status: 400 })
    }

    const id = `prod_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

    // 白名单插入
    await prisma.$executeRawUnsafe(
      `INSERT INTO Product (
        id, merchantId, productCode, name, shortName, spec, manufacturer, barcode,
        price, totalAmount, memberPrice, points, stock, unit, weightGram,
        category, categoryLabel, functionTags, status, image,
        costPrice, supplierName, supplierPhone, supplierContact, supplierNote,
        createdAt, updatedAt
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )`,
      id, ADMIN_MERCHANT_ID, productCode, name,
      body.shortName ? String(body.shortName).trim().slice(0, 100) : null,
      body.spec ? String(body.spec).trim().slice(0, 100) : null,
      body.manufacturer ? String(body.manufacturer).trim().slice(0, 100) : null,
      body.barcode ? String(body.barcode).trim().slice(0, 50) : null,
      price,
      body.totalAmount != null ? Number(body.totalAmount) : null,
      body.memberPrice != null ? Number(body.memberPrice) : null,
      body.points != null ? Number(body.points) : 0,
      stock,
      body.unit ? String(body.unit).trim().slice(0, 20) : null,
      body.weightGram != null ? Number(body.weightGram) : null,
      body.category ? String(body.category).trim().slice(0, 50) : null,
      body.categoryLabel ? String(body.categoryLabel).trim().slice(0, 50) : null,
      body.functionTags ? String(body.functionTags).trim().slice(0, 500) : null,
      status,
      body.image ? String(body.image).trim().slice(0, 500) : null,
      body.costPrice != null ? Number(body.costPrice) : 0,
      body.supplierName ? String(body.supplierName).trim().slice(0, 100) : null,
      body.supplierPhone ? String(body.supplierPhone).trim().slice(0, 50) : null,
      body.supplierContact ? String(body.supplierContact).trim().slice(0, 50) : null,
      body.supplierNote ? String(body.supplierNote).trim().slice(0, 500) : null,
    )

    // 埋点
    await prisma.$executeRawUnsafe(
      `INSERT INTO AuditLog (id, merchantId, actorType, actorId, action, target, description, createdAt)
       VALUES (?, ?, 'admin', null, 'create_product', ?, ?, CURRENT_TIMESTAMP)`,
      `al_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      ADMIN_MERCHANT_ID,
      id,
      `创建商品 ${productCode} ${name}`
    )

    return NextResponse.json({ success: true, id, productCode })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}
