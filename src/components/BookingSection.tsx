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

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  hasPin, getRemindState, dismissRemind,
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
import { useUserStore } from '@/stores/userStore'
// v1.1.38 (2026-10-07 清禾) 会员卡：店长剪完头当场扣钱，不跳页面
import MemberQuickSheet from '@/components/member/MemberQuickSheet'
// v1.1.40 结算面板：完成服务 = 收款，一步做完
import SettlementSheet from '@/components/member/SettlementSheet'
import { DEFAULT_MERCHANT_ID } from '@/lib/merchant'
import PushSetup from '@/components/push/PushSetup'
import CallListener from '@/components/push/CallListener'
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

// ⭐ 2026-10-01 段 270：INITIAL_ORDERS 改动态生成（不再用静态数组）

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

// ⭐ 2026-10-04 23:13 奕霖立：已过去的时段自动标灰 + 不可选（5 min lead time buffer）
// - dateKey !== 'today' 直接 false（明天/后天没过去时间）
// - 5 min lead time：slot.start ≤ now + 5min 视为过期
//   与奕霖例子「10:55 时 11:00 不能预约」对齐（11:00 ≤ 10:55+5min=11:00 → grey）
// - 用 Asia/Shanghai 时区（与现有 timeStr/dateStr 一致）
function isSlotPassed(slot: string, dateKey: 'today' | 'tomorrow' | 'dayAfter', now: Date): boolean {
  if (dateKey !== 'today') return false
  const [h, m] = slot.split(':').map(Number)
  const slotMin = h * 60 + m
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now)
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0')
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0')
  return slotMin <= hour * 60 + minute + 5
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
// LoginRequiredPopup（未登录弹窗）
// ==============================================
function LoginRequiredPopup({ t, onClose, action }: { t: any; onClose: () => void; action: 'booking' | 'ticket' }) {
  const router = useRouter()
  const actionLabel = action === 'booking' ? '在线预约' : '现场取号'
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0,
      background: 'rgba(44, 24, 16, 0.65)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fffaf0', borderRadius: 16, padding: 28,
        maxWidth: 400, width: '100%', textAlign: 'center',
        border: '2px solid #b8860b',
        boxShadow: '0 16px 48px rgba(44, 24, 16, 0.45)',
      }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: '#2c1810', margin: '0 0 8px' }}>
          请先登录
        </h3>
        <p style={{ fontSize: 13, color: '#5d3a1f', margin: '0 0 18px', lineHeight: 1.6 }}>
          「{actionLabel}」需要先登录账号，才能记录您的预约/排队信息
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '10px',
            background: 'transparent', color: '#5d3a1f',
            border: '1px solid rgba(184, 134, 11, 0.3)', borderRadius: 8,
            fontSize: 13, cursor: 'pointer',
          }}>稍后</button>
          <button onClick={() => router.push(`/login?redirect=/merchant/queue`)} style={{
            flex: 2, padding: '10px',
            background: '#b8860b', color: '#fff',
            border: 'none', borderRadius: 8,
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}>立即登录</button>
        </div>
      </div>
    </div>
  )
}

// ==============================================
// AlreadyBookedPopup（二选一冲突弹窗）
// ==============================================
function AlreadyBookedPopup({ t, onClose, reason }: { t: any; onClose: () => void; reason: 'booking' | 'ticket' }) {
  const label = reason === 'booking' ? '预约' : '取号'
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0,
      background: 'rgba(44, 24, 16, 0.65)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fffaf0', borderRadius: 16, padding: 28,
        maxWidth: 400, width: '100%', textAlign: 'center',
        border: '2px solid #b8860b',
        boxShadow: '0 16px 48px rgba(44, 24, 16, 0.45)',
      }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: '#2c1810', margin: '0 0 8px' }}>
          您已有进行中的{label}
        </h3>
        <p style={{ fontSize: 13, color: '#5d3a1f', margin: '0 0 18px', lineHeight: 1.6 }}>
          每个账号同一时间只能预约或取号一单<br/>请先完成/取消当前{label}后再来
        </p>
        <button onClick={onClose} style={{
          width: '100%', padding: '12px',
          background: '#b8860b', color: '#fff',
          border: 'none', borderRadius: 10,
          fontSize: 14, fontWeight: 700, cursor: 'pointer',
        }}>知道了</button>
      </div>
    </div>
  )
}

