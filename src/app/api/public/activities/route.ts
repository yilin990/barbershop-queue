import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

/**
 * GET /api/public/activities
 * 用户侧：拉所有 active 活动 + 关联拼团 + 满减券
 *
 * Query: type? (banner|promotion|flash_sale|...)
 *
 * 返回:
 * {
 *   success: true,
 *   banners: [],      // banner 类型
 *   flashSales: [],   // flash_sale 类型
 *   discounts: [],    // discount 类型
 *   coupons: [],      // 可领取的满减券（Coupon 表里 name 含"满 X 减 Y"）
 *   groupBuys: [],    // 拼团（带 currentPeople/requiredPeople）
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const now = new Date()

    // 1. 拉所有 published 且在有效期的活动
    const activities = await prisma.activity.findMany({
      where: {
        status: 'published',
        startAt: { lte: now },
        endAt: { gte: now },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    const banners = activities
      .filter((a) => a.type === 'banner')
      .map((a) => ({
        id: a.id,
        title: a.title,
        subtitle: a.subtitle || '',
        description: a.description || '',
        coverImage: a.coverImage || '',
        endAt: a.endAt.toISOString(),
      }))

    // Demo 阶段：如果没 banner 类型，把第一个 active 活动当 banner（视觉一致）
    if (banners.length === 0 && activities.length > 0) {
      const first = activities[0]
      banners.push({
        id: first.id,
        title: `🎉 ${first.title}`,
        subtitle: first.subtitle || '',
        description: first.description || '',
        coverImage: first.coverImage || '',
        endAt: first.endAt.toISOString(),
      })
    }

    const flashSales = activities
      .filter((a) => a.type === 'flash_sale')
      .map((a) => {
        // 从 productIds 解析商品 ID 列表
        let productIds: string[] = []
        try {
          const raw = a.productIds
          if (raw) {
            productIds = typeof raw === 'string' ? JSON.parse(raw) : raw
          }
        } catch {
          productIds = []
        }
        return {
          id: a.id,
          title: a.title,
          subtitle: a.subtitle || '',
          productIds,
          endAt: a.endAt.toISOString(),
        }
      })

    const discounts = activities
      .filter((a) => a.type === 'discount' || a.type === 'promotion')
      .map((a) => ({
        id: a.id,
        title: a.title,
        subtitle: a.subtitle || '',
        description: a.description || '',
        endAt: a.endAt.toISOString(),
      }))

    // 2. Coupon 表：demo 阶段——所有未使用且未过期的券都可领（不管 phone）
    // 上线后改成 "phone IS NULL OR phone = ''" 区分全局券 vs 个人券
    const couponsRaw = await prisma.$queryRaw<any[]>`
      SELECT id, name, value, minSpend, expiresAt
      FROM Coupon
      WHERE status = 'unused'
        AND (expiresAt IS NULL OR expiresAt > datetime('now'))
      ORDER BY minSpend ASC, value DESC
      LIMIT 20
    `
    const coupons = couponsRaw.map((c) => ({
      id: c.id,
      name: c.name,
      value: Number(c.value ?? 0),
      minSpend: Number(c.minSpend ?? 0),
      expiresAt: c.expiresAt,
    }))

    // 3. GroupBuy 表：active 状态的拼团 + 真实人数
    const groupBuysRaw = await prisma.$queryRaw<any[]>`
      SELECT g.id, g.productId, g.productName, g.productSpec,
             g.originalPrice, g.groupPrice, g.requiredPeople, g.currentPeople,
             g.expiresAt, g.status,
             (SELECT COUNT(*) FROM GroupMember m WHERE m.groupId = g.id) as memberCount
      FROM GroupBuy g
      WHERE g.status = 'active'
        AND g.expiresAt > datetime('now')
      ORDER BY g.createdAt DESC
      LIMIT 20
    `
    const groupBuys = groupBuysRaw.map((g) => ({
      id: g.id,
      productId: g.productId,
      productName: g.productName,
      productSpec: g.productSpec,
      originalPrice: Number(g.originalPrice ?? 0),
      groupPrice: Number(g.groupPrice ?? 0),
      requiredPeople: Number(g.requiredPeople ?? 3),
      currentPeople: Number(Math.max(Number(g.currentPeople ?? 1), Number(g.memberCount ?? 0))),
      expiresAt: g.expiresAt,
      icon: guessIcon(g.productName),
    }))

    // 把所有可能的 BigInt 转 Number（SQLite COUNT(*) 默认 BigInt）
    const safeBigInts = (obj: any): any => {
      const out: any = {}
      for (const k in obj) {
        const v = obj[k]
        if (typeof v === 'bigint') out[k] = Number(v)
        else out[k] = v
      }
      return out
    }

    return NextResponse.json({
      success: true,
      banners: banners.map(safeBigInts),
      flashSales: flashSales.map(safeBigInts),
      discounts: discounts.map(safeBigInts),
      coupons: coupons.map(safeBigInts),
      groupBuys: groupBuys.map(safeBigInts),
      serverTime: now.toISOString(),
    })
  } catch (error: any) {
    console.error('[public/activities] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// 商品名猜 icon（保留视觉一致性，等真实图片接入后可删）
function guessIcon(name: string): string {
  // ⭐ 奕霖 01:10: 全切造型主题
  // 造型
  if (/苹果/i.test(name)) return '🍎'
  if (/香蕉/i.test(name)) return '🍌'
  if (/草莓|莓/i.test(name)) return '🍓'
  if (/葡萄/i.test(name)) return '🍇'
  if (/西瓜/i.test(name)) return '🍉'
  if (/橙|橘|柑/i.test(name)) return '🍊'
  if (/柠檬/i.test(name)) return '🍋'
  if (/菠|凤梨/i.test(name)) return '🍍'
  if (/桃/i.test(name)) return '🍑'
  if (/樱桃/i.test(name)) return '🍒'
  if (/芒果/i.test(name)) return '🥭'
  // 造型
  if (/白菜|青菜|油麦|生菜|菠菜|造型|叶菜/i.test(name)) return '🥬'
  if (/番茄|西红柿/i.test(name)) return '🍅'
  if (/萝卜|胡萝卜/i.test(name)) return '🥕'
  if (/玉米/i.test(name)) return '🌽'
  if (/椒|辣椒/i.test(name)) return '🌶️'
  if (/茄子|茄/i.test(name)) return '🍆'
  if (/土豆|马铃薯|芋头|红薯/i.test(name)) return '🥔'
  if (/葱|姜|蒜/i.test(name)) return '🧄'
  if (/蘑菇|菌/i.test(name)) return '🍄'
  // 蛋/肉/水产
  if (/鸡蛋|土鸡蛋|鸭蛋|鹌鹑蛋/i.test(name)) return '🥚'
  if (/虾|蟹|鱼/i.test(name)) return '🦐'
  if (/鸡|鸭|牛|猪|羊|排骨/i.test(name)) return '🍖'
  // 拼盘/礼盒/混合 → 用便当盒 emoji (最贴近"一盒装")
  if (/拼盘|拼|尝鲜|礼盒|套装|组合|混合/i.test(name)) return '🍱'
  // 造型大类兜底
  if (/造型/i.test(name)) return '🍎'
  if (/造型/i.test(name)) return '🥬'
  // 药房时代的废弃规则已删 (避免误命中)
  return '🍱'  // 默认便当盒, 理发店最通用
}