import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdminRequest, unauthorized } from '@/lib/admin-jwt-auth'
import { ADMIN_MERCHANT_ID } from '@/lib/admin-merchant'

export const runtime = 'nodejs'


/**
 * POST /api/admin/feedbacks/[id]/reply
 * 管理员回复反馈：body { reply: string }
 *
 * 副作用:
 *   - Feedback.status 改为 'resolved'
 *   - AuditLog 记录回复内容
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = verifyAdminRequest(request)
    if (!auth.ok) return unauthorized(auth)

    const { id } = await params
    const body = await request.json()
    const reply = (body.reply || '').trim().slice(0, 1000)

    if (!reply) {
      return NextResponse.json({ success: false, error: '回复内容不能为空' }, { status: 400 })
    }

    const feedbacks = await prisma.$queryRaw<{ id: string; content: string; status: string }[]>`SELECT id, content, status FROM Feedback WHERE id = ${id} LIMIT 1`
    const fb = feedbacks[0]
    if (!fb) return NextResponse.json({ success: false, error: '反馈不存在' }, { status: 404 })

    await prisma.$executeRaw`UPDATE Feedback SET status = 'resolved' WHERE id = ${id}`

    await prisma.$executeRaw`
      INSERT INTO AuditLog (id, actorType, actorId, action, target, description, createdAt)
      VALUES (${`al_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`}, 'admin', null, 'feedback_replied', ${id}, ${`回复反馈（${fb.content.slice(0, 30)}...）→ ${reply.slice(0, 80)}`}, CURRENT_TIMESTAMP)
    `

    return NextResponse.json({ success: true, id, reply, status: 'resolved' })
  } catch (error: any) {
    console.error('[feedbacks/reply POST]', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}