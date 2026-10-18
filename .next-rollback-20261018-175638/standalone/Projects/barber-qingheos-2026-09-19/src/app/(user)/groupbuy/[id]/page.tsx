'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import AppLayout from '@/components/AppLayout'
import { useUserStore } from '@/stores/userStore'

/**
 * /groupbuy/[id] — 拼团详情页 v2.0 (奕霖 2026-09-07 21:42 "这个界面不行,你设计一下")
 * - 视觉重做:绿色主题统一 / Hero 大图 / 大字渐变价格 / 大倒计时 / 网格化成员 + 空槽 / 极简 CTA
 * - 数据源保持 /api/groups/join 不变
 */

interface GroupDetail {
  id: string
  productId: string
  productName: string
  productSpec: string
  originalPrice: number
  groupPrice: number
  requiredPeople: number
  currentPeople: number
  status: string
  expiresAt: string
  productStock: number | null
  creatorPhone?: string
}

interface Member {
  id: string
  phone: string
  nickname: string
  joinedAt: string
  orderId: string | null
}

function useCountdown(endAtIso: string | null) {
  const [remain, setRemain] = useState<number>(() =>
    endAtIso ? Math.max(0, new Date(endAtIso).getTime() - Date.now()) : 0
  )
  useEffect(() => {
    if (!endAtIso) return
    const t = setInterval(() => {
      setRemain(Math.max(0, new Date(endAtIso).getTime() - Date.now()))
    }, 1000)
    return () => clearInterval(t)
  }, [endAtIso])
  const h = Math.floor(remain / 3600000)
  const m = Math.floor((remain % 3600000) / 60000)
  const s = Math.floor((remain % 60000) / 1000)
  return { h, m, s, done: remain <= 0 }
}

