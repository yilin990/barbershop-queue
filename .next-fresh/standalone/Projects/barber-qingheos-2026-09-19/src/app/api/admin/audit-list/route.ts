import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_MERCHANT_ID } from '@/lib/admin-merchant'
import { prisma } from '@/lib/db'
import { verifyAdminRequest, unauthorized } from '@/lib/admin-jwt-auth'

export const runtime = 'nodejs'


/**
 * GET /api/admin/audit-list
 * query:
 *   - category: 'all' | 'product' | 'order' | 'feedback' | 'activity' | 'member' | 'config' | 'system'
 *   - action: 精确 action
 *   - days: 0=全部 1=今天 7=本周 30=本月
 *   - q: 描述/actor 搜索
 *   - limit: 200 默认
 *
 * 大分类映射：
 *   - product: restock / product_active / product_inactive / import_products / batch_category
 *   - order: order_completed / view_order / pickup
 *   - feedback: feedback / handle_feedback / feedback_replied / content_reported
 *   - activity: create_activity / edit_activity
 *   - member: toggle_status / adjust_points / adjust_spent
 *   - config: config_changed
 *   - system: stock_low / warn_merchant
 */
const CATEGORY_MAP: Record<string, string[]> = {
  product: ['restock', 'product_active', 'product_inactive', 'import_products', 'batch_category'],
  order: ['order_completed', 'view_order', 'pickup'],
  feedback: ['feedback', 'handle_feedback', 'feedback_replied', 'content_reported', 'content_report', 'handle_content_report'],
  activity: ['create_activity', 'edit_activity', 'delete_activity'],
  member: ['toggle_status', 'adjust_points', 'adjust_spent'],
  config: ['config_changed'],
  system: ['stock_low', 'warn_merchant'],
}

export async function GET(request: NextRequest) {
  const auth = verifyAdminRequest(request)
  if (!auth.ok) return unauthorized(auth)
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category') || 'all'
    const action = searchParams.get('action') || ''
    const days = Math.max(parseInt(searchParams.get('days') || '0'), 0)
    const q = (searchParams.get('q') || '').trim()
    const limit = Math.min(parseInt(searchParams.get('limit') || '200'), 500)

    // 构造 WHERE
    const conditions: string[] = []
    const params: any[] = []

    let actionFilter: string[] = []
    if (category !== 'all') {
      actionFilter = CATEGORY_MAP[category] || []
      if (actionFilter.length === 0) actionFilter = [category]
    }
    if (action) actionFilter = [action]
    if (actionFilter.length > 0) {
      const placeholders = actionFilter.map(() => '?').join(',')
      conditions.push(`action IN (${placeholders})`)
      params.push(...actionFilter)
    }

    if (days > 0) {
      conditions.push(`createdAt >= datetime('now', ?)`)
      params.push(`-${days} days`)
    }

    if (q) {
      conditions.push(`(description LIKE ? OR actorId LIKE ?)`)
      params.push(`%${q}%`, `%${q}%`)
    }

    // ⭐ v0.8.69: 加 merchantId 过滤(用 template literal,避免 ? 占位符跟普通字符串混用)
    const merchantFilter = `merchantId = '${ADMIN_MERCHANT_ID}'`
    const where = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')} AND ${merchantFilter}`
      : `WHERE ${merchantFilter}`
    const sql = `SELECT id, actorType, actorId, action, target, description, meta, createdAt
                 FROM AuditLog ${where}
                 ORDER BY createdAt DESC LIMIT ?`
    params.push(limit)

    const logs: any[] = await prisma.$queryRawUnsafe(sql, ...params)

    // 同时拉所有 action 的分类汇总（用于 UI 显示）
    const summaryRows: any[] = await prisma.$queryRaw`
      SELECT action, COUNT(*) AS cnt FROM AuditLog GROUP BY action ORDER BY cnt DESC
    `

    const summaryByCategory: Record<string, number> = {}
    for (const [cat, actions] of Object.entries(CATEGORY_MAP)) {
      const sum = summaryRows
        .filter((r) => actions.includes(r.action))
        .reduce((s, r) => s + Number(r.cnt || 0), 0)
      summaryByCategory[cat] = sum
    }
    summaryByCategory.all = summaryRows.reduce((s, r) => s + Number(r.cnt || 0), 0)

    return NextResponse.json({
      success: true,
      total: logs.length,
      logs: logs.map((l) => ({
        ...l,
        createdAt: typeof l.createdAt === 'string' ? l.createdAt : l.createdAt instanceof Date ? l.createdAt.toISOString() : String(l.createdAt),
      })),
      summary: {
        byCategory: summaryByCategory,
        byAction: summaryRows.map((r) => ({ action: r.action, count: Number(r.cnt || 0) })),
      },
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}