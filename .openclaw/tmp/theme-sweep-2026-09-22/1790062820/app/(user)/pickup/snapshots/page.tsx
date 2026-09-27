'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import AppLayout from '@/components/AppLayout'

interface Product { id: string; name: string; shortName?: string | null; spec: string | null; image: string | null }
interface PhotoSnapshot { id: string; productId: string; photoUrl: string; shotAt: string; createdAt?: string; period: 'morning' | 'noon' | 'evening'; note?: string | null }

const PERIOD_META: Record<string, { icon: string; label: string; range: string }> = {
  morning: { icon: '🌅', label: '早班', range: '6-12' },
  noon: { icon: '☀️', label: '中班', range: '12-18' },
  evening: { icon: '🌙', label: '晚班', range: '18-24' },
}

const CATEGORIES: Array<{ code: string; label: string; icon: string }> = [
  { code: 'all', label: '全部', icon: '🛒' },
  { code: 'F001', label: '水果', icon: '🍎' },
  { code: 'F002', label: '蔬菜', icon: '🥬' },
  { code: 'F003', label: '粮油', icon: '🍚' },
  { code: 'F001_citrus', label: '柑橘', icon: '🍊' },
  { code: 'F001_berry', label: '浆果', icon: '🍓' },
  { code: 'F001_melon', label: '瓜果', icon: '🍉' },
  { code: 'F002_leafy', label: '叶菜', icon: '🥗' },
  { code: 'F002_root', label: '根茎', icon: '🥕' },
  { code: 'F002_mushroom', label: '菌菇', icon: '🍄' },
  { code: 'F003_grain', label: '米面', icon: '🌾' },
  { code: 'F003_protein', label: '肉蛋', icon: '🥚' },
]