// ==============================================
// BookingModal（在线预约）
// ==============================================
function BookingModal({ t, onClose, onSuccess, stylists, nextNo, reservedBookings, userName, userPhone, now }: {
  t: any; onClose: () => void
  onSuccess: (order: { id: string; customerName: string; customerPhone: string; service: string; stylistName: string; scheduledAt: string; scheduledDate: 'today' | 'tomorrow'; status: 'reserved' }) => void
  stylists: { id: string; name: string; specialties: string[]; yearsOfExp: number; rating: number; startPrice: number }[]
  nextNo: string
  reservedBookings: { stylistName: string; scheduledAt: string; scheduledDate: string; customerName: string }[]
  // ⭐ v1.1.4 改动 5: 默认用登录用户信息
  userName: string
  userPhone: string
  // ⭐ 2026-10-04 23:13 奕霖立：传入 now 让 modal 可判断"已过期"时段（1s 跟着父组件 re-render）
  now: Date
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

  const [name, setName] = useState(userName || '')
  const [phone, setPhone] = useState(userPhone || '')
  // ⭐ 2026-09-20 18:14 奕霖拍板：服务项目选择（剪发/染发/烫发/护理/造型）
  const [serviceType, setServiceType] = useState<ServiceType>('剪发')
  const [stylist, setStylist] = useState<string>(stylists[0]?.name || '')
  const [dateKey, setDateKey] = useState<'today' | 'tomorrow' | 'dayAfter'>('today')
  const [timeSlot, setTimeSlot] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [bookedHint, setBookedHint] = useState('')

  // ⭐ 18:14：服务改变时自动推荐 top1 理发师（推荐但不限）
  const recommendedStylist = recommendStylist(serviceType)[0]
  useEffect(() => {
    // ⭐ 2026-10-05 00:39 奕霖立：用户选了「随便哪位」时不覆盖
    setStylist(prev => prev === 'any' ? prev : recommendedStylist.name)
    setTimeSlot('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceType])

  const TIME_SLOTS: string[] = []
  for (let h = 10; h <= 21; h++) {
    TIME_SLOTS.push(`${h}:00`)
    TIME_SLOTS.push(`${h}:30`)
  }

  const [bookedByStylist, setBookedByStylist] = useState<Record<string, Record<string, string[]>>>({})
  // ⭐ 2026-10-05 00:39 奕霖立：「随便哪位」聚合模式 - 每个时段的总预约数
  const [totalBySlot, setTotalBySlot] = useState<Record<string, number>>({})
  // ⭐ v1.1.5 奕霖立：数字 badge + 最多 2 人/时段（之前是字符串 → 改成数组，count 控制状态）
  // ⭐ 2026-10-02 15:03 奕霖立修复：原代码引用了 BookingSection 的 dynamicStylists/orders，
  // 但 BookingModal 是独立函数组件，没这两个变量（webpack chunk 跨引用）→ 改用 props.stylists + 外部传入的 reservedBookings
  useEffect(() => {
    const m: Record<string, Record<string, string[]>> = {}
    const t: Record<string, number> = {}
    stylists.forEach(s => { m[s.name] = {} })
    reservedBookings.forEach(o => {
      if (o.scheduledDate === dateKey) {
        if (!m[o.stylistName]) m[o.stylistName] = {}
        if (!m[o.stylistName][o.scheduledAt]) m[o.stylistName][o.scheduledAt] = []
        m[o.stylistName][o.scheduledAt].push(o.customerName)
        // ⭐ 2026-10-05 00:39 聚合：每个时段累计所有理发师预约数（总和可超 2）
        t[o.scheduledAt] = (t[o.scheduledAt] || 0) + 1
      }
    })
    setBookedByStylist(m)
    setTotalBySlot(t)
  }, [dateKey, stylists, reservedBookings])

  async function submit() {
    setError('')
    if (!phone || phone.length < 11) { setError('请填写 11 位手机号'); return }
    if (!timeSlot) { setError('请选择时段'); return }
    // ⭐ 2026-10-04 23:13 奕霖立：提交前再校验"已过期"（防 race：选时未过 → 提交时已过）
    if (isSlotPassed(timeSlot, dateKey, now)) {
      setError(`该时段（${timeSlot}）已过期，请选其他时段`)
      setTimeSlot('')
      return
    }
    // ⭐ 2026-10-05 00:39 奕霖立：「随便哪位」模式 → 解析为首个空闲理发师
    let actualStylist = stylist
    if (stylist === 'any') {
      const available = stylists.find(s => {
        const c = bookedByStylist[s.name]?.[timeSlot]?.length || 0
        return c < 2
      })
      if (!available) {
        setError(`${timeSlot} 所有理发师已满，请选其他时段`)
        setTimeSlot('')
        return
      }
      actualStylist = available.name
    } else {
      // ⭐ v1.1.5: 提交前再次校验 quota（防 race condition）
      const finalBookedList = bookedByStylist[stylist]?.[timeSlot] || []
      if (finalBookedList.length >= 2) {
        setError(`${stylist} ${timeSlot} 已被 2 人预约满，请选其他时段`)
        setTimeSlot('')
        return
      }
    }
    if (!name) { setError('请填写称呼'); return }
    setSubmitting(true)
    try {
      await new Promise((r) => setTimeout(r, 800))
      const no = nextNo  // ⭐ 2026-10-02 00:11 顺序号（A001+）
      onSuccess({
        id: 'O' + Date.now().toString().slice(-6),
        no,
        customerName: name,
        customerPhone: phone,
        service: serviceType,
        stylistName: actualStylist,  // ⭐ 2026-10-05 00:39 奕霖立：用解析后的实际理发师
        scheduledAt: timeSlot,
        scheduledDate: dateKey === 'dayAfter' ? 'tomorrow' : dateKey,
        status: 'reserved',
      })
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

  // ⭐ 2026-10-01 23:32 奕霖立：理发师列表从 /api/stylists 拉，按专长度排序推荐
  // 服务 → 专长 code: 剪发=cut, 染发=dye, 烫发=perm, 护理=care, 造型=style
  const SERVICE_TO_SKILL: Record<ServiceType, string> = {
    '剪发': 'cut', '染发': 'dye', '烫发': 'perm', '护理': 'care', '造型': 'style',
  }
  const orderedStylists = [...stylists].sort((a, b) => {
    const skill = SERVICE_TO_SKILL[serviceType]
    return (b.specialties?.includes(skill) ? 1 : 0) - (a.specialties?.includes(skill) ? 1 : 0)
      || b.yearsOfExp - a.yearsOfExp
  })
  const stylistsForDisplay = [
    // ⭐ 2026-10-05 00:39 奕霖立：「随便哪位」= 聚合视图，看所有理发师预约总数
    // 总和可超 2，单理发师限 2；满判定 = total >= N×2
    { name: 'any', emoji: '🎲', years: 0, desc: '系统按空闲分配', isRecommended: false },
    ...orderedStylists.map((s, idx) => ({
      name: s.name,
      emoji: idx === 0 ? '⭐' : '💇',
      years: s.yearsOfExp,
      desc: `${s.yearsOfExp}年 · 起价 ¥${s.startPrice} · ⭐${s.rating.toFixed(1)}`,
      isRecommended: idx === 0,
    })),
  ]

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
            {stylistsForDisplay.map(s => (
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
              // ⭐ 2026-10-05 00:39 奕霖立：「随便哪位」= 聚合视图，看总和；其他模式仍按单理发师看
              const isAny = stylist === 'any'
              const stylistBookedMap = bookedByStylist[stylist] || {}
              const bookedList: string[] = isAny ? [] : (stylistBookedMap[slot] || [])
              // 聚合模式取总和（可超 2），具体模式取该理发师 count（限 2）
              const count = isAny ? (totalBySlot[slot] || 0) : bookedList.length
              const maxBookings = isAny ? Math.max(stylists.length, 1) * 2 : 2
              const booked = count >= maxBookings
              // ⭐ 2026-10-04 23:13 奕霖立：已过去的时段自动标灰（5 min lead time）
              const passed = isSlotPassed(slot, dateKey, now)
              const selected = timeSlot === slot
              // 优先级：passed > booked > selected > normal
              const disabled = passed || booked
              return (
                <button key={slot}
                  onClick={() => {
                    if (passed) {
                      setBookedHint(`${slot} 已过期，请选其他时段`)
                      setTimeout(() => setBookedHint(''), 3500)
                      return
                    }
                    if (booked) {
                      const msg = isAny
                        ? `${slot} 所有理发师已满（${count}/${maxBookings}），请选其他时段`
                        : `${stylist} ${slot} 已被 2 人预约满，请选其他时段`
                      setBookedHint(msg)
                      setTimeout(() => setBookedHint(''), 3500)
                      return
                    }
                    setTimeSlot(slot)
                  }}
                  style={{
                    padding: '10px 4px',
                    position: 'relative',
                    background: passed
                      ? '#f3f4f6'
                      : booked
                      ? '#f3f4f6'
                      : selected ? t.primary : t.bgDeep,
                    color: passed
                      ? '#9ca3af'
                      : booked
                      ? '#9ca3af'
                      : selected ? '#fff' : t.text,
                    border: `1px solid ${selected ? t.primary : disabled ? '#e5e7eb' : count >= 1 ? t.primary : t.border}`,
                    borderRadius: 8,
                    fontSize: 12, fontWeight: 600,
                    fontFamily: 'monospace',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    opacity: disabled ? 0.65 : 1,
                    // ⭐ passed 不加删除线（区别于"已约满"），booked 加删除线
                    textDecoration: booked ? 'line-through' : 'none',
                  }}
                  title={
                    passed
                      ? `${slot} 已过期，无法预约`
                      : booked
                        ? (isAny ? `${slot} 所有理发师已满（${count}/${maxBookings}）` : '已被 2 人预约满')
                        : count === 0
                          ? '可预约'
                          : (isAny
                              ? `${slot} 共 ${count} 人预约（最多 ${maxBookings}）`
                              : `已被 ${bookedList[0]} 预约（还能约 1 人）`)
                  }
                >
                  <div>{slot}</div>
                  {passed ? (
                    <span style={{
                      position: 'absolute',
                      top: 1, right: 3,
                      fontSize: 10,
                      lineHeight: 1,
                      opacity: 0.85,
                    }}>⏰</span>
                  ) : count > 0 && (
                    <span style={{
                      position: 'absolute',
                      top: 2, right: 4,
                      // ⭐ 2026-10-04 23:43 奕霖立：count=1 和 count=2 都用红
                      // ⭐ 2026-10-05 00:39 奕霖立：聚合模式总数也可超 2（badge 直接显示 N）
                      background: '#ef4444',
                      color: '#fff',
                      fontSize: 9,
                      fontWeight: 700,
                      padding: '1px 4px',
                      borderRadius: 6,
                      fontFamily: 'sans-serif',
                      lineHeight: 1.1,
                    }}>
                      {booked ? '满' : count}
                    </span>
                  )}
                  {!passed && !isAny && count === 1 && bookedList[0] && (
                    <div style={{ fontSize: 8, fontWeight: 400, marginTop: 1, fontFamily: 'inherit', opacity: 0.7 }}>
                      {bookedList[0].slice(0, 2)}
                    </div>
                  )}
                  {/* ⭐ 2026-10-05 00:39 奕霖立：聚合模式副标「N/总数」直观看高峰 */}
                  {!passed && isAny && count > 0 && (
                    <div style={{ fontSize: 8, fontWeight: 400, marginTop: 1, fontFamily: 'inherit', opacity: 0.7 }}>
                      {`${count}/${maxBookings}`}
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
function TicketModal({ t, onClose, onSuccess, stylists, nextNo, userName, userPhone }: {
  t: any; onClose: () => void
  onSuccess: (order: { id: string; customerName: string; customerPhone: string; service: string; stylistName: string; scheduledAt: string; scheduledDate: 'today'; status: 'arrived' }) => void
  stylists: { id: string; name: string; specialties: string[]; yearsOfExp: number; rating: number; startPrice: number }[]
  nextNo: string
  // ⭐ v1.1.4 改动 5: 默认用登录用户信息
  userName: string
  userPhone: string
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

  const [name, setName] = useState(userName || '')
  const [phone, setPhone] = useState(userPhone || '')
  // ⭐ 2026-09-20 18:21 奕霖拍板：现场取号加服务 + 理发师可选
  const [serviceType, setServiceType] = useState<ServiceType>('剪发')
  const [stylistPref, setStylistPref] = useState<string>('any')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // ⭐ 18:21：根据服务推荐理发师（仅做提示，客人仍可选"随便哪位"）
  const recommendedStylist = recommendStylist(serviceType)[0]

  async function submit() {
    setError('')
    if (!phone || phone.length < 11) { setError('请填写 11 位手机号'); return }
    if (!name) { setError('请填写称呼'); return }
    // ⭐ 2026-10-05 01:06 奕霖立：营业时间限制 10:00 - 22:00（未到营业不能现场取号）
    const checkNow = new Date()
    const cnParts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Shanghai',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(checkNow)
    const curHour = parseInt(cnParts.find(p => p.type === 'hour')?.value || '0')
    const curMinute = parseInt(cnParts.find(p => p.type === 'minute')?.value || '0')
    const curMinOfDay = curHour * 60 + curMinute
    if (curMinOfDay < 10 * 60 || curMinOfDay >= 22 * 60) {
      setError('营业时间为 10:00-22:00，当前不在营业时间内，请改用「在线预约」')
      return
    }
    setSubmitting(true)
    try {
      await new Promise((r) => setTimeout(r, 800))
      const no = nextNo  // ⭐ 2026-10-02 00:11 顺序号（B001+）
      const now = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Shanghai' })
      onSuccess({
        id: 'O' + Date.now().toString().slice(-6),
        no,
        customerName: name,
        customerPhone: phone,
        service: serviceType,
        stylistName: stylistPref === 'any' ? (stylists[0]?.name || 'Will be assigned') : stylistPref,
        scheduledAt: now,
        scheduledDate: 'today',
        status: 'arrived',
      })
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
              { key: 'any', emoji: '🎲', label: '随便哪位', desc: '系统按空闭分配' },
              ...stylists.map(s => ({
                key: s.name, emoji: '💇', label: s.name,
                desc: `${recommendedStylist.name === s.name ? '⭐ 推荐 ' : ''}${s.yearsOfExp}年`,
              })),
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
export default function BookingSection({ merchantId = DEFAULT_MERCHANT_ID }: { merchantId?: string }) {
  // ⭐ 19:17 段 256：route（修 router.push undefined bug）
  // ⭐ 2026-10-01 21:04 奕霖立：动态同步 /stylist 列表
  const [dynamicStylists, setDynamicStylists] = useState<{ id: string; name: string; specialties: string[]; yearsOfExp: number; rating: number; startPrice: number; code?: string }[]>([])
  // ⭐ 2026-10-02 00:11 奕霖立：登录才能预约/排队（userStore）
  const isLoggedIn = useUserStore(s => s.isLoggedIn)
  const currentUserPhone = useUserStore(s => s.user?.phone)
  // ⭐ v1.1.4 改动 5: 默认用登录用户的名字+手机号填进 BookingModal/TicketModal
  const currentUserName = useUserStore(s => s.user?.nickname)
  useEffect(() => {
    fetch(`/api/stylists?merchantId=${merchantId}`)
      .then(r => r.json())
      .then(d => { if (d.success) setDynamicStylists(d.stylists || []) })
      .catch(() => {})
  }, [merchantId])
  const router = useRouter()
  // ⭐ 2026-10-01 19:39 奕霖立：店长模式需先登录
  // 中国时间同步
  const [now, setNow] = useState(() => new Date())

  // 订单状态
  const [orders, setOrders] = useState<Order[]>([])
  // ⭐ 2026-10-02 12:50 奕霖拍板根治：orders 从 /api/queues 拉 + 5 秒轮询（多浏览器共享）
  // ⭐ v1.1.20 (2026-10-05 12:01 奕霖立)：加 /api/queues/activities 并行拉取 → 活动流实时同步
  const loadQueues = useCallback(async () => {
    try {
      const [qRes, aRes] = await Promise.all([
        fetch(`/api/queues?merchantId=${merchantId}`, { cache: 'no-store' }),
        fetch(`/api/queues/activities?merchantId=${merchantId}`, { cache: 'no-store' }),
      ])
      const d = await qRes.json()
      if (d.success && Array.isArray(d.queues)) {
        setOrders(d.queues.map((q: any) => ({
          id: q.id,
          customerName: q.customerName,
          customerPhone: q.customerPhone,
          service: q.service,
          stylistName: q.stylistName,
          status: q.status,
          scheduledAt: q.scheduledAt,
          scheduledDate: q.scheduledDate,
          arrivedAt: q.arrivedAt,
          startedAt: q.startedAt,
          completedAt: q.completedAt,
          note: q.note,
          no: q.orderNo,  // ⭐ 把 orderNo 映射成 no
        })))
      }
      // ⭐ v1.1.20 (2026-10-05 12:01 奕霖立)：从 /api/queues/activities 拉真实事件
      //   取代之前硬编码 14:28/14:30/14:32 demo
      //   保跳客户端乐观插入（避免等待下次轮询）
      try {
        const ad = await aRes.json()
        if (ad.success && Array.isArray(ad.activities)) {
          setActivities(ad.activities.slice(0, 4).map((a: any) => ({
            time: a.time,
            text: a.text,
          })))
        }
      } catch {}
    } catch (e) {
      // 容错：API 失败时不刷掉本地状态
      console.warn('[队列] loadQueues 失败:', e)
    }
  }, [merchantId])
  useEffect(() => {
    loadQueues()
    const id = setInterval(loadQueues, 5000)  // 5 秒轮询
    return () => clearInterval(id)
  }, [loadQueues])
  // ⭐ 2026-10-02 00:11 奕霖立：判断当前用户是否已有进行中的单（二选一逻辑）
  // ⭐ 2026-10-06 11:27 清禾修 Bug 1：cancelled 状态排除（之前只排除 completed，cancelled 被当成 active 展示）
  const myActiveOrder = currentUserPhone
    ? orders.find(o => o.customerPhone === currentUserPhone && 
      (o.status === 'reserved' || o.status === 'arrived' || o.status === 'serving'))
    : undefined
  const hasActiveBooking = !!myActiveOrder && myActiveOrder.status === 'reserved'
  const hasActiveTicket = !!myActiveOrder && myActiveOrder.status === 'arrived'
  const hasActiveServing = !!myActiveOrder && myActiveOrder.status === 'serving'

  // ⭐ 2026-10-02 00:11 奕霖立：顺序号生成器（A 预约 / B 取号 + 3 位顺序号）
  // v1.1.31 (2026-10-06 18:57 qinghe fix Bug 3 client side): orderNo = max historical sequence + 1
  //   OLD: (in-progress count + 1). An idle shop has 0 in progress, so it always recalculates
  //     B001/A001, colliding with an already used number -> server 409 -> row never persisted.
  //   NEW: scan ALL records (including completed / cancelled), take max A/B sequence + 1.
  const maxSeqOf = (prefix: string) => {
    let max = 0
    for (const o of orders as any[]) {
      const no = String((o as any).no || '')
      if (!no || no.charAt(0).toUpperCase() !== prefix) continue
      const digits = no.replace(/[^0-9]/g, '')
      if (digits) max = Math.max(max, parseInt(digits, 10))
    }
    return max
  }
  const nextBookingNo = 'A' + String(maxSeqOf('A') + 1).padStart(3, '0')
  const nextTicketNo = 'B' + String(maxSeqOf('B') + 1).padStart(3, '0')

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

  // ⭐ 2026-10-01 19:39 奕霖拍板：去掉 30 分钟自动锁定
  // 改 PIN 后永久有效，没有自动锁定概念

  // 活动流
  // ⭐ v1.1.20 (2026-10-05 12:01 奕霖立)：删硬编码 demo 数据
  //   改由 loadQueues() 轮询 /api/queues/activities 拉真实事件（DB-持久化 + 跨设备同步）
  //   客户端 mutation (transition/callCustomer) 保留乐观更新（响应感）
  const [activities, setActivities] = useState<{ time: string; text: string }[]>([])

  // 叫号推送 Toast
  const [toast, setToast] = useState('')

  // 弹窗
  const [modal, setModal] = useState<null | 'booking' | 'ticket' | 'agreement'>(null)
  // v1.1.38 会员弹层：记是哪一单，不记就不知道扣给谁
  // v1.1.40 结算：点「完成 ✓」不再直接改状态，先走收款
  const [settleFor, setSettleFor] = useState<null | {
    id: string; no?: string; customerName: string; customerPhone: string
    service?: string; stylistName?: string
  }>(null)
  const [memberFor, setMemberFor] = useState<null | {
    phone: string; customerName: string; service?: string; orderNo?: string
  }>(null)
  const [bookingSuccess, setBookingSuccess] = useState('')
  const [ticketSuccess, setTicketSuccess] = useState('')
  // ⭐ v1.1 (2026-10-04 18:48 奕霖"全做吧"双确认) · 改动 2:
  //   - bookingSuccess / ticketSuccess 持久化到 localStorage，刷新后恢复
  //   - 启动时读取，避免"重新进入页面预约信息消失"
  //   - 用 useState 懒初始化 + useEffect 同步写
  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = localStorage.getItem('qinghe-booking-success')
    if (stored) setBookingSuccess(stored)
    const storedT = localStorage.getItem('qinghe-ticket-success')
    if (storedT) setTicketSuccess(storedT)
  }, [])
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (bookingSuccess) localStorage.setItem('qinghe-booking-success', bookingSuccess)
  }, [bookingSuccess])
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (ticketSuccess) localStorage.setItem('qinghe-ticket-success', ticketSuccess)
  }, [ticketSuccess])
  // ⭐ 2026-10-06 11:27 清禾修 Bug 1（补）：清除过期 bookingSuccess/ticketSuccess
  //   localStorage 持久化的号源在 cancelled/completed 后不清除会一直当 active 显示
  //   触发时机：orders 列表每次更新（5 秒轮询）
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!bookingSuccess && !ticketSuccess) return
    if (orders.length === 0) return  // 首次 loadQueues 完成前别误清
    if (bookingSuccess) {
      const active = orders.find(o => o.no === bookingSuccess &&
        (o.status === 'reserved' || o.status === 'arrived' || o.status === 'serving'))
      if (!active) {
        setBookingSuccess('')
        localStorage.removeItem('qinghe-booking-success')
      }
    }
    if (ticketSuccess) {
      const active = orders.find(o => o.no === ticketSuccess &&
        (o.status === 'reserved' || o.status === 'arrived' || o.status === 'serving'))
      if (!active) {
        setTicketSuccess('')
        localStorage.removeItem('qinghe-ticket-success')
      }
    }
  }, [orders, bookingSuccess, ticketSuccess])
  // ⭐ 2026-10-01 23:53 奕霖立：成功后弹窗
  const [successPopup, setSuccessPopup] = useState<null | { type: 'booking' | 'ticket'; order: any; countdown?: number }>(null)
  // ⭐ v1.1.23 (2026-10-05 13:06 奕霖立)：成功弹窗 5 秒倒计时自动关闭
  useEffect(() => {
    if (!successPopup) return
    setSuccessPopup(prev => prev ? { ...prev, countdown: 5 } : null)
    const id = setInterval(() => {
      setSuccessPopup(prev => {
        if (!prev) return null
        if (prev.countdown === undefined || prev.countdown <= 1) {
          clearInterval(id)
          return null
        }
        return { ...prev, countdown: prev.countdown - 1 }
      })
    }, 1000)
    return () => clearInterval(id)
  }, [successPopup !== null])
  // ⭐ v1.1.23 取消确认弹窗状态（替抂 browser confirm()）
  const [cancelPopup, setCancelPopup] = useState<null | { order: any; label: string }>(null)
  // ⭐ 2026-10-06 12:50 清禾改：v1.1.30 - 「明日全部预约」弹窗状态
  const [showTomorrowListModal, setShowTomorrowListModal] = useState(false)

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
  const [managedStylist, setManagedStylist] = useState<string>(dynamicStylists[0]?.name || '')

  // 状态切换 helper（根治：同步 PATCH 到 API + 本地乐观更新）
  function transition(id: string, newStatus: OrderStatus, activityText: string) {
    const nowTime = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Shanghai' })
    setOrders(prev => prev.map(o => {
      if (o.id !== id) return o
      const updated = { ...o, status: newStatus }
      if (newStatus === 'arrived') updated.arrivedAt = nowTime
      if (newStatus === 'serving') updated.startedAt = nowTime
      if (newStatus === 'completed') updated.completedAt = nowTime
      return updated
    }))
    setActivities(prev => [{ time: nowTime, text: activityText }, ...prev].slice(0, 5))
    // 同步到 API（根治：多浏览器共享）
    fetch(`/api/queues/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: newStatus,
        ...(newStatus === 'arrived' ? { arrivedAt: nowTime } : {}),
        ...(newStatus === 'serving' ? { startedAt: nowTime } : {}),
        ...(newStatus === 'completed' ? { completedAt: nowTime } : {}),
      }),
    }).catch(() => {})
  }

  // v1.1.32 (2026-10-06 19:20 qinghe fix Bug 4): shared shop-side cancel for booking / ticket / serving.
  //   Removed the hardcoded fallback PIN: with a wrong PIN the old code still ran the local
  //   confirm first, so a genuine server rejection looked like a silent no-op.
  // v1.1.35 (2026-10-06 20:34 qinghe fix Bug 8): 店长取消改成自建弹窗 + PIN 输入 + 真实反馈
  //   OLD: shopCancel 里用了 browser confirm()。该环境的 webview/PWA 会吞掉 confirm()，
  //     点下去直接 return（用户反馈「没有弹窗」）。而且 qinghe-shop-pin 全项目没有写入点，
  //     PIN 提示卡又是 {false && ...} 硬停用，所以这个 key 永远 null → 100% 拒绝。
  //     （此前删掉 || '8888' 兜底是对的，但没补写入入口，等于把店长取消打成必失败。）
  //   NEW: 不再用 confirm()。弹窗内直接输 PIN → 提交 → 按服务端返回的真实结果显示成败。
  const [shopCancelPopup, setShopCancelPopup] = useState<null | {
    order: Order; label: string; pin: string; error: string; busy: boolean
  }>(null)
  // v1.1.36: manager PIN is cached in memory for one session only, never written to storage.
  //   lib/manager-auth.ts stores the shop PIN as SHA-256 hash + random salt precisely to avoid
  //   plaintext; writing the plaintext to a localStorage key was a security regression. Removed.
  const [shopPinCache, setShopPinCache] = useState('')

  function shopCancel(o: Order, label: string) {
    const stored = shopPinCache
    setShopCancelPopup({ order: o, label, pin: stored, error: '', busy: false })
  }

  async function confirmShopCancel() {
    const p = shopCancelPopup
    if (!p || p.busy) return
    const pin = p.pin.trim()
    if (!pin) {
      setShopCancelPopup({ ...p, error: '请输入店长 PIN', busy: false })
      return
    }
    setShopCancelPopup({ ...p, busy: true, error: '' })
    try {
      const res = await fetch(`/api/queues/${p.order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'cancelled',
          cancelledBy: 'shop',
          shopPin: pin,
          cancelReason: '店长手动取消',
        }),
      })
      const d = await res.json()
      if (d.success) {
        // 记住本次输入的 PIN，下次直接带入（补上缺失的写入入口）
        setShopPinCache(pin)
        setShopCancelPopup(null)
        setToast(`✅ 已取消 ${p.order.customerName} 的${p.label}`)
        setTimeout(() => setToast(''), 2500)
        loadQueues()
      } else {
        setShopCancelPopup({ ...p, busy: false, error: d.error || '未知错误' })
      }
    } catch {
      setShopCancelPopup({ ...p, busy: false, error: '网络错误，请重试' })
    }
  }
  // v1.1.34 (2026-10-06 20:24 qinghe): 叫号推送 = 居中大弹窗 + 提示音 + 震动
  //   OLD: 底部 toast，3.5 秒自动消失，店长容易错过；无任何声音/触感。
  //   NEW: 居中弹窗需手动关闭；Web Audio 现场合成提示音（不依赖音频文件）；vibrate 震动。
  //   震动说明：Android Chrome 支持 navigator.vibrate；iOS Safari 不提供该 API，会静默跳过。
  const [callPopup, setCallPopup] = useState<null | {
    name: string; phone: string; no: string; service: string; stylist: string; time: string
  }>(null)

  const playCallChime = () => {
    try {
      const Ctx: any = (window as any).AudioContext || (window as any).webkitAudioContext
      if (!Ctx) return
      const ctx = new Ctx()
      if (ctx.state === 'suspended') ctx.resume()
      const now = ctx.currentTime
      const notes: Array<[number, number, number]> = [[988, 0, 0.16], [784, 0.2, 0.26]]
      notes.forEach(([freq, at, dur]) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.value = freq
        gain.gain.setValueAtTime(0.0001, now + at)
        gain.gain.exponentialRampToValueAtTime(0.4, now + at + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + at + dur)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now + at)
        osc.stop(now + at + dur + 0.03)
      })
      setTimeout(() => { try { ctx.close() } catch {} }, 1000)
    } catch (e: any) {
      console.warn('[叫号] 提示音播放失败:', e)
    }
  }

  // 2026-10-07 清禾: SSE 收到叫号 -> 弹窗 + 提示音 + 震动
  const handleSseCall = useCallback((a: { title: string; body: string; at: number }) => {
    const parts = String(a.body || '').split('\u00b7').map((s) => s.trim())
    const t = new Date().toLocaleTimeString('zh-CN', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Shanghai',
    })
    const noPart = parts.find((p) => p.indexOf('\u5355\u53f7') === 0) || ''
    const stylistPart = parts.find((p) => p.indexOf('\u8001\u5e08') > 0) || ''
    setCallPopup({
      name: parts[0] || '\u60a8\u7684\u53f7\u7801',
      phone: currentUserPhone || '',
      no: noPart.replace('\u5355\u53f7', '').trim(),
      service: parts[1] || '',
      stylist: stylistPart.replace('\u8001\u5e08', '').trim(),
      time: t,
    })
    playCallChime()
    try { (navigator as any)?.vibrate?.([300, 120, 300, 120, 600]) } catch {}
    setActivities((prev) => [
      { time: t, text: '\ud83d\udce2 \u53eb\u53f7\u63a8\u9001 \u00b7 ' + (parts[0] || '') },
      ...prev,
    ].slice(0, 5))
  }, [currentUserPhone])

  function callCustomer(id: string) {
    // 2026-10-07 清禾：叫号同时触发服务端推送（真到手机通知）
    // 保留本机弹窗/提示音/震动作为即时反馈
    fetch('/api/queues/' + id + '/call', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      .catch(function (e) { console.warn('[call] push request failed:', e) })
    const o = orders.find(x => x.id === id)
    if (!o) return
    const t = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Shanghai' })
    setCallPopup({
      name: o.customerName,
      phone: o.customerPhone,
      no: o.no || '',
      service: o.service,
      stylist: o.stylistName,
      time: t,
    })
    playCallChime()
    // 震动：Android 支持；iOS Safari 无此 API，静默降级
    try { (navigator as any)?.vibrate?.([300, 120, 300, 120, 600]) } catch {}
    setActivities(prev => [{ time: t, text: `📢 叫号推送 · ${o.customerName}` }, ...prev].slice(0, 5))
  }

  // 计算 derived data
  const servingOrders = orders.filter(o => o.status === 'serving')
  const arrivedOrders = orders.filter(o => o.status === 'arrived').sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
  const reservedTodayOrders = orders.filter(o => o.status === 'reserved' && o.scheduledDate === 'today').sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
  // ⭐ 2026-10-01 23:38 奕霖立：实时排队按动态 stylist 列表分组（与 /stylist 同步）
  const stylistsList: string[] = dynamicStylists.map(s => s.name)
  // ⭐ 2026-10-02 12:30 奕霖立：useMemo 防抖动（实时排队稳定）
  const ordersByStylist = useMemo(() => {
    const groups: Record<string, Order[]> = {}
    stylistsList.forEach(name => { groups[name] = [] })
    ;[...arrivedOrders, ...reservedTodayOrders].forEach(o => {
      if (!groups[o.stylistName]) groups[o.stylistName] = []
      groups[o.stylistName].push(o)
    })
    return groups
  }, [arrivedOrders, reservedTodayOrders, stylistsList])
  const reservedTomorrowOrders = orders.filter(o => o.status === 'reserved' && o.scheduledDate === 'tomorrow').sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
  const activeOrders = orders.filter(o => o.status === 'serving' || o.status === 'arrived' || o.status === 'reserved')
  const currentServing = servingOrders[0]
  // ⭐ v1.1.24.1 (2026-10-05 16:00 奕霖立)：实时北京时间（wall clock）
  //   v1.1.24 误以为"实时的时间"=服务时长，奕霖修正：要当前北京时间
  //   依赖现有 `now` state（line ~1003 每秒刷新） + timeZone:'Asia/Shanghai'
  const currentBeijingTime = now.toLocaleTimeString('zh-CN', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false, timeZone: 'Asia/Shanghai',
  })
  // ⭐ 2026-10-05 00:56 奕霖立：实时队列信息（下一位预约、预计等待）
  const nextTodayReservation = reservedTodayOrders[0]
  const nextTomorrowReservation = reservedTomorrowOrders[0]
  // ⭐ v1.1.20 (2026-10-05 12:25 奕霖立)：修公式漏 servingOrders 的 bug
  // 预计等待：新客走到店需等 服务中 + 已到店 + 今日预约 全中 × 15 分钟/人
  // v1.1.38 (2026-10-06 21:13 qinghe fix): ETA must divide by the number of chairs, not 1.
  //   OLD: (serving + arrived + reservedToday) * 15 assumed a single barber.
  //     With Tony/Amy/Lily on shift, 4 people in line reported 60 min.
  //   NEW: N stylists work in parallel, so N people clear per 15-min slot.
  const chairs = Math.max(1, dynamicStylists.length)
  const etaForAhead = (ahead: number) => Math.ceil(ahead / chairs) * 15
  const globalEtaMin = etaForAhead(servingOrders.length + arrivedOrders.length + reservedTodayOrders.length)

  // 用户位置
  // ⭐ v1.1 (2026-10-04 18:48 奕霖"全做吧"双确认) · 改动 2:
  //   - userNumber 派生逻辑：优先 bookingSuccess/ticketSuccess（刚预约/取号），fallback 到 myActiveOrder.no（刷新后从 db 恢复）
  //   - 修"重新进入页面预约信息消失" bug：refresh 后 localStorage 有就恢复；db 有就从 myActiveOrder 恢复
  const userNumber = bookingSuccess || ticketSuccess || myActiveOrder?.no || ''
  const userOrderType: 'booking' | 'ticket' | '' = bookingSuccess
    ? 'booking'
    : ticketSuccess
    ? 'ticket'
    : myActiveOrder?.status === 'arrived' || myActiveOrder?.status === 'serving'
    ? 'ticket'
    : myActiveOrder
    ? 'booking'
    : ''
  const totalInQueue = arrivedOrders.length + reservedTodayOrders.length
  const userPositionAhead = userNumber ? (userOrderType === 'ticket' ? arrivedOrders.length : 0) : 0
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
            {myActiveOrder?.status === 'serving' ? (
              /* v1.1.34: 店长点「开始理发」后，顶部卡片按钮同步变成「服务中」 */
              <div style={{
                background: 'rgba(255,255,255,0.28)',
                border: '1px solid rgba(255,255,255,0.5)',
                borderRadius: 8, padding: '6px 12px',
                color: '#fff', fontSize: 12, fontWeight: 700,
                display: 'flex', alignItems: 'center', gap: 5,
                whiteSpace: 'nowrap',
              }}>
                💈 服务中
              </div>
            ) : (
              <button
                onClick={async () => {
                  const label = userOrderType === 'booking' ? '预约' : '排队'
                  // 没找到 myActiveOrder（stale localStorage） · 只清本地
                  if (!myActiveOrder) {
                    setBookingSuccess(''); setTicketSuccess('')
                    return
                  }
                  setCancelPopup({ order: myActiveOrder, label })
                }}
                style={{
                  background: 'rgba(255,255,255,0.22)',
                  border: 'none', borderRadius: 8,
                  padding: '6px 12px',
                  color: '#fff', fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                ✕ 取消{userOrderType === 'booking' ? '预约' : '排队'}
              </button>
            )}
          </div>
        )}

        {/* ⭐ 2026-10-02 15:28 奕霖立：PIN 提示卡整片已停（直接隐藏，不删除代码方便回滚） */}
        {false && showPinPrompt && !hasPin() && (
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
                onClick={() => {
                  setPinModal('setup')
                }}
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
                    onClick={() => {
                      setPinModal('change')
                    }}
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
                  {dynamicStylists.map(s => {
                    const emoji = s.specialties?.includes('dye') ? '🎨' : s.specialties?.includes('care') ? '🧴' : '💇'
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
                              {/* v1.1.32: 店长统一取消（走 shopCancel，去掉假 PIN 兜底） */}
                              <button onClick={() => shopCancel(o, '预约')} style={{
                                padding: '6px 10px', background: t.accent,
                                color: '#fff', border: 'none', borderRadius: 6,
                                fontSize: 11, fontWeight: 600, cursor: 'pointer',
                              }}>✕ 取消</button>
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
                              <button onClick={() => shopCancel(o, '排队')} style={{
                                padding: '6px 10px', background: t.accent,
                                color: '#fff', border: 'none', borderRadius: 6,
                                fontSize: 11, fontWeight: 600, cursor: 'pointer',
                              }}>✕ 取消</button>
                            </>
                          )}
                          {o.status === 'serving' && (
                            <>
                              {/* v1.1.40 完成 = 结算，不再直接改状态（钱和状态绑一起才不漏） */}
                              <button onClick={() => setSettleFor({
                                id: o.id,
                                no: (o as any).no,
                                customerName: o.customerName,
                                customerPhone: o.customerPhone,
                                service: o.service,
                                stylistName: o.stylistName,
                              })} style={{
                                padding: '6px 10px', background: t.success,
                                color: '#fff', border: 'none', borderRadius: 6,
                                fontSize: 11, fontWeight: 600, cursor: 'pointer',
                              }}>完成 ✓</button>
                              <button onClick={() => callCustomer(o.id)} style={{
                                padding: '6px 10px', background: t.primaryGlow,
                                color: t.primaryDark, border: `1px solid ${t.primary}`,
                                borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                              }}>叫号推送</button>
                              <button onClick={() => shopCancel(o, '服务中')} style={{
                                padding: '6px 10px', background: t.accent,
                                color: '#fff', border: 'none', borderRadius: 6,
                                fontSize: 11, fontWeight: 600, cursor: 'pointer',
                              }}>✕ 取消</button>
                            </>
                          )}
                          {/* v1.1.38 会员入口：放在三个状态分支之外，所有状态都能点 */}
                          <button
                            onClick={() => setMemberFor({
                              phone: o.customerPhone,
                              customerName: o.customerName,
                              service: o.service,
                              orderNo: (o as any).no,
                            })}
                            style={{
                              padding: '6px 10px', background: '#b8860b',
                              color: '#fff', border: 'none', borderRadius: 6,
                              fontSize: 11, fontWeight: 700, cursor: 'pointer',
                            }}
                          >会员</button>
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
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            <button
              onClick={() => {
                // ⭐ 2026-10-01 20:48 奕霖拍板回退：直接弹 PIN 框输默认 PIN 进店长模式
                if (hasPin() && isInGracePeriod()) {
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
            </div>
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
                <div style={{ fontSize: 11, opacity: 0.85, letterSpacing: '0.1em' }}>🕐 当前北京时间</div>
                {/* ⭐ v1.1.24.1 (2026-10-05 16:00 奕霖立)：实时 wall clock（HH:mm:SS 秒级 tick） */}
                <div style={{
                  fontSize: 48, fontWeight: 900, fontFamily: 'monospace',
                  letterSpacing: '0.04em', lineHeight: 1,
                  fontVariantNumeric: 'tabular-nums',  // 避免数字跳动
                }}>
                  {currentBeijingTime}
                </div>
                <div style={{ fontSize: 13, opacity: 0.95, fontWeight: 600, marginTop: 4 }}>
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
                {/* ⭐ 2026-10-06 12:45 清禾改：v1.1.29 - 删重复「暂无服务」label（之前 outer + inner 两层，现在只剩 inner） */}
                {/* ⭐ 2026-10-05 00:56 奕霖立：动态显示下一位预约（今天 → 明天 → 默认） */}
                {nextTodayReservation ? (
                  <>
                    <div style={{ fontSize: 36, color: t.primary, fontWeight: 900, fontFamily: 'monospace', lineHeight: 1.1 }}>
                      {nextTodayReservation.scheduledAt}
                    </div>
                    <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 4 }}>
                      ⏰ 下一位 · {nextTodayReservation.customerName.slice(0, 4)} · {nextTodayReservation.stylistName}
                    </div>
                    <div style={{ fontSize: 11, color: t.textMuted, marginTop: 4 }}>
                      今日还有 {reservedTodayOrders.length} 单已预约
                    </div>
                  </>
                ) : nextTomorrowReservation ? (
                  <>
                    {/* ⭐ 2026-10-06 12:55 清禾改：v1.1.31 - 删「暂无服务」label + 删卡框，纯文字排版 */}
                    <div style={{
                      fontSize: 28, color: t.primary, fontWeight: 700,
                      fontFamily: 'monospace', lineHeight: 1,
                      fontVariantNumeric: 'tabular-nums',
                      marginBottom: 16,
                    }}>
                      {currentBeijingTime}
                    </div>
                    {/* 整块可点击区域：明日预约数 + 下一位预约 */}
                    <div
                      onClick={() => setShowTomorrowListModal(true)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        marginBottom: 8,
                      }}>
                        <div style={{
                          fontSize: 11, color: t.textMuted,
                          letterSpacing: '0.08em',
                        }}>
                          明日预约 · {reservedTomorrowOrders.length} 单
                        </div>
                        <div style={{
                          fontSize: 11, color: t.primary, fontWeight: 600,
                        }}>
                          查看全部 →
                        </div>
                      </div>
                      <div style={{
                        display: 'flex', alignItems: 'baseline', gap: 10,
                      }}>
                        <span style={{
                          fontFamily: 'monospace', fontWeight: 700,
                          color: t.primary, fontVariantNumeric: 'tabular-nums',
                          fontSize: 18, minWidth: 56,
                        }}>{nextTomorrowReservation.scheduledAt}</span>
                        <span style={{ flex: 1, fontWeight: 500, fontSize: 14 }}>
                          {nextTomorrowReservation.customerName}
                        </span>
                        {nextTomorrowReservation.stylistName && nextTomorrowReservation.stylistName !== 'Will be assigned' && (
                          <span style={{ color: t.textMuted, fontSize: 11 }}>
                            {nextTomorrowReservation.stylistName}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* 弹窗：明日全部预约 */}
                    {showTomorrowListModal && (
                      <ModalOverlay t={t} onClose={() => setShowTomorrowListModal(false)}>
                        <ModalHeader title="明日全部预约" onClose={() => setShowTomorrowListModal(false)} t={t} />
                        <div style={{ padding: 20 }}>
                          <div style={{
                            fontSize: 11, color: t.textMuted,
                            letterSpacing: '0.08em', marginBottom: 16,
                          }}>
                            共 {reservedTomorrowOrders.length} 单 · 按时间排序
                          </div>
                          <div style={{
                            display: 'flex', flexDirection: 'column', gap: 0,
                          }}>
                            {reservedTomorrowOrders.map((o, i) => (
                              <div key={o.id} style={{
                                display: 'flex', alignItems: 'baseline', gap: 10,
                                padding: '12px 0',
                                borderBottom: i < reservedTomorrowOrders.length - 1
                                  ? `1px solid ${t.border}`
                                  : 'none',
                              }}>
                                <span style={{
                                  fontFamily: 'monospace', fontWeight: 700,
                                  color: t.primary, fontVariantNumeric: 'tabular-nums',
                                  fontSize: 16, minWidth: 56,
                                }}>{o.scheduledAt}</span>
                                <span style={{ flex: 1, fontWeight: 500, fontSize: 14 }}>
                                  {o.customerName}
                                </span>
                                {o.stylistName && o.stylistName !== 'Will be assigned' && (
                                  <span style={{ color: t.textMuted, fontSize: 12 }}>
                                    {o.stylistName}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </ModalOverlay>
                    )}
                  </>
                ) : (
                  <>
                    {/* ⭐ 2026-10-06 12:55 清禾改：v1.1.31 - 删「暂无服务」label（默认分支：仅 实时时间 + 随时可到店） */}
                    <div style={{
                      fontSize: 28, color: t.primary, fontWeight: 700,
                      fontFamily: 'monospace', lineHeight: 1,
                      fontVariantNumeric: 'tabular-nums',
                      marginBottom: 12,
                    }}>
                      {currentBeijingTime}
                    </div>
                    <div style={{ fontSize: 14, color: t.text, fontWeight: 500 }}>
                      {totalInQueue > 0
                        ? '排队 ' + totalInQueue + ' 人'
                        : '随时可到店'}
                    </div>
                    {totalInQueue > 0 && (
                      <div style={{ fontSize: 11, color: t.textMuted, marginTop: 6 }}>
                        {'首位预计 ' + (servingOrders.length === 0 ? '可立即服务' : etaForAhead(servingOrders.length) + ' 分钟')}
                      </div>
                    )}
                  </>
                )}
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
                {/* ⭐ v1.1.20 (2026-10-05 12:01 奕霖立)：加空状态提示 */}
                {activities.length === 0 ? (
                  <div style={{ fontSize: 11, color: t.textMuted, fontStyle: 'italic', padding: '4px 0' }}>
                    暂无活动 · 等待预约或取号事件
                  </div>
                ) : activities.slice(0, 4).map((act, i) => (
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
            {/* ⭐ 2026-10-06 12:35 清禾改：方案 A 极简克制版（v1.1.28）— 字号收紧到 28/18/14/11，删 emoji，分层留白 */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
              marginBottom: 12,
            }}>
              <h3 style={{ fontSize: 18, color: t.text, fontWeight: 600, margin: 0 }}>
                实时排队
              </h3>
              <div style={{
                display: 'flex', background: t.bgDeep,
                borderRadius: 6, padding: 2,
                border: `1px solid ${t.border}`,
              }}>
                <button
                  onClick={() => setQueueView('flat')}
                  style={{
                    padding: '4px 10px',
                    background: queueView === 'flat' ? t.primary : 'transparent',
                    color: queueView === 'flat' ? '#fff' : t.textMuted,
                    border: 'none', borderRadius: 4,
                    fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  }}
                >时间</button>
                <button
                  onClick={() => setQueueView('byStylist')}
                  style={{
                    padding: '4px 10px',
                    background: queueView === 'byStylist' ? t.primary : 'transparent',
                    color: queueView === 'byStylist' ? '#fff' : t.textMuted,
                    border: 'none', borderRadius: 4,
                    fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  }}
                >全部</button>
              </div>
            </div>
            <div style={{
              display: 'flex', alignItems: 'baseline', gap: 6,
              marginBottom: 12,
            }}>
              <span style={{
                fontSize: 28, fontWeight: 700, color: t.primary,
                fontFamily: 'monospace', lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {totalInQueue}
              </span>
              <span style={{ fontSize: 14, color: t.text }}>人在排队</span>
            </div>
            {/* ⭐ 2026-10-05 00:56 奕霖立：实时分项数据（让客人看总忙度） */}
            {/* ⭐ 2026-10-06 11:27 清禾修 Bug 2：明日预约不该混入实时分项（语义错） */}
            {(servingOrders.length + reservedTodayOrders.length) > 0 && (
              <div style={{
                display: 'flex', gap: 16, fontSize: 11, color: t.textMuted,
                marginBottom: 8,
              }}>
                {servingOrders.length > 0 && <span>服务中 <b style={{color: t.success, fontWeight: 600}}>{servingOrders.length}</b></span>}
                {reservedTodayOrders.length > 0 && <span>今日预约 <b style={{color: t.primary, fontWeight: 600}}>{reservedTodayOrders.length}</b></span>}
              </div>
            )}
            {/* ⭐ 2026-10-05 00:56 奕霖立：预计等待（全局） */}
            {(servingOrders.length + arrivedOrders.length + reservedTodayOrders.length) > 0 && (
              <div style={{
                fontSize: 11, color: t.textMuted,
                marginBottom: 16,
              }}>
                现到店预计 <b style={{color: t.primary, fontWeight: 600}}>{globalEtaMin}</b> 分钟
              </div>
            )}

            {queueView === 'flat' ? (
              <div style={{
                maxHeight: 320,
                overflowY: 'auto',
                display: 'flex', flexDirection: 'column', gap: 8,
                paddingRight: 4,
                marginRight: -4,
              } as React.CSSProperties}>
                {[...arrivedOrders, ...reservedTodayOrders].length === 0 ? (
                  <div style={{ padding: '40px 16px', textAlign: 'center' }}>
                    <div style={{ fontSize: 14, color: t.text, marginBottom: 6 }}>
                      当前无人排队
                    </div>
                    {/* ⭐ 2026-10-06 12:35 清禾改：方案 A 极简克制版（v1.1.28）— 删 emoji，padding 16→40 增留白 */}
                    <div style={{ fontSize: 11, color: t.textMuted }}>
                      随时可到店
                    </div>
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
                          {/* v1.1.37: 每位各自的预估等待时间（原来只有一个全局值） */}
                          <div style={{ fontSize: 11, color: t.primary, marginTop: 3, fontWeight: 700 }}>
                            {servingOrders.length === 0 && i === 0
                              ? '可立即服务'
                              : `预计 ${etaForAhead(servingOrders.length + i)} 分钟`}
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
                            {isArrived ? `第 ${i + 1} 位` : '预约'}
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
                  const sp = dynamicStylists.find(s => s.name === stylistName)
                  const emoji = sp?.specialties?.includes('dye') ? '🎨' : sp?.specialties?.includes('care') ? '🧴' : '💇'
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
                          {(() => {
                            const sc = dynamicStylists.find(s => s.name === stylistName)?.code
                            if (sc) return <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 5px', background: t.primarySoft, color: t.primary, borderRadius: 4, fontFamily: 'monospace' }}>#{sc}</span>
                            return null
                          })()}
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

        {/* ⭐ v1.1 (2026-10-04 18:48 奕霖"全做吧"双确认) · 改动 3:
              BookingSection 主页显示 reservedTodayOrders 列表
              - 让多端用户一进来就能看到今天已经约了谁（修"看不到时间标灰"bug）
              - 5 秒轮询会自动更新（与 BookingModal 内 useEffect 同步）
              - 按时段升序排列，每条显示：时段 + 顾客名 + 理发师 + 服务 */}
        {reservedTodayOrders.length > 0 && (
          <div style={{
            marginBottom: 16,
            padding: '12px 14px',
            background: 'rgba(184, 134, 11, 0.06)',
            border: '1px solid rgba(184, 134, 11, 0.22)',
            borderRadius: 12,
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 10,
            }}>
              <div style={{
                fontSize: 12, fontWeight: 700, color: t.primary,
                letterSpacing: '0.05em',
              }}>📅 今日已被预约时段</div>
              <div style={{
                fontSize: 11, fontWeight: 700,
                padding: '2px 8px',
                background: t.primaryGlow,
                color: t.primary,
                borderRadius: 10,
                fontFamily: 'monospace',
              }}>{reservedTodayOrders.length} 单</div>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
              gap: 6,
            }}>
              {reservedTodayOrders.map(o => {
                const isMine = o.customerPhone === currentUserPhone
                return (
                  <div key={o.id} style={{
                    padding: '8px 10px',
                    background: isMine ? 'rgba(184, 134, 11, 0.18)' : t.bgDeep,
                    border: `1px solid ${isMine ? t.primary : t.border}`,
                    borderRadius: 8,
                    borderLeft: isMine ? `3px solid ${t.primary}` : `1px solid ${t.border}`,
                    fontSize: 11,
                  }}>
                    <div style={{
                      fontFamily: 'monospace',
                      fontWeight: 800,
                      color: t.primary,
                      fontSize: 13,
                      marginBottom: 2,
                    }}>{o.scheduledAt}</div>
                    <div style={{
                      fontWeight: 600, color: t.text,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>{isMine ? '⭐ ' + o.customerName : o.customerName.slice(0, 2) + '**'}</div>
                    <div style={{ color: t.textMuted, fontSize: 10 }}>
                      {o.stylistName} · {o.service}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 按钮区 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 12, marginBottom: 16,
        }}>
          <ActionButton icon="📅" label="在线预约" onClick={() => setModal('booking')} t={t} />
          <ActionButton icon="🎫" label="现场取号" onClick={() => setModal('ticket')} t={t} />
          <ActionButton icon="📋" label="预约协议" onClick={() => setModal('agreement')} t={t} />
          <div style={{ position: 'relative' }}>
            <ActionButton icon="💇" label="选理发师" onClick={() => router.push('/stylist')} t={t} />
            {managerMode && (
              <button
                onClick={() => router.push(`/admin/stylists?merchantId=${merchantId}`)}
                title="编辑选理发师内容"
                style={{
                  position: 'absolute', top: 6, right: 6,
                  padding: '3px 8px',
                  background: 'rgba(184, 134, 11, 0.18)',
                  border: '1px solid #b8860b',
                  borderRadius: 6,
                  fontSize: 10, fontWeight: 600,
                  color: '#b8860b',
                  cursor: 'pointer',
                  zIndex: 2,
                  boxShadow: '0 2px 6px rgba(184, 134, 11, 0.2)',
                }}
              >✎ 编辑</button>
            )}
          </div>
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

        {/* v1.1.41 顾客查余额入口（常驻）
            之前只能靠推送点链接 / 手输 URL，顾客自己根本找不到 —— 那事等于没做完。
            放在预约/取号区下方常驻，不依赖当前有没有进行中的单。 */}
        <button
          onClick={() => router.push(
            currentUserPhone
              ? '/my-card?phone=' + encodeURIComponent(currentUserPhone)
              : '/my-card'
          )}
          style={{
            display: 'flex', alignItems: 'center', gap: 10, width: '100%',
            padding: '12px 14px', marginTop: 2,
            background: 'rgba(184, 134, 11, 0.06)',
            border: '1px solid rgba(184, 134, 11, 0.25)',
            borderRadius: 10, cursor: 'pointer', textAlign: 'left',
            fontSize: 13, fontWeight: 700, color: '#5d3a1f',
          }}
        >
          <span style={{ fontSize: 20 }}>💳</span>
          <span style={{ flex: 1 }}>
            我的会员卡
            <span style={{
              display: 'block', fontSize: 11, fontWeight: 400,
              opacity: 0.7, marginTop: 2,
            }}>
              查余额 · 看充值和消费记录
            </span>
          </span>
          <span style={{ opacity: 0.5, fontSize: 18 }}>›</span>
        </button>
      </div>

      {/* 弹窗 */}
      {modal === 'booking' && (
        isLoggedIn ? (
          hasActiveTicket ? (
            <AlreadyBookedPopup key="active-ticket" t={t} onClose={() => setModal(null)} reason="ticket" />
          ) : (
            <BookingModal key="booking" t={t} onClose={() => setModal(null)} stylists={dynamicStylists} nextNo={nextBookingNo} reservedBookings={orders.filter(o => o.status === 'reserved')} userName={currentUserName} userPhone={currentUserPhone} now={now}
              isLoggedIn={isLoggedIn} userPhone={currentUserPhone} hasActiveTicket={hasActiveTicket || hasActiveServing}
              onSuccess={(order) => {
                setOrders(prev => [order, ...prev])
                setBookingSuccess(order.no)
                setModal(null)
                // ⭐ v1.1.23 (2026-10-05 13:06 奕霖立)：先弹窗显示基础信息，POST 拿到 pickupCode 后再补上
                const initialPopupOrder = { ...order }
                setSuccessPopup({ type: 'booking', order: initialPopupOrder })
                // ⭐ 2026-10-05 01:25 奕霖立：预约提交成功 → 软登录（/orders 等不再弹 LoginModal）
                useUserStore.getState().softLogin(order.customerPhone, order.customerName)
                // 根治：POST 到 API
                const stylistCode = dynamicStylists.find(s => s.name === order.stylistName)?.code || null
                fetch('/api/queues', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    merchantId,
                    orderNo: order.no,
                    type: 'booking',
                    customerName: order.customerName,
                    customerPhone: order.customerPhone,
                    service: order.service,
                    stylistName: order.stylistName,
                    stylistCode,
                    status: 'reserved',
                    scheduledAt: order.scheduledAt,
                    scheduledDate: order.scheduledDate,
                  }),
                }).then(r => r.json()).then(d => {
                  if (d.success && d.pickupCode) {
                    // ⭐ v1.1.23：拿 pickupCode 补进弹窗
                    setSuccessPopup(prev => prev ? { ...prev, order: { ...prev.order, pickupCode: d.pickupCode } } : null)
                  }
                  loadQueues()
                }).catch(() => loadQueues())
              }} />
          )
        ) : (
          <LoginRequiredPopup key="login-booking" t={t} onClose={() => setModal(null)} action="booking" />
        )
      )}
      {modal === 'ticket' && (
        isLoggedIn ? (
          hasActiveBooking || hasActiveServing ? (
            <AlreadyBookedPopup key="active-booking" t={t} onClose={() => setModal(null)} reason="booking" />
          ) : (
            <TicketModal key="ticket" t={t} onClose={() => setModal(null)} stylists={dynamicStylists} nextNo={nextTicketNo} reservedBookings={orders.filter(o => o.status === 'reserved')} userName={currentUserName} userPhone={currentUserPhone}
              isLoggedIn={isLoggedIn} userPhone={currentUserPhone} hasActiveBooking={hasActiveBooking || hasActiveServing}
              onSuccess={(order) => {
                setOrders(prev => [order, ...prev])
                setTicketSuccess(order.no)
                setModal(null)
                // ⭐ v1.1.23：先弹窗显示基础信息，POST 拿到 pickupCode 后再补上
                const initialPopupOrder = { ...order }
                setSuccessPopup({ type: 'ticket', order: initialPopupOrder })
                // ⭐ 2026-10-05 01:25 奕霖立：取号提交成功 → 软登录（/orders 等不再弹 LoginModal）
                useUserStore.getState().softLogin(order.customerPhone, order.customerName)
                // 根治：POST 到 API
                const stylistCode = dynamicStylists.find(s => s.name === order.stylistName)?.code || null
                fetch('/api/queues', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    merchantId,
                    orderNo: order.no,
                    type: 'ticket',
                    customerName: order.customerName,
                    customerPhone: order.customerPhone,
                    service: order.service,
                    stylistName: order.stylistName,
                    stylistCode,
                    status: 'arrived',
                    scheduledAt: order.scheduledAt,
                    scheduledDate: 'today',
                    arrivedAt: order.scheduledAt,
                  }),
                }).then(r => r.json()).then(d => {
                  if (d.success) {
                    // v1.1.31 (2026-10-06 18:57 qinghe fix Bug 3 C): server orderNo is authoritative.
                    //   On collision the server auto-increments, so a local B001 may persist as B003.
                    //   Without this the popup shows one number while the queue shows another.
                    if (d.finalOrderNo && d.finalOrderNo !== order.no) {
                      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, no: d.finalOrderNo } : o))
                      setTicketSuccess(d.finalOrderNo)
                    }
                    setSuccessPopup(prev => prev ? { ...prev, order: { ...prev.order, no: d.finalOrderNo || prev.order.no, pickupCode: d.pickupCode } } : null)
                  }
                  loadQueues()
                }).catch(() => loadQueues())
              }} />
          )
        ) : (
          <LoginRequiredPopup key="login-ticket" t={t} onClose={() => setModal(null)} action="ticket" />
        )
      )}
      {modal === 'agreement' && (
        <AgreementModal t={t} onClose={() => setModal(null)} />
      )}

      {/* ⭐ 2026-10-01 23:53 奕霖立：成功后弹窗 */}
      {/* ⭐ v1.1.23 (2026-10-05 13:06 奕霖立)：成功后弹窗升级版 */}
      {successPopup && (
        <div
          onClick={() => setSuccessPopup(null)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(44, 24, 16, 0.65)',
            zIndex: 1100,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
            animation: 'fadeIn 0.25s ease-out',
          }}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fffaf0',
              borderRadius: 18, padding: 0,
              maxWidth: 440, width: '100%',
              border: '2px solid #b8860b',
              boxShadow: '0 16px 48px rgba(44, 24, 16, 0.45)',
              textAlign: 'center',
              overflow: 'hidden',
              animation: 'popInSuccess 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}>
            {/* 顶部金色色带 */}
            <div style={{
              background: 'linear-gradient(135deg, #b8860b 0%, #8b6508 100%)',
              padding: '20px 24px 16px',
              color: '#fffaf0',
              position: 'relative',
            }}>
              <div style={{ fontSize: 56, lineHeight: 1, marginBottom: 8 }}>
                {successPopup.type === 'booking' ? '📅' : '🎫'}
              </div>
              <h3 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '0.04em' }}>
                {successPopup.type === 'booking' ? '预约成功' : '取号成功'}
              </h3>
              <p style={{ fontSize: 12, color: 'rgba(255,250,240,0.85)', margin: '6px 0 0' }}>
                {successPopup.type === 'booking' ? '请提前 5 分钟到店' : '请等候叫号推送'}
              </p>
            </div>

            <div style={{ padding: '20px 24px 24px' }}>
              {/* 大号牌 */}
              <div style={{
                padding: '14px 18px',
                background: 'linear-gradient(135deg, rgba(184, 134, 11, 0.12) 0%, rgba(184, 134, 11, 0.04) 100%)',
                border: '1.5px solid rgba(184, 134, 11, 0.35)',
                borderRadius: 14, marginBottom: 10,
              }}>
                <div style={{ fontSize: 11, color: '#5d3a1f', marginBottom: 6, letterSpacing: '0.08em', fontWeight: 600 }}>
                  {successPopup.type === 'booking' ? '🎫 预约号' : '🎫 排队号'}
                </div>
                <div style={{
                  fontSize: 32, fontWeight: 900, color: '#b8860b',
                  fontFamily: 'monospace', letterSpacing: '0.1em', lineHeight: 1,
                }}>
                  {(successPopup.order.no || successPopup.order.id || '').toUpperCase()}
                </div>
              </div>

              {/* ⭐ v1.1.23 pickupCode 取货码 卡片 */}
              {successPopup.order.pickupCode && (
                <div style={{
                  padding: '10px 14px',
                  background: 'rgba(139, 0, 0, 0.06)',
                  border: '1.5px dashed rgba(139, 0, 0, 0.4)',
                  borderRadius: 12, marginBottom: 12,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div style={{ fontSize: 11, color: '#8b0000', fontWeight: 600, letterSpacing: '0.06em' }}>
                    🔐 到店取货码
                  </div>
                  <div style={{
                    fontSize: 22, fontWeight: 900, color: '#8b0000',
                    fontFamily: 'monospace', letterSpacing: '0.18em',
                  }}>
                    {successPopup.order.pickupCode}
                  </div>
                </div>
              )}

              {/* ⭐ v1.1.23 位置 + ETA 预测卡（仅 ticket 显示） */}
              {successPopup.type === 'ticket' && (
                <div style={{
                  padding: '10px 14px',
                  background: 'linear-gradient(135deg, rgba(91, 186, 115, 0.12) 0%, rgba(91, 186, 115, 0.04) 100%)',
                  border: '1px solid rgba(91, 186, 115, 0.3)',
                  borderRadius: 12, marginBottom: 12,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: 12,
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: '#5d3a1f', marginBottom: 2 }}>📍 当前位置</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#5bba73', fontFamily: 'monospace' }}>
                      第 <span style={{ fontSize: 28 }}>{arrivedOrders.length}</span> 位
                    </div>
                  </div>
                  <div style={{ width: 1, height: 32, background: 'rgba(91, 186, 115, 0.3)' }} />
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: '#5d3a1f', marginBottom: 2 }}>⏱️ 预计等待</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#5bba73', fontFamily: 'monospace' }}>
                      <span style={{ fontSize: 28 }}>{arrivedOrders.length * 15}</span> 分钟
                    </div>
                  </div>
                </div>
              )}

              {/* 详情信息 */}
              <div style={{
                fontSize: 12, color: '#5d3a1f', lineHeight: 1.7,
                textAlign: 'left', marginBottom: 16,
                padding: '10px 14px',
                background: 'rgba(184, 134, 11, 0.04)',
                borderRadius: 10,
              }}>
                <div>👤 <b>{successPopup.order.customerName}</b> · 📞 {successPopup.order.customerPhone}</div>
                <div>💇 {successPopup.order.service} · 理发师 <b>{successPopup.order.stylistName}</b></div>
                <div>🕒 {successPopup.type === 'booking' ? '预约时间' : '取号时间'}：<b>{successPopup.order.scheduledAt}</b></div>
              </div>

              {/* ⭐ v1.1.23 双按钮 + 5s 自动关闭 */}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => { setSuccessPopup(null); router.push('/orders') }}
                  style={{
                    flex: 1, padding: '12px',
                    background: '#b8860b', color: '#fff',
                    border: 'none', borderRadius: 10,
                    fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  }}>查看订单</button>
                <button
                  onClick={() => setSuccessPopup(null)}
                  style={{
                    flex: 1, padding: '12px',
                    background: 'rgba(184, 134, 11, 0.08)', color: '#b8860b',
                    border: '1.5px solid rgba(184, 134, 11, 0.3)',
                    borderRadius: 10,
                    fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  }}>继续逛逛</button>
              </div>
              {/* v1.1.41 成功弹窗里也放一个：刚取完号，他正好想知道卡里还剩多少 */}
              <button
                onClick={() => {
                  setSuccessPopup(null)
                  router.push('/my-card?phone=' + encodeURIComponent(successPopup.order.customerPhone || ''))
                }}
                style={{
                  width: '100%', marginTop: 10, padding: '9px',
                  background: 'transparent', color: '#b8860b',
                  border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}
              >
                💳 查看我的会员卡余额 ›
              </button>
              <div style={{
                fontSize: 10, color: '#8d6e63', marginTop: 6, textAlign: 'center',
              }}>
                ⏱️ <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{successPopup.countdown ?? 5}</span> 秒后自动关闭 · 点击背景也可关闭
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ⭐ v1.1.23 (2026-10-05 13:06 奕霖立)：取消确认弹窗（替 browser confirm()） */}
      {/* v1.1.34 (2026-10-06 20:24): 叫号推送居中弹窗 + 提示音 + 震动 */}
      {/* 2026-10-07 清禾: 常驻到号提醒栏 */}
      {/* 之前 PushSetup 只放在 5 秒自动关闭的成功弹窗里，实际根本点不到 */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          padding: '10px 14px', margin: '0 0 14px',
          background: 'rgba(184, 134, 11, 0.06)',
          border: '1px solid rgba(184, 134, 11, 0.25)',
          borderRadius: 12,
        }}
      >
        <PushSetup
          phone={currentUserPhone || ''}
          merchantId={merchantId}
        />
        <CallListener
          phone={currentUserPhone || ''}
          merchantId={merchantId}
          onCall={handleSseCall}
        />
      </div>

      {callPopup && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(20, 12, 6, 0.74)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 20, backdropFilter: 'blur(4px)',
        }}>
          <div style={{
            width: '100%', maxWidth: 380,
            background: 'linear-gradient(160deg, #fef3c7 0%, #fde68a 100%)',
            border: '2px solid #b8860b', borderRadius: 20,
            padding: '28px 22px 24px', textAlign: 'center',
            boxShadow: '0 24px 70px rgba(0,0,0,0.5)',
          }}>
            <div style={{ fontSize: 12, color: '#92400e', letterSpacing: '0.22em', fontWeight: 700 }}>
              叫号推送
            </div>
            <div style={{ fontSize: 38, fontWeight: 900, color: '#2c1810', marginTop: 12, lineHeight: 1.15 }}>
              {callPopup.name}
            </div>
            <div style={{ fontSize: 15, color: '#78350f', marginTop: 8, fontWeight: 600 }}>
              {callPopup.service} · {callPopup.stylist} 老师
            </div>
            <div style={{ fontSize: 13, color: '#92400e', marginTop: 6 }}>
              {callPopup.no ? `单号 ${callPopup.no} · ` : ''}{callPopup.time} 请到店
            </div>
            <div style={{ fontSize: 12, color: '#92400e', marginTop: 10 }}>
              📱 {callPopup.phone}
            </div>
            <div style={{ fontSize: 11, color: '#a16207', marginTop: 14, lineHeight: 1.7 }}>
              仅本机提醒 · 顾客端推送尚未接入
            </div>
            <button
              onClick={() => setCallPopup(null)}
              style={{
                marginTop: 18, width: '100%', padding: '13px 16px',
                background: '#b8860b', color: '#fff', border: 'none', borderRadius: 12,
                fontSize: 16, fontWeight: 700, cursor: 'pointer',
              }}
            >
              知道了
            </button>
          </div>
        </div>
      )}
      {/* v1.1.35 (2026-10-06 20:34): 店长取消确认弹窗（替代被吞掉的 confirm()） */}
      {shopCancelPopup && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1100,
          background: 'rgba(20, 12, 6, 0.72)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }}>
          <div style={{
            width: '100%', maxWidth: 360, background: '#fff',
            borderRadius: 16, padding: '22px 20px', boxShadow: '0 20px 60px rgba(0,0,0,0.45)',
          }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#8b0000' }}>
              确认取消{shopCancelPopup.label}
            </div>
            <div style={{ fontSize: 13, color: '#5b4636', marginTop: 12, lineHeight: 1.9 }}>
              <div>👤 {shopCancelPopup.order.customerName}</div>
              <div>💇 {shopCancelPopup.order.service} · {shopCancelPopup.order.stylistName} 老师</div>
              <div>🕒 {shopCancelPopup.order.scheduledAt}</div>
            </div>
            <div style={{ fontSize: 12, color: '#8a7360', marginTop: 14, fontWeight: 600 }}>
              店长 PIN
            </div>
            <input
              type='password'
              inputMode='numeric'
              placeholder='请输入店长 PIN'
              value={shopCancelPopup.pin}
              onChange={(e) => setShopCancelPopup({ ...shopCancelPopup, pin: e.target.value })}
              style={{
                width: '100%', marginTop: 6, padding: '11px 12px',
                border: '1px solid #d9c9b0', borderRadius: 10, fontSize: 16,
                letterSpacing: '0.3em', outline: 'none', boxSizing: 'border-box',
              }}
            />
            {shopCancelPopup.error && (
              <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 8 }}>
                ❌ {shopCancelPopup.error}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button
                onClick={() => setShopCancelPopup(null)}
                style={{
                  flex: 1, padding: '12px', border: 'none', borderRadius: 10,
                  background: '#f1e7d8', color: '#5b4636', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                }}
              >
                再想想
              </button>
              <button
                onClick={confirmShopCancel}
                disabled={shopCancelPopup.busy}
                style={{
                  flex: 1, padding: '12px', border: 'none', borderRadius: 10,
                  background: shopCancelPopup.busy ? '#c9b9a6' : '#8b0000', color: '#fff',
                  fontSize: 14, fontWeight: 700, cursor: shopCancelPopup.busy ? 'wait' : 'pointer',
                }}
              >
                {shopCancelPopup.busy ? '取消中…' : '确认取消'}
              </button>
            </div>
            <div style={{ fontSize: 11, color: '#a8927c', marginTop: 12, textAlign: 'center' }}>
              取消后该顾客会从实时排队中移除
            </div>
          </div>
        </div>
      )}
      {cancelPopup && (
        <div
          onClick={() => setCancelPopup(null)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(44, 24, 16, 0.65)',
            zIndex: 1100,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
            animation: 'fadeIn 0.25s ease-out',
          }}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fffaf0',
              borderRadius: 18, padding: 0,
              maxWidth: 420, width: '100%',
              border: '2px solid rgba(139, 0, 0, 0.4)',
              boxShadow: '0 16px 48px rgba(44, 24, 16, 0.45)',
              textAlign: 'center',
              overflow: 'hidden',
              animation: 'popInSuccess 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}>
            {/* 顶部红色警示色带 */}
            <div style={{
              background: 'linear-gradient(135deg, #8b0000 0%, #5d0000 100%)',
              padding: '20px 24px 16px',
              color: '#fffaf0',
            }}>
              <div style={{ fontSize: 56, lineHeight: 1, marginBottom: 8 }}>⚠️</div>
              <h3 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '0.04em' }}>
                取消{cancelPopup.label}
              </h3>
              <p style={{ fontSize: 12, color: 'rgba(255,250,240,0.85)', margin: '6px 0 0' }}>
                取消后号源自动释放给其他顾客
              </p>
            </div>

            <div style={{ padding: '20px 24px 24px' }}>
              {/* 详情卡 */}
              <div style={{
                padding: '14px 18px',
                background: 'rgba(139, 0, 0, 0.04)',
                border: '1.5px solid rgba(139, 0, 0, 0.2)',
                borderRadius: 14, marginBottom: 14,
                textAlign: 'left',
              }}>
                <div style={{
                  fontSize: 11, color: '#8b0000', marginBottom: 6,
                  letterSpacing: '0.08em', fontWeight: 600,
                }}>
                  {cancelPopup.label === '预约' ? '预约详情' : '排队详情'}
                </div>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#2c1810', fontFamily: 'monospace', letterSpacing: '0.1em', marginBottom: 8 }}>
                  {cancelPopup.order.no || cancelPopup.order.id}
                </div>
                <div style={{ fontSize: 12, color: '#5d3a1f', lineHeight: 1.7 }}>
                  <div>👤 <b>{cancelPopup.order.customerName}</b></div>
                  <div>💇 {cancelPopup.order.service} · 理发师 <b>{cancelPopup.order.stylistName}</b></div>
                  <div>🕒 {cancelPopup.order.scheduledAt}</div>
                </div>
              </div>

              <div style={{
                padding: '10px 14px',
                background: 'rgba(184, 134, 11, 0.08)',
                borderLeft: '3px solid #b8860b',
                borderRadius: 8, marginBottom: 18,
                fontSize: 12, color: '#5d3a1f', textAlign: 'left',
              }}>
                💡 <b>提示</b>：迟到可改时段或致电店长保留号源 · 反复取消可能影响信用
              </div>

              {/* 双按钮 */}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setCancelPopup(null)}
                  style={{
                    flex: 1, padding: '12px',
                    background: 'rgba(184, 134, 11, 0.08)', color: '#b8860b',
                    border: '1.5px solid rgba(184, 134, 11, 0.3)',
                    borderRadius: 10,
                    fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  }}>我再想想</button>
                <button
                  onClick={async () => {
                    const target = cancelPopup.order
                    const label = cancelPopup.label
                    setCancelPopup(null)
                    try {
                      const res = await fetch(`/api/queues/${target.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          status: 'cancelled',
                          cancelledBy: 'user',
                          customerPhone: currentUserPhone,
                          cancelReason: '用户主动取消',
                        }),
                      })
                      const d = await res.json()
                      if (d.success) {
                        setBookingSuccess(''); setTicketSuccess('')
                        loadQueues()
                        setToast(`✅ 已取消${label}`)
                        setTimeout(() => setToast(''), 2500)
                      } else {
                        alert('取消失败：' + (d.error || '未知错误'))
                      }
                    } catch (e) {
                      alert('网络错误，请重试')
                    }
                  }}
                  style={{
                    flex: 1, padding: '12px',
                    background: '#8b0000', color: '#fff',
                    border: 'none', borderRadius: 10,
                    fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  }}>确认取消</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ⭐ v1.1.23 全局 CSS 动画（success + cancel 弹窗都用） */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes popInSuccess { from { opacity: 0; transform: scale(0.85) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      `}</style>

      {/* PIN 弹窗 */}
      {pinModal === 'setup' && (
        <PinSetupModal t={t} onClose={() => setPinModal(null)} isFirstTime={!hasPin()}
          onSuccess={() => {
            setManagerMode(true)
            setShowPinPrompt(false)
            setLastAuthTime()
          }} />
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
      {/* v1.1.38 会员弹层：队列行点「会员」开这里 */}
      {/* v1.1.40 结算面板：完成后弹收款，结算完问要不要叫下一位 */}
      {settleFor && (() => {
        // v1.1.41 修崩溃：原来用的是 displayedOrders，
        //   那是 1649 行 JSX IIFE 里的局部常量，本作用域根本拿不到
        //   点「完成」直接 ReferenceError，结算面板永远打不开。
        //   改用顶层 activeOrders(1296 行)，组件作用域内一定有。
        const idx = activeOrders.findIndex(x => x.id === settleFor.id)
        const next = idx >= 0
          ? activeOrders.slice(idx + 1).find(
              (x: any) => x.status === 'arrived' || x.status === 'reserved')
          : null
        return (
          <SettlementSheet
            merchantId={merchantId}
            order={settleFor}
            hasNext={!!next}
            onNext={() => { if (next) callCustomer((next as any).id) }}
            onClose={() => setSettleFor(null)}
            onDone={() => {
              transition(
                settleFor.id,
                'completed',
                `结算完成 ${settleFor.customerName}`
              )
              loadQueues()
            }}
          />
        )
      })()}
      {memberFor && (
        <MemberQuickSheet
          merchantId={merchantId}
          phone={memberFor.phone}
          customerName={memberFor.customerName}
          service={memberFor.service}
          orderNo={memberFor.orderNo}
          onClose={() => setMemberFor(null)}
        />
      )}
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