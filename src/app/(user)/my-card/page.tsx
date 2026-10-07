'use client'

/**
 * /my-card - 顾客查自己的卡（v1.1.38 · 2026-10-07 清禾）
 *
 * 顾客不该为了问「我卡里还剩多少钱」去麻烦店员。
 * 余额变动推送点进来也落在这个页面。
 *
 * 只读：这里不给任何写操作。改余额只能店长在队列页或会员页做。
 */

import { useSearchParams } from 'next/navigation'
import { Suspense, useCallback, useEffect, useState } from 'react'
import { DEFAULT_MERCHANT_ID, resolveMerchantIdFromQuery } from '@/lib/merchant'

interface Card {
  id: string
  phone: string
  nickname: string | null
  balanceYuan: number
  rechargeYuan: number
  consumeYuan: number
  visitCount: number
  level: string
  levelLabel: string
  discount: number
  status: string
  nextLevel: { key: string; label: string } | null
  toNextCents: number
}

interface LogRow {
  id: string
  type: string
  changeCents: number
  balanceAfter: number
  service: string | null
  note: string | null
  createdAt: string
}

const TYPE_LABEL: Record<string, string> = {
  open: '开卡', recharge: '充值', consume: '消费',
  adjust: '调整', frozen: '冻结', unfreeze: '解冻',
}
const LEVEL_COLOR: Record<string, string> = {
  normal: '#94a3b8', silver: '#8a8d98', gold: '#b8860b', diamond: '#7c3aed',
}
const yuan = (n: number) => '¥' + Number(n || 0).toFixed(2)

export default function MyCardPage() {
  return <Suspense fallback={null}><Inner /></Suspense>
}

