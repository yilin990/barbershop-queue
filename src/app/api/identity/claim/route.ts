import { NextRequest, NextResponse } from 'next/server'
import { claimByPhone, isValidPhone } from '@/lib/identity-core'

export const runtime = 'nodejs'

/**
 * POST /api/identity/claim
 *
 * ⭐ 用手机号认领「待认领」身份。
 *
 *   { pendingPhone: 'pending_1752...', phone: '13800138000' }
 *
 * 认领之后：
 *   · 手机号成为主身份（全局唯一，跨门店跨入口通用）
 *   · 之前所有通道（openid）自动挂到这个身份上
 *   · 如果这个手机号已经有身份 → 走合并，不新建、不丢通道
 *
 * ⚠️ 生产环境必须在调用前校验短信验证码（本路由只负责写入逻辑）。
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ success: false, error: '请求体不是合法 JSON' }, { status: 400 })
    }

    const { pendingPhone, phone } = body

    if (typeof pendingPhone !== 'string' || !pendingPhone.startsWith('pending_')) {
      return NextResponse.json({ success: false, error: 'pendingPhone 不合法' }, { status: 400 })
    }
    if (!isValidPhone(phone)) {
      return NextResponse.json({ success: false, error: '手机号格式不正确' }, { status: 400 })
    }

    const result = await claimByPhone({ pendingPhone, phone: phone.trim() })

    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: { identityId: result.identity.id, phone: result.identity.phone },
    })
  } catch (err: any) {
    console.error('[identity/claim]', err)
    return NextResponse.json(
      { success: false, error: err?.message ?? '认领失败' },
      { status: 500 }
    )
  }
}
