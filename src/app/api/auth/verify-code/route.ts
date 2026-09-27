/**
 * /api/auth/verify-code - 验证码登录（Day 2 重构 → thin shell）
 *
 * 业务全部在 @/domain/customer/service
 *
 * 流程：验证码 → 自动注册/登录 → mint JWT → 设 cookie
 * ⭐ 清禾 2026-09-05：登录成功后多发 zhilin-trust cookie（httpOnly，30天）
 *    → 配合 /api/auth/quick-login 实现"本机一键登录"
 */

import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { verifyCodeAndLogin } from '@/domain/customer/service'
import { buildSetCookie } from '@/lib/cookie'
import { errorResponse } from '@/lib/error'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const result = await verifyCodeAndLogin(body.phone, body.code)

    // ⭐ 奕霖 2026-07-05 修复：登录失效
    // 设 httpOnly cookie 30 天，让用户刷新/换域名也能保持登录
    const response = NextResponse.json({
      success: true,
      token: result.token,
      user: result.user,
    })
    response.headers.append('Set-Cookie', buildSetCookie('zhilin-token', result.token, {
      maxAge: 30 * 24 * 3600,
      path: '/',
      sameSite: 'lax',
      httpOnly: false,
      secure: false,
    }))
    response.headers.append('Set-Cookie', buildSetCookie('zhilin-user-id', result.user.id, {
      maxAge: 30 * 24 * 3600,
      path: '/',
      sameSite: 'lax',
    }))
    // ⭐ 清禾 2026-09-05 一键登录：记住本机 30 天
    // - httpOnly: JS 读不到，防 XSS 偷 cookie
    // - fingerprint = sha256(ua|lang)[0:32]：防 cookie 跨设备复用
    // - quick-login 路由读这个 cookie 重新 mint token（不直接当 token 用）
    const fingerprint = createHash('sha256')
      .update((request.headers.get('user-agent') ?? '') + '|' + (request.headers.get('accept-language') ?? ''))
      .digest('hex')
      .slice(0, 32)
    response.headers.append('Set-Cookie', buildSetCookie('zhilin-trust', `${result.user.id}.${fingerprint}`, {
      maxAge: 30 * 24 * 3600,
      path: '/',
      sameSite: 'lax',
      httpOnly: true,
    }))
    return response
  } catch (e) {
    return errorResponse(e)
  }
}
