import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdminRequest, unauthorized } from '@/lib/admin-jwt-auth'

export const runtime = 'nodejs'

const MERCHANT_ID = 'm_grocery_001'

/**
 * PATCH /api/admin/points-products/[id]
 * 编辑积分兑换商品(分值 / 原价 / 库存 / 状态)
 *
 * body: { pointsRequired?, originalPrice?, stock?, status? }
 *
 * ⭐ 2026-09-06 P3 — 兑换商品原本只能新增或下架,改分值要先删再加,UX 差
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = verifyAdminRequest(request)
  if (!auth.ok) return unauthorized(auth)
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))

    const exist: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, productId, pointsRequired, originalPrice, stock, status
       FROM PointsProduct WHERE id = ? AND merchantId = ? LIMIT 1`,
      id, MERCHANT_ID
    )
    if (exist.length === 0) {
      return NextResponse.json({ success: false, error: '积分商品不存在' }, { status: 404 })
    }

    const sets: string[] = []
    const vals: any[] = []

    if (body.pointsRequired !== undefined) {
      const v = Number(body.pointsRequired)
      if (!Number.isInteger(v) || v <= 0) {
        return NextResponse.json({ success: false, error: 'pointsRequired 必须正整数' }, { status: 400 })
      }
      sets.push('pointsRequired = ?'); vals.push(v)
    }
    if (body.originalPrice !== undefined) {
      const v = Number(body.originalPrice)
      if (!Number.isFinite(v) || v < 0) {
        return NextResponse.json({ success: false, error: 'originalPrice 必须非负' }, { status: 400 })
      }
      sets.push('originalPrice = ?'); vals.push(v)
    }
    if (body.stock !== undefined) {
      const v = Number(body.stock)
      if (!Number.isInteger(v) || v < 0) {
        return NextResponse.json({ success: false, error: 'stock 必须非负整数' }, { status: 400 })
      }
      sets.push('stock = ?'); vals.push(v)
    }
    if (body.status !== undefined) {
      if (!['active', 'inactive'].includes(body.status)) {
        return NextResponse.json({ success: false, error: 'status 非法(只允许 active/inactive)' }, { status: 400 })
      }
      sets.push('status = ?'); vals.push(body.status)
    }

    if (sets.length === 0) {
      return NextResponse.json({ success: false, error: '无有效更新字段' }, { status: 400 })
    }

    vals.push(id); vals.push(MERCHANT_ID)
    await prisma.$executeRawUnsafe(
      `UPDATE PointsProduct SET ${sets.join(', ')} WHERE id = ? AND merchantId = ?`,
      ...vals
    )

    // 审计
    await prisma.$executeRawUnsafe(
      `INSERT INTO AuditLog (id, actorType, action, target, description, createdAt)
       VALUES (?, 'admin', 'patch_points_product', ?, ?, datetime('now'))`,
      `al_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      id,
      `改积分商品 ${exist[0].productId}: ${Object.keys(body).join(', ')}`
    )

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}
