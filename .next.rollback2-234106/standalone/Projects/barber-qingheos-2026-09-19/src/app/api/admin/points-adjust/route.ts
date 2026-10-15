import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { ADMIN_MERCHANT_ID } from '@/lib/admin-merchant'
import { verifyAdminRequest, unauthorized } from '@/lib/admin-jwt-auth'

export const runtime = 'nodejs'

/**
 * POST /api/admin/points-adjust
 * 商家手动调整顾客积分(客服工具)
 *
 * ⭐ 2026-09-06 奕霖 Phase 3 体检补充 — 4 个模块都缺"客服工具"
 *
 * body: {
 *   phone: string,     // 顾客手机号
 *   delta: number,     // 积分变动(+送分/-扣分,不可为 0)
 *   reason: string,    // 必填,用于审计 + 显示在流水
 * }
 *
 * 规则:
 *   - Customer.points + delta >= 0 (不能扣成负数)
 *   - type 映射:delta>0 → earn / delta<0 → spend,reason 加 "[手动] " 前缀
 *   - 写 PointsLog(审计)+ 更新 Customer.points
 *   - 写 AuditLog(管理员操作)
 */
export async function POST(request: NextRequest) {
  const auth = verifyAdminRequest(request)
  if (!auth.ok) return unauthorized(auth)
  try {
    const body = await request.json().catch(() => ({}))
    const phone = String(body.phone || '').trim()
    const delta = Number(body.delta)
    const reason = String(body.reason || '').trim()

    if (!phone) return NextResponse.json({ success: false, error: 'phone 必填' }, { status: 400 })
    if (!/^1\d{10}$/.test(phone)) return NextResponse.json({ success: false, error: '手机号格式错误' }, { status: 400 })
    if (!Number.isInteger(delta) || delta === 0) return NextResponse.json({ success: false, error: 'delta 必须是非 0 整数' }, { status: 400 })
    if (!reason) return NextResponse.json({ success: false, error: 'reason 必填(审计需要)' }, { status: 400 })
    if (reason.length > 100) return NextResponse.json({ success: false, error: 'reason ≤ 100 字' }, { status: 400 })

    const customers: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, points FROM Customer WHERE merchantId = ? AND phone = ? LIMIT 1`,
      ADMIN_MERCHANT_ID, phone
    )
    if (customers.length === 0) {
      return NextResponse.json({ success: false, error: '顾客不存在' }, { status: 404 })
    }
    const customer = customers[0]
    const currentPoints = Number(customer.points) || 0
    const newBalance = currentPoints + delta
    if (newBalance < 0) {
      return NextResponse.json({
        success: false,
        error: `扣分过多:当前 ${currentPoints} 分,扣 ${Math.abs(delta)} 分后余额 ${newBalance}`,
      }, { status: 400 })
    }

    const logId = `pl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const type = delta > 0 ? 'earn' : 'spend'
    const tagReason = `[手动] ${reason}`

    await prisma.$executeRawUnsafe(
      `INSERT INTO PointsLog (id, merchantId, customerId, type, delta, amount, balance, reason, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      logId, ADMIN_MERCHANT_ID, customer.id, type, delta, delta, newBalance, tagReason
    )
    await prisma.$executeRawUnsafe(
      `UPDATE Customer SET points = ?, updatedAt = datetime('now') WHERE id = ?`,
      newBalance, customer.id
    )
    await prisma.$executeRawUnsafe(
      `INSERT INTO AuditLog (id, actorType, action, target, description, createdAt)
       VALUES (?, 'admin', 'manual_points_adjust', ?, ?, datetime('now'))`,
      `al_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      customer.id,
      `手动调分 ${phone}: ${delta > 0 ? '+' : ''}${delta} (${currentPoints} → ${newBalance}) 原因: ${reason}`
    )

    return NextResponse.json({
      success: true,
      balance: newBalance,
      delta,
      type,
      logId,
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}
