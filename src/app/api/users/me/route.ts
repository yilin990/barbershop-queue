import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

/**
 * GET /api/users/me
 * 奕霖 2026-07-03：返回当前登录用户的完整信息（含 profile + preferences）
 */
export async function GET(request: NextRequest) {
  try {
    const auth = request.headers.get('authorization') || ''
    const token = auth.replace(/^Bearer\s+/i, '')
    if (!token) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 })
    }

    const userId = decodeUserIdFromToken(token)
    if (!userId) {
      return NextResponse.json({ success: false, error: 'token 无效' }, { status: 401 })
    }

    const rows = await prisma.$queryRaw<any[]>`
      SELECT id, phone, nickname, avatar, role, points, createdAt, lastLoginAt,
             age, gender, birthday, allergy, chronicDiseases, preferences, lastSymptoms
      FROM User
      WHERE id = ${userId}
      LIMIT 1
    `
    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: '用户不存在' }, { status: 404 })
    }
    const r = rows[0]
    return NextResponse.json({
      success: true,
      user: {
        id: r.id,
        phone: r.phone,
        nickname: r.nickname,
        avatar: r.avatar,
        role: r.role,
        points: r.points,
        createdAt: r.createdAt,
        lastLoginAt: r.lastLoginAt,
        profile: {
          age: r.age ?? undefined,
          gender: r.gender ?? undefined,
          birthday: r.birthday ?? undefined,
          allergy: r.allergy ?? undefined,
          chronicDiseases: r.chronicDiseases ?? undefined,
          lastSymptoms: r.lastSymptoms ?? undefined,
        },
        preferences: parsePreferences(r.preferences),
      },
    })
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: '服务器错误: ' + (e?.message ?? 'unknown') },
      { status: 500 }
    )
  }
}

function parsePreferences(s: string | null): any {
  if (!s) return {}
  try {
    return JSON.parse(s)
  } catch {
    return {}
  }
}

import { verifyToken } from '@/lib/jwt'
// SECURITY 修复：用 jwt.verify 解析真实 userId（之前 split('.')[0] 取的是 JWT header，不是 userId）
function decodeUserIdFromToken(token: string): string | null {
  const payload = verifyToken(token)
  return payload?.userId ?? null
}