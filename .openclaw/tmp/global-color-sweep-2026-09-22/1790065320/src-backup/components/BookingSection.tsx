'use client'

/**
 * ⭐ 2026-09-20 17:46 奕霖拍板：完全复制 BookingSection 到独立组件
 *
 * 用途：客人预约 / 取号 / 实时排队 / 店长模式（PIN + 3 档 / 自助管 / AI 管）
 * 设计：merchant/page.tsx + merchant/queue/page.tsx 都 import 这一个组件，保证 100% 功能一致
 *
 * 依赖：
 *  - manager-auth.ts (PIN 哈希 + 自动锁定)
 *  - PinSetupModal + PinUnlockModal
 *  - 内置 BookingModal / TicketModal / AgreementModal
 */

import { useState, useEffect } from 'react'
import {
  hasPin, getRemindState, dismissRemind, isLockExpired,
  isInGracePeriod,
  setLastAuthTime,
} from '@/lib/manager-auth'
// ⭐ 2026-09-20 18:14 奕霖拍板：在“在线预约”加服务项目选择（剪发/染发/烫发/护理/造型）
// + 服务→理发师自动推荐（推荐但不限）
import {
  recommendStylist, ALL_SERVICES,
  type ServiceType,
} from '@/lib/stylist-specialties'
import { PinSetupModal } from './PinSetupModal'
import { PinUnlockModal } from './PinUnlockModal'
import { PricingModal, UpgradeBanner } from './PricingModal'

// ==============================================
// 订单类型 + 初始数据
// ==============================================
type OrderStatus = 'reserved' | 'arrived' | 'serving' | 'completed' | 'no_show'

interface Order {
  id: string
  customerName: string
  customerPhone: string
  service: '剪发' | '烫发' | '染发' | '护理'
  stylistName: string
  status: OrderStatus
  scheduledAt: string
  scheduledDate: 'today' | 'tomorrow' | 'dayAfter'
  arrivedAt?: string
  startedAt?: string
  completedAt?: string
  note?: string
}

const INITIAL_ORDERS: Order[] = [
  { id: 'O001', customerName: '李先生', customerPhone: '138****1234', service: '烫发', stylistName: 'Tony', status: 'serving', scheduledAt: '14:00', scheduledDate: 'today', startedAt: '14:05' },
  { id: 'O002', customerName: '王女士', customerPhone: '139****5678', service: '剪发', stylistName: 'Amy', status: 'arrived', scheduledAt: '14:30', scheduledDate: 'today', arrivedAt: '14:28' },
  { id: 'O008', customerName: '周先生', customerPhone: '139****6789', service: '剪发', stylistName: 'Lily', status: 'arrived', scheduledAt: '15:00', scheduledDate: 'today', arrivedAt: '14:50' },
  { id: 'O003', customerName: '张先生', customerPhone: '138****9012', service: '染发', stylistName: 'Lily', status: 'reserved', scheduledAt: '15:00', scheduledDate: 'today' },
  { id: 'O004', customerName: '陈女士', customerPhone: '136****3456', service: '护理', stylistName: 'Tony', status: 'reserved', scheduledAt: '16:00', scheduledDate: 'today' },
  { id: 'O005', customerName: '李先生', customerPhone: '138****1234', service: '烫发', stylistName: 'Tony', status: 'reserved', scheduledAt: '16:00', scheduledDate: 'tomorrow', note: '明天下午 4 点' },
  { id: 'O006', customerName: '赵女士', customerPhone: '137****7890', service: '剪发', stylistName: 'Lily', status: 'reserved', scheduledAt: '15:30', scheduledDate: 'tomorrow' },
  { id: 'O007', customerName: '孙先生', customerPhone: '135****2345', service: '染发', stylistName: 'Amy', status: 'reserved', scheduledAt: '17:00', scheduledDate: 'tomorrow' },
  { id: 'O009', customerName: '钱女士', customerPhone: '135****1111', service: '剪发', stylistName: 'Amy', status: 'reserved', scheduledAt: '15:30', scheduledDate: 'today' },
  { id: 'O010', customerName: '郑先生', customerPhone: '136****2222', service: '烫发', stylistName: 'Tony', status: 'reserved', scheduledAt: '16:30', scheduledDate: 'today' },
  { id: 'O011', customerName: '吴女士', customerPhone: '137****3333', service: '染发', stylistName: 'Lily', status: 'reserved', scheduledAt: '17:00', scheduledDate: 'today' },
  { id: 'O012', customerName: '冯先生', customerPhone: '138****4444', service: '护理', stylistName: 'Amy', status: 'reserved', scheduledAt: '17:30', scheduledDate: 'today' },
  { id: 'O013', customerName: '陈女士', customerPhone: '139****5555', service: '剪发', stylistName: 'Tony', status: 'reserved', scheduledAt: '18:00', scheduledDate: 'today' },
  { id: 'O014', customerName: '韩女士', customerPhone: '135****6666', service: '烫发', stylistName: 'Lily', status: 'reserved', scheduledAt: '18:30', scheduledDate: 'today' },
]

function maskPhone(p: string): string {
  return p.length >= 7 ? p.slice(0, 3) + '****' + p.slice(-4) : p
}

function statusLabel(s: OrderStatus): { text: string; bg: string; color: string } {
  switch (s) {
    case 'reserved': return { text: '已预约', bg: 'rgba(184, 134, 11, 0.15)', color: '#8b6508' }
    case 'arrived': return { text: '已到店', bg: 'rgba(45, 125, 50, 0.15)', color: '##b8860b' }
    case 'serving': return { text: '正在服务', bg: 'rgba(184, 134, 11, 0.95)', color: '#fff' }
    case 'completed': return { text: '已完成', bg: 'rgba(139, 0, 0, 0.15)', color: '#8b0000' }
    case 'no_show': return { text: '未到店', bg: 'rgba(141, 110, 99, 0.2)', color: '#5d4037' }
  }
}

// ==============================================
// Helper Components（merchant/page.tsx 里的同名组件）
// ==============================================

function ActionButton({ icon, label, onClick, t }: {
  icon: string; label: string; onClick: () => void; t: any
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '16px 18px',
        background: t.bgCard,
        border: `1px solid ${t.border}`,
        borderRadius: 12,
        cursor: 'pointer',
        fontSize: 15, fontWeight: 600,
        color: t.text,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        boxShadow: '0 2px 8px rgba(184, 134, 11, 0.06)',
      }}
    >
      <span style={{ fontSize: 20 }}>{icon}</span>
      <span>{label}</span>
    </button>
  )
}

function ModalOverlay({ children, onClose, t }: {
  children: React.ReactNode; onClose: () => void; t: any
}) {
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0,
      background: t.overlayBg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 16,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: t.bgCard,
        borderRadius: 16,
        width: '100%', maxWidth: 440,
        maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 16px 48px rgba(0, 0, 0, 0.2)',
        border: `1px solid ${t.border}`,
      }}>
        {children}
      </div>
    </div>
  )
}

function ModalHeader({ title, onClose, t }: {
  title: string; onClose: () => void; t: any
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '16px 20px',
      borderBottom: `1px solid ${t.border}`,
    }}>
      <h3 style={{ fontSize: 18, fontWeight: 700, color: t.text }}>{title}</h3>
      <button onClick={onClose} style={{
        background: 'transparent', border: 'none',
        fontSize: 24, color: t.textMuted,
        cursor: 'pointer', padding: 0, lineHeight: 1,
      }}>×</button>
    </div>
  )
}

