/**
 * /api/members - 会员卡列表 + 总览（v1.1.37 · 2026-10-07 清禾）
 *
 *   GET  /api/members?merchantId=xxx          列表 + 汇总
 *   POST /api/members                          开卡 { merchantId, phone, nickname }
 *
 * 多租户：merchantId 强校验（m_ 前缀），跟 /api/queues 一套规矩。
 */

import { NextRequest } from 'next/server'
import {
  getDb, listCards, openCard, summary, assertMerchantId, normalizePhone,
} from '@/lib/member'
// v1.1.55 清禾：列表含全部会员余额/流水，开卡是写操作 —— 都要求店长
import { requireManager } from '@/lib/require-manager'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const auth = requireManager(request)
  if (!auth.ok) {
    return Response.json({ ok: false, error: auth.error }, { status: auth.status })
  }
  try {
    const { searchParams } = new URL(request.url)
    const merchantId = assertMerchantId(searchParams.get('merchantId') || '')
    const db = getDb()
    try {
      return Response.json({
        ok: true,
        merchantId,
        summary: summary(db, merchantId),
        cards: listCards(db, merchantId),
      })
    } finally {
      db.close()
    }
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message || '读取失败' }, { status: 400 })
  }
}

export async function POST(request: NextRequest) {
  const auth = requireManager(request)
  if (!auth.ok) {
    return Response.json({ ok: false, error: auth.error }, { status: auth.status })
  }
  let db: any = null
  try {
    const body = await request.json()
    const merchantId = assertMerchantId(body.merchantId || '')
    const phone = normalizePhone(body.phone || '')

    db = getDb()
    const card = openCard(db, {
      merchantId,
      phone,
      nickname: body.nickname || undefined,
      operator: body.operator || undefined,
    })
    return Response.json({ ok: true, card })
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message || '开卡失败' }, { status: 400 })
  } finally {
    if (db) db.close()
  }
}
