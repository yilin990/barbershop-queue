import { NextRequest, NextResponse } from 'next/server'
import { claimByPhone, isValidPhone } from '@/lib/identity-core'
import { consumeSmsCode, checkIpLimit, clientIp } from '@/lib/identity-auth'

export const runtime = 'nodejs'

/**
 * POST /api/identity/claim
 *
 * ⭐ 用手机号认领「待认领」身份。
 *
 *   { pendingPhone: 'pending_1752...', phone: '13800138000', code: '123456' }
 *
 * 认领之后：
 *   · 手机号成为主身份（全局唯一，跨门店跨入口通用）
 *   · 之前所有通道（openid）自动挂到这个身份上
 *   · 如果这个手机号已经有身份 → 走合并，不新建、不丢通道
 *
 * ✅ 2026-10-15 鉴权已接入（清禾）：
 *    原来只要知道 pendingPhone（= identityId）就能把别人的身份绑到自己手机上，
 *    属于典型的身份冒领。现在必须先通过该手机号的短信验证码，验证码一次性核销。
 */
export async function POST(request: NextRequest) {
  try {
    const lim = checkIpLimit('claim:' + clientIp(request), 10, 10 * 60_000)
    if (!lim.ok) {
      return NextResponse.json(
        { success: false, error: `尝试次数过多，请 ${lim.retryAfter} 秒后再试` },
        { status: 429 }
      )
    }

    const body = await request.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ success: false, error: '请求体不是合法 JSON' }, { status: 400 })
    }

    const { pendingPhone, phone, code } = body

    if (typeof pendingPhone !== 'string' || !pendingPhone.startsWith('pending_')) {
      return NextResponse.json({ success: false, error: 'pendingPhone 不合法' }, { status: 400 })
    }
    if (!isValidPhone(phone)) {
      return NextResponse.json({ success: false, error: '手机号格式不正确' }, { status: 400 })
    }

    // ⭐ 必须先验短信验证码 —— 这是防冒领的唯一关卡
    const targetPhone = phone.trim()
    const ok = await consumeSmsCode(targetPhone, code)
    if (!ok) {
      return NextResponse.json(
        { success: false, error: '验证码错误或已过期' },
        { status: 403 }
      )
    }

    const result = await claimByPhone({ pendingPhone, phone: targetPhone })

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
