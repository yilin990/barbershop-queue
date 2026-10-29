import { NextRequest, NextResponse } from 'next/server'
import { verifyStaffPin } from '@/lib/staff-pin'
import { buildSetCookie, cookieSecure } from '@/lib/cookie'
import { signToken } from '@/lib/jwt'

export const runtime = 'nodejs'

// PIN 重试限流：5 次失败锁 15 分钟
const MAX_ATTEMPTS = 5
const LOCKOUT_MS = 15 * 60 * 1000

interface Attempt {
  count: number
  lockedUntil: number
  lastFail: number
}

// 内存级重试跟踪（生产环境建议 Redis，单进程够用）
const attemptsByIp = new Map<string, Attempt>()

// 定期清理过期记录
setInterval(() => {
  const now = Date.now()
  for (const [ip, a] of attemptsByIp) {
    if (a.lockedUntil < now && a.lastFail + 60 * 60 * 1000 < now) {
      attemptsByIp.delete(ip)
    }
  }
}, 5 * 60 * 1000).unref?.()

function getClientIp(req: NextRequest): string {
  // 多个 header 按优先级尝试，避免绕过
  const xff = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  if (xff && xff !== '127.0.0.1' && xff !== '::1') return `xff:${xff}`

  const realIp = req.headers.get('x-real-ip')
  if (realIp && realIp !== '127.0.0.1' && realIp !== '::1') return `real:${realIp}`

  // 本地 localhost 全部走同一 bucket（防止暴力）
  return 'local:localhost'
}

function checkLockout(ip: string): { locked: boolean; retryAfter?: number } {
  const a = attemptsByIp.get(ip)
  if (!a) return { locked: false }
  const now = Date.now()
  if (a.lockedUntil > now) {
    return { locked: true, retryAfter: Math.ceil((a.lockedUntil - now) / 1000) }
  }
  return { locked: false }
}

function recordFailure(ip: string) {
  const a = attemptsByIp.get(ip) || { count: 0, lockedUntil: 0, lastFail: 0 }
  a.count++
  a.lastFail = Date.now()
  if (a.count >= MAX_ATTEMPTS) {
    a.lockedUntil = Date.now() + LOCKOUT_MS
  }
  attemptsByIp.set(ip, a)
}

function recordSuccess(ip: string) {
  attemptsByIp.delete(ip)
}

/**
 * 店员 PIN 验证端点（防暴力）
 * POST /api/admin/auth/staff-pin
 * Body: { pin: "1234" }
 *
 * - 5 次错误 → 锁 15 分钟
 * - 正确 → set cookie zhilin-staff-session (60 分钟)
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request)

  // ⭐ 退出登录：httpOnly 的会话 cookie 只能由服务端清
  {
    const rawBody = await request.clone().json().catch(() => ({}))
    if (String(rawBody?.action || '') === 'logout') {
      const res = NextResponse.json({ success: true })
      res.headers.append('Set-Cookie', buildSetCookie('zhilin-staff-session', '', { maxAge: 0, path: '/', httpOnly: true }))
      res.headers.append('Set-Cookie', buildSetCookie('zhilin-staff-ok', '', { maxAge: 0, path: '/', httpOnly: false }))
      return res
    }
  }

  // 检查锁定
  const lock = checkLockout(ip)
  if (lock.locked) {
    return NextResponse.json(
      {
        success: false,
        error: `PIN 验证失败次数过多，请 ${Math.ceil(lock.retryAfter! / 60)} 分钟后重试`,
        locked: true,
        retryAfter: lock.retryAfter,
      },
      { status: 429 }
    )
  }

  try {
    const body = await request.json()
    const { pin } = body

    if (!pin || typeof pin !== 'string') {
      return NextResponse.json(
        { success: false, error: 'PIN 不能为空' },
        { status: 400 }
      )
    }

    if (!verifyStaffPin(pin)) {
      recordFailure(ip)
      const a = attemptsByIp.get(ip)!
      const remaining = MAX_ATTEMPTS - a.count

      // 写 audit
      console.log(`[Audit] staff_pin_fail ip=${ip} remaining=${remaining}`)

      if (a.lockedUntil > Date.now()) {
        return NextResponse.json(
          {
            success: false,
            error: `PIN 错误次数过多，已锁定 15 分钟`,
            locked: true,
            retryAfter: LOCKOUT_MS / 1000,
          },
          { status: 429 }
        )
      }

      return NextResponse.json(
        {
          success: false,
          error: `PIN 错误，剩余 ${remaining} 次尝试机会`,
          remaining,
        },
        { status: 401 }
      )
    }

    recordSuccess(ip)

    // ⭐ 2026-10-28：会话凭证改成 JWT（1 小时），不再把明文 PIN 放进 cookie
    let sessionToken: string
    try {
      sessionToken = signToken({ userId: 'staff_pin', phone: '', role: 'staff' }, '1h')
    } catch (e: any) {
      return NextResponse.json(
        { success: false, error: `服务端未配置 JWT_SECRET，无法签发会话：${e?.message || 'unknown'}` },
        { status: 503 },
      )
    }
    const expiresAt = Date.now() + 60 * 60 * 1000
    const cookie = buildSetCookie('zhilin-staff-session', sessionToken, {
      maxAge: 60 * 60,
      httpOnly: true,
      sameSite: 'lax',
      secure: cookieSecure(request),
    })
    // 客户端可读的无密钥标记（仅供 UI 判断「已解锁」）
    const markerCookie = buildSetCookie('zhilin-staff-ok', '1', {
      maxAge: 60 * 60,
      httpOnly: false,
      sameSite: 'lax',
      secure: cookieSecure(request),
    })

    // 写 audit
    console.log(`[Audit] staff_pin_success ip=${ip}`)

    return NextResponse.json(
      {
        success: true,
        message: 'PIN 验证成功',
        expiresIn: 60 * 60, // 60 分钟
      },
      { headers: { 'Set-Cookie': `${cookie}, ${markerCookie}` } }
    )
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e.message || 'PIN 验证失败' },
      { status: 500 }
    )
  }
}
