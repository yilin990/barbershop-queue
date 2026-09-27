import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { rawExecute, rawQuery } from '@/lib/db-helper'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * 活动埋点
 * GET /api/activity/track?action=view&id=xxx
 * GET /api/activity/track?action=click&id=xxx&phone=xxx
 * GET /api/activity/track?action=join&id=xxx&phone=xxx
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')  // view | click | join
  const id = searchParams.get('id')
  const phone = searchParams.get('phone') || null

  if (!action || !id) {
    return NextResponse.json({ success: false, error: 'missing action or id' }, { status: 400 })
  }
  if (!['view', 'click', 'join'].includes(action)) {
    return NextResponse.json({ success: false, error: 'invalid action' }, { status: 400 })
  }

  try {
    // 检查活动存在
    const activity = await prisma.activity.findUnique({ where: { id } })
    if (!activity) {
      return NextResponse.json({ success: false, error: 'activity not found' }, { status: 404 })
    }

    // 写埋点（ActivityEvent 不在 prisma schema，用 raw SQL）
    rawExecute(
      `INSERT INTO ActivityEvent (activityId, action, phone, userAgent) VALUES (?, ?, ?, ?)`,
      [id, action, phone, req.headers.get('user-agent') || null]
    )

    // 更新聚合计数
    if (action === 'view') {
      await prisma.activity.update({ where: { id }, data: { views: { increment: 1 } } })
    } else if (action === 'click') {
      await prisma.activity.update({ where: { id }, data: { clicks: { increment: 1 } } })
    }

    // 重新查最新计数
    const updated = await prisma.activity.findUnique({
      where: { id },
      select: { views: true, clicks: true },
    })

    return NextResponse.json({
      success: true,
      action,
      activityId: id,
      views: updated?.views || 0,
      clicks: updated?.clicks || 0,
    })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}