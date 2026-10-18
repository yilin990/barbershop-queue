'use client'

/**
 * SettlementSheet - 服务结算面板（v1.1.40 · 2026-10-07 清禾）
 *
 * 为什么要有这个：
 *   之前「完成 ✓」直接改状态，钱要另外去会员弹层扣 —— 两步、两个页面、
 *   客人面前来回跳，店长容易漏，顾客也尴尬。这叫割裂。
 *   现在完成服务 = 结算，一屏之内做完，选卡里扣就直接代表服务结束。
 *
 * 价格来源：Service 表的标准价，选中自动填入原价，店长可改。
 *   之前每次都手打原价，是最容易出错的地方。
 *
 * 支付方式全部记账（cash/wechat/alipay 也写 Settlement），
 *   不然店主总账只看到会员消费，真实收入是残的。
 */

import { useCallback, useEffect, useMemo, useState } from 'react'

interface Svc {
  id: string
  name: string
  price: number
  icon: string | null
  category: string
}

interface Card {
  id: string
  balanceYuan: number
  levelLabel: string
  discount: number
  status: string
}

const PAYS: { key: string; label: string; icon: string }[] = [
  { key: 'card',   label: '会员卡', icon: '💳' },
  { key: 'wechat', label: '微信',   icon: '💚' },
  { key: 'cash',   label: '现金',   icon: '💵' },
  { key: 'alipay', label: '支付宝', icon: '🔵' },
]

const gold = '#b8860b'

// v1.1.42 店长自己调价的快捷金额
const QUICK = [38, 58, 68, 88, 128, 198, 268, 380]

const STD_HREF = '/merchant/pricing?merchantId=m_barber_001'
const yuan = (n: number) => '¥' + Number(n || 0).toFixed(2)

