'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import AppLayout from '@/components/AppLayout'
import { quickAddToCart, type CartItem } from '@/lib/cart'
import { useRouter, useSearchParams } from 'next/navigation'
import { formatPricePerWeight, formatWeight } from '@/lib/format'

interface Product {
  id: string
  name: string
  shortName: string
  spec: string | null
  price: number
  memberPrice: number
  stock: number
  category: string | null
  categoryLabel: string | null
  qualityClass: string | null
  functionTags: string | null
  unit: string | null
  sales30d: number
  productCode: string  // ⭐ MEMORY 242 (v0.8.27 API 必返)
}

interface PhotoSnapshot {
  id: string
  productId: string
  photoUrl: string
  shotAt: string
  period: 'morning' | 'noon' | 'evening'
  note: string | null
  commentCount: number
}

interface SnapshotComment {
  id: string
  userNickname: string
  content: string
  rating: number
  isVerifiedPurchase: number
  createdAt: string
}

const PERIOD_ICON: Record<string, string> = {
  morning: '🌅',
  noon: '☀️',
  evening: '🌙',
}
const PERIOD_LABEL: Record<string, string> = {
  morning: '早',
  noon: '中',
  evening: '晚',
}

interface AIResult {
  ai: {
    query: string
    intent: string
    category: string
    categoryName: string
    functionTag: string
    explanation: string
  }
  products: Product[]
  total: number
}

// ⭐ MEMORY 2026-08-18 19:14 — 奕霖锁果蔬行业
// 医药 qualityClass (OTC/中药/处方) 全部映射空 label（数据库残留不显示）
const QM_LABELS: Record<string, { label: string; color: string }> = {
  // 果蔬分类
  '水果': { label: '🍎 水果', color: 'rgba(255, 154, 168, 0.95)' },
  '蔬菜': { label: '🥬 蔬菜', color: 'rgba(184, 134, 11, 0.95)' },
  '生鲜': { label: '🌱 生鲜', color: 'rgba(184, 134, 11, 0.95)' },
  '食品': { label: '食品', color: 'rgba(255, 213, 79, 0.7)' },
  '日用品': { label: '日用', color: 'rgba(180, 180, 180, 0.95)' },
  // ⭐ 医药 qualityClass 全部映射空 label（隐藏但不报错）
  'OTC': { label: '', color: 'rgba(184, 134, 11, 0.95)' },
  '保健食品': { label: '', color: 'rgba(255, 213, 79, 0.95)' },
  '医疗器械': { label: '', color: 'rgba(127, 200, 255, 0.95)' },
  '消毒用品': { label: '', color: 'rgba(189, 178, 255, 0.95)' },
  '中药饮片': { label: '', color: 'rgba(255, 184, 108, 0.95)' },
  '中药成药': { label: '', color: 'rgba(255, 184, 108, 0.95)' },
  '化妆用品': { label: '', color: 'rgba(255, 154, 200, 0.95)' },
  // ⭐ MEMORY 183 — 处方药整条移出线上体系
  '处方药': { label: '', color: 'rgba(184, 134, 11, 0.95)' },
  'Rx': { label: '', color: 'rgba(184, 134, 11, 0.95)' },
  '处方': { label: '', color: 'rgba(184, 134, 11, 0.95)' },
}

// ⭐ MEMORY 2026-08-18 19:14 — 奕霖锁果蔬行业，全替换
const SUGGESTIONS = [
  '🍎 时令水果', '🥬 新鲜蔬菜', '🍇 水果拼盘', '🍓 浆果类',
  '🍊 柑橘类', '🥕 根茎类', '🥗 沙拉菜', '🌽 玉米杂粮',
  '🍅 番茄系列', '🧄 调味品类', '🍌 香蕉热带', '🥬 叶菜类',
]

function SearchPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // 奕霖 2026-08-02 02:04 反馈"返回时保留搜索状态" → URL ?q= 参数
  // 浏览器历史栈自动保留 URL，router.back() 回到 /search?q=苹果 时能恢复结果
  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AIResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())
  const [cartCount, setCartCount] = useState(0)
  // ⭐ MEMORY 2026-08-18 18:51 — 新鲜度照片时间线
  const [snapshots, setSnapshots] = useState<Record<string, PhotoSnapshot[]>>({})
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set())
  const [commentsMap, setCommentsMap] = useState<Record<string, SnapshotComment[]>>({})
  const [loadingComments, setLoadingComments] = useState<Set<string>>(new Set())

  // 奕霖 2026-08-02 02:04 反馈：返回时保留搜索状态
  // 从 URL ?q= 读，有值就自动搜（这样从商品详情点返回，能恢复上次的搜索）
  useEffect(() => {
    const initialQ = searchParams.get('q')?.trim()
    if (initialQ) {
      doSearch(initialQ, true /* silent，不 replace URL */)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ⭐ MEMORY 2026-08-18 18:51 — 拉所有商品的最新 3 天快照
  useEffect(() => {
    if (!result || result.products.length === 0) { setSnapshots({}); return }
    let cancelled = false
    Promise.all(
      result.products.slice(0, 20).map(p =>
        fetch(`/api/snapshots/list?productId=${p.id}&days=3`).then(r => r.json()).then(d => [p.id, d.snapshots || []] as const).catch(() => [p.id, []] as const)
      )
    ).then(entries => {
      if (cancelled) return
      const m: Record<string, PhotoSnapshot[]> = {}
      entries.forEach(([id, snaps]) => { if (snaps && snaps.length > 0) m[id] = snaps })
      setSnapshots(m)
    })
    return () => { cancelled = true }
  }, [result])

  // 加购 handler
  const handleAdd = (p: Product, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const r = quickAddToCart({
      id: p.id,
      name: p.name,
      price: p.price,
      spec: p.spec,
      category: p.category,
      categoryLabel: p.categoryLabel,
    })
    setAddedIds((prev) => new Set(prev).add(p.id))
    setCartCount(r.newCount)
  }

  async function doSearch(q: string, silent = false) {
    if (!q.trim()) return
    setQuery(q)
    // 奕霖 2026-08-02 02:04：搜索时同步 URL ?q=，浏览器历史栈保留，返回能恢复
    // silent 模式（首次进入）不 replace URL（避免覆盖浏览器前进/后退的初始 entry）
    if (!silent) {
      router.replace('/search?q=' + encodeURIComponent(q.trim()), { scroll: false })
    }
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/ai-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q.trim() }),
      })
      const data = await res.json()
      if (data.success) {
        setResult(data)
      } else {
        setError(data.error || '搜索失败')
      }
    } catch (e: any) {
      setError(e?.message || '网络错误')
    } finally {
      setLoading(false)
    }
  }

  // ⭐ MEMORY 2026-08-18 18:51 — 切换评论展开/收起
  async function toggleComments(snapshotId: string, productId: string) {
    if (expandedComments.has(snapshotId)) {
      setExpandedComments(prev => { const n = new Set(prev); n.delete(snapshotId); return n })
      return
    }
    setExpandedComments(prev => new Set(prev).add(snapshotId))
    if (!commentsMap[snapshotId]) {
      setLoadingComments(prev => new Set(prev).add(snapshotId))
      try {
        const r = await fetch(`/api/snapshots/${snapshotId}/comments`)
        const d = await r.json()
        if (d.success) setCommentsMap(prev => ({ ...prev, [snapshotId]: d.comments || [] }))
      } finally {
        setLoadingComments(prev => { const n = new Set(prev); n.delete(snapshotId); return n })
      }
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    doSearch(query)
  }

  return (
    <AppLayout title="造型 AI">
      <div style={{padding: '16px 16px 32px', paddingBottom: '180px', maxWidth: '1100px', margin: '0 auto', color: '#fffaf0'}}>
      <style>{`
        .search-card { transition: border-color 0.2s, transform 0.2s; }
        .search-card:hover { border-color: rgba(184, 134, 11, 0.4); transform: translateY(-2px); }
      `}</style>
      <form onSubmit={onSubmit} style={{marginBottom: '20px'}}>
        <div style={{display: 'flex', gap: '8px'}}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="说水果或蔬菜，比如苹果"
            style={{
              flex: 1, minWidth: 0, padding: '14px 16px', fontSize: '16px', minHeight: 48,
              background: 'rgba(17,25,22,0.6)', border: '1px solid rgba(184, 134, 11, 0.2)',
              borderRadius: '12px', color: '#fffaf0', outline: 'none',
              fontFamily: 'inherit',
            }}
            autoFocus
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            style={{
              flexShrink: 0, padding: '14px 18px', fontSize: '15px', fontWeight: 700,
              background: loading || !query.trim() ? 'rgba(184, 134, 11, 0.3)' : '#b8860b',
              color: '#2c1810', border: 'none', borderRadius: '12px', cursor: 'pointer',
              minHeight: 48,
            }}
          >
            {loading ? '挑果中...' : '🔍 挑果'}
          </button>
        </div>
        <div style={{display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '12px'}}>
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => doSearch(s)}
              style={{
                padding: '6px 12px', fontSize: '12px',
                background: 'rgba(184, 134, 11, 0.08)', border: '1px solid rgba(184, 134, 11, 0.2)',
                borderRadius: '100px', color: '#b8860b', cursor: 'pointer',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </form>

      {error && (
        <div style={{padding: '16px', background: 'rgba(255, 100, 100, 0.1)', border: '1px solid rgba(255, 100, 100, 0.3)', borderRadius: '12px', color: '#fca5a5', marginBottom: '16px'}}>
          {error}
        </div>
      )}

      {loading && (
        <div style={{padding: '40px', textAlign: 'center', color: '#9ca3af'}}>
          <div style={{fontSize: '32px', marginBottom: '12px'}}>🤔</div>
          AI 正在理解你的问题...
        </div>
      )}

      {result && !loading && (
        <>
          <div style={{
            padding: '16px 20px', background: 'linear-gradient(135deg, rgba(184, 134, 11, 0.08), rgba(184, 134, 11, 0.03))',
            border: '1px solid rgba(184, 134, 11, 0.2)', borderRadius: '12px', marginBottom: '20px',
          }}>
            <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px'}}>
              <span style={{fontSize: '20px'}}>🤖</span>
              <span style={{fontSize: '14px', color: '#b8860b', fontWeight: 600}}>AI 理解</span>
              <span style={{fontSize: '12px', color: '#9ca3af'}}>·</span>
              <span style={{fontSize: '12px', color: '#9ca3af'}}>共 {result.total} 件</span>
            </div>
            <div style={{fontSize: '15px', color: '#fffaf0', lineHeight: 1.6}}>{result.ai.explanation}</div>
            {result.ai.categoryName && (
              <div style={{marginTop: '8px', display: 'inline-block', padding: '4px 12px', background: 'rgba(184, 134, 11, 0.15)', borderRadius: '100px', fontSize: '12px', color: '#b8860b'}}>
                分类：{result.ai.categoryName}
              </div>
            )}
          </div>

          {result.products.length === 0 ? (
            <div style={{padding: '40px', textAlign: 'center', color: '#9ca3af'}}>
              <div style={{fontSize: '32px', marginBottom: '12px'}}>🔍</div>
              没找到相关商品，试试别的说法
            </div>
          ) : (
            <div style={{display: 'grid', gridTemplateColumns: '1fr', gap: '10px'}} className="md:!grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
              {result.products.map((p) => {
                const qm = p.qualityClass ? QM_LABELS[p.qualityClass] : null
                const tags = p.functionTags ? p.functionTags.split(/[、/]/).filter(Boolean).slice(0, 3) : []
                const isAdded = addedIds.has(p.id)
                return (
                  <div
                    key={p.id}
                    style={{
                      display: 'block', padding: '16px',
                      background: 'rgba(17,25,22,0.6)', border: '1px solid rgba(184, 134, 11, 0.12)',
                      borderRadius: '12px', color: '#fffaf0',
                    }}
                  >
                    <Link
                      href={`/products/${p.id}`}
                      className="search-card"
                      style={{ display: 'flex', flexDirection: 'row', gap: '12px', alignItems: 'flex-start', textDecoration: 'none', color: 'inherit' }}
                    >
                      {/* 商品小图 60x60 - 用户不用点文字也能识别 */}
                      <div style={{
                        flexShrink: 0, width: '60px', height: '60px',
                        borderRadius: '10px',
                        background: 'linear-gradient(135deg, rgba(184, 134, 11,0.12), rgba(184, 134, 11,0.04))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        overflow: 'hidden', border: '1px solid rgba(184, 134, 11,0.1)',
                      }}>
                        <img
                          src={`/api/product-image/${p.id}`}
                          alt={p.name}
                          loading="lazy"
                          style={{
                            width: '88%', height: '88%', objectFit: 'contain',
                            opacity: p.stock <= 0 ? 0.3 : 1,
                            filter: p.stock <= 0 ? 'grayscale(0.5)' : 'none',
                          }}
                        />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '8px'}}>
                        <h3 style={{fontSize: '15px', fontWeight: 600, lineHeight: 1.4, margin: 0, color: '#fffaf0', flex: 1}}>
                          <span style={{display:'inline-block',padding:'1px 6px',background:'rgba(184, 134, 11,0.18)',color:'#b8860b',borderRadius:'4px',fontSize:'11px',fontFamily:'monospace',fontWeight:600,marginRight:'6px',verticalAlign:'middle'}}>
                            {p.productCode ? `#${p.productCode}` : ''}
                          </span>
                          <span style={{flex:1}}>{p.name}</span>
                        </h3>
                        {qm && (
                          <span style={{padding: '2px 8px', fontSize: '11px', background: qm.color, color: '#2c1810', borderRadius: '6px', fontWeight: 600, flexShrink: 0}}>
                            {qm.label}
                          </span>
                        )}
                      </div>
                      {p.spec && (
                        <div style={{fontSize: '12px', color: '#9ca3af', marginBottom: '8px'}}>{p.spec}</div>
                      )}
                      <div style={{display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '8px'}}>
                        <div>
                          <span style={{fontSize: '18px', fontWeight: 700, color: '#b8860b'}}>
                            {formatPricePerWeight(p.price, (p as any).weightGram ?? null, p.memberPrice)}
                          </span>
                          {p.memberPrice > 0 && p.memberPrice < p.price && (
                            <span style={{fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginLeft: '6px', textDecoration: 'line-through'}}>
                              原价 ¥{p.price.toFixed(2)}/{formatWeight((p as any).weightGram ?? null)}
                            </span>
                          )}
                        </div>
                        {p.stock > 0 ? (
                          <span style={{fontSize: '11px', color: '#b8860b'}}>有货</span>
                        ) : (
                          <span style={{fontSize: '11px', color: '#fca5a5'}}>缺货</span>
                        )}
                      </div>
                      {tags.length > 0 && (
                        <div style={{display: 'flex', flexWrap: 'wrap', gap: '4px'}}>
                          {tags.map((t, i) => (
                            <span key={i} style={{padding: '2px 8px', fontSize: '11px', background: 'rgba(184, 134, 11, 0.08)', color: '#9ca3af', borderRadius: '4px'}}>
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                      </div>
                    </Link>
                    {/* 加购按钮 */}
                    <div style={{display: 'flex', gap: '8px', marginTop: '10px'}}>
                      <button
                        onClick={(e) => handleAdd(p, e)}
                        disabled={p.stock <= 0}
                        style={{
                          flex: 1, padding: '8px 12px', fontSize: '13px', fontWeight: 600,
                          background: isAdded ? 'rgba(184, 134, 11, 0.15)' : '#b8860b',
                          color: isAdded ? '#b8860b' : '#2c1810',
                          border: isAdded ? '1px solid #b8860b' : 'none',
                          borderRadius: '8px', cursor: p.stock > 0 ? 'pointer' : 'not-allowed',
                          opacity: p.stock > 0 ? 1 : 0.4,
                          transition: 'all 0.2s',
                        }}
                      >
                        {p.stock <= 0 ? '缺货' : isAdded ? '✓ 已加入' : '🛒 加入购物车'}
                      </button>
                      {cartCount > 0 && (
                        <button
                          onClick={() => router.push('/cart')}
                          style={{
                            padding: '8px 14px', fontSize: '13px', fontWeight: 600,
                            background: 'rgba(184, 134, 11, 0.1)',
                            color: '#b8860b',
                            border: '1px solid rgba(184, 134, 11, 0.3)',
                            borderRadius: '8px', cursor: 'pointer',
                          }}
                        >
                          🛒 {cartCount}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {!result && !loading && !error && (
        <div style={{padding: '40px 20px', textAlign: 'center', color: '#6b7280'}}>
          <div style={{fontSize: '48px', marginBottom: '16px'}}>🍵</div>
          <h2 style={{fontSize: '18px', fontWeight: 600, color: '#9ca3af', marginBottom: '8px'}}>果小蔬帮你挑</h2>
          <p style={{fontSize: '13px', color: '#6b7280', maxWidth: '400px', margin: '0 auto', lineHeight: 1.6}}>
            说水果（"苹果""香蕉"）、说蔬菜（"白菜""番茄"）、说场景（"今晚吃啥"）<br/>
            AI 会理解你想要什么，给你最合适的新鲜果蔬
          </p>
        </div>
      )}
      </div>
    </AppLayout>
  )
}

// 奕霖 2026-08-02 02:04：包 Suspense 满足 Next.js SSR 要求
export default function SearchPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>加载中…</div>}>
      <SearchPageInner />
    </Suspense>
  )
}
