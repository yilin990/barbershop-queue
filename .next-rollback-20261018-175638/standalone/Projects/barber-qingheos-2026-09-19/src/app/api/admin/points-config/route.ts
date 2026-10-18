import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { ADMIN_MERCHANT_ID } from '@/lib/admin-merchant'

export const runtime = 'nodejs'

/**
 * GET  /api/admin/points-config        - 获取当前商家积分配置
 * POST /api/admin/points-config        - 更新配置（upsert）
 *
 * 鉴权：cookie `zhilin-admin-token=pin-XXXX` (PIN 登录)
 * 数据表：PointsConfig（手工 create，prisma client 可能不含）
 */

function isAdmin(request: NextRequest) {
  const token = request.cookies.get('zhilin-admin-token')?.value
  if (!token) return false
  if (!/^pin-\d{4}$/.test(token)) return false
  // 任意 pin 验证通过（0-1 阶段简化）
  return true
}

const DEFAULT_MERCHANT_ID = 'm_grocery_001'

export async function GET(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: '请先登录商户后台' }, { status: 401 })
  }

  try {
    const rows: any[] = await prisma.$queryRaw`
      SELECT id, merchantId, earnRate, pointValue, minRedeem, pointsToYuanRate, maxDeductPercent, minPointsToUse, deductEnabled, updatedAt
      FROM PointsConfig
      WHERE merchantId = ${DEFAULT_MERCHANT_ID}
      LIMIT 1
    `
    if (rows.length === 0) {
      // 返回默认值（前端就显示了）
      return NextResponse.json({
        config: {
          id: null,
          merchantId: DEFAULT_MERCHANT_ID,
          earnRate: 0.05,
          pointValue: 0.01,
          minRedeem: 100,
          pointsToYuanRate: 0.02,
          maxDeductPercent: 50,
          minPointsToUse: 100,
          deductEnabled: true,
        },
        isDefault: true,
      })
    }
    return NextResponse.json({ config: rows[0], isDefault: false })
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: '请先登录商户后台' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const earnRate = Number(body.earnRate)
    const pointValue = Number(body.pointValue)
    const minRedeem = Number(body.minRedeem)
    const pointsToYuanRate = Number(body.pointsToYuanRate)
    const maxDeductPercent = Number(body.maxDeductPercent)
    const minPointsToUse = Number(body.minPointsToUse)
    const deductEnabled = body.deductEnabled !== false

    if (!Number.isFinite(earnRate) || earnRate < 0 || earnRate > 1) {
      return NextResponse.json({ error: 'earnRate 必须是 0-1 之间的小数（如 0.05 = 5%）' }, { status: 400 })
    }
    if (!Number.isFinite(pointValue) || pointValue <= 0) {
      return NextResponse.json({ error: 'pointValue 必须大于 0' }, { status: 400 })
    }
    if (!Number.isInteger(minRedeem) || minRedeem < 0) {
      return NextResponse.json({ error: 'minRedeem 必须是非负整数' }, { status: 400 })
    }
    if (!Number.isFinite(pointsToYuanRate) || pointsToYuanRate <= 0) {
      return NextResponse.json({ error: 'pointsToYuanRate 必须大于 0' }, { status: 400 })
    }
    if (!Number.isInteger(maxDeductPercent) || maxDeductPercent < 1 || maxDeductPercent > 100) {
      return NextResponse.json({ error: 'maxDeductPercent 必须是 1-100 之间的整数' }, { status: 400 })
    }
    if (!Number.isInteger(minPointsToUse) || minPointsToUse < 0) {
      return NextResponse.json({ error: 'minPointsToUse 必须是非负整数' }, { status: 400 })
    }

    await prisma.$executeRawUnsafe(
      `INSERT OR REPLACE INTO PointsConfig (id, merchantId, earnRate, pointValue, minRedeem, pointsToYuanRate, maxDeductPercent, minPointsToUse, deductEnabled, updatedAt)
       VALUES (
         COALESCE((SELECT id FROM PointsConfig WHERE merchantId = ?), ?),
         ?, ?, ?, ?, ?, ?, ?, ?, datetime('now')
       )`,
      DEFAULT_MERCHANT_ID,
      `pc_${DEFAULT_MERCHANT_ID}`,
      DEFAULT_MERCHANT_ID,
      earnRate,
      pointValue,
      minRedeem,
      pointsToYuanRate,
      maxDeductPercent,
      minPointsToUse,
      deductEnabled ? 1 : 0
    )

    return NextResponse.json({ success: true, config: { merchantId: DEFAULT_MERCHANT_ID, earnRate, pointValue, minRedeem, pointsToYuanRate, maxDeductPercent, minPointsToUse, deductEnabled } })
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 })
  }
}
