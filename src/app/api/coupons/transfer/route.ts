/**
 * /api/coupons/transfer - 优惠券转赠（奕霖 2026-08-05 15:22 需求）
 *
 * POST { couponId, fromPhone, toPhone }
 * - fromPhone: 当前用户手机号
 * - toPhone: 接收用户手机号
 * - 校验：券状态 = unused、未过期、属于 fromPhone
 * - 转赠：UPDATE Coupon SET phone = toPhone WHERE id = ? AND phone = fromPhone AND status = 'unused'
 *
 * 业务约束：只允许 unused 状态的券转赠，过期/已用券不可转赠
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { couponId, fromPhone, toPhone } = body

    if (!couponId || !fromPhone || !toPhone) {
      return NextResponse.json({ success: false, error: '缺少参数' }, { status: 400 })
    }
    if (!/^1[3-9]\d{9}$/.test(fromPhone) || !/^1[3-9]\d{9}$/.test(toPhone)) {
      return NextResponse.json({ success: false, error: '手机号格式错误' }, { status: 400 })
    }
    if (fromPhone === toPhone) {
      return NextResponse.json({ success: false, error: '不能转赠给自己' }, { status: 400 })
    }

    // 校验券状态（必须属于 fromPhone + unused + 未过期）
    const check = await prisma.$queryRaw<any[]>`
      SELECT id, status, expiresAt FROM Coupon
      WHERE id = ${couponId} AND phone = ${fromPhone}
      LIMIT 1
    `
    if (check.length === 0) {
      return NextResponse.json({ success: false, error: '优惠券不存在或不属于您' }, { status: 404 })
    }
    const c = check[0]
    if (c.status !== 'unused') {
      return NextResponse.json({ success: false, error: '只可转赠未使用的券' }, { status: 400 })
    }
    if (new Date(c.expiresAt).getTime() < Date.now()) {
      return NextResponse.json({ success: false, error: '优惠券已过期' }, { status: 400 })
    }

    // 转赠（带 status='unused' 二次校验，防并发）
    await prisma.$executeRaw`
      UPDATE Coupon
      SET phone = ${toPhone}
      WHERE id = ${couponId}
        AND phone = ${fromPhone}
        AND status = 'unused'
        AND expiresAt > datetime('now')
    `

    return NextResponse.json({ success: true, message: '转赠成功' })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || '服务器错误' }, { status: 500 })
  }
}
