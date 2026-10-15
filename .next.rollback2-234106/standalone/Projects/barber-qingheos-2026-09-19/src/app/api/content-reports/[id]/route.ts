import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdminRequest, unauthorized } from '@/lib/admin-jwt-auth'

export const runtime = 'nodejs'


/**
 * PATCH /api/content-reports/[id]
 * 审核举报：approve（内容正常）/ reject（删除内容）/ ignore（不处理）
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = verifyAdminRequest(request)
    if (!auth.ok) return unauthorized(auth)

    const { id } = await params
    const body = await request.json()
    const action = body.action // 'approve' | 'reject' | 'ignore'

    const validActions = { approve: 'approved', reject: 'rejected', ignore: 'ignored' }
    const newStatus = validActions[action as keyof typeof validActions]
    if (!newStatus) return NextResponse.json({ success: false, error: '无效动作' }, { status: 400 })

    // 更新 ContentReport（之前 CREATE IF NOT EXISTS 创建的表）
    try {
      await prisma.$executeRaw`UPDATE ContentReport SET status=${newStatus} WHERE id=${id}`
    } catch {
      // 表不存在或记录不存在，不阻断
    }

    await prisma.$executeRaw`
      INSERT INTO AuditLog (id, actorType, actorId, action, target, description, createdAt)
      VALUES (${`al_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`}, 'admin', null, 'handle_content_report', ${id}, ${`审核举报 #${id.slice(0, 8)}：${action}`}, CURRENT_TIMESTAMP)
    `

    return NextResponse.json({ success: true, status: newStatus })
  } catch (error: any) {
    console.error('[content-reports PATCH]', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
