/**
 * /api/auth/send-code - 发手机验证码（Day 2 重构 → thin shell）
 *
 * 业务全部在 @/domain/customer/service
 */

import { NextRequest } from 'next/server'
import { sendVerificationCode } from '@/domain/customer/service'
import { errorResponse, successResponse } from '@/lib/error'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const phone = body.phone
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'

    const result = await sendVerificationCode(phone, ip)
    return successResponse(result)
  } catch (e) {
    return errorResponse(e)
  }
}