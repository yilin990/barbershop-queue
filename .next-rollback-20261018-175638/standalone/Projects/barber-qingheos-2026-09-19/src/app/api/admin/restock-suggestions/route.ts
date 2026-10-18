/**
 * /api/admin/restock-suggestions - 自动补货建议（Day 1/5 重构 → thin shell）
 *
 * 鉴权：admin-jwt-auth（Day 4 迁移 ✓）
 * 业务：domain/inventory/restock（P0 #7 自动补货 + #7.5 供应商+毛利率）
 *
 * 返 Top 20 + 汇总数字（给 today / daily_report 用）
 */

import { NextRequest } from 'next/server'
import { verifyAdminRequest, unauthorized } from '@/lib/admin-jwt-auth'
import { getRestockSuggestions } from '@/domain/inventory/restock'
import { errorResponse, successResponse } from '@/lib/error'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const auth = verifyAdminRequest(request)
  if (!auth.ok) return unauthorized(auth)

  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')

    const data = await getRestockSuggestions({ limit })
    return successResponse(data)
  } catch (e) {
    return errorResponse(e)
  }
}
