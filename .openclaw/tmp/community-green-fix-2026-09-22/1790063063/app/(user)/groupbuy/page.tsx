'use client'

/**
 * 拼团页 · 奕霖 2026-07-03
 *
 * - 列出所有 active 的拼团（GroupBuy 表）
 * - 用户可以发起拼团 / 加入现有拼团
 * - 显示进度：currentPeople / requiredPeople
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/AppLayout'

const GREEN = '#fbbf24'
const GREEN_RGBA = '184, 134, 11'

interface GroupBuyItem {
  id: string
  productId?: string
  productName: string
  productSpec?: string
  originalPrice: number
  groupPrice: number
  requiredPeople: number
  currentPeople: number
  status: string
  expiresAt: string
}

export default function GroupBuyPage() {
  const router = useRouter()
  const [list, setList] = useState<GroupBuyItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'active' | 'success' | 'expired'>('active')

  useEffect(() => {
    fetch('/api/groupbuy/list')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setList(data.groups || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const now = new Date()
  const isExpired = (g: GroupBuyItem) => new Date(g.expiresAt) < now

  const filtered = list.filter((g) => {
    if (filter === 'active') return g.status === 'active' && !isExpired(g)
    if (filter === 'success') return g.status === 'success'
    return isExpired(g)
  })

  const [copiedId, setCopiedId] = useState<string | null>(null)
  const handleCopyInvite = async (g: GroupBuyItem) => {
    const link = `${window.location.origin}/groupbuy/${g.id}?inviter=share`
    try {
      await navigator.clipboard.writeText(link)
      setCopiedId(g.id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      // 降级：用 prompt 让用户手动复制
      window.prompt('复制链接发给好友：', link)
    }
  }

  return (
    <AppLayout title="拼团">
      <div style={{ padding: '16px', paddingBottom: '100px' }}>
        <div style={{
          background: 'linear-gradient(135deg, rgba(244, 114, 182, 0.15), rgba(168, 85, 247, 0.1))',
          border: '1px solid rgba(244, 114, 182, 0.3)',
          borderRadius: 14, padding: '14px 16px', marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{ fontSize: 22 }}>🎁</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#f472b6' }}>2 人成团，享团购价</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
              拉好友一起买，省一半钱
            </div>
          </div>
          <button
            onClick={() => router.push('/groupbuy/new')}
            style={{
              padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700,
              background: 'linear-gradient(135deg, #f472b6, #ec4899)', color: '#fff',
              border: 'none', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
            }}
          >
            + 发起拼团
          </button>
        </div>

        {/* Tab */}
        <div style={{
          display: 'flex', gap: 4, padding: 4,
          background: 'rgba(255,255,255,0.04)', borderRadius: 12,
          marginBottom: 16,
        }}>
          {([
            { k: 'active', label: '🔥 进行中' },
            { k: 'success', label: '✅ 已成团' },
            { k: 'expired', label: '⏰ 已结束' },
          ] as const).map((t) => (
            <button
              key={t.k}
              onClick={() => setFilter(t.k)}
              style={{
                flex: 1, padding: '8px', fontSize: 12, fontWeight: 600,
                border: 'none', cursor: 'pointer', borderRadius: 10,
                background: filter === t.k ? `linear-gradient(135deg, ${GREEN}33, ${GREEN}11)` : 'transparent',
                color: filter === t.k ? GREEN : 'rgba(255,255,255,0.5)',
                fontFamily: 'inherit',
              }}
            >{t.label}</button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.4)' }}>加载中...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.3)' }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🛍️</div>
            <div style={{ fontSize: 13 }}>暂无{filter === 'active' ? '进行中' : filter === 'success' ? '已成团' : '已结束'}拼团</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map((g) => {
              const progress = Math.min(100, (g.currentPeople / g.requiredPeople) * 100)
              return (
                <div key={g.id} style={{
                  background: 'rgba(35, 74, 53, 0.3)',
                  border: `1px solid rgba(${GREEN_RGBA}, 0.1)`,
                  borderRadius: 16, padding: 16,
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                    <div style={{
                      width: 56, height: 56,
                      background: 'rgba(184, 134, 11, 0.1)',
                      borderRadius: 12, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 28, overflow: 'hidden',
                    }}>
                      {(g as any).productImage ? (
                        <img src={(g as any).productImage} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span>🍵</span>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 14, fontWeight: 700, color: '#fff',
                        marginBottom: 4, lineHeight: 1.4,
                      }}>{g.productName}</div>
                      {g.productSpec && (
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>
                          {g.productSpec}
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                        <span style={{
                          fontSize: 18, fontWeight: 800, color: GREEN,
                        }}>¥{g.groupPrice.toFixed(1)}</span>
                        <span style={{
                          fontSize: 12, color: 'rgba(255,255,255,0.3)',
                          textDecoration: 'line-through',
                        }}>¥{g.originalPrice.toFixed(1)}</span>
                      </div>
                    </div>
                  </div>

                  {/* 进度条 */}
                  <div style={{
                    height: 6, background: 'rgba(255,255,255,0.06)',
                    borderRadius: 3, overflow: 'hidden', marginBottom: 6,
                  }}>
                    <div style={{
                      width: `${progress}%`, height: '100%',
                      background: `linear-gradient(90deg, ${GREEN}, #2dd4bf)`,
                      transition: 'width 0.3s',
                    }} />
                  </div>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 12,
                  }}>
                    <span>
                      已 <strong style={{ color: '#fff', fontSize: 13 }}>{g.currentPeople}</strong> / {g.requiredPeople} 人
                      {g.status === 'active' && !isExpired(g) && g.currentPeople < g.requiredPeople && (
                        <span style={{
                          marginLeft: 8, padding: '2px 8px', borderRadius: 10,
                          background: g.requiredPeople - g.currentPeople === 1 ? 'rgba(248, 113, 113, 0.2)' : 'rgba(184, 134, 11, 0.15)',
                          color: g.requiredPeople - g.currentPeople === 1 ? '#f87171' : '#fbbf24',
                          fontSize: 10, fontWeight: 700,
                        }}>
                          还差 {g.requiredPeople - g.currentPeople} 人成团
                        </span>
                      )}
                    </span>
                    <span>剩余 {Math.max(0, Math.ceil((new Date(g.expiresAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))} 天</span>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => router.push(`/groupbuy/${g.id}`)}
                      disabled={g.status !== 'active' || isExpired(g)}
                      style={{
                        flex: 1, padding: '10px',
                        background: g.status === 'active' && !isExpired(g)
                          ? 'linear-gradient(135deg, #f472b6 0%, #ec4899 100%)'
                          : 'rgba(255,255,255,0.08)',
                        color: g.status === 'active' && !isExpired(g) ? '#fff' : 'rgba(255,255,255,0.4)',
                        border: 'none', borderRadius: 10,
                        fontSize: 13, fontWeight: 700,
                        cursor: g.status === 'active' && !isExpired(g) ? 'pointer' : 'not-allowed',
                        fontFamily: 'inherit',
                      }}
                    >
                      {g.status === 'active' && !isExpired(g)
                        ? `去拼团 · ¥${g.groupPrice.toFixed(1)}`
                        : g.status === 'success' ? '已成团' : '已结束'}
                    </button>
                    {g.status === 'active' && !isExpired(g) && (
                      <button
                        onClick={() => handleCopyInvite(g)}
                        title="复制邀请链接发给好友"
                        style={{
                          padding: '10px 14px', borderRadius: 10,
                          background: copiedId === g.id
                            ? 'linear-gradient(135deg, #fbbf24, #5cb85c)'
                            : 'rgba(184, 134, 11, 0.1)',
                          color: copiedId === g.id ? '#0a3018' : '#fbbf24',
                          border: '1px solid rgba(184, 134, 11, 0.3)',
                          fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >
                        {copiedId === g.id ? '✓ 已复制' : '🔗 邀请'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AppLayout>
  )
}