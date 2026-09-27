'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import AppLayout from '@/components/AppLayout'
import ChatWindow from '@/components/ChatWindow'
import { emitVoiceStopAll, setUseWebSpeechMode, isWebSpeechMode } from '@/lib/speech'
import { toast } from '@/lib/ui-bus'
import { BUSINESS_CONFIG } from '@/config/business.config'
import { useUserStore } from '@/stores/userStore'

type Tab = 'chat' | 'profile' | 'orders' | 'cart'
const TABS: Array<{ key: Tab; icon: string; label: string; hint: string }> = [
  { key: 'chat',    icon: '💬', label: '对话',       hint: '搭配咨询' },
  { key: 'profile', icon: '👤', label: '档案·口味', hint: '头像/手机/过敏/饮食禁忌/口味' },
  { key: 'orders',  icon: '📦', label: '订单',       hint: '最近订单 + 取货码' },
  { key: 'cart',    icon: '🛒', label: '购物车',     hint: '已选商品 + 提交订单' },
]

export default function PharmacistPage() {
  const router = useRouter()
  const [autoPlayVoice, setAutoPlayVoice] = useState(true)
  // ⭐ 2026-07-28 16:13 奕霖反馈 (16:11): chengshu + pitch -2 听起来妩媚气短
  // 换 shaonv 少女豆包姐姐风 + pitch +2 开朗明亮 (speed 1.2 保留)
  // ⭐ 2026-07-28 15:42 奕霖关掉 Web Speech: 引擎永远是 minimax, 不再切换
  const MINIMAX_VOICES = [
    { id: 'female-shaonv', label: '少女 ⭐', desc: '豆包姐姐风 (默认)' },
    { id: 'female-tianmei', label: '甜美', desc: '温柔亲切' },
    { id: 'female-chengshu', label: '成熟', desc: '门店阿姨感' },
    { id: 'male-qn-jingying', label: '精英男', desc: '专业干练' },
  ] as const
  const [voiceId, setVoiceId] = useState<string>('female-shaonv')
  const [voicePickerOpen, setVoicePickerOpen] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const saved = window.localStorage.getItem('zhilin_tts_voice')
    if (saved) setVoiceId(saved)
  }, [])
  const selectVoice = (v: string) => {
    setVoiceId(v)
    setVoicePickerOpen(false)
    if (typeof window !== 'undefined') window.localStorage.setItem('zhilin_tts_voice', v)
  }
  const { name } = BUSINESS_CONFIG
  // ⭐ 奕霖 2026-07-06：顶部菜单栏 + 当前 tab
  const [tab, setTab] = useState<Tab>('chat')
  // ⭐ 奕霖 2026-07-06 12:42：搭配对象上提为页面级 state，让切换器插到 TabBar 下边
  const { user, token, refreshUser } = useUserStore()

  // ⭐ 奕霖 2026-06-30 18:49 反馈：切换顶部开关也要停所有声音
  // ⭐ 2026-07-29 19:21 修：开启时在 gesture 里解锁 AudioContext + 静音 buffer（iOS Safari 最可靠）
  const toggleAutoPlay = () => {
    if (autoPlayVoice) {
      // 关闭时停掉所有正在播的（包括流式）
      emitVoiceStopAll()
    } else {
      // 开启时在这个 gesture 里解锁——iOS Safari 要求 user gesture 才能 unlock audio
      try {
        const AnyAudioContext = (window as any).AudioContext || (window as any).webkitAudioContext
        if (AnyAudioContext) {
          const ctx = new AnyAudioContext()
          if (ctx.state === 'suspended') ctx.resume().catch(() => {})
          // 走一个 0.1s 静音 buffer 过 audio graph（iOS Safari 解锁最稳的机制）
          const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.1), ctx.sampleRate)
          const src = ctx.createBufferSource()
          src.buffer = buf
          src.connect(ctx.destination)
          src.start(0)
        }
      } catch (e) {
        console.warn('[unlock] toggleAudio failed:', e)
      }
    }
    setAutoPlayVoice(prev => !prev)
  }

  // ⭐ 2026-07-29 19:21 修：useEffect unlock 换用 Web Audio API silent buffer（替代可疑 base64）
  // - 基底还在跑（页面加载后任何第一次点击都生效）
  // - 主解锁路径在 toggleAutoPlay 里的 gesture 内（这里只是兏底）
  useEffect(() => {
    let unlocked = false
    const unlock = () => {
      if (unlocked) return
      unlocked = true
      try {
        const AnyAudioContext = (window as any).AudioContext || (window as any).webkitAudioContext
        if (!AnyAudioContext) return
        const ctx = new AnyAudioContext()
        if (ctx.state === 'suspended') ctx.resume().catch(() => {})
        // 0.1s 静音 buffer 过 audio graph（iOS Safari 最可靠的 unlock 机制）
        const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.1), ctx.sampleRate)
        const src = ctx.createBufferSource()
        src.buffer = buf
        src.connect(ctx.destination)
        src.start(0)
      } catch (e) {
        console.warn('[unlock] gesture unlock failed:', e)
      }
    }
    document.addEventListener('touchstart', unlock, { passive: true })
    document.addEventListener('click', unlock, { passive: true })
    document.addEventListener('pointerdown', unlock, { passive: true })
    document.addEventListener('touchend', unlock, { passive: true })
    document.addEventListener('keydown', unlock, { passive: true })
    return () => {
      document.removeEventListener('touchstart', unlock)
      document.removeEventListener('click', unlock)
      document.removeEventListener('pointerdown', unlock)
      document.removeEventListener('touchend', unlock)
      document.removeEventListener('keydown', unlock)
    }
  }, [])

  // ⭐ 奕霖 2026-07-06：进入口味/档案 tab 时拉一次最新用户数据
  useEffect(() => {
    if (tab === 'profile') {
      if (token) refreshUser()
    }
  }, [tab, token, refreshUser])

  return (
    <AppLayout
      title="造型助手"
      fullHeight
      hideBottomTabBar
      headerRight={
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          {/* ⭐ 2026-07-28 16:15 奕霖反馈 (16:11): 压缩 headerRight 不挡 chat 内容 */}
          {/* Voice auto-play toggle (icon-only) */}
          <button
            onClick={toggleAutoPlay}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '30px',
              height: '30px',
              borderRadius: '8px',
              background: autoPlayVoice
                ? 'rgba(184, 134, 11, 0.2)'
                : 'transparent',
              border: autoPlayVoice
                ? '1px solid rgba(184, 134, 11, 0.3)'
                : '1px solid rgba(184, 134, 11, 0.15)',
              color: autoPlayVoice ? '#b8860b' : 'rgba(184, 134, 11, 0.6)',
              fontSize: '15px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              padding: 0,
            }}
            title={autoPlayVoice ? '语音开 (点关)' : '语音关 (点开)'}
          >
            {autoPlayVoice ? '🔊' : '🔈'}
          </button>

          {/* ⭐ 2026-07-28 16:15 压缩：icon-only 声音下拉 */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setVoicePickerOpen(v => !v)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '30px',
                height: '30px',
                borderRadius: '8px',
                background: voicePickerOpen ? 'rgba(184, 134, 11, 0.18)' : 'rgba(184, 134, 11, 0.06)',
                border: '1px solid rgba(184, 134, 11, 0.25)',
                color: 'rgba(184, 134, 11, 0.9)',
                fontSize: '15px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                padding: 0,
              }}
              title={`当前声音: ${MINIMAX_VOICES.find(v => v.id === voiceId)?.label?.replace(' ⭐', '') || '少女'} (点切换)`}
            >
              🎵
            </button>
            {voicePickerOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 4px)',
                  right: 0,
                  background: 'rgba(20, 28, 36, 0.96)',
                  border: '1px solid rgba(184, 134, 11, 0.3)',
                  borderRadius: '10px',
                  padding: '4px',
                  minWidth: '150px',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                  zIndex: 100,
                }}
              >
                {MINIMAX_VOICES.map(v => (
                  <button
                    key={v.id}
                    onClick={() => selectVoice(v.id)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      width: '100%',
                      padding: '7px 10px',
                      background: voiceId === v.id ? 'rgba(184, 134, 11, 0.18)' : 'transparent',
                      border: 'none',
                      borderRadius: '6px',
                      color: voiceId === v.id ? '#b8860b' : 'rgba(255,255,255,0.85)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontSize: '12px',
                    }}
                  >
                    <span style={{ fontWeight: voiceId === v.id ? 600 : 400 }}>{v.label}</span>
                    <span style={{ fontSize: '10px', opacity: 0.6 }}>{v.desc}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Online indicator */}
          <div
            style={{
              fontSize: '11px',
              color: 'rgba(184, 134, 11, 0.65)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              letterSpacing: '0.3px',
            }}
          >
            <div
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#b8860b',
                boxShadow: '0 0 6px rgba(184, 134, 11, 0.8)',
                animation: 'pulse 2s ease-in-out infinite',
              }}
            />
            <style>{`
              @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.4; }
              }
            `}</style>
            24小时在线
          </div>
        </div>
      }
    >
      {/* ⭐ 奕霖 2026-07-06 11:40：高度用 flex:1 而不是 calc(100dvh - 140px)，让 ChatWindow 占满剩余 */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        {/* ⭐ 奕霖 2026-07-06 02:18：移动端友好的独立 Tab Bar（之前漏插了，立刻补上） */}
        <PharmacistTabBar tab={tab} setTab={setTab} />

        {/* ⭐ 2026-08-18 奕霖：拆掉搭配对象切换器（4 选 1 pill 干扰 UI），只保留"📦 订单"独立入口 */}
        {tab === 'chat' && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 12px 0px',
            margin: '0 10px',
            flexShrink: 0,
          }}>
            <button
              onClick={() => router.push('/orders')}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '4px 10px', borderRadius: 14,
                border: '1px solid rgba(184, 134, 11,0.2)',
                background: 'rgba(184, 134, 11,0.06)',
                color: 'rgba(184, 134, 11,0.85)',
                fontSize: 11, fontWeight: 600, cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
              title="我的订单"
            >
              📦 订单
            </button>
          </div>
        )}

        {/* Chat tab — ChatWindow 始终挂着，切 tab 只是隐藏（避免丢 messages 和打断生成） */}
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: tab === 'chat' ? 'flex' : 'none', flexDirection: 'column' }}>
          {/* ⭐ 奕霖 2026-07-06 11:40：banner 已删除（移到 /merchant 和 /ai-find-drug 页面） */}
          {/* Disclaimer banner */}
          <div
            style={{
              padding: '6px 12px',
              background: 'rgba(184, 134, 11, 0.06)',
              border: '1px solid rgba(184, 134, 11, 0.12)',
              borderRadius: '12px',
              fontSize: '11px',
              color: 'rgba(184, 134, 11, 0.65)',
              // ⭐ 奕霖 2026-07-24 03:47：8px → 0px，警告与 NamingRibbon 零间隔贴紧
              margin: '4px 10px 0px',
              display: 'flex', alignItems: 'flex-start', gap: '6px',
              lineHeight: '1.5',
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: '13px', flexShrink: 0 }}>⚠️</span>
            <span>本服务仅供参考，不替代门店建议。食用不适请咨询门店店员或拨打果蔬鲜生热线。</span>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
            <ChatWindow
              chatEndpoint="/api/grocery-chat"
              visible={tab === 'chat'}
              autoPlayVoice={autoPlayVoice}
              onAutoPlayVoiceChange={setAutoPlayVoice}
            />
          </div>
        </div>

        {/* ⭐ 2026-08-18 奕霖：档案 + 口味合并 tab，上下堆叠两个 panel */}
        {tab === 'profile' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px 24px' }}>
            {/* 档案区 — 头像/昵称/手机号/生日 */}
            <div style={{ marginBottom: 16 }}>
              <div style={{
                fontSize: 11, color: 'rgba(184, 134, 11,0.6)',
                fontWeight: 600, letterSpacing: '0.5px', marginBottom: 8, padding: '0 4px',
              }}>📷 档案</div>
              <PharmacistProfilePanel />
            </div>
            {/* 口味区 — 性别/过敏/饮食禁忌/口味 */}
            <div style={{ marginBottom: 16 }}>
              <div style={{
                fontSize: 11, color: 'rgba(184, 134, 11,0.6)',
                fontWeight: 600, letterSpacing: '0.5px', marginBottom: 8, padding: '0 4px',
              }}>🌿 口味 · 喜好</div>
              <PharmacistHealthPanel />
            </div>
          </div>
        )}

        {/* ⭐ 2026-08-18 奕霖：订单 tab — 最近订单 + 取货码 + 跳 /orders */}
        {tab === 'orders' && (
          <PharmacistOrdersPanel />
        )}

        {/* ⭐ 2026-08-25 22:33 奕霖：把 AG-UI tab 改成购物车入口 */}
        {tab === 'cart' && (
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
          }}>
            <div style={{
              background: 'linear-gradient(135deg, rgba(184, 134, 11,0.12) 0%, rgba(45,90,61,0.25) 100%)',
              border: '1px solid rgba(184, 134, 11,0.3)',
              borderRadius: 18, padding: '40px 28px', maxWidth: 380, width: '100%',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>🛒</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#b8860b', marginBottom: 12 }}>
                购物车
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, marginBottom: 24 }}>
                查看已选商品 · 调整数量 · 提交订单拿取货码
              </div>
              <Link href="/cart" style={{
                display: 'inline-block', padding: '12px 24px',
                borderRadius: 12,
                background: 'linear-gradient(135deg, #b8860b, #5cb85c)',
                color: '#0a3018', fontSize: 14, fontWeight: 700,
                textDecoration: 'none',
              }}>
                🛒 去购物车结算 →
              </Link>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}

