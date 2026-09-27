import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/jwt'
import { prisma } from '@/lib/db'
import { parseCookie } from '@/lib/cookie'

export const runtime = 'nodejs'

/**
 * 商家管理后台：读取当前登录的 staff + merchant
 * GET /api/admin/auth/me
 *
 * 用 cookie 'zhilin-admin-token' 鉴权
 */
export async function GET(request: NextRequest) {
  try {
    const token = parseCookie(request.headers.get('cookie'), 'zhilin-admin-token')

    if (!token) {
      return NextResponse.json(
        { success: false, error: '未登录', code: 'NOT_LOGGED_IN' },
        { status: 401 }
      )
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json(
        { success: false, error: 'token 无效或过期', code: 'INVALID_TOKEN' },
        { status: 401 }
      )
    }

    const staff = await prisma.merchantStaff.findUnique({
      where: { id: payload.userId },
      include: { merchant: true },
    })

    if (!staff) {
      return NextResponse.json(
        { success: false, error: '员工记录不存在', code: 'STAFF_NOT_FOUND' },
        { status: 401 }
      )
    }

    return NextResponse.json({
      success: true,
      staff: {
        id: staff.id,
        name: staff.name,
        role: staff.role,
        phone: staff.phone,
        merchantId: staff.merchantId,
      },
      merchant: {
        id: staff.merchant.id,
        name: staff.merchant.name,
        code: staff.merchant.code,
      },
    })
  } catch (e: any) {
    console.error('[admin me]', e)
    return NextResponse.json(
      { success: false, error: '服务器错误: ' + (e?.message ?? 'unknown') },
      { status: 500 }
    )
  }
}
