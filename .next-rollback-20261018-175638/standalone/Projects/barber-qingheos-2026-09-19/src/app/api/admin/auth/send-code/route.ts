import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { generateCode, sendSmsCode, isValidPhone } from '@/lib/sms'

export const runtime = 'nodejs'

/**
 * 商家管理后台：发送登录验证码
 * POST /api/admin/auth/send-code
 * Body: { phone: "13800138000" }
 *
 * 跟普通用户登录的区别：
 * - phone 必须属于 MerchantStaff 表（管理员权限）
 * - 没有 staff 记录 → 拒绝（安全门）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phone } = body

    if (!phone || !isValidPhone(phone)) {
      return NextResponse.json(
        { success: false, error: '请输入正确的手机号' },
        { status: 400 }
      )
    }

    // 安全门：只有 MerchantStaff 里的手机号能登录管理后台
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

    // 限流：1 分钟内只发一次
    const recentCodes = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM PhoneVerification
      WHERE phone = ${phone} AND used = 0 AND expiresAt > datetime('now')
      ORDER BY createdAt DESC LIMIT 1
    `

    if (recentCodes.length > 0) {
      return NextResponse.json(
        { success: false, error: '发送太频繁，请稍后再试' },
        { status: 429 }
      )
    }

    // 生成 6 位验证码
    const code = generateCode()

    // 存到 PhoneVerification（5 分钟过期）
    await prisma.phoneVerification.create({
      data: {
        phone,
        code,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        used: false,
      },
    })

    // 发送（mock: console.log；生产: 真实短信网关）
    const sent = await sendSmsCode(phone, code)
    if (!sent) {
      return NextResponse.json(
        { success: false, error: '短信发送失败，请稍后重试' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: '验证码已发送（5 分钟内有效）',
      // 开发环境：直接返回 code（生产环境删掉）
      devCode: process.env.NODE_ENV === 'development' ? code : undefined,
      merchant: {
        id: staff.merchantId,
        name: staff.merchant.name,
        role: staff.role,
      },
    })
  } catch (e: any) {
    console.error('[admin send-code]', e)
    return NextResponse.json(
      { success: false, error: '服务器错误: ' + (e?.message ?? 'unknown') },
      { status: 500 }
    )
  }
}
