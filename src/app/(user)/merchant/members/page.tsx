'use client'

/**
 * /merchant/members - 会员卡管理（v1.1.37 · 2026-10-07 清禾）
 *
 * 店长用。三块：
 *   顶部总览  → 会员数 / 卡内余额(负债) / 累计充值 / 累计消费
 *   会员列表  → 点一条弹详情，可充值/扣款/调整/冻结
 *   流水      → 每笔变动都有据可查
 *
 * ⚠️ 余额永远不直接改：所有动作都打 /api/members/[phone] 的 action，
 *    服务端强制过 MemberCardLog。前端不给「编辑余额」入口。
 */

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useCallback, useEffect, useState } from 'react'
import { DEFAULT_MERCHANT_ID, resolveMerchantIdFromQuery } from '@/lib/merchant'

interface Card {
  id: string
  phone: string
  nickname: string | null
  balanceYuan: number
  bonusYuan: number
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
  amountCents: number
  bonusCents: number
  changeCents: number
  balanceAfter: number
  service: string | null
  note: string | null
  operator: string | null
  createdAt: string
}

const TYPE_LABEL: Record<string, string> = {
  open: '开卡', recharge: '充值', consume: '消费',
  adjust: '调整', frozen: '冻结', unfreeze: '解冻', cancelled: '注销',
}

const LEVEL_COLOR: Record<string, string> = {
  normal: '#94a3b8', silver: '#8a8d98', gold: '#b8860b', diamond: '#7c3aed',
}

const yuan = (n: number) => '¥' + Number(n || 0).toFixed(2)

export default function MembersPage() {
  return <Suspense fallback={null}><Inner /></Suspense>
}

