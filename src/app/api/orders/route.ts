/**
 * /api/orders - 订单 API（Day 2 重构 → thin shell）
 *
 * 之前：292 行，订单创建 + 查询 + 积分触发全混在 route
 * 现在：thin shell，只做入参 parse + 调 domain + 错误转换
 *
 * 业务逻辑全部在 @/domain/order/service
 */

import { NextRequest, NextResponse } from 'next/server'
import { createOrder, getCustomerOrders } from '@/domain/order/service'
import { errorResponse, successResponse } from '@/lib/error'
import { enqueueFromOrder } from '@/lib/queue-sync'
import { verifyToken, extractToken } from '@/lib/jwt'
import { checkIpLimit, clientIp } from '@/lib/identity-auth'
import { requireStaffOrAdmin } from '@/lib/require-staff-or-admin'
// ⭐ 2026-10-28：软会话（预约后签发的 zhilin-soft-token）也要能查自己的订单
import { resolveIdentity, samePhone } from '@/lib/api-auth'

export const runtime = 'nodejs'


/** 手机号比对用归一化：去分隔符、去 +86 前缀。
 *  只用于「你传的 phone 是否等于 JWT 里的 phone」这一处比对，
 *  ⭐ 绝不用于查库 —— 查库一律用 JWT 原始值，避免格式不一致查不到单。 */
function normalizeForCompare(raw: string): string {
  const digits = String(raw || '').replace(/\D/g, '')
  if (digits.length === 13 && digits.startsWith('86')) return digits.slice(2)
  return digits
}


/** GET /api/orders?merchantCode=0005&phone=xxx&status=xxx&limit=50
 *
 * [加固 2026-10-18] 原为 IDOR：任意手机号可拉任意人订单。
 *  1) IP 限流 checkIpLimit，挡脚本批量刷
 *  2) 会员：验 zhilin-token JWT，只查本人；query 里的 phone 仅用于比对
 *  3) 店员/管理员：requireStaffOrAdmin，可查任意 phone（业务需要）
 *
 *  兼容性：7 个前台页面（chat/groupbuy/retail/pickup/pharmacist/points 等）
 *  都在登录态下调用且已带 zhilin-token cookie，故无需改动前端。
 */
export async function GET(request: NextRequest) {
  try {
    // 1) IP 限流
    const lim = checkIpLimit(`orders:get:${clientIp(request)}`, 30, 60_000)
    if (!lim.ok) {
      return NextResponse.json(
        { success: false, error: `请求过于频繁，请 ${lim.retryAfter} 秒后重试` },
        { status: 429 },
      )
    }

    const { searchParams } = new URL(request.url)
    const phoneParam = (searchParams.get('phone') || '').trim()
    const merchantCode = searchParams.get('merchantCode') || undefined
    const status = searchParams.get('status') || undefined
    const limit = parseInt(searchParams.get('limit') || '50')

    // 3) 店员/管理员优先：业务上需要查任意顾客
    const guard = await requireStaffOrAdmin(request)

    let phone: string
    if (guard.ok) {
      phone = phoneParam
      if (!phone) {
        return NextResponse.json(
          { success: false, error: '缺少 phone 参数' },
          { status: 400 },
        )
      }
    } else {
      // 2) 会员：JWT 里的 phone 才是唯一可信来源
      // ⭐ 2026-10-28：顾客端（扫码预约后）拿到的是软会话 cookie（zhilin-soft-token），
      //   它同样绑定手机号，也应该能查自己的订单。
      const identity = await resolveIdentity(request)
      if (identity && identity.phone) {
        if (phoneParam && !samePhone(phoneParam, identity.phone)) {
          return NextResponse.json(
            { success: false, error: '只能查看本人订单' },
            { status: 403 },
          )
        }
        phone = identity.phone
      } else {
        const cookieToken = /(^|;\s*)zhilin-token=([^;]+)/.exec(
          request.headers.get('cookie') || '',
        )
        const rawToken = (cookieToken
          ? decodeURIComponent(cookieToken[2])
          : null) || extractToken(request.headers.get('authorization'))
        const payload = rawToken ? verifyToken(rawToken) : null

        if (!payload?.phone) {
          return NextResponse.json(
            { success: false, error: '请先登录后再查看订单' },
            { status: 401 },
          )
        }
        // 你传的 phone 只能等于 JWT 里的，否则 403
        if (
          phoneParam &&
          normalizeForCompare(phoneParam) !== normalizeForCompare(payload.phone)
        ) {
          return NextResponse.json(
            { success: false, error: '只能查看本人订单' },
            { status: 403 },
          )
        }
        phone = payload.phone
      }
    }

    const result = await getCustomerOrders({ phone, merchantCode, status, limit })
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