export default function SnapshotsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [period, setPeriod] = useState<'morning' | 'noon' | 'evening'>('morning')
  const [note, setNote] = useState('')
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg] = useState('')
  const [searchQ, setSearchQ] = useState('')
  // ⭐ MEMORY §314 v0.8.56 (2026-08-29 17:18 奕霖) — 双 Tab 搜索
  const [searchMode, setSearchMode] = useState<'search' | 'category'>('search')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [dragActive, setDragActive] = useState(false)
  const [todaySnapshots, setTodaySnapshots] = useState<PhotoSnapshot[]>([])
  const [historySnapshots, setHistorySnapshots] = useState<PhotoSnapshot[]>([])
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set())
  const [zoomedPhoto, setZoomedPhoto] = useState<PhotoSnapshot | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 口语化日期标签
  function dayLabel(d: string): string {
    const today = new Date().toISOString().slice(0, 10)
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    const dayBefore = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10)
    if (d === today) return '今天'
    if (d === yesterday) return '昨天'
    if (d === dayBefore) return '前天'
    return d.slice(5)
  }

  useEffect(() => {
    fetch('/api/products?inStock=1&limit=200').then(r => r.json()).then(d => {
      if (d.success) setProducts(d.products || d.items || [])
    })
    const h = new Date().getHours()
    if (h < 12) setPeriod('morning'); else if (h < 18) setPeriod('noon'); else setPeriod('evening')
  }, [])

  const reloadToday = async () => {
    try {
      const r = await fetch('/api/snapshots/list?days=1&merchantId=m_grocery_001')
      const d = await r.json()
      if (d.success) setTodaySnapshots(d.snapshots || [])
    } catch {}
  }
  useEffect(() => { reloadToday() }, [])

  const loadHistory = async (pid: string) => {
    try {
      const r = await fetch(`/api/snapshots/list?days=3&productId=${encodeURIComponent(pid)}&merchantId=m_grocery_001`)
      const d = await r.json()
      if (d.success) {
        setHistorySnapshots(d.snapshots || [])
        const today = new Date().toISOString().slice(0, 10)
        setExpandedDays(new Set([today]))
      }
    } catch {}
  }

  useEffect(() => {
    if (selectedProduct) loadHistory(selectedProduct.id)
    else { setHistorySnapshots([]); setExpandedDays(new Set()) }
  }, [selectedProduct?.id])

  const historyByDay = useMemo(() => {
    const m: Record<string, PhotoSnapshot[]> = {}
    historySnapshots.forEach(s => {
      const d = (s.shotAt || s.createdAt || '').slice(0, 10)
      if (!d) return
      if (!m[d]) m[d] = []
      m[d].push(s)
    })
    return m
  }, [historySnapshots])

  const todayCountByPeriod = useMemo(() => {
    const m: Record<string, number> = { morning: 0, noon: 0, evening: 0 }
    todaySnapshots.forEach(s => { if (m[s.period] !== undefined) m[s.period]++ })
    return m
  }, [todaySnapshots])

  const shotProductIds = useMemo(() => {
    const set = new Set<string>()
    todaySnapshots.filter(s => s.period === period).forEach(s => set.add(s.productId))
    return set
  }, [todaySnapshots, period])

  const filtered = useMemo(() => {
    const q = searchQ.trim().toLowerCase()
    if (!q) return products.slice(0, 24)
    return products.filter(p => (p.name || '').toLowerCase().includes(q) || (p.shortName || '').toLowerCase().includes(q)).slice(0, 24)
  }, [products, searchQ])

  // 双 Tab 共享:分类筛选 + 搜索匹配
  const filteredProducts = useMemo(() => {
    const q = searchQ.trim().toLowerCase()
    let list = products
    if (selectedCategory !== 'all') {
      list = list.filter((p: any) => p.category === selectedCategory)
    }
    if (q) {
      list = list.filter(p => {
        const name = (p.name || '').toLowerCase()
        const shortName = (p.shortName || '').toLowerCase()
        const code = String((p as any).productCode || '').toLowerCase()
        return name.includes(q) || shortName.includes(q) || code.includes(q)
      })
    }
    return list.slice(0, 30)
  }, [products, searchQ, selectedCategory])

  const currentHour = new Date().getHours()
  const isCurrentPeriod = currentHour < 12 ? 'morning' : currentHour < 18 ? 'noon' : 'evening'
  const canSubmit = !!selectedProduct && !!photoPreview && !uploading

  function onFileChange(file: File | null) {
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setMsg('⚠️ 图片不能超过 5MB'); return }
    const reader = new FileReader()
    reader.onload = () => setPhotoPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragActive(false)
    const f = e.dataTransfer.files?.[0]; if (f) onFileChange(f)
  }

  async function upload() {
    if (!selectedProduct) { setMsg('请先选商品'); return }
    if (!photoPreview) { setMsg('请先拍照片'); return }
    setUploading(true); setMsg('')
    try {
      const r = await fetch('/api/snapshots/upload', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: selectedProduct.id, photoBase64: photoPreview, period, note: note.trim() || undefined, shotBy: 'merchant-staff' }),
      })
      const d = await r.json()
      if (d.success) { setMsg('✓ 已保存'); setPhotoPreview(null); setNote(''); reloadToday() }
      else { setMsg('❌ ' + (d.error || '保存失败')) }
    } catch (e: any) { setMsg('❌ ' + (e?.message || '网络错误')) }
    finally { setUploading(false) }
  }

  // ============================================================
  // 设计 token(全端统一)
  // ============================================================
  const T = {
    // 颜色
    primary: '#fbbf24',
    primarySoft: 'rgba(127, 220, 148, 0.08)',
    primaryEdge: 'rgba(127, 220, 148, 0.18)',
    primaryGlow: 'rgba(127, 220, 148, 0.25)',
    bgCard: 'rgba(13, 25, 20, 0.55)',
    bgCardHover: 'rgba(127, 220, 148, 0.05)',
    bgInput: 'rgba(0, 0, 0, 0.25)',
    text: '#f0fdf4',
    textDim: 'rgba(255, 255, 255, 0.55)',
    textFaint: 'rgba(255, 255, 255, 0.35)',
    border: 'rgba(255, 255, 255, 0.08)',
    borderPrimary: 'rgba(127, 220, 148, 0.3)',
    danger: 'rgba(255, 100, 100, 0.12)',
    dangerBorder: 'rgba(255, 100, 100, 0.4)',
    // 圆角
    r1: 6, r2: 8, r3: 10, r4: 12, r5: 14, r6: 16, r8: 20,
  }

  // 卡片样式(所有 section 复用)
  const cardStyle = {
    background: T.bgCard,
    border: '1px solid ' + T.primaryEdge,
    borderRadius: T.r5,
    padding: 14,
    marginBottom: 12,
    backdropFilter: 'blur(8px)',
  }
  const cardHeaderStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  }
  const stepBadgeStyle = (active: boolean): React.CSSProperties => ({
    width: 22, height: 22, borderRadius: 999,
    background: active ? T.primary : 'rgba(255, 255, 255, 0.08)',
    color: active ? '#0a0f0d' : T.textDim,
    fontSize: 12, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  })

  return (
    <AppLayout
      title="📷 新鲜度拍照"
      showHeader
      headerRight={
        <span style={{ fontSize: 11, color: T.textDim }}>
          {selectedProduct
            ? `${historySnapshots.length} 张 · ${Object.keys(historyByDay).length} 天`
            : `${todaySnapshots.length} 张今日`}
        </span>
      }
    >
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '12px 14px 100px', color: T.text }}>

        {/* ============================================================ */}
        {/* 1. 搜索商品 — 永远显示 */}
        {/* ============================================================ */}
                <section style={cardStyle}>
          <div style={cardHeaderStyle}>
            <span style={stepBadgeStyle(true)}>1</span>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: T.text, margin: 0, flex: 1 }}>搜索商品</h3>
            {selectedProduct ? (
              <span style={{ fontSize: 10, color: T.primary, padding: '2px 8px', background: T.primarySoft, borderRadius: 999 }}>
                ✓ {selectedProduct.name.replace(/^[^\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u, '').trim().slice(0, 12)}
              </span>
            ) : (
              <span style={{ fontSize: 10, color: T.textFaint }}>{products.length} 件</span>
            )}
          </div>

          {/* 双 Tab 切换 */}
          <div style={{
            display: 'flex', gap: 4, marginBottom: 10, padding: 3,
            background: 'rgba(0, 0, 0, 0.25)', borderRadius: T.r3,
          }}>
            {([
              { key: 'search' as const, label: '🔍 搜索', hint: '编码或商品名' },
              { key: 'category' as const, label: '📂 分类', hint: '按类目筛选' },
            ]).map(t => {
              const sel = searchMode === t.key
              return (
                <button key={t.key} onClick={() => { setSearchMode(t.key); setSearchQ('') }} style={{
                  flex: 1, padding: '8px 10px', borderRadius: T.r2, cursor: 'pointer', border: 'none',
                  background: sel ? T.primarySoft : 'transparent',
                  color: sel ? T.primary : T.textDim,
                  fontSize: 12, fontWeight: sel ? 600 : 500,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                  transition: 'all 0.15s',
                }}>
                  <span>{t.label}</span>
                  <span style={{ fontSize: 9, color: sel ? T.primary : T.textFaint, fontWeight: 400 }}>{t.hint}</span>
                </button>
              )
            })}
          </div>

          {/* 搜索 Tab:输入框 */}
          {searchMode === 'search' && (
            <div style={{ position: 'relative', marginBottom: 10 }}>
              <input
                type="text"
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                placeholder="🔍 输入编码(如 0014)或商品名"
                style={{
                  width: '100%', padding: '10px 12px 10px 36px', fontSize: 13,
                  background: T.bgInput,
                  border: '1px solid ' + T.primaryEdge,
                  borderRadius: T.r3, color: T.text, outline: 'none',
                  boxSizing: 'border-box', minHeight: 40,
                  transition: 'border-color 0.2s',
                }}
              />
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, pointerEvents: 'none' }}>🔍</span>
              {searchQ && (
                <button onClick={() => setSearchQ('')} style={{
                  position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                  padding: '4px 8px', borderRadius: T.r1, border: 'none',
                  background: 'rgba(255, 255, 255, 0.08)', color: T.textDim,
                  fontSize: 11, cursor: 'pointer', minHeight: 24,
                }}>✕</button>
              )}
            </div>
          )}

          {/* 搜索提示 */}
          {searchMode === 'search' && searchQ.trim() === '' && (
            <div style={{ padding: '24px 14px', textAlign: 'center', color: T.textFaint, fontSize: 12 }}>
              👆 输入关键字,实时显示匹配商品
            </div>
          )}

          {/* 搜不到 */}
          {searchMode === 'search' && searchQ.trim() !== '' && filteredProducts.length === 0 && (
            <div style={{ padding: '20px 14px', textAlign: 'center', color: T.textFaint, fontSize: 12 }}>
              搜不到「{searchQ}」,试试别的关键字?
            </div>
          )}

          {/* 搜索匹配数提示 */}
          {searchMode === 'search' && searchQ.trim() !== '' && filteredProducts.length > 0 && (
            <div style={{ fontSize: 10, color: T.textFaint, marginBottom: 6 }}>
              匹配 {filteredProducts.length} 件 · 点选才进入下一步
            </div>
          )}

          {/* 分类 Tab:分类按钮 */}
          {searchMode === 'category' && (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {CATEGORIES.map(c => {
                  const sel = selectedCategory === c.code
                  return (
                    <button key={c.code} onClick={() => setSelectedCategory(c.code)} style={{
                      padding: '6px 12px', borderRadius: 999, cursor: 'pointer',
                      background: sel ? T.primary : 'rgba(255, 255, 255, 0.04)',
                      border: sel ? '1px solid ' + T.primary : '1px solid ' + T.border,
                      color: sel ? '#0a0f0d' : T.text,
                      fontSize: 11, fontWeight: sel ? 600 : 500,
                      transition: 'all 0.15s',
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                      <span style={{ fontSize: 13 }}>{c.icon}</span>
                      <span>{c.label}</span>
                    </button>
                  )
                })}
              </div>
              <div style={{ fontSize: 10, color: T.textFaint, marginBottom: 6 }}>
                {selectedCategory === 'all' ? '全部商品' : '分类: ' + (CATEGORIES.find(c => c.code === selectedCategory)?.label || '')} · {filteredProducts.length} 件
              </div>
            </>
          )}

          {/* 商品 grid(共用)— 搜索有匹配 OR 分类总是显示 */}
          {((searchMode === 'search' && searchQ.trim() && filteredProducts.length > 0) || (searchMode === 'category' && filteredProducts.length > 0)) && (
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
              gap: 6, maxHeight: 260, overflowY: 'auto', padding: 2,
            }}>
              {filteredProducts.map(p => {
                const sel = selectedProduct?.id === p.id
                const shot = shotProductIds.has(p.id)
                return (
                  <button key={p.id} onClick={() => setSelectedProduct(p)} style={{
                    position: 'relative', minHeight: 40, padding: '6px 10px',
                    background: sel ? T.primarySoft : 'rgba(255, 255, 255, 0.02)',
                    border: sel ? '1.5px solid ' + T.primary : '1px solid ' + T.border,
                    borderRadius: T.r2, cursor: 'pointer', textAlign: 'left',
                    display: 'flex', alignItems: 'center', gap: 4,
                    transition: 'all 0.15s',
                  }}>
                    {shot && <span style={{ position: 'absolute', top: 4, right: 5, fontSize: 8, color: T.primary }}>✓</span>}
                    <span style={{ fontSize: 11, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {p.name.replace(/^[^\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u, '').trim() || p.name}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </section>

        {/* ============================================================ */}
        {/* 2. 选择时段 — 选了商品才显示 */}
        {/* ============================================================ */}
        {selectedProduct && (
          <section style={cardStyle}>
            <div style={cardHeaderStyle}>
              <span style={stepBadgeStyle(true)}>2</span>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: T.text, margin: 0, flex: 1 }}>选择时段</h3>
              <span style={{ fontSize: 10, color: T.textFaint }}>
                当前时段 {PERIOD_META[isCurrentPeriod as keyof typeof PERIOD_META]?.label}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['morning', 'noon', 'evening'] as const).map(p => {
                const m = PERIOD_META[p]
                const sel = period === p
                const cur = isCurrentPeriod === p
                const cnt = todayCountByPeriod[p]
                return (
                  <button key={p} onClick={() => setPeriod(p)} style={{
                    flex: 1, minHeight: 72, padding: '10px 6px',
                    background: sel ? T.primarySoft : 'rgba(255, 255, 255, 0.02)',
                    border: sel ? '1.5px solid ' + T.primary : '1px solid ' + (cur ? T.primaryEdge : T.border),
                    borderRadius: T.r4, cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
                    transition: 'all 0.15s',
                    position: 'relative',
                  }}>
                    {cur && <span style={{ position: 'absolute', top: 4, right: 4, fontSize: 7, color: T.primary }}>●</span>}
                    <span style={{ fontSize: 18, lineHeight: 1 }}>{m.icon}</span>
                    <span style={{ fontSize: 12, fontWeight: sel ? 600 : 500, color: sel ? T.primary : T.text }}>{m.label}</span>
                    <span style={{ fontSize: 9, color: T.textFaint }}>{m.range}</span>
                    <span style={{ fontSize: 9, color: cnt > 0 ? T.primary : T.textFaint, fontWeight: 600 }}>
                      {cnt > 0 ? `${cnt} 张` : '—'}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {/* ============================================================ */}
        {/* 3. 拍照 + 备注 — 选了商品才显示 */}
        {/* ============================================================ */}
        {selectedProduct && (
          <section style={cardStyle}>
            <div style={cardHeaderStyle}>
              <span style={stepBadgeStyle(true)}>3</span>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: T.text, margin: 0, flex: 1 }}>拍照 + 备注</h3>
              <span style={{ fontSize: 10, color: T.textFaint }}>≤5MB · 自动压缩</span>
            </div>

            {/* 拍照区 */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
              onDragLeave={() => setDragActive(false)}
              onDrop={onDrop}
              onClick={() => !photoPreview && fileInputRef.current?.click()}
              style={{
                position: 'relative', marginBottom: 10,
                minHeight: 140,
                padding: photoPreview ? 0 : '24px 14px',
                background: photoPreview ? 'transparent' : dragActive ? T.primarySoft : 'rgba(255, 255, 255, 0.02)',
                border: photoPreview ? 'none' : `1.5px dashed ${dragActive ? T.primary : T.primaryEdge}`,
                borderRadius: T.r4, cursor: photoPreview ? 'default' : 'pointer',
                textAlign: 'center',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s',
              }}
            >
              <input ref={fileInputRef} type="file" accept="image/*" capture="environment"
                onChange={e => onFileChange(e.target.files?.[0] || null)} style={{ display: 'none' }} />
              {photoPreview ? (
                <div style={{ position: 'relative', width: '100%' }}>
                  <img src={photoPreview} alt="" style={{ width: '100%', maxHeight: 320, objectFit: 'cover', borderRadius: T.r3, display: 'block' }} />
                  <button
                    onClick={(e) => { e.stopPropagation(); setPhotoPreview(null) }}
                    style={{
                      position: 'absolute', top: 6, right: 6, minHeight: 28, minWidth: 56,
                      padding: '4px 10px', borderRadius: 999,
                      background: 'rgba(0,0,0,0.7)', fontSize: 10, color: '#fff',
                      border: 'none', cursor: 'pointer', backdropFilter: 'blur(8px)',
                    }}
                  >✕ 重拍</button>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 32, marginBottom: 4 }}>📷</div>
                  <div style={{ fontSize: 12, color: T.primary, fontWeight: 600, marginBottom: 2 }}>点击拍照或拖入图片</div>
                  <div style={{ fontSize: 10, color: T.textFaint }}>JPEG/PNG · ≤5MB · 自动压缩到 1200px</div>
                </div>
              )}
            </div>

            {/* 备注 */}
            <div style={{ marginBottom: 10 }}>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="备注(可选,200字内)"
                maxLength={200}
                style={{
                  width: '100%', minHeight: 56, padding: '10px 12px',
                  background: T.bgInput,
                  border: '1px solid ' + T.border,
                  borderRadius: T.r3, color: T.text, outline: 'none', resize: 'vertical',
                  fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box',
                  transition: 'border-color 0.2s',
                }}
              />
              <div style={{ fontSize: 10, color: T.textFaint, textAlign: 'right', marginTop: 2 }}>{note.length}/200</div>
            </div>

            {/* 反馈 */}
            {msg && (
              <div style={{
                padding: '10px 12px', marginBottom: 10, textAlign: 'center',
                background: msg.startsWith('✓') ? T.primarySoft : T.danger,
                border: '1px solid ' + (msg.startsWith('✓') ? T.primaryEdge : T.dangerBorder),
                borderRadius: T.r2, fontSize: 12,
                color: msg.startsWith('✓') ? T.primary : 'rgba(255, 130, 130, 1)',
              }}>{msg}</div>
            )}

            {/* 保存按钮 */}
            <button
              onClick={upload} disabled={!canSubmit}
              style={{
                width: '100%', minHeight: 48, fontSize: 14, fontWeight: 600,
                color: canSubmit ? '#0a0f0d' : T.textFaint,
                background: canSubmit ? T.primary : 'rgba(127, 220, 148, 0.15)',
                border: 'none', borderRadius: T.r4,
                cursor: canSubmit ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                transition: 'all 0.2s',
              }}
            >
              {uploading ? <span>上传中…</span> : <span>💾 保存到「{PERIOD_META[period].label}」</span>}
            </button>
          </section>
        )}

        {/* ============================================================ */}
        {/* 4. 历史 3 天 — 选了商品才显示 */}
        {/* ============================================================ */}
        {selectedProduct && Object.keys(historyByDay).length > 0 && (
          <section style={cardStyle}>
            <div style={cardHeaderStyle}>
              <span style={stepBadgeStyle(true)}>4</span>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: T.text, margin: 0, flex: 1 }}>历史 3 天</h3>
              <span style={{ fontSize: 10, color: T.textFaint }}>{historySnapshots.length} 张 · 点标题展开</span>
            </div>
            {Object.keys(historyByDay).sort().reverse().map(day => {
              const shots = historyByDay[day]
              const expanded = expandedDays.has(day)
              const label = dayLabel(day)
              return (
                <div key={day} style={{ marginBottom: 6 }}>
                  <button onClick={() => {
                    const next = new Set(expandedDays)
                    if (next.has(day)) next.delete(day); else next.add(day)
                    setExpandedDays(next)
                  }} style={{
                    width: '100%', padding: '8px 12px', borderRadius: T.r2, cursor: 'pointer',
                    background: expanded ? T.primarySoft : 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid ' + (expanded ? T.primaryEdge : T.border),
                    color: T.text, fontSize: 11, fontWeight: 600,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    userSelect: 'none', minHeight: 34,
                    transition: 'all 0.2s',
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{
                        color: T.primary, fontSize: 9, display: 'inline-block',
                        transition: 'transform 0.2s',
                        transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
                      }}>▶</span>
                      <span>{label}</span>
                      <span style={{ color: T.textFaint, fontWeight: 400 }}>{shots.length} 张</span>
                    </span>
                    <span style={{ fontSize: 9, color: T.textFaint }}>{expanded ? '收起' : '展开'}</span>
                  </button>
                  {expanded && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 4, padding: 4 }}>
                      {(['morning', 'noon', 'evening'] as const).map(p => {
                        const shot = shots.find(s => s.period === p)
                        const m = PERIOD_META[p]
                        return (
                          <div key={p} onClick={() => shot && setZoomedPhoto(shot)} style={{
                            flex: 1, position: 'relative', minHeight: 88,
                            borderRadius: T.r2, overflow: 'hidden',
                            background: 'rgba(255, 255, 255, 0.02)',
                            border: '1px solid ' + T.border,
                            cursor: shot ? 'zoom-in' : 'default',
                            transition: 'all 0.2s',
                          }}>
                            {shot ? (
                              <>
                                <img src={shot.photoUrl} alt="" style={{ width: '100%', height: '100%', minHeight: 88, objectFit: 'cover', display: 'block' }} />
                                <div style={{
                                  position: 'absolute', bottom: 0, left: 0, right: 0,
                                  padding: '3px 5px',
                                  background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.75))',
                                  fontSize: 8, color: '#fff',
                                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                }}>
                                  <span>{m.icon}</span>
                                  {shot.note && <span style={{ color: T.primary }}>📝</span>}
                                </div>
                              </>
                            ) : (
                              <div style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                height: '100%', minHeight: 88,
                                flexDirection: 'column', gap: 2,
                                color: T.textFaint, fontSize: 9,
                              }}>
                                <span style={{ fontSize: 16 }}>{m.icon}</span>
                                <span>暂无</span>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </section>
        )}

        {/* ============================================================ */}
        {/* Zoom modal — 点击缩略图放大 */}
        {/* ============================================================ */}
        {zoomedPhoto && (
          <div onClick={() => setZoomedPhoto(null)} style={{
            position: 'fixed', inset: 0, zIndex: 99999,
            background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'fadeIn 0.18s ease',
          }}>
            <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '85vh' }} onClick={e => e.stopPropagation()}>
              <img src={zoomedPhoto.photoUrl} alt="" style={{
                maxWidth: '90vw', maxHeight: '75vh', objectFit: 'contain',
                borderRadius: T.r4, display: 'block',
                boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
              }} />
              <button onClick={() => setZoomedPhoto(null)} style={{
                position: 'absolute', top: -36, right: 0, padding: '6px 12px', borderRadius: T.r2,
                background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none',
                cursor: 'pointer', fontSize: 14, minHeight: 30,
                backdropFilter: 'blur(8px)',
              }}>✕</button>
              {zoomedPhoto.note && (
                <div style={{
                  marginTop: 8, padding: '8px 12px',
                  background: 'rgba(0,0,0,0.6)', borderRadius: T.r2,
                  color: T.text, fontSize: 12, backdropFilter: 'blur(8px)',
                }}>
                  📝 {zoomedPhoto.note}
                </div>
              )}
              <div style={{ marginTop: 4, fontSize: 10, color: 'rgba(255, 255, 255, 0.4)', textAlign: 'center' }}>
                点击空白处关闭
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
