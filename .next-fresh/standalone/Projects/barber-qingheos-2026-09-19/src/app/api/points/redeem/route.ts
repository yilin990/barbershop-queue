import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { ADMIN_MERCHANT_ID } from '@/lib/admin-merchant'
import { verifyToken, extractToken } from '@/lib/jwt'

export const runtime = 'nodejs'

/**
 * POST /api/points/redeem
 * 用户用积分兑换商品（扣积分 + 扣库存 + 写流水）
 *
 * Body: { pointsProductId: string }
 * Auth: Bearer JWT
 *
 * 流程：
 *   1. 拿到 customerId（从 token / userId）
 *   2. 查 PointsProduct + Product 校验 active + 有库存
 *   3. 查 Customer.points 校验够用
 *   4. 拿 PointsConfig 校验达到最低兑换
 *   5. 单事务：
 *      - Customer.points -= pointsRequired
 *      - PointsProduct.stock -= 1
 *      - PointsLog INSERT type='spend'
 *   6. 返回 { success, pointsLeft, newStock }
 */

const MERCHANT_ID = ADMIN_MERCHANT_ID

export async function POST(request: NextRequest) {
  try {
    // 鉴权
    const authHeader = request.headers.get('authorization')
    const token = extractToken(authHeader)
    const payload = token ? verifyToken(token) : null
    if (!payload) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }
    const userId = (payload as any).userId || (payload as any).phone
    if (!userId) return NextResponse.json({ error: '无效的用户身份' }, { status: 401 })

    // 拿 customerId（通过 userId / phone）
    const userRows: any[] = await prisma.$queryRaw`
      SELECT id, phone FROM User WHERE id = ${userId} OR phone = ${userId} LIMIT 1
    `
    if (userRows.length === 0) return NextResponse.json({ error: '用户不存在' }, { status: 404 })
    const userPhone = userRows[0].phone

    const customerRows: any[] = await prisma.$queryRaw`
      SELECT id, points FROM Customer
      WHERE merchantId = ${MERCHANT_ID} AND phone = ${userPhone} LIMIT 1
    `
    if (customerRows.length === 0) return NextResponse.json({ error: '请先下单成为客户' }, { status: 404 })
    const customerId = customerRows[0].id
    const customerPoints = customerRows[0].points || 0

    // 解析 body
    const body = await request.json()
    const pointsProductId = String(body.pointsProductId || '').trim()
    if (!pointsProductId) return NextResponse.json({ error: 'pointsProductId 必填' }, { status: 400 })

    // 查积分商品
    const ppRows: any[] = await prisma.$queryRaw`
      SELECT pp.id, pp.pointsRequired, pp.stock, pp.status,
             p.name, p.shortName, p.spec, p.image, p.price as currentPrice
      FROM PointsProduct pp
      LEFT JOIN Product p ON p.id = pp.productId
      WHERE pp.id = ${pointsProductId} AND pp.merchantId = ${MERCHANT_ID} LIMIT 1
    `
    if (ppRows.length === 0) return NextResponse.json({ error: '积分商品不存在' }, { status: 404 })
    const pp = ppRows[0]

    if (pp.status !== 'active') return NextResponse.json({ error: '该商品已下架' }, { status: 400 })
    if (pp.stock <= 0) return NextResponse.json({ error: '库存不足' }, { status: 400 })

    // 校验最低兑换门槛
    const configRows: any[] = await prisma.$queryRaw`
      SELECT minRedeem, earnRate, pointValue FROM PointsConfig
      WHERE merchantId = ${MERCHANT_ID} LIMIT 1
    `
    const minRedeem = configRows[0]?.minRedeem ?? 100
    if (customerPoints < pp.pointsRequired) {
      return NextResponse.json({
        error: `积分不足（${customerPoints}/${pp.pointsRequired}）`,
        need: pp.pointsRequired,
        have: customerPoints,
      }, { status: 400 })
    }
    if (pp.pointsRequired < minRedeem) {
      return NextResponse.json({ error: `该商品需 ${pp.pointsRequired} 分，最低兑换 ${minRedeem} 分` }, { status: 400 })
    }

    // 事务：扣积分 + 扣库存 + 写流水
    const beforeBalance = customerPoints
    const afterBalance = customerPoints - pp.pointsRequired

    await prisma.$executeRawUnsafe(
      `UPDATE Customer SET points = ?, updatedAt = datetime('now') WHERE id = ?`,
      afterBalance, customerId
    )
    await prisma.$executeRawUnsafe(
      `UPDATE PointsProduct SET stock = stock - 1 WHERE id = ? AND stock > 0`,
      pointsProductId
    )
    await prisma.$executeRawUnsafe(
      `INSERT INTO PointsLog (id, merchantId, userId, phone, delta, balance, type, refType, refId, description, amount, customerId, reason, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, 'spend', 'points_product', ?, ?, ?, ?, ?, datetime('now'))`,
      `pl_spend_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      MERCHANT_ID,
      userRows[0].id,
      userPhone,
      -pp.pointsRequired,
      afterBalance,
      pointsProductId,
      pp.name,
      pp.pointsRequired,
      customerId,
      `兑换 ${pp.name} (-${pp.pointsRequired})`
    )

    // 写 AuditLog
    await prisma.$executeRawUnsafe(
      `INSERT INTO AuditLog (id, merchantId, actorType, actorId, action, targetType, targetId, payload, createdAt)
       VALUES (?, ?, 'user', ?, 'points_redeem', 'points_product', ?, ?, datetime('now'))`,
      `al_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      MERCHANT_ID,
      userRows[0].id,
      pointsProductId,
      `{"pointsUsed":${pp.pointsRequired},"productName":"${pp.name}"}`
    )

    return NextResponse.json({
      success: true,
      pointsUsed: pp.pointsRequired,
      pointsLeft: afterBalance,
      newStock: pp.stock - 1,
      productName: pp.name,
    })
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  // GET 列出所有可兑换的积分商品（用户侧用）
  try {
    const rows: any[] = await prisma.$queryRaw`
      SELECT
        pp.id, pp.pointsRequired, pp.originalPrice, pp.stock,
        p.id as productId, p.name, p.shortName, p.spec, p.image, p.unit, p.price as currentPrice
      FROM PointsProduct pp
      LEFT JOIN Product p ON p.id = pp.productId
      WHERE pp.merchantId = ${MERCHANT_ID} AND pp.status = 'active' AND pp.stock > 0
      ORDER BY pp.pointsRequired ASC
      LIMIT 100
    `
    return NextResponse.json({ items: rows })
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 })
  }
}
