'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import AppLayout from '@/components/AppLayout'
import { quickAddToCart } from '@/lib/cart'
import { formatPricePerWeight, formatWeight, formatStock } from '@/lib/format'

const GREEN = '#fbbf24'
const GREEN_RGB = '184, 134, 11'
const CARD_BG = 'linear-gradient(180deg, rgba(35, 74, 53, 0.5) 0%, rgba(26, 58, 42, 0.7) 100%)'

// ⭐ MEMORY 183 — 2026-08-07 奕霖指令：处方药整条移出线上体系
// 删掉 Rx 风险分类：糖尿病(0112)、心血管(0117)、补肾(0118)、男科(0109)、妇科(0102)、消化肝胆(0103)、痔疮(0113)、五官(0116)
const CATEGORIES = [
  { code: '', name: '全部', icon: '🌐' },
  { code: 'F001', name: '时令水果', icon: '🍎' },
  { code: 'F002', name: '新鲜蔬菜', icon: '🥬' },
  { code: 'F003', name: '粮油米面', icon: '🍚' },
  { code: 'F001_citrus', name: '柑橘类', icon: '🍊' },
  { code: 'F001_berry', name: '浆果类', icon: '🍓' },
  { code: 'F001_melon', name: '瓜果类', icon: '🍉' },
  { code: 'F002_leafy', name: '叶菜类', icon: '🥗' },
  { code: 'F002_root', name: '根茎类', icon: '🥕' },
  { code: 'F002_mushroom', name: '菌菇类', icon: '🍄' },
  { code: 'F003_grain', name: '米面粮油', icon: '🌾' },
  { code: 'F003_protein', name: '肉蛋蛋白', icon: '🥚' },
]

const SORTS = [
  { key: 'sales', label: '🔥 销量优先' },
  { key: 'price-asc', label: '💰 价格升序' },
  { key: 'price-desc', label: '💎 价格降序' },
  { key: 'newest', label: '🆕 最新' },
]

const QM_LABELS: Record<string, { label: string; color: string }> = {
  '食品': { label: '食品', color: 'rgba(255, 213, 79, 0.7)' },
  '有机': { label: '有机', color: 'rgba(184, 134, 11, 0.95)' },
  '绿色': { label: '绿色', color: 'rgba(184, 134, 11, 0.8)' },
  '无公害': { label: '无公害', color: 'rgba(189, 178, 255, 0.9)' },
  '进口': { label: '进口', color: 'rgba(127, 200, 255, 0.95)' },
  '国产': { label: '国产', color: 'rgba(255, 184, 108, 0.95)' },
  '有机认证': { label: '有机认证', color: 'rgba(184, 134, 11, 1)' },
  // ⭐ MEMORY 183 — 处方药整条移出线上体系
  '处方药': { label: '', color: 'rgba(184, 134, 11, 0.95)' },
  'Rx': { label: '', color: 'rgba(184, 134, 11, 0.95)' },
  '处方': { label: '', color: 'rgba(184, 134, 11, 0.95)' },
}