export default function SettlementSheet({
  merchantId,
  order,          // 队列那一行
  onClose,
  onDone,         // (paidWithCard: boolean) => void
  onNext,         // 叫下一位
  hasNext,        // 队列里还有没有下一个
}: {
  merchantId: string
  order: {
    id: string
    no?: string
    customerName: string
    customerPhone: string
    service?: string
    stylistName?: string
  }
  onClose: () => void
  onDone: (paidWithCard: boolean) => void
  onNext: () => void
  hasNext: boolean
}) {
  const [svcs, setSvcs] = useState<Svc[]>([])
  const [card, setCard] = useState<Card | null>(null)
  const [noCard, setNoCard] = useState(false)
  const [pick, setPick] = useState<string>('')
  const [pay, setPay] = useState<string>('card')
  const [price, setPrice] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [askNext, setAskNext] = useState(false)
  // v1.1.42 「设为标准价」的反馈
  const [stdMsg, setStdMsg] = useState('')
  const [stdBusy, setStdBusy] = useState(false)

  const load = useCallback(async () => {
    const [s, m] = await Promise.all([
      fetch('/api/services?merchantId=' + merchantId, { cache: 'no-store' })
        .then(r => r.json()).catch(() => ({ services: [] })),
      fetch('/api/members/' + encodeURIComponent(order.customerPhone) + '?merchantId=' + merchantId)
        .then(r => r.json()).catch(() => ({ ok: false })),
    ])
    const list: Svc[] = s.services || []
    setSvcs(list)
    if (m.ok) setCard(m.card)
    else setNoCard(true)

    // 预选：队列里写的服务名能对上就选上，对不上选第一个
    const hit = list.find(x => x.name === order.service)
      || list.find(x => x.category === 'cut')
      || list[0]
    if (hit) { setPick(hit.id); setPrice(String(hit.price)) }
  }, [merchantId, order.customerPhone, order.service])

  useEffect(() => { load() }, [load])

  const listYuan = Number(price) || 0
  const useDiscount = pay === 'card' && !!card && card.discount < 1
  const dueYuan = useDiscount
    ? Math.round(listYuan * card!.discount * 100) / 100
    : listYuan

  // v1.1.42 把这一单的价格设成标准价，以后每单自动带出
  async function setAsStandard(s: Svc, p: number) {
    setStdBusy(true); setStdMsg('')
    try {
      const r = await fetch('/api/services', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: s.id, merchantId, price: p }),
      })
      const j = await r.json()
      if (!j.success) {
        setStdMsg('没改成：' + (j.error || '保存失败'))
        setStdBusy(false)
        return
      }
      setSvcs(prev => prev.map(x => x.id === s.id ? { ...x, price: j.service.price } : x))
      setStdMsg('「' + s.name + '」标准价已改成 ¥' + Number(j.service.price).toFixed(2))
    } catch (e: any) {
      setStdMsg('网络错误：' + (e?.message || ''))
    } finally {
      setStdBusy(false)
    }
  }

  const pickSvc = (id: string) => {
    setPick(id)
    const s = svcs.find(x => x.id === id)
    if (s) setPrice(String(s.price))
  }

  const canPay = dueYuan > 0 && !busy &&
    (pay !== 'card' || (!!card && card.status === 'active' && card.balanceYuan >= dueYuan))

  async function settle() {
    setBusy(true); setErr('')
    try {
      const r = await fetch('/api/settlements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantId,
          queueId: order.id,
          orderNo: order.no,
          phone: order.customerPhone,
          customerName: order.customerName,
          service: (svcs.find(x => x.id === pick) || {}).name || order.service,
          listCents: Math.round(listYuan * 100),
          discountRate: useDiscount ? card!.discount : 1,
          dueCents: Math.round(dueYuan * 100),
          payMethod: pay,
          note: note || undefined,
          operator: '店长',
        }),
      })
      const j = await r.json()
      if (!j.ok) { setErr(j.error || '结算失败'); setBusy(false); return }
      setBusy(false)
      setAskNext(true)
      onDone(pay === 'card')
    } catch (e: any) {
      setErr('网络错误：' + (e?.message || ''))
      setBusy(false)
    }
  }

  // ── 结算完成：问要不要叫下一位 ──
  if (askNext) {
    return (
      <div style={S.mask} onClick={onClose}>
        <div style={S.box} onClick={(e) => e.stopPropagation()}>
          <div style={{ fontSize: 38 }}>✅</div>
          <div style={S.title}>已结算</div>
          <div style={S.sub}>
            {order.customerName} · {yuan(dueYuan)}
            {useDiscount ? '（含' + (card!.discount * 10).toFixed(1) + '折）' : ''}
          </div>
          <div style={{ fontSize: 12, opacity: 0.55, marginTop: 6 }}>
            {pay === 'card' ? '已从会员卡扣除并通知顾客' : '已记入今日账目'}
          </div>

          {hasNext && (
            <>
              <div style={S.ask}>要提醒下一位吗？</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={S.grayBtn} onClick={onClose}>先不用</button>
                <button
                  style={S.goldBtn}
                  onClick={() => { onNext(); onClose() }}
                >提醒下一位</button>
              </div>
            </>
          )}
          {!hasNext && (
            <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
              <button style={S.goldBtn} onClick={onClose}>知道了</button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── 结算面板 ──
  return (
    <div style={S.mask} onClick={onClose}>
      <div style={S.box} onClick={(e) => e.stopPropagation()}>
        <div style={S.head}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 800 }}>服务结算</div>
            <div style={{ fontSize: 12, opacity: 0.55, marginTop: 2 }}>
              {order.customerName} · {order.no || ''}
            </div>
          </div>
          <button style={S.close} onClick={onClose}>×</button>
        </div>

        <div style={S.sec}>服务项目</div>
        <div style={S.svcGrid}>
          {svcs.map(s => (
            <button
              key={s.id}
              onClick={() => pickSvc(s.id)}
              style={svcBtn(pick === s.id)}
            >
              <span style={{ fontSize: 15 }}>{s.icon || '✂️'}</span>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{s.name}</div>
              <div style={{ fontSize: 10, opacity: 0.6 }}>¥{s.price}</div>
            </button>
          ))}
        </div>

        <div style={S.sec}>支付方式</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {PAYS.map(p => {
            const dis = p.key === 'card' && (!card || card.status !== 'active')
            return (
              <button
                key={p.key}
                disabled={dis}
                onClick={() => setPay(p.key)}
                style={payBtn(pay === p.key, dis)}
              >
                <div style={{ fontSize: 17 }}>{p.icon}</div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{p.label}</div>
                {p.key === 'card' && card ? (
                  <div style={{ fontSize: 10, opacity: 0.65 }}>{yuan(card.balanceYuan)}</div>
                ) : p.key === 'card' && noCard ? (
                  <div style={{ fontSize: 10, opacity: 0.5 }}>无卡</div>
                ) : null}
              </button>
            )
          })}
        </div>

        <div style={S.sec}>
          原价
          {card && card.discount < 1 && pay === 'card' ? (
            <span style={{ fontSize: 11, color: gold }}>
              {' '}· {card.levelLabel} {(card.discount * 10).toFixed(1)} 折
            </span>
          ) : null}
        </div>
        <input
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          inputMode="decimal"
          style={S.input}
        />

        {(() => {
          const cur = Math.round((Number(price) || 0) * 100) / 100
          const hit = svcs.find(x => x.id === pick)
          const off = !!hit && cur !== hit.price
          return (
            <div style={{ marginTop: 8 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: '#9ca3af' }}>常用</span>
                {QUICK.map(q => (
                  <button
                    key={q}
                    onClick={() => setPrice(String(q))}
                    style={quickBtn(cur === q)}
                  >¥{q}</button>
                ))}
              </div>
              <div style={{
                display: 'flex', flexWrap: 'wrap', gap: 8,
                alignItems: 'center', marginTop: 8,
              }}>
                {off && hit && (
                  <button
                    onClick={() => setAsStandard(hit, cur)}
                    disabled={stdBusy}
                    style={stdSaveBtn(stdBusy)}
                  >
                    {stdBusy ? '保存中…' : '设为「' + hit.name + '」标准价'}
                  </button>
                )}
                <a href={STD_HREF} style={stdLink}>
                  管理全部标准价 ›
                </a>
              </div>
              {stdMsg && (
                <div style={{
                  marginTop: 6, fontSize: 11, fontWeight: 600,
                  color: stdMsg.indexOf('没改成') === 0 || stdMsg.indexOf('网络') === 0
                    ? '#b91c1c' : '#047857',
                }}>{stdMsg}</div>
              )}
            </div>
          )
        })()}

        <div style={S.sec}>备注（可不填）</div>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="如：加做造型 / 朋友介绍"
          style={S.input}
        />

        {pay === 'card' && card && card.balanceYuan < dueYuan && dueYuan > 0 && (
          <div style={S.warn}>
            余额不足：卡里只有 {yuan(card.balanceYuan)}，还差 {yuan(dueYuan - card.balanceYuan)}
          </div>
        )}
        {err && <div style={S.err}>{err}</div>}

        <div style={S.total}>
          <span>应收</span>
          <span style={{ fontSize: 24, fontWeight: 800, color: gold }}>
            {yuan(dueYuan)}
          </span>
        </div>

        <button
          disabled={!canPay}
          onClick={settle}
          style={{
            width: '100%', padding: '14px 0', borderRadius: 12,
            fontSize: 16, fontWeight: 800, border: 'none',
            background: canPay ? gold : '#d1d5db',
            color: '#fff', cursor: canPay ? 'pointer' : 'not-allowed',
            marginTop: 4,
          }}
        >
          {busy ? '结算中…' : pay === 'card' ? '从卡里扣款并完成服务' : '确认收款并完成服务'}
        </button>
        {pay === 'card' && (
          <div style={{ fontSize: 11, opacity: 0.5, textAlign: 'center', marginTop: 8 }}>
            扣款成功后本单自动标记为已完成
          </div>
        )}
      </div>
    </div>
  )
}

function quickBtn(on: boolean) {
  return {
    padding: '5px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700,
    border: on ? '1.5px solid ' + gold : '1px solid #e5e7eb',
    background: on ? '#fffbf0' : '#fff', color: on ? gold : '#6b7280',
    cursor: 'pointer',
  }
}
function stdSaveBtn(dis: boolean) {
  return {
    padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700,
    border: 'none', background: dis ? '#d1d5db' : '#0a3a1f',
    color: '#fff', cursor: dis ? 'not-allowed' : 'pointer',
  }
}
const stdLink = {
  fontSize: 12, fontWeight: 600, color: gold,
  textDecoration: 'none', cursor: 'pointer',
}

function svcBtn(on: boolean) {
  return {
    flex: '0 0 calc(33.333% - 5px)',
    padding: '9px 4px', borderRadius: 10, textAlign: 'center' as const,
    border: on ? '2px solid ' + gold : '1px solid #e5e7eb',
    background: on ? '#fffbf0' : '#fff',
    cursor: 'pointer',
  }
}
function payBtn(on: boolean, dis: boolean) {
  return {
    flex: 1, padding: '10px 0', borderRadius: 10, textAlign: 'center' as const,
    border: on ? '2px solid ' + gold : '1px solid #e5e7eb',
    background: on ? '#fffbf0' : '#fff',
    opacity: dis ? 0.4 : 1,
    cursor: dis ? 'not-allowed' : 'pointer',
  }
}

const S: any = {
  mask: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '16px', zIndex: 9999,
  },
  box: {
    width: '100%', maxWidth: 420, background: '#fff', borderRadius: 18,
    padding: '18px 18px 20px', maxHeight: '90vh', overflowY: 'auto',
    boxShadow: '0 12px 40px rgba(0,0,0,.28)',
  },
  head: { display: 'flex', alignItems: 'flex-start', marginBottom: 6 },
  close: { background: 'none', border: 'none', fontSize: 26, color: '#9ca3af', cursor: 'pointer', lineHeight: 1 },
  title: { fontSize: 18, fontWeight: 800, marginTop: 6 },
  sub: { fontSize: 13, opacity: 0.7, marginTop: 4 },
  ask: { fontSize: 14, fontWeight: 700, margin: '20px 0 10px', color: '#374151' },
  sec: { fontSize: 12, fontWeight: 700, color: '#6b7280', margin: '14px 0 7px' },
  svcGrid: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  input: {
    width: '100%', padding: '11px 12px', borderRadius: 10, fontSize: 15,
    border: '1px solid #e5e7eb', boxSizing: 'border-box',
  },
  warn: {
    marginTop: 10, padding: 9, background: '#fef3c7', color: '#92400e',
    borderRadius: 9, fontSize: 12, fontWeight: 600,
  },
  err: {
    marginTop: 10, padding: 9, background: '#fee2e2', color: '#991b1b',
    borderRadius: 9, fontSize: 12,
  },
  total: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 16, paddingTop: 12, borderTop: '1px solid #f3f4f6',
    fontSize: 14, fontWeight: 700, color: '#374151',
  },
  grayBtn: {
    flex: 1, padding: '13px 0', borderRadius: 12, fontSize: 15, fontWeight: 700,
    border: '1px solid #e5e7eb', background: '#fff', color: '#374151', cursor: 'pointer',
  },
  goldBtn: {
    flex: 1, padding: '13px 0', borderRadius: 12, fontSize: 15, fontWeight: 700,
    border: 'none', background: gold, color: '#fff', cursor: 'pointer',
  },
}
