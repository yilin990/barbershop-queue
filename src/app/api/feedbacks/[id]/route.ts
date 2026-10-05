import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdminRequest, unauthorized } from '@/lib/admin-jwt-auth'

export const runtime = 'nodejs'


/**
 * PATCH /api/feedbacks/[id]
 * 管理员处置反馈：read / replied / closed
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = verifyAdminRequest(request)
    if (!auth.ok) return unauthorized(auth)

    const { id } = await params
    const body = await request.json()
    const action = body.action // 'read' | 'reply' | 'close'

    const validActions = { read: 'read', reply: 'replied', close: 'closed' }
    const newStatus = validActions[action as keyof typeof validActions]
    if (!newStatus) return NextResponse.json({ success: false, error: '无效动作' }, { status: 400 })

    await prisma.$executeRaw`UPDATE Feedback SET status=${newStatus} WHERE id=${id}`

    // 埋点
    await prisma.$executeRaw`
      INSERT INTO AuditLog (id, actorType, actorId, action, target, description, createdAt)
      VALUES (${`al_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`}, 'admin', null, 'handle_feedback', ${id}, ${`处置反馈 #${id.slice(0, 8)}：${action}`}, CURRENT_TIMESTAMP)
    `

    return NextResponse.json({ success: true, status: newStatus })
  } catch (error: any) {
    console.error('[feedbacks PATCH]', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
