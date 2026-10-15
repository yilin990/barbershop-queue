/**
 * /api/admin/today - 老板今日动作看板（Day 1/5 重构 → thin shell）
 *
 * 鉴权：admin-jwt-auth（Day 4 迁移 ✓）
 * 业务：domain/dashboard/today
 */

import { NextRequest } from 'next/server'
import { verifyAdminRequest, unauthorized } from '@/lib/admin-jwt-auth'
import { getTodayDashboard } from '@/domain/dashboard/today'
import { errorResponse, successResponse } from '@/lib/error'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const auth = verifyAdminRequest(request)
  if (!auth.ok) return unauthorized(auth)

  try {
    const today = await getTodayDashboard()
    return successResponse({ today })
  } catch (e) {
    return errorResponse(e)
  }
}
