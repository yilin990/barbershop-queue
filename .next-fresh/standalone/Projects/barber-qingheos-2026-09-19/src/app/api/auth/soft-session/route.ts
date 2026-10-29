import { NextRequest, NextResponse } from 'next/server'
import Database from 'better-sqlite3'
import { resolveDbPath } from '@/lib/db-path'
import { signSoftToken } from '@/lib/jwt'
import { buildSetCookie, cookieSecure } from '@/lib/cookie'

export const runtime = 'nodejs'

/**
 * POST /api/auth/soft-session —— 顾客「软会话」（扫码预约后）
 *
 * 背景（2026-10-28）：
 *   理发店是「扫码进店、无需登录」的场景 —— 顾客报手机号就能取号/预约，
 *   这条流程**必须**保持匿名，不能一刀切锁掉（否则整店没法用）。
 *   但「查自己的排队单」这种读接口原来也是零鉴权（GET /api/queues?phone=），
 *   结果变成「按手机号跨商户枚举」，任何人都能查别人在哪家店剪了什么、付了多少钱。
 *
 * 怎么两全：
 *   顾客预约成功 → 服务端给「刚建的那一单」签一个绑定手机号的短 token（软会话）
 *   → 之后「查自己的单」必须带上这个 token，且登录态 phone 必须等于请求的 phone。
 *   攻击者只知道手机号、拿不到 queueId（queueId 只有顾客自己和服务店知道），
 *   就拿不到软会话 —— 枚举通道被堵住，而正常流程不受影响。
 *
 * Body: { phone: string, queueId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const phone = String(body.phone || '').replace(/\D/g, '')
    const queueId = String(body.queueId || '').trim()

    if (!/^1\d{10}$/.test(phone)) {
      return NextResponse.json({ success: false, error: '手机号格式不对' }, { status: 400 })
    }
    if (!queueId) {
      return NextResponse.json({ success: false, error: '缺少 queueId' }, { status: 400 })
    }

    // 凭证校验：这一单必须存在，且手机号对得上
    const db = new Database(resolveDbPath(), { readonly: true })
    let row: any = null
    try {
      row = db.prepare('SELECT id, customerPhone FROM BarberQueue WHERE id = ?').get(queueId)
    } finally {
      db.close()
    }
    if (!row) {
      return NextResponse.json({ success: false, error: '单号不存在' }, { status: 404 })
    }
    if (String(row.customerPhone || '').replace(/\D/g, '') !== phone) {
      return NextResponse.json({ success: false, error: '手机号与单号不匹配' }, { status: 403 })
    }

    const token = signSoftToken(phone)
    const res = NextResponse.json({ success: true, token, phone })
    res.headers.append(
      'Set-Cookie',
      buildSetCookie('zhilin-soft-token', token, {
        maxAge: 7 * 24 * 3600,
        path: '/',
        sameSite: 'lax',
        httpOnly: true,
        secure: cookieSecure(request),
      }),
    )
    return res
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || '签发失败' }, { status: 500 })
  }
}