function Inner() {
  const router = useRouter()
  const sp = useSearchParams()
  const merchantId = resolveMerchantIdFromQuery(sp) || DEFAULT_MERCHANT_ID

  const [cards, setCards] = useState<Card[]>([])
  const [sum, setSum] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [q, setQ] = useState('')
  const [cur, setCur] = useState<Card | null>(null)
  const [logs, setLogs] = useState<LogRow[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/members?merchantId=' + merchantId)
      const j = await r.json()
      if (j.ok) { setCards(j.cards); setSum(j.summary); setErr('') }
      else setErr(j.error || '读取失败')
    } catch (e: any) {
      setErr('网络错误：' + (e?.message || ''))
    }
    setLoading(false)
  }, [merchantId])

  useEffect(() => { load() }, [load])

  async function open(phone: string) {
    const r = await fetch('/api/members/' + encodeURIComponent(phone) + '?merchantId=' + merchantId)
    const j = await r.json()
    if (j.ok) { setCur(j.card); setLogs(j.logs || []) }
    else alert(j.error)
  }

  async function post(action: string, body: any) {
    if (!cur) return
    const r = await fetch('/api/members/' + encodeURIComponent(cur.phone), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ merchantId, action, operator: '店长', ...body }),
    })
    const j = await r.json()
    if (j.ok) { setCur(j.card); setLogs(j.logs || []); load() }
    else alert(j.error)
  }

  const filtered = cards.filter(c =>
    !q || c.phone.includes(q) || (c.nickname || '').includes(q))

  return (
    <div style={S.page}>
      <div style={S.bar}>
        <button style={S.back} onClick={() => router.push('/merchant')}>←</button>
        <div style={{ flex: 1 }}>
          <div style={S.barTitle}>会员卡</div>
          <div style={S.barSub}>储值 · 等级 · 流水</div>
        </div>
        <button style={S.addBtn} onClick={async () => {
          const p = prompt('顾客手机号')
          if (!p) return
          const r = await fetch('/api/members', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ merchantId, phone: p, operator: '店长' }),
          })
          const j = await r.json()
          if (j.ok) { load(); open(j.card.phone) } else alert(j.error)
        }}>+ 开卡</button>
      </div>

      {sum && (
        <div style={S.sumRow}>
          <Sum label="会员" value={String(sum.cards)} unit="人" />
          <Sum label="卡内余额" value={yuan(sum.balanceYuan)} unit="负债" warn />
          <Sum label="累计充值" value={yuan(sum.rechargeYuan)} unit="" />
          <Sum label="累计消费" value={yuan(sum.consumeYuan)} unit="" />
        </div>
      )}

      <div style={S.searchWrap}>
        <input
          value={q} onChange={e => setQ(e.target.value)}
          placeholder="搜手机号 / 昵称"
          style={S.search}
        />
      </div>

      {err && <div style={S.err}>{err}</div>}
      {loading && <div style={S.hint}>加载中…</div>}
      {!loading && !err && !filtered.length && (
        <div style={S.hint}>还没有会员卡<br /><span style={{ fontSize: 12 }}>点右上角「+ 开卡」</span></div>
      )}

      {filtered.map(c => (
        <div key={c.id} style={S.row} onClick={() => open(c.phone)}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={S.badge(c.level)}>{c.levelLabel}</span>
              <span style={S.phone}>{c.nickname || c.phone}</span>
              {c.status !== 'active' && <span style={S.frozen}>{c.status}</span>}
            </div>
            <div style={S.rowSub}>
              {c.phone} · 到店 {c.visitCount} 次
              {c.nextLevel ? ' · 再充 ' + yuan(c.toNextCents / 100) + ' 升' + c.nextLevel.label : ''}
            </div>
          </div>
          <div style={S.bal}>{yuan(c.balanceYuan)}</div>
        </div>
      ))}

      {cur && (
        <div style={S.mask} onClick={() => setCur(null)}>
          <div style={S.sheet} onClick={e => e.stopPropagation()}>
            <div style={S.sheetHead}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 700 }}>
                  {cur.nickname || '会员'} <span style={S.badge(cur.level)}>{cur.levelLabel}</span>
                </div>
                <div style={{ fontSize: 12, opacity: 0.6, marginTop: 3 }}>{cur.phone}</div>
              </div>
              <button style={S.close} onClick={() => setCur(null)}>×</button>
            </div>

            <div style={S.bigBal}>
              <div style={{ fontSize: 12, opacity: 0.7 }}>卡内余额</div>
              <div style={{ fontSize: 34, fontWeight: 800, color: '#b8860b' }}>{yuan(cur.balanceYuan)}</div>
              <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
                折扣 {(cur.discount * 10).toFixed(1)} 折 · 累计充值 {yuan(cur.rechargeYuan)} · 累计消费 {yuan(cur.consumeYuan)}
              </div>
            </div>

            <div style={S.acts}>
              <Act label="充值" primary onClick={async () => {
                const v = prompt('充值金额（元）')
                if (v === null) return
                const b = prompt('赠送金额（元，没有就填 0）', '0')
                if (b === null) return
                post('recharge', { amountYuan: Number(v), bonusYuan: Number(b) || 0 })
              }} />
              <Act label="扣款" onClick={async () => {
                const v = prompt('扣款金额（元）')
                if (v === null) return
                const s = prompt('服务项目（剪发/染发/烫发...）', '')
                if (s === null) return
                post('consume', { amountYuan: Number(v), service: s || undefined })
              }} />
              <Act label="调整" onClick={async () => {
                const d = prompt('调整金额（正数=加，负数=扣）')
                if (d === null) return
                const r = prompt('原因（必填，会记进流水）')
                if (!r) return
                post('adjust', { deltaYuan: Number(d), reason: r })
              }} />
              <Act label={cur.status === 'active' ? '冻结' : '解冻'} onClick={() =>
                post('status', { status: cur.status === 'active' ? 'frozen' : 'active' })
              } />
            </div>

            <div style={S.logTitle}>流水（{logs.length}）</div>
            <div style={S.logs}>
              {logs.map(l => (
                <div key={l.id} style={S.logRow}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 600 }}>{TYPE_LABEL[l.type] || l.type}</span>
                    {l.service ? <span style={{ fontSize: 12, opacity: 0.6 }}> · {l.service}</span> : null}
                    {l.note ? <div style={{ fontSize: 11, opacity: 0.55 }}>{l.note}</div> : null}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, color: l.changeCents >= 0 ? '#16a34a' : '#dc2626' }}>
                      {l.changeCents >= 0 ? '+' : ''}{(l.changeCents / 100).toFixed(2)}
                    </div>
                    <div style={{ fontSize: 11, opacity: 0.5 }}>余 {(l.balanceAfter / 100).toFixed(2)}</div>
                  </div>
                </div>
              ))}
              {!logs.length ? <div style={S.hint}>还没有流水</div> : null}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Sum({ label, value, unit, warn }: any) {
  return (
    <div style={S.sum}>
      <div style={{ fontSize: 11, opacity: 0.65 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: warn ? '#dc2626' : '#1f2937' }}>{value}</div>
      {unit ? <div style={{ fontSize: 10, opacity: 0.5 }}>{unit}</div> : null}
    </div>
  )
}

