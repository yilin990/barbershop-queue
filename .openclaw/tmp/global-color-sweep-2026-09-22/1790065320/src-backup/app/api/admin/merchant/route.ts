import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/jwt'
import { prisma } from '@/lib/db'
import { ADMIN_MERCHANT_ID } from '@/lib/admin-merchant'
import { parseCookie } from '@/lib/cookie'

export const runtime = 'nodejs'

async function requireAdmin(request: NextRequest) {
  const token = parseCookie(request.headers.get('cookie'), 'zhilin-admin-token')
  if (!token) return { ok: false as const, code: 401, error: '未登录' }
  const payload = verifyToken(token)
  if (!payload) return { ok: false as const, code: 401, error: 'token 无效或过期' }
  const staff = await prisma.merchantStaff.findUnique({
    where: { id: payload.userId },
  })
  if (!staff) return { ok: false as const, code: 401, error: '员工记录不存在' }
  return { ok: true as const, staff }
}

/**
 * 商家管理后台：读取商户完整信息
 * GET /api/admin/merchant
 *
 * role-based:
 * - owner/manager: 读自己 merchant 的所有字段
 * - staff: 只能读非敏感字段
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request)
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.code })
    }

    const merchant = await prisma.merchant.findUnique({
      where: { id: auth.staff.merchantId },
    })

    if (!merchant) {
      return NextResponse.json(
        { success: false, error: '商户不存在' },
        { status: 404 }
      )
    }

    if (auth.staff.role === 'staff') {
      return NextResponse.json({
        success: true,
        merchant: {
          id: merchant.id,
          name: merchant.name,
          shortName: merchant.shortName,
          logo: merchant.logo,
          phone: merchant.phone,
          address: merchant.address,
          businessHours: merchant.businessHours,
        },
      })
    }

    return NextResponse.json({
      success: true,
      merchant: {
        id: merchant.id,
        code: merchant.code,
        name: merchant.name,
        shortName: merchant.shortName,
        logo: merchant.logo,
        phone: merchant.phone,
        address: merchant.address,
        latitude: merchant.latitude,
        longitude: merchant.longitude,
        businessHours: merchant.businessHours,
        primaryColor: merchant.primaryColor,
        accentColor: merchant.accentColor,
        pointsRate: merchant.pointsRate,
        pointValue: merchant.pointValue,
        minPointsRedeem: merchant.minPointsRedeem,
        status: merchant.status,
        createdAt: merchant.createdAt.toISOString(),
        updatedAt: merchant.updatedAt.toISOString(),
      },
    })
  } catch (e: any) {
    console.error('[admin merchant GET]', e)
    return NextResponse.json(
      { success: false, error: '服务器错误: ' + (e?.message ?? 'unknown') },
      { status: 500 }
    )
  }
}

/**
 * 商家管理后台：更新商户信息
 * PUT /api/admin/merchant
 */
export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAdmin(request)
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.code })
    }

    if (auth.staff.role === 'staff') {
      return NextResponse.json(
        { success: false, error: '权限不足：只有 owner/manager 可编辑' },
        { status: 403 }
      )
    }

    const body = await request.json()

    const allowedFields = [
      'name', 'shortName', 'logo', 'phone', 'address',
      'latitude', 'longitude', 'businessHours',
      'primaryColor', 'accentColor',
      'pointsRate', 'pointValue', 'minPointsRedeem',
    ]

    const updateData: Record<string, any> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: '没有可更新的字段' },
        { status: 400 }
      )
    }

    const merchant = await prisma.merchant.update({
      where: { id: auth.staff.merchantId },
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      message: '保存成功',
      merchant: {
        id: merchant.id,
        name: merchant.name,
        shortName: merchant.shortName,
        logo: merchant.logo,
        phone: merchant.phone,
        address: merchant.address,
        businessHours: merchant.businessHours,
        primaryColor: merchant.primaryColor,
        accentColor: merchant.accentColor,
        updatedAt: merchant.updatedAt.toISOString(),
      },
    })
  } catch (e: any) {
    console.error('[admin merchant PUT]', e)
    return NextResponse.json(
      { success: false, error: '服务器错误: ' + (e?.message ?? 'unknown') },
      { status: 500 }
    )
  }
}
