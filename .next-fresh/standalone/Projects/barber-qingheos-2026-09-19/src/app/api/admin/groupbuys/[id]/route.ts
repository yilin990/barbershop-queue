import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdminRequest, unauthorized } from '@/lib/admin-jwt-auth'
import { ADMIN_MERCHANT_ID } from '@/lib/admin-merchant'

export const runtime = 'nodejs'


/**
 * PATCH /api/admin/groupbuys/[id]
 * body: { status?: 'active' | 'closed' }
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyAdminRequest(request)
  if (!auth.ok) return unauthorized(auth)
  try {
    const { id } = await params
    const body = await request.json()
    const newStatus = body.status
    if (!['active', 'closed', 'success', 'expired'].includes(newStatus)) {
      return NextResponse.json({ success: false, error: 'status 非法' }, { status: 400 })
    }

    const exist: any[] = await prisma.$queryRawUnsafe('SELECT id, status FROM GroupBuy WHERE id = ? AND merchantId = ? LIMIT 1', id, ADMIN_MERCHANT_ID)
    if (exist.length === 0) {
      return NextResponse.json({ success: false, error: '拼团不存在' }, { status: 404 })
    }

    await prisma.$executeRawUnsafe('UPDATE GroupBuy SET status = ? WHERE id = ? AND merchantId = ?', newStatus, id, ADMIN_MERCHANT_ID)

    await prisma.$executeRawUnsafe(
      `INSERT INTO AuditLog (id, actorType, action, target, description, createdAt)
       VALUES (?, 'admin', 'patch_group', ?, ?, CURRENT_TIMESTAMP)`,
      `al_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      id,
      `改团状态 ${id}: ${exist[0].status} → ${newStatus}`
    )

    return NextResponse.json({ success: true, oldStatus: exist[0].status, newStatus })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/groupbuys/[id]
 * 删除团 + 所有成员
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyAdminRequest(request)
  if (!auth.ok) return unauthorized(auth)
  try {
    const { id } = await params
    const exist: any[] = await prisma.$queryRawUnsafe('SELECT id, productName FROM GroupBuy WHERE id = ? AND merchantId = ? LIMIT 1', id, ADMIN_MERCHANT_ID)
    if (exist.length === 0) {
      return NextResponse.json({ success: false, error: '拼团不存在' }, { status: 404 })
    }

    // 删成员 → 删团
    await prisma.$executeRawUnsafe('DELETE FROM GroupMember WHERE groupId = ?', id)
    await prisma.$executeRawUnsafe('DELETE FROM GroupBuy WHERE id = ? AND merchantId = ?', id, ADMIN_MERCHANT_ID)

    await prisma.$executeRawUnsafe(
      `INSERT INTO AuditLog (id, actorType, action, target, description, createdAt)
       VALUES (?, 'admin', 'delete_group', ?, ?, CURRENT_TIMESTAMP)`,
      `al_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      id,
      `删团 ${id}（${exist[0].productName}）`
    )

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}
