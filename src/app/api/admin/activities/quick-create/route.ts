import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { ADMIN_MERCHANT_ID } from '@/lib/admin-merchant'
import { verifyAdminRequest, unauthorized } from '@/lib/admin-jwt-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * 一键创建活动（奕霖 8-4 01:49 模板方案）
 * POST /api/admin/activities/quick-create
 * body: { template: 'full_reduction' | 'flash_sale' | 'new_user' | 'points_double', days?: number, productIds?: string[], merchantId?: string }
 */

const TEMPLATES: Record<string, any> = {
  full_reduction: {
    title: '满减特惠',
    subtitle: '满 X 减 Y · 自动叠加',
    type: 'promotion',
    rules: { 满100: '减10', 满200: '减30', 满500: '减80' },
  },
  flash_sale: {
    title: '限时秒杀',
    subtitle: '⚡ 倒计时 24 小时',
    type: 'flash_sale',
    rules: { discount: '8折', limited: '100件' },
  },
  new_user: {
    title: '新人专享',
    subtitle: '首单 9 折 · 仅限注册 7 天内',
    type: 'new_arrival',
    rules: { discount: '9折', limit: '首单', condition: 'phone NOT IN Customer OR createdAt > NOW - 7d' },
  },
  points_double: {
    title: '积分翻倍',
    subtitle: '消费 1 元 = 4 分（双倍）',
    type: 'points_double',
    rules: { rate: '4 分/元', multiplier: '2x' },
  },
}

export async function POST(request: NextRequest) {
  try {
    const auth = verifyAdminRequest(request)
    if (!auth.ok) return unauthorized(auth)

    const body = await request.json()
    const templateKey = body.template
    const days = body.days ?? 30
    const productIds = Array.isArray(body.productIds) ? body.productIds : []
    const merchantId = body.merchantId || ADMIN_MERCHANT_ID

    if (!TEMPLATES[templateKey]) {
      return NextResponse.json({
        success: false,
        error: `template 必须是 ${Object.keys(TEMPLATES).join('|')}`,
      }, { status: 400 })
    }

    const tpl = TEMPLATES[templateKey]
    const now = new Date()
    const endAt = new Date(now.getTime() + days * 86400 * 1000)
    const activityId = `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`

    const created = await prisma.activity.create({
      data: {
        id: activityId,
        merchantId,
        title: tpl.title,
        subtitle: tpl.subtitle,
        type: tpl.type,
        rules: JSON.stringify(tpl.rules),
        productIds: JSON.stringify(productIds),
        startAt: now,
        endAt,
        status: 'published',  // 模板创建直接发布
      },
    })

    return NextResponse.json({
      success: true,
      activity: {
        id: created.id,
        title: created.title,
        type: created.type,
        status: 'active',
        startAt: created.startAt.toISOString(),
        endAt: created.endAt.toISOString(),
      },
      message: `✅ 模板「${tpl.title}」已创建并发布（${days} 天有效期）`,
    })
  } catch (error: any) {
    console.error('[admin/activities/quick-create] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

/**
 * GET /api/admin/activities/quick-create
 * 返回所有可用模板（用于前端 UI 展示）
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    templates: Object.entries(TEMPLATES).map(([key, tpl]) => ({
      key,
      title: tpl.title,
      subtitle: tpl.subtitle,
      type: tpl.type,
      rules: tpl.rules,
    })),
  })
}