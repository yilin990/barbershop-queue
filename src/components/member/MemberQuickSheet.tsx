'use client'

/**
 * MemberQuickSheet - 队列里的会员卡快捷弹层（v1.1.38 · 2026-10-07 清禾）
 *
 * 这是会员功能真正的战场：店长剪完头那一刻，手机上开的就是队列页，
 * 他伸手就要扣钱 —— 所以入口在队列每一行里，不在另一个页面。
 *
 * 约定：
 * - 所有动作都打 /api/members，余额永远由服务端过 MemberCardLog，前端不给改余额的入口
 * - 充值给预设档位（店长点一下就行，不用心算送多少）
 * - 扣款自动按等级折扣算，店长能看见「原价 → 实收」
 */

import { useCallback, useEffect, useState } from 'react'

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

// 预设充值档位：实付 -> 赠送
const PRESETS: [number, number][] = [
  [500, 50], [1000, 200], [2000, 500],
]

// v1.1.39 服务项目：跟 BookingSection 的 ALL_SERVICES 对齐
const SERVICES = ['剪发', '烫发', '染发', '护理', '造型', '其他']

function svcChip(on: boolean) {
  return {
    padding: '8px 0',
    flex: 1,
    borderRadius: 9,
    fontSize: 13,
    fontWeight: 700,
    border: on ? 'none' : '1px solid #e5e7eb',
    background: on ? gold : '#fff',
    color: on ? '#fff' : '#374151',
    cursor: 'pointer',
  }
}

const gold = '#b8860b'
const LEVEL_COLOR: Record<string, string> = {
  normal: '#94a3b8', silver: '#8a8d98', gold: '#b8860b', diamond: '#7c3aed',
}
const yuan = (n: number) => '¥' + Number(n || 0).toFixed(2)

