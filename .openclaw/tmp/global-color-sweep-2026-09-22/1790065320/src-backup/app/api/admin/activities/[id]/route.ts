import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdminRequest, unauthorized } from '@/lib/admin-jwt-auth'
import { ADMIN_MERCHANT_ID } from '@/lib/admin-merchant'

export const runtime = 'nodejs'


export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyAdminRequest(request)
  if (auth.ok === false) return unauthorized(auth)
  try {
    const { id } = await params
    const body = await request.json()
    const { title, subtitle, status, type, startAt, endAt, description, coverImage, productIds, rules } = body

    // 仅允许更新白名单字段
    const allowed: string[] = []
    const values: any[] = []
    if (title !== undefined) { allowed.push('title = ?'); values.push(String(title).trim()) }
    if (subtitle !== undefined) { allowed.push('subtitle = ?'); values.push(subtitle?.trim() || null) }
    if (status !== undefined && ['draft', 'published', 'ended', 'cancelled'].includes(status)) {
      allowed.push('status = ?'); values.push(status)
    }
    if (type !== undefined) { allowed.push('type = ?'); values.push(type) }
    if (startAt !== undefined) { allowed.push('startAt = ?'); values.push(new Date(startAt).toISOString()) }
    if (endAt !== undefined) { allowed.push('endAt = ?'); values.push(new Date(endAt).toISOString()) }
    if (description !== undefined) { allowed.push('description = ?'); values.push(description) }
    if (coverImage !== undefined) { allowed.push('coverImage = ?'); values.push(coverImage || null) }
    if (productIds !== undefined) {
      // productIds 是 JSON 字符串（数组）
      if (!Array.isArray(productIds)) {
        return NextResponse.json({ success: false, error: 'productIds 必须是数组' }, { status: 400 })
      }
      allowed.push('productIds = ?')
      values.push(JSON.stringify(productIds))
    }
    if (rules !== undefined) {
      if (typeof rules !== 'object' || rules === null) {
        return NextResponse.json({ success: false, error: 'rules 必须是对象' }, { status: 400 })
      }
      allowed.push('rules = ?')
      values.push(JSON.stringify(rules))
    }
    if (allowed.length === 0) {
      return NextResponse.json({ success: false, error: '没有要更新的字段' }, { status: 400 })
    }

    const sql = `UPDATE Activity SET ${allowed.join(', ')} WHERE id = ? AND merchantId = ?`
    values.push(id, ADMIN_MERCHANT_ID)
    await prisma.$executeRawUnsafe(sql, ...values)

    // 埋点
    await prisma.$executeRawUnsafe(`
      INSERT INTO AuditLog (id, actorType, actorId, action, target, description, createdAt)
      VALUES (?, 'admin', null, 'edit_activity', ?, ?, CURRENT_TIMESTAMP)
    `, `al_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, id, `编辑活动 ${id}：${allowed.length} 个字段`)

    return NextResponse.json({ success: true, updatedFields: allowed.length })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/activities/[id]
 * 删除活动（同时删除依赖：productIds/coverImage 等字段都已 inline 在 Activity 表，无外键）
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyAdminRequest(request)
  if (!auth.ok) return unauthorized(auth)
  try {
    const { id } = await params
    const exist = await prisma.$queryRawUnsafe(`SELECT id, title, status FROM Activity WHERE id = ? AND merchantId = ? LIMIT 1`, id, ADMIN_MERCHANT_ID)
    if (!exist || (exist as any[]).length === 0) {
      return NextResponse.json({ success: false, error: '活动不存在' }, { status: 404 })
    }
    await prisma.$executeRawUnsafe(`DELETE FROM Activity WHERE id = ? AND merchantId = ?`, id, ADMIN_MERCHANT_ID)
    // 埋点
    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO AuditLog (id, actorType, action, target, description, createdAt) VALUES (?, 'admin', 'delete_activity', ?, ?, datetime('now'))`,
        `al_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, id, `删除活动 ${id}（${(exist as any[])[0].title}）`
      )
    } catch {}
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || '服务器错误' }, { status: 500 })
  }
}
