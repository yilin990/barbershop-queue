import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { ADMIN_MERCHANT_ID } from '@/lib/admin-merchant'

export const runtime = 'nodejs'

/**
 * PATCH /api/admin/profitability/[id]
 *
 * 商家录入/更新商品成本价 + 供应商信息
 * 奕霖 2026-08-05 18:24 "你先自己设计和做吧"
 *
 * body: {
 *   costPrice: number,
 *   supplierName?: string,
 *   supplierPhone?: string,
 *   supplierContact?: string,
 *   supplierNote?: string
 * }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const costPrice = Number(body.costPrice)
    if (isNaN(costPrice) || costPrice < 0) {
      return NextResponse.json({ success: false, error: 'costPrice 非法' }, { status: 400 })
    }
    if (costPrice > 0) {
      // 简易合理性：成本不超过原价（但允许 = 0 视作清除）
      const products = await prisma.$queryRaw<any[]>`
        SELECT id, price FROM Product WHERE id = ${id} AND merchantId = ${ADMIN_MERCHANT_ID} LIMIT 1
      `
      if (products.length === 0) {
        return NextResponse.json({ success: false, error: '商品不存在' }, { status: 404 })
      }
      if (costPrice > products[0].price) {
        return NextResponse.json({ success: false, error: '成本不能超过原价' }, { status: 400 })
      }
    }

    const supplierName = body.supplierName ?? null
    const supplierPhone = body.supplierPhone ?? null
    const supplierContact = body.supplierContact ?? null
    const supplierNote = body.supplierNote ?? null

    await prisma.$executeRaw`
      UPDATE Product SET
        costPrice = ${costPrice},
        supplierName = ${supplierName},
        supplierPhone = ${supplierPhone},
        supplierContact = ${supplierContact},
        supplierNote = ${supplierNote},
        updatedAt = datetime('now')
      WHERE id = ${id} AND merchantId = ${ADMIN_MERCHANT_ID}
    `

    // Audit
    await prisma.$executeRawUnsafe(
      `INSERT INTO AuditLog (id, actorType, action, target, description, createdAt) VALUES (?, 'admin', 'update_cost', ?, ?, datetime('now'))`,
      `al_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, id, `成本更新: ¥${costPrice}`
    )

    // 算档位
    const products = await prisma.$queryRaw<any[]>`
      SELECT price, costPrice FROM Product WHERE id = ${id} AND merchantId = ${ADMIN_MERCHANT_ID} LIMIT 1
    `
    const price = products[0]?.price || 0
    let tier = 'unknown'
    if (costPrice > 0) {
      const m = (price - costPrice) / price
      if (m >= 0.30) tier = 'high'
      else if (m >= 0.15) tier = 'mid'
      else if (m >= 0.05) tier = 'low'
      else tier = 'unprofitable'
    }

    return NextResponse.json({
      success: true,
      product: { id, costPrice, tier },
      message: costPrice > 0 ? '成本已更新' : '成本已清空',
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || '服务器错误' }, { status: 500 })
  }
}
