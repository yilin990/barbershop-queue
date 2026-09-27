'use client'

import { confirmDialog } from '@/lib/ui-bus'
import { useEffect, useState } from 'react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { colors, fontSize, fontWeight, radius, spacing, animation } from '@/lib/design-tokens'
import { Gift, Save, Plus, Trash2, RefreshCw, Filter } from 'lucide-react'

type Tab = 'config' | 'products' | 'log'

interface PointsConfig {
  id: string | null
  merchantId: string
  earnRate: number
  pointValue: number
  minRedeem: number
}

interface PointsProduct {
  id: string
  productId: string
  productName: string
  shortName: string | null
  spec: string | null
  image: string | null
  unit: string | null
  category: string | null
  currentPrice: number
  pointsRequired: number
  originalPrice: number
  stock: number
  status: string
  createdAt: string
}

interface PointsLogRow {
  id: string
  userId: string
  phone: string
  delta: number
  balance: number
  type: string
  refType: string
  refId: string
  description: string
  amount: number
  reason: string
  customerNickname: string
  createdAt: string
}

const inputStyle = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: radius.base,
  border: `1px solid ${colors.borderMuted}`,
  background: 'rgba(255,255,255,0.04)',
  color: colors.text,
  fontSize: fontSize.sm,
  outline: 'none',
}

const btnPrimary = {
  padding: '8px 16px',
  borderRadius: radius.base,
  background: colors.primary,
  color: '#fff',
  border: 'none',
  fontWeight: fontWeight.semibold,
  cursor: 'pointer',
  fontSize: fontSize.sm,
}

const btnDanger = {
  padding: '6px 10px',
  borderRadius: radius.base,
  background: 'transparent',
  color: '#ff6b6b',
  border: '1px solid #ff6b6b40',
  cursor: 'pointer',
  fontSize: fontSize.xs,
}

