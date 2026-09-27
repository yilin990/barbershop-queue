'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/AppLayout'
import { useUserStore } from '@/stores/userStore'

interface Product {
  id: string
  name: string
  spec: string
  price: number
  stock: number
  coverImage?: string
  image?: string  // 奕霖 22:24 商品需要数据
  costPrice?: number
}

// ⭐ 奕霖 2026-08-05 18:08 智能让利 client 版（跟 server 同步）
function smartPricing(price: number, cost: number, people: 2 | 3 | 4) {
  if (cost <= 0) return { price, tier: 'unknown' as const, floor: false }
  const margin = (price - cost) / price
  let tier: 'high' | 'mid' | 'low' | 'unprofitable'
  if (margin >= 0.30) tier = 'high'
  else if (margin >= 0.15) tier = 'mid'
  else if (margin >= 0.05) tier = 'low'
  else tier = 'unprofitable'
  if (tier === 'unprofitable') return { price, tier, floor: false }
  const ratioMap: Record<string, number[]> = { high: [0.95, 0.90, 0.85], mid: [0.95, 0.92, 0.88], low: [0.98, 0.95, 0.92] }
  const ratios = ratioMap[tier]
  const floor = Math.max(cost * 1.05, price * ratios[2])
  const p = Math.max(price * ratios[people === 4 ? 2 : people === 3 ? 1 : 0], floor)
  return { price: Math.round(p * 100) / 100, tier, floor: Math.abs(p - floor) < 0.001 }
}

