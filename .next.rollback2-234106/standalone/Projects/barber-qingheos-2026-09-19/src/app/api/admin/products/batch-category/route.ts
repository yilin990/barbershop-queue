import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { ADMIN_MERCHANT_ID } from '@/lib/admin-merchant'
import { verifyAdminRequest, unauthorized } from '@/lib/admin-jwt-auth'

export const runtime = 'nodejs'


/**
 * POST /api/admin/products/batch-category
 * body: { ids: string[], category: string, categoryLabel?: string }
 * 批量改商品分类（按 id 数组）
 */
export async function POST(request: NextRequest) {
  try {
    const auth = verifyAdminRequest(request)
    if (!auth.ok) return unauthorized(auth)

    const body = await request.json()
    const ids: string[] = Array.isArray(body.ids) ? body.ids.filter((x: unknown): x is string => typeof x === 'string') : []
    const category = String(body.category || '').trim()
    const categoryLabel = String(body.categoryLabel || '').trim()

    if (ids.length === 0) {
      return NextResponse.json({ success: false, error: '请至少选 1 个商品' }, { status: 400 })
    }
    if (!category) {
      return NextResponse.json({ success: false, error: 'category 不能为空' }, { status: 400 })
    }

    // 批量 update（用 IN 子句 + 事务）
    const placeholders = ids.map(() => '?').join(',')
    await prisma.$executeRawUnsafe(
      `UPDATE Product SET category = ?, categoryLabel = ?, updatedAt = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`,
      category,
      categoryLabel || category,
      ...ids
    )

    // 写 audit
    await prisma.$executeRaw`
      INSERT INTO AuditLog (id, actorType, actorId, action, target, description, createdAt)
      VALUES (${`al_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`}, 'admin', null, 'batch_category', ${ids[0]}, ${`批量改分类 ${ids.length} 件 → ${categoryLabel || category}`}, CURRENT_TIMESTAMP)
    `

    return NextResponse.json({ success: true, count: ids.length, category: categoryLabel || category })
  } catch (error: any) {
    console.error('[admin/products/batch-category]', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}