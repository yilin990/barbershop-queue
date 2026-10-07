/**
 * /api/settlements - 服务结算（v1.1.40 · 2026-10-07 清禾）
 *
 *   GET  /api/settlements?merchantId=xxx        结算流水（店长看总账）
 *   POST /api/settlements                         结算一笔
 *
 * ⭐ 为什么所有支付方式都要记账：
 *   之前只有「卡里扣」留痕，现金/微信收的钱从账上直接消失。
 *   店主看总账时只看到会员消费，真实收入是残的 —— 这不行。
 *   所以 Settlement 收全部，card 方式额外再走 MemberCardLog。
 *
 * ⭐ 事务边界：
 *   「从卡里扣 + 写结算单 + 推给顾客」必须在同一个事务里完成。
 *   扣了卡但结算单没写成 = 钱扣了账没了，比不做还糟。
 *   better-sqlite3 的嵌套 transaction 会自动用 SAVEPOINT，安全。
 */

import { NextRequest } from 'next/server'
import Database from 'better-sqlite3'
import { getDb as getMemberDb, consume, centsToYuan, DB_PATH } from '@/lib/member'
import { pushToPhone } from '@/lib/webpush-server'

export const runtime = 'nodejs'

const PAY_METHODS = ['card', 'cash', 'wechat', 'alipay']

export async function GET(request: NextRequest) {
  let db: any = null
  try {
    const { searchParams } = new URL(request.url)
    const merchantId = (searchParams.get('merchantId') || '').trim()
    if (!merchantId) throw new Error('merchantId 必填')
    const limit = Math.min(200, Number(searchParams.get('limit')) || 50)

    db = new Database(DB_PATH)
    const rows = db
      .prepare(
        `SELECT * FROM Settlement WHERE merchantId = ?
         ORDER BY createdAt DESC, rowid DESC LIMIT ?`
      )
      .all(merchantId, limit)

    const sum = db
      .prepare(
        `SELECT COUNT(*) n,
                COALESCE(SUM(dueCents),0) total,
                COALESCE(SUM(CASE WHEN payMethod='card' THEN dueCents ELSE 0 END),0) cardTotal
         FROM Settlement WHERE merchantId = ? AND datetime(createdAt) >= datetime('now','-30 day')`
      )
      .get(merchantId)

    return Response.json({
      ok: true,
      rows: rows.map((r: any) => ({
        ...r,
        dueYuan: centsToYuan(r.dueCents),
        listYuan: centsToYuan(r.listCents),
      })),
      summary: {
        monthCount: sum.n,
        monthTotalYuan: centsToYuan(sum.total),
        monthCardYuan: centsToYuan(sum.cardTotal),
        monthCashYuan: centsToYuan(sum.total - sum.cardTotal),
      },
    })
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message || '读取失败' }, { status: 400 })
  } finally {
    if (db) db.close()
  }
}

export async function POST(request: NextRequest) {
  let db: any = null
  let card: any = null
  try {
    const b = await request.json()
    const merchantId = String(b.merchantId || '').trim()
    if (!merchantId) throw new Error('merchantId 必填')

    const phone = String(b.phone || '').replace(/[^\d]/g, '')
    if (!/^1\d{10}$/.test(phone)) throw new Error('手机号格式不对')

    const payMethod = String(b.payMethod || '')
    if (!PAY_METHODS.includes(payMethod)) {
      throw new Error('支付方式只能是 ' + PAY_METHODS.join('/'))
    }

    const dueCents = Math.round(Number(b.dueCents ?? 0))
    if (dueCents <= 0) throw new Error('应收金额必须大于 0')
    if (dueCents > 100000000) throw new Error('单笔金额不能超过 100 万元')

    const listCents = Math.round(Number(b.listCents ?? dueCents))
    const discountRate = Number(b.discountRate ?? 1) || 1

    db = getMemberDb()

    let cardId: string | null = null

    // ⭐ 扣款 + 写结算单同事务：任何一步失败全部回滚
    const tx = db.transaction(() => {
      if (payMethod === 'card') {
        // 走 member.ts，强制过 MemberCardLog（余额不足会抛错 → 整个事务回滚）
        const updated = consume(db, {
          merchantId,
          phone,
          amountYuan: centsToYuan(dueCents),
          service: b.service || undefined,
          orderNo: b.orderNo || undefined,
          operator: b.operator || '店长',
        })
        cardId = updated.id
        card = updated
      }

      db.prepare(
        `INSERT INTO Settlement
         (id, merchantId, queueId, orderNo, phone, customerName, service,
          listCents, discountRate, dueCents, payMethod, cardId, note, operator, createdAt)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))`
      ).run(
        'st_' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36),
        merchantId,
        b.queueId || null,
        b.orderNo || null,
        phone,
        b.customerName || null,
        b.service || null,
        listCents,
        discountRate,
        dueCents,
        payMethod,
        cardId,
        b.note || null,
        b.operator || '店长'
      )
    })
    tx()

    // 事务已提交，现在才发推送
    let push: any = null
    if (payMethod === 'card') {
      const myCardUrl =
        '/my-card?phone=' + encodeURIComponent(phone) +
        '&merchantId=' + encodeURIComponent(merchantId)
      push = await pushToPhone(phone, merchantId, {
        title: '消费完成',
        body:
          (b.service || '服务') + ' ' +
          (card?.discountRate || discountRate) + ' 折，实收 ¥' + centsToYuan(dueCents) +
          '，卡内余额 ¥' + (card ? card.balanceYuan.toFixed(2) : '-'),
        url: myCardUrl,
        tag: 'settle-' + (b.orderNo || phone) + '-' + Date.now().toString(36),
      }).catch((e: any) => ({ sent: 0, failed: 1, pruned: 0, error: e?.message }))
    }

    return Response.json({ ok: true, card, push })
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message || '结算失败' }, { status: 400 })
  } finally {
    if (db) db.close()
  }
}