function FormField({ label, required, children, t }: {
  label: string; required?: boolean; children: React.ReactNode; t: any
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, color: t.textSecondary, fontWeight: 500, marginBottom: 4 }}>
        {label} {required && <span style={{ color: t.accent }}>*</span>}
      </div>
      {children}
    </div>
  )
}

// ==============================================
// BookingModal（在线预约）
// ==============================================
function BookingModal({ t, onClose, onSuccess }: {
  t: any; onClose: () => void; onSuccess: (no: string) => void
}) {
  // ⭐ 2026-09-20 21:01 bug 修复：本地函数避免 webpack 跨 chunk ReferenceError
  function getServiceEmoji(s: ServiceType): string {
    switch (s) {
      case '剪发': return '✂️'
      case '染发': return '🎨'
      case '烫发': return '〰️'
      case '护理': return '💆'
      case '造型': return '✨'
    }
  }

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  // ⭐ 2026-09-20 18:14 奕霖拍板：服务项目选择（剪发/染发/烫发/护理/造型）
  const [serviceType, setServiceType] = useState<ServiceType>('剪发')
  const [stylist, setStylist] = useState<'Tony' | 'Amy' | 'Lily'>('Tony')
  const [dateKey, setDateKey] = useState<'today' | 'tomorrow' | 'dayAfter'>('today')
  const [timeSlot, setTimeSlot] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [bookedHint, setBookedHint] = useState('')

  // ⭐ 18:14：服务改变时自动推荐 top1 理发师（推荐但不限）
  const recommendedStylist = recommendStylist(serviceType)[0]
  useEffect(() => {
    setStylist(recommendedStylist.name)
    setTimeSlot('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceType])

  const TIME_SLOTS: string[] = []
  for (let h = 10; h <= 21; h++) {
    TIME_SLOTS.push(`${h}:00`)
    TIME_SLOTS.push(`${h}:30`)
  }

  const [bookedByStylist, setBookedByStylist] = useState<Record<string, Record<string, string>>>({})
  useEffect(() => {
    const m: Record<string, Record<string, string>> = { Tony: {}, Amy: {}, Lily: {} }
    INITIAL_ORDERS.forEach(o => {
      if (o.status === 'reserved' && o.scheduledDate === dateKey) {
        if (!m[o.stylistName]) m[o.stylistName] = {}
        m[o.stylistName][o.scheduledAt] = o.customerName
      }
    })
    setBookedByStylist(m)
  }, [dateKey])

  async function submit() {
    setError('')
    if (!phone || phone.length < 11) { setError('请填写 11 位手机号'); return }
    if (!timeSlot) { setError('请选择时段'); return }
    if (!name) { setError('请填写称呼'); return }
    setSubmitting(true)
    try {
      await new Promise((r) => setTimeout(r, 800))
      const no = 'A' + String(Math.floor(Math.random() * 99) + 1).padStart(3, '0')
      onSuccess(no)
    } catch (e: any) {
      setError(e?.message || '提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  const inputSt: React.CSSProperties = {
    width: '100%', padding: '10px 12px',
    background: t.bgDeep,
    border: `1px solid ${t.border}`,
    borderRadius: 8, fontSize: 14, color: t.text,
    outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
  }

  const dateTabs: { key: 'today' | 'tomorrow' | 'dayAfter'; label: string }[] = [
    { key: 'today', label: '今天' },
    { key: 'tomorrow', label: '明天' },
    { key: 'dayAfter', label: '后天' },
  ]

  // ⭐ 2026-09-20 18:14 奕霖拍板：根据服务项目推荐理发师（按剪发/染发/烫发/护理/造型 专长度排序）
  // 推荐但不限 —— top1 自动选中，用户可手动换其他
  const recommendedList = recommendStylist(serviceType)
  const stylists = recommendedList.map((p, idx) => ({
    name: p.name,
    emoji: p.emoji,
    years: p.years,
    desc: `${p.years}年 · ${p.signature.split('+')[0].trim()}`,
    isRecommended: idx === 0,
  }))

  return (
    <ModalOverlay t={t} onClose={onClose}>
      <ModalHeader title="📅 在线预约" onClose={onClose} t={t} />
      <div style={{ padding: 20, maxHeight: '70vh', overflowY: 'auto' }}>
        <FormField label="称呼" required t={t}>
          <input type="text" placeholder="如：李先生 / 王女士"
            value={name} onChange={(e) => setName(e.target.value)} style={inputSt} />
        </FormField>
        <FormField label="手机号" required t={t}>
          <input type="tel" placeholder="11 位手机号（接收通知）"
            value={phone} onChange={(e) => setPhone(e.target.value)} style={inputSt} />
        </FormField>

        {/* ⭐ 2026-09-20 18:14 奕霖拍板：服务项目选择（5 选 1） → 自动推荐理发师 */}
        <FormField label="💇 选择服务项目" required t={t}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {ALL_SERVICES.map(s => (
              <button key={s}
                onClick={() => setServiceType(s)}
                style={{
                  flex: '1 1 calc(33% - 4px)',
                  minWidth: 80,
                  padding: '8px 6px',
                  background: serviceType === s ? t.primary : t.bgDeep,
                  color: serviceType === s ? '#fff' : t.text,
                  border: `1.5px solid ${serviceType === s ? t.primary : t.border}`,
                  borderRadius: 8,
                  cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                  fontFamily: 'inherit',
                }}
              >
                <span style={{ fontSize: 16 }}>{getServiceEmoji(s)}</span>
                <span style={{ fontSize: 12, fontWeight: 700 }}>{s}</span>
              </button>
            ))}
          </div>
        </FormField>

        <FormField label="选择理发师（每人独立预约）" required t={t}>
          <div style={{ display: 'flex', gap: 6 }}>
            {stylists.map(s => (
              <button key={s.name}
                onClick={() => { setStylist(s.name); setTimeSlot('') }}
                style={{
                  flex: 1, padding: '10px 4px',
                  background: stylist === s.name ? t.primary : t.bgDeep,
                  color: stylist === s.name ? '#fff' : t.text,
                  border: `2px solid ${stylist === s.name ? t.primary : t.border}`,
                  borderRadius: 8,
                  cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                  position: 'relative',
                }}
              >
                {/* ⭐ 2026-09-20 18:14 奕霖拍板：推荐理发师 badge */}
                {s.isRecommended && (
                  <span style={{
                    position: 'absolute',
                    top: -8, left: '50%', transform: 'translateX(-50%)',
                    padding: '1px 6px',
                    background: 'linear-gradient(135deg, #b8860b, #f59e0b)',
                    color: '#fff',
                    borderRadius: 8,
                    fontSize: 9, fontWeight: 700,
                    whiteSpace: 'nowrap',
                    boxShadow: '0 2px 6px rgba(184, 134, 11, 0.3)',
                  }}>⭐ 推荐</span>
                )}
                <span style={{ fontSize: 18 }}>{s.emoji}</span>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{s.name}</span>
                <span style={{ fontSize: 9, opacity: 0.85 }}>{s.desc}</span>
              </button>
            ))}
          </div>
        </FormField>

        <FormField label="选择日期" required t={t}>
          <div style={{ display: 'flex', gap: 6 }}>
            {dateTabs.map(tab => (
              <button key={tab.key}
                onClick={() => { setDateKey(tab.key); setTimeSlot('') }}
                style={{
                  flex: 1, padding: '10px 0',
                  background: dateKey === tab.key ? t.primary : t.bgDeep,
                  color: dateKey === tab.key ? '#fff' : t.text,
                  border: `1px solid ${dateKey === tab.key ? t.primary : t.border}`,
                  borderRadius: 8, fontSize: 13, fontWeight: 600,
                  cursor: 'pointer',
                }}
              >{tab.label}</button>
            ))}
          </div>
        </FormField>

        <FormField label={`${stylist} 的可选时段（半小时一档）`} required t={t}>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 6,
          }}>
            {TIME_SLOTS.map(slot => {
              const booked = currentStylistBooked[slot]
              const selected = timeSlot === slot
              return (
                <button key={slot}
                  onClick={() => {
                    if (booked) {
                      setBookedHint(`${stylist} ${slot} 已被「${booked}」预约，请选其他时段`)
                      setTimeout(() => setBookedHint(''), 3500)
                      return
                    }
                    setTimeSlot(slot)
                  }}
                  style={{
                    padding: '10px 4px',
                    background: booked
                      ? '#f3f4f6'
                      : selected ? t.primary : t.bgDeep,
                    color: booked
                      ? '#9ca3af'
                      : selected ? '#fff' : t.text,
                    border: `1px solid ${selected ? t.primary : booked ? '#e5e7eb' : t.border}`,
                    borderRadius: 8,
                    fontSize: 12, fontWeight: 600,
                    fontFamily: 'monospace',
                    cursor: booked ? 'not-allowed' : 'pointer',
                    opacity: booked ? 0.65 : 1,
                    textDecoration: booked ? 'line-through' : 'none',
                  }}
                  title={booked ? `已被 ${booked} 预约` : '可预约'}
                >
                  <div>{slot}</div>
                  {booked && (
                    <div style={{ fontSize: 8, fontWeight: 400, marginTop: 1, fontFamily: 'inherit' }}>
                      {booked.slice(0, 2)}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
          <div style={{ fontSize: 11, color: t.textMuted, marginTop: 8, textAlign: 'center' }}>
            营业时间 10:00 - 22:00 · 每人独立预约 · 互不影响
          </div>
        </FormField>

        {bookedHint && (
          <div style={{
            padding: '8px 12px', background: '#fef3c7',
            border: '1px solid #f59e0b', borderRadius: 8,
            fontSize: 12, color: '#78350f', marginBottom: 10, textAlign: 'center',
          }}>⚠️ {bookedHint}</div>
        )}
        {error && (
          <div style={{ fontSize: 13, color: t.accent, marginBottom: 10 }}>{error}</div>
        )}

        <button onClick={submit} disabled={submitting || !timeSlot} style={{
          width: '100%', padding: '12px 16px',
          background: submitting || !timeSlot ? t.textMuted : t.primary,
          color: '#2c1810', border: 'none', borderRadius: 10,
          fontSize: 15, fontWeight: 600,
          cursor: submitting || !timeSlot ? 'not-allowed' : 'pointer',
          marginTop: 4,
        }}>
          {submitting ? '提交中…' : timeSlot ? `✅ 预约 ${stylist} ${timeSlot}` : '请选择时段'}
        </button>
        <div style={{ marginTop: 14, fontSize: 12, color: t.textMuted, textAlign: 'center' }}>
          请提前 5 分钟到店 · 晚到 2 分钟系统自动取消
        </div>
      </div>
    </ModalOverlay>
  )
}

// ==============================================
// TicketModal（现场取号）
// ==============================================
function TicketModal({ t, onClose, onSuccess }: {
  t: any; onClose: () => void; onSuccess: (no: string) => void
}) {
  // ⭐ 2026-09-20 21:01 bug 修复：本地函数避免 webpack 跨 chunk ReferenceError
  function getServiceEmoji(s: ServiceType): string {
    switch (s) {
      case '剪发': return '✂️'
      case '染发': return '🎨'
      case '烫发': return '〰️'
      case '护理': return '💆'
      case '造型': return '✨'
    }
  }

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  // ⭐ 2026-09-20 18:21 奕霖拍板：现场取号加服务 + 理发师可选
  const [serviceType, setServiceType] = useState<ServiceType>('剪发')
  const [stylistPref, setStylistPref] = useState<'any' | 'Tony' | 'Amy' | 'Lily'>('any')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // ⭐ 18:21：根据服务推荐理发师（仅做提示，客人仍可选"随便哪位"）
  const recommendedStylist = recommendStylist(serviceType)[0]

  async function submit() {
    setError('')
    if (!phone || phone.length < 11) { setError('请填写 11 位手机号'); return }
    if (!name) { setError('请填写称呼'); return }
    setSubmitting(true)
    try {
      await new Promise((r) => setTimeout(r, 800))
      const no = 'B' + String(Math.floor(Math.random() * 99) + 1).padStart(3, '0')
      onSuccess(no)
    } catch (e: any) {
      setError(e?.message || '提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  const inputSt: React.CSSProperties = {
    width: '100%', padding: '10px 12px',
    background: t.bgDeep,
    border: `1px solid ${t.border}`,
    borderRadius: 8, fontSize: 14, color: t.text,
    outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
  }

  return (
    <ModalOverlay t={t} onClose={onClose}>
      <ModalHeader title="🎫 现场取号" onClose={onClose} t={t} />
      <div style={{ padding: 20 }}>
        {/* ⭐ 2026-09-20 18:21 奕霖拍板：现场取号加服务项目 + 理发师可选 */}
        <FormField label="💇 选择服务项目" required t={t}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {ALL_SERVICES.map(s => (
              <button key={s}
                onClick={() => setServiceType(s)}
                style={{
                  flex: '1 1 calc(33% - 4px)',
                  minWidth: 80,
                  padding: '8px 6px',
                  background: serviceType === s ? t.primary : t.bgDeep,
                  color: serviceType === s ? '#fff' : t.text,
                  border: `1.5px solid ${serviceType === s ? t.primary : t.border}`,
                  borderRadius: 8,
                  cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                  fontFamily: 'inherit',
                }}
              >
                <span style={{ fontSize: 16 }}>{getServiceEmoji(s)}</span>
                <span style={{ fontSize: 12, fontWeight: 700 }}>{s}</span>
              </button>
            ))}
          </div>
        </FormField>

        {/* ⭐ 18:21：理发师可选（默认“随便哪位”· 可选 Tony/Amy/Lily） */}
        <FormField label="👨‍🎨 选择理发师（可选）" t={t}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {([
              { key: 'any',  emoji: '🎲', label: '随便哪位',   desc: '系统按空闭分配' },
              { key: 'Tony', emoji: '👨‍🎨', label: 'Tony', desc: `${recommendedStylist.name === 'Tony' ? '⭐ 推荐 ' : ''}3年` },
              { key: 'Amy',  emoji: '👩‍💼', label: 'Amy',  desc: `${recommendedStylist.name === 'Amy'  ? '⭐ 推荐 ' : ''}5年` },
              { key: 'Lily', emoji: '💁‍♀️', label: 'Lily', desc: `${recommendedStylist.name === 'Lily' ? '⭐ 推荐 ' : ''}2年` },
            ] as { key: typeof stylistPref; emoji: string; label: string; desc: string }[]).map(opt => (
              <button key={opt.key}
                onClick={() => setStylistPref(opt.key)}
                style={{
                  flex: '1 1 calc(25% - 5px)',
                  minWidth: 64,
                  padding: '8px 4px',
                  background: stylistPref === opt.key ? t.primary : t.bgDeep,
                  color: stylistPref === opt.key ? '#fff' : t.text,
                  border: `1.5px solid ${stylistPref === opt.key ? t.primary : t.border}`,
                  borderRadius: 8,
                  cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                  fontFamily: 'inherit',
                }}
              >
                <span style={{ fontSize: 16 }}>{opt.emoji}</span>
                <span style={{ fontSize: 11, fontWeight: 700 }}>{opt.label}</span>
                <span style={{ fontSize: 9, opacity: 0.85 }}>{opt.desc}</span>
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: t.textMuted, marginTop: 6, textAlign: 'center' }}>
            ⭐ = 当前服务项目 ({serviceType}) 推荐理发师
          </div>
        </FormField>

        <FormField label="称呼" required t={t}>
          <input type="text" placeholder="如：李先生 / 王女士"
            value={name} onChange={(e) => setName(e.target.value)} style={inputSt} />
        </FormField>
        <FormField label="手机号" required t={t}>
          <input type="tel" placeholder="11 位手机号（到号通知）"
            value={phone} onChange={(e) => setPhone(e.target.value)} style={inputSt} />
        </FormField>
        {error && (
          <div style={{ fontSize: 13, color: t.accent, marginBottom: 10 }}>{error}</div>
        )}
        <button onClick={submit} disabled={submitting} style={{
          width: '100%', padding: '12px 16px',
          background: submitting ? t.textMuted : t.primary,
          color: '#2c1810', border: 'none', borderRadius: 10,
          fontSize: 15, fontWeight: 600,
          cursor: submitting ? 'not-allowed' : 'pointer',
          marginTop: 4,
        }}>
          {submitting ? '取号中…' : '🎫 立即取号'}
        </button>
        <div style={{ marginTop: 14, fontSize: 12, color: t.textMuted, textAlign: 'center' }}>
          取号后将加入现场排队 · 到号微信通知
        </div>
      </div>
    </ModalOverlay>
  )
}

// ==============================================
// AgreementModal（预约协议）
// ==============================================
function AgreementModal({ t, onClose }: { t: any; onClose: () => void }) {
  return (
    <ModalOverlay t={t} onClose={onClose}>
      <ModalHeader title="📋 预约与排队协议" onClose={onClose} t={t} />
      <div style={{ padding: 20 }}>
        <ol style={{ paddingLeft: 20, fontSize: 14, color: t.textSecondary, lineHeight: 1.9, margin: 0 }}>
          <li style={{ marginBottom: 8 }}>
            <b style={{ color: t.text }}>提前到店</b>：预约时段请提前 <b style={{ color: t.primary }}>5 分钟</b> 到店，超时未到视为放弃。
          </li>
          <li style={{ marginBottom: 8 }}>
            <b style={{ color: t.text }}>晚到取消</b>：晚到 <b style={{ color: t.accent }}>2 分钟</b> 系统自动取消预约，号源自动释放给现场排队顾客。
          </li>
          <li style={{ marginBottom: 8 }}>
            <b style={{ color: t.text }}>线上预约与线下排队互斥</b>：同一时段预约号优先于现场取号顾客，预约取消后该号源立刻加入线下排队。
          </li>
          <li style={{ marginBottom: 8 }}>
            <b style={{ color: t.text }}>取消规则</b>：请至少提前 30 分钟取消，3 次无故违约将限制后续预约。
          </li>
          <li style={{ marginBottom: 8 }}>
            <b style={{ color: t.text }}>改约规则</b>：可随时取消原预约并重新预约，不计入违约。
          </li>
          <li>
            <b style={{ color: t.text }}>争议处理</b>：如有疑问请到店咨询或拨打商家电话。
          </li>
        </ol>
      </div>
    </ModalOverlay>
  )
}

// ==============================================
// 主组件：BookingSection（完整版，920 行原代码 100% 复制）
// ==============================================
export default function BookingSection() {
  // 中国时间同步
  const [now, setNow] = useState(() => new Date())

  // 订单状态
  const [orders, setOrders] = useState<Order[]>(INITIAL_ORDERS)

  // 店长模式（含 PIN 认证 + 自动锁定）
  const [managerMode, setManagerMode] = useState(false)
  const [pinModal, setPinModal] = useState<null | 'setup' | 'unlock' | 'change'>(null)
  const [showPinPrompt, setShowPinPrompt] = useState(false)
  const [_, forceAuthRefresh] = useState(0)
  // ⭐ 2026-09-21 13:44 清禾自主推进：付费墙弹窗状态
  const [showPricing, setShowPricing] = useState(false)
  // 当前套餐（v1.0.0 用 localStorage 默认 'free'，v1.1.0 接后端读）
  const [currentPlan, setCurrentPlan] = useState<'free' | 'smart'>('free')

  // Effect 1：首次进店检测 + 是否提示设置 PIN（不自动开启店长模式）
  // ⭐ 2026-09-20 21:13 奕霖拍板：店长模式只能店长自己点 + 输密码才能打开
  // 安全修复：移除 if (hasPin() && !isLockExpired()) { setManagerMode(true) }
  // 原因：扫码客人打开 queue 页面也会自动进入店长控制台，严重安全漏洞
  useEffect(() => {
    if (!hasPin() && !getRemindState().dismissed) {
      setShowPinPrompt(true)
    }
    // ⭐ 不再自动开启 managerMode——店长想用就手动点"开启店长模式"按钮
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Effect 2：每 30 秒检测自动锁定
  useEffect(() => {
    if (!managerMode) return
    const id = setInterval(() => {
      if (hasPin() && isLockExpired()) {
        setManagerMode(false)
        forceAuthRefresh(x => x + 1)
      }
    }, 30 * 1000)
    return () => clearInterval(id)
  }, [managerMode])

  // 活动流
  const [activities, setActivities] = useState([
    { time: '14:32', text: '📅 李先生预约明天下午 4 点' },
    { time: '14:30', text: '✅ 王女士完成剪发' },
    { time: '14:28', text: '👋 王女士到店' },
  ])

  // 叫号推送 Toast
  const [toast, setToast] = useState('')

  // 弹窗
  const [modal, setModal] = useState<null | 'booking' | 'ticket' | 'agreement'>(null)
  const [bookingSuccess, setBookingSuccess] = useState('')
  const [ticketSuccess, setTicketSuccess] = useState('')

  // 时间同步
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const timeStr = now.toLocaleTimeString('zh-CN', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false, timeZone: 'Asia/Shanghai',
  })
  const dateStr = now.toLocaleDateString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    timeZone: 'Asia/Shanghai',
  })
  const weekdayStr = '星期' + ['日','一','二','三','四','五','六'][now.getDay()]

  // ⭐ 2026-09-20 15:07 奕霖立：实时排队列表 view 状态
  const [queueView, setQueueView] = useState<'flat' | 'byStylist'>('flat')

  // ⭐ 2026-09-20 15:34 奕霖立：店长控制台模式（3 档套餐 / per-stylist 自助管）
  type ManagerMode = 'owner' | 'perStylist' | 'ai'
  const [managerTab, setManagerTab] = useState<ManagerMode>('owner')
  const [managedStylist, setManagedStylist] = useState<'Tony' | 'Amy' | 'Lily'>('Tony')

  // 状态切换 helper
  function transition(id: string, newStatus: OrderStatus, activityText: string) {
    setOrders(prev => prev.map(o => {
      if (o.id !== id) return o
      const updated = { ...o, status: newStatus }
      const nowTime = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Shanghai' })
      if (newStatus === 'arrived') updated.arrivedAt = nowTime
      if (newStatus === 'serving') updated.startedAt = nowTime
      if (newStatus === 'completed') updated.completedAt = nowTime
      return updated
    }))
    const t = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Shanghai' })
    setActivities(prev => [{ time: t, text: activityText }, ...prev].slice(0, 5))
  }

  function callCustomer(id: string) {
    const o = orders.find(x => x.id === id)
    if (!o) return
    setToast(`📢 叫号推送已发送 · ${o.customerName} (${o.customerPhone}) · 微信/短信`)
    setTimeout(() => setToast(''), 3500)
    const t = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Shanghai' })
    setActivities(prev => [{ time: t, text: `📢 叫号推送 · ${o.customerName}` }, ...prev].slice(0, 5))
  }

  // 计算 derived data
  const servingOrders = orders.filter(o => o.status === 'serving')
  const arrivedOrders = orders.filter(o => o.status === 'arrived').sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
  const reservedTodayOrders = orders.filter(o => o.status === 'reserved' && o.scheduledDate === 'today').sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
  const stylistsList: ('Tony' | 'Amy' | 'Lily')[] = ['Tony', 'Amy', 'Lily']
  const ordersByStylist: Record<'Tony' | 'Amy' | 'Lily', Order[]> = (() => {
    const groups: Record<'Tony' | 'Amy' | 'Lily', Order[]> = { Tony: [], Amy: [], Lily: [] }
    ;[...arrivedOrders, ...reservedTodayOrders].forEach(o => {
      if (!groups[o.stylistName as 'Tony' | 'Amy' | 'Lily']) groups[o.stylistName as 'Tony' | 'Amy' | 'Lily'] = []
      groups[o.stylistName as 'Tony' | 'Amy' | 'Lily'].push(o)
    })
    return groups
  })()
  const reservedTomorrowOrders = orders.filter(o => o.status === 'reserved' && o.scheduledDate === 'tomorrow').sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
  const activeOrders = orders.filter(o => o.status === 'serving' || o.status === 'arrived' || o.status === 'reserved')
  const currentServing = servingOrders[0]

  // 用户位置
  const userNumber = bookingSuccess || ticketSuccess
  const totalInQueue = arrivedOrders.length + reservedTodayOrders.length
  const userPositionAhead = userNumber ? (ticketSuccess ? arrivedOrders.length : 0) : 0
  const userEtaMin = userPositionAhead > 0 ? userPositionAhead * 15 : 0

  // 主题色
  const t = {
    bgDeep: '#faf6f0',
    bgCard: '#fffaf0',
    primary: '#b8860b',
    primaryDark: '#8b6508',
    primaryGlow: 'rgba(184, 134, 11, 0.12)',
    text: '#2c1810',
    textSecondary: '#5d4037',
    textMuted: '#8d6e63',
    border: 'rgba(184, 134, 11, 0.22)',
    accent: '#8b0000',
    success: '##b8860b',
    successGlow: 'rgba(184, 134, 11, 0.15)',
    overlayBg: 'rgba(44, 24, 16, 0.6)',
    userGlow: 'linear-gradient(135deg, rgba(184, 134, 11, 0.95), rgba(139, 101, 8, 0.95))',
  }

  return (
    <section id="booking-section" style={{
      padding: '16px 12px 24px',
      background: t.bgDeep,
      borderTop: `1px solid ${t.border}`,
    }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* ⭐ 2026-09-20 17:30 奕霖拍板：首页删除"线上一键预约"区（queue 页面里有完整版）*/}

        {/* 您的号码高亮卡片 */}
        {userNumber && (
          <div style={{
            marginBottom: 16,
            padding: '18px 22px',
            background: t.userGlow,
            borderRadius: 14,
            color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            boxShadow: '0 6px 24px rgba(184, 134, 11, 0.3)',
            flexWrap: 'wrap', gap: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 28 }}>🎫</span>
              <div>
                <div style={{ fontSize: 11, opacity: 0.9, letterSpacing: '0.05em' }}>
                  {bookingSuccess ? '您的预约号' : '您的排队号'}
                </div>
                <div style={{
                  fontSize: 28, fontWeight: 900, fontFamily: 'monospace',
                  letterSpacing: '0.08em', lineHeight: 1.1,
                }}>
                  {userNumber}
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, opacity: 0.9 }}>
                前面还有 <b style={{ fontSize: 20, fontFamily: 'monospace' }}>{userPositionAhead}</b> 位
              </div>
              <div style={{ fontSize: 12, opacity: 0.9 }}>
                预计等待 <b style={{ fontSize: 16, fontFamily: 'monospace' }}>{userEtaMin}</b> 分钟
              </div>
            </div>
            <button
              onClick={() => { setBookingSuccess(''); setTicketSuccess('') }}
              style={{
                background: 'rgba(255,255,255,0.22)',
                border: 'none', borderRadius: 8,
                padding: '6px 12px',
                color: '#fff', fontSize: 12,
                cursor: 'pointer',
              }}
            >
              ✕ 关闭
            </button>
          </div>
        )}

        {/* ⭐ 2026-09-20 14:26 奕霖立：首次进店 PIN 提示卡 */}
        {showPinPrompt && !hasPin() && (
          <div style={{
            marginBottom: 16,
            padding: '14px 18px',
            background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
            border: '1px solid #f59e0b',
            borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#78350f', marginBottom: 4 }}>
                🔐 提示：是否设置 PIN 密码保护店长模式？
              </div>
              <div style={{ fontSize: 12, color: '#92400e' }}>
                店员手机也能扫码进页，只有输入正确 PIN 才能进店长模式
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                onClick={() => setPinModal('setup')}
                style={{
                  padding: '8px 16px',
                  background: '#92400e', color: '#fff', border: 'none',
                  borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}
              >设置 PIN</button>
              <button
                onClick={() => { dismissRemind(); setShowPinPrompt(false) }}
                style={{
                  padding: '8px 12px',
                  background: 'transparent', color: '#92400e',
                  border: '1px solid #92400e',
                  borderRadius: 8, fontSize: 12, cursor: 'pointer',
                }}
              >以后再说</button>
              <button
                onClick={() => { dismissRemind(); setShowPinPrompt(false) }}
                title="下次不再提醒此提示"
                style={{
                  padding: '8px 12px',
                  background: 'transparent', color: '#92400e',
                  border: 'none',
                  borderRadius: 8, fontSize: 11, cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >不再提醒</button>
            </div>
          </div>
        )}

        {/* ⭐ 店长控制台 */}
        <div style={{ marginBottom: 16 }}>
          {managerMode ? (
            <>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 10,
                flexWrap: 'wrap', gap: 8,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, flexWrap: 'wrap' }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: t.text, margin: 0 }}>
                    🎛️ 店长控制台
                  </h3>
                  {/* ⭐ 2026-09-21 13:44 清禾自主推进：付费墙 banner（方案 B 老板控制台顶部） */}
                  <button
                    onClick={() => setShowPricing(true)}
                    style={{
                      padding: '3px 10px',
                      background: currentPlan === 'smart' ? 'rgba(45, 125, 50, 0.12)' : t.primarySoft,
                      color: currentPlan === 'smart' ? '##b8860b' : t.primary,
                      border: `1px solid ${currentPlan === 'smart' ? '##b8860b' : t.primary}`,
                      borderRadius: 12,
                      fontSize: 11, fontWeight: 700,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {currentPlan === 'smart' ? '💎 智能版' : '💎 升级智能版'}
                  </button>
                  <div style={{
                    display: 'flex', background: t.bgDeep,
                    borderRadius: 6, padding: 2,
                    border: `1px solid ${t.border}`,
                  }}>
                    {([
                      { key: 'owner',       label: '👑 老板管',     hint: '基础版' },
                      { key: 'perStylist',  label: '👨‍🎨 自助管',   hint: '智能版' },
                      { key: 'ai',          label: '🤖 AI 管',     hint: '旗舰版' },
                    ] as { key: ManagerMode; label: string; hint: string }[]).map(tab => (
                      <button
                        key={tab.key}
                        onClick={() => setManagerTab(tab.key)}
                        style={{
                          padding: '5px 10px',
                          background: managerTab === tab.key ? t.primary : 'transparent',
                          color: managerTab === tab.key ? '#fff' : t.textMuted,
                          border: 'none', borderRadius: 4,
                          fontSize: 11, fontWeight: 600, cursor: 'pointer',
                        }}
                      >{tab.label}</button>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, color: t.textMuted }}>
                    {managerTab === 'owner' && `共 ${activeOrders.length} 单进行中`}
                    {managerTab === 'perStylist' && `${managedStylist} 的单`}
                    {managerTab === 'ai' && 'AI 自动管理'}
                  </span>
                  <button
                    onClick={() => setManagerMode(false)}
                    style={{
                      padding: '6px 14px',
                      background: t.accent,
                      color: '#fff', border: 'none', borderRadius: 8,
                      fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    ✕ 关闭店长模式
                  </button>
                </div>
                {hasPin() && (
                  <button
                    onClick={() => setPinModal('change')}
                    style={{
                      marginLeft: 8,
                      padding: '6px 12px',
                      background: 'transparent',
                      color: t.primary, border: `1px solid ${t.primary}`,
                      borderRadius: 8,
                      fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    🔑 修改 PIN
                  </button>
                )}
              </div>

              <div style={{
                background: t.bgCard,
                border: `2px solid ${t.primary}`,
                borderRadius: 12,
                padding: 14,
                boxShadow: '0 4px 16px rgba(184, 134, 11, 0.1)',
              }}>
              {managerTab === 'perStylist' && (
                <div style={{
                  display: 'flex', gap: 6, marginBottom: 12,
                  padding: 6,
                  background: t.bgDeep,
                  borderRadius: 8,
                  border: `1px solid ${t.border}`,
                }}>
                  {([
                    { name: 'Tony',  emoji: '👨‍🎨' },
                    { name: 'Amy',   emoji: '👩‍💼' },
                    { name: 'Lily',  emoji: '💁‍♀️' },
                  ] as { name: 'Tony' | 'Amy' | 'Lily'; emoji: string }[]).map(s => {
                    const cnt = activeOrders.filter(o => o.stylistName === s.name).length
                    const isSelected = managedStylist === s.name
                    return (
                      <button
                        key={s.name}
                        onClick={() => setManagedStylist(s.name)}
                        style={{
                          flex: 1, padding: '8px 4px',
                          background: isSelected ? t.primary : 'transparent',
                          color: isSelected ? '#fff' : t.text,
                          border: 'none', borderRadius: 6,
                          cursor: 'pointer',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                        }}
                      >
                        <span style={{ fontSize: 16 }}>{s.emoji}</span>
                        <span style={{ fontSize: 12, fontWeight: 700 }}>{s.name}</span>
                        <span style={{
                          fontSize: 10, fontWeight: 600,
                          opacity: isSelected ? 0.95 : 0.7,
                        }}>{cnt} 单</span>
                      </button>
                    )
                  })}
                </div>
              )}

              {managerTab === 'ai' && (
                <div style={{
                  padding: '40px 20px', textAlign: 'center',
                  background: t.bgDeep,
                  borderRadius: 10,
                  border: `1px dashed ${t.border}`,
                }}>
                  <div style={{ fontSize: 36, marginBottom: 12 }}>🤖</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 6 }}>
                    AI 自动管理 · 即将上线
                  </div>
                  <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 12 }}>
                    AI 将自动叫号、确认到店、推进进度
                  </div>
                  <div style={{
                    display: 'inline-block',
                    padding: '4px 12px',
                    background: 'rgba(184, 134, 11, 0.15)',
                    color: t.primary,
                    borderRadius: 12, fontSize: 11, fontWeight: 700,
                  }}>旗舰版 ¥299/月</div>
                </div>
              )}

              {managerTab !== 'ai' && (
                (() => {
                  const displayedOrders = managerTab === 'perStylist'
                    ? activeOrders.filter(o => o.stylistName === managedStylist)
                    : activeOrders
                  return displayedOrders.length === 0 ? (
                    <div style={{ padding: 20, textAlign: 'center', color: t.textMuted, fontSize: 13 }}>
                      😊 {managerTab === 'perStylist' ? `${managedStylist} 暂无进行中单` : '当前没有进行中的订单'}
                    </div>
                  ) : (
                    <div style={{
                      display: 'flex', flexDirection: 'column', gap: 8,
                      maxHeight: 400, overflowY: 'auto',
                      paddingRight: 6, marginRight: -6,
                    } as React.CSSProperties}>
                      {displayedOrders.map(o => {
                    const badge = statusLabel(o.status)
                    return (
                      <div key={o.id} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 12px',
                        background: t.bgDeep,
                        border: `1px solid ${t.border}`,
                        borderRadius: 10,
                        flexWrap: 'wrap',
                        flexShrink: 0,
                      }}>
                        <div style={{
                          minWidth: 50, textAlign: 'center',
                          padding: '4px 8px', background: t.primaryGlow,
                          borderRadius: 6, fontFamily: 'monospace',
                          fontSize: 12, fontWeight: 700, color: t.primary,
                        }}>
                          {o.scheduledAt}
                        </div>
                        <div style={{ flex: 1, minWidth: 180 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>
                            {o.customerName} <span style={{ color: t.textMuted, fontWeight: 400, fontSize: 12, marginLeft: 4 }}>{maskPhone(o.customerPhone)}</span>
                          </div>
                          <div style={{ fontSize: 11, color: t.textSecondary, marginTop: 2 }}>
                            {o.service} · {o.stylistName} 老师
                            {o.scheduledDate === 'tomorrow' && <span style={{ marginLeft: 6, color: t.primary, fontWeight: 600 }}>· 明天</span>}
                          </div>
                        </div>
                        <span style={{
                          padding: '3px 8px',
                          background: badge.bg, color: badge.color,
                          borderRadius: 8, fontSize: 10, fontWeight: 600,
                          whiteSpace: 'nowrap',
                        }}>
                          {badge.text}
                        </span>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {o.status === 'reserved' && (
                            <>
                              <button onClick={() => transition(o.id, 'arrived', `✅ ${o.customerName} 到店确认`)} style={{
                                padding: '6px 10px', background: t.success,
                                color: '#fff', border: 'none', borderRadius: 6,
                                fontSize: 11, fontWeight: 600, cursor: 'pointer',
                              }}>确认到店</button>
                              <button onClick={() => callCustomer(o.id)} style={{
                                padding: '6px 10px', background: t.primaryGlow,
                                color: t.primaryDark, border: `1px solid ${t.primary}`,
                                borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                              }}>叫号推送</button>
                            </>
                          )}
                          {o.status === 'arrived' && (
                            <>
                              <button onClick={() => transition(o.id, 'serving', `💇 ${o.customerName} 开始理发`)} style={{
                                padding: '6px 10px', background: t.primary,
                                color: '#fff', border: 'none', borderRadius: 6,
                                fontSize: 11, fontWeight: 600, cursor: 'pointer',
                              }}>开始理发</button>
                              <button onClick={() => callCustomer(o.id)} style={{
                                padding: '6px 10px', background: t.primaryGlow,
                                color: t.primaryDark, border: `1px solid ${t.primary}`,
                                borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                              }}>叫号推送</button>
                            </>
                          )}
                          {o.status === 'serving' && (
                            <>
                              <button onClick={() => transition(o.id, 'completed', `🎉 ${o.customerName} 完成服务`)} style={{
                                padding: '6px 10px', background: t.success,
                                color: '#fff', border: 'none', borderRadius: 6,
                                fontSize: 11, fontWeight: 600, cursor: 'pointer',
                              }}>完成 ✓</button>
                              <button onClick={() => callCustomer(o.id)} style={{
                                padding: '6px 10px', background: t.primaryGlow,
                                color: t.primaryDark, border: `1px solid ${t.primary}`,
                                borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                              }}>叫号推送</button>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()
          )}
              </div>
            </>
          ) : (
            <button
              onClick={() => {
                if (!hasPin()) {
                  setPinModal('setup')
                } else if (isInGracePeriod()) {
                  setManagerMode(true)
                  setLastAuthTime()
                } else {
                  setPinModal('unlock')
                }
              }}
              style={{
                padding: '10px 18px',
                background: t.primary,
                color: '#fff', border: 'none', borderRadius: 10,
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 8,
                boxShadow: '0 2px 8px rgba(184, 134, 11, 0.25)',
              }}
            >
              🎛️ 开启店长模式 <span style={{ fontSize: 11, opacity: 0.85, fontWeight: 500 }}>· {activeOrders.length} 单进行中</span>
            </button>
          )}
        </div>

        {/* 大面板：左序号（当前服务）+ 右活动流 + 右队列 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          background: t.bgCard,
          border: `1px solid ${t.border}`,
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: '0 4px 24px rgba(184, 134, 11, 0.08)',
          marginBottom: 20,
        }}>
          {/* 左：当前正在服务 */}
          <div style={{
            background: currentServing
              ? `linear-gradient(135deg, ${t.primary}, ${t.primaryDark})`
              : 'linear-gradient(135deg, #d4c5a0, #a89577)',
            color: '#fff',
            padding: '32px 20px',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 8,
          }}>
            {currentServing ? (
              <>
                <div style={{ fontSize: 11, opacity: 0.85, letterSpacing: '0.1em' }}>正在服务</div>
                <div style={{
                  fontSize: 52, fontWeight: 900, fontFamily: 'monospace',
                  letterSpacing: '0.05em', lineHeight: 1,
                }}>{currentServing.scheduledAt}</div>
                <div style={{ fontSize: 13, opacity: 0.95, fontWeight: 600 }}>
                  {currentServing.customerName} · {currentServing.stylistName}
                </div>
                <div style={{ fontSize: 12, opacity: 0.9 }}>
                  {currentServing.service}
                </div>
                <div style={{
                  marginTop: 4, padding: '4px 10px',
                  background: 'rgba(255,255,255,0.22)',
                  borderRadius: 12, fontSize: 11,
                }}>
                  开始于 {currentServing.startedAt}
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 11, opacity: 0.85, letterSpacing: '0.1em' }}>暂无服务</div>
                <div style={{ fontSize: 32, opacity: 0.7 }}>— —</div>
                <div style={{ fontSize: 13, opacity: 0.85 }}>店长可在控制台开始理发</div>
              </>
            )}
          </div>

          {/* 右：活动流 + 排队列表 */}
          <div style={{ padding: '20px 24px' }}>
            {/* 活动流 */}
            <div style={{
              padding: '12px 14px',
              background: t.primaryGlow,
              borderRadius: 10,
              marginBottom: 16,
            }}>
              <div style={{
                fontSize: 11, fontWeight: 700, color: t.primary,
                letterSpacing: '0.05em', marginBottom: 8,
              }}>🔥 刚刚发生的</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {activities.slice(0, 4).map((act, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: 10, alignItems: 'center',
                    fontSize: 12, color: t.text,
                  }}>
                    <span style={{
                      fontFamily: 'monospace', fontSize: 11,
                      color: t.textMuted, minWidth: 36,
                    }}>{act.time}</span>
                    <span style={{ flex: 1 }}>{act.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 排队列表 */}
            {/* ⭐ 2026-09-20 22:38 奕霖拍板：标题/按钮/数字都改小，尽量做一行 */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: 8,
              paddingBottom: 6,
              borderBottom: `1px solid ${t.border}`,
              gap: 8,
              flexWrap: 'nowrap',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: t.text, margin: 0, whiteSpace: 'nowrap' }}>
                  🚶 实时排队
                </h3>
                <div style={{
                  display: 'flex', background: t.bgDeep,
                  borderRadius: 5, padding: 1, marginLeft: 2,
                  border: `1px solid ${t.border}`,
                }}>
                  <button
                    onClick={() => setQueueView('flat')}
                    style={{
                      padding: '3px 8px',
                      background: queueView === 'flat' ? t.primary : 'transparent',
                      color: queueView === 'flat' ? '#fff' : t.textMuted,
                      border: 'none', borderRadius: 4,
                      fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    }}
                  >时间</button>
                  <button
                    onClick={() => setQueueView('byStylist')}
                    style={{
                      padding: '3px 8px',
                      background: queueView === 'byStylist' ? t.primary : 'transparent',
                      color: queueView === 'byStylist' ? '#fff' : t.textMuted,
                      border: 'none', borderRadius: 4,
                      fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    }}
                  >全部</button>
                </div>
              </div>
              <div style={{
                display: 'flex', alignItems: 'baseline', gap: 3, whiteSpace: 'nowrap',
              }}>
                <span style={{
                  fontSize: 18, fontWeight: 800, color: t.primary,
                  fontFamily: 'monospace', lineHeight: 1,
                }}>
                  {totalInQueue}
                </span>
                <span style={{ fontSize: 11, color: t.textSecondary }}>人在排队</span>
              </div>
            </div>

            {queueView === 'flat' ? (
              <div style={{
                maxHeight: 320,
                overflowY: 'auto',
                display: 'flex', flexDirection: 'column', gap: 8,
                paddingRight: 4,
                marginRight: -4,
              } as React.CSSProperties}>
                {[...arrivedOrders, ...reservedTodayOrders].length === 0 ? (
                  <div style={{ padding: 16, textAlign: 'center', color: t.textMuted, fontSize: 13 }}>
                    😊 当前无人排队
                  </div>
                ) : (
                  [...arrivedOrders, ...reservedTodayOrders].map((item, i) => {
                    const isArrived = item.status === 'arrived'
                    return (
                      <div key={item.id} style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '10px 12px',
                        background: t.bgDeep,
                        borderRadius: 10,
                        border: `1px solid ${isArrived ? t.successGlow : t.border}`,
                        opacity: isArrived ? 1 : 0.85,
                        flexShrink: 0,
                      }}>
                        <div style={{
                          minWidth: 50, textAlign: 'center',
                          padding: '5px 8px',
                          background: isArrived ? t.successGlow : t.primaryGlow,
                          borderRadius: 8,
                          fontFamily: 'monospace',
                          fontSize: 13, fontWeight: 700,
                          color: isArrived ? t.success : t.primary,
                        }}>
                          {item.scheduledAt}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 2 }}>
                            {item.customerName} <span style={{ color: t.textMuted, fontWeight: 400, fontSize: 12 }}>· {item.stylistName} 老师</span>
                          </div>
                          <div style={{ fontSize: 11, color: t.textSecondary }}>
                            {item.service} · {isArrived ? '已到店等待' : '已预约'}
                          </div>
                        </div>
                        <div style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center',
                          padding: '4px 8px',
                          background: isArrived ? t.success : t.primary,
                          color: '#fff',
                          borderRadius: 10,
                          minWidth: 56,
                        }}>
                          <span style={{
                            fontFamily: 'monospace',
                            fontSize: 16, fontWeight: 800, lineHeight: 1,
                          }}>
                            {i + 1}
                          </span>
                          <span style={{ fontSize: 9, fontWeight: 600, opacity: 0.95, marginTop: 2 }}>
                            {isArrived ? '排队位' : '预约'}
                          </span>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: 8,
                gridAutoRows: 'min-content',
              } as React.CSSProperties}>
                {stylistsList.map(stylistName => {
                  const stylistOrders = ordersByStylist[stylistName] || []
                  const emoji = stylistName === 'Tony' ? '👨‍🎨' : stylistName === 'Amy' ? '👩‍💼' : '💁‍♀️'
                  return (
                    <div key={stylistName} style={{
                      background: t.bgDeep,
                      borderRadius: 10,
                      padding: 10,
                      border: `1px solid ${t.border}`,
                    }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        marginBottom: 8,
                        paddingBottom: 6,
                        borderBottom: `1px solid ${t.border}`,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: 16 }}>{emoji}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{stylistName}</span>
                        </div>
                        <span style={{
                          fontSize: 11, fontWeight: 700,
                          padding: '2px 7px',
                          background: stylistOrders.length > 0 ? t.primary : t.textMuted,
                          color: '#fff',
                          borderRadius: 10,
                          fontFamily: 'monospace',
                        }}>{stylistOrders.length}单</span>
                      </div>
                      {stylistOrders.length === 0 ? (
                        <div style={{
                          padding: '20px 4px', textAlign: 'center',
                          color: t.textMuted, fontSize: 11,
                        }}>😊 空闲</div>
                      ) : (
                        <div style={{
                          display: 'flex', flexDirection: 'column', gap: 6,
                          maxHeight: 180,
                          overflowY: 'auto',
                          WebkitOverflowScrolling: 'touch',
                        }}>
                          {stylistOrders.map(o => {
                            const isArrived = o.status === 'arrived'
                            return (
                              <div key={o.id} style={{
                                padding: '6px 8px',
                                background: t.bgCard,
                                borderRadius: 6,
                                borderLeft: `3px solid ${isArrived ? t.success : t.primary}`,
                                fontSize: 11,
                              }}>
                                <div style={{
                                  fontFamily: 'monospace',
                                  fontWeight: 700,
                                  color: isArrived ? t.success : t.primary,
                                  marginBottom: 2,
                                }}>{o.scheduledAt}</div>
                                <div style={{
                                  fontWeight: 600, color: t.text,
                                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                }}>{o.customerName}</div>
                                <div style={{ color: t.textMuted, fontSize: 10 }}>
                                  {o.service} · {isArrived ? '已到' : '预约'}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* 按钮区 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 12, marginBottom: 16,
        }}>
          <ActionButton icon="📅" label="在线预约" onClick={() => setModal('booking')} t={t} />
          <ActionButton icon="🎫" label="现场取号" onClick={() => setModal('ticket')} t={t} />
          <ActionButton icon="📋" label="预约协议" onClick={() => setModal('agreement')} t={t} />
        </div>

        {/* 协议提示条 */}
        <div style={{
          padding: '12px 16px',
          background: t.bgCard,
          border: `1px solid ${t.border}`,
          borderRadius: 10,
          fontSize: 12, color: t.textSecondary,
          display: 'flex', alignItems: 'center', gap: 8,
          marginBottom: 12,
        }}>
          <span style={{ fontSize: 16 }}>🛡</span>
          <span>
            预约请提前 <b style={{ color: t.primary }}>5 分钟</b> 到店 · 晚到 <b style={{ color: t.accent }}>2 分钟</b> 系统自动取消 · 线上预约与线下排队互斥
          </span>
        </div>

        {/* 兜底 */}
        {!userNumber && bookingSuccess && (
          <div style={{
            padding: '14px 18px',
            background: 'rgba(184, 134, 11, 0.08)',
            border: '1px solid rgba(184, 134, 11, 0.3)',
            borderRadius: 10,
            fontSize: 14, color: t.success, fontWeight: 600,
            textAlign: 'center', marginBottom: 12,
          }}>
            ✅ 预约成功！预约号 <b style={{ fontSize: 18, fontFamily: 'monospace' }}>{bookingSuccess}</b>，请提前 5 分钟到店
          </div>
        )}
        {!userNumber && ticketSuccess && (
          <div style={{
            padding: '14px 18px',
            background: 'rgba(184, 134, 11, 0.08)',
            border: '1px solid rgba(184, 134, 11, 0.3)',
            borderRadius: 10,
            fontSize: 14, color: t.success, fontWeight: 600,
            textAlign: 'center', marginBottom: 12,
          }}>
            ✅ 取号成功！排队号 <b style={{ fontSize: 18, fontFamily: 'monospace' }}>{ticketSuccess}</b>
          </div>
        )}
      </div>

      {/* 弹窗 */}
      {modal === 'booking' && (
        <BookingModal t={t} onClose={() => setModal(null)}
          onSuccess={(no) => { setBookingSuccess(no); setModal(null) }} />
      )}
      {modal === 'ticket' && (
        <TicketModal t={t} onClose={() => setModal(null)}
          onSuccess={(no) => { setTicketSuccess(no); setModal(null) }} />
      )}
      {modal === 'agreement' && (
        <AgreementModal t={t} onClose={() => setModal(null)} />
      )}

      {/* PIN 弹窗 */}
      {pinModal === 'setup' && (
        <PinSetupModal t={t} onClose={() => setPinModal(null)} isFirstTime={!hasPin()}
          onSuccess={() => { setManagerMode(true); setShowPinPrompt(false); setLastAuthTime() }} />
      )}
      {pinModal === 'change' && (
        <PinSetupModal t={t} onClose={() => setPinModal(null)} isFirstTime={false} />
      )}
      {pinModal === 'unlock' && (
        <PinUnlockModal t={t} onClose={() => setPinModal(null)}
          onSuccess={() => { setManagerMode(true); setLastAuthTime() }} />
      )}

      {/* ⭐ 2026-09-21 13:44 清禾自主推进：付费墙弹窗 */}
      {showPricing && (
        <PricingModal
          currentPlan={currentPlan}
          onClose={() => setShowPricing(false)}
          onSelectPlan={async (planId) => {
            setCurrentPlan(planId)
            // v1.0.0 用 localStorage 持久化；v1.1.0 接后端 API
            try { localStorage.setItem('qinghe_booking_plan', planId) } catch {}
          }}
          t={t}
        />
      )}

      {/* 叫号推送 Toast */}
      {toast && (
        <div onClick={() => setToast('')} style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          padding: '12px 20px',
          background: 'linear-gradient(135deg, #b8860b, #8b6508)',
          color: '#fff', borderRadius: 10,
          boxShadow: '0 8px 32px rgba(184, 134, 11, 0.3)',
          fontSize: 14, fontWeight: 600,
          zIndex: 1100,
          cursor: 'pointer',
          maxWidth: '90vw', textAlign: 'center',
        }}>
          {toast}
          <div style={{ fontSize: 10, opacity: 0.85, marginTop: 4 }}>点击关闭</div>
        </div>
      )}
    </section>
  )
}