export default function GroupBuyDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { user } = useUserStore()
  const phone = user?.phone || ''

  const [group, setGroup] = useState<GroupDetail | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const cd = useCountdown(group?.expiresAt || null)
  const isExpired = cd.done || (group ? new Date(group.expiresAt) < new Date() : false)
  const isFull = group ? group.currentPeople >= group.requiredPeople : false
  const isSuccess = group?.status === 'success'

  const load = () => {
    if (!params.id) return
    setLoading(true)
    fetch(`/api/groups/join?groupId=${params.id}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setGroup(d.group)
          setMembers(d.members || [])
        } else {
          showToast(d.error || '加载失败')
        }
      })
      .catch(() => showToast('网络错误'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [params.id])

  const showToast = (text: string) => {
    setToast(text)
    setTimeout(() => setToast(null), 2200)
  }

  const handleJoin = async () => {
    if (!phone) { showToast('请先登录'); return }
    if (isFull) { showToast('已满员'); return }
    if (isExpired) { showToast('已过期'); return }
    if (group?.creatorPhone && phone === group.creatorPhone) {
      showToast('你是创建者，不能加入自己的拼团')
      return
    }
    setJoining(true)
    try {
      const res = await fetch('/api/groups/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId: params.id, phone, nickname: user?.nickname || `用户${phone.slice(-4)}` }),
      })
      const data = await res.json()
      if (data.success) {
        showToast('✓ 加入成功')
        load()
      } else {
        showToast(data.error || '加入失败')
      }
    } catch (e: any) {
      showToast(e.message || '网络错误')
    } finally {
      setJoining(false)
    }
  }

  const copyLink = () => {
    navigator.clipboard?.writeText(window.location.href)
    showToast('✓ 链接已复制')
  }

  if (loading) {
    return (
      <AppLayout title="拼团详情" activePath="groupbuy">
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(180deg, #2c1810 0%, #1a0e08 100%)', color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>
          加载中…
        </div>
      </AppLayout>
    )
  }

  if (!group) {
    return (
      <AppLayout title="拼团详情" activePath="groupbuy">
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(180deg, #2c1810 0%, #1a0e08 100%)', padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🛍️</div>
          <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.6)', marginBottom: 24 }}>拼团不存在或已结束</div>
          <button onClick={() => router.push('/groupbuy')} style={{ padding: '12px 28px', background: 'linear-gradient(135deg, #b8860b, #b8860b)', color: '#2c1810', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            返回拼团列表
          </button>
        </div>
      </AppLayout>
    )
  }

  const progress = Math.min(100, (group.currentPeople / group.requiredPeople) * 100)
  const isCreator = phone && group.creatorPhone === phone
  const alreadyJoined = phone && members.some(m => m.phone === phone)
  const needed = group.requiredPeople - group.currentPeople
  const savings = group.originalPrice - group.groupPrice
  const productImage = (group as any).productImage as string | undefined

  return (
    <AppLayout title="拼团详情" activePath="groupbuy">
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #2c1810 0%, #1a0e08 60%, #0a1a12 100%)',
        color: '#fff',
        paddingBottom: '140px',
      }}>
        <div style={{ position: 'relative', width: '100%', aspectRatio: '1 / 1', maxHeight: 420, background: 'linear-gradient(135deg, rgba(184, 134, 11,0.08), rgba(184,134,11,0.04))', overflow: 'hidden' }}>
          {productImage ? (
            <img src={productImage} alt={group.productName} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 96 }}>🍎</div>
          )}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(10,15,13,0.55) 0%, transparent 25%, transparent 55%, rgba(10,15,13,0.95) 100%)' }} />
          <button onClick={() => router.back()} aria-label="返回" style={{
            position: 'absolute', top: 16, left: 16,
            width: 40, height: 40, borderRadius: '50%',
            background: 'rgba(10,15,13,0.6)', backdropFilter: 'blur(10px)',
            color: '#fff', border: '1px solid rgba(255,255,255,0.1)',
            fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>←</button>
          <div style={{
            position: 'absolute', bottom: 20, left: 16,
            padding: '8px 16px',
            background: 'linear-gradient(135deg, #b8860b, #b8860b)',
            color: '#2c1810',
            borderRadius: 999,
            fontSize: 13, fontWeight: 700,
            boxShadow: '0 4px 12px rgba(184, 134, 11,0.4)',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            🔥 {group.requiredPeople} 人团
          </div>
        </div>

        <div style={{ padding: '20px 16px 4px' }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: '#fff', lineHeight: 1.3 }}>{group.productName}</h1>
          {group.productSpec && (
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 6 }}>{group.productSpec}</div>
          )}

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 38, fontWeight: 800,
              background: 'linear-gradient(135deg, #b8860b, #b8860b)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              letterSpacing: '-1px', lineHeight: 1,
            }}>¥{group.groupPrice.toFixed(2)}</span>
            <span style={{ fontSize: 15, color: 'rgba(255,255,255,0.35)', textDecoration: 'line-through' }}>¥{group.originalPrice.toFixed(2)}</span>
            <span style={{ marginLeft: 'auto', fontSize: 12, color: '#b8860b', padding: '5px 12px', background: 'rgba(184, 134, 11,0.12)', borderRadius: 999, fontWeight: 700 }}>
              省 ¥{savings.toFixed(2)}
            </span>
          </div>
          {group.productStock !== null && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 8 }}>剩余库存 {group.productStock} 件</div>
          )}
        </div>

        <div style={{
          margin: '20px 16px 0',
          padding: 20,
          background: 'linear-gradient(135deg, rgba(184, 134, 11,0.1), rgba(184,134,11,0.04))',
          border: '1px solid rgba(184, 134, 11,0.25)',
          borderRadius: 20,
        }}>
          {!isExpired && !isSuccess && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 14, borderBottom: '1px solid rgba(184, 134, 11,0.15)' }}>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>⏱ 剩余时间</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <TimeBox value={cd.h} />
                <Sep />
                <TimeBox value={cd.m} />
                <Sep />
                <TimeBox value={cd.s} urgent={cd.h === 0 && cd.m < 10} />
              </div>
            </div>
          )}

          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 10, display: 'flex', justifyContent: 'space-between' }}>
            <span>👥 已加入 <strong style={{ color: '#fff', fontSize: 16 }}>{group.currentPeople}</strong> / {group.requiredPeople} 人</span>
            {isFull && <span style={{ color: '#b8860b', fontWeight: 700 }}>✓ 满员</span>}
          </div>
          <div style={{ height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              width: `${progress}%`, height: '100%',
              background: 'linear-gradient(90deg, #b8860b, #b8860b)',
              borderRadius: 4, transition: 'width 0.5s ease',
              boxShadow: '0 0 8px rgba(184, 134, 11,0.4)',
            }} />
          </div>

          {isFull && !isExpired && (
            <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(184, 134, 11,0.18)', borderRadius: 10, fontSize: 14, color: '#b8860b', fontWeight: 700, textAlign: 'center' }}>
              🎉 已成团 · 等待发货
            </div>
          )}
          {isSuccess && (
            <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(184,134,11,0.2)', borderRadius: 10, fontSize: 14, color: '#b8860b', fontWeight: 700, textAlign: 'center' }}>
              ✓ 拼团成功
            </div>
          )}
          {!isFull && !isExpired && needed > 0 && (
            <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(184, 134, 11,0.12)', borderRadius: 10, fontSize: 14, color: '#b8860b', fontWeight: 600, textAlign: 'center' }}>
              还差 <strong>{needed}</strong> 人即可成团
            </div>
          )}
          {isExpired && !isSuccess && (
            <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(156,163,175,0.15)', borderRadius: 10, fontSize: 14, color: '#9ca3af', fontWeight: 600, textAlign: 'center' }}>
              ⏰ 拼团已过期
            </div>
          )}
        </div>

        <div style={{
          margin: '16px 16px 0',
          padding: 20,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 20,
        }}>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 14 }}>
            👤 团员名单 <span style={{ marginLeft: 6, color: '#b8860b', fontWeight: 700 }}>{members.length}/{group.requiredPeople}</span>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${Math.min(group.requiredPeople, 5)}, 1fr)`,
            gap: 10,
          }}>
            {Array.from({ length: group.requiredPeople }).map((_, i) => {
              const m = members[i]
              return m ? <MemberSlot key={m.id} member={m} index={i} /> : <EmptySlot key={i} />
            })}
          </div>
        </div>

        <div style={{
          margin: '16px 16px 0',
          padding: 16,
          background: 'rgba(184, 134, 11,0.04)',
          border: '1px dashed rgba(184, 134, 11,0.2)',
          borderRadius: 16,
        }}>
          <div style={{ fontSize: 13, color: '#b8860b', fontWeight: 700, marginBottom: 10 }}>💡 怎么玩</div>
          <ol style={{ margin: 0, paddingLeft: 20, fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.9 }}>
            <li><strong style={{ color: '#b8860b' }}>你申请开团</strong>:付团购价 ¥{group.groupPrice.toFixed(2)},成为团长</li>
            <li><strong style={{ color: '#b8860b' }}>拉好友</strong>:分享链接邀请 1-3 位好友加入</li>
            <li><strong style={{ color: '#b8860b' }}>{group.requiredPeople} 人成团</strong>:满员后商家发货,享团购价</li>
            <li>超时未成团:<strong style={{ color: '#b8860b' }}>全额退款</strong>,无损失</li>
          </ol>
        </div>

        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          padding: `12px 16px calc(12px + env(safe-area-inset-bottom))`,
          background: 'linear-gradient(0deg, rgba(10,15,13,1) 0%, rgba(10,15,13,0.95) 70%, transparent 100%)',
          backdropFilter: 'blur(12px)',
          borderTop: '1px solid rgba(184, 134, 11,0.15)',
          zIndex: 100,
        }}>
          {isSuccess ? (
            <button disabled style={{ width: '100%', padding: '14px', borderRadius: 12, background: 'rgba(184,134,11,0.2)', color: '#b8860b', fontSize: 15, fontWeight: 700, border: 'none' }}>
              ✓ 拼团已成团
            </button>
          ) : isExpired ? (
            <button disabled style={{ width: '100%', padding: '14px', borderRadius: 12, background: 'rgba(156,163,175,0.15)', color: '#9ca3af', fontSize: 15, fontWeight: 700, border: 'none' }}>
              ⏰ 拼团已过期
            </button>
          ) : isFull ? (
            <button disabled style={{ width: '100%', padding: '14px', borderRadius: 12, background: 'rgba(184, 134, 11,0.2)', color: '#b8860b', fontSize: 15, fontWeight: 700, border: 'none' }}>
              🎉 已满员
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={copyLink} style={{
                flex: '0 0 auto', padding: '0 16px',
                borderRadius: 12,
                background: 'rgba(184, 134, 11,0.12)',
                color: '#b8860b',
                border: '1px solid rgba(184, 134, 11,0.3)',
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                📋 邀请
              </button>
              {isCreator ? (
                <button disabled style={{
                  flex: 1, padding: '14px', borderRadius: 12,
                  background: 'rgba(184, 134, 11,0.18)', color: '#b8860b',
                  fontSize: 15, fontWeight: 700, border: 'none',
                }}>
                  👑 你是团长 · 等成员加入
                </button>
              ) : alreadyJoined ? (
                <button disabled style={{
                  flex: 1, padding: '14px', borderRadius: 12,
                  background: 'rgba(184, 134, 11,0.15)', color: '#b8860b',
                  fontSize: 15, fontWeight: 700, border: 'none',
                }}>
                  ✓ 你已加入 · 等满员
                </button>
              ) : (
                <button onClick={handleJoin} disabled={joining} style={{
                  flex: 1, padding: '14px', borderRadius: 12,
                  background: joining ? 'rgba(184, 134, 11,0.4)' : 'linear-gradient(135deg, #b8860b, #b8860b)',
                  color: '#2c1810',
                  fontSize: 15, fontWeight: 700, border: 'none',
                  cursor: joining ? 'wait' : 'pointer',
                  boxShadow: '0 4px 16px rgba(184, 134, 11,0.3)',
                }}>
                  {joining ? '加入中…' : `🚀 加入拼团 · ¥${group.groupPrice.toFixed(2)}`}
                </button>
              )}
            </div>
          )}
        </div>

        {toast && (
          <div style={{
            position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(184, 134, 11, 0.95)', color: '#2c1810',
            padding: '12px 22px', borderRadius: 999, fontSize: 14, fontWeight: 600,
            zIndex: 99999, boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
          }}>{toast}</div>
        )}
      </div>
    </AppLayout>
  )
}

