import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_MERCHANT_ID } from '@/lib/admin-merchant'
import { prisma } from '@/lib/db'
import { verifyAdminRequest, unauthorized } from '@/lib/admin-jwt-auth'

export const runtime = 'nodejs'


export async function GET(request: NextRequest) {
  const auth = verifyAdminRequest(request)
  if (!auth.ok) return unauthorized(auth)
  try {
    const feedbacks = await prisma.$queryRawUnsafe<any[]>(`
      SELECT f.id, f.type, f.content, f.status, f.createdAt,
             u.nickname AS userName, u.phone AS userPhone
      FROM Feedback f
      LEFT JOIN User u ON u.id = f.userId
      WHERE f.archived = 0
      ORDER BY f.createdAt DESC
      LIMIT 200
    `)
    return NextResponse.json({ success: true, feedbacks: feedbacks.map((f) => ({
      ...f,
      createdAt: f.createdAt instanceof Date ? f.createdAt.toISOString() : f.createdAt,
    })) })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}