function Inner() {
  const sp = useSearchParams()
  const merchantId = resolveMerchantIdFromQuery(sp) || DEFAULT_MERCHANT_ID
  const phone = (sp.get('phone') || '').replace(/[^\d]/g, '')

  const [card, setCard] = useState<Card | null>(null)
  const [logs, setLogs] = useState<LogRow[]>([])
  const [state, setState] = useState<'idle' | 'loading' | 'none' | 'ready' | 'bad'>('idle')
  const [input, setInput] = useState(phone)

  const load = useCallback(async (p: string) => {
    if (!/^1\d{10}$/.test(p)) { setState('bad'); return }
    setState('loading')
    try {
      const r = await fetch(
        '/api/members/' + encodeURIComponent(p) + '?merchantId=' + merchantId
      )
      const j = await r.json()
      if (j.ok) { setCard(j.card); setLogs(j.logs || []); setState('ready') }
      else { setCard(null); setState('none') }
    } catch {
      setState('none')
    }
  }, [merchantId])

  useEffect(() => { if (phone) load(phone) }, [phone, load])

  return (
    <div style={S.page}>
      <div style={S.head}>
        <div style={S.logo}>💳</div>
        <div style={{ fontSize: 17, fontWeight: 800, color: '#1f2937' }}>我的卡</div>
        <div style={{ fontSize: 11, opacity: 0.5 }}>余额、消费记录一目了然</div>
      </div>

      {!phone && state === 'idle' && (
        <div style={S.box}>
          <div style={{ fontSize: 14, marginBottom: 10 }}>输入办卡时用的手机号</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value.replace(/[^\d]/g, ''))}
              inputMode="numeric"
              maxLength={11}
              placeholder="11 位手机号"
              style={S.input}
            />
            <button style={S.go} onClick={() => load(input)}>查询</button>
          </div>
        </div>
      )}

      {state === 'loading' && <div style={S.hint}>查询中…</div>}

      {state === 'bad' && (
        <div style={S.hint}>手机号格式不对，要 11 位数字</div>
      )}

      {state === 'none' && (
        <div style={S.box}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🙂</div>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>还没有会员卡</div>
          <div style={{ fontSize: 12, opacity: 0.6 }}>
            到店跟店长说一声就能开卡，储值的钱先进来
          </div>
        </div>
      )}

      {state === 'ready' && card && (
        <>
          <div style={S.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={S.badge(card.level)}>{card.levelLabel}</span>
              <span style={{ fontSize: 11, opacity: 0.6 }}>
                {(card.discount * 10).toFixed(1)} 折
              </span>
            </div>
            <div style={{ fontSize: 12, opacity: 0.65, marginTop: 22 }}>卡内余额</div>
            <div style={{ fontSize: 40, fontWeight: 800, color: gold, lineHeight: 1.15 }}>
              {yuan(card.balanceYuan)}
            </div>
            <div style={{ fontSize: 12, opacity: 0.65, marginTop: 6 }}>
              {card.nickname || ''} · {card.phone.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2')}
            </div>
            {card.nextLevel && (
              <div style={S.upgrade}>
                再充值 {yuan(card.toNextCents / 100)} 升 {card.nextLevel.label}
                <div style={{ height: 4, background: 'rgba(184,134,11,.18)', borderRadius: 2, marginTop: 6 }}>
                  <div style={{
                    height: '100%',
                    borderRadius: 2,
                    background: gold,
                    width: Math.min(100, Math.round(
                      (card.rechargeYuan * 100) /
                      Math.max(1, card.toNextCents + card.rechargeYuan * 100) * 100
                    )) + '%',
                  }} />
                </div>
              </div>
            )}
          </div>

          <div style={S.stats}>
            <Stat label="累计充值" value={yuan(card.rechargeYuan)} />
            <Stat label="累计消费" value={yuan(card.consumeYuan)} />
            <Stat label="到店次数" value={String(card.visitCount)} />
          </div>

          <div style={S.secTitle}>消费记录</div>
          <div style={S.logs}>
            {logs.length ? logs.map(l => (
              <div key={l.id} style={S.logRow}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>
                    {TYPE_LABEL[l.type] || l.type}
                    {l.service ? ' · ' + l.service : ''}
                  </div>
                  {l.note ? <div style={{ fontSize: 11, opacity: 0.5 }}>{l.note}</div> : null}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{
                    fontWeight: 800,
                    color: l.changeCents >= 0 ? '#16a34a' : '#dc2626',
                  }}>
                    {l.changeCents >= 0 ? '+' : ''}{(l.changeCents / 100).toFixed(2)}
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.5 }}>
                    余 {(l.balanceAfter / 100).toFixed(2)}
                  </div>
                </div>
              </div>
            )) : <div style={S.hint}>还没有记录</div>}
          </div>

          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <button style={S.again} onClick={() => { setState('idle'); setCard(null) }}>
              查别的手机号
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function Stat({ label, value }: any) {
  return (
    <div style={S.stat}>
      <div style={{ fontSize: 11, opacity: 0.6 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 800 }}>{value}</div>
    </div>
  )
}

const gold = '#b8860b'
const LEVEL_COLOR2 = LEVEL_COLOR
const S: any = {
  page: { minHeight: '100vh', background: '#faf6f0', padding: '20px 16px 40px' },
  head: { textAlign: 'center', marginBottom: 20 },
  logo: { fontSize: 34, marginBottom: 6 },
  box: { background: '#fff', borderRadius: 14, padding: 24, textAlign: 'center', border: '1px solid #f0e6d2' },
  input: {
    flex: 1, padding: '11px 14px', borderRadius: 10, fontSize: 15,
    border: '1px solid #e5e7eb', boxSizing: 'border-box',
  },
  go: {
    background: gold, color: '#fff', border: 'none', borderRadius: 10,
    padding: '0 20px', fontSize: 15, fontWeight: 700, cursor: 'pointer',
  },
  hint: { textAlign: 'center', padding: 36, color: '#9ca3af', fontSize: 13 },
  card: {
    background: 'linear-gradient(135deg,#b8860b,#d4a017)',
    borderRadius: 18, padding: '18px 20px 22px', color: '#fff',
    boxShadow: '0 6px 20px rgba(184,134,11,.28)',
  },
  badge: { fontSize: 12, fontWeight: 700, background: 'rgba(255,255,255,.25)', padding: '3px 10px', borderRadius: 8 },
  upgrade: { marginTop: 16, fontSize: 11, opacity: 0.9 },
  stats: { display: 'flex', gap: 8, margin: '12px 0' },
  stat: {
    flex: 1, background: '#fff', borderRadius: 12, padding: '12px 8px',
    textAlign: 'center', border: '1px solid #f0e6d2',
  },
  secTitle: { fontSize: 13, fontWeight: 700, color: '#374151', margin: '18px 0 8px' },
  logs: { background: '#fff', borderRadius: 14, border: '1px solid #f0e6d2', overflow: 'hidden' },
  logRow: { display: 'flex', alignItems: 'center', padding: '11px 14px', borderBottom: '1px solid #f9fafb', fontSize: 13 },
  again: { background: 'none', border: '1px solid #e5e7eb', borderRadius: 10, padding: '9px 18px', color: '#6b7280', fontSize: 13 },
}
