/**
 * /api/members/[phone] - 单张会员卡操作（v1.1.37 · 2026-10-07 清禾）
 *
 *   GET  /api/members/[phone]?merchantId=xxx   详情 + 流水
 *   POST /api/members/[phone]                   动作 { merchantId, action, ... }
 *
 * action:
 *   recharge  { amountYuan, bonusYuan?, note? }          充值
 *   consume   { amountYuan, service?, orderNo? }         消费扣款（余额不足直接拒，不透支）
 *   adjust    { deltaYuan, reason }                      手工调整（必须写原因）
 *   status    { status: active|frozen|cancelled }        冻结/解冻/注销
 *
 * 余额永远不能直接改 —— 每一笔都走 MemberCardLog。
 */

import { NextRequest } from 'next/server'
import {
  getDb, getCard, listLogs, recharge, consume, adjust, setStatus,
  normalizePhone, assertMerchantId,
} from '@/lib/member'
// v1.1.38: 余额变动推给顾客（复用叫号那套 Web Push）
import { pushToPhone } from '@/lib/webpush-server'
// v1.1.55 清禾：充值/扣款/调整/冻结 = 直接动钱，必须店长。
// GET 保持开放 —— 顾客端 (me / my-card / 门店主页「我的会员」) 靠它查自己卡。
import { requireManager } from '@/lib/require-manager'

export const runtime = 'nodejs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ phone: string }> }
) {
  let db: any = null
  try {
    const { phone: rawPhone } = await params
    const { searchParams } = new URL(request.url)
    const merchantId = assertMerchantId(searchParams.get('merchantId') || '')
    const phone = normalizePhone(decodeURIComponent(rawPhone))

    db = getDb()
    const card = getCard(db, merchantId, phone)
    if (!card) {
      return Response.json({ ok: false, error: '没有这张卡' }, { status: 404 })
    }
    return Response.json({ ok: true, card, logs: listLogs(db, merchantId, phone, 50) })
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message || '读取失败' }, { status: 400 })
  } finally {
    if (db) db.close()
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ phone: string }> }
) {
  const auth = requireManager(request)
  if (!auth.ok) {
    return Response.json({ ok: false, error: auth.error }, { status: auth.status })
  }
  let db: any = null
  try {
    const { phone: rawPhone } = await params
    const body = await request.json()
    const merchantId = assertMerchantId(body.merchantId || '')
    const phone = normalizePhone(decodeURIComponent(rawPhone))
    const action = String(body.action || '')

    db = getDb()

    const base = { merchantId, phone, operator: body.operator }
    let card: any
    switch (action) {
      case 'recharge':
        card = recharge(db, {
          ...base,
          amountYuan: Number(body.amountYuan),
          bonusYuan: body.bonusYuan ? Number(body.bonusYuan) : 0,
          note: body.note,
        })
        break
      case 'consume':
        card = consume(db, {
          ...base,
          amountYuan: Number(body.amountYuan),
          service: body.service,
          orderNo: body.orderNo,
        })
        break
      case 'adjust':
        card = adjust(db, {
          ...base,
          deltaYuan: Number(body.deltaYuan),
          reason: String(body.reason || ''),
        })
        break
      case 'status':
        card = setStatus(db, { ...base, status: String(body.status || '') })
        break
      default:
        throw new Error('未知 action: ' + action)
    }

    const logs = listLogs(db, merchantId, phone, 50)
    db.close()
    db = null

    // ── 余额变动推送（事务已提交，这里才发）─────────────────
    // tag 必须每次唯一：同 tag 的通知是「替换」不是「新增」
    // （v1.1.36 叫号踩过这个坑：连着叫同一单只提醒一次）
    let push: any = null
    if (action === 'consume' || action === 'recharge') {
      const uniq = 'member-' + action + '-' + card.id + '-' + Date.now().toString(36)
      const myCardUrl =
        '/my-card?phone=' + encodeURIComponent(phone) +
        '&merchantId=' + encodeURIComponent(merchantId)
      const amount = Number(body.amountYuan) || 0
      push = await pushToPhone(
        phone,
        merchantId,
        action === 'consume'
          ? {
              title: '消费提醒',
              body:
                (body.service || '消费') +
                ' 实收 ¥' + amount.toFixed(2) +
                '，卡内余额 ¥' + card.balanceYuan.toFixed(2),
              url: myCardUrl,
              tag: uniq,
            }
          : {
              title: '充值成功',
              body:
                '卡内余额 ¥' + card.balanceYuan.toFixed(2) +
                '，' + card.levelLabel + ' ' + (card.discount * 10).toFixed(1) + ' 折',
              url: myCardUrl,
              tag: uniq,
            }
      ).catch((e: any) => ({ sent: 0, failed: 1, pruned: 0, error: e?.message }))
    }

    return Response.json({ ok: true, card, logs, push })
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message || '操作失败' }, { status: 400 })
  } finally {
    if (db) db.close()
  }
}
