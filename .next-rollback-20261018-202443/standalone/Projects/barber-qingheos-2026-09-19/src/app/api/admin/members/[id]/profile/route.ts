/**
 * /api/admin/members/[id]/profile - 行为画像（Day 1/5 重构 → thin shell）
 *
 * 鉴权：admin-jwt-auth（Day 4 迁移 ✓）
 * 业务：domain/member/service
 *
 * 不是 AI 编 — 全部从订单自动推导：
 * 1. RFM 分层 (R=最近下单 F=频率 M=金额)
 * 2. 复购品类 Top 5
 * 3. 价格敏感度 (平均商品价 / 平均客单价)
 * 4. 下单时段分布 (24h histogram)
 * 5. 行为推断标签 (从订单自动生成)
 * 6. CLV (生命周期价值估算)
 * 7. 月度趋势 (最近 6 个月消费)
 */

import { NextRequest } from 'next/server'
import { verifyAdminRequest, unauthorized } from '@/lib/admin-jwt-auth'
import { getMemberProfile } from '@/domain/member/service'
import { errorResponse, successResponse } from '@/lib/error'

export const runtime = 'nodejs'

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = verifyAdminRequest(request)
  if (!auth.ok) return unauthorized(auth)

  try {
    const { id } = await ctx.params
    const { customer, profile } = await getMemberProfile(id)
    return successResponse({ customer, profile })
  } catch (e) {
    return errorResponse(e)
  }
}