/* ⭐ 奕霖 2026-07-06：两个独立内联组件（避免文件膨胀） */

// 档案面板：复用 /me 的逻辑（头像/名字/手机/生日 + 4 个 modal）
// ⭐ 奕霖 2026-07-06：移动端友好的 TabBar (4 个 tab 平分宽度)
function PharmacistTabBar({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const [longPressHint, setLongPressHint] = useState<string | null>(null)
  const longPressTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  function startLongPress(hint: string) {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current)
    longPressTimerRef.current = setTimeout(() => setLongPressHint(hint), 500)
  }
  function endLongPress() {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
    setTimeout(() => setLongPressHint(null), 2500)  // 2.5s 后自动隐藏
  }
  return (
    <div style={{
      position: 'relative',
      display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
      // ⭐ 奕霖 2026-07-24 03:25：小屏紧凑（iPhone 13 mini 375 宽不挤）
      gap: 2, padding: '4px 6px 6px',
      background: 'linear-gradient(180deg, rgba(184, 134, 11,0.06) 0%, rgba(184, 134, 11,0.02) 100%)',
      borderBottom: '1px solid rgba(184, 134, 11,0.12)',
      flexShrink: 0,
    }}>
      {TABS.map((t) => {
        const active = tab === t.key
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            onPointerDown={() => false}  /* ⭐ 2026-08-25 22:33：AG-UI→购物车后不再需要长按 tooltip */
            onPointerUp={endLongPress}
            onPointerLeave={endLongPress}
            onPointerCancel={endLongPress}
            title={t.hint}
            style={{
              // ⭐ 奕霖 2026-07-24 03:25：药丸型 active 背景高亮（不只底部边框）
              padding: '7px 4px 6px',
              borderRadius: 12,
              border: 'none',
              background: active
                ? 'linear-gradient(135deg, rgba(184, 134, 11,0.22) 0%, rgba(184, 134, 11,0.1) 100%)'
                : 'transparent',
              borderBottom: active ? '2px solid #b8860b' : '2px solid transparent',
              color: active ? '#a8e6b8' : 'rgba(255,255,255,0.55)',
              fontSize: 11.5,
              fontWeight: active ? 700 : 500,
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              transition: 'all 0.18s ease',
              whiteSpace: 'nowrap',
              userSelect: 'none',
              // ⭐ 奕霖 2026-07-24 03:25：active 状态有 inset 光晕感
              boxShadow: active ? 'inset 0 1px 0 rgba(184, 134, 11,0.2), 0 2px 8px rgba(184, 134, 11,0.15)' : 'none',
            }}
          >
            <span style={{ fontSize: 17, filter: active ? 'drop-shadow(0 0 4px rgba(184, 134, 11,0.5))' : 'none' }}>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        )
      })}

    </div>
  )
}

