import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { signToken } from '@/lib/jwt'
import { buildSetCookie } from '@/lib/cookie'

export const runtime = 'nodejs'

/**
 * 商家管理后台：验证码登录
 * POST /api/admin/auth/verify-code
 * Body: { phone: "13800138000", code: "123456" }
 *
 * 返回：JWT token + 商户信息
 * 副作用：写 cookie 'zhilin-admin-token' (7 天)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phone, code } = body

    if (!phone || !code) {
      return NextResponse.json(
        { success: false, error: '手机号和验证码不能为空' },
        { status: 400 }
      )
    }

    if (!/^1[3-9]\d{9}$/.test(phone)) {
      return NextResponse.json(
        { success: false, error: '手机号格式不正确' },
        { status: 400 }
      )
    }

    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { success: false, error: '验证码必须是 6 位数字' },
        { status: 400 }
      )
    }

    // 找未使用的验证码
    const verification = await prisma.phoneVerification.findFirst({
      where: {
        phone,
        code,
        used: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!verification) {
      return NextResponse.json(
        { success: false, error: '验证码无效或已过期' },
        { status: 401 }
      )
    }

    // 标记已用
    await prisma.phoneVerification.update({
      where: { id: verification.id },
      data: { used: true },
    })

    // 找 staff + merchant
    const staff = await prisma.merchantStaff.findFirst({
      where: { phone },
      include: { merchant: true },
    })

    if (!staff) {
      return NextResponse.json(
        { success: false, error: '该手机号未注册为商户管理员' },
        { status: 403 }
      )
    }

    // 发 JWT（7 天过期）
    const token = signToken({
      userId: staff.id,
      phone: staff.phone || phone,
      role: staff.role,
    })

    // 写 cookie（绕过 next/headers bug）
    const cookieValue = buildSetCookie('zhilin-admin-token', token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    })

    const response = NextResponse.json({
      success: true,
      token,
      staff: {
        id: staff.id,
        name: staff.name,
        role: staff.role,
        merchantId: staff.merchantId,
      },
      merchant: {
        id: staff.merchant.id,
        name: staff.merchant.name,
        code: staff.merchant.code,
      },
    })

    response.headers.append('Set-Cookie', cookieValue)
    return response
  } catch (e: any) {
    console.error('[admin verify-code]', e)
    return NextResponse.json(
      { success: false, error: '服务器错误: ' + (e?.message ?? 'unknown') },
      { status: 500 }
    )
  }
}
