import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/jwt'

export const runtime = 'nodejs'

/**
 * PATCH /api/users/me/basic
 * ⭐ 奕霖 2026-07-05 需求：让 /me 可编辑基础资料（昵称/头像/手机号换绑）
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

    const body = await request.json().catch(() => ({}))
    const { nickname, avatar, phone, birthday } = body

    // 字段白名单
    const updates: string[] = []
    const values: any[] = []

    if (typeof nickname === 'string' && nickname.trim() && nickname.length <= 20) {
      updates.push('nickname = ?')
      values.push(nickname.trim())
    }
    if (typeof avatar === 'string' && avatar.length <= 4) {
      updates.push('avatar = ?')
      values.push(avatar)
    }
    if (typeof phone === 'string' && /^1[3-9]\d{9}$/.test(phone)) {
      // 检查新手机号是否已被注册
      const existing = await prisma.$queryRaw<any[]>`
        SELECT id FROM User WHERE phone = ${phone} AND id != ${userId} LIMIT 1
      `
      if (existing.length > 0) {
        return NextResponse.json(
          { success: false, error: '该手机号已被其他账号绑定' },
          { status: 409 },
        )
      }
      updates.push('phone = ?')
      values.push(phone)
    }
    // ⭐ 奕霖 2026-07-05：支持生日（YYYY-MM-DD）
    if (typeof birthday === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(birthday)) {
      updates.push('birthday = ?')
      values.push(birthday)
    } else if (birthday === null || birthday === '') {
      updates.push('birthday = ?')
      values.push(null)
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, error: '没有可更新的字段' },
        { status: 400 },
      )
    }

    values.push(userId)
    await prisma.$executeRawUnsafe(
      `UPDATE User SET ${updates.join(', ')} WHERE id = ?`,
      ...values,
    )

    // ⭐ 奕霖 2026-08-05 14:56 反馈：/me 改名不同步后台 /admin/users
    // 根因：User 表（/me 改）vs Customer 表（/admin/users 读）是两个独立表
    // 修复：同步更新 Customer 表（按 phone 关联），保证后台商户管理能看到最新昵称
    try {
      const userPhoneRow = await prisma.$queryRaw<any[]>`
        SELECT phone FROM User WHERE id = ${userId} LIMIT 1
      `
      const userPhone = userPhoneRow[0]?.phone
      if (userPhone && updates.length > 0) {
        const customerUpdates: string[] = []
        const customerValues: any[] = []
        if (typeof nickname === 'string' && nickname.trim()) {
          customerUpdates.push('nickname = ?')
          customerValues.push(nickname.trim())
        }
        if (typeof phone === 'string' && /^1[3-9]\d{9}$/.test(phone)) {
          customerUpdates.push('phone = ?')
          customerValues.push(phone)
        }
        if (customerUpdates.length > 0) {
          customerValues.push(userPhone)
          await prisma.$executeRawUnsafe(
            `UPDATE Customer SET ${customerUpdates.join(', ')} WHERE phone = ?`,
            ...customerValues,
          )
        }
      }
    } catch (syncErr) {
      // 同步失败不能影响主流程（Customer 可能不存在该用户）
      console.warn('[users/me/basic] Customer sync skipped:', (syncErr as Error).message)
    }

    // 返回最新数据
    const rows = await prisma.$queryRaw<any[]>`
      SELECT id, phone, nickname, avatar, role, points, createdAt, lastLoginAt, birthday
      FROM User WHERE id = ${userId} LIMIT 1
    `
    const u = rows[0]
    return NextResponse.json({
      success: true,
      user: u
        ? {
            id: u.id,
            phone: u.phone,
            nickname: u.nickname,
            avatar: u.avatar,
            role: u.role,
            points: u.points,
            createdAt: u.createdAt,
            lastLoginAt: u.lastLoginAt,
            birthday: u.birthday,
          }
        : null,
      message: '基础资料已更新',
    })
  } catch (error) {
    console.error('[users/me/basic PATCH] Error:', error)
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 },
    )
  }
}
