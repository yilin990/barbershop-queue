import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

/**
 * GET /api/groupbuy/list
 * 奕霖 2026-07-03：列出所有拼团
 */
export async function GET() {
  try {
    const groups = await prisma.$queryRaw<any[]>`
      SELECT id, productId, productName, productSpec,
             originalPrice, groupPrice, requiredPeople, currentPeople,
             status, expiresAt, createdAt
      FROM GroupBuy
      ORDER BY createdAt DESC
      LIMIT 100
    `
    return NextResponse.json({ success: true, groups })
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: '服务器错误: ' + (e?.message ?? 'unknown') },
      { status: 500 }
    )
  }
}