function TimeBox({ value, urgent }: { value: number; urgent?: boolean }) {
  return (
    <span style={{
      fontFamily: 'ui-monospace, SFMono-Regular, monospace',
      fontSize: 20, fontWeight: 800,
      padding: '4px 10px', borderRadius: 8,
      background: urgent ? 'rgba(239,68,68,0.18)' : 'rgba(184, 134, 11,0.18)',
      color: urgent ? '#ef4444' : '#b8860b',
      minWidth: 44, textAlign: 'center',
      boxShadow: urgent ? '0 0 8px rgba(239,68,68,0.3)' : 'none',
    }}>{String(value).padStart(2, '0')}</span>
  )
}

function Sep() {
  return <span style={{ color: 'rgba(184, 134, 11,0.5)', fontSize: 18, fontWeight: 700 }}>:</span>
}

function MemberSlot({ member, index }: { member: Member; index: number }) {
  const isLeader = index === 0
  const initial = member.nickname?.[0] || member.phone.slice(-1)
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        width: 48, height: 48, borderRadius: '50%',
        background: isLeader ? 'linear-gradient(135deg, #b8860b, #b8860b)' : 'rgba(184, 134, 11,0.18)',
        border: isLeader ? '2px solid #b8860b' : '2px solid rgba(184, 134, 11,0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: isLeader ? 18 : 16, fontWeight: 700,
        color: isLeader ? '#2c1810' : '#b8860b',
        margin: '0 auto 6px',
        boxShadow: isLeader ? '0 0 12px rgba(184, 134, 11,0.4)' : 'none',
      }}>
        {isLeader ? '👑' : initial}
      </div>
      <div style={{
        fontSize: 10,
        color: isLeader ? '#b8860b' : 'rgba(255,255,255,0.6)',
        fontWeight: isLeader ? 700 : 400,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        maxWidth: '100%',
      }}>
        {isLeader ? '团长' : (member.nickname?.slice(0, 5) || `用户${member.phone.slice(-4)}`)}
      </div>
    </div>
  )
}

function EmptySlot() {
  return (
    <div style={{ textAlign: 'center', opacity: 0.45 }}>
      <div style={{
        width: 48, height: 48, borderRadius: '50%',
        border: '2px dashed rgba(184, 134, 11,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 20, color: 'rgba(184, 134, 11,0.5)',
        margin: '0 auto 6px',
      }}>+</div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>待加入</div>
    </div>
  )
}
