import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_MERCHANT_ID } from '@/lib/admin-merchant'
import { prisma } from '@/lib/db'
import { verifyAdminRequest, unauthorized } from '@/lib/admin-jwt-auth'

export const runtime = 'nodejs'


function genId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/**
 * GET /api/admin/groupbuys?status=active
 * 列出所有拼团（可选按 status 过滤）
 */
export async function GET(request: NextRequest) {
  const auth = verifyAdminRequest(request)
  if (!auth.ok) return unauthorized(auth)
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || ''
    const sql = status
      ? `SELECT * FROM GroupBuy WHERE merchantId = ? AND  status = ${JSON.stringify(status)} ORDER BY createdAt DESC`
      : `SELECT * FROM GroupBuy WHERE merchantId = ? ORDER BY createdAt DESC`
    const groups = await prisma.$queryRawUnsafe<any[]>(sql, ADMIN_MERCHANT_ID)
    // 每个团查真实成员数（防止 GroupBuy.currentPeople 漂移）
    const groupIds = groups.map((g) => g.id)
    let memberCounts: Record<string, number> = {}
    if (groupIds.length > 0) {
      const placeholders = groupIds.map(() => '?').join(',')
      const counts = await prisma.$queryRawUnsafe<any[]>(
        `SELECT groupId, COUNT(*) AS cnt FROM GroupMember WHERE groupId IN (${placeholders}) GROUP BY groupId`,
        ...groupIds
      )
      for (const r of counts) memberCounts[r.groupId] = Number(r.cnt)
    }
    return NextResponse.json({
      success: true,
      groups: groups.map((g) => ({
        ...g,
        currentPeople: Number(g.currentPeople),
        requiredPeople: Number(g.requiredPeople),
        originalPrice: Number(g.originalPrice),
        groupPrice: Number(g.groupPrice),
        actualMemberCount: memberCounts[g.id] ?? 0,
      })),
      total: groups.length,
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}

/**
 * POST /api/admin/groupbuys
 * body: { productId, requiredPeople, durationDays }
 * 开一个新拼团（自动复制商品信息）
 */
export async function POST(request: NextRequest) {
  const auth = verifyAdminRequest(request)
  if (!auth.ok) return unauthorized(auth)
  try {
    const body = await request.json()
    const productId = String(body.productId || '').trim()
    const requiredPeople = Math.max(2, Math.min(20, Number(body.requiredPeople || 3)))
    const durationDays = Math.max(1, Math.min(30, Number(body.durationDays || 7)))
    // 拼团最大库存（先占位，拿到商品真实库存后再 clamp）
    const maxStockRaw = body.maxStock
    let maxStock: number | null = (maxStockRaw === null || maxStockRaw === undefined || maxStockRaw === '') ? null : Number(maxStockRaw)

    if (!productId) {
      return NextResponse.json({ success: false, error: '请选择商品' }, { status: 400 })
    }

    // 查商品
    const productRows: any[] = await prisma.$queryRawUnsafe(
      'SELECT * FROM Product WHERE id = ? AND status = \'active\' LIMIT 1',
      productId
    )
    if (productRows.length === 0) {
      return NextResponse.json({ success: false, error: '商品不存在或已下架' }, { status: 404 })
    }
    const p = productRows[0]
    if (Number(p.stock) <= 0) {
      return NextResponse.json({ success: false, error: '商品库存为 0，无法开团' }, { status: 400 })
    }
    // 此时 maxStock = 用户输入的值，clamp 到商品库存上限
    if (maxStock !== null && Number.isFinite(maxStock)) {
      maxStock = Math.max(1, Math.min(Number(p.stock), maxStock))
    } else {
      maxStock = null // null = 不限（跟随商品库存）
    }

    // 团购价 = 原价 × 0.7（最低 0.01）
    const originalPrice = Number(p.price)
    const groupPrice = Math.max(0.01, Math.round(originalPrice * 0.7 * 100) / 100)

    // 默认商家
    const merchantRows: any[] = await prisma.$queryRawUnsafe('SELECT id FROM Merchant LIMIT 1')
    const merchantId = merchantRows[0]?.id || 'm_default'

    const id = genId('gb')
    await prisma.$executeRawUnsafe(
      `INSERT INTO GroupBuy (id, merchantId, activityId, productId, productName, productSpec, originalPrice, groupPrice, requiredPeople, currentPeople, status, expiresAt, createdAt, maxStock)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'active', datetime('now', '+${durationDays} days'), CURRENT_TIMESTAMP, ?)`,
      id, merchantId, null, productId, p.name, p.spec || null,
      originalPrice, groupPrice, requiredPeople, maxStock
    )

    // 埋点
    await prisma.$executeRawUnsafe(
      `INSERT INTO AuditLog (id, actorType, action, target, description, createdAt)
       VALUES (?, 'admin', 'create_group', ?, ?, CURRENT_TIMESTAMP)`,
      `al_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      id,
      `开拼团 ${id}：${p.name} ${groupPrice}/${requiredPeople}人 ${durationDays}天`
    )

    return NextResponse.json({
      success: true,
      group: {
        id, productId, productName: p.name, productSpec: p.spec,
        originalPrice, groupPrice, requiredPeople, currentPeople: 0,
        status: 'active', maxStock,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}
