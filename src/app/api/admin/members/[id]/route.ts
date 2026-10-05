/**
 * /api/admin/members/[id] - 客户详情 / 操作（Day 1/5 重构 → thin shell）
 *
 * 鉴权：admin-jwt-auth（Day 4 迁移 ✓）
 * 业务：domain/member/service
 *
 *  - GET    客户详情 + 最近 10 单 + 最近 20 audit log
 *  - PATCH  4 种管理动作 (adjust_points/adjist_spent/toggle_status/rename) — 全部带 audit log
 */

import { NextRequest } from 'next/server'
import { verifyAdminRequest, unauthorized } from '@/lib/admin-jwt-auth'
import { getMemberDetail, modifyMember } from '@/domain/member/service'
import { errorResponse, successResponse } from '@/lib/error'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, ctx: RouteContext) {
  const auth = verifyAdminRequest(request)
  if (!auth.ok) return unauthorized(auth)

  try {
    const { id } = await ctx.params
    const detail = await getMemberDetail(id)
    return successResponse(detail)
  } catch (e) {
    return errorResponse(e)
  }
}

export async function PATCH(request: NextRequest, ctx: RouteContext) {
  const auth = verifyAdminRequest(request)
  if (!auth.ok) return unauthorized(auth)

  try {
    const { id } = await ctx.params
    const body = await request.json()
    const result = await modifyMember(id, body.action, body)
    return successResponse(result)
  } catch (e) {
    return errorResponse(e)
  }
}