export default function AdminPointsPage() {
  const [tab, setTab] = useState<Tab>('config')
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const [config, setConfig] = useState<PointsConfig | null>(null)
  const [isDefault, setIsDefault] = useState(false)
  const [form, setForm] = useState({ earnRate: 0.05, pointValue: 0.01, minRedeem: 100 })

  const [products, setProducts] = useState<PointsProduct[]>([])
  const [ppSaving, setPpSaving] = useState(false)
  const [ppForm, setPpForm] = useState({
    productId: '',
    pointsRequired: 100,
    originalPrice: 0,
    stock: 1,
  })
  const [ppSearch, setPpSearch] = useState('')
  const [ppSearchResults, setPpSearchResults] = useState<any[]>([])
  const [ppImgErrors, setPpImgErrors] = useState<Set<string>>(new Set())
  const [pickImgErrors, setPickImgErrors] = useState<Set<string>>(new Set())

  const [logs, setLogs] = useState<PointsLogRow[]>([])
  const [logFilter, setLogFilter] = useState({ type: '', phone: '' })

  function showNotice(kind: 'ok' | 'err', text: string) {
    setNotice({ kind, text })
    setTimeout(() => setNotice(null), 3000)
  }

  async function loadConfig() {
    const res = await fetch('/api/admin/points-config', { credentials: 'include' })
    const data = await res.json()
    if (data.error) {
      showNotice('err', data.error)
      return
    }
    setConfig(data.config)
    setIsDefault(!!data.isDefault)
    setForm({
      earnRate: data.config.earnRate,
      pointValue: data.config.pointValue,
      minRedeem: data.config.minRedeem,
    })
  }

  async function loadProducts() {
    const res = await fetch('/api/admin/points-products', { credentials: 'include' })
    const data = await res.json()
    if (data.error) return
    setProducts(data.items || [])
  }

  async function loadLogs() {
    const params = new URLSearchParams()
    if (logFilter.type) params.set('type', logFilter.type)
    if (logFilter.phone) params.set('phone', logFilter.phone)
    const res = await fetch(`/api/admin/points-log?${params.toString()}`, { credentials: 'include' })
    const data = await res.json()
    if (data.error) return
    setLogs(data.items || [])
  }

  async function reloadAll() {
    setLoading(true)
    try {
      await Promise.all([loadConfig(), loadProducts(), loadLogs()])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reloadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (tab === 'log') loadLogs()
  }, [tab])

  async function saveConfig() {
    const res = await fetch('/api/admin/points-config', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (data.error) return showNotice('err', data.error)
    showNotice('ok', '✅ 配置已保存')
    loadConfig()
  }

  async function searchProducts(q: string) {
    setPpSearch(q)
    if (!q.trim()) { setPpSearchResults([]); return }
    const res = await fetch(`/api/products?q=${encodeURIComponent(q)}&inStock=1&limit=8`, {
      credentials: 'include',
    })
    const data = await res.json()
    setPpSearchResults(data.items?.slice(0, 8) || [])
  }

  function pickProduct(p: any) {
    setPpForm({
      productId: p.id,
      pointsRequired: Math.ceil((p.price || 0) * 100),
      originalPrice: p.price,
      stock: 1,
    })
    setPpSearch(p.name)
    setPpSearchResults([])
  }

  async function saveProduct() {
    if (!ppForm.productId) return showNotice('err', '请先选择商品')
    setPpSaving(true)
    try {
      const res = await fetch('/api/admin/points-products', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(ppForm),
      })
      const data = await res.json()
      if (data.error) return showNotice('err', data.error)
      showNotice('ok', '✅ 兑换商品已保存')
      setPpForm({ productId: '', pointsRequired: 100, originalPrice: 0, stock: 1 })
      setPpSearch('')
      loadProducts()
    } finally {
      setPpSaving(false)
    }
  }

  // ⭐ P3 2026-09-06 — 编辑积分兑换商品
  const [editingPp, setEditingPp] = useState<PointsProduct | null>(null)
  const [editForm, setEditForm] = useState({ pointsRequired: 0, originalPrice: 0, stock: 0 })
  const [editBusy, setEditBusy] = useState(false)

  function openEdit(p: PointsProduct) {
    setEditingPp(p)
    setEditForm({ pointsRequired: p.pointsRequired, originalPrice: p.originalPrice, stock: p.stock })
  }

  async function saveEdit() {
    if (!editingPp) return
    setEditBusy(true)
    try {
      const r = await fetch(`/api/admin/points-products/${encodeURIComponent(editingPp.id)}`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      const d = await r.json()
      if (d.error) { showNotice('err', d.error); return }
      showNotice('ok', '✅ 已保存')
      setEditingPp(null)
      loadProducts()
    } finally { setEditBusy(false) }
  }

  // ⭐ P3 2026-09-06 — 导出积分流水
  const [exporting, setExporting] = useState(false)
  const handleExport = async () => {
    setExporting(true)
    try {
      const params = new URLSearchParams()
      if (logFilter.type) params.set('type', logFilter.type)
      if (logFilter.phone) params.set('phone', logFilter.phone)
      const r = await fetch(`/api/admin/points-log/export?${params}`, { credentials: 'include' })
      if (!r.ok) { const j = await r.json().catch(()=>({})); showNotice('err', `导出失败: ${j.error||r.statusText}`); return }
      const blob = await r.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `积分流水_${new Date().toISOString().slice(0, 10)}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      showNotice('ok', '✅ 已导出')
    } catch (e: any) { showNotice('err', e.message) }
    finally { setExporting(false) }
  }

  async function deleteProduct(id: string) {
    if (!await confirmDialog('确认下架这个积分商品？')) return
    const res = await fetch(`/api/admin/points-products?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    const data = await res.json()
    if (data.error) return showNotice('err', data.error)
    showNotice('ok', '✅ 已下架')
    loadProducts()
  }

  return (
    <AdminLayout title="积分管理" active="points">
      {notice && (
        <div
          style={{
            position: 'fixed',
            top: 16,
            right: 16,
            padding: '12px 20px',
            borderRadius: radius.md,
            background: notice.kind === 'ok' ? '#2d8a4f' : '#c0392b',
            color: '#fff',
            fontSize: fontSize.sm,
            fontWeight: fontWeight.semibold,
            zIndex: 9999,
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          }}
        >
          {notice.text}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: spacing[2], marginBottom: spacing[7], flexWrap: 'wrap' }}>
        {[
          { key: 'config' as Tab, label: '⚙️ 积分规则', icon: Save },
          { key: 'products' as Tab, label: '🎁 兑换商品', icon: Gift },
          { key: 'log' as Tab, label: '📋 流水记录', icon: Filter },
        ].map((t) => {
          const isActive = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: '10px 18px',
                borderRadius: radius.base,
                background: isActive ? colors.primary : 'rgba(255,255,255,0.04)',
                color: isActive ? '#fff' : colors.textSubtle,
                border: 'none',
                fontWeight: isActive ? fontWeight.semibold : fontWeight.normal,
                cursor: 'pointer',
                fontSize: fontSize.sm,
                transition: animation.fast,
              }}
            >
              {t.label}
            </button>
          )
        })}
        <button
          onClick={reloadAll}
          style={{
            marginLeft: 'auto',
            padding: '10px 14px',
            borderRadius: radius.base,
            background: 'transparent',
            color: colors.textSubtle,
            border: `1px solid ${colors.borderMuted}`,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 4,
          }}
          title="刷新"
        >
          <RefreshCw size={14} /> 刷新
        </button>
      </div>

      {/* ============ 配置 Tab ============ */}
      {tab === 'config' && (
        <div style={{ maxWidth: 640 }}>
          <h3 style={{ marginTop: 0, color: colors.text, fontSize: fontSize.lg }}>
            积分规则配置
          </h3>
          {isDefault && (
            <div style={{
              padding: '10px 14px', borderRadius: radius.base,
              background: '#3a2f1a', color: '#f0c674',
              fontSize: fontSize.xs, marginBottom: spacing[5],
            }}>
              ⚠️ 当前为系统默认值，建议保存一次以写入数据库
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[5] }}>
            <div>
              <label style={{ display: 'block', marginBottom: 6, color: colors.textSubtle, fontSize: fontSize.xs }}>
                消费返积分比例（earnRate）
              </label>
              <input
                type="number" step="0.01" min="0" max="1"
                value={form.earnRate}
                onChange={(e) => setForm({ ...form, earnRate: parseFloat(e.target.value) || 0 })}
                style={inputStyle}
              />
              <div style={{ marginTop: 4, color: colors.textSubtle, fontSize: fontSize.xs }}>
                0.05 表示消费 100 元获得 5 分（建议 0.05 = 5%）
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 6, color: colors.textSubtle, fontSize: fontSize.xs }}>
                1 分 = ? 元（pointValue）
              </label>
              <input
                type="number" step="0.001" min="0.001"
                value={form.pointValue}
                onChange={(e) => setForm({ ...form, pointValue: parseFloat(e.target.value) || 0 })}
                style={inputStyle}
              />
              <div style={{ marginTop: 4, color: colors.textSubtle, fontSize: fontSize.xs }}>
                默认 0.01（1 分抵扣 1 分钱）、建议 0.01
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 6, color: colors.textSubtle, fontSize: fontSize.xs }}>
                最低兑换门槛（minRedeem）
              </label>
              <input
                type="number" step="1" min="0"
                value={form.minRedeem}
                onChange={(e) => setForm({ ...form, minRedeem: parseInt(e.target.value) || 0 })}
                style={inputStyle}
              />
              <div style={{ marginTop: 4, color: colors.textSubtle, fontSize: fontSize.xs }}>
                用户最少累计多少分才能兑换（默认 100）
              </div>
            </div>

            <button onClick={saveConfig} style={{ ...btnPrimary, marginTop: spacing[2] }}>
              💾 保存配置
            </button>

            {config && (
              <div style={{
                marginTop: spacing[5], padding: spacing[5],
                background: 'rgba(127,220,148,0.08)', borderRadius: radius.base,
                border: `1px solid rgba(127,220,148,0.3)`,
              }}>
                <div style={{ fontSize: fontSize.xs, color: colors.textSubtle, marginBottom: 4 }}>
                  当前规则效果预览
                </div>
                <div style={{ fontSize: fontSize.sm, color: colors.text, lineHeight: 1.8 }}>
                  • 消费 ¥100 → 返 <b>{Math.round(100 * form.earnRate * 100)}</b> 分<br/>
                  • {form.minRedeem} 分可兑换 <b>¥{(form.minRedeem * form.pointValue).toFixed(2)}</b> 商品<br/>
                  • 兑换 1000 分商品 = 省 ¥{(1000 * form.pointValue).toFixed(2)}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============ 兑换商品 Tab ============ */}
      {tab === 'products' && (
        <div>
          <h3 style={{ marginTop: 0, color: colors.text, fontSize: fontSize.lg }}>
            兑换商品（{products.length}）
          </h3>

          {/* 新增表单 */}
          <div style={{
            padding: spacing[5], marginBottom: spacing[7],
            background: 'rgba(127,220,148,0.05)', borderRadius: radius.md,
            border: `1px solid ${colors.borderMuted}`,
          }}>
            <div style={{ marginBottom: spacing[2], fontSize: fontSize.xs, color: colors.textSubtle, fontWeight: fontWeight.semibold }}>
              ➕ 新增兑换商品
            </div>

            <div style={{ position: 'relative', marginBottom: spacing[2] }}>
              <input
                value={ppSearch}
                onChange={(e) => searchProducts(e.target.value)}
                placeholder="🔍 搜索商品（按名称模糊匹配）"
                style={inputStyle}
              />
              {ppSearchResults.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0,
                  background: '#1a1f1d', border: `1px solid ${colors.borderMuted}`,
                  borderRadius: radius.base, marginTop: 4, zIndex: 10,
                  maxHeight: 240, overflowY: 'auto',
                }}>
                  {ppSearchResults.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => pickProduct(p)}
                      style={{
                        padding: '10px 14px', cursor: 'pointer',
                        borderBottom: `1px solid ${colors.borderMuted}`,
                        display: 'flex', alignItems: 'center', gap: 10,
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(127,220,148,0.1)' }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                    >
                      {p.image && !pickImgErrors.has(p.id) ? (
                        <img
                          src={p.image}
                          alt={p.name || ''}
                          onError={() => setPickImgErrors(prev => { const n = new Set(prev); n.add(p.id); return n })}
                          style={{
                            width: 32, height: 32, borderRadius: 6,
                            objectFit: 'cover', flexShrink: 0,
                            background: 'rgba(127, 220, 148, 0.06)',
                          }}
                        />
                      ) : (
                        <div style={{
                          width: 32, height: 32, borderRadius: 6, fontSize: 14,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: 'rgba(127, 220, 148, 0.06)', flexShrink: 0,
                          color: 'rgba(127, 220, 148, 0.6)',
                        }}>📦</div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.semibold }}>
                          {p.name}
                        </div>
                        <div style={{ color: colors.textSubtle, fontSize: fontSize.xs, marginTop: 2 }}>
                          {p.spec && `${p.spec} · `}库存 {p.stock}
                        </div>
                      </div>
                      <div style={{ color: colors.primary, fontSize: fontSize.sm, fontWeight: fontWeight.bold, flexShrink: 0 }}>
                        ¥{Number(p.price).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: spacing[2] }}>
              <div>
                <label style={{ fontSize: 10, color: colors.textSubtle }}>所需积分</label>
                <input type="number" value={ppForm.pointsRequired}
                  onChange={(e) => setPpForm({ ...ppForm, pointsRequired: parseInt(e.target.value) || 0 })}
                  style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: colors.textSubtle }}>原价（元）</label>
                <input type="number" value={ppForm.originalPrice}
                  onChange={(e) => setPpForm({ ...ppForm, originalPrice: parseFloat(e.target.value) || 0 })}
                  style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: colors.textSubtle }}>兑换库存</label>
                <input type="number" value={ppForm.stock}
                  onChange={(e) => setPpForm({ ...ppForm, stock: parseInt(e.target.value) || 0 })}
                  style={inputStyle} />
              </div>
            </div>

            <button onClick={saveProduct} disabled={!ppForm.productId || ppSaving}
              style={{ ...btnPrimary, marginTop: spacing[2], opacity: !ppForm.productId ? 0.5 : 1 }}>
              {ppSaving ? '保存中...' : '💾 保存为兑换商品'}
            </button>
          </div>

          {/* 列表 */}
          {products.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: colors.textSubtle }}>
              暂无兑换商品
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: spacing[5] }}>
              {products.map((p) => (
                <div key={p.id} style={{
                  padding: spacing[5], borderRadius: radius.md,
                  background: 'rgba(255,255,255,0.04)', border: `1px solid ${colors.borderMuted}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    {p.image && !ppImgErrors.has(p.id) ? (
                          <img
                            src={p.image}
                            alt={p.productName || ''}
                            onError={() => setPpImgErrors(prev => { const n = new Set(prev); n.add(p.id); return n })}
                            style={{
                              width: 40, height: 40, borderRadius: 8,
                              objectFit: 'cover', flexShrink: 0,
                              background: 'rgba(127, 220, 148, 0.06)',
                            }}
                          />
                        ) : (
                          <div style={{
                            width: 40, height: 40, borderRadius: 8, fontSize: 18,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: 'rgba(127, 220, 148, 0.06)', flexShrink: 0,
                            color: 'rgba(127, 220, 148, 0.6)',
                          }}>📦</div>
                        )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text }}>
                        {p.productName}
                      </div>
                      <div style={{ fontSize: fontSize.xs, color: colors.textSubtle, marginTop: 2 }}>
                        {p.spec && `${p.spec} · `}
                        {p.category && `${p.category}`}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: fontWeight.bold, color: colors.primary }}>
                        ⭐ {p.pointsRequired} 分
                      </div>
                      <div style={{ fontSize: fontSize.xs, color: colors.textSubtle }}>
                        原价 ¥{Number(p.currentPrice).toFixed(2)} · 库存 {p.stock}
                      </div>
                    </div>
                    <span style={{
                      padding: '2px 8px', borderRadius: 4,
                      background: p.status === 'active' ? '#2d8a4f' : '#666',
                      color: '#fff', fontSize: 10,
                    }}>
                      {p.status === 'active' ? '在架' : '下架'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <button onClick={() => openEdit(p)} style={{
                      flex: 1, padding: '6px 10px', borderRadius: radius.base,
                      background: 'transparent', color: colors.primary,
                      border: `1px solid rgba(127,220,148,0.4)`, cursor: 'pointer',
                      fontSize: fontSize.xs, fontWeight: fontWeight.semibold,
                    }}>
                      ✏️ 编辑
                    </button>
                    <button onClick={() => deleteProduct(p.id)} style={{
                      ...btnDanger, flex: 1,
                    }}>
                      下架
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============ 编辑积分商品 Modal ============ */}
      {editingPp && (
        <div role="dialog" onClick={() => setEditingPp(null)} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#0a0f0d', border: `1px solid ${colors.primary}`, borderRadius: 16, padding: 24, width: '100%', maxWidth: 440, color: colors.text }}>
            <h3 style={{ margin: '0 0 16px', fontSize: fontSize.lg }}>✏️ 编辑「{editingPp.productName}」</h3>
            <div style={{ fontSize: fontSize.xs, color: colors.textSubtle, marginBottom: spacing[5] }}>
              {editingPp.spec && `${editingPp.spec} · `}{editingPp.category}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[4] }}>
              <div>
                <label style={{ fontSize: 10, color: colors.textSubtle, display: 'block', marginBottom: 4 }}>所需积分</label>
                <input type="number" value={editForm.pointsRequired} onChange={(e) => setEditForm({ ...editForm, pointsRequired: parseInt(e.target.value) || 0 })} style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: colors.textSubtle, display: 'block', marginBottom: 4 }}>原价 (元)</label>
                <input type="number" value={editForm.originalPrice} onChange={(e) => setEditForm({ ...editForm, originalPrice: parseFloat(e.target.value) || 0 })} style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: colors.textSubtle, display: 'block', marginBottom: 4 }}>兑换库存</label>
                <input type="number" value={editForm.stock} onChange={(e) => setEditForm({ ...editForm, stock: parseInt(e.target.value) || 0 })} style={inputStyle} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: spacing[7] }}>
              <button onClick={() => setEditingPp(null)} disabled={editBusy} style={{ ...inputStyle, flex: 1, cursor: 'pointer' }}>取消</button>
              <button onClick={saveEdit} disabled={editBusy} style={{ ...inputStyle, flex: 2, background: colors.primary, color: '#0a0f0d', fontWeight: fontWeight.bold, border: 'none', cursor: editBusy ? 'wait' : 'pointer', opacity: editBusy ? 0.6 : 1 }}>{editBusy ? '保存中…' : '💾 保存'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ============ 流水 Tab ============ */}
      {tab === 'log' && (
        <div>
          <h3 style={{ marginTop: 0, color: colors.text, fontSize: fontSize.lg }}>
            积分流水（最近 {logs.length} 条）
          </h3>

          <div style={{ display: 'flex', gap: spacing[2], marginBottom: spacing[5], flexWrap: 'wrap' }}>
            <select value={logFilter.type}
              onChange={(e) => { setLogFilter({ ...logFilter, type: e.target.value }); setTimeout(loadLogs, 0) }}
              style={inputStyle}>
              <option value="">所有类型</option>
              <option value="earn">earn (获得)</option>
              <option value="spend">spend (消耗)</option>
              <option value="refund">refund (退回)</option>
              <option value="expire">expire (过期)</option>
            </select>
            <input value={logFilter.phone}
              onChange={(e) => setLogFilter({ ...logFilter, phone: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter') loadLogs() }}
              placeholder="🔍 按手机号筛选"
              style={{ ...inputStyle, maxWidth: 200 }} />
            <button onClick={loadLogs} style={btnPrimary}>查询</button>
            <button onClick={handleExport} disabled={exporting} style={{ ...btnPrimary, background: 'rgba(127,220,148,0.2)', color: '#fbbf24', border: '1px solid rgba(127,220,148,0.4)', opacity: exporting ? 0.6 : 1 }}>{exporting ? '导出中…' : '📥 导出 Excel'}</button>
          </div>

          {logs.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: colors.textSubtle }}>
              暂无流水（用户下单后会自动产生 earn；兑换会产生 spend）
            </div>
          ) : (
            <div style={{ overflowX: 'auto', background: 'rgba(255,255,255,0.02)', borderRadius: radius.md }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: fontSize.xs }}>
                <thead>
                  <tr style={{ background: 'rgba(127,220,148,0.06)', textAlign: 'left' }}>
                    <th style={{ padding: 10 }}>时间</th>
                    <th style={{ padding: 10 }}>用户</th>
                    <th style={{ padding: 10 }}>类型</th>
                    <th style={{ padding: 10, textAlign: 'right' }}>变动</th>
                    <th style={{ padding: 10, textAlign: 'right' }}>余额</th>
                    <th style={{ padding: 10 }}>原因</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l) => (
                    <tr key={l.id} style={{ borderTop: `1px solid ${colors.borderMuted}` }}>
                      <td style={{ padding: 10, color: colors.textSubtle }}>
                        {l.createdAt?.slice(0, 19).replace('T', ' ')}
                      </td>
                      <td style={{ padding: 10 }}>
                        <div style={{ color: colors.text }}>{l.customerNickname || '匿名'}</div>
                        <div style={{ color: colors.textSubtle, fontSize: 10 }}>{l.phone}</div>
                      </td>
                      <td style={{ padding: 10 }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: 4,
                          background: l.type === 'earn' ? '#2d8a4f' : l.type === 'spend' ? '#c0392b' : '#666',
                          color: '#fff',
                        }}>
                          {l.type}
                        </span>
                      </td>
                      <td style={{
                        padding: 10, textAlign: 'right', fontWeight: fontWeight.bold,
                        color: l.delta > 0 ? '#2d8a4f' : '#ff6b6b',
                      }}>
                        {l.delta > 0 ? `+${l.delta}` : l.delta}
                      </td>
                      <td style={{ padding: 10, textAlign: 'right', color: colors.text }}>
                        {l.balance}
                      </td>
                      <td style={{ padding: 10, color: colors.textSubtle, maxWidth: 240 }}>
                        {l.reason || l.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </AdminLayout>
  )
}
