import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_MERCHANT_ID } from '@/lib/admin-merchant'
import { prisma } from '@/lib/db'
import { verifyAdminRequest, unauthorized } from '@/lib/admin-jwt-auth'

export const runtime = 'nodejs'

function genId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8).toUpperCase()}`
}

/**
 * GET /api/admin/coupons
 * 列出所有券（含 expired/used）
 */
export async function GET(request: NextRequest) {
  const auth = verifyAdminRequest(request)
  if (!auth.ok) return unauthorized(auth)
  try {
    const coupons = await prisma.$queryRaw<any[]>`
      SELECT id, code, name, value, minSpend, status, usedAt,
             datetime(expiresAt, 'localtime') as expiresAt,
             datetime(createdAt, 'localtime') as createdAt
      FROM Coupon
      WHERE merchantId = ?
      ORDER BY createdAt DESC
      LIMIT 200
    `
    return NextResponse.json({ success: true, coupons })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message }, { status: 500 })
  }
}

/**
 * POST /api/admin/coupons
 * 创建一张新券（商家自定义）
 *
 * body: {
 *   name: string,
 *   value: number,         // 减多少
 *   minSpend: number,      // 满多少可用
 *   expiresInDays: number, // 有效天数
 *   type?: 'discount' | 'cash' | 'shipping'  (默认 discount)
 * }
 */
export async function POST(request: NextRequest) {
  const auth = verifyAdminRequest(request)
  if (!auth.ok) return unauthorized(auth)
  try {
    const body = await request.json().catch(() => ({}))
    const { name, value, minSpend = 0, expiresInDays = 30, type = 'discount' } = body

    if (!name || typeof name !== 'string' || name.length > 30) {
      return NextResponse.json({ success: false, error: '券名必填 ≤ 30 字' }, { status: 400 })
    }
    const v = Number(value)
    if (isNaN(v) || v <= 0) {
      return NextResponse.json({ success: false, error: '优惠值必须是正数' }, { status: 400 })
    }
    const ms = Number(minSpend)
    if (isNaN(ms) || ms < 0) {
      return NextResponse.json({ success: false, error: '满减门槛 ≥ 0' }, { status: 400 })
    }
    const days = Number(expiresInDays)
    if (!Number.isInteger(days) || days < 1 || days > 365) {
      return NextResponse.json({ success: false, error: '有效天数 1-365' }, { status: 400 })
    }
    if (ms > 0 && v >= ms) {
      return NextResponse.json({ success: false, error: '优惠值 < 满减门槛' }, { status: 400 })
    }

    // 唯一 code：CQ + 时间戳后 6 位 + 随机 4 位
    const code = `CQ${Date.now().toString(36).slice(-6).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`
    const id = genId('cp')
    const expiresAt = new Date(Date.now() + days * 86400000).toISOString()

    await prisma.$executeRaw`
      INSERT INTO Coupon
      (id, merchantId, code, name, type, value, minSpend, status, expiresAt, createdAt)
      VALUES
      (${id}, ?, ${code}, ${name}, ${type}, ${v}, ${ms}, 'unused', ${expiresAt}, datetime('now'))
    `

    // 埋点
    await prisma.$executeRawUnsafe(
      `INSERT INTO AuditLog (id, actorType, action, target, description, createdAt) VALUES (?, 'admin', 'create_coupon', ?, ?, datetime('now'))`,
      `al_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, id, `创建券: ${name} (满${ms}减${v}, ${days}天)`
    )

    return NextResponse.json({ success: true, coupon: { id, code, name, value, minSpend, expiresAt, status: 'unused' } })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message }, { status: 500 })
  }
}
