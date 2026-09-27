'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { useToast } from '@/components/ui/Toast'

interface Product {
  id: string
  productCode: string
  name: string
  shortName: string | null
  spec: string | null
  price: number
  stock: number
  unit: string | null
  category: string | null
  categoryLabel: string | null
  manufacturer: string | null
}

interface Activity {
  id: string
  title: string
  type: string
  status: string
  productIds: string[] | null
}

function ProductsPickerInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const activityId = searchParams.get('activityId') || ''
  const toastCtx = useToast()
  const toast = (msg: string, type: 'ok' | 'err' | 'warn' | 'info' = 'ok') => toastCtx.toast(msg, type)

  const [authChecked, setAuthChecked] = useState(false)
  const [activity, setActivity] = useState<Activity | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const [searchQ, setSearchQ] = useState('')
  const [category, setCategory] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 30

  // 已选商品 ID（来自活动 + 用户额外选择）
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  // 已选商品详情（右上角 sticky 显示）
  const [selectedDetails, setSelectedDetails] = useState<Map<string, Product>>(new Map())

  // 1. PIN 校验
  useEffect(() => {
    const cookies = document.cookie
    const match = cookies.match(/zhilin-admin-token=([^;]+)/)
    if (!match || !match[1].startsWith('pin-')) {
      router.push('/admin')
      return
    }
    setAuthChecked(true)
  }, [router])

  // 2. 加载活动详情 + 已选商品 ID
  useEffect(() => {
    if (!authChecked || !activityId) return
    ;(async () => {
      try {
        // 拉活动基本信息
        const actRes = await fetch('/api/admin/activities', { cache: 'no-store' })
        const actJson = await actRes.json()
        if (actJson.success) {
          const act = (actJson.activities || []).find((a: any) => a.id === activityId)
          if (act) {
            setActivity({
              id: act.id,
              title: act.title,
              type: act.type,
              status: act.status,
              productIds: null, // productIds 不在 GET 列表里，等保存后回填
            })
          }
        }
      } catch {
        // ignore
      }
    })()
  }, [authChecked, activityId])

  // 3. 加载商品列表
  useEffect(() => {
    if (!authChecked) return
    setLoading(true)
    const params = new URLSearchParams()
    if (searchQ.trim()) params.set('q', searchQ.trim())
    if (category.trim()) params.set('category', category.trim())
    params.set('page', String(page))
    params.set('limit', String(pageSize))

    fetch(`/api/admin/products-list?${params.toString()}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setProducts(data.products || [])
          setTotal(data.total || 0)
        }
      })
      .catch((e: any) => toast(`加载失败：${e.message}`, 'err'))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authChecked, searchQ, category, page])

  // 4. 切换商品选中状态
  const toggleSelect = (p: Product) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(p.id)) {
        next.delete(p.id)
        setSelectedDetails((d) => {
          const m = new Map(d)
          m.delete(p.id)
          return m
        })
      } else {
        next.add(p.id)
        setSelectedDetails((d) => {
          const m = new Map(d)
          m.set(p.id, p)
          return m
        })
      }
      return next
    })
  }

  // 5. 整页全选 / 全取消
  const toggleSelectAllOnPage = () => {
    const allOnPageSelected = products.length > 0 && products.every((p) => selectedIds.has(p.id))
    setSelectedIds((prev) => {
      const next = new Set(prev)
      setSelectedDetails((d) => {
        const m = new Map(d)
        if (allOnPageSelected) {
          products.forEach((p) => {
            next.delete(p.id)
            m.delete(p.id)
          })
        } else {
          products.forEach((p) => {
            next.add(p.id)
            m.set(p.id, p)
          })
        }
        return m
      })
      return next
    })
  }

  // 6. 保存到活动
  const [saving, setSaving] = useState(false)
  const saveSelection = async () => {
    if (!activityId) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/activities/${activityId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productIds: Array.from(selectedIds),
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast(`✓ 已保存 ${selectedIds.size} 个商品到活动`, 'ok')
        setActivity((a) => (a ? { ...a, productIds: Array.from(selectedIds) } : a))
      } else {
        toast(`保存失败：${json.error}`, 'err')
      }
    } catch (e: any) {
      toast(`网络错误：${e.message}`, 'err')
    } finally {
      setSaving(false)
    }
  }

  if (!authChecked) {
    return (
      <AdminLayout title="选择活动商品" active="activities">
        <div style={{ padding: 60, textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>验证登录...</div>
      </AdminLayout>
    )
  }

  if (!activityId) {
    return (
      <AdminLayout title="选择活动商品" active="activities">
        <div style={{ padding: 60, textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
          缺少 activityId 参数
          <div style={{ marginTop: 16 }}>
            <Link href="/admin/activities" style={{ color: '#fbbf24', textDecoration: 'none', fontSize: 14 }}>← 返回活动列表</Link>
          </div>
        </div>
      </AdminLayout>
    )
  }

  const totalPages = Math.ceil(total / pageSize)
  const allOnPageSelected = products.length > 0 && products.every((p) => selectedIds.has(p.id))

  return (
    <AdminLayout title="选择活动商品" active="activities">
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* 顶部：活动名 + 步骤条 */}
        <div style={{ background: 'linear-gradient(135deg, rgba(127, 220, 148, 0.08) 0%, rgba(127, 220, 148, 0.02) 100%)', border: '1px solid rgba(127, 220, 148, 0.2)', borderRadius: 14, padding: '16px 20px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: 'rgba(127, 220, 148, 0.7)', marginBottom: 4, letterSpacing: 1 }}>📦 STEP 2 · 选择商品</div>
              <div style={{ fontSize: 18, color: '#fff', fontWeight: 700 }}>{activity?.title || activityId}</div>
              {activity && (
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
                  类型：{activity.type} · 状态：{activity.status}
                </div>
              )}
            </div>
            <Link href="/admin/activities" style={{ padding: '8px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: 13, fontWeight: 600, border: '1px solid rgba(255,255,255,0.1)' }}>
              ← 返回列表
            </Link>
          </div>
        </div>

        {/* 工具栏 */}
        <div style={{ background: 'rgba(35, 74, 53, 0.3)', border: '1px solid rgba(127, 220, 148, 0.1)', borderRadius: 14, padding: 14, marginBottom: 12, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="🔍 搜商品名 / 简码 / 编号"
            value={searchQ}
            onChange={(e) => { setSearchQ(e.target.value); setPage(1) }}
            style={{ flex: 1, minWidth: 220, padding: '10px 14px', borderRadius: 10, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(127,220,148,0.2)', color: '#fff', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
          />
          <input
            type="text"
            placeholder="📂 分类（如：0105）"
            value={category}
            onChange={(e) => { setCategory(e.target.value); setPage(1) }}
            style={{ width: 180, padding: '10px 14px', borderRadius: 10, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(127,220,148,0.2)', color: '#fff', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
          />
          <button
            onClick={toggleSelectAllOnPage}
            disabled={products.length === 0}
            style={{ padding: '10px 16px', borderRadius: 10, background: allOnPageSelected ? 'rgba(239, 68, 68, 0.15)' : 'rgba(127, 220, 148, 0.15)', color: allOnPageSelected ? '#fca5a5' : '#fbbf24', border: `1px solid ${allOnPageSelected ? 'rgba(239,68,68,0.3)' : 'rgba(127,220,148,0.3)'}`, fontSize: 13, fontWeight: 600, cursor: products.length === 0 ? 'not-allowed' : 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
          >
            {allOnPageSelected ? `✗ 取消本页 (${products.length})` : `✓ 全选本页 (${products.length})`}
          </button>
        </div>

        {/* 商品表格 */}
        <div style={{ background: 'rgba(35, 74, 53, 0.3)', border: '1px solid rgba(127, 220, 148, 0.1)', borderRadius: 14, overflow: 'hidden', marginBottom: 12 }}>
          {loading ? (
            <div style={{ padding: 60, textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>加载中…</div>
          ) : products.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>
              📭 没有匹配的商品
              <div style={{ fontSize: 11, marginTop: 8, opacity: 0.6 }}>试试换个搜索词或分类</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'rgba(127, 220, 148, 0.06)', borderBottom: '1px solid rgba(127, 220, 148, 0.15)' }}>
                    <th style={{ padding: '12px 16px', textAlign: 'left', color: 'rgba(255,255,255,0.7)', fontWeight: 600, fontSize: 12, width: 60 }}>选</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', color: 'rgba(255,255,255,0.7)', fontWeight: 600, fontSize: 12 }}>商品名</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', color: 'rgba(255,255,255,0.7)', fontWeight: 600, fontSize: 12, width: 140 }}>规格</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', color: 'rgba(255,255,255,0.7)', fontWeight: 600, fontSize: 12, width: 90 }}>售价</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', color: 'rgba(255,255,255,0.7)', fontWeight: 600, fontSize: 12, width: 80 }}>库存</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', color: 'rgba(255,255,255,0.7)', fontWeight: 600, fontSize: 12, width: 100 }}>分类</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => {
                    const isSelected = selectedIds.has(p.id)
                    return (
                      <tr
                        key={p.id}
                        onClick={() => toggleSelect(p)}
                        style={{ borderBottom: '1px solid rgba(127,220,148,0.06)', background: isSelected ? 'rgba(127, 220, 148, 0.08)' : 'transparent', cursor: 'pointer' }}
                      >
                        <td style={{ padding: '10px 16px' }}>
                          <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(p)} style={{ cursor: 'pointer', width: 16, height: 16 }} />
                        </td>
                        <td style={{ padding: '10px 16px', color: '#fff', fontWeight: 500 }}>
                          <div>{p.shortName || p.name}</div>
                          {p.manufacturer && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{p.manufacturer}</div>}
                        </td>
                        <td style={{ padding: '10px 16px', color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{p.spec || '—'}</td>
                        <td style={{ padding: '10px 16px', color: '#fbbf24', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>¥{p.price.toFixed(2)}</td>
                        <td style={{ padding: '10px 16px', color: p.stock < 20 ? '#fca5a5' : 'rgba(255,255,255,0.7)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{p.stock}</td>
                        <td style={{ padding: '10px 16px', color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{p.categoryLabel || p.category || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 分页 */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <button disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))} style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', fontSize: 12, cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.4 : 1 }}>
              ← 上一页
            </button>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', padding: '0 8px' }}>
              第 {page} / {totalPages} 页（共 {total} 件）
            </span>
            <button disabled={page === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', fontSize: 12, cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.4 : 1 }}>
              下一页 →
            </button>
          </div>
        )}

        {/* 底部 sticky 保存栏 */}
        <div style={{ position: 'sticky', bottom: 0, background: 'linear-gradient(180deg, rgba(13, 31, 22, 0.95) 0%, rgba(13, 31, 22, 0.98) 100%)', border: '1px solid rgba(127, 220, 148, 0.2)', borderRadius: 14, padding: '14px 18px', marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, backdropFilter: 'blur(10px)' }}>
          <div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>已选</div>
            <div style={{ fontSize: 20, color: '#fbbf24', fontWeight: 700, marginTop: 2 }}>{selectedIds.size}<span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', fontWeight: 400, marginLeft: 4 }}>件商品</span></div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => { setSelectedIds(new Set()); setSelectedDetails(new Map()) }}
              disabled={selectedIds.size === 0}
              style={{ padding: '10px 18px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.1)', fontSize: 13, fontWeight: 600, cursor: selectedIds.size === 0 ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: selectedIds.size === 0 ? 0.4 : 1 }}
            >清空选择</button>
            <button
              onClick={saveSelection}
              disabled={saving}
              style={{ padding: '10px 24px', borderRadius: 10, background: saving ? 'rgba(127,220,148,0.3)' : 'linear-gradient(135deg, #fbbf24, #4ade80)', color: '#0a0f0d', border: 'none', fontSize: 14, fontWeight: 700, cursor: saving ? 'wait' : 'pointer', fontFamily: 'inherit' }}
            >{saving ? '保存中...' : `✓ 保存到活动 (${selectedIds.size})`}</button>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}

export default function ProductsPickerPage() {
  return (
    <Suspense fallback={<div style={{ padding: 60, textAlign: 'center', color: '#fff' }}>加载中...</div>}>
      <ProductsPickerInner />
    </Suspense>
  )
}