'use client'

import { toast } from '@/lib/ui-bus'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface GroupDetail {
  id: string
  productId: string
  productName: string
  productSpec: string | null
  originalPrice: number
  groupPrice: number
  requiredPeople: number
  currentPeople: number
  status: 'active' | 'success' | 'expired' | 'closed'
  expiresAt: string
  createdAt: string
}

interface Member {
  id: string
  phone: string
  nickname: string
  joinedAt: string
}

interface ApiResp {
  success: boolean
  group?: GroupDetail
  members?: Member[]
  error?: string
}

export default function GroupDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const groupId = params?.id
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<{ group: GroupDetail; members: Member[] } | null>(null)
  const [errMsg, setErrMsg] = useState<string>('')
  const [joining, setJoining] = useState(false)
  const [phone, setPhone] = useState('')
  const [nickname, setNickname] = useState('')
  const [showJoin, setShowJoin] = useState(false)
  const [copied, setCopied] = useState(false)

  const load = async () => {
    if (!groupId) return
    setLoading(true)
    setErrMsg('')
    try {
      const r = await fetch(`/api/groups/join?groupId=${groupId}`, { credentials: 'include' })
      const json: ApiResp = await r.json()
      if (json.success && json.group) {
        setData({ group: json.group, members: json.members || [] })
      } else {
        setErrMsg(json.error || '加载失败')
      }
    } catch (e: any) {
      setErrMsg(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [groupId])

  const handleJoin = async () => {
    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      toast.info('请输入有效的手机号（13位，1开头）')
      return
    }
    setJoining(true)
    try {
      const r = await fetch('/api/groups/join', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId, phone, nickname: nickname.trim() || undefined }),
      })
      const json = await r.json()
      if (json.success) {
        toast.success(json.group?.isFull
          ? `🎉 拼团成功！恭喜「${json.group.productName}」${json.group.requiredPeople}人成团，¥${json.group.groupPrice}`
          : `✓ 已加入拼团！进度 ${json.group.currentPeople}/${json.group.requiredPeople}`)
        setShowJoin(false)
        load()
      } else {
        toast.error(`参与失败：${json.error}`)
      }
    } catch (e: any) {
      toast.error(`网络错误：${e.message}`)
    } finally {
      setJoining(false)
    }
  }

  const copyShare = async () => {
    if (typeof window === 'undefined') return
    const url = `${window.location.origin}/groups/${groupId}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.warn(`复制失败，手动复制：\n（已自动复制到剪贴板，请手动粘贴）`)
    }
  }

  if (loading) {
    return (
      <PageWrap>
        <div style={{ padding: 60, textAlign: 'center', color: '#9ca3af' }}>加载中…</div>
      </PageWrap>
    )
  }

  if (errMsg) {
    return (
      <PageWrap>
        <EmptyState emoji="😕" title="拼团不存在或已结束" desc={errMsg}>
          <Link href="/activity" style={btnPrimary(false)}>去活动页看看</Link>
        </EmptyState>
      </PageWrap>
    )
  }

  if (!data) return null
  const { group, members } = data
  const progress = Math.min(100, (group.currentPeople / group.requiredPeople) * 100)
  const isFull = group.currentPeople >= group.requiredPeople
  const expiresAt = new Date(group.expiresAt)
  const expired = expiresAt < new Date()
  const secondsLeft = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000))

  return (
    <PageWrap>
      {/* 顶部 banner */}
      <div style={{
        background: 'linear-gradient(135deg, #f472b6 0%, #a855f7 100%)',
        borderRadius: 18, padding: 24, marginBottom: 20, color: '#fff',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: 12, right: 12, fontSize: 64, opacity: 0.15 }}>🎯</div>
        <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 4 }}>拼团砍价 · {isFull ? '已成团' : '进行中'}</div>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>{group.productName}</div>
        {group.productSpec && <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 12 }}>{group.productSpec}</div>}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontSize: 36, fontWeight: 700 }}>¥{group.groupPrice.toFixed(2)}</span>
          <span style={{ fontSize: 14, opacity: 0.7, textDecoration: 'line-through' }}>¥{group.originalPrice.toFixed(2)}</span>
        </div>
      </div>

      {/* 进度区 */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 14, color: '#9ca3af' }}>还差 <strong style={{ color: isFull ? '#b8860b' : '#f472b6', fontSize: 22 }}>{Math.max(0, group.requiredPeople - group.currentPeople)}</strong> 人成团</span>
          <span style={{ fontSize: 13, color: '#9ca3af' }}>{group.currentPeople}/{group.requiredPeople} 人</span>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 10, height: 12, overflow: 'hidden', marginBottom: 14 }}>
          <div style={{ width: `${progress}%`, height: '100%', background: isFull ? 'linear-gradient(90deg, #b8860b, #34d399)' : 'linear-gradient(90deg, #f472b6, #a855f7)', transition: 'width 0.4s' }} />
        </div>

        {/* 成员头像占位（用 nick 首字 emoji 模拟） */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          {Array.from({ length: group.requiredPeople }).map((_, i) => {
            const m = members[i]
            const filled = !!m
            const isLast = i === group.currentPeople - 1
            return (
              <div key={i} style={{
                width: 44, height: 44, borderRadius: '50%',
                background: filled ? 'linear-gradient(135deg, #f472b6, #a855f7)' : 'rgba(255,255,255,0.06)',
                border: isLast ? '2px solid #b8860b' : '1px dashed rgba(255,255,255,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: filled ? 16 : 18, color: filled ? '#fff' : '#6b7280',
                fontWeight: 700,
              }} title={filled ? `${m.nickname}（${m.phone.slice(-4)}）` : '待加入'}>
                {filled ? m.nickname.slice(0, 1) : '+'}
              </div>
            )
          })}
        </div>

        {/* 倒计时 */}
        {!isFull && !expired && group.status === 'active' && (
          <div style={{ fontSize: 13, color: secondsLeft < 86400 ? '#f59e0b' : '#9ca3af', textAlign: 'center', padding: '10px 0', borderTop: '1px dashed rgba(255,255,255,0.1)' }}>
            ⏰ 剩余 <Countdown seconds={secondsLeft} />
          </div>
        )}
        {(isFull || expired || group.status === 'success') && (
          <div style={{ fontSize: 14, color: '#b8860b', textAlign: 'center', padding: '10px 0', fontWeight: 600 }}>
            🎉 恭喜，拼团成功！请到店凭取货码领取
          </div>
        )}
      </div>

      {/* 成员详情 */}
      {members.length > 0 && (
        <div style={card}>
          <div style={{ fontSize: 14, color: '#9ca3af', marginBottom: 10 }}>团内成员（{members.length}）</div>
          {members.map((m, i) => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', padding: '8px 0', borderBottom: i < members.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #f472b6, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 14, marginRight: 10 }}>{m.nickname.slice(0, 1)}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, color: '#fff' }}>{m.nickname}</div>
                <div style={{ fontSize: 12, color: '#9ca3af' }}>{m.phone.slice(0, 3)}****{m.phone.slice(-4)}</div>
              </div>
              {i === 0 && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'rgba(251,191,36,0.18)', color: '#b8860b', fontWeight: 600 }}>团长</span>}
            </div>
          ))}
        </div>
      )}

      {/* 操作区（sticky 底栏）*/}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: 16, background: 'linear-gradient(180deg, transparent, #0a0f0d 30%)', display: 'flex', gap: 12, justifyContent: 'center', zIndex: 50 }}>
        <button onClick={copyShare} style={btnGhost}>{copied ? '✓ 已复制' : '🔗 邀请好友'}</button>
        {group.status === 'active' && !expired && !isFull && (
          <button onClick={() => setShowJoin(true)} style={btnPrimary(true)}>参与拼团 ¥{group.groupPrice.toFixed(2)}</button>
        )}
        {isFull && (
          <Link href={`/products/${group.productId}`} style={btnPrimary(true, false)}>立即下单</Link>
        )}
      </div>

      {/* 加入弹窗 */}
      {showJoin && (
        <div role="dialog" style={modalOverlay} onClick={() => setShowJoin(false)}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700, color: '#fff' }}>参与拼团</h3>
            <label style={lbl}>手机号 <span style={{ color: '#ef4444' }}>*</span></label>
            <input
              type="tel" inputMode="numeric" maxLength={11}
              value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
              placeholder="11位手机号" autoFocus
              style={inp}
            />
            <label style={{ ...lbl, marginTop: 12 }}>昵称（可选）</label>
            <input
              type="text" value={nickname}
              onChange={(e) => setNickname(e.target.value.slice(0, 20))}
              placeholder="留空则显示「顾客」+手机末4位"
              style={inp}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 24, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowJoin(false)} style={btnGhost} disabled={joining}>取消</button>
              <button onClick={handleJoin} style={btnPrimary(true)} disabled={joining}>{joining ? '加入中...' : '确认加入'}</button>
            </div>
          </div>
        </div>
      )}

      {/* 底部安全间距（避免被 sticky bar 遮挡） */}
      <div style={{ height: 80 }} />
    </PageWrap>
  )
}

function Countdown({ seconds }: { seconds: number }) {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return (
    <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>
      {d > 0 && `${d}天`}{h.toString().padStart(2, '0')}:{m.toString().padStart(2, '0')}:{s.toString().padStart(2, '0')}
    </span>
  )
}

function PageWrap({ children }: { children: React.ReactNode }) {
  return <div style={{ minHeight: '100dvh', background: '#0a0f0d', padding: 16, color: '#fff' }}>{children}</div>
}

function EmptyState({ emoji, title, desc, children }: { emoji: string; title: string; desc?: string; children?: React.ReactNode }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 16px' }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>{emoji}</div>
      <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: '#fff' }}>{title}</div>
      {desc && <div style={{ fontSize: 14, color: '#9ca3af', marginBottom: 24 }}>{desc}</div>}
      {children}
    </div>
  )
}

const card: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 14,
  padding: 16,
  marginBottom: 16,
}

const btnPrimary = (active: boolean, link: boolean = false): React.CSSProperties => ({
  flex: 1, padding: '14px 20px', borderRadius: 12, border: 'none',
  background: 'linear-gradient(135deg, #f472b6, #a855f7)',
  color: '#fff', fontSize: 16, fontWeight: 700, cursor: active ? 'pointer' : 'pointer',
  textAlign: 'center',
  textDecoration: link ? 'none' : 'none',
  display: 'inline-block',
  opacity: active ? 1 : 0.6,
})

const btnGhost: React.CSSProperties = {
  flex: 0, padding: '14px 20px', borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer',
  background: 'transparent', color: '#fff', fontSize: 15, fontWeight: 600,
}

const modalOverlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
}
const modalCard: React.CSSProperties = {
  background: '#0a0f0d', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 16,
  padding: 24, width: '100%', maxWidth: 400,
}
const lbl: React.CSSProperties = { display: 'block', fontSize: 13, color: '#9ca3af', marginBottom: 6 }
const inp: React.CSSProperties = {
  width: '100%', padding: '12px 14px', borderRadius: 10,
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
  color: '#fff', fontSize: 16, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
}
