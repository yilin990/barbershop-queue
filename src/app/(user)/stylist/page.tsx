'use client'

/**
 * /stylist - 选理发师展示页（2026-10-01 清禾 第三优先）
 *
 * 设计：
 * - 顶部返回 + 标题
 * - 理发师卡片 grid（每个卡片含头像/姓名/简介/擅长技能/起价）
 * - 选理发师 → 跳回 /merchant/queue 并预选
 *
 * 实时数据：与 /api/stylists 联动，与 booking 互通（selid query）
 */

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import AppLayout from '@/components/AppLayout'

interface Stylist {
  id: string
  merchantId: string
  name: string
  avatar?: string | null
  bio?: string | null
  specialties: string[]   // ['cut', 'dye', 'perm', 'care', 'style']
  yearsOfExp?: number
  startPrice: number
  rating: number
}

const SPECIALTY_META: Record<string, { label: string; icon: string }> = {
  cut: { label: '剪发', icon: '✂️' },
  dye: { label: '染发', icon: '🎨' },
  perm: { label: '烫发', icon: '🌊' },
  care: { label: '护发', icon: '🧴' },
  style: { label: '造型', icon: '💫' },
}

function StylistPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const merchantId = searchParams.get('merchantId') || 'm_barber_001'
  const selectId = searchParams.get('selectId') || ''
  
  const [stylists, setStylists] = useState<Stylist[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterCat, setFilterCat] = useState<string>('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/stylists?merchantId=${encodeURIComponent(merchantId)}`)
      .then(r => r.json())
      .then(d => {
        if (cancelled) return
        if (!d.success) throw new Error(d.error || '加载失败')
        setStylists(d.stylists || [])
        setError(null)
      })
      .catch((e: any) => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [merchantId])

  const filtered = filterCat ? stylists.filter(s => s.specialties.includes(filterCat)) : stylists

  function selectStylist(s: Stylist) {
    // 把选中的 stylistId 存 localStorage，booking 页读
    try { localStorage.setItem('selectedStylistId', s.id) } catch {}
    router.push(`/merchant/queue?stylistId=${encodeURIComponent(s.id)}`)
  }

  return (
    <AppLayout title="💇 选理发师" showHeader>
      <div style={{ padding: '12px 16px', background: '#fffaf0', borderBottom: '1px solid rgba(184,134,11,0.15)' }}>
        <div style={{ fontSize: 13, color: '#5d3a1f', marginBottom: 8 }}>
          选择你心仪的造型师 · {stylists.length} 位可选
        </div>
        {/* 分类筛选 */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button onClick={() => setFilterCat('')} style={chipStyle(filterCat === '')}>全部</button>
          {Object.entries(SPECIALTY_META).map(([k, m]) => (
            <button key={k} onClick={() => setFilterCat(k)} style={chipStyle(filterCat === k)}>
              {m.icon} {m.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: 16 }}>
        {loading && <div style={{ textAlign: 'center', padding: 40, color: '#9a7a4a' }}>加载中…</div>}
        {error && <div style={{ padding: 16, color: '#ff6b6b' }}>❌ {error}</div>}
        {!loading && !error && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: '#9a7a4a' }}>
            {stylists.length === 0 ? '暂无理发师信息' : '没有匹配的理发师'}
          </div>
        )}
        {!loading && !error && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {filtered.map(s => (
              <div key={s.id} style={{
                background: '#fffaf0',
                border: selectId === s.id ? '2px solid #b8860b' : '1px solid rgba(184,134,11,0.2)',
                borderRadius: 14, padding: 14,
                boxShadow: '0 2px 8px rgba(44,24,16,0.06)',
                display: 'flex', flexDirection: 'column', gap: 10,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: '50%',
                    background: s.avatar ? `url(${s.avatar}) center/cover` : 'rgba(184,134,11,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 24, flexShrink: 0, border: '2px solid rgba(184,134,11,0.3)',
                  }}>
                    {!s.avatar && '💇'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#2c1810' }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: '#8d6e63', marginTop: 2 }}>
                      ⭐ {s.rating.toFixed(1)} · {s.yearsOfExp || 1} 年经验
                    </div>
                  </div>
                </div>
                {s.bio && (
                  <div style={{ fontSize: 12, color: '#5d3a1f', lineHeight: 1.5 }}>{s.bio}</div>
                )}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {s.specialties.map(sp => (
                    <span key={sp} style={{
                      fontSize: 11, padding: '2px 8px', borderRadius: 6,
                      background: 'rgba(184,134,11,0.1)',
                      color: '#b8860b', fontWeight: 600,
                    }}>
                      {SPECIALTY_META[sp]?.icon || sp} {SPECIALTY_META[sp]?.label || sp}
                    </span>
                  ))}
                </div>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  paddingTop: 8, borderTop: '1px solid rgba(184,134,11,0.15)',
                }}>
                  <div>
                    <span style={{ fontSize: 11, color: '#8d6e63' }}>起价</span>
                    <span style={{ fontSize: 18, fontWeight: 700, color: '#b8860b', marginLeft: 4 }}>
                      ¥{s.startPrice}
                    </span>
                  </div>
                  <button onClick={() => selectStylist(s)} style={{
                    padding: '8px 16px', borderRadius: 8,
                    background: '#b8860b', color: '#fffaf0',
                    border: 'none', fontSize: 13, fontWeight: 600,
                    cursor: 'pointer',
                  }}>
                    选择 →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  )
}

const chipStyle = (active: boolean): React.CSSProperties => ({
  padding: '6px 12px', borderRadius: 16,
  border: active ? '1.5px solid #b8860b' : '1px solid rgba(184,134,11,0.25)',
  background: active ? 'rgba(184,134,11,0.18)' : '#fffaf0',
  color: active ? '#b8860b' : '#5d3a1f',
  fontSize: 12, fontWeight: 600, cursor: 'pointer',
})

export default function StylistPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: 'center' }}>加载中…</div>}>
      <StylistPageInner />
    </Suspense>
  )
}
