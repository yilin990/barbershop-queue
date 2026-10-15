/**
 * ⭐⭐⭐ 客户身份中枢（2026-10-15 02:18 奕霖拍板）
 *
 * 「入口可以借，身份必须自有。」
 *
 * 这层解决的是 MEMORY 451 那个架构问题：
 *   以前 Customer 是 @@unique([merchantId, phone])
 *   → 同一个人在两家店 = 两条独立记录
 *   → 平台换个入口（小程序 → PWA → App），全部对不上
 *   → 客户关系是平台的，不是自己的
 *
 * 现在：
 *   Identity.phone      全局唯一主身份
 *   IdentityChannel     openid/unionid 降级成「通道」，换前端身份不动
 *   MemberBalance/Txn   储值和流水 —— 这才是「精准」的载体
 */

import { prisma } from '@/lib/db'

export const IDENTITY_CHANNELS = [
  'wxmp',        // 微信小程序
  'wechat_app',  // 微信网页
  'alipay',
  'apple',
  'lite',        // dl.qingheos.cn/lite.html
  'pwa',         // barber.qingheos.cn 主站
] as const

export type IdentityChannel = (typeof IDENTITY_CHANNELS)[number]

const PHONE_RE = /^1[3-9]\d{9}$/

export function isValidPhone(phone: unknown): phone is string {
  return typeof phone === 'string' && PHONE_RE.test(phone.trim())
}

export function isValidChannel(channel: unknown): channel is IdentityChannel {
  return typeof channel === 'string' && (IDENTITY_CHANNELS as readonly string[]).includes(channel)
}

/**
 * 按通道解析身份 —— 这是整个中枢的入口。
 *
 * 第一次来（openid 从没出现过）：
 *   没手机号 → 建一个「待认领」身份，返回 needsPhone
 *   有手机号 → 直接绑上
 *
 * 以后再来（同一个 openid，换了 App 版本 / 换了入口）：
 *   直接命中同一个 Identity，身份一动不动
 */