// 3 档价预览块
function renderThreeTiers(product: Product, requiredPeople: number) {
  const t2 = smartPricing(product.price, product.costPrice || 0, 2)
  const t3 = smartPricing(product.price, product.costPrice || 0, 3)
  const t4 = smartPricing(product.price, product.costPrice || 0, 4)
  const tiers = [2, 3, 4].map((n) => ({ n, t: n === 2 ? t2 : n === 3 ? t3 : t4 }))
  return (
    <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
      {tiers.map(({ n, t }) => {
        const isCurrent = requiredPeople === n
        return (
          <div key={n} style={{
            flex: 1, padding: '4px 6px', borderRadius: 6,
            background: isCurrent ? 'rgba(127,220,148,0.18)' : 'rgba(255,255,255,0.04)',
            border: isCurrent ? '1px solid rgba(127,220,148,0.4)' : '1px solid rgba(255,255,255,0.06)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>{n} 人</div>
            <div style={{ fontSize: 11, color: isCurrent ? '#fbbf24' : '#fff', fontWeight: 600 }}>¥{t.price.toFixed(2)}{t.floor ? '⏬' : ''}</div>
          </div>
        )
      })}
    </div>
  )
}

/**
 * ⭐ 奕霖 2026-08-05 15:22 需求：替代 /groupbuy 86 行 alert 占位
 * - 选商品：搜索 + 列表
 * - 选成团人数：2 / 3 / 5 / 10（默认 3）
 * - 选持续天数：3 / 7 / 15（默认 7）
 * - 自动计算团购价 = 原价 × 0.7
 * - 提交：POST /api/groupbuy/create
 */
export default function NewGroupBuyPage() {
  const router = useRouter()
  const { user } = useUserStore()
  const phone = user?.phone || ''

  const [q, setQ] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Product | null>(null)
  const [requiredPeople, setRequiredPeople] = useState(3)
  const [expiresInDays, setExpiresInDays] = useState(7)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<{ text: string; kind: 'ok' | 'err' } | null>(null)
  // ⭐ 奕霖 2026-08-05 20:20：载入用户待处理订单（可一键开团）
  const [userOrders, setUserOrders] = useState<any[]>([])
  const debounceRef = useRef<any>(null)

  // 加载用户待处理订单
  useEffect(() => {
    if (!phone) return
    fetch(`/api/orders?merchantCode=G0001&phone=${phone}&status=pending&limit=10`)
      .then(r => r.json())
      .then(d => { if (d.success && Array.isArray(d.orders)) setUserOrders(d.orders.filter((o: any) => !o.groupBuyId)) })
      .catch(() => {})
  }, [phone])

  const showToast = (text: string, kind: 'ok' | 'err' = 'ok') => {
    setToast({ text, kind })
    setTimeout(() => setToast(null), 2200)
  }

  const search = (query: string) => {
    setLoading(true)
    fetch(`/api/products?merchantCode=G0001&q=${encodeURIComponent(query)}&inStock=1&pageSize=10`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setProducts(d.products || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    search('') // 初始空 query 返回 10 件商品
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(q), 300)
    return () => clearTimeout(debounceRef.current)
  }, [q])

  // 奕霖 22:24:不同人数成团,折扣不一样 → 用 smartPricing 按档位
  const groupPrice = selected
    ? smartPricing(selected.price, selected.costPrice || 0, requiredPeople as 2 | 3 | 4).price
    : 0

  const handleSubmit = async () => {
    if (!selected) {
      showToast('请先选择一个商品', 'err')
      return
    }
    if (!phone) {
      showToast('请先登录', 'err')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/groupbuy/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selected.id,
          requiredPeople,
          expiresInDays,
          phone,
          productName: selected.name,
          productSpec: selected.spec,
          originalPrice: selected.price,
        }),
      })
      const data = await res.json()
      if (data.success) {
        showToast('✓ 拼团已发起', 'ok')
        setTimeout(() => router.push(`/groupbuy/${data.id}`), 1000)
      } else {
        showToast(data.error || '发起失败', 'err')
      }
    } catch (e: any) {
      showToast(e?.message || '网络错误', 'err')
    } finally {
      setSubmitting(false)
    }
  }

  const peopleOptions = [2, 3, 4]  // 奕霖 22:24:拉 1/2/3 人 → 2/3/4 人团
  const daysOptions = [3, 7, 15]

  return (
    <AppLayout title="发起拼团" activePath="/groupbuy">
      <div style={{ minHeight: '100vh', paddingBottom: '120px', background: 'linear-gradient(180deg, #0a1f12 0%, #051208 100%)', color: '#fff', fontFamily: '-apple-system, "PingFang SC", sans-serif' }}>
        {/* Header */}
        <div style={{ padding: '20px 16px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.back()} style={{ background: 'rgba(244, 114, 182, 0.08)', color: '#fbbf24', padding: '6px 12px', borderRadius: 8, border: 'none', fontSize: 12, cursor: 'pointer' }}>← 返回</button>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>👥 发起拼团</h1>
        </div>

        {/* 已选商品卡 */}
        {selected && (
          <div style={{
            margin: '0 16px 16px', padding: 14,
            background: 'linear-gradient(135deg, rgba(244, 114, 182, 0.12), rgba(244, 114, 182, 0.04))',
            border: '1px solid rgba(244, 114, 182, 0.3)', borderRadius: 14,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 4 }}>{selected.name}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>{selected.spec}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 18, fontWeight: 800, color: '#fbbf24' }}>¥{groupPrice}</span>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', textDecoration: 'line-through' }}>¥{selected.price}</span>
                <span style={{ fontSize: 11, color: '#fbbf24', padding: '2px 8px', background: 'rgba(244, 114, 182, 0.15)', borderRadius: 6 }}>
                  {(() => { const t = smartPricing(selected.price, selected.costPrice || 0, 2).tier; return t === 'high' ? '高毛利·智能让利' : t === 'mid' ? '中毛利·智能让利' : t === 'low' ? '低毛利·微让利' : '原价' })()}
                </span>
              </div>
              {selected.costPrice && selected.costPrice > 0 && renderThreeTiers(selected, requiredPeople)}
            </div>
            <button onClick={() => setSelected(null)} style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 12, border: 'none', cursor: 'pointer' }}>换</button>
          </div>
        )}

        {/* ⭐ 奕霖 2026-08-05 20:20：用户待处理订单一键开团 */}
        {userOrders.length > 0 && !selected && (
          <div style={{ margin: '0 16px 16px', padding: 14, background: 'rgba(244, 114, 182, 0.06)', border: '1px solid rgba(244, 114, 182, 0.2)', borderRadius: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#fbbf24' }}>📦 你的待处理订单</span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>· 点一下可一键开团</span>
              <span style={{ marginLeft: 'auto', fontSize: 10, padding: '2px 6px', background: 'rgba(244, 114, 182, 0.2)', color: '#fbbf24', borderRadius: 10, fontWeight: 700 }}>{userOrders.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {userOrders.slice(0, 5).map((o: any) => (
                <button
                  key={o.id}
                  onClick={() => {
                    // 点订单 → 从订单查商品信息 → 自动选
                    fetch(`/api/products/${o.productId || o.id}`, { cache: 'no-store' }).catch(() => null)
                    const p: Product = {
                      id: o.productId || o.id,
                      name: o.productName || '订单商品',
                      spec: o.productSpec || '',
                      price: Number(o.finalAmount || o.totalAmount || 0),
                      stock: 99,
                      costPrice: 0,
                    }
                    setSelected(p)
                    showToast(`✓ 已载入订单 #${(o.orderNo || o.id || '').slice(-6)}`, 'ok')
                  }}
                  style={{
                    padding: 10, borderRadius: 8, background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)', textAlign: 'left',
                    cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', gap: 10,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.productName || '订单商品'}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>#{(o.orderNo || o.id || '').slice(-8)} · ¥{Number(o.finalAmount || o.totalAmount || 0).toFixed(2)}</div>
                  </div>
                  <span style={{ fontSize: 10, color: '#fbbf24', fontWeight: 700 }}>开团 →</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 选商品（搜索 + 列表） */}
        {!selected && (
          <div style={{ padding: '0 16px 16px' }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)', margin: '0 0 8px' }}>1. 选择商品</h3>
            <input
              type="text"
              placeholder="搜索商品..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 10,
                background: 'rgba(255, 255, 255, 0.06)', border: '1px solid rgba(244, 114, 182, 0.3)',
                color: '#fff', fontSize: 14, marginBottom: 12, boxSizing: 'border-box',
              }}
            />
            <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {loading ? (
                <div style={{ textAlign: 'center', padding: 20, color: 'rgba(255,255,255,0.5)' }}>加载中...</div>
              ) : products.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 20, color: 'rgba(255,255,255,0.5)' }}>暂无商品</div>
              ) : (
                products.map((p) => {
                  const pImg = (p as any).image || p.coverImage
                  return (
                  <button key={p.id} onClick={() => setSelected(p)} style={{
                    padding: 10, borderRadius: 10,
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    textAlign: 'left', cursor: 'pointer', color: '#fff',
                    display: 'flex', alignItems: 'center', gap: 12,
                  }}>
                    {pImg ? (
                      <img src={pImg} alt={p.name} onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none' }} style={{
                        width: 48, height: 48, borderRadius: 8, objectFit: 'cover', flexShrink: 0,
                        background: 'rgba(127, 220, 148, 0.06)',
                      }} />
                    ) : (
                      <div style={{
                        width: 48, height: 48, borderRadius: 8, fontSize: 22,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'rgba(127, 220, 148, 0.06)', flexShrink: 0,
                        color: 'rgba(127,220,148,0.6)',
                      }}>📦</div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>
                        {p.spec && `${p.spec} · `}库存 {p.stock || 0}
                      </div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#fbbf24', flexShrink: 0 }}>¥{p.price}</div>
                  </button>
                  )
                })
              )}
            </div>
          </div>
        )}

        {/* 选成团人数 */}
        {selected && (
          <div style={{ padding: '0 16px 16px' }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)', margin: '0 0 8px' }}>2. 成团人数</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {peopleOptions.map((n) => {
                const invite = n - 1
                const tierPrice = selected ? smartPricing(selected.price, selected.costPrice || 0, n as 2 | 3 | 4).price : 0
                const isCurrent = requiredPeople === n
                return (
                  <button key={n} onClick={() => setRequiredPeople(n)} style={{
                    padding: '14px 8px', borderRadius: 12,
                    background: isCurrent
                      ? 'linear-gradient(135deg, rgba(244, 114, 182, 0.2), rgba(236, 72, 153, 0.1))'
                      : 'rgba(255, 255, 255, 0.04)',
                    border: isCurrent ? '1px solid rgba(244, 114, 182, 0.5)' : '1px solid rgba(255, 255, 255, 0.08)',
                    color: isCurrent ? '#fbbf24' : '#fff',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  }}>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>拉 {invite} 人</span>
                    <span style={{ fontSize: 10, color: isCurrent ? 'rgba(127,220,148,0.7)' : 'rgba(255,255,255,0.4)' }}>{n} 人成团</span>
                    {selected && (
                      <span style={{ fontSize: 11, color: isCurrent ? '#fbbf24' : 'rgba(255,255,255,0.5)', fontWeight: 700, marginTop: 2 }}>¥{tierPrice.toFixed(2)}</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* 选持续天数 */}
        {selected && (
          <div style={{ padding: '0 16px 16px' }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)', margin: '0 0 8px' }}>3. 持续天数</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {daysOptions.map((d) => (
                <button key={d} onClick={() => setExpiresInDays(d)} style={{
                  padding: '12px 8px', borderRadius: 10,
                  background: expiresInDays === d ? 'linear-gradient(135deg, rgba(244, 114, 182, 0.2), rgba(236, 72, 153, 0.1))' : 'rgba(255, 255, 255, 0.04)',
                  border: expiresInDays === d ? '1px solid rgba(244, 114, 182, 0.5)' : '1px solid rgba(255, 255, 255, 0.08)',
                  color: expiresInDays === d ? '#fbbf24' : '#fff',
                  fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}>
                  {d} 天
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 确认条 */}
        {selected && (
          <div style={{
            position: 'fixed', bottom: 88, left: 0, right: 0, padding: '16px',
            background: 'linear-gradient(0deg, rgba(10, 15, 13, 0.95) 0%, rgba(10, 15, 13, 0.8) 80%, transparent 100%)',
            backdropFilter: 'blur(12px)',
          }}>
            <button onClick={handleSubmit} disabled={submitting} style={{
              width: '100%', padding: '14px', borderRadius: 12,
              background: submitting ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg, #fbbf24, #4ade80)',
              color: '#fff', fontSize: 15, fontWeight: 700, border: 'none',
              cursor: submitting ? 'not-allowed' : 'pointer',
            }}>
              {submitting ? '发起中...' : `🚀 立即发起拼团（¥${groupPrice} / ${requiredPeople}人成团）`}
            </button>
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div style={{
            position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)',
            background: toast.kind === 'ok' ? 'rgba(127, 220, 148, 0.95)' : 'rgba(255, 100, 100, 0.95)',
            color: '#0a0f0d', padding: '12px 20px', borderRadius: 10,
            fontSize: 14, fontWeight: 600, zIndex: 99999,
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
          }}>
            {toast.text}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
