'use client'

/**
 * /admin/services — 服务管理（2026-10-01 清禾方案 A）
 *
 * 功能：CRUD（增删改查）+ 列表搜索 + 多租户严格隔离
 * merchantId 取自 query param ?merchantId=xxx
 *
 * UI 走主 app 棕色金色主题（与 /admin/console 一致）
 */

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { ResponsiveTable, type Column } from '@/components/ui/ResponsiveTable'
import { colors, fontSize, fontWeight, radius, spacing } from '@/lib/design-tokens'
import { DEFAULT_MERCHANT_ID } from '@/lib/merchant'
import { Edit, Plus, Trash2, X, Search, Package, RefreshCw, Image as ImageIcon, Upload } from 'lucide-react'

const CATEGORIES = [
  { code: 'cut', label: '剪发', icon: '✂️' },
  { code: 'dye', label: '染发', icon: '🎨' },
  { code: 'perm', label: '烫发', icon: '🌊' },
  { code: 'care', label: '护发', icon: '🧴' },
  { code: 'style', label: '造型', icon: '💫' },
  { code: 'works', label: '作品', icon: '📸' },
]

interface Service {
  id: string
  merchantId: string
  serviceCode: string
  name: string
  shortName?: string | null
  category: string
  icon?: string | null
  image?: string | null
  description?: string | null
  price: number
  duration: number
  status: string
}

function ServicesPageInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const merchantId = searchParams.get('merchantId') || DEFAULT_MERCHANT_ID

  const [list, setList] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [editTarget, setEditTarget] = useState<Service | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [createBusy, setCreateBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<Service | null>(null)
  const [busy, setBusy] = useState<Record<string, boolean>>({})
  const [merchantName, setMerchantName] = useState('')
  const [imgUploading, setImgUploading] = useState<{ create: boolean; edit: boolean }>({ create: false, edit: false })

  // 表单 state
  const emptyForm = {
    serviceCode: '', name: '', shortName: '', category: 'cut',
    icon: '✂️', price: '0', duration: '60', status: 'active', description: '',
    image: '',
  }
  const [editForm, setEditForm] = useState(emptyForm)
  const [createForm, setCreateForm] = useState(emptyForm)

  // 图片上传（multipart 或 base64）
  const handleImageUpload = async (file: File, target: 'create' | 'edit') => {
    if (!file.type.startsWith('image/')) { alert('只支持图片文件'); return }
    if (file.size > 5 * 1024 * 1024) { alert('图片不能超过 5MB'); return }
    setImgUploading(u => ({ ...u, [target]: true }))
    try {
      const fd = new FormData()
      fd.append('file', file)
      const r = await fetch('/api/services/upload', { method: 'POST', body: fd })
      const d = await r.json()
      if (!d.success) throw new Error(d.error || '上传失败')
      const url = d.url
      if (target === 'create') setCreateForm(f => ({ ...f, image: url }))
      else setEditForm(f => ({ ...f, image: url }))
    } catch (e: any) {
      alert('上传失败：' + e.message)
    } finally {
      setImgUploading(u => ({ ...u, [target]: false }))
    }
  }

  const load = useCallback(async () => {
    if (!merchantId) return
    setLoading(true)
    setError(null)
    try {
      const r = await fetch(`/api/services?merchantId=${encodeURIComponent(merchantId)}&includeInactive=1`)
      const d = await r.json()
      if (!d.success) throw new Error(d.error || '加载失败')
      setList(d.services || [])
      setMerchantName(d.merchant?.name || '')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [merchantId])

  useEffect(() => { load() }, [load])

  // 编辑按钮
  function openEdit(s: Service) {
    setEditTarget(s)
    setEditForm({
      serviceCode: s.serviceCode,
      name: s.name,
      shortName: s.shortName || '',
      category: s.category,
      icon: s.icon || '',
      price: String(s.price),
      duration: String(s.duration),
      status: s.status,
      description: s.description || '',
      image: s.image || '',
    })
  }

  // 保存编辑
  async function saveEdit() {
    if (!editTarget) return
    if (!editForm.name.trim()) { alert('服务名不能为空'); return }
    if (!editForm.serviceCode.trim()) { alert('服务编码不能为空'); return }
    setBusy(b => ({ ...b, [editTarget.id]: true }))
    try {
      const r = await fetch(`/api/services/${editTarget.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchantId, ...editForm, price: Number(editForm.price), duration: parseInt(editForm.duration) }),
      })
      const d = await r.json()
      if (!d.success) throw new Error(d.error || '保存失败')
      setEditTarget(null)
      load()
    } catch (e: any) {
      alert('保存失败：' + e.message)
    } finally {
      setBusy(b => ({ ...b, [editTarget.id]: false }))
    }
  }

  // 创建服务
  async function createService() {
    if (!createForm.serviceCode.trim()) { alert('服务编码不能为空'); return }
    if (!createForm.name.trim()) { alert('服务名不能为空'); return }
    setCreateBusy(true)
    try {
      const r = await fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchantId, ...createForm, price: Number(createForm.price), duration: parseInt(createForm.duration) }),
      })
      const d = await r.json()
      if (!d.success) throw new Error(d.error || '创建失败')
      setShowCreate(false)
      setCreateForm(emptyForm)
      load()
    } catch (e: any) {
      alert('创建失败：' + e.message)
    } finally {
      setCreateBusy(false)
    }
  }

  // 删除服务
  async function doDelete() {
    if (!confirmDelete) return
    setBusy(b => ({ ...b, [confirmDelete.id]: true }))
    try {
      const r = await fetch(`/api/services/${confirmDelete.id}?merchantId=${encodeURIComponent(merchantId)}`, { method: 'DELETE' })
      const d = await r.json()
      if (!d.success) throw new Error(d.error || '删除失败')
      setConfirmDelete(null)
      load()
    } catch (e: any) {
      alert('删除失败：' + e.message)
    } finally {
      setBusy(b => ({ ...b, [confirmDelete.id]: false }))
    }
  }

  if (!merchantId) {
    return (
      <div style={{ padding: 24 }}>
        <Card>
          <h2 style={{ color: colors.text, fontSize: 18, margin: 0 }}>⚠️ 缺少 merchantId 参数</h2>
          <p style={{ color: colors.textDim, fontSize: 13, marginTop: 8 }}>
            多租户隔离必需 merchantId，访问 <code>/admin/services?merchantId=xxx</code>
          </p>
        </Card>
      </div>
    )
  }

  // 过滤
  const filtered = list.filter(s => {
    if (q && !(s.name.includes(q) || s.serviceCode.includes(q) || (s.shortName || '').includes(q))) return false
    if (categoryFilter && s.category !== categoryFilter) return false
    return true
  })

  const columns: Column[] = [
    {
      key: 'icon', label: '', width: 64,
      render: (s: Service) => (
        <div style={{
          width: 44, height: 44, borderRadius: 8,
          background: s.image ? `url(${s.image}) center/cover` : 'rgba(184,134,11,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, border: '1px solid rgba(184,134,11,0.25)',
        }}>
          {!s.image && (s.icon || '💇')}
        </div>
      ),
    },
    {
      key: 'serviceCode', label: '编码', width: 100,
      render: (s: Service) => <code style={{ color: colors.primary, fontSize: 12 }}>{s.serviceCode}</code>,
    },
    {
      key: 'name', label: '服务名',
      render: (s: Service) => (
        <div>
          <div style={{ color: colors.text, fontWeight: 600 }}>{s.name}</div>
          {s.shortName && <div style={{ color: colors.textDim, fontSize: 11 }}>{s.shortName}</div>}
        </div>
      ),
    },
    {
      key: 'category', label: '分类', width: 100,
      render: (s: Service) => {
        const c = CATEGORIES.find(c => c.code === s.category)
        return <span style={{ fontSize: 13 }}>{c?.icon} {c?.label || s.category}</span>
      },
    },
    {
      key: 'price', label: '价格', width: 80,
      render: (s: Service) => <span style={{ color: colors.primary, fontWeight: 600 }}>¥{s.price}</span>,
    },
    {
      key: 'duration', label: '时长', width: 70,
      render: (s: Service) => <span style={{ color: colors.textDim }}>{s.duration}分钟</span>,
    },
    {
      key: 'status', label: '状态', width: 80,
      render: (s: Service) => (
        <span style={{
          fontSize: 11, padding: '2px 8px', borderRadius: 6,
          background: s.status === 'active' ? 'rgba(184,134,11,0.15)' : 'rgba(255,100,100,0.15)',
          color: s.status === 'active' ? colors.primary : '#ff6b6b',
        }}>
          {s.status === 'active' ? '上架' : '下架'}
        </span>
      ),
    },
    {
      key: 'actions', label: '操作', width: 120,
      render: (s: Service) => (
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => openEdit(s)} style={{
            padding: '4px 10px', borderRadius: 6, border: '1px solid #b8860b',
            background: 'rgba(184,134,11,0.1)', color: '#b8860b',
            fontSize: 12, cursor: 'pointer',
          }}>
            <Edit size={12} style={{ marginRight: 3, verticalAlign: 'middle' }} />编辑
          </button>
          <button onClick={() => setConfirmDelete(s)} style={{
            padding: '4px 10px', borderRadius: 6, border: '1px solid #ff6b6b',
            background: 'rgba(255,107,107,0.1)', color: '#ff6b6b',
            fontSize: 12, cursor: 'pointer',
          }}>
            <Trash2 size={12} style={{ marginRight: 3, verticalAlign: 'middle' }} />删
          </button>
        </div>
      ),
    },
  ]

  return (
    <div style={{ padding: 16 }}>
      {/* 顶部 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 16, padding: '12px 16px',
        background: '#fffaf0', borderRadius: 12, border: '1px solid rgba(184,134,11,0.2)',
      }}>
        <div>
          <h1 style={{ fontSize: 20, color: '#2c1810', margin: 0 }}>
            <Package size={20} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            造型服务管理
          </h1>
          <div style={{ fontSize: 12, color: '#5d3a1f', marginTop: 4 }}>
            商户：<b>{merchantName}</b>（{merchantId}）· {list.length} 项
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button onClick={load} variant="outline" size="sm">
            <RefreshCw size={14} style={{ marginRight: 4 }} />刷新
          </Button>
          <Button onClick={() => setShowCreate(true)} variant="primary" size="sm">
            <Plus size={14} style={{ marginRight: 4 }} />新增服务
          </Button>
        </div>
      </div>

      {/* 搜索 + 分类过滤 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9a7a4a' }} />
          <input
            value={q} onChange={e => setQ(e.target.value)}
            placeholder="搜索服务名 / 编码 / 简称"
            style={{
              width: '100%', padding: '8px 10px 8px 30px', fontSize: 13,
              border: '1px solid rgba(184,134,11,0.2)', borderRadius: 8,
              background: '#fffaf0', color: '#2c1810', outline: 'none',
            }}
          />
        </div>
        <select
          value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
          style={{
            padding: '8px 12px', borderRadius: 8,
            border: '1px solid rgba(184,134,11,0.2)',
            background: '#fffaf0', color: '#2c1810', fontSize: 13,
          }}
        >
          <option value="">全部分类</option>
          {CATEGORIES.map(c => <option key={c.code} value={c.code}>{c.icon} {c.label}</option>)}
        </select>
      </div>

      {/* 列表 */}
      {loading && <Card><div style={{ padding: 40, textAlign: 'center', color: '#5d3a1f' }}>加载中…</div></Card>}
      {error && <Card><div style={{ padding: 16, color: '#ff6b6b' }}>❌ {error}</div></Card>}
      {!loading && !error && (
        <Card>
          {filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#5d3a1f' }}>
              {list.length === 0 ? '还没有服务 · 点右上"新增服务"开始' : '没有匹配的服务'}
            </div>
          ) : (
            <ResponsiveTable columns={columns} data={filtered} rowKey="id" />
          )}
        </Card>
      )}

      {/* 编辑 Modal */}
      {editTarget && (
        <Modal open onClose={() => setEditTarget(null)} title={`编辑 · ${editTarget.name}`}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="服务编码">
              <input value={editForm.serviceCode} onChange={e => setEditForm({ ...editForm, serviceCode: e.target.value })}
                style={inputStyle} />
            </Field>
            <Field label="服务名 *">
              <input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                style={inputStyle} />
            </Field>
            <Field label="简称">
              <input value={editForm.shortName} onChange={e => setEditForm({ ...editForm, shortName: e.target.value })}
                style={inputStyle} />
            </Field>
            <Field label="分类 *">
              <select value={editForm.category} onChange={e => setEditForm({ ...editForm, category: e.target.value })}
                style={inputStyle}>
                {CATEGORIES.map(c => <option key={c.code} value={c.code}>{c.icon} {c.label}</option>)}
              </select>
            </Field>
            <Field label="图标">
              <input value={editForm.icon} onChange={e => setEditForm({ ...editForm, icon: e.target.value })}
                placeholder="✂️" style={inputStyle} />
            </Field>
            <Field label="价格 (¥)">
              <input value={editForm.price} onChange={e => setEditForm({ ...editForm, price: e.target.value })}
                type="number" style={inputStyle} />
            </Field>
            <Field label="时长 (分钟)">
              <input value={editForm.duration} onChange={e => setEditForm({ ...editForm, duration: e.target.value })}
                type="number" style={inputStyle} />
            </Field>
            <Field label="状态">
              <select value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })}
                style={inputStyle}>
                <option value="active">上架</option>
                <option value="inactive">下架</option>
              </select>
            </Field>
            <Field label="描述" full>
              <textarea value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                rows={2} style={{ ...inputStyle, fontFamily: 'inherit' }} />
            </Field>
            <Field label="服务图" full>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{
                  width: 96, height: 96, borderRadius: 10, flexShrink: 0,
                  background: editForm.image ? `url(${editForm.image}) center/cover` : 'rgba(184,134,11,0.1)',
                  border: '1.5px dashed rgba(184,134,11,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 28, color: '#9a7a4a',
                }}>
                  {!editForm.image && '✂️'}
                </div>
                <div style={{ flex: 1 }}>
                  <input type="file" accept="image/*" disabled={imgUploading.edit}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, 'edit'); e.target.value = '' }}
                    style={{ display: 'none' }} id="edit-img-input" />
                  <label htmlFor="edit-img-input" style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
                    background: 'rgba(184,134,11,0.15)', color: '#b8860b',
                    border: '1px solid #b8860b', fontSize: 13, fontWeight: 600,
                  }}>
                    <Upload size={14} />
                    {imgUploading.edit ? '上传中…' : (editForm.image ? '更换图片' : '上传图片')}
                  </label>
                  <input value={editForm.image} onChange={e => setEditForm({ ...editForm, image: e.target.value })}
                    placeholder="或粘贴 /uploads/... 或 https://..." style={{ ...inputStyle, marginTop: 6 }} />
                </div>
              </div>
            </Field>
          </div>
          <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="outline" onClick={() => setEditTarget(null)}>取消</Button>
            <Button variant="primary" onClick={saveEdit} disabled={busy[editTarget.id]}>
              {busy[editTarget.id] ? '保存中…' : '保存'}
            </Button>
          </div>
        </Modal>
      )}

      {/* 新建 Modal */}
      {showCreate && (
        <Modal open onClose={() => setShowCreate(false)} title="新增服务">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="服务编码 *">
              <input value={createForm.serviceCode} onChange={e => setCreateForm({ ...createForm, serviceCode: e.target.value })}
                placeholder="如 SRV001" style={inputStyle} />
            </Field>
            <Field label="服务名 *">
              <input value={createForm.name} onChange={e => setCreateForm({ ...createForm, name: e.target.value })}
                placeholder="如 日韩短发造型" style={inputStyle} />
            </Field>
            <Field label="简称">
              <input value={createForm.shortName} onChange={e => setCreateForm({ ...createForm, shortName: e.target.value })}
                style={inputStyle} />
            </Field>
            <Field label="分类 *">
              <select value={createForm.category} onChange={e => setCreateForm({ ...createForm, category: e.target.value })}
                style={inputStyle}>
                {CATEGORIES.map(c => <option key={c.code} value={c.code}>{c.icon} {c.label}</option>)}
              </select>
            </Field>
            <Field label="图标">
              <input value={createForm.icon} onChange={e => setCreateForm({ ...createForm, icon: e.target.value })}
                style={inputStyle} />
            </Field>
            <Field label="价格 (¥)">
              <input value={createForm.price} onChange={e => setCreateForm({ ...createForm, price: e.target.value })}
                type="number" style={inputStyle} />
            </Field>
            <Field label="时长 (分钟)">
              <input value={createForm.duration} onChange={e => setCreateForm({ ...createForm, duration: e.target.value })}
                type="number" style={inputStyle} />
            </Field>
            <Field label="状态">
              <select value={createForm.status} onChange={e => setCreateForm({ ...createForm, status: e.target.value })}
                style={inputStyle}>
                <option value="active">上架</option>
                <option value="inactive">下架</option>
              </select>
            </Field>
            <Field label="描述" full>
              <textarea value={createForm.description} onChange={e => setCreateForm({ ...createForm, description: e.target.value })}
                rows={2} style={{ ...inputStyle, fontFamily: 'inherit' }} />
            </Field>
            <Field label="服务图" full>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{
                  width: 96, height: 96, borderRadius: 10, flexShrink: 0,
                  background: createForm.image ? `url(${createForm.image}) center/cover` : 'rgba(184,134,11,0.1)',
                  border: '1.5px dashed rgba(184,134,11,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 28, color: '#9a7a4a',
                }}>
                  {!createForm.image && '✂️'}
                </div>
                <div style={{ flex: 1 }}>
                  <input type="file" accept="image/*" disabled={imgUploading.create}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, 'create'); e.target.value = '' }}
                    style={{ display: 'none' }} id="create-img-input" />
                  <label htmlFor="create-img-input" style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
                    background: 'rgba(184,134,11,0.15)', color: '#b8860b',
                    border: '1px solid #b8860b', fontSize: 13, fontWeight: 600,
                  }}>
                    <Upload size={14} />
                    {imgUploading.create ? '上传中…' : (createForm.image ? '更换图片' : '上传图片')}
                  </label>
                  <input value={createForm.image} onChange={e => setCreateForm({ ...createForm, image: e.target.value })}
                    placeholder="或粘贴 /uploads/... 或 https://..." style={{ ...inputStyle, marginTop: 6 }} />
                </div>
              </div>
            </Field>
          </div>
          <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="outline" onClick={() => setShowCreate(false)}>取消</Button>
            <Button variant="primary" onClick={createService} disabled={createBusy}>
              {createBusy ? '创建中…' : '创建'}
            </Button>
          </div>
        </Modal>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="删除服务"
        message={`确定删除「${confirmDelete?.name}」？此操作不可恢复。`}
        confirmText="删除"
        onConfirm={doDelete}
        onCancel={() => setConfirmDelete(null)}
        danger
      />
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: 13,
  border: '1px solid rgba(184,134,11,0.25)', borderRadius: 6,
  background: '#fffaf0', color: '#2c1810', outline: 'none', boxSizing: 'border-box',
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div style={{ gridColumn: full ? '1 / -1' : undefined }}>
      <div style={{ fontSize: 11, color: '#5d3a1f', marginBottom: 4, fontWeight: 600 }}>{label}</div>
      {children}
    </div>
  )
}

export default function ServicesPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: '#5d3a1f' }}>加载中…</div>}>
      <ServicesPageInner />
    </Suspense>
  )
}