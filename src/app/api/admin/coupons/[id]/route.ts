import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdminRequest, unauthorized } from '@/lib/admin-jwt-auth'
import { ADMIN_MERCHANT_ID } from '@/lib/admin-merchant'

export const runtime = 'nodejs'

/**
 * PATCH /api/admin/coupons/[id]
 * 修改券：过期时间 / 状态
 * body: { status?: 'unused' | 'used' | 'expired', expiresInDays?: number, name?: string, value?: number, minSpend?: number }
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyAdminRequest(request)
  if (!auth.ok) return unauthorized(auth)
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const exist: any[] = await prisma.$queryRawUnsafe('SELECT id, status FROM Coupon WHERE id = ? AND merchantId = ? LIMIT 1', id, ADMIN_MERCHANT_ID)
    if (exist.length === 0) {
      return NextResponse.json({ success: false, error: '券不存在' }, { status: 404 })
    }

    const fields: string[] = []
    const values: any[] = []

    if (body.status && ['unused', 'used', 'expired'].includes(body.status)) {
      fields.push('status = ?')
      values.push(body.status)
      if (body.status === 'used') {
        fields.push('usedAt = datetime(\'now\')')
      }
    }
    if (body.name && typeof body.name === 'string' && body.name.length <= 30) {
      fields.push('name = ?')
      values.push(body.name)
    }
    if (typeof body.value === 'number' && body.value > 0) {
      fields.push('value = ?')
      values.push(body.value)
    }
    if (typeof body.minSpend === 'number' && body.minSpend >= 0) {
      fields.push('minSpend = ?')
      values.push(body.minSpend)
    }
    if (typeof body.expiresInDays === 'number' && body.expiresInDays > 0 && body.expiresInDays <= 365) {
      fields.push('expiresAt = ?')
      values.push(new Date(Date.now() + body.expiresInDays * 86400000).toISOString())
    }

    if (fields.length === 0) {
      return NextResponse.json({ success: false, error: '无有效更新字段' }, { status: 400 })
    }

    values.push(id)
    values.push(ADMIN_MERCHANT_ID); await prisma.$executeRawUnsafe(`UPDATE Coupon SET ${fields.join(', ')} WHERE id = ? AND merchantId = ?`, ...values)

    // 埋点
    await prisma.$executeRawUnsafe(
      `INSERT INTO AuditLog (id, actorType, action, target, description, createdAt) VALUES (?, 'admin', 'update_coupon', ?, ?, datetime('now'))`,
      `al_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, id, `改券: ${Object.keys(body).join(', ')}`
    )

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/coupons/[id]
 * 删除券（仅 unused 状态可删；used/expired 删了会丢审计）
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyAdminRequest(request)
  if (!auth.ok) return unauthorized(auth)
  try {
    const { id } = await params
    const exist: any[] = await prisma.$queryRawUnsafe('SELECT id, status FROM Coupon WHERE id = ? LIMIT 1', id)
    if (exist.length === 0) {
      return NextResponse.json({ success: false, error: '券不存在' }, { status: 404 })
    }
    if (exist[0].status === 'used') {
      return NextResponse.json({ success: false, error: '已使用的券不能删（改过期时间即可）' }, { status: 400 })
    }
    await prisma.$executeRawUnsafe('DELETE FROM Coupon WHERE id = ?', id)
    await prisma.$executeRawUnsafe(
      `INSERT INTO AuditLog (id, actorType, action, target, description, createdAt) VALUES (?, 'admin', 'delete_coupon', ?, ?, datetime('now'))`,
      `al_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, id, `删券 ${id}`
    )
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message }, { status: 500 })
  }
}
