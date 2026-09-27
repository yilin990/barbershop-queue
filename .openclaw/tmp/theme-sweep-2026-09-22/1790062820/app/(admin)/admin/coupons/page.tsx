'use client'
import { useToast } from '@/components/ui/Toast'

import { useState, useEffect } from 'react'
import { AdminLayout } from '@/components/admin/AdminLayout'

/**
 * /admin/coupons — 商家自定义券
 * 奕霖 2026-08-05 18:24 + 20:20
 *
 * 列表 + 创建表单 + 改状态 + 删除
 * ⭐ 2026-08-05 20:20 升级：多选 + 批量操作 + 按分类筛选
 */

interface Coupon {
  id: string
  code: string
  name: string
  value: number
  minSpend: number
  type?: string
  status: 'unused' | 'used' | 'expired'
  expiresAt: string
  createdAt: string
}

const TEMPLATES = [
  { label: '满 50-10', name: '满 50 减 10', minSpend: 50, value: 10, days: 30 },
  { label: '满 100-20', name: '满 100 减 20', minSpend: 100, value: 20, days: 30 },
  { label: '满 200-40', name: '满 200 减 40', minSpend: 200, value: 40, days: 30 },
  { label: '满 300-60', name: '满 300 减 60', minSpend: 300, value: 60, days: 30 },
  { label: '满 500-100', name: '满 500 减 100', minSpend: 500, value: 100, days: 30 },
  { label: '新人 5 元', name: '新人专享 - 直接减 5', minSpend: 0, value: 5, days: 7 },
]

const STATUS_COLOR = {
  unused: '#fbbf24',
  used: 'rgba(255,255,255,0.4)',
  expired: '#fb923c',
} as const

const STATUS_LABEL = {
  unused: '可用',
  used: '已用',
  expired: '过期',
} as const

