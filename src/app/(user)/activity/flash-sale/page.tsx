'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/AppLayout'
import { quickAddToCart, getCartCount } from '@/lib/cart'
import { useUserStore } from '@/stores/userStore'
import { useToast } from '@/components/ui/Toast'

/**
 * /activity/flash-sale — 限时秒杀独立页
 * 奕霖 2026-08-05 21:29：限时秒杀"显示更多"进入另一个界面
 */

interface FlashItem {
  id: string
  name: string
  spec: string | null
  price: number
  originalPrice?: number
  stock: number
  image: string | null
  category: string
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

export default function FlashSalePage() {
  const router = useRouter()
  const { user } = useUserStore()
  const { toast } = useToast()
  const [items, setItems] = useState<FlashItem[]>([])
  const [flashSales, setFlashSales] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [cartCount, setCartCount] = useState(0)
  const [selectedType, setSelectedType] = useState<string>('all')

  // 加载
  useEffect(() => {
    fetch('/api/public/activities', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setFlashSales(d.flashSales || [])
          loadProducts(d.flashSales || [])
        }
      })
      .finally(() => setLoading(false))
    setCartCount(getCartCount())
  }, [])

  const loadProducts = async (sales: any[]) => {
    if (sales.length === 0) {
      setItems([])
      return
    }
    const allIds = new Set<string>()
    sales.forEach((f: any) => (f.productIds || []).forEach((id: string) => allIds.add(id)))
    const results: FlashItem[] = []
    for (const id of allIds) {
      try {
        const r = await fetch(`/api/products/${id}`, { cache: 'no-store' })
        const j = await r.json()
        if (j.success && j.product) {
          results.push({
            id: j.product.id,
            name: j.product.name,
            spec: j.product.spec,
            price: Number(j.product.price || 0),
            originalPrice: j.product.memberPrice || j.product.price * 1.5,
            stock: Number(j.product.stock || 0),
            image: j.product.image,
            category: j.product.category || '',
          })
        }
      } catch {}
    }
    setItems(results.filter(i => i.stock > 0))
  }

  const filtered = selectedType === 'all'
    ? items
    : items.filter(i => (i.category || '').includes(selectedType))

  const handleAdd = (item: FlashItem) => {
    if (item.stock <= 0) { toast('该商品暂时缺货', 'err'); return }
    quickAddToCart({
      id: item.id, name: item.name, price: item.price, spec: item.spec || '', category: item.category,
    })
    setCartCount(getCartCount())
    toast(`✓ ${item.name} 已加入购物车`, 'ok')
  }

  // 计算最早结束的活动
  const firstFlash = flashSales[0]
  const cd = useCountdown(firstFlash?.endAt || null)

  return (
    <AppLayout title="限时秒杀" activePath="activity">
      <div style={{ minHeight: '100vh', paddingBottom: '100px', background: 'linear-gradient(180deg, #2c1810 0%, #1a0e08 100%)', color: '#fff' }}>
        {/* Header */}
        <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => router.back()} style={{ background: 'transparent', color: 'rgba(255,255,255,0.6)', border: 'none', fontSize: 13, cursor: 'pointer' }}>← 返回</button>
        </div>

        {/* 倒计时 Hero */}
        {firstFlash && !cd.done && (
          <div style={{ margin: '0 16px 16px', padding: '16px', background: 'linear-gradient(135deg, #c1272d 0%, #d35400 50%, #f39c12 100%)', borderRadius: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', letterSpacing: '2px', marginBottom: 8 }}>⏰ 限时秒杀</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#fff', marginBottom: 6 }}>{firstFlash.title || '秒杀进行中'}</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              {[
                { v: cd.h, l: '时' },
                { v: cd.m, l: '分' },
                { v: cd.s, l: '秒' },
              ].map((t, i) => (
                <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ padding: '6px 10px', borderRadius: 6, background: 'rgba(0,0,0,0.4)', fontSize: 16, fontWeight: 700, color: '#fff', minWidth: 40, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{String(t.v).padStart(2, '0')}</span>
                  {i < 2 && <span style={{ color: 'rgba(255,255,255,0.6)' }}>:</span>}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 分类 chips */}
        {items.length > 0 && (
          <div style={{ display: 'flex', gap: 6, padding: '0 16px 12px', overflowX: 'auto' }}>
            {[
              { k: 'all', label: '全部' },
              { k: '感冒', label: '感冒咳嗽' },
              { k: '0105', label: 'OTC' },
            ].filter((t, i, arr) => i === 0 || items.some(it => (it.category || '').includes(t.k))).map((t) => (
              <button key={t.k} onClick={() => setSelectedType(t.k)} style={{ padding: '6px 12px', borderRadius: 14, fontSize: 11, fontWeight: 600, background: selectedType === t.k ? 'rgba(184, 134, 11,0.2)' : 'rgba(255,255,255,0.06)', border: selectedType === t.k ? '1px solid rgba(184, 134, 11,0.4)' : '1px solid rgba(255,255,255,0.1)', color: selectedType === t.k ? '#b8860b' : 'rgba(255,255,255,0.7)', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>{t.label}</button>
            ))}
          </div>
        )}

        {/* 列表 */}
        <div style={{ padding: '0 16px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.5)' }}>加载中...</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.5)' }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>⏰</div>
              <div style={{ fontSize: 13 }}>暂无秒杀商品</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {filtered.map((item) => {
                const outOfStock = item.stock <= 0
                const original = item.originalPrice || item.price * 1.5
                return (
                  <div key={item.id} style={{
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 14, padding: 12, position: 'relative', display: 'flex', flexDirection: 'column',
                  }}>
                    {/* 秒杀标签 */}
                    <div style={{ position: 'absolute', top: 8, right: 8, padding: '2px 6px', borderRadius: 6, background: 'rgba(255,107,107,0.85)', fontSize: 9, color: '#fff', fontWeight: 700 }}>秒杀</div>
                    {/* 商品图 */}
                    <div style={{ width: '100%', aspectRatio: '4/3', background: 'rgba(184, 134, 11,0.05)', borderRadius: 8, marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, overflow: 'hidden' }}>
                      {item.image ? <img src={item.image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '🍵'}
                    </div>
                    {/* 商品名 */}
                    <div style={{ fontSize: 12, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>{item.name}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 6 }}>{item.spec || ''}</div>
                    {/* 价格 */}
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6 }}>
                      <span style={{ fontSize: 16, fontWeight: 800, color: '#ff6b6b' }}>¥{item.price.toFixed(2)}</span>
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', textDecoration: 'line-through' }}>¥{Number(original).toFixed(2)}</span>
                    </div>
                    {/* 库存 + 按钮 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 'auto' }}>
                      <span style={{ fontSize: 9, color: outOfStock ? '#ff9a6b' : 'rgba(255,255,255,0.5)', flex: 1 }}>{outOfStock ? '缺货' : `剩 ${item.stock} 件`}</span>
                      <button onClick={() => handleAdd(item)} disabled={outOfStock} style={{
                        padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                        background: outOfStock ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg, #ff6b6b, #f472b6)',
                        color: outOfStock ? 'rgba(255,255,255,0.4)' : '#fff',
                        border: 'none', cursor: outOfStock ? 'not-allowed' : 'pointer',
                      }}>加入购物车</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 浮动购物车按钮 */}
        {cartCount > 0 && (
          <button onClick={() => router.push('/cart')} style={{ position: 'fixed', right: 16, bottom: 80, width: 56, height: 56, borderRadius: 28, background: 'linear-gradient(135deg, #b8860b, #b8860b)', color: '#2c1810', fontSize: 22, fontWeight: 700, border: 'none', boxShadow: '0 8px 24px rgba(184, 134, 11,0.4)', zIndex: 50, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            🛒 {cartCount > 99 ? '99+' : cartCount}
          </button>
        )}
      </div>
    </AppLayout>
  )
}
