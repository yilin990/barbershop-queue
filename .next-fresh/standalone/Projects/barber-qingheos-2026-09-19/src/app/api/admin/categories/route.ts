import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { ADMIN_MERCHANT_ID } from '@/lib/admin-merchant'
import { verifyAdminRequest, unauthorized } from '@/lib/admin-jwt-auth'

export const runtime = 'nodejs'


/**
 * GET /api/admin/categories
 * 返回所有分类 + 每个分类商品数（label + code 维度）
 */
export async function GET(request: NextRequest) {
  try {
    const auth = verifyAdminRequest(request)
    if (!auth.ok) return unauthorized(auth)

    // 按 categoryLabel 聚合（中文标签优先）
    const rows: any[] = await prisma.$queryRaw`
      SELECT
        COALESCE(categoryLabel, category, '未分类') AS label,
        category AS code,
        COUNT(*) AS cnt
      FROM Product
      WHERE status = 'active' AND merchantId = ${ADMIN_MERCHANT_ID}
      GROUP BY COALESCE(categoryLabel, category, '未分类'), category
      ORDER BY cnt DESC
    `

    const categories = rows.map((r) => ({
      label: r.label || '未分类',
      code: r.code || '',
      count: Number(r.cnt || 0),
    }))

    return NextResponse.json({ success: true, categories, total: categories.length })
  } catch (error: any) {
    console.error('[admin/categories]', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}