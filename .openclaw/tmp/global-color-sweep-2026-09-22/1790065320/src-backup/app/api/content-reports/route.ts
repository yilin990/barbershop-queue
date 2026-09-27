import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { extractToken, verifyToken } from '@/lib/jwt'

export const runtime = 'nodejs'

/**
 * POST /api/content-reports
 * 提交内容举报（评论/故事）
 * 埋点：audit_log action='content_reported'
 */
export async function POST(request: NextRequest) {
  try {
    const token = extractToken(request.headers.get('authorization'))
    if (!token) return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 })
    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ success: false, error: '登录已过期' }, { status: 401 })

    const body = await request.json()
    const { targetType, targetId, reason, description } = body

    if (!targetType || !targetId || !reason) {
      return NextResponse.json({ success: false, error: '参数缺失' }, { status: 400 })
    }

    const validReasons = ['违规', '虚假', '隐私', '其他']
    if (!validReasons.includes(reason)) {
      return NextResponse.json({ success: false, error: '举报原因无效' }, { status: 400 })
    }

    const reportId = `cr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`

    // 存到 ContentReport 表（如果没有就先用 AuditLog 接力）
    try {
      await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS ContentReport (
          id TEXT PRIMARY KEY,
          userId TEXT NOT NULL,
          targetType TEXT NOT NULL,
          targetId TEXT NOT NULL,
          reason TEXT NOT NULL,
          description TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `
      await prisma.$executeRaw`
        INSERT INTO ContentReport (id, userId, targetType, targetId, reason, description)
        VALUES (${reportId}, ${payload.userId}, ${targetType}, ${targetId}, ${reason}, ${description || ''})
      `
    } catch (e) {
      console.warn('[ContentReport insert fallback]', (e as any).message)
    }

    // 埋点 audit_log（奕霖要看的）
    await prisma.$executeRaw`
      INSERT INTO AuditLog (id, actorType, actorId, action, target, description, createdAt)
      VALUES (${`al_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`}, 'customer', ${payload.userId}, 'content_reported', ${reportId}, ${`收到举报：${targetType === 'story' ? '故事' : targetType === 'comment' ? '评论' : '内容'} 分类：${reason}`}, CURRENT_TIMESTAMP)
    `

    return NextResponse.json({ success: true, reportId })
  } catch (error: any) {
    console.error('[content-reports POST]', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
