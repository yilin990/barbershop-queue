import { NextRequest, NextResponse } from 'next/server'
import { postTxn, isValidPhone } from '@/lib/identity-core'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

const TYPES = ['recharge', 'consume', 'adjust', 'refund'] as const

/**
 * POST /api/identity/txn
 *
 *   { identityId | phone, merchantId, type, amount, refType?, refId?, note? }
 *
 * 储值 / 扣款 / 调整 / 退款 —— 一个事务里同时改余额、写流水。
 * 账本只追加，永不改写历史。
 *
 * ⚠️ 这是写钱接口。生产环境必须在调用前校验店长鉴权
 *    （本仓库已有 StaffCredential scrypt 鉴权，接入时校验那个）。
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ success: false, error: '请求体不是合法 JSON' }, { status: 400 })
    }

    const { identityId, phone, merchantId, type, amount, refType, refId, note, operatorId } = body

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
      operatorId: operatorId ?? null,
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
