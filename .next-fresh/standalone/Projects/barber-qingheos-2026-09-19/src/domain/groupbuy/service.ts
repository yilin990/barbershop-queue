/**
 * 拼团 domain — 抽离拼团加入 + 详情业务（2026-07-25 by 清禾）
 *
 * 包含：
 *   - joinGroup         智能加入/开团 + 满员自动下单
 *   - getGroupDetail    查拼团详情 + 成员列表 + 商品库存
 *
 * 完整链路 joinGroup：
 *   1. 智能选团（groupId 空时 → 找可加的 active 团）
 *   2. 都没 → 自动开新团（基于随机商品）
 *   3. 状态校验（active / 未过期 / 未满员 / maxStock）
 *   4. 商品库存校验
 *   5. 重复加入检测
 *   6. 减库存（race-safe: stock > 0）
 *   7. INSERT GroupMember + UPDATE currentPeople
 *   8. 满员 → 为每个成员创建 Order + OrderItem + pickupCode
 *   9. AuditLog
 */

import { prisma } from '@/lib/db'
import { genId, genOrderNo } from '@/domain/membership/service'
import { generatePickupCode } from '@/lib/pickup-code'
import { ValidationError, NotFoundError, ConflictError } from '@/lib/error'

// ============== Type 定义 ==============

export interface JoinGroupInput {
  groupId?: string
  phone: string
  nickname?: string
}

export interface JoinGroupResult {
  success: true
  newlyCreated: boolean
  alreadyJoined?: boolean
  group: {
    id: string
    productName: string
    productPrice: number
    groupPrice: number
    currentPeople: number
    requiredPeople: number
    maxStock: number | null
    status: string
    isFull: boolean
  }
  /** 满员时返回当前用户的订单 + 取货码 */
  pickupCode?: string
  createdOrders?: number
}

// ============== 加入/开团 ==============