// ⭐ 奕霖 2026-07-06：档案 tab - 精简"用户画像"面板
function PharmacistProfilePanel() {
  const { user, updateBasic } = useUserStore()
  const [showAvatar, setShowAvatar] = useState(false)
  const [showNickname, setShowNickname] = useState(false)
  const [showPhone, setShowPhone] = useState(false)
  const [showBirthday, setShowBirthday] = useState(false)
  const [editNickname, setEditNickname] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editBirthYear, setEditBirthYear] = useState('')
  const [editBirthMonth, setEditBirthMonth] = useState('')
  const [editBirthDay, setEditBirthDay] = useState('')

  if (!user) {
    return (
      <EmptyPanel
        icon="🔐"
        title="还没登录"
        desc="登录后才能编辑用户档案"
        cta={<Link href="/login" style={CTA}>👉 去登录</Link>}
      />
    )
  }

  // 年份/月份下拉
  const YEARS = Array.from({ length: 116 }, (_, i) => String(2015 - i))
  const MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'))
  const AVATARS = ['🌿','🍵','🍀','🌱','🪷','🌸','🐰','🐱','🐼','🦊','🐶','🐻','🌟','🍃','💚','✨','🍑','🍓','🍒','🥝','🍉','🧁']

  function calcAge(y: string, m: string, d: string): number | null {
    if (!y || !m || !d) return null
    const yy = parseInt(y); const mm = parseInt(m); const dd = parseInt(d)
    if (isNaN(yy) || isNaN(mm) || isNaN(dd)) return null
    if (yy < 1900 || yy > 2015) return null
    const today = new Date()
    const birth = new Date(yy, mm - 1, dd)
    let age = today.getFullYear() - birth.getFullYear()
    const mDelta = today.getMonth() - birth.getMonth()
    if (mDelta < 0 || (mDelta === 0 && today.getDate() < birth.getDate())) age--
    return age >= 0 && age < 150 ? age : null
  }

  function displayAge(): string {
    const b = (user?.profile?.birthday || (user as any)?.birthday) as string | undefined
    if (!b) return '点设生日'
    const bd = new Date(b)
    const today = new Date()
    let age = today.getFullYear() - bd.getFullYear()
    const m = today.getMonth() - bd.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < bd.getDate())) age--
    return `${bd.getFullYear()}/${String(bd.getMonth()+1).padStart(2,'0')}/${String(bd.getDate()).padStart(2,'0')} 🎈 ${age} 周岁`
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px 32px' }}>
      {/* 大用户画像卡片 */}
      <div style={{
        background: 'linear-gradient(135deg, #2c1810 0%, #3a2416 50%, #2c1810 100%)',
        borderRadius: 18, padding: '20px 22px',
        border: '1px solid rgba(184, 134, 11,0.18)',
        boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
      }}>
        {/* 头像 + 名字 + 角色 + 积分 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          <button type="button" onClick={() => setShowAvatar(true)} title="点头像换图" style={{
            width: 64, height: 64, borderRadius: '50%', flexShrink: 0,
            fontSize: 36, cursor: 'pointer',
            background: 'rgba(0,0,0,0.25)', border: '2px solid rgba(184, 134, 11,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative', padding: 0,
          }}>
            {user.avatar || '🌿'}
            <span style={{
              position: 'absolute', bottom: -2, right: -2,
              fontSize: 13, background: '#b8860b', color: '#0a3018',
              width: 20, height: 20, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '2px solid #2c1810',
            }}>✎</span>
          </button>
          <div style={{ flex: 1 }}>
            <button type="button" onClick={() => { setEditNickname(user.nickname || ''); setShowNickname(true) }} style={{
              display: 'block', padding: '2px 0', background: 'transparent', border: 'none',
              textAlign: 'left', color: '#fff', fontSize: 17, fontWeight: 700, cursor: 'pointer', width: '100%',
            }}>
              {user.nickname || '点击设昵称'}<span style={{ fontSize: 10, color: 'rgba(184, 134, 11,0.6)', marginLeft: 6 }}>✎</span>
            </button>
            <div style={{ fontSize: 12, color: 'rgba(184, 134, 11,0.7)', marginTop: 3 }}>
              {user.role || '普通会员'}
              <span style={{
                marginLeft: 8, padding: '2px 8px', borderRadius: 10,
                background: 'rgba(184, 134, 11,0.15)', border: '1px solid rgba(184, 134, 11,0.3)',
                color: '#b8860b', fontWeight: 600,
              }}>⭐ {user.points ?? 0} 分</span>
            </div>
          </div>
        </div>
        {/* 信息行 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Row label="📱 手机号" value={user?.phone?.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') || '点设手机号'} onClick={() => { setEditPhone(user?.phone || ''); setShowPhone(true) }} />
          <Row label="🎂 生日" value={displayAge()} onClick={() => {
            const b = (user?.profile?.birthday || (user as any)?.birthday) as string | undefined
            if (b && /^\d{4}-\d{2}-\d{2}/.test(b)) {
              setEditBirthYear(b.slice(0, 4)); setEditBirthMonth(b.slice(5, 7)); setEditBirthDay(b.slice(8, 10))
            } else { setEditBirthYear(''); setEditBirthMonth(''); setEditBirthDay('') }
            setShowBirthday(true)
          }} />
          <Row label="📅 注册时间" value={user.createdAt ? new Date(user.createdAt).toLocaleDateString('zh-CN') : '-'} />
          <Row label="📆 最后登录" value={user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('zh-CN') : '本次登录'} />
        </div>
      </div>

      {/* Avatar Modal */}
      {showAvatar && <PickerModal title="📷 选个新头像" emojiSet={AVATARS} onPick={async (emo) => { try { await updateBasic({ avatar: emo }); setShowAvatar(false) } catch (e: any) { toast.error(e?.message || '换头像失败') } }} onClose={() => setShowAvatar(false)} />}
      {/* Nickname Modal */}
      {showNickname && (
        <TextInputModal title="✎ 改昵称" placeholder="如何称呼你"
          initialValue={editNickname} maxLength={20}
          onSubmit={async (val) => { try { await updateBasic({ nickname: val }); setShowNickname(false) } catch (e: any) { toast.error(e?.message || '保存失败') } }}
          onClose={() => setShowNickname(false)} />
      )}
      {/* Phone Modal */}
      {showPhone && (
        <TextInputModal title="📱 换绑手机号" placeholder="11 位手机号"
          initialValue={editPhone} maxLength={11}
          pattern={/^1[3-9]\d{9}$/} patternMsg="请输入合法 11 位手机号"
          onSubmit={async (val) => { try { await updateBasic({ phone: val }); setShowPhone(false) } catch (e: any) { toast.error(e?.message || '保存失败') } }}
          onClose={() => setShowPhone(false)} />
      )}
      {/* Birthday Modal */}
      {showBirthday && (
        <BirthdayModal
          year={editBirthYear} month={editBirthMonth} day={editBirthDay}
          years={YEARS} months={MONTHS} calcAge={calcAge}
          setYear={(v) => setEditBirthYear(v)}
          setMonth={(v) => { setEditBirthMonth(v); setEditBirthDay('') }}
          setDay={(v) => setEditBirthDay(v)}
          onSubmit={async () => {
            let birthdayValue: string | null = null
            if (editBirthYear && editBirthMonth && editBirthDay) {
              birthdayValue = `${editBirthYear}-${editBirthMonth}-${editBirthDay}`
            }
            try {
              await updateBasic({ birthday: birthdayValue })
              setShowBirthday(false)
            } catch (e: any) { toast.error(e?.message || '保存失败') }
          }}
          onClose={() => setShowBirthday(false)}
        />
      )}
    </div>
  )
}

