/**
 * /api/me/points-history - 我的积分流水（2026-08-02 奕霖需求）
 *
 * 返回当前用户的积分变动历史，按时间倒序
 *
 * Query:
 *   - limit: 每页条数（默认 20）
 *   - offset: 偏移（默认 0）
 *   - type: 'earn' | 'spend' | 'expire' | 'adjust'（可选过滤）
 *
 * 返回:
 *   { items: [...], total, hasMore, summary: { earned, spent, expireSoon } }
 */

import { NextRequest } from 'next/server'
import { getUserByToken } from '@/domain/customer/service'
import { extractToken } from '@/lib/jwt'
import { ADMIN_MERCHANT_ID } from '@/lib/admin-merchant'
import { prisma } from '@/lib/db'
import { errorResponse, successResponse } from '@/lib/error'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

const NOW = () => new Date()

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = extractToken(authHeader)

    // 奕霖 2026-09-06 升级：演示账户（无 token）走 13800138000 fallback，跟 summary 对齐
    let u: { id: string; phone: string; points: number } | null = null
    if (token) {
      u = await getUserByToken(token)
      if (!u) return successResponse({ success: false, error: '登录已过期，请重新登录', items: [], total: 0 })
    } else {
      // demo: 固定演示账户
      const demoRows = await prisma.$queryRaw<any[]>`
        SELECT id, phone, points FROM User WHERE phone = '13800138000' LIMIT 1
      `
      if (demoRows.length === 0) {
        return successResponse({ success: false, error: '演示账户不存在', items: [], total: 0 })
      }
      u = demoRows[0]
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10))
    const typeFilter = searchParams.get('type')?.trim() || ''

    // 关联 Customer（如果存在），用 phone 关联（merchantId 固定 ADMIN_MERCHANT_ID，不留 ? 占位符）
    const customerRows = await prisma.$queryRaw<any[]>`
      SELECT id FROM Customer WHERE phone = ${u.phone} AND merchantId = ${ADMIN_MERCHANT_ID} LIMIT 1
    `
    const customerId = customerRows[0]?.id || null

    // 查 PointsLog（通过 userId 关联，因为 phone 在 PointsLog 里没统一）
    // userId 是 User.id，PointsLog 也存了 userId 字段
    const typeClause = typeFilter ? `AND type = '${typeFilter}'` : ''
    const sql = `
      SELECT id, type, delta, balance, refType, refId, description, reason, expiresAt, createdAt, orderId
      FROM PointsLog
      WHERE userId = '${u.id}' ${typeClause}
      ORDER BY createdAt DESC
      LIMIT ${limit} OFFSET ${offset}
    `
    const rows = await prisma.$queryRawUnsafe<any[]>(sql)

    // 汇总
    const summaryRows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT
        COALESCE(SUM(CASE WHEN type='earn' THEN delta ELSE 0 END), 0) as earned,
        COALESCE(SUM(CASE WHEN type='spend' THEN ABS(delta) ELSE 0 END), 0) as spent,
        COALESCE(SUM(CASE WHEN type='expire' THEN ABS(delta) ELSE 0 END), 0) as expired,
        COUNT(*) as total
      FROM PointsLog
      WHERE userId = '${u.id}'
    `)

    // 即将过期（30 天内）
    const expireSoonRows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT COALESCE(SUM(delta), 0) as expireSoon
      FROM PointsLog
      WHERE userId = '${u.id}'
        AND type = 'earn'
        AND expiresAt IS NOT NULL
        AND expiresAt > datetime('now')
        AND julianday(expiresAt) - julianday('now') <= 30
        AND delta > 0
    `)

    const total = Number(summaryRows[0]?.total || 0)
    const summary = {
      earned: Number(summaryRows[0]?.earned || 0),
      spent: Number(summaryRows[0]?.spent || 0),
      expired: Number(summaryRows[0]?.expired || 0),
      expireSoon: Number(expireSoonRows[0]?.expireSoon || 0),
      currentBalance: Number(u.points || 0),
    }

    return successResponse({
      success: true,
      items: rows.map(r => ({
        id: r.id,
        type: r.type,
        delta: Number(r.delta),
        balance: Number(r.balance),
        refType: r.refType,
        refId: r.refId,
        description: r.description || r.reason || '',
        orderId: r.orderId,
        expiresAt: r.expiresAt,
        createdAt: r.createdAt,
      })),
      total,
      hasMore: offset + rows.length < total,
      summary,
    })
  } catch (e: any) {
    return errorResponse(e)
  }
}