export async function joinGroup(input: JoinGroupInput): Promise<JoinGroupResult> {
  const { groupId, phone, nickname } = input

  if (!phone) {
    throw new ValidationError('缺少 phone')
  }

  // 1. 智能选团
  let targetGroupId = groupId
  let targetGroup: any = null
  let isAutoNew = false

  if (!targetGroupId) {
    const candidates = await prisma.$queryRaw<any[]>`
      SELECT * FROM GroupBuy
      WHERE status = 'active' AND currentPeople < requiredPeople AND expiresAt > datetime('now')
      ORDER BY createdAt ASC
      LIMIT 1
    `
    if (candidates.length > 0) {
      targetGroupId = candidates[0].id
      targetGroup = candidates[0]
    }
  }

  // 2. 自动开新团
  if (!targetGroupId) {
    const products = await prisma.$queryRaw<any[]>`
      SELECT * FROM Product WHERE status = 'active' AND stock >= 5 ORDER BY RANDOM() LIMIT 1
    `
    if (products.length === 0) {
      throw new ValidationError('暂无拼团商品')
    }
    const p = products[0]
    const merchants = await prisma.$queryRaw<any[]>`SELECT id FROM Merchant LIMIT 1`
    const merchantId = merchants[0]?.id || 'm_default'

    const newGid = genId('gb')
    const originalPrice = Number(p.price)
    const groupPrice = Math.max(0.01, Math.round(originalPrice * 0.7 * 100) / 100)
    await prisma.$executeRawUnsafe(
      `INSERT INTO GroupBuy (id, merchantId, activityId, productId, productName, productSpec, originalPrice, groupPrice, requiredPeople, currentPeople, status, expiresAt, createdAt, maxStock)
       VALUES (?, ?, NULL, ?, ?, ?, ?, ?, 3, 0, 'active', datetime('now', '+7 days'), CURRENT_TIMESTAMP, NULL)`,
      newGid, merchantId, p.id, p.name, p.spec || null, originalPrice, groupPrice
    )
    targetGroupId = newGid
    isAutoNew = true
    const [created] = await prisma.$queryRaw<any[]>`SELECT * FROM GroupBuy WHERE id = ${newGid} LIMIT 1`
    targetGroup = created
  }

  // 3. 查目标团
  if (!targetGroup) {
    const groups = await prisma.$queryRaw<any[]>`
      SELECT * FROM GroupBuy WHERE id = ${targetGroupId} LIMIT 1
    `
    if (groups.length === 0) {
      throw new NotFoundError('拼团不存在')
    }
    targetGroup = groups[0]
  }

  // 4. 状态校验
  if (targetGroup.status !== 'active') {
    const msg = targetGroup.status === 'success' ? '拼团已成团' : '拼团已结束'
    throw new ConflictError(msg)
  }
  if (new Date(targetGroup.expiresAt) < new Date()) {
    throw new ConflictError('拼团已过期')
  }
  if (targetGroup.currentPeople >= targetGroup.requiredPeople) {
    throw new ConflictError('拼团已满员')
  }

  // ⭐ 奕霖 2026-08-05 20:20：创建者不能加入自己发起的拼团
  // 业务：发起人必须拉人，自己不能加
  // 拼团价 = 拉满 N 个外部人后才享
  if (targetGroup.creatorPhone && phone === targetGroup.creatorPhone) {
    throw new ConflictError('你是创建者，不能加入自己发起的拼团。请把链接发给朋友邀请他们来加！')
  }

  // 5. maxStock 校验
  const maxStock = targetGroup.maxStock == null ? null : Number(targetGroup.maxStock)
  if (maxStock !== null && targetGroup.currentPeople + 1 > maxStock) {
    throw new ConflictError(`本团库存只剩 ${maxStock - targetGroup.currentPeople} 份`)
  }

  // 6. 商品库存校验
  const products = await prisma.$queryRaw<any[]>`
    SELECT id, name, spec, stock, price FROM Product WHERE id = ${targetGroup.productId} LIMIT 1
  `
  if (products.length === 0 || Number(products[0].stock) <= 0) {
    throw new ConflictError('商品已售罄')
  }

  // 7. 重复加入检测
  const existing = await prisma.$queryRaw<any[]>`
    SELECT id FROM GroupMember WHERE groupId = ${targetGroupId} AND phone = ${phone} LIMIT 1
  `
  if (existing.length > 0) {
    return {
      success: true,
      newlyCreated: false,
      alreadyJoined: true,
      group: {
        id: targetGroupId,
        productName: targetGroup.productName,
        productPrice: Number(targetGroup.groupPrice),
        groupPrice: Number(targetGroup.groupPrice),
        currentPeople: targetGroup.currentPeople,
        requiredPeople: targetGroup.requiredPeople,
        maxStock,
        status: targetGroup.status,
        isFull: targetGroup.currentPeople >= targetGroup.requiredPeople,
      },
    }
  }

  // 8. 减库存（race-safe）
  const decRes = await prisma.$executeRaw`
    UPDATE Product SET stock = stock - 1 WHERE id = ${targetGroup.productId} AND stock > 0
  `
  if (decRes === 0) {
    throw new ConflictError('商品被抢光了')
  }

  // 9. INSERT GroupMember
  const memberId = genId('gm')
  const finalNickname = nickname || `顾客${phone.slice(-4)}`
  await prisma.$executeRaw`
    INSERT INTO GroupMember (id, groupId, phone, nickname, joinedAt)
    VALUES (${memberId}, ${targetGroupId}, ${phone}, ${finalNickname}, CURRENT_TIMESTAMP)
  `

  // 10. currentPeople + 1
  const newPeople = targetGroup.currentPeople + 1
  const newStatus = newPeople >= targetGroup.requiredPeople ? 'success' : 'active'
  await prisma.$executeRaw`
    UPDATE GroupBuy SET currentPeople = ${newPeople}, status = ${newStatus} WHERE id = ${targetGroupId}
  `

  // 11. 满员触发：批量下单
  let createdOrders = 0
  let pickupCode = ''
  if (newStatus === 'success') {
    const allMembers = await prisma.$queryRaw<any[]>`
      SELECT id, phone, nickname FROM GroupMember WHERE groupId = ${targetGroupId} ORDER BY joinedAt ASC
    `
    const merchants = await prisma.$queryRaw<any[]>`SELECT id FROM Merchant LIMIT 1`
    const merchantId = merchants[0]?.id || 'm_default'

    for (const m of allMembers) {
      const orderId = genId('ord')
      const orderNo = genOrderNo()
      const code = await generatePickupCode('G0001')
      if (m.id === memberId) pickupCode = code

      const groupPrice = Number(targetGroup.groupPrice)

      await prisma.$executeRawUnsafe(
        `INSERT INTO "Order" (id, merchantId, orderNo, totalAmount, discountAmount, finalAmount, deliveryType, status, source, groupBuyId, pickupCode, pickupExpiresAt, remark, deliveryPhone, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, 0, ?, 'pickup', 'pending', 'group', ?, ?, datetime('now', '+24 hours'), ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        orderId, merchantId, orderNo, groupPrice, groupPrice, targetGroupId, code,
        `拼团 ${targetGroupId} 成员 ${m.phone}`, m.phone
      )
      await prisma.$executeRawUnsafe(
        `INSERT INTO OrderItem (id, orderId, productId, productName, productSpec, price, quantity, subtotal)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
        genId('oi'), orderId, targetGroup.productId, targetGroup.productName,
        targetGroup.productSpec || null, groupPrice, groupPrice
      )
      await prisma.$executeRaw`
        UPDATE GroupMember SET orderId = ${orderId} WHERE id = ${m.id}
      `
      createdOrders++
    }

    // ⭐ 奕霖 2026-08-05 18:24 裂变 V1：满团后给发起人拉新奖励积分
    // 奖励 = 团费 × 人数 × 5%（仅 1 级，不做多级）
    if (newStatus === 'success' && allMembers.length > 0) {
      const creator = allMembers[0]  // 首个成员 = 发起人（按 joinedAt 升序）
      const groupPriceNum = Number(targetGroup.groupPrice)
      const rewardYuan = Math.round(groupPriceNum * allMembers.length * 0.05 * 100) / 100
      const rewardPoints = Math.floor(rewardYuan * 100)  // 1分 = 0.01元

      if (rewardPoints > 0 && creator.phone) {
        try {
          // 确保 Customer 存在
          await prisma.$executeRaw`
            INSERT OR IGNORE INTO Customer (id, merchantId, phone, nickname, points, totalSpent, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `, `cu_${creator.phone}`, creator.phone, creator.nickname || '用户'

          // 加积分到 PointsLog
          await prisma.$executeRawUnsafe(
            `INSERT INTO PointsLog (id, customerId, amount, type, reason, createdAt) VALUES (?, ?, ?, 'earn', ?, CURRENT_TIMESTAMP)`,
            `pl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, `cu_${creator.phone}`, rewardPoints, `拼团满团奖励：团费¥${groupPriceNum}×${allMembers.length}人×5%`
          )

          // 加到 Customer.points
          await prisma.$executeRaw`
            UPDATE Customer SET points = points + ${rewardPoints}, updatedAt = CURRENT_TIMESTAMP WHERE phone = ${creator.phone}
          `

          console.log(`[viral] 拼团 ${targetGroupId} 满团，奖励发起人 ${creator.phone} ${rewardPoints}分`)
        } catch (e: any) {
          console.error('[viral] 奖励发放失败:', e.message)
        }
      }
    }

    // 埋点
    await prisma.$executeRawUnsafe(
      `INSERT INTO AuditLog (id, actorType, action, target, description, createdAt)
       VALUES (?, 'system', 'group_full', ?, ?, CURRENT_TIMESTAMP)`,
      `al_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      targetGroupId,
      `拼团满员 ${targetGroupId}（${targetGroup.productName} ¥${targetGroup.groupPrice}）已自动生成 ${createdOrders} 个订单`
    )
  }

  return {
    success: true,
    newlyCreated: isAutoNew || targetGroup.currentPeople === 0,
    group: {
      id: targetGroupId,
      productName: targetGroup.productName,
      productPrice: Number(targetGroup.originalPrice),
      groupPrice: Number(targetGroup.groupPrice),
      currentPeople: newPeople,
      requiredPeople: targetGroup.requiredPeople,
      maxStock,
      status: newStatus,
      isFull: newStatus === 'success',
    },
    ...(newStatus === 'success' && {
      pickupCode,
      createdOrders,
    }),
  }
}

// ============== 详情 ==============

export async function getGroupDetail(groupId: string) {
  if (!groupId) {
    throw new ValidationError('缺少 groupId')
  }

  const groups = await prisma.$queryRaw<any[]>`
    SELECT * FROM GroupBuy WHERE id = ${groupId} LIMIT 1
  `
  if (groups.length === 0) {
    throw new NotFoundError('拼团不存在')
  }
  const group = groups[0]

  const members = await prisma.$queryRaw<any[]>`
    SELECT id, phone, nickname, joinedAt, orderId FROM GroupMember
    WHERE groupId = ${groupId} ORDER BY joinedAt ASC
  `

  let productStock: number | null = null
  if (group.productId) {
    const ps = await prisma.$queryRaw<any[]>`
      SELECT stock FROM Product WHERE id = ${group.productId} LIMIT 1
    `
    if (ps.length > 0) productStock = Number(ps[0].stock)
  }

  return {
    group: {
      ...group,
      productStock,
      currentPeople: Number(group.currentPeople),
      requiredPeople: Number(group.requiredPeople),
      groupPrice: Number(group.groupPrice),
      originalPrice: Number(group.originalPrice),
      maxStock: group.maxStock == null ? null : Number(group.maxStock),
    },
    members,
  }
}