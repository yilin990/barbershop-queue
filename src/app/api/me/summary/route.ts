/**
 * /api/me/summary - 当前用户摘要（Day 2 重构 → thin shell）
 *
 * 业务全部在 @/domain/customer/service
 *
 * 返回 role + points + totalSpent + totalOrders + nextTier 进度
 */

import { NextRequest } from 'next/server'
import { getUserSummary } from '@/domain/customer/service'
import { extractToken } from '@/lib/jwt'
import { errorResponse, successResponse } from '@/lib/error'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = extractToken(authHeader) ?? undefined
    const summary = await getUserSummary(token)
    return successResponse(summary)
  } catch (e) {
    return errorResponse(e)
  }
}