export default function MemberQuickSheet({
  merchantId, phone, customerName, service, orderNo, onClose,
}: {
  merchantId: string
  phone: string
  customerName: string
  service?: string
  orderNo?: string
  onClose: () => void
}) {
  const [card, setCard] = useState<Card | null>(null)
  const [logs, setLogs] = useState<LogRow[]>([])
  const [missing, setMissing] = useState(false)
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  const [price, setPrice] = useState('')
  // v1.1.39 扣卡三件套：服务项目 / 备注 / 二次确认
  const [svc, setSvc] = useState<string>(service || '')
  const [note, setNote] = useState('')
  const [confirm, setConfirm] = useState<null | { amount: number; useDiscount: boolean }>(null)

  const load = useCallback(async () => {
    const r = await fetch(
      '/api/members/' + encodeURIComponent(phone) + '?merchantId=' + merchantId
    )
    const j = await r.json()
    if (j.ok) { setCard(j.card); setLogs(j.logs || []); setMissing(false) }
    else { setMissing(true); setErr(j.error || '') }
  }, [merchantId, phone])

  useEffect(() => { load() }, [load])

  async function post(action: string, body: any) {
    setBusy(action); setErr('')
    try {
      const r = await fetch('/api/members/' + encodeURIComponent(phone), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchantId, action, operator: '店长', ...body }),
      })
      const j = await r.json()
      if (j.ok) { setCard(j.card); setLogs(j.logs || []); setMissing(false) }
      else setErr(j.error)
    } catch (e: any) {
      setErr('网络错误：' + (e?.message || ''))
    }
    setBusy('')
  }

  async function openCard() {
    const r = await fetch('/api/members', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ merchantId, phone, nickname: customerName, operator: '店长' }),
    })
    const j = await r.json()
    if (j.ok) { setCard(j.card); setMissing(false) } else setErr(j.error)
  }

  const listPrice = Number(price) || 0
  const realPrice = card ? Math.round(listPrice * card.discount * 100) / 100 : listPrice

  return (
    <div style={S.mask} onClick={onClose}>
      <div style={S.sheet} onClick={(e) => e.stopPropagation()}>
        {/* v1.1.39 二次确认：钱的事必须店长亲手确认一次，不点错就扣走 */}
        {confirm && (
          <div style={S.cMask} onClick={(e) => { e.stopPropagation(); setConfirm(null) }}>
            <div style={S.cBox} onClick={(e) => e.stopPropagation()}>
              <div style={S.cTitle}>确认扣款</div>
              <div style={S.cRow}><span>顾客</span><b>{customerName}</b></div>
              <div style={S.cRow}><span>服务</span><b>{svc || '未选'}</b></div>
              <div style={S.cRow}><span>原价</span><b>{yuan(listPrice)}</b></div>
              <div style={S.cRow}>
                <span>折扣</span>
                <b>{confirm.useDiscount && card.discount < 1 ? (card.discount * 10).toFixed(1) + ' 折' : '无'}</b>
              </div>
              <div style={S.cRow}><span>备注</span><b>{note || '无'}</b></div>
              {orderNo ? <div style={S.cRow}><span>订单</span><b>{orderNo}</b></div> : null}
              <div style={S.cDivider} />
              <div style={S.cRowBig}>
                <span>本次扣款</span>
                <b style={{ color: gold }}>{yuan(confirm.amount)}</b>
              </div>
              <div style={S.cRow}>
                <span>扣后余额</span>
                <b>{yuan(Math.round((card.balanceYuan - confirm.amount) * 100) / 100)}</b>
              </div>
              {confirm.amount > card.balanceYuan && (
                <div style={S.cErr}>余额不足，扣不了</div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <Btn label="再想想" big onClick={() => setConfirm(null)} />
                <Btn
                  label="确认扣款"
                  primary
                  big
                  disabled={!!busy || confirm.amount <= 0 || confirm.amount > card.balanceYuan}
                  onClick={async () => {
                    setConfirm(null)
                    await post('consume', {
                      amountYuan: confirm.amount,
                      service: svc,
                      orderNo,
                      note: note || undefined,
                    })
                    setNote('')
                    setPrice('')
                  }}
                />
              </div>
            </div>
          </div>
        )}
        <div style={S.head}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 800 }}>
              {customerName}
              {card
                ? <span style={{ ...S.badge, background: LEVEL_COLOR[card.level] || '#94a3b8', marginLeft: 8 }}>
                    {card.levelLabel}
                  </span>
                : null}
            </div>
            <div style={{ fontSize: 12, opacity: 0.55, marginTop: 2 }}>{phone}</div>
          </div>
          <button style={S.close} onClick={onClose}>×</button>
        </div>

        {err && <div style={S.err}>{err}</div>}

        {missing ? (
          <div style={S.box}>
            <div style={{ fontSize: 14, marginBottom: 4, fontWeight: 700 }}>这还不是会员</div>
            <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 14 }}>
              开张卡就能储值了 —— 顾客的钱先进来，服务慢慢做
            </div>
            <Btn label="开卡" primary big onClick={openCard} />
          </div>
        ) : card ? (
          <>
            <div style={S.balanceBox}>
              <div style={{ fontSize: 11, opacity: 0.65 }}>卡内余额</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: gold, lineHeight: 1.2 }}>
                {yuan(card.balanceYuan)}
              </div>
              <div style={{ fontSize: 11, opacity: 0.65, marginTop: 4 }}>
                {(card.discount * 10).toFixed(1)} 折 · 累计充值 {yuan(card.rechargeYuan)} ·
                {' '}到店 {card.visitCount} 次
              </div>
              {card.nextLevel ? (
                <div style={{ fontSize: 11, color: gold, marginTop: 4 }}>
                  再充 {yuan(card.toNextCents / 100)} 升 {card.nextLevel.label}
                </div>
              ) : null}
            </div>

            {card.status !== 'active' && (
              <div style={S.warn}>这张卡当前是「{card.status}」，充值和扣款都会被拒绝</div>
            )}

            <div style={S.secTitle}>充值</div>
            <div style={S.presetRow}>
              {PRESETS.map(([pay, bonus]) => (
                <button
                  key={pay}
                  disabled={!!busy}
                  onClick={() => post('recharge', { amountYuan: pay, bonusYuan: bonus })}
                  style={S.preset}
                >
                  <div style={{ fontSize: 15, fontWeight: 800 }}>{yuan(pay)}</div>
                  <div style={{ fontSize: 11, color: gold }}>送 {yuan(bonus)}</div>
                  <div style={{ fontSize: 10, opacity: 0.5 }}>
                    到账 {yuan(pay + bonus)}
                  </div>
                </button>
              ))}
            </div>
            <div style={{ marginTop: 8 }}>
              <Btn
                label="其他金额"
                onClick={async () => {
                  const v = prompt('充值金额（元）')
                  if (v === null) return
                  const b = prompt('赠送金额（元，没有就填 0）', '0')
                  if (b === null) return
                  post('recharge', { amountYuan: Number(v), bonusYuan: Number(b) || 0 })
                }}
              />
            </div>

            <div style={S.secTitle}>服务项目</div>
            <div style={S.svcRow}>
              {SERVICES.map((x) => (
                <button
                  key={x}
                  onClick={() => setSvc(x)}
                  style={svcChip(svc === x)}
                >
                  {x}
                </button>
              ))}
            </div>

            <div style={S.secTitle}>金额</div>
            <div style={S.priceRow}>
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                inputMode="decimal"
                placeholder="原价"
                style={S.input}
              />
              <div style={S.realPrice}>
                {listPrice > 0
                  ? card.discount < 1
                    ? '实收 ' + yuan(realPrice) + '（' + (card.discount * 10).toFixed(1) + '折）'
                    : '实收 ' + yuan(realPrice)
                  : '填原价自动算折扣'}
              </div>
            </div>

            <div style={S.secTitle}>备注（可不填）</div>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="如：加做造型 / 朋友介绍 / 客人要求"
              style={S.noteInput}
            />

            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <Btn
                label="从卡里扣"
                primary
                big
                disabled={listPrice <= 0 || !!busy}
                onClick={() => setConfirm({ amount: realPrice, useDiscount: true })}
              />
              <Btn
                label="原价扣（不打折）"
                big
                disabled={listPrice <= 0 || !!busy}
                onClick={() => setConfirm({ amount: listPrice, useDiscount: false })}
              />
            </div>

            {logs.length > 0 && (
              <>
                <div style={S.secTitle}>最近流水</div>
                <div style={S.logs}>
                  {logs.slice(0, 6).map(l => (
                    <div key={l.id} style={S.logRow}>
                      <span style={{ fontWeight: 600 }}>
                        {TYPE_LABEL[l.type] || l.type}
                        {l.service ? ' · ' + l.service : ''}
                      </span>
                      <span style={{
                        fontWeight: 700,
                        color: l.changeCents >= 0 ? '#16a34a' : '#dc2626',
                      }}>
                        {l.changeCents >= 0 ? '+' : ''}{(l.changeCents / 100).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div style={S.foot}>
              <Btn label="调整（必须填原因）" small onClick={async () => {
                const d = prompt('调整金额（正数=加，负数=扣）')
                if (d === null) return
                const r = prompt('原因（会记进流水）')
                if (!r) return
                post('adjust', { deltaYuan: Number(d), reason: r })
              }} />
              <Btn label={card.status === 'active' ? '冻结卡' : '解冻卡'} small onClick={() =>
                post('status', { status: card.status === 'active' ? 'frozen' : 'active' })
              } />
            </div>
          </>
        ) : (
          <div style={S.box}>加载中…</div>
        )}
      </div>
    </div>
  )
}

function Btn({
  label, onClick, primary, big, small, disabled,
}: {
  label: string
  onClick: () => void
  primary?: boolean
  big?: boolean
  small?: boolean
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1,
        padding: big ? '13px 0' : small ? '8px 6px' : '10px 0',
        borderRadius: 10,
        fontSize: big ? 15 : small ? 12 : 14,
        fontWeight: 700,
        border: primary ? 'none' : '1px solid #e5e7eb',
        background: primary ? gold : '#fff',
        color: primary ? '#fff' : '#374151',
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >{label}</button>
  )
}

const S: any = {
  // v1.1.38 改：底部弹出被 AppLayout 的 BottomTabBar 压住，开卡按钮点不到。
  // 改成屏幕正中，z-index 拉到 TabBar 之上。
  mask: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '20px 16px', zIndex: 9999,
  },
  sheet: {
    width: '100%', maxWidth: 440,
    background: '#fff', borderRadius: 18,
    padding: '18px 18px 20px',
    maxHeight: '82vh', overflowY: 'auto',
    boxShadow: '0 12px 40px rgba(0,0,0,.28)',
  },
  head: { display: 'flex', alignItems: 'flex-start', marginBottom: 14 },
  close: { background: 'none', border: 'none', fontSize: 26, color: '#9ca3af', cursor: 'pointer', lineHeight: 1 },
  badge: { fontSize: 11, fontWeight: 700, color: '#fff', padding: '2px 7px', borderRadius: 6 },
  err: { padding: 10, background: '#fee2e2', color: '#991b1b', borderRadius: 10, fontSize: 13, marginBottom: 12 },
  warn: { padding: 9, background: '#fef3c7', color: '#92400e', borderRadius: 10, fontSize: 12, marginBottom: 12 },
  box: { padding: 16, textAlign: 'center' },
  balanceBox: {
    background: 'linear-gradient(135deg,#fffaf0,#fff5db)', borderRadius: 14,
    padding: '14px 16px', marginBottom: 16, textAlign: 'center',
  },
  secTitle: { fontSize: 12, fontWeight: 700, color: '#374151', margin: '16px 0 8px' },
  presetRow: { display: 'flex', gap: 8 },
  preset: {
    flex: 1, padding: '12px 4px', borderRadius: 12, cursor: 'pointer',
    border: '1px solid #f0e6d2', background: '#fffdf8', textAlign: 'center', lineHeight: 1.4,
  },
  priceRow: { display: 'flex', alignItems: 'center', gap: 10 },
  input: {
    width: 110, padding: '10px 12px', borderRadius: 10, fontSize: 15,
    border: '1px solid #e5e7eb', boxSizing: 'border-box',
  },
  realPrice: { flex: 1, fontSize: 13, fontWeight: 700, color: gold },
  logs: { border: '1px solid #f3f4f6', borderRadius: 10, overflow: 'hidden' },
  logRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '9px 12px', fontSize: 13, borderBottom: '1px solid #f9fafb',
  },
  foot: { display: 'flex', gap: 8, marginTop: 16 },
  // v1.1.39
  svcRow: { display: 'flex', gap: 6 },
  noteInput: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 10,
    fontSize: 14,
    border: '1px solid #e5e7eb',
    boxSizing: 'border-box',
  },
  cMask: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 20px',
    zIndex: 10000,
  },
  cBox: {
    width: '100%',
    maxWidth: 360,
    background: '#fff',
    borderRadius: 16,
    padding: '20px 18px',
    boxShadow: '0 12px 40px rgba(0,0,0,.3)',
  },
  cTitle: { fontSize: 17, fontWeight: 800, marginBottom: 14, color: '#1f2937' },
  cRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 13,
    padding: '5px 0',
    color: '#6b7280',
  },
  cDivider: { height: 1, background: '#f3f4f6', margin: '10px 0' },
  cRowBig: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 15,
    fontWeight: 700,
    color: '#1f2937',
  },
  cErr: {
    marginTop: 10,
    padding: 8,
    background: '#fee2e2',
    color: '#991b1b',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 600,
  },
}
