/**
 * /api/orders/pickup - 取货码核销 API（Day 2 重构 → thin shell）
 *
 * 之前：226 行，验证 + 核销 + 小票 + AuditLog 全混在 route
 * 现在：thin shell，业务全部在 @/domain/order/service
 *
 * 店员操作：
 *   - 输入 6 位取货码
 *   - 验证 → 标记已取货 + 已完成
 *   - 触发会员积分到账
 *   - 可选打印小票
 */

import { NextRequest } from 'next/server'
import { getPickupInfo, redeemOrder } from '@/domain/order/service'
import { verifyStaffCookie } from '@/lib/staff-auth'
import { errorResponse, successResponse, AuthError } from '@/lib/error'

export const runtime = 'nodejs'

/** POST /api/orders/pickup - 核销取货码 */
export async function POST(request: NextRequest) {
  try {
    // 0. 验证店员 cookie
    const cookieHeader = request.headers.get('cookie') || ''
    const staffAuth = verifyStaffCookie(cookieHeader)
    if (!staffAuth.success) {
      throw new AuthError(staffAuth.error || '店员未登录，请先输入 PIN')
    }

    const body = await request.json()
    const result = await redeemOrder({
      code: body.code,
      staffId: body.staffId || staffAuth.pin,
      staffName: body.staffName,
      payMethod: body.payMethod,
      printReceipt: body.printReceipt,
    })
    const response = successResponse(result)
    if (body.printReceipt && result.order) {
      response.headers.set('X-Print-Job', `q-${Date.now()}`)
    }
    return response
  } catch (e) {
    return errorResponse(e)
  }
}

/** GET /api/orders/pickup?code=123456 - 查询取货码状态 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const info = await getPickupInfo(code || '')
    return successResponse({ order: info })
  } catch (e) {
    return errorResponse(e)
  }
}