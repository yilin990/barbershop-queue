import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_MERCHANT_ID } from '@/lib/admin-merchant'
import { prisma } from '@/lib/db'
import { verifyAdminRequest, unauthorized } from '@/lib/admin-jwt-auth'

export const runtime = 'nodejs'


const VALID_TYPES = ['promotion', 'discount', 'new_arrival', 'points_double', 'flash_sale', 'banner'] as const

/**
 * GET /api/admin/activities
 * 活动列表（拉 Activity 表）
 */
export async function GET(request: NextRequest) {
  try {
    const activities = await prisma.activity.findMany({
      where: { merchantId: ADMIN_MERCHANT_ID },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    const now = new Date()
    const formatted = activities.map((a) => {
      let status: 'draft' | 'active' | 'ended' = 'draft'
      const start = a.startAt ? new Date(a.startAt) : null
      const end = a.endAt ? new Date(a.endAt) : null
      if (start && start > now) status = 'draft'
      else if (end && end < now) status = 'ended'
      else status = 'active'

      return {
        id: a.id,
        title: a.title,
        subtitle: a.subtitle,
        description: a.description,
        coverImage: a.coverImage,
        type: a.type,
        status,
        startAt: a.startAt?.toISOString() || null,
        endAt: a.endAt?.toISOString() || null,
        createdAt: a.createdAt.toISOString(),
        views: a.views ?? 0,
        clicks: a.clicks ?? 0,
        productIds: a.productIds ? JSON.parse(a.productIds) : [],
      }
    })

    return NextResponse.json({ success: true, activities: formatted })
  } catch (error: any) {
    console.error('[admin/activities] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

/**
 * POST /api/admin/activities
 * 创建新活动：body { title, subtitle, type, startAt?, endAt? }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = verifyAdminRequest(request)
    if (!auth.ok) return unauthorized(auth)

    const body = await request.json()
    const title = (body.title || '').trim().slice(0, 100)
    const subtitle = (body.subtitle || '').trim().slice(0, 200)
    const type = body.type

    if (!title) return NextResponse.json({ success: false, error: '活动标题不能为空' }, { status: 400 })
    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json({ success: false, error: `type 必须是 ${VALID_TYPES.join('|')}` }, { status: 400 })
    }

    const startAt = body.startAt ? new Date(body.startAt) : null
    const endAt = body.endAt ? new Date(body.endAt) : null

    if (startAt && endAt && startAt >= endAt) {
      return NextResponse.json({ success: false, error: '开始时间必须早于结束时间' }, { status: 400 })
    }

    const activityId = `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    // startAt/endAt 是 NOT NULL；未填则默认 now → now+30d
    const finalStart = startAt || new Date()
    const finalEnd = endAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    const description = String(body.description || '').slice(0, 5000) || null
    const coverImage = String(body.coverImage || '').slice(0, 500) || null
    // ⭐ v2.1（奕霖 2026-07-18 反馈）：活动 → 商品 关联（之前 hardcode '[]' 永不带商品）
    const productIds: string[] = Array.isArray(body.productIds)
      ? body.productIds.slice(0, 100).map((id: any) => String(id)).filter((s: string) => s.length > 0)
      : []

    await prisma.$executeRaw`
      INSERT INTO Activity (id, title, subtitle, description, coverImage, rules, productIds, type, startAt, endAt, status, createdAt, updatedAt, merchantId)
      VALUES (
        ${activityId},
        ${title},
        ${subtitle || null},
        ${description},
        ${coverImage},
        '{}',
        ${JSON.stringify(productIds)},
        ${type},
        ${finalStart},
        ${finalEnd},
        'published',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        (SELECT id FROM Merchant LIMIT 1)
      )
    `

    await prisma.$executeRaw`
      INSERT INTO AuditLog (id, actorType, actorId, action, target, description, createdAt)
      VALUES (${`al_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`}, 'admin', null, 'create_activity', ${'act_' + Date.now()}, ${`创建活动「${title}」（${type}）`}, CURRENT_TIMESTAMP)
    `

    return NextResponse.json({ success: true, title })
  } catch (error: any) {
    console.error('[admin/activities POST]', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
