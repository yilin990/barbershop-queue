import { NextRequest, NextResponse } from 'next/server'
import { resolveByChannel, isValidChannel, IDENTITY_CHANNELS } from '@/lib/identity-core'
import { checkIpLimit, clientIp } from '@/lib/identity-auth'

export const runtime = 'nodejs'

/**
 * POST /api/identity/resolve
 *
 * ⭐ 身份中枢的入口。任何前端（小程序 / PWA / lite.html / 未来 App）都从这里进来：
 *
 *   { channel: 'wxmp', externalId: 'oABC123', unionId: 'uXYZ', phone?: '13800138000' }
 *
 * 返回：
 *   { identityId, phone, needsPhone, created }
 *
 * ⭐ 核心承诺：同一个 openid，从微信小程序进来、从 PWA 进来、从未来 App 进来，
 *   拿到的 identityId 完全一样 —— 因为身份是手机号，不是入口。
 *
 * ✅ 2026-10-15 加固（清禾）：
 *    · 限流 30 次/分钟/IP —— 防止批量刷号建垃圾身份
 *    · externalId / unionId 长度封顶 —— 防止拿超长串撑爆索引
 *    · 手机号仍然是 pending 时不返回明文，避免入口被当成认领凭据
 */
const MAX_EXT_ID = 128

export async function POST(request: NextRequest) {
  try {
    const lim = checkIpLimit('resolve:' + clientIp(request), 30, 60_000)
    if (!lim.ok) {
      return NextResponse.json({ success: false, error: '请求过于频繁，请稍后再试' }, { status: 429 })
    }

    const body = await request.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ success: false, error: '请求体不是合法 JSON' }, { status: 400 })
    }

    const { channel, externalId, unionId, nickname, avatar, phone } = body

    if (!isValidChannel(channel)) {
      return NextResponse.json(
        { success: false, error: `channel 不合法，可选：${IDENTITY_CHANNELS.join(' | ')}` },
        { status: 400 }
      )
    }
    if (typeof externalId !== 'string' || externalId.length === 0) {
      return NextResponse.json({ success: false, error: '缺少 externalId（openid）' }, { status: 400 })
    }
    // ⭐ 长度封顶，防脏数据
    if (externalId.length > MAX_EXT_ID) {
      return NextResponse.json({ success: false, error: 'externalId 过长' }, { status: 400 })
    }
    if (typeof unionId === 'string' && unionId.length > MAX_EXT_ID) {
      return NextResponse.json({ success: false, error: 'unionId 过长' }, { status: 400 })
    }

    const result = await resolveByChannel({
      channel,
      externalId: externalId.trim(),
      unionId: typeof unionId === 'string' && unionId ? unionId.trim() : null,
      nickname: typeof nickname === 'string' ? nickname.trim().slice(0, 64) || null : null,
      avatar: typeof avatar === 'string' ? avatar.trim().slice(0, 512) || null : null,
      phone: typeof phone === 'string' ? phone.trim() : null,
    })

    return NextResponse.json({
      success: true,
      data: {
        identityId: result.identity.id,
        phone: result.identity.phone.startsWith('pending_') ? null : result.identity.phone,
        needsPhone: result.needsPhone,
        created: result.created,
      },
    })
  } catch (err: any) {
    console.error('[identity/resolve]', err)
    return NextResponse.json(
      { success: false, error: err?.message ?? '身份解析失败' },
      { status: 500 }
    )
  }
}