export default function ProductsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // ⭐ MEMORY §282 — /search ↔ /products 互通:URL ?q=?category= 作为初始状态
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [q, setQ] = useState('')
  const [qInput, setQInput] = useState('')
  const [category, setCategory] = useState(searchParams.get('category') || '')
  const [sort, setSort] = useState('sales')
  const [inStockOnly, setInStockOnly] = useState(false)
  const [qmFilter, setQmFilter] = useState('')  // 质量管理分类筛选
  const debounceRef = useRef<any>(null)
  const observerRef = useRef<any>(null)

  const fetchProducts = useCallback(async (reset = false) => {
    const p = reset ? 1 : page
    if (reset) setLoading(true)
    else setLoadingMore(true)
    
    try {
      const params = new URLSearchParams({
        // merchantCode 移除:让 API 默认 G0001(果蔬鲜生),不再传老药店 0005
        page: String(p),
        pageSize: '20',
        sort,
      })
      if (q) params.set('q', q)
      if (category) params.set('category', category)
      if (qmFilter) params.set('qm', qmFilter)
      if (inStockOnly) params.set('inStock', '1')
      
      const res = await fetch(`/api/products?${params}`)
      const data = await res.json()
      
      if (data.success) {
        if (reset) setProducts(data.products)
        else setProducts((prev) => [...prev, ...data.products])
        setTotal(data.total)
        setHasMore(data.page < data.totalPages)
        if (!reset) setPage(p + 1)
        else setPage(2)
      } else {
        console.error('API error:', data.error)
      }
    } catch (e) {
      console.error('Fetch error:', e)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [q, category, sort, inStockOnly, qmFilter, page])

  // 首次加载 + 条件变化
  useEffect(() => {
    fetchProducts(true)
  }, [q, category, sort, inStockOnly, qmFilter])

  // ⭐ MEMORY §282 — 同步 URL ?q=?category= 到本地 state(从 /search 跳过来保留状态)
  useEffect(() => {
    const urlQ = searchParams.get('q') || ''
    const urlC = searchParams.get('category') || ''
    if (urlQ !== qInput) setQInput(urlQ)
    if (urlC !== category) setCategory(urlC)
  }, [searchParams])

  // 搜索 debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setQ(qInput.trim())
    }, 350)
    return () => clearTimeout(debounceRef.current)
  }, [qInput])

  // IntersectionObserver 加载更多
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect()
    if (!hasMore) return

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMore && hasMore) {
          fetchProducts(false)
        }
      },
      { rootMargin: '200px' }
    )

    const el = document.getElementById('load-more-trigger')
    if (el) observerRef.current.observe(el)

    return () => observerRef.current?.disconnect()
  }, [hasMore, loadingMore, fetchProducts])

  // ===== 滚动入场动画（奕霖 2026-07-19 18:52 授权）=====
  // IntersectionObserver 监听 .qh-enter，触发后加 .is-visible
  // 8 个一组 stagger，剩余项由 observer 顺序触发的微小时间差替代
  useEffect(() => {
    if (products.length === 0) return
    const els = document.querySelectorAll<HTMLElement>('.qh-enter:not(.is-visible)')
    if (els.length === 0) return

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
            obs.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.05, rootMargin: '0px 0px -40px 0px' }
    )
    els.forEach((el) => obs.observe(el))
    return () => obs.disconnect()
  }, [products, loading])

  return (
    <AppLayout
      title="找药 · 果蔬鲜生"
      activePath="/products"
    >
      {/* ⭐ 奕霖 2026-07-24 16:53 反馈图：FAB 压住最后几件商品「加入购物车」按钮
          FAB 顶 y ≈ bottom(96) + 高度(52) = 148px + 安全距离 24 = 172 → paddingBottom 180 */}
      <div style={{ paddingBottom: '180px' }}>
        {/* 搜索框 */}
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 50,
            background: 'linear-gradient(180deg, rgba(13, 31, 23, 0.95) 0%, rgba(13, 31, 23, 0.85) 100%)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            padding: '12px 16px 8px',
            borderBottom: `1px solid rgba(${GREEN_RGB}, 0.1)`,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(255, 255, 255, 0.06)',
              border: `1px solid rgba(${GREEN_RGB}, 0.15)`,
              borderRadius: '14px',
              padding: '10px 14px',
            }}
          >
            <span style={{ fontSize: '16px', opacity: 0.6 }}>🔍</span>
            <input
              type="text"
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder="搜水果 / 蔬菜 / 粮油 / 产地"
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#fff',
                fontSize: '14px',
                fontFamily: 'inherit',
              }}
            />
            {qInput && (
              <button
                onClick={() => setQInput('')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255,255,255,0.4)',
                  cursor: 'pointer',
                  fontSize: '16px',
                }}
              >
                ✕
              </button>
            )}
          </div>
          
          {/* 快捷筛选行 */}
          <div
            style={{
              display: 'flex',
              gap: '8px',
              marginTop: '10px',
              overflowX: 'auto',
              scrollbarWidth: 'none',
            }}
          >
            {/* 库存切换 */}
            <button
              onClick={() => setInStockOnly(!inStockOnly)}
              style={{
                flexShrink: 0,
                padding: '5px 12px',
                borderRadius: '14px',
                border: 'none',
                background: inStockOnly
                  ? `linear-gradient(135deg, rgba(${GREEN_RGB}, 0.25), rgba(${GREEN_RGB}, 0.12))`
                  : 'rgba(255,255,255,0.05)',
                color: inStockOnly ? GREEN : 'rgba(255,255,255,0.6)',
                fontSize: '12px',
                fontWeight: inStockOnly ? 600 : 500,
                cursor: 'pointer',
              }}
            >
              {inStockOnly ? '✓ 有货' : '⏵ 全部'}
            </button>
            
            {/* 排序 */}
            {SORTS.map((s) => (
              <button
                key={s.key}
                onClick={() => setSort(s.key)}
                style={{
                  flexShrink: 0,
                  padding: '5px 12px',
                  borderRadius: '14px',
                  border: 'none',
                  background: sort === s.key
                    ? `linear-gradient(135deg, rgba(${GREEN_RGB}, 0.25), rgba(${GREEN_RGB}, 0.12))`
                    : 'rgba(255,255,255,0.05)',
                  color: sort === s.key ? GREEN : 'rgba(255,255,255,0.6)',
                  fontSize: '12px',
                  fontWeight: sort === s.key ? 600 : 500,
                  cursor: 'pointer',
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* 分类导航 - 横滑 */}
        <div
          style={{
            display: 'flex',
            gap: '10px',
            padding: '14px 16px 8px',
            overflowX: 'auto',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {CATEGORIES.map((c) => {
            const active = c.code === category
            return (
              <button
                key={c.code || 'all'}
                onClick={() => setCategory(c.code)}
                style={{
                  flexShrink: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '8px 12px',
                  borderRadius: '12px',
                  border: active
                    ? `1px solid rgba(${GREEN_RGB}, 0.4)`
                    : '1px solid rgba(255,255,255,0.06)',
                  background: active
                    ? `linear-gradient(135deg, rgba(${GREEN_RGB}, 0.18), rgba(${GREEN_RGB}, 0.08))`
                    : 'rgba(255,255,255,0.03)',
                  color: active ? GREEN : 'rgba(255,255,255,0.75)',
                  fontSize: '11px',
                  fontWeight: active ? 600 : 500,
                  cursor: 'pointer',
                  minWidth: '60px',
                  transition: 'all 0.15s ease',
                }}
              >
                <span style={{ fontSize: '20px' }}>{c.icon}</span>
                <span>{c.name}</span>
              </button>
            )
          })}
        </div>

        {/* 质量管理分类筛选条 */}
        {Object.keys(QM_LABELS).length > 0 && (
          <div
            style={{
              display: 'flex',
              gap: '6px',
              padding: '0 16px 8px',
              overflowX: 'auto',
              scrollbarWidth: 'none',
            }}
          >
            <button
              onClick={() => setQmFilter('')}
              style={{
                flexShrink: 0,
                padding: '3px 9px',
                borderRadius: '10px',
                border: 'none',
                background: !qmFilter
                  ? `rgba(${GREEN_RGB}, 0.2)`
                  : 'rgba(255,255,255,0.05)',
                color: !qmFilter ? GREEN : 'rgba(255,255,255,0.55)',
                fontSize: '10px',
                cursor: 'pointer',
              }}
            >
              全部
            </button>
            {Object.entries(QM_LABELS).map(([k, v]) => (
              <button
                key={k}
                onClick={() => setQmFilter(k)}
                style={{
                  flexShrink: 0,
                  padding: '3px 9px',
                  borderRadius: '10px',
                  border: 'none',
                  background: qmFilter === k
                    ? `rgba(${GREEN_RGB}, 0.2)`
                    : 'rgba(255,255,255,0.05)',
                  color: qmFilter === k ? GREEN : 'rgba(255,255,255,0.55)',
                  fontSize: '10px',
                  cursor: 'pointer',
                }}
              >
                {v.label}
              </button>
            ))}
          </div>
        )}

        {/* 顶部统计 + 提示 */}
        <div
          style={{
            padding: '4px 16px 12px',
            fontSize: '12px',
            color: `rgba(${GREEN_RGB}, 0.6)`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>
            {loading ? '加载中...' : (
              <>共 <span style={{ color: GREEN, fontWeight: 600 }}>{total.toLocaleString()}</span> 件商品</>
            )}
          </span>
          {q && <span>搜索: <span style={{ color: GREEN }}>{q}</span></span>}
        </div>

        {/* 商品网格 */}
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>⏳</div>
            加载中...
          </div>
        ) : products.length === 0 ? (
          <div
            style={{
              padding: '60px 20px',
              textAlign: 'center',
              color: 'rgba(255,255,255,0.5)',
            }}
          >
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
            <div style={{ fontSize: '15px', marginBottom: '8px' }}>没找到商品</div>
            <div style={{ fontSize: '12px' }}>试试调整筛选或换关键词</div>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '10px',
              padding: '0 16px',
            }}
          >
            {products.map((p, idx) => (
              <div
                key={p.id}
                className={`qh-enter qh-stagger-${Math.min(idx, 7)}`}
              >
                <ProductCard p={p} onClick={() => router.push(`/products/${p.id}`)} />
              </div>
            ))}
          </div>
        )}

        {/* 加载更多触发器 */}
        {hasMore && (
          <div id="load-more-trigger" style={{ padding: '24px', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>
            {loadingMore ? '⏳ 加载中...' : '↓ 下滑加载更多'}
          </div>
        )}
        
        {!hasMore && products.length > 0 && (
          <div style={{ padding: '24px', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>
            — 到底了 —
          </div>
        )}
      </div>
    </AppLayout>
  )
}

function ProductCard({ p, onClick }: { p: any; onClick: () => void }) {
  const qm = QM_LABELS[p.qualityClass] || { label: p.qualityClass || '其他', color: 'rgba(255,255,255,0.5)' }
  const outOfStock = p.stock === 0
  const discount = p.memberPrice && p.memberPrice < p.price
    ? Math.round((1 - p.memberPrice / p.price) * 100)
    : 0
  const [added, setAdded] = useState(false)

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (outOfStock) return
    quickAddToCart({
      id: p.id,
      name: p.name,
      price: p.price,
      spec: p.spec,
      category: p.category,
      categoryLabel: p.categoryLabel,
    })
    setAdded(true)
    setTimeout(() => setAdded(false), 1500)
  }

  return (
    <button
      onClick={onClick}
      className="qh-card-lift qh-press"
      style={{
        width: '100%',
        background: CARD_BG,
        border: `1px solid rgba(${GREEN_RGB}, 0.08)`,
        borderRadius: '14px',
        padding: '12px',
        textAlign: 'left',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* 商品图(优先真实图,fallback emoji) */}
      <div
        style={{
          width: '100%',
          aspectRatio: '1',
          background: `linear-gradient(135deg, rgba(${GREEN_RGB}, 0.1), rgba(${GREEN_RGB}, 0.04))`,
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '48px',
          marginBottom: '10px',
          position: 'relative',
        }}
      >
        <img
          src={`/api/product-image/${p.id}`}
          alt={p.name}
          loading="lazy"
          style={{
            width: '78%',
            height: '78%',
            objectFit: 'contain',
            opacity: outOfStock ? 0.3 : 1,
            filter: outOfStock ? 'grayscale(0.5)' : 'none',
          }}
        />
        {outOfStock && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0,0,0,0.4)',
              borderRadius: '10px',
              fontSize: '13px',
              color: 'rgba(255,200,200,0.95)',
              fontWeight: 600,
            }}
          >
            缺货
          </div>
        )}
        {/* 标签 */}
        <div
          style={{
            position: 'absolute',
            top: '6px',
            left: '6px',
            display: 'flex',
            gap: '4px',
          }}
        >
          <span
            style={{
              padding: '2px 6px',
              borderRadius: '4px',
              background: qm.color,
              color: '#0a0f0d',
              fontSize: '9px',
              fontWeight: 700,
            }}
          >
            {qm.label}
          </span>
          {discount > 0 && (
            <span
              style={{
                padding: '2px 6px',
                borderRadius: '4px',
                background: 'rgba(255, 100, 100, 0.9)',
                color: '#fff',
                fontSize: '9px',
                fontWeight: 700,
              }}
            >
              -{discount}%
            </span>
          )}
        </div>
      </div>

      {/* 名称 */}
      <div
        style={{
          fontSize: '12.5px',
          color: 'rgba(255,255,255,0.9)',
          lineHeight: 1.4,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          minHeight: '35px',
          marginBottom: '4px',
        }}
      >
        {p.name}
      </div>
      
      {/* 规格 */}
      {p.spec && (
        <div
          style={{
            fontSize: '10px',
            color: 'rgba(255,255,255,0.4)',
            marginBottom: '8px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {p.spec}
        </div>
      )}
      
      {/* 价格区 */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '17px', fontWeight: 700, color: GREEN }}>
          {formatPricePerWeight(p.price, p.weightGram, p.memberPrice)}
        </span>
        {p.memberPrice && p.memberPrice < p.price && (
          <span
            style={{
              fontSize: '10px',
              color: 'rgba(255,255,255,0.35)',
              textDecoration: 'line-through',
            }}
          >
            ¥{p.price?.toFixed(2)}
          </span>
        )}
      </div>
      
      {/* 销量 */}
      {p.sales30d > 0 && (
        <div
          style={{
            fontSize: '9.5px',
            color: 'rgba(255,255,255,0.3)',
            marginTop: '4px',
          }}
        >
          🔥 30天售 {p.sales30d}
        </div>
      )}

      {/* 加购按钮 */}
      <button
        onClick={handleAdd}
        disabled={outOfStock}
        className={`qh-press${added ? ' qh-cart-pop' : ''}`}
        style={{
          marginTop: '8px',
          width: '100%',
          padding: '6px 10px',
          fontSize: '12px',
          fontWeight: 600,
          background: added
            ? `rgba(${GREEN_RGB}, 0.2)`
            : outOfStock
            ? 'rgba(255,255,255,0.05)'
            : `rgba(${GREEN_RGB}, 0.15)`,
          color: added ? GREEN : outOfStock ? 'rgba(255,255,255,0.3)' : GREEN,
          border: added ? `1px solid ${GREEN}` : 'none',
          borderRadius: '8px',
          cursor: outOfStock ? 'not-allowed' : 'pointer',
        }}
      >
        {outOfStock ? '缺货' : added ? '✓ 已加入' : '🛒 加入购物车'}
      </button>
    </button>
  )
}
