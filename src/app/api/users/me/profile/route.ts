import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/jwt'

export const runtime = 'nodejs'

/**
 * PATCH /api/users/me/profile
 * 奕霖 2026-07-03:更新健康画像(年龄/过敏/慢病/最近症状)
 */
export async function PATCH(request: NextRequest) {
  try {
    const auth = request.headers.get('authorization') || ''
    const token = auth.replace(/^Bearer\s+/i, '')
    if (!token) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 })
    }
    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ success: false, error: 'token 无效或已过期' }, { status: 401 })
    }
    const userId = payload.userId
    if (!userId) {
      return NextResponse.json({ success: false, error: 'token 无效' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { age, gender, birthday, allergy, chronicDiseases, lastSymptoms } = body

    // 只更新有效字段
    const updates: string[] = []
    const values: any[] = []
    if (age !== undefined) { updates.push('age = ?'); values.push(Number(age) || null) }
    if (gender !== undefined) { updates.push('gender = ?'); values.push(gender || null) }
    if (birthday !== undefined) { updates.push('birthday = ?'); values.push(birthday || null) }
    if (allergy !== undefined) { updates.push('allergy = ?'); values.push(allergy || null) }
    if (chronicDiseases !== undefined) { updates.push('chronicDiseases = ?'); values.push(chronicDiseases || null) }
    if (lastSymptoms !== undefined) { updates.push('lastSymptoms = ?'); values.push(lastSymptoms || null) }

    if (updates.length === 0) {
      return NextResponse.json({ success: false, error: '没有要更新的字段' }, { status: 400 })
    }

    values.push(userId)
    await prisma.$executeRawUnsafe(
      `UPDATE User SET ${updates.join(', ')} WHERE id = ?`,
      ...values
    )

    return NextResponse.json({ success: true, message: '画像已更新' })
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: '服务器错误: ' + (e?.message ?? 'unknown') },
      { status: 500 }
    )
  }
}