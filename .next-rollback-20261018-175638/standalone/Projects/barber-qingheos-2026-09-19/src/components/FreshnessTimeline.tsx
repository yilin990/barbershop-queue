/**
 * ⭐ MEMORY 244 — 新鲜度时间线 v6
 * - 早点/中点/晚点（不是班）
 * - 点击图片 → bottom sheet（不是全屏 lightbox，优雅不突兀）
 * - 备注折叠（默认 1 行展示）
 * - 评论折叠（默认显示 2 条 + 「查看全部」）
 * - 写评价需登录（未登录显示引导）
 */
'use client'
import { useEffect, useState, useMemo } from 'react'
import { useUserStore } from '@/stores/userStore'
import { useRouter } from 'next/navigation'

const GREEN = '#b8860b'

const PERIOD_META: Record<string, { icon: string; label: string; sub: string }> = {
  morning: { icon: '🌅', label: '早点', sub: '清晨到货' },
  noon: { icon: '☀️', label: '中点', sub: '午间实拍' },
  evening: { icon: '🌙', label: '晚点', sub: '傍晚盘点' },
}

interface Snapshot {
  id: string
  photoUrl: string
  period: 'morning' | 'noon' | 'evening'
  shotAt: string
  note?: string
  commentCount?: number
  // ⭐ MEMORY §256 — 点赞状态 UI 字段（GET /api/snapshots/[id]/likes 拉取）
  likeCount?: number
  likedByMe?: boolean
}

interface Comment {
  id: string
  snapshotId: string
  userNickname: string
  content: string
  rating: number
  isVerifiedPurchase: number | boolean
  createdAt: string
}