// 口味面板：性别/过敏/饮食禁忌/口味（无年龄，生日另算）
function PharmacistHealthPanel() {
  const { user, updateProfile, updatePreferences } = useUserStore()
  const [gender, setGender] = useState<'男' | '女' | '其他' | ''>(
    (user?.profile?.gender as any) || ''
  )
  const [allergy, setAllergy] = useState(user?.profile?.allergy || '')
  const [chronic, setChronic] = useState(user?.profile?.chronicDiseases || '')
  const [taste, setTaste] = useState(((user?.preferences as any)?.taste) || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    setGender((user?.profile?.gender as any) || '')
    setAllergy(user?.profile?.allergy || '')
    setChronic(user?.profile?.chronicDiseases || '')
    setTaste(((user?.preferences as any)?.taste) || '')
  }, [user?.profile, user?.preferences])

  if (!user) {
    return (
      <EmptyPanel
        icon="🔐" title="还没登录"
        desc="登录后才能编辑口味档案"
        cta={<Link href="/login" style={CTA}>👉 去登录</Link>}
      />
    )
  }

  async function save() {
    setSaving(true); setSaved(false); setErr('')
    try {
      await updateProfile({
        gender: (gender || undefined) as any,
        allergy: allergy || undefined,
        chronicDiseases: chronic || undefined,
      })
      await updatePreferences({ taste: taste || undefined } as any)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e: any) {
      setErr(e?.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px 32px' }}>
      <div style={{
        background: 'rgba(184, 134, 11,0.06)',
        border: '1px solid rgba(184, 134, 11,0.18)',
        borderRadius: 14, padding: 16, marginBottom: 16, fontSize: 12,
        color: 'rgba(255,255,255,0.7)', lineHeight: 1.7,
      }}>
        💡 填一次后，<span style={{ color: '#b8860b', fontWeight: 700 }}>造型助手就不用再问这些信息</span>。
        仅用于个性化搭配推荐。
      </div>
      <div style={{
        background: 'rgba(44,24,16,0.3)', borderRadius: 16, padding: 18,
        border: '1px solid rgba(184, 134, 11,0.1)',
      }}>
        <Field label="性别">
          <div style={{ display: 'flex', gap: 8 }}>
            {(['男', '女', '其他'] as const).map((g) => (
              <button key={g} type="button" onClick={() => setGender(g)} style={{
                flex: 1, padding: '10px',
                border: gender === g ? '1.5px solid #b8860b' : '1px solid rgba(184, 134, 11,0.15)',
                background: gender === g ? 'rgba(184, 134, 11,0.15)' : 'rgba(184, 134, 11,0.04)',
                color: gender === g ? '#b8860b' : 'rgba(255,255,255,0.6)',
                borderRadius: 10, fontSize: 13, fontWeight: 600,
                cursor: 'pointer',
              }}>{g}</button>
            ))}
          </div>
        </Field>
        <Field label="过敏史" hint="食物过敏，逗号分隔">
          <textarea value={allergy} onChange={(e) => setAllergy(e.target.value)}
            placeholder="例如：芒果, 菠萝, 花生"
            rows={2}
            style={{
              width: '100%', padding: '12px 14px',
              background: 'rgba(44,24,16,0.5)', border: '1px solid rgba(184, 134, 11,0.2)',
              borderRadius: 10, color: '#fff', fontSize: 14, resize: 'none',
              outline: 'none', fontFamily: 'inherit',
            }} />
        </Field>
        <Field label="饮食禁忌" hint="不能吃/少吃的，逗号分隔">
          <textarea value={chronic} onChange={(e) => setChronic(e.target.value)}
            placeholder="例如：忌辣, 胃敏感少酸, 不爱苦瓜"
            rows={2}
            style={{
              width: '100%', padding: '12px 14px',
              background: 'rgba(44,24,16,0.5)', border: '1px solid rgba(184, 134, 11,0.2)',
              borderRadius: 10, color: '#fff', fontSize: 14, resize: 'none',
              outline: 'none', fontFamily: 'inherit',
            }} />
        </Field>
        <Field label="喜好" hint="水果口味 / 特殊饮食 / 季节偏好，逗号分隔">
          <textarea value={taste} onChange={(e) => setTaste(e.target.value)}
            placeholder="例如：偏甜, 不爱芒果, 老人无糖, 孕妇忌生冷, 夏天爱西瓜"
            rows={2}
            style={{
              width: '100%', padding: '12px 14px',
              background: 'rgba(44,24,16,0.5)', border: '1px solid rgba(184, 134, 11,0.2)',
              borderRadius: 10, color: '#fff', fontSize: 14, resize: 'none',
              outline: 'none', fontFamily: 'inherit',
            }} />
        </Field>
        {err && <div style={{ padding: 10, marginBottom: 12, borderRadius: 8, background: 'rgba(255,107,107,0.12)', color: '#ff9a6b', fontSize: 12 }}>⚠️ {err}</div>}
        <button onClick={save} disabled={saving} style={{
          width: '100%', padding: '14px',
          background: saving ? 'rgba(184, 134, 11,0.3)' : 'linear-gradient(135deg, #b8860b, #b8860b)',
          color: '#2c1810', fontSize: 15, fontWeight: 700,
          border: 'none', borderRadius: 14,
          cursor: saving ? 'wait' : 'pointer',
        }}>
          {saving ? '保存中...' : saved ? '✓ 已保存' : '保存'}
        </button>
        {saved && <div style={{ marginTop: 10, textAlign: 'center', color: '#b8860b', fontSize: 12, fontWeight: 600 }}>风格档案已保存，造型助手下次不会再问这些 🌿</div>}
      </div>
    </div>
  )
}

// ⭐ 奕霖 2026-07-06：共用小组件

// ⭐ 2026-08-18 奕霖：订单 tab — 最近订单 + 取货码 + 跳 /orders
function PharmacistOrdersPanel() {
  const router = useRouter()
  const { user, token } = useUserStore()
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!user) return
    setLoading(true)
    setErr('')
    const phone = user.phone || ''
    fetch(`/api/orders?phone=${encodeURIComponent(phone)}&limit=5`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
      .then((r) => r.json())
      .then((j) => {
        const list = (j?.data?.orders || j?.orders || j?.data || []) as any[]
        setOrders(Array.isArray(list) ? list : [])
      })
      .catch((e) => setErr(e?.message || '加载失败'))
      .finally(() => setLoading(false))
  }, [user?.phone, token])

  if (!user) {
    return (
      <EmptyPanel
        icon="🔐" title="还没登录"
        desc="登录后才能查看订单"
        cta={<Link href="/login" style={CTA}>👉 去登录</Link>}
      />
    )
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px 24px' }}>
      <div style={{
        fontSize: 11, color: 'rgba(184, 134, 11,0.6)', fontWeight: 600,
        letterSpacing: '0.5px', marginBottom: 12, padding: '0 4px',
      }}>📦 最近订单</div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>
          加载中...
        </div>
      )}

      {err && (
        <div style={{ padding: 12, borderRadius: 10, background: 'rgba(255,107,107,0.12)', color: '#ff9a6b', fontSize: 12, marginBottom: 12 }}>
          ⚠️ {err}
        </div>
      )}

      {!loading && !err && orders.length === 0 && (
        <div style={{
          background: 'rgba(184, 134, 11,0.06)',
          border: '1px solid rgba(184, 134, 11,0.15)',
          borderRadius: 14, padding: 24, textAlign: 'center',
          color: 'rgba(255,255,255,0.5)', fontSize: 13,
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🍃</div>
          还没有订单，去 <Link href="/ai-find-drug" style={{ color: '#b8860b', textDecoration: 'underline' }}>挑水果</Link> 试试
        </div>
      )}

      {!loading && orders.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {orders.slice(0, 5).map((o: any) => (
            <div key={o.id || o.orderNo} style={{
              background: 'rgba(44,24,16,0.3)',
              border: '1px solid rgba(184, 134, 11,0.18)',
              borderRadius: 14, padding: '14px 14px 12px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#b8860b' }}>
                  {o.orderNo || o.id?.slice(0, 12) || '订单'}
                </span>
                <span style={{
                  fontSize: 10, padding: '2px 8px', borderRadius: 10,
                  background: o.status === 'delivered' ? 'rgba(184, 134, 11,0.2)' :
                              o.status === 'pending' ? 'rgba(255,154,107,0.2)' : 'rgba(255,255,255,0.1)',
                  color: o.status === 'delivered' ? '#b8860b' :
                         o.status === 'pending' ? '#ff9a6b' : 'rgba(255,255,255,0.6)',
                  fontWeight: 600,
                }}>{o.status === 'delivered' ? '✓ 已取货' : o.status === 'pending' ? '⏳ 待取货' : o.status || '处理中'}</span>
              </div>
              {o.pickupCode && (
                <div style={{
                  background: 'rgba(184, 134, 11,0.08)',
                  border: '1px dashed rgba(184, 134, 11,0.3)',
                  borderRadius: 8, padding: '8px 10px',
                  fontSize: 18, fontWeight: 800, color: '#b8860b',
                  textAlign: 'center', letterSpacing: '2px',
                  fontFamily: 'SF Mono, monospace',
                }}>
                  取货码 {o.pickupCode}
                </div>
              )}
              <div style={{ marginTop: 8, fontSize: 11, color: 'rgba(255,255,255,0.5)', display: 'flex', justifyContent: 'space-between' }}>
                <span>{o.totalAmount ? `¥${(o.totalAmount/100).toFixed(2)}` : ''}</span>
                <span>{o.createdAt ? new Date(o.createdAt).toLocaleDateString('zh-CN') : ''}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => router.push('/orders')}
        style={{
          marginTop: 16, width: '100%', padding: '14px',
          background: 'linear-gradient(135deg, rgba(184, 134, 11,0.15), rgba(45,90,61,0.3))',
          border: '1px solid rgba(184, 134, 11,0.3)',
          color: '#b8860b', fontSize: 14, fontWeight: 700,
          borderRadius: 14, cursor: 'pointer',
        }}
      >
        查看全部订单 →
      </button>
    </div>
  )
}

function Row({ label, value, onClick }: { label: string; value: string; onClick?: () => void }) {
  const interactive = !!onClick
  return (
    <div onClick={onClick} style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      fontSize: 13, cursor: interactive ? 'pointer' : 'default', padding: '4px 0',
    }}>
      <span style={{ color: 'rgba(255,255,255,0.55)' }}>{label}</span>
      <span style={{ color: '#fff', fontWeight: 500 }}>
        {value}{interactive && <span style={{ fontSize: 10, color: 'rgba(184, 134, 11,0.6)', marginLeft: 6 }}>✎</span>}
      </span>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{
        display: 'block', marginBottom: 6,
        fontSize: 12, fontWeight: 600, color: 'rgba(184, 134, 11,0.8)',
      }}>{label}</label>
      {children}
      {hint && <div style={{ marginTop: 4, fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{hint}</div>}
    </div>
  )
}

function EmptyPanel({ icon, title, desc, cta }: { icon: string; title: string; desc: string; cta?: React.ReactNode }) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ textAlign: 'center', maxWidth: 360 }}>
        <div style={{ fontSize: 56, marginBottom: 12 }}>{icon}</div>
        <div style={{ fontSize: 17, fontWeight: 700, color: '#b8860b', marginBottom: 10 }}>{title}</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginBottom: 18, lineHeight: 1.7 }}>{desc}</div>
        {cta}
      </div>
    </div>
  )
}

