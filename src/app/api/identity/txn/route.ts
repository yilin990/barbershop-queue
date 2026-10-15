import { NextRequest, NextResponse } from 'next/server'
import { postTxn, isValidPhone } from '@/lib/identity-core'
import { prisma } from '@/lib/db'
import { requireMerchantPin, checkIpLimit, clientIp, operatorTag } from '@/lib/identity-auth'

export const runtime = 'nodejs'

const TYPES = ['recharge', 'consume', 'adjust', 'refund'] as const

/**
 * POST /api/identity/txn
 *
 *   Header: x-merchant-pin（或 StaffGate 的 zhilin-staff-session cookie）
 *   Body:   { identityId | phone, merchantId, type, amount, refType?, refId?, note? }
 *
 * 储值 / 扣款 / 调整 / 退款 —— 一个事务里同时改余额、写流水。
 * 账本只追加，永不改写历史。
 *
 * ✅ 2026-10-15 鉴权已接入（清禾）：
 *    · 必须提供属于该 merchantId 的门店 PIN（scrypt，按门店精确匹配）
 *    · 不用 JWT 兜底 —— JWT 里没有 merchantId，无法校验跨店越权
 *    · 限流 60 次/分钟/IP
 *    · 幂等：同一 refType+refId 已入账则直接返回原结果，不重复入账
 *    · operatorId 由服务端生成，不再信任客户端传值
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ success: false, error: '请求体不是合法 JSON' }, { status: 400 })
    }

    const { identityId, phone, merchantId, type, amount, refType, refId, note } = body

    if (typeof merchantId !== 'string' || !merchantId) {
      return NextResponse.json({ success: false, error: '缺少 merchantId' }, { status: 400 })
    }
    if (!TYPES.includes(type)) {
      return NextResponse.json(
        { success: false, error: `type 必须是 ${TYPES.join(' | ')}` },
        { status: 400 }
      )
    }
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ success: false, error: 'amount 必须是正数' }, { status: 400 })
    }

    // ⭐ 鉴权：写钱必须有这个门店的 PIN
    const auth = requireMerchantPin(request, merchantId)
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }

    const lim = checkIpLimit('txn:' + clientIp(request), 60, 60_000)
    if (!lim.ok) {
      return NextResponse.json({ success: false, error: '操作过于频繁，请稍后再试' }, { status: 429 })
    }

    let targetIdentityId = identityId
    if (!targetIdentityId) {
      if (!isValidPhone(phone)) {
        return NextResponse.json({ success: false, error: '请提供 identityId 或格式正确的 phone' }, { status: 400 })
      }
      const found = await prisma.identity.findUnique({ where: { phone: phone.trim() } })
      if (!found) {
        return NextResponse.json({ success: false, error: '身份不存在' }, { status: 404 })
      }
      targetIdentityId = found.id
    }

    // 幂等：同一个 refType+refId 已经入过账 → 直接返回原结果，绝不重复入账
    if (typeof refType === 'string' && refType && typeof refId === 'string' && refId) {
      const dup = await prisma.memberTxn.findFirst({
        where: {
          identityId: targetIdentityId,
          merchantId,
          type,
          refType,
          refId,
        },
        orderBy: { createdAt: 'desc' },
      })
      if (dup) {
        return NextResponse.json({
          success: true,
          data: { balance: dup.balanceAfter, txnId: dup.id, idempotent: true },
        })
      }
    }

    // ⚠️ 显式 select 真实存在的列（schema.prisma 与线上库有既有漂移，
    //    findUnique 不带 select 会把不存在的列也查出来 → 直接 500）
    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { id: true, code: true, name: true, shortName: true },
    })
    if (!merchant) {
      return NextResponse.json({ success: false, error: '门店不存在' }, { status: 404 })
    }

    const result = await postTxn({
      identityId: targetIdentityId,
      merchantId,
      type,
      amount,
      refType: refType ?? null,
      refId: refId ?? null,
      note: note ?? null,
      operatorId: operatorTag(auth.pin),   // ⭐ 服务端生成，不信任客户端
    })

    return NextResponse.json({
      success: true,
      data: { balance: result.balance, txnId: result.txn.id },
    })
  } catch (err: any) {
    const msg = err?.message ?? '入账失败'
    const status = msg.includes('余额不足') ? 409 : 500
    console.error('[identity/txn]', err)
    return NextResponse.json({ success: false, error: msg }, { status })
  }
}
