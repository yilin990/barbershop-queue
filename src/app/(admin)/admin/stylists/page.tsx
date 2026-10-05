'use client'

/**
 * /admin/stylists - 理发师编辑页（店长模式 2026-10-01）
 *
 * 流程：
 * - 顶部 + 添加理发师
 * - 卡片列表：头像/姓名/简介/擅长/起价/操作（编辑/删除）
 * - 编辑 modal：所有字段可改
 */

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Plus, Edit, Trash2, Upload, RefreshCw } from 'lucide-react'

interface Stylist {
  id: string
  merchantId: string
  name: string
  avatar?: string | null
  bio?: string | null
  specialties: string[]
  yearsOfExp?: number
  startPrice: number
  rating: number
}

const SPECIALTIES = [
  { code: 'cut', label: '剪发', icon: '✂️' },
  { code: 'dye', label: '染发', icon: '🎨' },
  { code: 'perm', label: '烫发', icon: '🌊' },
  { code: 'care', label: '护发', icon: '🧴' },
  { code: 'style', label: '造型', icon: '💫' },
]

function AdminStylistsInner() {
  const searchParams = useSearchParams()
  const merchantId = searchParams.get('merchantId') || 'm_barber_001'

  const [list, setList] = useState<Stylist[]>([])
  const [loading, setLoading] = useState(true)
  const [editTarget, setEditTarget] = useState<Stylist | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Stylist | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const emptyForm = {
    name: '', bio: '', avatar: '',
    specialties: [] as string[],
    yearsOfExp: '5', startPrice: '98',
  }
  const [createForm, setCreateForm] = useState(emptyForm)
  const [editForm, setEditForm] = useState(emptyForm)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/stylists?merchantId=${encodeURIComponent(merchantId)}`)
      const d = await r.json()
      if (!d.success) throw new Error(d.error || '加载失败')
      setList(d.stylists || [])
    } catch (e: any) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [merchantId])

  useEffect(() => { load() }, [load])

  function toggleSpecialty(form: typeof createForm, code: string): string[] {
    return form.specialties.includes(code)
      ? form.specialties.filter(s => s !== code)
      : [...form.specialties, code]
  }

  function openEdit(s: Stylist) {
    setEditTarget(s)
    setEditForm({
      name: s.name, bio: s.bio || '', avatar: s.avatar || '',
      specialties: s.specialties,
      yearsOfExp: String(s.yearsOfExp || 5),
      startPrice: String(s.startPrice),
    })
  }

  async function handleSaveCreate() {
    if (!createForm.name.trim()) { alert('请输入姓名'); return }
    setBusy(true)
    try {
      const r = await fetch('/api/stylists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantId,
          ...createForm,
          yearsOfExp: parseInt(createForm.yearsOfExp) || 5,
          startPrice: parseInt(createForm.startPrice) || 98,
          specialties: JSON.stringify(createForm.specialties),
        }),
      })
      const d = await r.json()
      if (!d.success) throw new Error(d.error || '创建失败')
      setShowCreate(false)
      setCreateForm(emptyForm)
      load()
    } catch (e: any) {
      alert('创建失败：' + e.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleSaveEdit() {
    if (!editTarget) return
    setBusy(true)
    try {
      const r = await fetch(`/api/stylists/${editTarget.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantId,
          ...editForm,
          yearsOfExp: parseInt(editForm.yearsOfExp) || 5,
          startPrice: parseInt(editForm.startPrice) || 98,
          specialties: JSON.stringify(editForm.specialties),
        }),
      })
      const d = await r.json()
      if (!d.success) throw new Error(d.error || '保存失败')
      setEditTarget(null)
      load()
    } catch (e: any) {
      alert('保存失败：' + e.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return
    setBusy(true)
    try {
      const r = await fetch(`/api/stylists/${confirmDelete.id}?merchantId=${encodeURIComponent(merchantId)}`, { method: 'DELETE' })
      const d = await r.json()
      if (!d.success) throw new Error(d.error || '删除失败')
      setConfirmDelete(null)
      load()
    } catch (e: any) {
      alert('删除失败：' + e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 16, padding: '12px 16px',
        background: '#fffaf0', borderRadius: 12,
        border: '1px solid rgba(184,134,11,0.2)',
      }}>
        <div>
          <h1 style={{ fontSize: 20, color: '#2c1810', margin: 0 }}>💇 理发师管理</h1>
          <div style={{ fontSize: 12, color: '#5d3a1f', marginTop: 4 }}>
            商户 {merchantId} · {list.length} 位理发师
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={load} style={btn('outline')}>
            <RefreshCw size={14} style={{ marginRight: 4 }} />刷新
          </button>
          <button onClick={() => setShowCreate(true)} style={btn('primary')}>
            <Plus size={14} style={{ marginRight: 4 }} />添加理发师
          </button>
        </div>
      </div>

      {loading && <div style={{ padding: 40, textAlign: 'center', color: '#9a7a4a' }}>加载中…</div>}
      {!loading && list.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: '#9a7a4a' }}>
          还没有数据 · 点"添加理发师"开始
        </div>
      )}
      {!loading && list.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {list.map(s => (
            <div key={s.id} style={{
              background: '#fffaf0', border: '1px solid rgba(184,134,11,0.2)',
              borderRadius: 14, padding: 14,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: '50%',
                  background: s.avatar ? `url(${s.avatar}) center/cover` : 'rgba(184,134,11,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
                  border: '2px solid rgba(184,134,11,0.3)',
                }}>
                  {!s.avatar && '💇'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#2c1810' }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: '#8d6e63' }}>⭐ {s.rating.toFixed(1)} · {s.yearsOfExp} 年</div>
                </div>
              </div>
              {s.bio && <div style={{ fontSize: 12, color: '#5d3a1f', marginBottom: 8 }}>{s.bio}</div>}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
                {s.specialties.map(sp => (
                  <span key={sp} style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 6,
                    background: 'rgba(184,134,11,0.1)', color: '#b8860b',
                  }}>
                    {SPECIALTIES.find(x => x.code === sp)?.icon} {SPECIALTIES.find(x => x.code === sp)?.label || sp}
                  </span>
                ))}
              </div>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                paddingTop: 8, borderTop: '1px solid rgba(184,134,11,0.15)',
              }}>
                <span style={{ fontSize: 13, color: '#b8860b', fontWeight: 700 }}>起价 ¥{s.startPrice}</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => openEdit(s)} style={btn('outline')}>
                    <Edit size={12} style={{ marginRight: 3 }} />编辑
                  </button>
                  <button onClick={() => setConfirmDelete(s)} style={{ ...btn('outline'), color: '#ff6b6b', borderColor: '#ff6b6b' }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 创建 modal */}
      {showCreate && (
        <Modal onClose={() => setShowCreate(false)} title="添加理发师">
          <Form
            form={createForm}
            setForm={setCreateForm}
            toggle={(c) => setCreateForm(f => ({ ...f, specialties: toggleSpecialty(f, c) }))}
          />
          <div style={trocButtons}>
            <button onClick={() => setShowCreate(false)} style={btn('outline')}>取消</button>
            <button onClick={handleSaveCreate} disabled={busy} style={btn('primary')}>
              {busy ? '保存中…' : '创建'}
            </button>
          </div>
        </Modal>
      )}

      {/* 编辑 modal */}
      {editTarget && (
        <Modal onClose={() => setEditTarget(null)} title={`编辑 · ${editTarget.name}`}>
          <Form
            form={editForm}
            setForm={setEditForm}
            toggle={(c) => setEditForm(f => ({ ...f, specialties: toggleSpecialty(f, c) }))}
          />
          <div style={trocButtons}>
            <button onClick={() => setEditTarget(null)} style={btn('outline')}>取消</button>
            <button onClick={handleSaveEdit} disabled={busy} style={btn('primary')}>
              {busy ? '保存中…' : '保存'}
            </button>
          </div>
        </Modal>
      )}

      {/* 删除确认 */}
      {confirmDelete && (
        <Modal onClose={() => setConfirmDelete(null)} title="删除理发师">
          <div style={{ color: '#2c1810', fontSize: 14, marginBottom: 16 }}>
            确定删除「<strong>{confirmDelete.name}</strong>」？此操作不可恢复。
          </div>
          <div style={trocButtons}>
            <button onClick={() => setConfirmDelete(null)} style={btn('outline')}>取消</button>
            <button onClick={handleDelete} disabled={busy} style={{ ...btn('primary'), background: '#ff6b6b' }}>
              {busy ? '删除中…' : '确认删除'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: 13,
  border: '1px solid rgba(184,134,11,0.25)', borderRadius: 6,
  background: '#fffaf0', color: '#2c1810', outline: 'none', boxSizing: 'border-box',
}

function Form({ form, setForm, toggle }: any) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <Field label="姓名 *">
        <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inputStyle} />
      </Field>
      <Field label="从业年限">
        <input type="number" value={form.yearsOfExp} onChange={e => setForm({ ...form, yearsOfExp: e.target.value })} style={inputStyle} />
      </Field>
      <Field label="起价 (¥)">
        <input type="number" value={form.startPrice} onChange={e => setForm({ ...form, startPrice: e.target.value })} style={inputStyle} />
      </Field>
      <Field label="头像 URL">
        <input value={form.avatar} onChange={e => setForm({ ...form, avatar: e.target.value })} placeholder="/uploads/... 或 https://..." style={inputStyle} />
      </Field>
      <Field label="简介" full>
        <textarea value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} rows={2}
          style={{ ...inputStyle, fontFamily: 'inherit' }} />
      </Field>
      <Field label="擅长技能" full>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {SPECIALTIES.map(s => (
            <button key={s.code} onClick={() => toggle(s.code)} style={{
              padding: '8px 14px', borderRadius: 8,
              border: form.specialties.includes(s.code) ? '1.5px solid #b8860b' : '1px solid rgba(184,134,11,0.25)',
              background: form.specialties.includes(s.code) ? 'rgba(184,134,11,0.18)' : '#fffaf0',
              color: form.specialties.includes(s.code) ? '#b8860b' : '#5d3a1f',
              fontSize: 13, cursor: 'pointer',
            }}>
              {s.icon} {s.label}
            </button>
          ))}
        </div>
      </Field>
    </div>
  )
}