export async function resolveByChannel(params: {
  channel: string
  externalId: string
  unionId?: string | null
  nickname?: string | null
  avatar?: string | null
  phone?: string | null
}) {
  const { channel, externalId } = params

  const existing = await prisma.identityChannel.findUnique({
    where: { channel_externalId: { channel, externalId } },
    include: { identity: true },
  })

  if (existing) {
    // 命中：只更新通道的活跃时间，身份本身不动
    await prisma.identityChannel.update({
      where: { id: existing.id },
      data: { lastSeenAt: new Date(), unionId: params.unionId ?? existing.unionId },
    })
    await prisma.identity.update({
      where: { id: existing.identityId },
      data: { lastSeenAt: new Date() },
    })
    return {
      created: false,
      needsPhone: existing.identity.phone.length === 0 || /^pending_/.test(existing.identity.phone),
      identity: existing.identity,
    }
  }

  // 新通道：先看这个手机号是不是已经有身份了。
  // ⭐ 这是「入口可以借，身份必须自有」的关键分支：
  //    同一个手机号换了入口（新小程序 openid / PWA / lite.html）——
  //    绝不能新建身份，必须把新通道挂到已有身份上。
  //    踩过这个坑：之前直接 create 会撞唯一键报 P2002 → 500。
  if (isValidPhone(params.phone)) {
    const phoneStr = params.phone.trim()
    const owner = await prisma.identity.findUnique({ where: { phone: phoneStr } })
    if (owner) {
      await prisma.identityChannel.create({
        data: {
          identityId: owner.id,
          channel,
          externalId,
          unionId: params.unionId ?? null,
          nickname: params.nickname ?? null,
          avatar: params.avatar ?? null,
        },
      })
      await prisma.identity.update({ where: { id: owner.id }, data: { lastSeenAt: new Date() } })
      return { created: true, needsPhone: false, identity: owner }
    }
  }

  // 新通道 + 新手机号 → 建身份
  const phone = isValidPhone(params.phone) ? params.phone.trim() : `pending_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  const identity = await prisma.identity.create({
    data: {
      phone,
      nickname: params.nickname ?? null,
      avatar: params.avatar ?? null,
      channels: {
        create: {
          channel,
          externalId,
          unionId: params.unionId ?? null,
          nickname: params.nickname ?? null,
          avatar: params.avatar ?? null,
        },
      },
    },
  })

  return { created: true, needsPhone: phone.startsWith('pending_'), identity }
}

/**
 * 用手机号认领身份 —— 把「待认领」通道并到真实手机上。
 * 认领之后，openid 只是通道，手机号才是身份。
 */
export async function claimByPhone(params: {
  pendingPhone: string
  phone: string
}) {
  const pending = await prisma.identity.findUnique({
    where: { phone: params.pendingPhone },
    include: { channels: true },
  })
  if (!pending) return { ok: false as const, error: '待认领身份不存在' }

  // 手机号已经被别的身份占了 → 合并通道到这个身份，不新建
  const target = await prisma.identity.findUnique({
    where: { phone: params.phone },
  })

  const finalIdentity =
    target && target.id !== pending.id
      ? await (async () => {
          // 合并：把待认领身份的所有通道搬到 target 上
          for (const ch of pending.channels) {
            const dup = await prisma.identityChannel.findUnique({
              where: { channel_externalId: { channel: ch.channel, externalId: ch.externalId } },
            })
            if (dup && dup.identityId === pending.id) {
              // ⚠️ 这条通道本来就是待认领身份自己的 —— 必须改归属，不能跳过。
              //   （踩过的坑：这里当「重复」跳过，随后 delete 级联删掉，通道直接丢了）
              await prisma.identityChannel.update({
                where: { id: ch.id },
                data: { identityId: target.id },
              })
            } else if (!dup) {
              await prisma.identityChannel.create({
                data: {
                  identityId: target.id,
                  channel: ch.channel,
                  externalId: ch.externalId,
                  unionId: ch.unionId,
                  nickname: ch.nickname,
                  avatar: ch.avatar,
                },
              })
            }
            // dup 存在且属于别的身份 → 通道已被别人绑上，不抢（openid 归平台管，避免串号）
          }
          await prisma.identity.delete({ where: { id: pending.id } })
          return target
        })()
      : await prisma.identity.update({
          where: { id: pending.id },
          data: { phone: params.phone, lastSeenAt: new Date() },
        })

  return { ok: true as const, identity: finalIdentity }
}

/**
 * 读一个身份的全貌：跨门店的余额 + 通道清单。
 * 这是「客户在我手里」的证明 —— 换几个入口，看到的是同一个人。
 */
export async function getIdentityProfile(identityId: string) {
  const identity = await prisma.identity.findUnique({
    where: { id: identityId },
    include: {
      channels: { orderBy: { lastSeenAt: 'desc' } },
      balances: {
        // ⚠️ 只 select 生产库里真实存在的列：
        //    schema.prisma 声明了 Merchant.industry，但线上库没有这列（既有漂移），
        //    一旦 select 它，Prisma 会直接抛 "column does not exist"。
        include: { merchant: { select: { id: true, code: true, name: true, shortName: true } } },
      },
    },
  })
  if (!identity) return null

  const txns = await prisma.memberTxn.findMany({
    where: { identityId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  return {
    identity: {
      id: identity.id,
      phone: /^pending_/.test(identity.phone) ? null : identity.phone,
      nickname: identity.nickname,
      status: identity.status,
      firstSeenAt: identity.firstSeenAt,
      lastSeenAt: identity.lastSeenAt,
    },
    channels: identity.channels.map((c) => ({
      channel: c.channel,
      externalId: c.externalId,
      unionId: c.unionId,
      lastSeenAt: c.lastSeenAt,
    })),
    balances: identity.balances.map((b) => ({
      merchant: b.merchant,
      balance: b.balance,
      totalRecharge: b.totalRecharge,
      totalConsume: b.totalConsume,
    })),
    txns,
  }
}

/**
 * 储值/消费入账 —— 事务里同时改余额和写流水，账本只追加。
 */
export async function postTxn(params: {
  identityId: string
  merchantId: string
  type: 'recharge' | 'consume' | 'adjust' | 'refund'
  amount: number
  refType?: string
  refId?: string
  note?: string
  operatorId?: string
}) {
  const amount = Math.abs(params.amount)
  const delta = params.type === 'consume' ? -amount : amount

  return prisma.$transaction(async (tx) => {
    const bal = await tx.memberBalance.findUnique({
      where: { identityId_merchantId: { identityId: params.identityId, merchantId: params.merchantId } },
    })

    const balanceAfter = (bal?.balance ?? 0) + delta
    if (balanceAfter < 0) throw new Error('余额不足')

    const saved = await tx.memberBalance.upsert({
      where: { identityId_merchantId: { identityId: params.identityId, merchantId: params.merchantId } },
      create: {
        identityId: params.identityId,
        merchantId: params.merchantId,
        balance: balanceAfter,
        totalRecharge: params.type === 'recharge' ? amount : 0,
        totalConsume: params.type === 'consume' ? amount : 0,
      },
      update: {
        balance: balanceAfter,
        ...(params.type === 'recharge' ? { totalRecharge: { increment: amount } } : {}),
        ...(params.type === 'consume' ? { totalConsume: { increment: amount } } : {}),
      },
    })

    const txn = await tx.memberTxn.create({
      data: {
        identityId: params.identityId,
        merchantId: params.merchantId,
        type: params.type,
        amount: delta,
        balanceAfter,
        refType: params.refType ?? null,
        refId: params.refId ?? null,
        note: params.note ?? null,
        operatorId: params.operatorId ?? null,
      },
    })

    return { balance: saved.balance, txn }
  })
}
