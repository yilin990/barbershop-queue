import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { prisma } from '@/lib/db'
import { signToken } from '@/lib/jwt'
import { buildSetCookie } from '@/lib/cookie'
import { errorResponse, ValidationError, AuthError, RateLimitError } from '@/lib/error'
import {
  verifyAccessCode,
  isManagerRole,
  isManagerAccessReady,
  lockRemaining,
  recordFail,
  recordSuccess,
} from '@/lib/manager-access'

export const runtime = 'nodejs'

/**
 * /api/auth/manager-login - 店长访问码登录 · v1.1.60 清禾 2026-10-08
 *
 * 奕霖需求（2026-10-08 15:41）：「我需求是每个设备都能打开这个页面」
 *
 * 解决的问题：店长以前只有短信验证码一条登录路，而 zhilin-token 是
 * host-only cookie + 绑设备指纹，换设备必重新登录。试点阶段这摩擦不可接受。
 *
 * 流程：手机号 + 访问码 → 校验 → mint 正常 JWT → 设三个 cookie。
 * 设完 cookie 后下游（quick-login / members API）完全走原有流程，零改动。
 *
 * 安全设计：
 * 1. 失败一律回同一句「手机号或访问码不正确」—— 不区分「手机号不存在」
 *    「不是店长」「码错了」，否则会被拿来枚举谁有店长权限
 * 2. 5 次失败锁 5 分钟，按 IP 记（服务端，绕不过浏览器清缓存）
 * 3. 恒定时间比较由 manager-access.ts 保证
 * 4. 签发的 token role 字段只是快照；真实鉴权由 require-manager 读 DB 实时 role
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

export async function POST(request: NextRequest) {
  try {
    if (!isManagerAccessReady()) {
      throw new AuthError('店长访问码未启用，请用短信验证码登录')
    }

    const body = await request.json()
    const phone = String(body.phone || '').trim()
    const accessCode = String(body.accessCode || '').trim()

    if (!phone || !accessCode) {
      throw new ValidationError('请填写手机号和访问码')
    }

    const ip = getIp(request)

    // 锁定检查放在最前面，省掉一次 DB 查询
    const locked = lockRemaining(ip)
    if (locked > 0) {
      const mins = Math.ceil(locked / 60000)
      throw new RateLimitError('尝试次数过多，请 ' + mins + ' 分钟后再试')
    }

    const fail = async (msg: string) => {
      const r = recordFail(ip)
      if (r.lockedFor > 0) {
        throw new RateLimitError('尝试次数过多，请 5 分钟后再试')
      }
      throw new AuthError(msg)
    }

    const user = await prisma.user.findUnique({
      where: { phone },
      select: { id: true, phone: true, nickname: true, avatar: true, role: true, points: true, createdAt: true },
    })

    // 用户不存在 / 不是店长 / 码不对 —— 三种情况回同一句话
    if (!user || !isManagerRole(user.role)) {
      await fail('手机号或访问码不正确')
    }
    if (!verifyAccessCode(accessCode)) {
      await fail('手机号或访问码不正确')
    }

    recordSuccess(ip)

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    })

    const token = signToken({ userId: user.id, phone: user.phone, role: user.role })

    const response = NextResponse.json({
      success: true,
      token,
      user: {
        id: user.id,
        phone: user.phone,
        nickname: user.nickname,
        avatar: user.avatar,
        role: user.role,
        points: user.points,
      },
    })

    const cookieBase = { maxAge: 30 * 24 * 3600, path: '/', sameSite: 'lax' as const }

    response.headers.append('Set-Cookie', buildSetCookie('zhilin-token', token, {
      ...cookieBase,
      httpOnly: false,
      secure: false,
    }))
    response.headers.append('Set-Cookie', buildSetCookie('zhilin-user-id', user.id, cookieBase))

    // 顺便记住这台设备，之后 quick-login 可免验证码直接续 token
    const fingerprint = createHash('sha256')
      .update((request.headers.get('user-agent') || '') + '|' + (request.headers.get('accept-language') || ''))
      .digest('hex')
      .slice(0, 32)
    response.headers.append(
      'Set-Cookie',
      buildSetCookie('zhilin-trust', user.id + '.' + fingerprint, {
        ...cookieBase,
        httpOnly: true,
      }),
    )

    return response
  } catch (e) {
    return errorResponse(e)
  }
}
