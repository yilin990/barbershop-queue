import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { ADMIN_MERCHANT_ID } from '@/lib/admin-merchant'
import { verifyAdminRequest, unauthorized } from '@/lib/admin-jwt-auth'

export const runtime = 'nodejs'

/**
 * POST /api/admin/coupons/batch
 * 奕霖 2026-08-05 20:20：批量操作券
 *
 * body: {
 *   ids: string[],
 *   action: 'delete' | 'expire' | 'activate' | 'set_type',
 *   type?: 'discount' | 'new_user' | 'flash_sale' | 'shipping'
 * }
 */
export async function POST(request: NextRequest) {
  const auth = verifyAdminRequest(request)
  if (!auth.ok) return unauthorized(auth)
  try {
    const body = await request.json().catch(() => ({}))
    const ids: string[] = Array.isArray(body.ids) ? body.ids.slice(0, 500) : []
    const action = body.action
    const type = body.type
    if (ids.length === 0) {
      return NextResponse.json({ success: false, error: '未选择券' }, { status: 400 })
    }
    if (!['delete', 'expire', 'activate', 'set_type'].includes(action)) {
      return NextResponse.json({ success: false, error: 'action 非法' }, { status: 400 })
    }

    let affected = 0
    if (action === 'delete') {
      // 只删 unused（防止误删已用）
      for (const id of ids) {
        const r = await prisma.$executeRawUnsafe(`DELETE FROM Coupon WHERE id = ? AND merchantId = ? AND status = 'unused'`, id)
        affected += Number(r || 0)
      }
    } else if (action === 'expire') {
      for (const id of ids) {
        const r = await prisma.$executeRawUnsafe(
          `UPDATE Coupon SET status = 'expired', expiresAt = COALESCE(expiresAt, datetime('now')) WHERE id = ? AND merchantId = ?`,
          id, ADMIN_MERCHANT_ID
        )
        affected += Number(r || 0)
      }
    } else if (action === 'activate') {
      for (const id of ids) {
        const r = await prisma.$executeRawUnsafe(
          `UPDATE Coupon SET status = 'unused' WHERE id = ? AND status = 'expired' AND merchantId = ?`,
          id, ADMIN_MERCHANT_ID
        )
        affected += Number(r || 0)
      }
    } else if (action === 'set_type' && type) {
      for (const id of ids) {
        const r = await prisma.$executeRawUnsafe(`UPDATE Coupon SET type = ? WHERE id = ? AND merchantId = ?`, type, id, ADMIN_MERCHANT_ID)
        affected += Number(r || 0)
      }
    }

    // 埋点
    try {
      const aid = `al_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
      await prisma.$executeRawUnsafe(
        `INSERT INTO AuditLog (id, actorType, action, target, description, createdAt) VALUES (?, 'admin', ?, ?, ?, datetime('now'))`,
        aid, `batch_coupon_${action}`, ids.join(','), `批量${action} ${affected} 张券${type ? ` (type=${type})` : ''}`
      )
    } catch {}

    return NextResponse.json({ success: true, affected, action, type })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message }, { status: 500 })
  }
}
