/**
 * /api/groupbuy/create - 用户端发起拼团（奕霖 2026-08-05 15:22 需求）
 *
 * POST { productId, requiredPeople, expiresInDays }
 * - productId: 选中的商品
 * - requiredPeople: 2-10 人（默认 3）
 * - expiresInDays: 1-30 天（默认 7）
 * - 团购价 = 原价 × 0.7（最低 0.01 元）
 * - 创建人自动成为成员（currentPeople=1）
 * - status='active'
 *
 * 业务规则：
 * - 商品必须存在且有库存
 * - 团购价 < 原价
 * - 创建人 phone 必填
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

const DEFAULT_MERCHANT_CODE = 'G0001'

function genId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { productId, requiredPeople = 3, expiresInDays = 7, phone, productName, productSpec, originalPrice } = body

    if (!productId) {
      return NextResponse.json({ success: false, error: '缺少 productId' }, { status: 400 })
    }
    const rp = parseInt(String(requiredPeople))
    const eid = parseInt(String(expiresInDays))
    if (!Number.isInteger(rp) || rp < 2 || rp > 10) {
      return NextResponse.json({ success: false, error: '成团人数需 2-10' }, { status: 400 })
    }
    if (!Number.isInteger(eid) || eid < 1 || eid > 30) {
      return NextResponse.json({ success: false, error: '持续天数需 1-30' }, { status: 400 })
    }

    // 拿商户
    const merchants = await prisma.$queryRaw<any[]>`
      SELECT id FROM Merchant WHERE code = ${DEFAULT_MERCHANT_CODE} LIMIT 1
    `
    if (merchants.length === 0) {
      return NextResponse.json({ success: false, error: '商户不存在' }, { status: 404 })
    }
    const merchantId = merchants[0].id

    // 拿商品（验证 + 拿名字/规格/价格）
    const products = await prisma.$queryRaw<any[]>`
      SELECT id, name, spec, price, stock FROM Product
      WHERE id = ${productId} AND status = 'active' LIMIT 1
    `
    if (products.length === 0) {
      return NextResponse.json({ success: false, error: '商品不存在' }, { status: 404 })
    }
    const p = products[0]
    if (p.stock < 1) {
      return NextResponse.json({ success: false, error: '商品库存不足' }, { status: 400 })
    }

    const name = productName || p.name
    const spec = productSpec || p.spec || ''
    const origPrice = originalPrice != null ? Number(originalPrice) : Number(p.price)
    if (origPrice <= 0) {
      return NextResponse.json({ success: false, error: '商品价格异常' }, { status: 400 })
    }

    // ⭐ 奕霖 2026-08-05 18:08 智能让利：按商品自身毛利点分档算让利
    const cost = Number(p.costPrice || 0)
    const margin = cost > 0 ? (origPrice - cost) / origPrice : 0
    let tier: 'high' | 'mid' | 'low' | 'unprofitable' = 'unprofitable'
    if (margin >= 0.30) tier = 'high'
    else if (margin >= 0.15) tier = 'mid'
    else if (margin >= 0.05) tier = 'low'

    const ratioMap: Record<'high' | 'mid' | 'low', number[]> = {
      high: [0.95, 0.90, 0.85],
      mid:  [0.95, 0.92, 0.88],
      low:  [0.98, 0.95, 0.92],
    }
    let groupPrice: number
    let tier2 = origPrice, tier3 = origPrice, tier4 = origPrice
    if (tier === 'unprofitable') {
      // 毛利 < 5%：不参与拼团，让原价
      groupPrice = origPrice
    } else {
      const ratios = ratioMap[tier]
      const floor = Math.max(cost * 1.05, origPrice * ratios[2])
      tier2 = Math.max(origPrice * ratios[0], floor)
      tier3 = Math.max(origPrice * ratios[1], floor)
      tier4 = Math.max(origPrice * ratios[2], floor)
      tier2 = Math.round(tier2 * 100) / 100
      tier3 = Math.round(tier3 * 100) / 100
      tier4 = Math.round(tier4 * 100) / 100
      // 选当前人数对应的档
      const tierForPeople = rp >= 4 ? tier4 : rp === 3 ? tier3 : tier2
      groupPrice = Math.max(0.01, tierForPeople)
    }

    // 过期时间
    const expiresAt = new Date(Date.now() + eid * 86400000).toISOString()

    // insert
    const id = genId('gb')
    await prisma.$executeRaw`
      INSERT INTO GroupBuy
      (id, merchantId, productId, productName, productSpec, originalPrice, groupPrice, requiredPeople, currentPeople, status, expiresAt, createdAt)
      VALUES
      (${id}, ${merchantId}, ${productId}, ${name}, ${spec}, ${origPrice}, ${groupPrice}, ${rp}, 1, 'active', ${expiresAt}, datetime('now'))
    `

    // ⭐ 奕霖 2026-08-05 20:20：创建者不自动加为成员
    // 业务逻辑：发起拼团的人不能自己拼（需要拉人才能享拼团价）
    // 创建者只计为发起人，不计为 GroupMember
    // 拼团价 = 拉满 N 个外部人后才享
    // creatorPhone 存到 GroupBuy 表（ALTER TABLE）供 /api/groups/join 校验
    if (phone && /^1[3-9]\d{9}$/.test(phone)) {
      try {
        await prisma.$executeRawUnsafe(
          `UPDATE GroupBuy SET creatorPhone = ? WHERE id = ?`,
          phone, id
        )
      } catch (e) {
        // 字段不存在则尝试 ALTER
        try {
          await prisma.$executeRawUnsafe(`ALTER TABLE GroupBuy ADD COLUMN creatorPhone TEXT`)
          await prisma.$executeRawUnsafe(`UPDATE GroupBuy SET creatorPhone = ? WHERE id = ?`, phone, id)
        } catch {}
      }
    }

    return NextResponse.json({ success: true, id, groupPrice, expiresAt, message: '拼团创建成功' })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || '服务器错误' }, { status: 500 })
  }
}