const CTA: React.CSSProperties = {
  display: 'inline-block', padding: '10px 20px',
  borderRadius: 12, background: 'linear-gradient(135deg, #b8860b, #5cb85c)',
  color: '#0a3018', fontSize: 13, fontWeight: 700,
  textDecoration: 'none',
}

function PickerModal({ title, emojiSet, onPick, onClose }: {
  title: string; emojiSet: string[]; onPick: (emo: string) => void; onClose: () => void
}) {
  return (
    <ModalShell title={title} onClose={onClose}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, padding: '4px 0' }}>
        {emojiSet.map((emo) => (
          <button key={emo} type="button" onClick={() => onPick(emo)} style={{
            aspectRatio: '1', borderRadius: 10, fontSize: 24,
            background: 'rgba(0,0,0,0.25)',
            border: '1px solid rgba(184, 134, 11,0.18)',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{emo}</button>
        ))}
      </div>
    </ModalShell>
  )
}

function TextInputModal({ title, placeholder, initialValue, maxLength, pattern, patternMsg, onSubmit, onClose }: {
  title: string; placeholder: string; initialValue: string; maxLength: number;
  pattern?: RegExp; patternMsg?: string;
  onSubmit: (val: string) => void | Promise<void>; onClose: () => void
}) {
  const [val, setVal] = useState(initialValue)
  const valid = !pattern || pattern.test(val)
  return (
    <ModalShell title={title} onClose={onClose}>
      <textarea autoFocus value={val} onChange={(e) => setVal(e.target.value)}
        placeholder={placeholder} maxLength={maxLength} rows={1}
        style={{
          width: '100%', minHeight: 44, maxHeight: 140, padding: '12px 14px', borderRadius: 10,
          border: '1px solid rgba(184, 134, 11,0.3)', background: 'rgba(0,0,0,0.3)',
          color: '#fff', fontSize: 16, fontFamily: 'inherit', outline: 'none',
          marginBottom: 6, resize: 'none',
        }} />
      {pattern && val && !valid && (
        <div style={{ fontSize: 11, color: '#ff9a6b', marginBottom: 10 }}>⚠️ {patternMsg}</div>
      )}
      <button disabled={!val.trim() || !valid} onClick={() => onSubmit(val.trim())} style={{
        width: '100%', padding: '12px', borderRadius: 12,
        background: !val.trim() || !valid ? 'rgba(184, 134, 11,0.2)' : 'linear-gradient(135deg, #b8860b, #5cb85c)',
        color: !val.trim() || !valid ? 'rgba(10,48,24,0.5)' : '#0a3018',
        border: 'none', fontSize: 15, fontWeight: 700,
        cursor: !val.trim() || !valid ? 'not-allowed' : 'pointer',
      }}>保存</button>
    </ModalShell>
  )
}