function Field({ label, children, full }: { label: string; children: any; full?: boolean }) {
  return (
    <div style={{ gridColumn: full ? '1 / -1' : undefined }}>
      <div style={{ fontSize: 11, color: '#5d3a1f', marginBottom: 4, fontWeight: 600 }}>{label}</div>
      {children}
    </div>
  )
}

function Modal({ children, onClose, title }: any) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.5)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: 16,
    }} onClick={onClose}>
      <div style={{
        background: '#fffaf0', borderRadius: 14, padding: 20,
        width: '100%', maxWidth: 560, maxHeight: '90vh', overflow: 'auto',
        border: '2px solid #b8860b',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, color: '#2c1810', margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: 24, color: '#5d3a1f', cursor: 'pointer' }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

const btn = (variant: 'primary' | 'outline'): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center',
  padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
  background: variant === 'primary' ? '#b8860b' : 'rgba(184,134,11,0.1)',
  color: variant === 'primary' ? '#fffaf0' : '#b8860b',
  border: variant === 'primary' ? '1px solid #b8860b' : '1px solid #b8860b',
})

const trocButtons: React.CSSProperties = {
  marginTop: 16, display: 'flex', gap: 8, justifyContent: 'flex-end',
}

export default function AdminStylistsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: 'center' }}>加载中…</div>}>
      <AdminStylistsInner />
    </Suspense>
  )
}
