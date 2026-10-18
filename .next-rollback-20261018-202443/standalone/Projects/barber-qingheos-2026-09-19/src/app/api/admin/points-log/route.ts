import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { ADMIN_MERCHANT_ID } from '@/lib/admin-merchant'

export const runtime = 'nodejs'

/**
 * GET /api/admin/points-log
 * 商家后台查看积分流水
 *
 * Query:
 *   - phone?: 按手机号筛选
 *   - type?: earn / spend / refund / expire
 *   - limit?: 默认 100，最大 500
 *
 * 用 prisma.$queryRawUnsafe 组条件避免 Tagged template 转义麻烦
 */
function isAdmin(request: NextRequest) {
  const token = request.cookies.get('zhilin-admin-token')?.value
  return token && /^pin-\d{4}$/.test(token)
}

const MERCHANT_ID = 'm_grocery_001'

export async function GET(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: '请先登录商户后台' }, { status: 401 })
  }
  try {
    const { searchParams } = new URL(request.url)
    const phone = (searchParams.get('phone') || '').trim()
    const type = (searchParams.get('type') || '').trim()
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500)

    // 组条件
    const where: string[] = []
    const params: any[] = []
    if (phone) {
      where.push('pl.phone = ?')
      params.push(phone)
    }
    if (type && ['earn', 'spend', 'refund', 'expire'].includes(type)) {
      where.push('pl.type = ?')
      params.push(type)
    }
    const whereSql = where.length ? `AND ${where.join(' AND ')}` : ''
    const limitSql = Number.isFinite(limit) ? Math.max(1, Math.min(limit, 500)) : 100

    const sql = `
      SELECT
        pl.id, pl.userId, pl.phone, pl.delta, pl.balance,
        pl.type, pl.refType, pl.refId, pl.description, pl.createdAt,
        COALESCE(pl.amount, ABS(pl.delta), 0) as amount,
        COALESCE(pl.reason, pl.description, '') as reason,
        COALESCE(c.nickname, '') as customerNickname
      FROM PointsLog pl
      LEFT JOIN Customer c ON c.id = pl.customerId AND c.merchantId = pl.merchantId
      WHERE pl.merchantId = ?
        ${whereSql}
      ORDER BY pl.createdAt DESC
      LIMIT ${limitSql}
    `
    const rows: any[] = await prisma.$queryRawUnsafe(sql, MERCHANT_ID, ...params)

    return NextResponse.json({ items: rows, total: rows.length })
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 })
  }
}