export default function FreshnessTimeline({ productId }: { productId: string }) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedPeriod, setExpandedPeriod] = useState<string | null>('morning')
  // ⭐ MEMORY §290 奕霖 20:36：要"今天/昨天/前天折叠起来"——加 day 折叠
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set(['today']))
  const toggleDay = (d: string) => {
    setExpandedDays(prev => {
      const next = new Set(prev)
      if (next.has(d)) next.delete(d)
      else next.add(d)
      return next
    })
  }

  // Bottom sheet state
  const [activeSnap, setActiveSnap] = useState<Snapshot | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [commentsExpanded, setCommentsExpanded] = useState(false)
  const [showCommentForm, setShowCommentForm] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [rating, setRating] = useState(5)
  const [submitting, setSubmitting] = useState(false)
  const [commentMsg, setCommentMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showLoginPrompt, setShowLoginPrompt] = useState(false)
  // ⭐ MEMORY §256 — 点赞 state
  const [likeCount, setLikeCount] = useState(0)
  const [likedByMe, setLikedByMe] = useState(false)
  const [likeBusy, setLikeBusy] = useState(false)

  const router = useRouter()

  // ⭐ Fix FreshnessTimeline TDZ bug: user/isLoggedIn 必须先声明
  const user = useUserStore(s => s.user)
  const isLoggedIn = useUserStore(s => s.isLoggedIn)

  // 打开 modal 时加载点赞状态（带 userPhone 时返回我是否点过）
  useEffect(() => {
    if (!activeSnap) return
    const phone = user?.phone || ''
    fetch(`/api/snapshots/${activeSnap.id}/likes?userPhone=${encodeURIComponent(phone)}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setLikeCount(d.total || 0)
          setLikedByMe(!!d.liked)
        }
      })
      .catch(() => {})
  }, [activeSnap?.id, user?.phone])

  // 切换点赞（未登录弹登录框）
  async function toggleLike() {
    if (!activeSnap || likeBusy) return
    if (!isLoggedIn || !user?.phone) {
      setShowLoginPrompt(true)
      return
    }
    setLikeBusy(true)
    const wasLiked = likedByMe
    // 乐观更新
    setLikedByMe(!wasLiked)
    setLikeCount(c => Math.max(0, c + (wasLiked ? -1 : 1)))
    try {
      const url = wasLiked
        ? `/api/snapshots/${activeSnap.id}/likes?userPhone=${encodeURIComponent(user.phone)}`
        : `/api/snapshots/${activeSnap.id}/likes`
      const res = await fetch(url, {
        method: wasLiked ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: wasLiked ? undefined : JSON.stringify({ userPhone: user.phone }),
      })
      const json = await res.json()
      if (json.success) {
        setLikeCount(json.total || 0)
        setLikedByMe(!!json.liked)
      } else {
        setLikedByMe(wasLiked)
        setLikeCount(c => Math.max(0, c + (wasLiked ? 1 : -1)))
      }
    } catch {
      setLikedByMe(wasLiked)
      setLikeCount(c => Math.max(0, c + (wasLiked ? 1 : -1)))
    } finally {
      setLikeBusy(false)
    }
  }
  useEffect(() => {
    fetch(`/api/snapshots/list?productId=${productId}`)
      .then(r => r.json())
      .then(d => { setSnapshots(d.snapshots || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [productId])

  // 打开 bottom sheet → 加载评论
  useEffect(() => {
    if (!activeSnap) { setComments([]); setCommentsExpanded(false); setShowCommentForm(false); setCommentText(''); setCommentMsg(null); setShowLoginPrompt(false); return }
    setCommentsLoading(true)
    fetch(`/api/snapshots/${activeSnap.id}/comments`)
      .then(r => r.json())
      .then(d => { setComments(d.comments || []); setCommentsLoading(false) })
      .catch(() => setCommentsLoading(false))
  }, [activeSnap])

  const grouped = useMemo(() => {
    const map: Record<string, Record<string, Snapshot>> = { morning: {}, noon: {}, evening: {} }
    snapshots.forEach(s => {
      const dateKey = new Date(s.shotAt).toDateString()
      if (!map[s.period][dateKey] || new Date(s.shotAt) > new Date(map[s.period][dateKey].shotAt)) {
        map[s.period][dateKey] = s
      }
    })
    return map
  }, [snapshots])

  const labelShots = (shots: Snapshot[]) => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const yesterday = today - 86400000
    const dayBefore = today - 2 * 86400000
    return shots.map(s => {
      const t = new Date(s.shotAt).getTime()
      let dayLabel = '', sortOrder = 0
      if (t >= today) { dayLabel = '今天'; sortOrder = 3 }
      else if (t >= yesterday) { dayLabel = '昨天'; sortOrder = 2 }
      else if (t >= dayBefore) { dayLabel = '前天'; sortOrder = 1 }
      else { dayLabel = '更早'; sortOrder = 0 }
      const time = new Date(s.shotAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
      return { ...s, dayLabel, sortOrder, timeLabel: time }
    }).sort((a, b) => b.sortOrder - a.sortOrder || new Date(b.shotAt).getTime() - new Date(a.shotAt).getTime())
  }

  // 提交评论
  async function submitComment() {
    if (!activeSnap || !isLoggedIn || !user) return
    if (!commentText.trim()) { setCommentMsg({ type: 'error', text: '评价内容不能为空' }); return }
    setSubmitting(true); setCommentMsg(null)
    try {
      const r = await fetch(`/api/snapshots/${activeSnap.id}/comments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userPhone: user.phone || '',
          userNickname: user.nickname || user.name || '用户',
          content: commentText.trim(),
          rating,
        }),
      })
      const d = await r.json()
      if (d.success) {
        setCommentMsg({ type: 'success', text: d.isVerifiedPurchase ? '✓ 已发送（已购买顾客）' : '✓ 已发送' })
        setCommentText('')
        setRating(5)
        // 重新加载评论
        const refresh = await fetch(`/api/snapshots/${activeSnap.id}/comments`).then(r => r.json())
        setComments(refresh.comments || [])
        setCommentsExpanded(true)
      } else {
        setCommentMsg({ type: 'error', text: d.error || '发送失败' })
      }
    } catch (e: any) {
      setCommentMsg({ type: 'error', text: e?.message || '网络错误' })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div style={{ margin: '12px 16px', padding: '20px', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>📷 加载中…</div>

  const totalCount = snapshots.length
  if (totalCount === 0) {
    return (
      <div style={{ margin: '12px 16px', padding: '20px', background: 'rgba(184, 134, 11,0.05)', border: '1px dashed rgba(184, 134, 11,0.2)', borderRadius: 16, textAlign: 'center' }}>
        <div style={{ fontSize: 28, marginBottom: 6 }}>📷</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.6)' }}>商家还没上传新鲜度照片</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>拍 3 张早中晚照片，让顾客看得见新鲜</div>
      </div>
    )
  }

  return (
    <div style={{ margin: '12px 16px', padding: '14px', background: 'linear-gradient(180deg, rgba(44,24,16,0.45) 0%, rgba(58,36,22,0.7) 100%)', border: `1px solid rgba(184, 134, 11,0.12)`, borderRadius: 18 }}>
      {/* 头部 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: GREEN, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 18 }}>📷</span><span>新鲜度时间线</span>
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>最近 3 天 · 共 {totalCount} 张</div>
      </div>

      {/* 3 个时段卡 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
        {(['morning', 'noon', 'evening'] as const).map(p => {
          const meta = PERIOD_META[p]
          const shots = labelShots(Object.values(grouped[p]))
          const todayShot = shots.find(s => s.dayLabel === '今天')
          const isOpen = expandedPeriod === p
          return (
            <button key={p} onClick={() => setExpandedPeriod(isOpen ? null : p)} style={{
              position: 'relative', minHeight: 88, padding: '8px 6px',
              background: isOpen ? `linear-gradient(180deg, rgba(184, 134, 11,0.18) 0%, rgba(184, 134, 11,0.04) 100%)` : 'rgba(255,255,255,0.03)',
              border: isOpen ? `1.5px solid ${GREEN}` : '1px solid rgba(184, 134, 11,0.15)',
              borderRadius: 12, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, overflow: 'hidden', transition: 'all .15s ease',
            }}>
              {todayShot && <div style={{ position: 'absolute', inset: 0, background: `url(${todayShot.photoUrl}) center/cover`, opacity: isOpen ? 0.25 : 0.4, zIndex: 0 }} />}
              <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <span style={{ fontSize: 22, lineHeight: 1 }}>{meta.icon}</span>
                <span style={{ fontSize: 12, fontWeight: isOpen ? 700 : 600, color: isOpen ? GREEN : '#fffaf0' }}>{meta.label}</span>
                <span style={{ fontSize: 10, color: shots.length > 0 ? GREEN : 'rgba(255,255,255,0.4)' }}>{shots.length > 0 ? `${shots.length} 张` : '暂无'}</span>
              </div>
            </button>
          )
        })}
      </div>

      {/* 折叠展开：3 天历史 */}
      {expandedPeriod && (
        <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 12, padding: 12, borderTop: `1px solid rgba(184, 134, 11,0.1)` }}>
          {(() => {
            const meta = PERIOD_META[expandedPeriod]
            const shots = labelShots(Object.values(grouped[expandedPeriod]))
            return (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: GREEN, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>{meta.icon}</span><span>{meta.label}</span>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>· {meta.sub}</span>
                  </div>
                  <button onClick={() => setExpandedPeriod(null)} style={{ padding: '4px 8px', background: 'rgba(184, 134, 11,0.1)', color: GREEN, border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer', minHeight: 28, minWidth: 44 }}>收起 ▴</button>
                </div>
                {shots.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>{meta.label}还没有拍照记录</div>
                ) : (() => {
                  // ⭐ MEMORY §290 按 day 分组折叠
                  const dayGroups: Record<string, any[]> = {}
                  shots.forEach(s => { if (!dayGroups[s.dayLabel]) dayGroups[s.dayLabel] = []; dayGroups[s.dayLabel].push(s) })
                  const dayOrder = ['今天', '昨天', '前天', '更早']
                  return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {dayOrder.filter(d => dayGroups[d]?.length > 0).map(day => {
                      const dayShots = dayGroups[day]
                      const isOpen = expandedDays.has(day)
                      return (
                      <div key={day} style={{ background: 'rgba(0,0,0,0.18)', borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(184, 134, 11,0.08)' }}>
                        <button onClick={() => toggleDay(day)} style={{
                          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '9px 12px', background: isOpen ? 'rgba(184, 134, 11,0.1)' : 'transparent',
                          border: 'none', color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: 700, cursor: 'pointer', minHeight: 38,
                          transition: 'background .15s',
                        }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ display: 'inline-block', fontSize: 9, transition: 'transform .15s', transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                            <span>📅 {day}</span>
                            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}>{dayShots.length} 张</span>
                          </span>
                          <span style={{ fontSize: 9, color: isOpen ? '#b8860b' : 'rgba(255,255,255,0.35)' }}>{isOpen ? '收起' : '展开'}</span>
                        </button>
                        {isOpen && (
                        <div style={{ padding: '6px 8px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {dayShots.map((s, idx) => (
                      <div key={s.id} style={{
                        position: 'relative',
                        display: 'flex', gap: 10,
                        padding: 10,
                        background: idx === 0 ? 'rgba(184, 134, 11,0.08)' : 'rgba(255,255,255,0.03)',
                        border: idx === 0 ? `1px solid rgba(184, 134, 11,0.3)` : '1px solid rgba(255,255,255,0.05)',
                        borderRadius: 10,
                      }}>
                        <div onClick={() => setActiveSnap(s)} style={{ position: 'relative', flexShrink: 0, cursor: 'zoom-in' }}>
                          <img src={s.photoUrl} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, display: 'block', border: '1px solid rgba(184, 134, 11,0.15)' }} />
                          {idx === 0 && <div style={{ position: 'absolute', top: -4, left: -4, padding: '2px 6px', borderRadius: 999, background: GREEN, color: '#0a1f15', fontSize: 9, fontWeight: 700 }}>最新</div>}
                          {s.note && <div style={{ position: 'absolute', bottom: -3, right: -3, width: 22, height: 22, borderRadius: '50%', background: '#0a1f15', border: '1.5px solid rgba(184, 134, 11,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>📝</div>}
                        </div>
                        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: idx === 0 ? GREEN : 'rgba(255,255,255,0.85)' }}>{s.dayLabel}</span>
                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{s.timeLabel}</span>
                          </div>
                          {/* 备注默认折叠（1 行） */}
                          {s.note && (
                            <details style={{ marginTop: 2 }}>
                              <summary style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', cursor: 'pointer', listStyle: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span style={{ padding: '2px 6px', background: 'rgba(184, 134, 11,0.12)', borderRadius: 4, fontSize: 9, color: GREEN }}>📝 备注</span>
                                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.note.slice(0, 30)}{s.note.length > 30 ? '...' : ''}</span>
                              </summary>
                              <div style={{ marginTop: 4, padding: '6px 8px', background: 'rgba(184, 134, 11,0.06)', borderLeft: `2px solid ${GREEN}`, borderRadius: 4, fontSize: 11, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5 }}>
                                {s.note}
                              </div>
                            </details>
                          )}
                          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', display: 'flex', gap: 10, marginTop: 'auto' }}>
                            <span>💬 {s.commentCount || 0} 条评价</span>
                          </div>
                        </div>
                      </div>
                      ))}
                        </div>
                        )}
                      </div>
                      )
                    })}
                  </div>
                  )
                })()}
              </>
            )
          })()}
        </div>
      )}

      {/* 📱 Centered Modal — 点图片后弹出（不挡下面内容，移动端宽度友好） */}
      {activeSnap && (
        <div
          onClick={() => setActiveSnap(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 12,
            paddingTop: 'calc(64px + env(safe-area-inset-top, 0px))',
            paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))',
            animation: 'fadeIn .2s ease',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 320,  // ⭐ 17:49 奕霖：360→320 更紧凑
              maxHeight: 'calc(100vh - 24px)',
              background: 'linear-gradient(180deg, #0f1a14 0%, #0a120e 100%)',  // ⭐ 高级深绿黑
              borderRadius: 20,  // ⭐ 17:49 奕霖：16→20
              border: '1px solid rgba(184, 134, 11,0.22)',
              display: 'flex', flexDirection: 'column',
              animation: 'popIn .28s cubic-bezier(0.34, 1.56, 0.64, 1)',
              overflow: 'hidden',
              boxShadow: '0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(184, 134, 11,0.06), inset 0 1px 0 rgba(255,255,255,0.04)',  // ⭐ 多层
            }}
          >

            {/* Header - ⭐ 17:49 紧凑 padding 顶部留 36px 给 × 关闭 */}
            <div style={{ padding: '16px 16px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(184, 134, 11,0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18 }}>{PERIOD_META[activeSnap.period].icon}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#fffaf0' }}>{PERIOD_META[activeSnap.period].label}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>
                    {dayLabel(activeSnap.shotAt)} {timeLabel(activeSnap.shotAt)}
                  </div>
                </div>
              </div>
              {/* ⭐ 点赞按钮（modal 头部右上，关闭按钮左边） */}
            <button
              onClick={toggleLike}
              disabled={likeBusy}
              title={likedByMe ? '取消点赞' : '点赞'}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '6px 12px', borderRadius: 999,
                background: likedByMe ? 'rgba(255, 100, 120, 0.15)' : 'rgba(255,255,255,0.06)',
                border: likedByMe ? '1px solid rgba(255, 100, 120, 0.5)' : '1px solid rgba(255,255,255,0.15)',
                color: likedByMe ? '#ff7a8a' : 'rgba(255,255,255,0.75)',
                fontSize: 13, fontWeight: 600, cursor: likeBusy ? 'not-allowed' : 'pointer',
                minHeight: 32,
              }}
            >
              <span style={{ fontSize: 14 }}>{likedByMe ? '❤️' : '🤍'}</span>
              <span>{likeCount > 0 ? likeCount : '点赞'}</span>
            </button>
            <button onClick={() => setActiveSnap(null)} style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fffaf0',
                fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>×</button>
            </div>

            {/* 滚动区 */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 16px' }}>
              {/* 照片 */}
              <img src={activeSnap.photoUrl} alt="" style={{
                width: '100%', maxHeight: 240, objectFit: 'cover', borderRadius: 12,
                border: '1px solid rgba(184, 134, 11,0.15)',
                display: 'block', marginBottom: 12,
              }} />

              {/* 商家备注 */}
              {activeSnap.note && (
                <div style={{
                  padding: '10px 12px',
                  background: 'rgba(184, 134, 11,0.08)',
                  border: `1px solid rgba(184, 134, 11,0.2)`,
                  borderLeft: `3px solid ${GREEN}`,
                  borderRadius: 8,
                  marginBottom: 12,
                }}>
                  <div style={{ fontSize: 10, color: GREEN, fontWeight: 600, marginBottom: 3, letterSpacing: 0.5 }}>📝 商家备注</div>
                  <div style={{ fontSize: 12, color: '#fffaf0', lineHeight: 1.5 }}>{activeSnap.note}</div>
                </div>
              )}

              {/* 评论区 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>
                  💬 {comments.length} 条评价
                </div>
                <button
                  onClick={() => {
                    if (!isLoggedIn) { setShowLoginPrompt(true); return }
                    setShowCommentForm(!showCommentForm)
                  }}
                  style={{
                    padding: '4px 10px', borderRadius: 999,
                    background: showCommentForm ? 'rgba(255,255,255,0.1)' : GREEN,
                    color: showCommentForm ? '#fffaf0' : '#0a1f15',
                    border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    minHeight: 28,
                  }}
                >{showCommentForm ? '× 取消' : '+ 写评价'}</button>
              </div>

              {/* 写评价表单 */}
              {showCommentForm && isLoggedIn && (
                <div style={{
                  padding: 12, background: 'rgba(0,0,0,0.25)', borderRadius: 10, marginBottom: 12,
                  border: '1px solid rgba(184, 134, 11,0.2)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>评分</span>
                    <div style={{ display: 'flex', gap: 2 }}>
                      {[1, 2, 3, 4, 5].map(n => (
                        <button key={n} onClick={() => setRating(n)} style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          fontSize: 22, padding: 0, lineHeight: 1,
                          color: n <= rating ? GREEN : 'rgba(255,255,255,0.2)',
                        }}>★</button>
                      ))}
                    </div>
                    {user?.phone && (
                      <span style={{ marginLeft: 'auto', fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>
                        {user.nickname || user.name || '用户'}
                      </span>
                    )}
                  </div>
                  <textarea
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    placeholder="说说你的真实感受（最多 500 字）"
                    maxLength={500}
                    style={{
                      width: '100%', minHeight: 60, padding: '8px 10px',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(184, 134, 11,0.15)',
                      borderRadius: 6, color: '#fffaf0', outline: 'none',
                      fontSize: 12, fontFamily: 'inherit', resize: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{commentText.length}/500</span>
                    <button
                      onClick={submitComment} disabled={submitting || !commentText.trim()}
                      style={{
                        padding: '6px 14px', borderRadius: 6,
                        background: (submitting || !commentText.trim()) ? 'rgba(184, 134, 11,0.2)' : GREEN,
                        color: (submitting || !commentText.trim()) ? 'rgba(255,255,255,0.4)' : '#0a1f15',
                        border: 'none', fontSize: 12, fontWeight: 600, cursor: (submitting || !commentText.trim()) ? 'not-allowed' : 'pointer',
                      }}
                    >{submitting ? '发送中…' : '发送'}</button>
                  </div>
                  {commentMsg && (
                    <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 6, fontSize: 11, textAlign: 'center',
                      background: commentMsg.type === 'success' ? 'rgba(184, 134, 11,0.1)' : 'rgba(255,100,100,0.1)',
                      color: commentMsg.type === 'success' ? GREEN : '#ff8585' }}>
                      {commentMsg.text}
                    </div>
                  )}
                </div>
              )}

              {/* 🔐 登录选项对话框 — 未登录点 [+ 写评价] 时显示 */}
              {showLoginPrompt && !isLoggedIn && (
                <div style={{
                  padding: '14px 16px',
                  background: 'rgba(184, 134, 11,0.08)',
                  border: '1.5px solid rgba(184, 134, 11,0.3)',
                  borderRadius: 10,
                  marginBottom: 10,
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <div style={{ fontSize: 22, flexShrink: 0 }}>🔐</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#fffaf0', marginBottom: 2 }}>登录后才能评价</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', lineHeight: 1.4 }}>登录后可打分、留言，也能追踪你的评价</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button
                      onClick={() => setShowLoginPrompt(false)}
                      style={{
                        padding: '6px 12px', borderRadius: 6,
                        background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)',
                        border: 'none', fontSize: 12, cursor: 'pointer',
                        minHeight: 32,
                      }}
                    >取消</button>
                    <button
                      onClick={() => router.push('/me')}
                      style={{
                        padding: '6px 12px', borderRadius: 6,
                        background: GREEN, color: '#0a1f15',
                        border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        minHeight: 32,
                      }}
                    >去登录</button>
                  </div>
                </div>
              )}

              {/* 评论列表 — 折叠显示 */}
              {commentsLoading ? (
                <div style={{ padding: '14px', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>加载评价…</div>
              ) : comments.length === 0 ? (
                <div style={{ padding: '14px', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>还没有评价，做第一个吧</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(commentsExpanded ? comments : comments.slice(0, 2)).map((c, idx) => (
                    <div key={c.id} style={{
                      padding: '10px 12px', background: 'rgba(255,255,255,0.04)',
                      borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <div style={{
                          width: 24, height: 24, borderRadius: '50%',
                          background: 'linear-gradient(135deg, #b8860b 0%, #5bba73 100%)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 700, color: '#0a1f15',
                        }}>{(c.userNickname || '匿')[0]}</div>
                        <span style={{ fontSize: 12, color: '#fffaf0', fontWeight: 600 }}>{c.userNickname || '匿名'}</span>
                        <span style={{ fontSize: 10, color: '#b8860b' }}>{'★'.repeat(c.rating)}<span style={{ color: 'rgba(255,255,255,0.15)' }}>{'★'.repeat(5 - c.rating)}</span></span>
                        {!!c.isVerifiedPurchase && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 999, background: 'rgba(184, 134, 11,0.15)', color: GREEN }}>✓ 已购</span>}
                        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{timeAgo(c.createdAt)}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5 }}>{c.content}</div>
                    </div>
                  ))}
                  {comments.length > 2 && (
                    <button
                      onClick={() => setCommentsExpanded(!commentsExpanded)}
                      style={{
                        padding: '8px', background: 'transparent', border: 'none',
                        color: GREEN, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        textAlign: 'center', minHeight: 36,
                      }}
                    >
                      {commentsExpanded ? '收起 ▴' : `查看全部 ${comments.length} 条评价 ▾`}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes popIn { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
  )
}

// 工具函数
function dayLabel(shotAt: string): string {
  const t = new Date(shotAt).getTime()
  const now = Date.now()
  const today = new Date(now).setHours(0, 0, 0, 0)
  const yesterday = today - 86400000
  const dayBefore = today - 2 * 86400000
  if (t >= today) return '今天'
  if (t >= yesterday) return '昨天'
  if (t >= dayBefore) return '前天'
  return ''
}

function timeLabel(shotAt: string): string {
  return new Date(shotAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const min = Math.floor(diff / 60000)
  const hr = Math.floor(min / 60)
  const day = Math.floor(hr / 24)
  if (min < 1) return '刚刚'
  if (min < 60) return `${min}分钟前`
  if (hr < 24) return `${hr}小时前`
  if (day < 7) return `${day}天前`
  return new Date(dateStr).toLocaleDateString('zh-CN')
}