const TYPE_LABEL = {
  discount: '满减',
  new_user: '新人',
  flash_sale: '秒杀',
  shipping: '包邮',
  other: '其他',
} as const

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'unused' | 'used' | 'expired'>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [batchBusy, setBatchBusy] = useState(false)
  const [form, setForm] = useState({ name: '', minSpend: 0, value: 10, days: 30, type: 'discount' as string })
  // ⭐ 奕霖 2026-09-07 20:40 "优惠劵编辑功能好像没有":加单条 edit modal
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null)
  const [editForm, setEditForm] = useState({ name: '', minSpend: 0, value: 0, expiresInDays: 30 })
  const [editSaving, setEditSaving] = useState(false)

  const load = () => {
    setLoading(true)
    fetch('/api/admin/coupons')
      .then((r) => r.json())
      .then((d) => { if (d.success) setCoupons(d.coupons || []) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const toastApi = useToast()
  const showToast = (text: string) => toastApi.toast(text, 'ok')

  const openEdit = (c: Coupon) => {
    setEditingCoupon(c)
    const days = Math.max(1, Math.ceil((new Date(c.expiresAt).getTime() - Date.now()) / 86400000))
    setEditForm({ name: c.name, minSpend: c.minSpend, value: c.value, expiresInDays: days })
  }
  const saveEdit = async () => {
    if (!editingCoupon) return
    if (!editForm.name.trim()) { showToast('请输入券名'); return }
    if (editForm.value <= 0) { showToast('优惠值必须 > 0'); return }
    if (editForm.minSpend > 0 && editForm.value >= editForm.minSpend) { showToast('优惠值 < 满减门槛'); return }
    setEditSaving(true)
    try {
      const res = await fetch(`/api/admin/coupons/${editingCoupon.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || '保存失败')
      showToast('✓ 已保存')
      setEditingCoupon(null)
      load()
    } catch (e: any) {
      showToast(e.message || '保存失败')
    } finally {
      setEditSaving(false)
    }
  }

  const create = async () => {
    if (!form.name.trim()) { showToast('请输入券名'); return }
    if (form.value <= 0) { showToast('优惠值必须 > 0'); return }
    if (form.minSpend > 0 && form.value >= form.minSpend) { showToast('优惠值 < 满减门槛'); return }
    setCreating(true)
    try {
      const res = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (data.success) {
        showToast(`创建成功：${data.coupon.code}`)
        setShowCreate(false)
        setForm({ name: '', minSpend: 0, value: 10, days: 30, type: 'discount' })
        load()
      } else showToast(data.error || '失败')
    } catch (e: any) { showToast(e.message) }
    finally { setCreating(false) }
  }

  const updateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/admin/coupons/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (res.ok) { showToast(`已${STATUS_LABEL[status as keyof typeof STATUS_LABEL]}`); load() }
    } catch {}
  }

  const remove = async (id: string) => {
    if (!confirm('确定删除？')) return
    try {
      const res = await fetch(`/api/admin/coupons/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) { showToast('已删'); load() }
      else showToast(data.error || '失败')
    } catch {}
  }

  const runBatch = async (action: string, type?: string) => {
    if (selectedIds.length === 0) { showToast('先选券'); return }
    if (action === 'delete' && !confirm(`确定删 ${selectedIds.length} 张？已用的不会删`)) return
    if (action === 'expire' && !confirm(`确定过期 ${selectedIds.length} 张？`)) return
    setBatchBusy(true)
    try {
      const res = await fetch('/api/admin/coupons/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds, action, type }),
      })
      const data = await res.json()
      if (data.success) {
        showToast(`${action} 影响 ${data.affected} 张`)
        setSelectedIds([])
        load()
      } else showToast(data.error || '失败')
    } catch (e: any) { showToast(e.message) }
    finally { setBatchBusy(false) }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  }

  // ⭐ P3 2026-09-06 — 导出
  const [exporting, setExporting] = useState(false)
  const handleExport = async () => {
    setExporting(true)
    try {
      const params = new URLSearchParams()
      if (filter !== 'all') params.set('status', filter)
      if (typeFilter !== 'all') params.set('type', typeFilter)
      const r = await fetch(`/api/admin/coupons/export?${params}`, { credentials: 'include' })
      if (!r.ok) { const j = await r.json().catch(()=>({})); showToast(`导出失败: ${j.error||r.statusText}`); return }
      const blob = await r.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `优惠券清单_${new Date().toISOString().slice(0, 10)}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      showToast(`✅ 已导出 ${filtered.length} 张`)
    } catch (e: any) { showToast(e.message) }
    finally { setExporting(false) }
  }

  // 1. 按 status 过滤
  const statusFiltered = filter === 'all' ? coupons : coupons.filter(c => c.status === filter)
  // 2. 再按 type 过滤
  const filtered = typeFilter === 'all' ? statusFiltered : statusFiltered.filter(c => (c.type || 'discount') === typeFilter)

  const counts = {
    all: coupons.length,
    unused: coupons.filter(c => c.status === 'unused').length,
    used: coupons.filter(c => c.status === 'used').length,
    expired: coupons.filter(c => c.status === 'expired').length,
  }

  // 类型计数
  const typeCounts: Record<string, number> = { all: coupons.length, discount: 0, new_user: 0, flash_sale: 0, shipping: 0 }
  coupons.forEach((c) => {
    const t = c.type || 'discount'
    if (typeCounts[t] !== undefined) typeCounts[t]++
  })

  // 全选当前
  const allFilteredSelected = filtered.length > 0 && filtered.every(c => selectedIds.includes(c.id))
  const toggleAll = () => setSelectedIds(allFilteredSelected ? [] : filtered.map(c => c.id))

  return (
    <AdminLayout title="优惠券管理" active="coupons">
      <div style={{ padding: '16px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>🎟️ 优惠券</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>共 {counts.all} 张 · 可用 {counts.unused} · 已用 {counts.used} · 过期 {counts.expired}</div>
          </div>
          <button onClick={handleExport} disabled={exporting} style={{ padding: '8px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 13, fontWeight: 600, border: '1px solid rgba(255,255,255,0.12)', cursor: exporting ? 'wait' : 'pointer', marginRight: 8, opacity: exporting ? 0.6 : 1 }}>{exporting ? '导出中…' : '📥 导出'}</button>
          <button onClick={() => setShowCreate(true)} style={{ padding: '8px 16px', borderRadius: 10, background: 'linear-gradient(135deg, #fbbf24, #4ade80)', color: '#0a0f0d', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer' }}>+ 新建</button>
        </div>

        {/* 模板 chips */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 12 }}>
          {TEMPLATES.map((t) => (
            <button key={t.label} onClick={() => { setForm({ name: t.name, minSpend: t.minSpend, value: t.value, days: t.days, type: 'discount' }); setShowCreate(true) }} style={{ padding: '6px 12px', borderRadius: 14, fontSize: 11, fontWeight: 600, background: 'rgba(127, 220, 148, 0.1)', border: '1px solid rgba(127, 220, 148, 0.3)', color: '#fbbf24', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
              ⚡ {t.label}
            </button>
          ))}
        </div>

        {/* 状态过滤 */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          {(['all', 'unused', 'used', 'expired'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} style={{ padding: '5px 12px', borderRadius: 14, fontSize: 11, fontWeight: 600, background: filter === f ? 'rgba(127, 220, 148, 0.2)' : 'rgba(255, 255, 255, 0.04)', border: filter === f ? '1px solid rgba(127, 220, 148, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)', color: filter === f ? '#fbbf24' : 'rgba(255,255,255,0.6)', cursor: 'pointer' }}>
              {f === 'all' ? '全部' : STATUS_LABEL[f]} ({counts[f]})
            </button>
          ))}
        </div>

        {/* 类型过滤 */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, overflowX: 'auto' }}>
          {([
            { k: 'all', label: '📂 全部', color: '#fbbf24' },
            { k: 'discount', label: '🎁 满减', color: '#fbbf24' },
            { k: 'new_user', label: '🆕 新人', color: '#fbbf24' },
            { k: 'flash_sale', label: '⚡ 秒杀', color: '#f87171' },
            { k: 'shipping', label: '📦 包邮', color: '#60a5fa' },
          ] as const).map((t) => (
            <button key={t.k} onClick={() => setTypeFilter(t.k)} style={{ padding: '4px 10px', borderRadius: 12, fontSize: 10, fontWeight: 600, background: typeFilter === t.k ? `${t.color}22` : 'rgba(255, 255, 255, 0.03)', border: typeFilter === t.k ? `1px solid ${t.color}55` : '1px solid rgba(255, 255, 255, 0.06)', color: typeFilter === t.k ? t.color : 'rgba(255,255,255,0.5)', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {t.label} ({typeCounts[t.k] || 0})
            </button>
          ))}
        </div>

        {/* 批量操作条 */}
        {selectedIds.length > 0 && (
          <div style={{ marginBottom: 12, padding: '10px 12px', background: 'linear-gradient(135deg, rgba(127, 220, 148, 0.1), rgba(127, 220, 148, 0.04))', border: '1px solid rgba(127, 220, 148, 0.3)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#fbbf24' }}>已选 {selectedIds.length} 张</span>
            <button onClick={toggleAll} style={{ padding: '4px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 11, border: 'none', cursor: 'pointer' }}>{allFilteredSelected ? '全不选' : '全选当前'}</button>
            <div style={{ flex: 1 }} />
            <button disabled={batchBusy} onClick={() => runBatch('activate')} style={{ padding: '4px 10px', borderRadius: 6, background: 'rgba(127, 220, 148, 0.15)', color: '#fbbf24', fontSize: 11, border: 'none', cursor: 'pointer' }}>恢复</button>
            <button disabled={batchBusy} onClick={() => runBatch('expire')} style={{ padding: '4px 10px', borderRadius: 6, background: 'rgba(251, 146, 60, 0.15)', color: '#fb923c', fontSize: 11, border: 'none', cursor: 'pointer' }}>过期</button>
            <button disabled={batchBusy} onClick={() => runBatch('delete')} style={{ padding: '4px 10px', borderRadius: 6, background: 'rgba(248, 113, 113, 0.15)', color: '#f87171', fontSize: 11, border: 'none', cursor: 'pointer' }}>删除</button>
            <button onClick={() => setSelectedIds([])} style={{ padding: '4px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', fontSize: 11, border: 'none', cursor: 'pointer' }}>取消</button>
          </div>
        )}

        {/* 列表 */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.5)' }}>加载中...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.5)' }}>暂无</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map((c) => (
              <div key={c.id} onClick={() => toggleSelect(c.id)} style={{ padding: 12, background: selectedIds.includes(c.id) ? 'rgba(127, 220, 148, 0.08)' : 'rgba(255, 255, 255, 0.04)', border: selectedIds.includes(c.id) ? '1px solid rgba(127, 220, 148, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{c.name}</div>
                    <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: `${STATUS_COLOR[c.status]}20`, color: STATUS_COLOR[c.status], fontWeight: 700 }}>{STATUS_LABEL[c.status]}</span>
                    <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(127, 220, 148, 0.15)', color: '#fbbf24', fontWeight: 700 }}>{TYPE_LABEL[(c.type as keyof typeof TYPE_LABEL) || 'other']}</span>
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>CODE: {c.code} · 满¥{c.minSpend} 减¥{c.value} · {c.expiresAt?.slice(0, 10)} 过期</div>
                </div>
                <div style={{ display: 'flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
                  {c.status === 'unused' && (
                    <button onClick={() => updateStatus(c.id, 'expired')} style={{ padding: '4px 8px', borderRadius: 6, fontSize: 10, background: 'rgba(251, 146, 60, 0.15)', color: '#fb923c', border: 'none', cursor: 'pointer' }}>过期</button>
                  )}
                  {c.status === 'expired' && (
                    <button onClick={() => updateStatus(c.id, 'unused')} style={{ padding: '4px 8px', borderRadius: 6, fontSize: 10, background: 'rgba(127, 220, 148, 0.15)', color: '#fbbf24', border: 'none', cursor: 'pointer' }}>恢复</button>
                  )}
                  {c.status !== 'used' && (
                    <>
                      <button onClick={() => openEdit(c)} style={{ padding: '4px 8px', borderRadius: 6, fontSize: 10, background: 'rgba(127, 220, 148, 0.15)', color: '#fbbf24', border: 'none', cursor: 'pointer' }}>✏ 编辑</button>
                      <button onClick={() => remove(c.id)} style={{ padding: '4px 8px', borderRadius: 6, fontSize: 10, background: 'rgba(248, 113, 113, 0.15)', color: '#f87171', border: 'none', cursor: 'pointer' }}>删</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Edit modal ⭐ 奕霖 2026-09-07 20:40 */}
        {editingCoupon && (
          <div onClick={() => setEditingCoupon(null)} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: '#0a0f0d', border: '1px solid #fbbf24', borderRadius: 16, padding: 20, width: '100%', maxWidth: 440, color: '#fff' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>✏️ 编辑券「{editingCoupon.name}」</h3>
              <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} placeholder="券名" style={inputStyle} />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <input type="number" value={editForm.minSpend} onChange={(e) => setEditForm({ ...editForm, minSpend: Number(e.target.value) || 0 })} placeholder="满减门槛" style={inputStyle} />
                <input type="number" value={editForm.value} onChange={(e) => setEditForm({ ...editForm, value: Number(e.target.value) || 0 })} placeholder="优惠值" style={inputStyle} />
              </div>
              <input type="number" value={editForm.expiresInDays} onChange={(e) => setEditForm({ ...editForm, expiresInDays: Number(e.target.value) || 30 })} placeholder="续期天数" style={{ ...inputStyle, marginTop: 8 }} />
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>修改后将重新计算到期时间 (从今天起算)</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button onClick={() => setEditingCoupon(null)} style={{ ...inputStyle, flex: 1 }}>取消</button>
                <button onClick={saveEdit} disabled={editSaving} style={{ ...inputStyle, flex: 2, background: '#fbbf24', color: '#0a0f0d', fontWeight: 700, border: 'none' }}>{editSaving ? '保存中...' : '保存'}</button>
              </div>
            </div>
          </div>
        )}

        {/* Create modal */}
        {showCreate && (
          <div onClick={() => setShowCreate(false)} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: '#0a0f0d', border: '1px solid #fbbf24', borderRadius: 16, padding: 20, width: '100%', maxWidth: 440, color: '#fff' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>新建优惠券</h3>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="券名（如：满 100 减 20）" style={inputStyle} />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <input type="number" value={form.minSpend} onChange={(e) => setForm({ ...form, minSpend: Number(e.target.value) || 0 })} placeholder="满减门槛" style={inputStyle} />
                <input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: Number(e.target.value) || 0 })} placeholder="优惠值" style={inputStyle} />
              </div>
              <input type="number" value={form.days} onChange={(e) => setForm({ ...form, days: Number(e.target.value) || 30 })} placeholder="有效天数" style={{ ...inputStyle, marginTop: 8 }} />
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button onClick={() => setShowCreate(false)} style={{ ...inputStyle, flex: 1 }}>取消</button>
                <button onClick={create} disabled={creating} style={{ ...inputStyle, flex: 2, background: '#fbbf24', color: '#0a0f0d', fontWeight: 700, border: 'none' }}>{creating ? '创建中' : '创建'}</button>
              </div>
            </div>
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', background: 'rgba(127, 220, 148, 0.95)', color: '#0a0f0d', padding: '12px 20px', borderRadius: 10, fontSize: 14, fontWeight: 600, zIndex: 99999 }}>{toast}</div>
        )}
      </div>
    </AdminLayout>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 8,
  background: 'rgba(255, 255, 255, 0.06)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  color: '#fff',
  fontSize: 13,
  boxSizing: 'border-box',
}
