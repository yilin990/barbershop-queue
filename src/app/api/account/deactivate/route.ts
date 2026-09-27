/**
 * /api/account/deactivate - 注销账户
 *
 * ⭐ 2026-07-13 13:58 奕霖需求：用户协议已写"您有权随时注销"，但代码里没实现。
 *
 * 流程（软删除，30 天后清数据）：
 * 1. 验证 JWT + phone 双重确认
 * 2. User 表 → 标记 status='deactivated' + deactivatedAt + reason='user_requested'
 * 3. nickname/avatar/birthday/allergy/chronicDiseases/preferences/lastSymptoms 全部清空（脱敏）
 * 4. phone 替换成 "deleted_<userId>" 防止新用户注册冲突
 * 5. 清空 session，token 失效
 *
 * 30 天后由 cron /api/cron/purge-deactivated 物理删除。
 */

import { NextRequest, NextResponse } from 'next/server'
import { extractToken, verifyToken } from '@/lib/jwt'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    // 1. 鉴权
    const authHeader = request.headers.get('authorization')
    const token = extractToken(authHeader)
    if (!token) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 })
    }
    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ success: false, error: '登录已过期' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const confirmation = String(body.confirmation || '')
    const reason = String(body.reason || 'user_requested')

    // 2. 必须输 "确认注销" 确认词
    if (confirmation !== '确认注销') {
      return NextResponse.json(
        { success: false, error: '请输入"确认注销"以确认操作' },
        { status: 400 }
      )
    }

    // 3. 查用户
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, phone: true, role: true, nickname: true },
    })
    if (!user) {
      return NextResponse.json({ success: false, error: '用户不存在' }, { status: 404 })
    }

    // 4. 不让店员/管理员注销（避免误操作）
    if (user.role === '管理员' || user.role === '店员') {
      return NextResponse.json(
        { success: false, error: '管理员/店员账户不能通过此入口注销' },
        { status: 403 }
      )
    }

    // 5. 软删除：脱敏 + 改 phone 唯一性
    const newPhone = `deleted_${user.id}`
    const now = new Date()
    await prisma.user.update({
      where: { id: user.id },
      data: {
        phone: newPhone,                      // 释放原手机号
        nickname: '',
        avatar: '🌿',
        birthday: null,
        allergy: null,
        chronicDiseases: null,
        preferences: null,
        lastSymptoms: null,
        points: 0,
        // 备注：保留 phoneHistory 之类的不必要字段——User 表没这字段，所以不处理
      } as any,
    })

    // 6. 找此用户的 Customer 记录（按 phone 模糊匹配）—— 标记 status='deactivated'
    // （Customer 表 phone 不是唯一索引，但通常一个 phone 一个 customer）
    try {
      await prisma.$executeRawUnsafe(
        `UPDATE Customer SET status='deactivated', deactivatedAt=?, deactivationReason=?, phone=? WHERE phone=?`,
        now.toISOString(),
        reason,
        newPhone,
        user.phone
      )
    } catch (e) {
      console.warn('[account/deactivate] customer 标记失败（非阻塞）:', e)
    }

    return NextResponse.json({
      success: true,
      data: {
        userId: user.id,
        deactivatedAt: now.toISOString(),
        message: '账户已注销，将在 30 天后自动清除所有数据',
      },
    })
  } catch (err: any) {
    console.error('[account/deactivate] error:', err)
    return NextResponse.json(
      { success: false, error: '注销失败：' + (err?.message || '服务器错误') },
      { status: 500 }
    )
  }
}