function BirthdayModal({ year, month, day, years, months, calcAge, setYear, setMonth, setDay, onSubmit, onClose }: {
  year: string; month: string; day: string;
  years: string[]; months: string[];
  calcAge: (y: string, m: string, d: string) => number | null;
  setYear: (v: string) => void; setMonth: (v: string) => void; setDay: (v: string) => void;
  onSubmit: () => void; onClose: () => void
}) {
  const age = calcAge(year, month, day)
  const daysInMonth = (!year || !month) ? 31 : new Date(parseInt(year), parseInt(month), 0).getDate()
  return (
    <ModalShell title="🎂 设生日" onClose={onClose}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
        <select value={year} onChange={(e) => setYear(e.target.value)} style={selectStyle}>
          <option value="">年</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={month} onChange={(e) => setMonth(e.target.value)} style={selectStyle}>
          <option value="">月</option>
          {months.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={day} onChange={(e) => setDay(e.target.value)} style={selectStyle}>
          <option value="">日</option>
          {Array.from({ length: daysInMonth }, (_, i) => String(i + 1).padStart(2, '0')).map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>
      <div style={{ textAlign: 'center', fontSize: 13, color: 'rgba(184, 134, 11,0.7)', marginBottom: 12 }}>
        {age !== null ? `年龄：${age} 周岁` : '⚠️ 请填完整 年/月/日'}
      </div>
      <button disabled={!year || !month || !day} onClick={onSubmit} style={{
        width: '100%', padding: '12px', borderRadius: 12,
        background: !year || !month || !day ? 'rgba(184, 134, 11,0.2)' : 'linear-gradient(135deg, #b8860b, #5cb85c)',
        color: !year || !month || !day ? 'rgba(10,48,24,0.5)' : '#0a3018',
        border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer',
      }}>保存</button>
    </ModalShell>
  )
}

function ModalShell({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 999,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
      display: 'flex', justifyContent: 'center', padding: 16,
      // ⭐ 修复确认键被挡住：flex-start 配合安全区，输入法弹起时按钮也可见
      alignItems: 'flex-start',
      paddingTop: 'max(60px, calc(env(safe-area-inset-top, 0px) + 60px))',
      overflowY: 'auto',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: 'linear-gradient(180deg, #2c1810 0%, #1a0e08 100%)',
        borderRadius: 18, padding: '20px 18px', width: '100%', maxWidth: 380,
        // ⭐ 修复确认键被挡住：maxHeight 限制 + overflow 滚动
        maxHeight: 'calc(100dvh - 80px)',
        overflowY: 'auto',
        border: '1px solid rgba(184, 134, 11,0.3)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        // ⭐ iOS Safari 安全区
        paddingBottom: 'max(20px, env(safe-area-inset-bottom, 20px))',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#b8860b' }}>{title}</div>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)',
            fontSize: 24, cursor: 'pointer', padding: '4px 8px', lineHeight: 1,
            minWidth: 44, minHeight: 44, // ⭐ 触摸目标≥44px
          }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

const selectStyle: React.CSSProperties = {
  padding: '10px 6px', borderRadius: 10, cursor: 'pointer',
  border: '1px solid rgba(184, 134, 11,0.3)', background: 'rgba(0,0,0,0.3)',
  color: 'rgba(255,255,255,0.85)', fontSize: 14, fontFamily: 'inherit',
  colorScheme: 'dark',
}