/**
 * /api/orders - 订单 API（Day 2 重构 → thin shell）
 *
 * 之前：292 行，订单创建 + 查询 + 积分触发全混在 route
 * 现在：thin shell，只做入参 parse + 调 domain + 错误转换
 *
 * 业务逻辑全部在 @/domain/order/service
 */

import { NextRequest } from 'next/server'
import { createOrder, getCustomerOrders } from '@/domain/order/service'
import { errorResponse, successResponse } from '@/lib/error'
import { enqueueFromOrder } from '@/lib/queue-sync'

export const runtime = 'nodejs'

/** GET /api/orders?merchantCode=0005&phone=xxx&status=xxx&limit=50 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const phone = searchParams.get('phone')
    const merchantCode = searchParams.get('merchantCode') || undefined
    const status = searchParams.get('status') || undefined
    const limit = parseInt(searchParams.get('limit') || '50')

    const result = await getCustomerOrders({ phone: phone || '', merchantCode, status, limit })
    return successResponse(result)
  } catch (e) {
    return errorResponse(e)
  }
}

/** POST /api/orders - 下单（自动触发会员积分）
 *
 *  v1.1.54: body.enqueue = true 时，下单成功后同步写 BarberQueue，
 *  让店长在 /merchant/queue 看到在线预约（原来只写 Order 表，店长永远看不到）。
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const result: any = await createOrder(body)

    if (body.enqueue) {
      const merchantId = String(body.merchantId || result?.merchantId || '').trim()
      if (!merchantId) {
        throw new Error('enqueue 需要 merchantId')
      }
      const queued = enqueueFromOrder({
        merchantId,
        orderNo: result?.orderNo,
        customerName: String(body.customerName || '顾客'),
        customerPhone: String(body.phone || ''),
        service: body.enqueueService || body.service,
        scheduledAt: body.scheduledAt,
      })
      return successResponse(
        { ...result, queueId: queued.queueId, queueOrderNo: queued.queueOrderNo },
        201,
      )
    }

    return successResponse(result, 201)
  } catch (e) {
    return errorResponse(e)
  }
}