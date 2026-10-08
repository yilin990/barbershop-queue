import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { signToken } from '@/lib/jwt'
import { buildSetCookie } from '@/lib/cookie'
import { errorResponse, ValidationError, AuthError, RateLimitError } from '@/lib/error'
import {
  isManagerRole,
  verifyAccessCode,
  isManagerPinSet,
  setServerPin,
  verifyServerPin,
  pinLockRemaining,
  recordPinFail,
  recordPinSuccess,
} from '@/lib/manager-access'

export const runtime = 'nodejs'

/**
 * /api/auth/manager-pin —— 店长模式解锁 · v1.1.62 清禾 2026-10-08
 *
 * 奕霖 2026-10-08 16:22 选 B：把店长模式搬到服务端，
 * 这样同一个 PIN 在任何设备都能解锁，解锁后全站零门槛。
 *
 * 两种动作：
 *   set    —— 首次登记 PIN。需要访问码（只有奕霖有），防止被别人抢先设 PIN。
 *   verify —— 解锁。只给 PIN，服务端比对 hash，成功就签发店长 token。
 *
 * 🔴 递增锁定是本路由的核心安全设计（4 位数字只有 1 万种组合）：
 *   固定「错5次锁5分钟」意味着 1万种 / 5分钟 ≈ 34 天可穷举完，等于没锁。
 *   递增后：错5次锁5分钟 → 1小时 → 24小时 → 7天，成本指数增长。
 *   攻击者实际推不到 50 次，命中率 <0.5%。
 *
 * 签发的 token role 只是快照；真实鉴权由 require-manager 读 DB 实时 role，
 * 所以就算 role 后来变了，这个 token 也立刻失效。
 */

function getIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for') ||
    request.headers.get('x-real-ip') ||
    'unknown'
  )
    .split(',')[0]
    .trim()
}

function fmtDuration(ms: number): string {
  const min = Math.ceil(ms / 60000)
  if (min < 60) return min + ' 分钟'
  const hour = Math.round(min / 60)
  if (hour < 24) return hour + ' 小时'
  return Math.round(hour / 24) + ' 天'
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const action = String(body.action || 'verify')
    const pin = String(body.pin || '').trim()
    const ip = getIp(request)

    if (!/^\d{4,8}$/.test(pin)) {
      throw new ValidationError('请输入 4-8 位数字 PIN')
    }

    /* ---------- set：首次登记，需访问码 ---------- */
    if (action === 'set') {
      const code = String(body.accessCode || '').trim()
      if (!code) throw new ValidationError('首次设置需要访问码')
      if (!verifyAccessCode(code)) {
        throw new AuthError('访问码不正确')
      }
      setServerPin(pin)
      return NextResponse.json({ success: true, action: 'set' })
    }

    /* ---------- verify：解锁换 token ---------- */
    if (!isManagerPinSet()) {
      throw new AuthError('服务端还没登记店长 PIN，请先用访问码设置一次')
    }

    const locked = pinLockRemaining(ip)
    if (locked > 0) {
      throw new RateLimitError('尝试次数过多，请 ' + fmtDuration(locked) + '后再试')
    }

    if (!verifyServerPin(pin)) {
      const r = recordPinFail(ip)
      if (r.lockedFor > 0) {
        throw new RateLimitError('尝试次数过多，请 ' + fmtDuration(r.lockedFor) + '后再试')
      }
      throw new AuthError('PIN 不正确，还可以试 ' + r.fails + ' 次')
    }

    recordPinSuccess(ip)

    const manager = await prisma.user.findFirst({
      where: { role: '店长' },
      select: { id: true, phone: true, nickname: true, avatar: true, role: true, points: true, createdAt: true },
    })
    if (!manager || !isManagerRole(manager.role)) {
      throw new AuthError('库里没有店长账号，请先确认数据')
    }

    const token = signToken({
      userId: manager.id,
      phone: manager.phone,
      role: manager.role,
    })

    const response = NextResponse.json({
      success: true,
      action: 'verify',
      token,
      user: manager,
    })
    response.headers.append(
      'Set-Cookie',
      buildSetCookie('zhilin-token', token, {
        maxAge: 30 * 24 * 3600,
        path: '/',
        sameSite: 'lax',
        httpOnly: false,
        secure: false,
      }),
    )
    return response
  } catch (e) {
    return errorResponse(e)
  }
}
