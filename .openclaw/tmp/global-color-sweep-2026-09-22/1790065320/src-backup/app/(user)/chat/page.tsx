'use client'

import React, { useRef, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import AppLayout from '@/components/AppLayout'
import ChatWindow, { Subject, SUBJECT_LABELS } from '@/components/ChatWindow'
import { emitVoiceStopAll, setUseWebSpeechMode, isWebSpeechMode } from '@/lib/speech'
import { toast } from '@/lib/ui-bus'
import { BUSINESS_CONFIG } from '@/config/business.config'
import { useUserStore } from '@/stores/userStore'
import OrderCard from '@/components/OrderCard'
import { OrderCardData } from '@/domain/chat/service'
import { getCart, saveCart, removeFromCart, updateCartQty, clearCart, getCartTotal, CartItem } from '@/lib/cart'

type Tab = 'chat' | 'profile' | 'orders' | 'cart'
const TABS: Array<{ key: Tab; icon: string; label: string; hint: string }> = [
  { key: 'chat',    icon: '💬', label: '对话',  hint: '问诊咨询' },
  { key: 'profile', icon: '👤', label: '档案',  hint: '头像/昵称/手机/生日/健康' },
  { key: 'orders',  icon: '📋', label: '订单',  hint: '我的订单' },
  { key: 'cart',    icon: '🛒', label: '购物车', hint: '已选商品 + 提交订单' },
]

export default function PharmacistPage() {
  const router = useRouter()
  const [autoPlayVoice, setAutoPlayVoice] = useState(true)
  // ⭐ 奕霖 2026-08-25 23:50「不用跳转,直接有一个窗口」:购物车 tab 内嵌视图,不跳 /cart
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [cartMounted, setCartMounted] = useState(false)

  useEffect(() => {
    setCartItems(getCart())
    setCartMounted(true)
    const onUpdate = () => setCartItems(getCart())
    window.addEventListener('cart-updated', onUpdate)
    window.addEventListener('storage', onUpdate)
    return () => {
      window.removeEventListener('cart-updated', onUpdate)
      window.removeEventListener('storage', onUpdate)
    }
  }, [])

  const refreshCart = () => setCartItems(getCart())
  // ⭐ 2026-07-28 16:13 奕霖反馈 (16:11): chengshu + pitch -2 听起来妩媚气短
  // 换 shaonv 少女豆包姐姐风 + pitch +2 开朗明亮 (speed 1.2 保留)
  // ⭐ 2026-07-28 15:42 奕霖关掉 Web Speech: 引擎永远是 minimax, 不再切换
  const MINIMAX_VOICES = [
    { id: 'female-shaonv', label: '少女 ⭐', desc: '豆包姐姐风 (默认)' },
    { id: 'female-tianmei', label: '甜美', desc: '温柔亲切' },
    { id: 'female-chengshu', label: '成熟', desc: '药店阿姨感' },
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
  // ⭐ 奕霖 2026-07-06 12:42：问诊对象上提为页面级 state，让切换器插到 TabBar 下边
  const [subject, setSubject] = useState<Subject>(() => {
    if (typeof window === 'undefined') return 'self'
    return ((window.localStorage.getItem('zhixia_subject') as Subject) || 'self')
  })
  const switchSubject = (s: Subject) => {
    if (s === subject) return
    setSubject(s)
    if (typeof window !== 'undefined') window.localStorage.setItem('zhixia_subject', s)
  }
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

  // ⭐ 奕霖 2026-07-06：进入档案/订单 tab 时拉一次最新用户数据（订单要看 user.phone）
  useEffect(() => {
    if (tab === 'profile' || tab === 'orders') {
      if (token) refreshUser()
    }
  }, [tab, token, refreshUser])

  return (
    <AppLayout
      title="果小蔬"
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

        {/* ⭐ 奕霖 2026-07-06 12:42：问诊对象切换器移到 TabBar 下方（原 ChatWindow 内） */}
        {/* ⭐ 2026-08-25 奕霖反馈：去掉 actions 里的订单按键（订单由 tab 进入） */}
        {tab === 'chat' && (
          <SubjectSwitcher
            subject={subject}
            onChange={switchSubject}
          />
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
            <span>本服务仅供参考，不替代专业医疗建议。如有不适请及时就医或咨询专业医师。</span>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
            <ChatWindow
              visible={tab === 'chat'}
              autoPlayVoice={autoPlayVoice}
              onAutoPlayVoiceChange={setAutoPlayVoice}
              subject={subject}
              onSubjectChange={switchSubject}
            />
          </div>
        </div>

        {/* ⭐ 2026-08-25 奕霖反馈：档案 tab 吞健康内容（profile + health 合并） */}
        {tab === 'profile' && (
          <>
            <PharmacistProfilePanel />
            <PharmacistHealthPanel />
          </>
        )}

        {/* ⭐ 2026-08-25 奕霖反馈：订单 tab 占原健康位置 */}
        {tab === 'orders' && (
          <PharmacistOrdersPanel />
        )}

        {/* ⭐ 奕霖 2026-08-25 23:50：购物车 tab - 内嵌视图,不跳转 /cart */}
        {tab === 'cart' && (
          <CartInlineView
            items={cartItems}
            mounted={cartMounted}
            onUpdate={refreshCart}
            onCheckout={() => router.push('/cart')}
          />
        )}
      </div>
    </AppLayout>
  )
}

/* ⭐ 奕霖 2026-07-06：两个独立内联组件（避免文件膨胀） */

// 档案面板：复用 /me 的逻辑（头像/名字/手机/生日 + 4 个 modal）
// ⭐ 奕霖 2026-07-06：移动端友好的 TabBar (4 个 tab 平分宽度)
function PharmacistTabBar({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  // ⭐ 奕霖 2026-07-06 13:37：AG-UI tab 长按显示功能说明（普通用户不懂怎么用）
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
            onPointerDown={() => false}  /* ⭐ 2026-08-25：AG-UI→购物车,不再需要长按 tooltip */
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

// ⭐ 奕霖 2026-07-06 12:42：问诊对象切换器，紧贴 TabBar 下沿
// 2026-07-15 00:15：奕霖要求 “按键大小统一并缩小一点” → actions 槽位可以插进同一行
function SubjectSwitcher({ subject, onChange, actions }: { subject: Subject; onChange: (s: Subject) => void; actions?: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '4px 10px', borderRadius: 12,
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(184, 134, 11,0.18)',
      margin: '4px 10px 4px',
      flexShrink: 0, flexWrap: 'wrap',
    }}>
      {actions && <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>{actions}</span>}
    </div>
  )
}

function PharmacistProfilePanel() {
  const { user, updateBasic } = useUserStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [editing, setEditing] = useState<null | 'nickname' | 'phone' | 'birthday'>(null)
  const [draftNick, setDraftNick] = useState('')
  const [draftPhone, setDraftPhone] = useState('')
  const [draftBirth, setDraftBirth] = useState('')

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

  // 24 个 emoji 头像(果蔬/动物/自然)
  const AVATARS = ['🌿','🍵','🍀','🌱','🪷','🌸','🐰','🐱','🐼','🦊','🐶','🐻','💚','🌟','🍃','✨','🍑','🍓','🍒','🥝','🍉','🧁','🌻','🌼']

  const startEdit = (field: 'nickname' | 'phone' | 'birthday') => {
    setEditing(field)
    if (field === 'nickname') setDraftNick(user.nickname || '')
    if (field === 'phone') setDraftPhone(user.phone || '')
    if (field === 'birthday') {
      const b = (user?.profile?.birthday || (user as any)?.birthday) as string | undefined
      setDraftBirth(b ? b.slice(0, 10) : '')
    }
  }
  const cancelEdit = () => setEditing(null)

  const saveField = async (field: 'nickname' | 'phone' | 'birthday') => {
    try {
      const payload: any = {}
      if (field === 'nickname') {
        if (!draftNick.trim()) { toast.error('昵称不能为空'); return }
        if (draftNick.length > 20) { toast.error('昵称最长 20 字'); return }
        payload.nickname = draftNick.trim()
      }
      if (field === 'phone') {
        if (!/^1[3-9]\d{9}$/.test(draftPhone)) { toast.error('手机号格式不对'); return }
        payload.phone = draftPhone
      }
      if (field === 'birthday') {
        payload.birthday = draftBirth || null
      }
      await updateBasic(payload)
      toast.success('已保存 🌿')
      setEditing(null)
    } catch (e: any) {
      toast.error(e?.message || '保存失败')
    }
  }

  const displayAge = (b?: string): string => {
    if (!b) return '未设置'
    const bd = new Date(b)
    if (isNaN(bd.getTime())) return '未设置'
    const today = new Date()
    let age = today.getFullYear() - bd.getFullYear()
    const m = today.getMonth() - bd.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < bd.getDate())) age--
    return `${bd.getFullYear()}/${String(bd.getMonth()+1).padStart(2,'0')}/${String(bd.getDate()).padStart(2,'0')} · ${age} 周岁`
  }

  // 头像选择(emoji 网格 + 文件上传)
  const [showAvatarPicker, setShowAvatarPicker] = useState(false)
  const chooseEmojiAvatar = async (emo: string) => {
    try { await updateBasic({ avatar: emo }); toast.success('头像已更换'); setShowAvatarPicker(false) } catch (e: any) { toast.error(e?.message || '换头像失败') }
  }
  const uploadAvatar = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) { toast.error('图片超过 2MB'); return }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('avatar', file)
      if (user?.phone) fd.append('phone', user.phone)
      const res = await fetch('/api/avatar/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || '上传失败')
      await updateBasic({ avatar: data.url })
      toast.success('头像已上传 📷')
      setShowAvatarPicker(false)
    } catch (e: any) {
      toast.error(e?.message || '上传失败')
    } finally {
      setUploading(false)
    }
  }

  const isEmojiAvatar = !user.avatar || user.avatar.startsWith('data:') === false && !user.avatar.startsWith('/uploads/')

  // 统一卡片样式(深绿渐变 + 圆角 18 + 阴影)
  const cardStyle: React.CSSProperties = {
    background: 'linear-gradient(135deg, #1a3a2a 0%, #234a35 50%, #1a3a2a 100%)',
    borderRadius: 18, padding: '18px 20px', marginBottom: 14,
    border: '1px solid rgba(184, 134, 11,0.18)',
    boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
  }

  const fieldLabelStyle: React.CSSProperties = {
    fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 6,
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 32px' }}>
      {/* 大用户画像卡片 */}
      <div style={cardStyle}>
        {/* 头像 + 名字 + 角色 + 积分 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
          <button type="button" onClick={() => setShowAvatarPicker((v) => !v)} title="点头像换图 / 上传" style={{
            width: 68, height: 68, borderRadius: '50%', flexShrink: 0,
            cursor: 'pointer',
            background: 'rgba(0,0,0,0.25)', border: '2px solid rgba(184, 134, 11,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative', padding: 0, overflow: 'hidden',
          }}>
            {isEmojiAvatar ? (
              <span style={{ fontSize: 38 }}>{user.avatar || '🌿'}</span>
            ) : (
              <img src={user.avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="avatar" />
            )}
            <span style={{
              position: 'absolute', bottom: -2, right: -2,
              fontSize: 12, background: '#b8860b', color: '#0a3018',
              width: 22, height: 22, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '2px solid #1a3a2a',
            }}>✎</span>
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', cursor: 'pointer' }} onClick={() => startEdit('nickname')}>
              {user.nickname || '点设昵称'}<span style={{ fontSize: 10, color: 'rgba(184, 134, 11,0.6)', marginLeft: 6 }}>✎</span>
            </div>
            <div style={{ fontSize: 12, color: 'rgba(184, 134, 11,0.7)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>{user.role || '普通会员'}</span>
              <span style={{
                padding: '2px 8px', borderRadius: 10,
                background: 'rgba(184, 134, 11,0.15)', border: '1px solid rgba(184, 134, 11,0.3)',
                color: '#b8860b', fontWeight: 600,
              }}>⭐ {user.points ?? 0} 分</span>
            </div>
          </div>
        </div>

        {/* 头像选择器(展开) */}
        {showAvatarPicker && (
          <div style={{ marginBottom: 16, padding: 12, background: 'rgba(0,0,0,0.3)', borderRadius: 12 }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 10 }}>选个 emoji 头像 · 或上传真图:</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 6, marginBottom: 10 }}>
              {AVATARS.map((emo) => (
                <button key={emo} type="button" onClick={() => chooseEmojiAvatar(emo)} style={{
                  fontSize: 22, padding: 4, background: 'transparent', border: 'none',
                  cursor: 'pointer', borderRadius: 6,
                }}>{emo}</button>
              ))}
            </div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); e.target.value = '' }} />
            <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()} style={{
              width: '100%', padding: '8px',
              background: uploading ? 'rgba(184, 134, 11,0.2)' : 'rgba(184, 134, 11,0.15)',
              border: '1px dashed rgba(184, 134, 11,0.4)',
              color: '#b8860b', fontSize: 12, borderRadius: 8,
              cursor: uploading ? 'wait' : 'pointer',
            }}>{uploading ? '上传中...' : '📷 从相册选真图 (≤2MB)'}</button>
          </div>
        )}

        {/* 字段(inline 编辑) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* 昵称(inline 编辑) */}
          <div>
            <div style={fieldLabelStyle}>👤 昵称</div>
            {editing === 'nickname' ? (
              <div style={{ display: 'flex', gap: 6 }}>
                <input autoFocus value={draftNick} onChange={(e) => setDraftNick(e.target.value)}
                  maxLength={20} placeholder="如何称呼你"
                  onKeyDown={(e) => { if (e.key === 'Enter') saveField('nickname'); if (e.key === 'Escape') cancelEdit() }}
                  style={{
                    flex: 1, padding: '8px 12px',
                    background: 'rgba(10,20,15,0.5)', border: '1px solid rgba(184, 134, 11,0.3)',
                    borderRadius: 8, color: '#fff', fontSize: 14, outline: 'none',
                  }} />
                <button onClick={() => saveField('nickname')} style={{
                  padding: '8px 14px', background: '#b8860b', color: '#0a1f17',
                  border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}>✓</button>
                <button onClick={cancelEdit} style={{
                  padding: '8px 14px', background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.6)',
                  borderRadius: 8, fontSize: 12, cursor: 'pointer',
                }}>✕</button>
              </div>
            ) : (
              <div style={{ fontSize: 14, color: '#fff', cursor: 'pointer' }} onClick={() => startEdit('nickname')}>
                {user.nickname || <span style={{ color: 'rgba(184, 134, 11,0.6)' }}>+ 点设昵称</span>}
              </div>
            )}
          </div>

          {/* 手机号(inline 编辑) */}
          <div>
            <div style={fieldLabelStyle}>📱 手机号</div>
            {editing === 'phone' ? (
              <div style={{ display: 'flex', gap: 6 }}>
                <input autoFocus value={draftPhone} onChange={(e) => setDraftPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  placeholder="11 位手机号"
                  onKeyDown={(e) => { if (e.key === 'Enter') saveField('phone'); if (e.key === 'Escape') cancelEdit() }}
                  style={{
                    flex: 1, padding: '8px 12px',
                    background: 'rgba(10,20,15,0.5)', border: '1px solid rgba(184, 134, 11,0.3)',
                    borderRadius: 8, color: '#fff', fontSize: 14, outline: 'none',
                  }} />
                <button onClick={() => saveField('phone')} style={{
                  padding: '8px 14px', background: '#b8860b', color: '#0a1f17',
                  border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}>✓</button>
                <button onClick={cancelEdit} style={{
                  padding: '8px 14px', background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.6)',
                  borderRadius: 8, fontSize: 12, cursor: 'pointer',
                }}>✕</button>
              </div>
            ) : (
              <div style={{ fontSize: 14, color: '#fff', cursor: 'pointer' }} onClick={() => startEdit('phone')}>
                {user.phone ? user.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : <span style={{ color: 'rgba(184, 134, 11,0.6)' }}>+ 点设手机号</span>}
              </div>
            )}
          </div>

          {/* 生日(简化:一个原生 date input,无 116 年下拉) */}
          <div>
            <div style={fieldLabelStyle}>🎂 生日</div>
            {editing === 'birthday' ? (
              <div style={{ display: 'flex', gap: 6 }}>
                <input autoFocus type="date" value={draftBirth} onChange={(e) => setDraftBirth(e.target.value)}
                  max="2015-12-31" min="1900-01-01"
                  onKeyDown={(e) => { if (e.key === 'Enter') saveField('birthday'); if (e.key === 'Escape') cancelEdit() }}
                  style={{
                    flex: 1, padding: '8px 12px',
                    background: 'rgba(10,20,15,0.5)', border: '1px solid rgba(184, 134, 11,0.3)',
                    borderRadius: 8, color: '#fff', fontSize: 14, outline: 'none',
                    colorScheme: 'dark',
                  }} />
                <button onClick={() => saveField('birthday')} style={{
                  padding: '8px 14px', background: '#b8860b', color: '#0a1f17',
                  border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}>✓</button>
                <button onClick={cancelEdit} style={{
                  padding: '8px 14px', background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.6)',
                  borderRadius: 8, fontSize: 12, cursor: 'pointer',
                }}>✕</button>
              </div>
            ) : (
              <div style={{ fontSize: 14, color: '#fff', cursor: 'pointer' }} onClick={() => startEdit('birthday')}>
                {displayAge((user?.profile?.birthday || (user as any)?.birthday) as string | undefined)}
              </div>
            )}
          </div>

          {/* 注册时间 + 最后登录(只读) */}
          <div style={{ display: 'flex', gap: 14, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
            <span>📅 注册 {user.createdAt ? new Date(user.createdAt).toLocaleDateString('zh-CN') : '-'}</span>
            <span>📆 登录 {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString('zh-CN') : '本次'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function PharmacistHealthPanel() {
  const { user, updateProfile } = useUserStore()
  const [gender, setGender] = useState<'男' | '女' | '其他' | ''>(
    (user?.profile?.gender as any) || ''
  )
  const [allergy, setAllergy] = useState(user?.profile?.allergy || '')
  const [chronic, setChronic] = useState(user?.profile?.chronicDiseases || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    setGender((user?.profile?.gender as any) || '')
    setAllergy(user?.profile?.allergy || '')
    setChronic(user?.profile?.chronicDiseases || '')
  }, [user?.profile])

  if (!user) {
    return (
      <EmptyPanel
        icon="🔐" title="还没登录"
        desc="登录后才能编辑健康画像"
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
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e: any) {
      setErr(e?.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  // 统一卡片样式(跟 ProfilePanel 完全一致)
  const cardStyle: React.CSSProperties = {
    background: 'linear-gradient(135deg, #1a3a2a 0%, #234a35 50%, #1a3a2a 100%)',
    borderRadius: 18, padding: '18px 20px',
    border: '1px solid rgba(184, 134, 11,0.18)',
    boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
  }

  const fieldLabelStyle: React.CSSProperties = {
    fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 6,
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 32px' }}>
      {/* 健康画像卡片(同款渐变风格) */}
      <div style={cardStyle}>
        <div style={{
          marginBottom: 14, padding: '10px 12px',
          background: 'rgba(184, 134, 11,0.08)', borderRadius: 10,
          border: '1px solid rgba(184, 134, 11,0.15)',
          fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.7,
        }}>
          💡 填一次后，<span style={{ color: '#b8860b', fontWeight: 700 }}>果小蔬就不用再问</span>这些基础信息。
        </div>

        {/* 性别 */}
        <div style={{ marginBottom: 14 }}>
          <div style={fieldLabelStyle}>⚧ 性别</div>
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
        </div>

        {/* 过敏史 */}
        <div style={{ marginBottom: 14 }}>
          <div style={fieldLabelStyle}>🤧 过敏史 <span style={{ color: 'rgba(255,255,255,0.4)' }}>(逗号分隔)</span></div>
          <textarea value={allergy} onChange={(e) => setAllergy(e.target.value)}
            placeholder="例如:青霉素, 海鲜, 花粉"
            rows={2}
            style={{
              width: '100%', padding: '10px 12px',
              background: 'rgba(10,20,15,0.5)', border: '1px solid rgba(184, 134, 11,0.2)',
              borderRadius: 10, color: '#fff', fontSize: 14, resize: 'none',
              outline: 'none', fontFamily: 'inherit',
            }} />
        </div>

        {/* 慢性病 */}
        <div style={{ marginBottom: 14 }}>
          <div style={fieldLabelStyle}>💊 慢性病 <span style={{ color: 'rgba(255,255,255,0.4)' }}>(逗号分隔)</span></div>
          <textarea value={chronic} onChange={(e) => setChronic(e.target.value)}
            placeholder="例如:胃炎, 鼻炎, 体质虚弱"
            rows={2}
            style={{
              width: '100%', padding: '10px 12px',
              background: 'rgba(10,20,15,0.5)', border: '1px solid rgba(184, 134, 11,0.2)',
              borderRadius: 10, color: '#fff', fontSize: 14, resize: 'none',
              outline: 'none', fontFamily: 'inherit',
            }} />
        </div>

        {err && <div style={{ padding: 10, marginBottom: 12, borderRadius: 8, background: 'rgba(255,107,107,0.12)', color: '#ff9a6b', fontSize: 12 }}>⚠️ {err}</div>}
        <button onClick={save} disabled={saving} style={{
          width: '100%', padding: '14px',
          background: saving ? 'rgba(184, 134, 11,0.3)' : 'linear-gradient(135deg, #b8860b, #b8860b)',
          color: '#0d1f17', fontSize: 15, fontWeight: 700,
          border: 'none', borderRadius: 14,
          cursor: saving ? 'wait' : 'pointer',
        }}>
          {saving ? '保存中...' : saved ? '✓ 已保存' : '保存'}
        </button>
      </div>
    </div>
  )
}

// ⭐ 奕霖 2026-07-06：共用小组件

function PharmacistOrdersPanel() {
  const { user } = useUserStore()
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!user?.phone) return
    setLoading(true)
    setErr('')
    fetch(`/api/orders?phone=${encodeURIComponent(user.phone)}&merchantCode=G0001&limit=50`)
      .then(async (r) => {
        const d = await r.json()
        if (d.success) setOrders(d.data?.orders || d.orders || [])
        else setErr(d.error || '加载失败')
      })
      .catch((e) => setErr(String(e?.message || e)))
      .finally(() => setLoading(false))
  }, [user?.phone])

  if (!user) {
    return (
      <EmptyPanel
        icon="🔐"
        title="还没登录"
        desc="登录后才能查看订单"
        cta={<Link href="/login" style={CTA}>👉 去登录</Link>}
      />
    )
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px 32px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        marginBottom: 16, padding: '0 4px',
      }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#b8860b' }}>📋 我的订单</span>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
          {loading ? '加载中...' : orders.length > 0 ? `共 ${orders.length} 单` : ''}
        </span>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 24, color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
          ⏳ 加载中...
        </div>
      )}

      {!loading && err && (
        <div style={{ padding: 12, borderRadius: 8, background: 'rgba(255,107,107,0.12)', color: '#ff9a6b', fontSize: 12 }}>
          ⚠️ {err}
        </div>
      )}

      {!loading && !err && orders.length === 0 && (
        <EmptyPanel
          icon="📋"
          title="暂无订单"
          desc="下单后会在这里显示"
          cta={null}
        />
      )}

      {!loading && orders.map((o) => (
        <OrderCard key={o.id} data={{
          type: 'order',
          orderId: o.id,
          orderNo: o.orderNo,
          status: o.status || 'pending',
          statusLabel: o.status || 'pending',
          pickupCode: o.pickupCode,
          pickupExpiresAt: o.pickupExpiresAt,
          finalAmount: o.finalAmount ?? o.totalAmount ?? 0,
          itemCount: 0,
          itemSummary: '',
          createdAt: o.createdAt,
        }} />
      ))}
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
        background: 'linear-gradient(180deg, #1a3a2a 0%, #0f1f18 100%)',
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
// ⭐ 奕霖 2026-08-25 23:50：购物车 tab - 内嵌视图,不跳 /cart
function CartInlineView({
  items, mounted, onUpdate, onCheckout,
}: {
  items: CartItem[]
  mounted: boolean
  onUpdate: () => void
  onCheckout: () => void
}) {
  if (!mounted) {
    return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.5)' }}>加载中…</div>
  }

  const total = items.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.quantity) || 0), 0)
  const count = items.reduce((s, it) => s + (Number(it.quantity) || 0), 0)

  const handleInc = (productId: string, spec: string | undefined) => {
    updateCartQty(productId, spec, 1)
    window.dispatchEvent(new CustomEvent('cart-updated'))
    onUpdate()
  }
  const handleDec = (productId: string, spec: string | undefined) => {
    updateCartQty(productId, spec, -1)
    window.dispatchEvent(new CustomEvent('cart-updated'))
    onUpdate()
  }
  const handleRemove = (productId: string, spec: string | undefined) => {
    removeFromCart(productId, spec)
    window.dispatchEvent(new CustomEvent('cart-updated'))
    onUpdate()
  }
  const handleClear = () => {
    if (confirm('确定清空购物车吗?')) {
      clearCart()
      window.dispatchEvent(new CustomEvent('cart-updated'))
      onUpdate()
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* 顶栏 */}
      <div style={{
        padding: '14px 16px',
        background: 'rgba(184, 134, 11,0.08)',
        borderBottom: '1px solid rgba(184, 134, 11,0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#b8860b' }}>🛒 我的购物车</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
            共 {count} 件 · 合计 ¥{total.toFixed(2)}
          </div>
        </div>
        {items.length > 0 && (
          <button onClick={handleClear} style={{
            background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
            color: 'rgba(255,255,255,0.6)', fontSize: 11, padding: '4px 10px',
            borderRadius: 12, cursor: 'pointer',
          }}>清空</button>
        )}
      </div>

      {/* 商品列表 */}
      {items.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', padding: 20 }}>
          <div style={{ fontSize: 56, opacity: 0.4 }}>🛒</div>
          <div style={{ marginTop: 14, fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>购物车空空如也</div>
          <div style={{ marginTop: 6, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>对话中加购的商品会出现在这里</div>
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
          {items.map((it, idx) => (
            <div key={`${it.productId}-${it.spec || ''}-${idx}`} style={{
              display: 'flex', gap: 10, padding: '10px 0',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{
                width: 64, height: 64, borderRadius: 10, flexShrink: 0,
                background: 'rgba(184, 134, 11,0.08)',
                overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {it.image ? (
                  <img src={it.image} style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                       onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                ) : (
                  <div style={{ fontSize: 32 }}>{(it.name || '📦').match(/[\u{1F300}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}]/u)?.[0] || '📦'}</div>
                )}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.92)' }}>
                  {it.name || '该商品已下架'}
                </div>
                {it.spec && (
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{it.spec}</div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#b8860b' }}>
                    ¥{Number(it.price || 0).toFixed(2)}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button onClick={() => handleDec(it.productId, it.spec)} style={{
                      width: 24, height: 24, borderRadius: 12,
                      background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                      color: '#fff', fontSize: 14, cursor: 'pointer', lineHeight: 1,
                    }}>−</button>
                    <span style={{ minWidth: 24, textAlign: 'center', fontSize: 13, fontWeight: 600 }}>
                      {it.quantity}
                    </span>
                    <button onClick={() => handleInc(it.productId, it.spec)} style={{
                      width: 24, height: 24, borderRadius: 12,
                      background: 'rgba(184, 134, 11,0.2)', border: '1px solid rgba(184, 134, 11,0.4)',
                      color: '#b8860b', fontSize: 14, cursor: 'pointer', lineHeight: 1,
                    }}>+</button>
                  </div>
                </div>
              </div>

              <button onClick={() => handleRemove(it.productId, it.spec)} style={{
                background: 'transparent', border: 'none',
                color: 'rgba(255,255,255,0.4)', fontSize: 18, cursor: 'pointer',
                alignSelf: 'flex-start', padding: 0,
              }}>×</button>
            </div>
          ))}
        </div>
      )}

      {/* 底部结算 */}
      {items.length > 0 && (
        <div style={{
          padding: '12px 16px calc(12px + env(safe-area-inset-bottom, 0px))',
          background: 'rgba(8, 16, 12, 0.95)',
          borderTop: '1px solid rgba(184, 134, 11,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>合计</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#b8860b' }}>¥{total.toFixed(2)}</div>
          </div>
          <button onClick={onCheckout} style={{
            background: 'linear-gradient(135deg, #b8860b, #b8860b)',
            color: '#0a1f17', fontSize: 14, fontWeight: 700,
            padding: '10px 24px', borderRadius: 22, border: 'none', cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(184, 134, 11,0.4)',
          }}>
            去结算 ({count})
          </button>
        </div>
      )}
    </div>
  )
}
