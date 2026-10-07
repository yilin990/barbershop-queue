/**
 * /api/auth/quick-login - 本机一键登录（v0.9.0 by 清禾 2026-09-05）
 *
 * 流程：读 zhilin-trust cookie → 校验 device fingerprint → mint 新 token
 *
 * 安全机制：
 * - httpOnly cookie：JS 读不到，防 XSS
 * - device fingerprint = sha256(ua|lang)[0:32]：防 cookie 跨设备复用
 *   （拿到 cookie 的人换了浏览器或电脑就用不了）
 * - 每次都重新 mint token：trust cookie 不是凭证，要再换一次真 token
 *
 * 失败场景（客户端会退回验证码流程）：
 * - 本机没记过（首次访问）
 * - 换了浏览器 / 隐身模式 / UA 变了
 * - trust cookie 过期（30 天）
 * - 对应 user 已被注销
 */

import { NextRequest } from 'next/server'
import { createHash } from 'crypto'
import { signToken } from '@/lib/jwt'
import { prisma } from '@/lib/db'
import { parseCookie, buildSetCookie } from '@/lib/cookie'
import { errorResponse, successResponse, AuthError } from '@/lib/error'

export const runtime = 'nodejs'

function getFingerprint(request: NextRequest): string {
  const ua = request.headers.get('user-agent') ?? ''
  const lang = request.headers.get('accept-language') ?? ''
  return createHash('sha256').update(`${ua}|${lang}`).digest('hex').slice(0, 32)
}

export async function POST(request: NextRequest) {
  try {
    const trust = parseCookie(request.headers.get('cookie'), 'zhilin-trust')
    if (!trust || !trust.includes('.')) {
      // ⭐ 清禾 2026-10-07：这是正常登录状态，不是服务器故障
      // 原来用 new Error → 500，前端/监控当内部错误处理，是「一登录就打不开」的帮凶
      return errorResponse(new AuthError('本机未记住登录'))
    }
    const [userId, fingerprint] = trust.split('.')
    if (!userId || !fingerprint || fingerprint.length !== 32) {
      return errorResponse(new AuthError('trust cookie 损坏'))
    }
    // 设备指纹校验：cookie 拿到别的浏览器/电脑就用不了
    const expectedFp = getFingerprint(request)
    if (fingerprint !== expectedFp) {
      return errorResponse(new AuthError('本机环境变化，请重新登录'))
    }
    // 查 user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        phone: true,
        nickname: true,
        avatar: true,
        role: true,
        points: true,
        createdAt: true,
        lastLoginAt: true,
      },
    })
    if (!user) {
      return errorResponse(new Error('用户不存在'))
    }
    // 更新 lastLoginAt
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    })
    // mint 新 token
    const token = signToken({ userId: user.id, phone: user.phone, role: user.role })
    // 设 zhilin-token + user-id cookie（与 verify-code 保持一致）
    const response = successResponse({
      token,
      user: {
        ...user,
        createdAt: user.createdAt.toISOString(),
        lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      },
    })
    response.headers.append('Set-Cookie', buildSetCookie('zhilin-token', token, {
      maxAge: 30 * 24 * 3600,
      path: '/',
      sameSite: 'lax',
      httpOnly: false,
      secure: false,
    }))
    response.headers.append('Set-Cookie', buildSetCookie('zhilin-user-id', user.id, {
      maxAge: 30 * 24 * 3600,
      path: '/',
      sameSite: 'lax',
    }))
    return response
  } catch (e) {
    return errorResponse(e)
  }
}