function Act({ label, onClick, primary }: any) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 15, fontWeight: 700,
        border: primary ? 'none' : '1px solid #e5e7eb',
        background: primary ? '#b8860b' : '#fff',
        color: primary ? '#fff' : '#374151',
        cursor: 'pointer',
      }}
    >{label}</button>
  )
}

const gold = '#b8860b'
const S: any = {
  page: { minHeight: '100vh', background: '#faf6f0', paddingBottom: 60 },
  bar: {
    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
    background: 'linear-gradient(180deg,#faf6f0,#fffaf0)',
    borderBottom: '1px solid rgba(184,134,11,.22)',
    position: 'sticky', top: 0, zIndex: 10,
  },
  back: {
    background: 'rgba(184,134,11,.12)', border: 'none', borderRadius: '50%',
    width: 36, height: 36, fontSize: 18, color: gold, fontWeight: 700, cursor: 'pointer',
  },
  barTitle: { fontSize: 17, fontWeight: 800, color: '#1f2937' },
  barSub: { fontSize: 11, opacity: 0.5 },
  addBtn: {
    background: gold, color: '#fff', border: 'none', borderRadius: 10,
    padding: '9px 14px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
  },
  sumRow: { display: 'flex', gap: 8, padding: '12px 16px 4px' },
  sum: { flex: 1, background: '#fff', borderRadius: 12, padding: '10px 8px', textAlign: 'center', border: '1px solid #f0e6d2' },
  searchWrap: { padding: '8px 16px' },
  search: { width: '100%', padding: '10px 14px', borderRadius: 12, fontSize: 14, border: '1px solid #e5e7eb', background: '#fff', boxSizing: 'border-box' },
  row: { display: 'flex', alignItems: 'center', margin: '8px 16px', padding: '12px 14px', background: '#fff', borderRadius: 14, border: '1px solid #f0e6d2', cursor: 'pointer' },
  badge: (lv: string) => ({ fontSize: 11, fontWeight: 700, color: '#fff', background: LEVEL_COLOR[lv] || '#94a3b8', padding: '2px 7px', borderRadius: 6 }),
  phone: { fontSize: 15, fontWeight: 700, color: '#1f2937' },
  rowSub: { fontSize: 11, opacity: 0.55, marginTop: 4 },
  bal: { fontSize: 17, fontWeight: 800, color: gold },
  frozen: { fontSize: 10, color: '#dc2626', border: '1px solid #fecaca', padding: '1px 5px', borderRadius: 4 },
  hint: { textAlign: 'center', padding: 40, color: '#9ca3af', fontSize: 14 },
  err: { margin: '8px 16px', padding: 10, background: '#fee2e2', color: '#991b1b', borderRadius: 10, fontSize: 13 },
  mask: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'flex-end', zIndex: 100 },
  sheet: { width: '100%', background: '#fff', borderRadius: '20px 20px 0 0', padding: '18px 18px 32px', maxHeight: '86vh', overflowY: 'auto' },
  sheetHead: { display: 'flex', alignItems: 'flex-start', marginBottom: 14 },
  close: { background: 'none', border: 'none', fontSize: 26, color: '#9ca3af', cursor: 'pointer' },
  bigBal: { background: 'linear-gradient(135deg,#fffaf0,#fff5db)', borderRadius: 14, padding: '14px 16px', marginBottom: 14, textAlign: 'center' },
  acts: { display: 'flex', gap: 8, marginBottom: 16 },
  logTitle: { fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 8 },
  logs: { borderTop: '1px solid #f3f4f6', paddingTop: 6 },
  logRow: { display: 'flex', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid #f9fafb', fontSize: 13 },
}
