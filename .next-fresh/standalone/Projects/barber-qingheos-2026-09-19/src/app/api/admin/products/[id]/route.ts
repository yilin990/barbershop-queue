import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdminRequest, unauthorized } from '@/lib/admin-jwt-auth'
import { ADMIN_MERCHANT_ID } from '@/lib/admin-merchant'

export const runtime = 'nodejs'


/**
 * PATCH /api/admin/products/[id]
 * body: { name?, shortName?, spec?, price?, stock?, status?, costPrice?, supplierName?, supplierPhone?, supplierContact?, supplierNote? }
 * 编辑单商品（白名单字段）
 * ⭐ P0 #7.5 奕霖 2026-07-20 17:47 — 进货信息录入（costPrice + supplier 4 字段）
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyAdminRequest(request)
  if (!auth.ok) return unauthorized(auth)
  try {
    const { id } = await params
    const body = await request.json()

    const allowed: string[] = []
    const values: any[] = []

    if (body.name !== undefined) {
      const v = String(body.name).trim()
      if (!v) return NextResponse.json({ success: false, error: 'name 不能为空' }, { status: 400 })
      allowed.push('name = ?'); values.push(v)
    }
    if (body.shortName !== undefined) {
      allowed.push('shortName = ?'); values.push(body.shortName ? String(body.shortName).trim() : null)
    }
    if (body.spec !== undefined) {
      allowed.push('spec = ?'); values.push(body.spec ? String(body.spec).trim() : null)
    }
    if (body.manufacturer !== undefined) {
      allowed.push('manufacturer = ?'); values.push(body.manufacturer ? String(body.manufacturer).trim().slice(0, 100) : null)
    }
    if (body.dosage !== undefined) {
      allowed.push('dosage = ?'); values.push(body.dosage ? String(body.dosage).trim().slice(0, 50) : null)
    }
    if (body.approvalNo !== undefined) {
      allowed.push('approvalNo = ?'); values.push(body.approvalNo ? String(body.approvalNo).trim().slice(0, 50) : null)
    }
    if (body.functionTags !== undefined) {
      allowed.push('functionTags = ?'); values.push(body.functionTags ? String(body.functionTags).trim().slice(0, 200) : null)
    }
    if (body.price !== undefined) {
      const v = Number(body.price)
      if (isNaN(v) || v < 0) return NextResponse.json({ success: false, error: 'price 必须是非负数' }, { status: 400 })
      allowed.push('price = ?'); values.push(v)
    }
    if (body.stock !== undefined) {
      const v = Number(body.stock)
      if (isNaN(v) || v < 0 || !Number.isInteger(v)) {
        return NextResponse.json({ success: false, error: 'stock 必须是非负整数' }, { status: 400 })
      }
      allowed.push('stock = ?'); values.push(v)
    }
    if (body.status !== undefined) {
      if (!['active', 'inactive', 'draft'].includes(body.status)) {
        return NextResponse.json({ success: false, error: "status 必须是 active/inactive/draft" }, { status: 400 })
      }
      allowed.push('status = ?'); values.push(body.status)
    }

    if (body.image !== undefined) {
      allowed.push('image = ?'); values.push(body.image ? String(body.image).trim().slice(0, 500) : null)
    }
    if (body.category !== undefined) {
      allowed.push('category = ?'); values.push(body.category ? String(body.category).trim().slice(0, 50) : null)
    }
    if (body.categoryLabel !== undefined) {
      allowed.push('categoryLabel = ?'); values.push(body.categoryLabel ? String(body.categoryLabel).trim().slice(0, 50) : null)
    }
    if (body.unit !== undefined) {
      allowed.push('unit = ?'); values.push(body.unit ? String(body.unit).trim().slice(0, 20) : null)
    }
    if (body.barcode !== undefined) {
      allowed.push('barcode = ?'); values.push(body.barcode ? String(body.barcode).trim().slice(0, 50) : null)
    }
    if (body.productCode !== undefined) {
      const v = String(body.productCode).trim()
      if (!v) return NextResponse.json({ success: false, error: 'productCode 不能为空' }, { status: 400 })
      // 唯一性校验
      const dup: any[] = await prisma.$queryRawUnsafe(
        `SELECT id FROM Product WHERE productCode = ? AND id != ? AND merchantId = ? LIMIT 1`,
        v, id, ADMIN_MERCHANT_ID
      )
      if (dup.length > 0) {
        return NextResponse.json({ success: false, error: `productCode "${v}" 已被其他商品使用` }, { status: 400 })
      }
      allowed.push('productCode = ?'); values.push(v)
    }
    if (body.totalAmount !== undefined) {
      const v = Number(body.totalAmount)
      if (isNaN(v) || v < 0) return NextResponse.json({ success: false, error: 'totalAmount 必须是非负数' }, { status: 400 })
      allowed.push('totalAmount = ?'); values.push(v)
    }
    if (body.memberPrice !== undefined) {
      const v = Number(body.memberPrice)
      if (isNaN(v) || v < 0) return NextResponse.json({ success: false, error: 'memberPrice 必须是非负数' }, { status: 400 })
      allowed.push('memberPrice = ?'); values.push(v)
    }
    if (body.points !== undefined) {
      const v = Number(body.points)
      if (isNaN(v) || v < 0 || !Number.isInteger(v)) {
        return NextResponse.json({ success: false, error: 'points 必须是非负整数' }, { status: 400 })
      }
      allowed.push('points = ?'); values.push(v)
    }
    if (body.weightGram !== undefined) {
      const v = Number(body.weightGram)
      if (isNaN(v) || v < 0 || !Number.isInteger(v)) {
        return NextResponse.json({ success: false, error: 'weightGram 必须是非负整数' }, { status: 400 })
      }
      allowed.push('weightGram = ?'); values.push(v)
    }
    if (body.medicalCode !== undefined) {
      allowed.push('medicalCode = ?'); values.push(body.medicalCode ? String(body.medicalCode).trim().slice(0, 50) : null)
    }

    // ⭐ P0 #7.5 — 进货信息 5 字段白名单
    if (body.costPrice !== undefined) {
      const v = Number(body.costPrice)
      if (isNaN(v) || v < 0) return NextResponse.json({ success: false, error: 'costPrice 必须是非负数' }, { status: 400 })
      allowed.push('costPrice = ?'); values.push(v)
    }
    if (body.supplierName !== undefined) {
      allowed.push('supplierName = ?'); values.push(body.supplierName ? String(body.supplierName).trim().slice(0, 100) : null)
    }
    if (body.supplierPhone !== undefined) {
      allowed.push('supplierPhone = ?'); values.push(body.supplierPhone ? String(body.supplierPhone).trim().slice(0, 50) : null)
    }
    if (body.supplierContact !== undefined) {
      allowed.push('supplierContact = ?'); values.push(body.supplierContact ? String(body.supplierContact).trim().slice(0, 50) : null)
    }
    if (body.supplierNote !== undefined) {
      allowed.push('supplierNote = ?'); values.push(body.supplierNote ? String(body.supplierNote).trim().slice(0, 500) : null)
    }

    if (allowed.length === 0) {
      return NextResponse.json({ success: false, error: '没有要更新的字段' }, { status: 400 })
    }

    // 更新时间戳
    allowed.push('updatedAt = CURRENT_TIMESTAMP')

    // ⭐ v0.8.83 — 隔离防越权：先校验商品属于当前 merchantId
    const check: any[] = await prisma.$queryRawUnsafe(
      `SELECT merchantId FROM Product WHERE id = ?`,
      id
    )
    if (!check.length || check[0].merchantId !== ADMIN_MERCHANT_ID) {
      return NextResponse.json({ success: false, error: '商品不存在或无权操作' }, { status: 404 })
    }

    values.push(id)
    const sql = `UPDATE Product SET ${allowed.join(', ')} WHERE id = ? AND merchantId = ?`
    await prisma.$executeRawUnsafe(sql, ...values, ADMIN_MERCHANT_ID)

    // 埋点
    await prisma.$executeRawUnsafe(
      `INSERT INTO AuditLog (id, actorType, actorId, action, target, description, createdAt)
       VALUES (?, 'admin', null, 'edit_product', ?, ?, CURRENT_TIMESTAMP)`,
      `al_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      id,
      `编辑商品 ${id}：${allowed.filter((f) => f !== 'updatedAt = CURRENT_TIMESTAMP').length} 个字段`
    )

    return NextResponse.json({ success: true, updatedFields: allowed.length - 1 })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}

/**
 * GET /api/admin/products/[id]
 * 取单个商品详情（用于编辑弹窗回填）
 * ⭐ P0 #7.5 — 加 5 进货信息字段
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyAdminRequest(request)
  if (!auth.ok) return unauthorized(auth)
  try {
    const { id } = await params
    const result: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, productCode, name, shortName, spec, manufacturer, price, stock, unit, category, categoryLabel, status, updatedAt,
              costPrice, supplierName, supplierPhone, supplierContact, supplierNote
       FROM Product WHERE id = ? AND merchantId = ? AND status = 'active'`,
      id, ADMIN_MERCHANT_ID
    )
    if (!result.length) {
      return NextResponse.json({ success: false, error: '商品不存在' }, { status: 404 })
    }
    const p = result[0]
    return NextResponse.json({
      success: true,
      product: {
        ...p,
        price: Number(p.price || 0),
        stock: Number(p.stock || 0),
        costPrice: Number(p.costPrice || 0),
      },
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}
