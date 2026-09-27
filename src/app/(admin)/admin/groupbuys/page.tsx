'use client'

import { confirmDialog } from '@/lib/ui-bus'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { useToast } from '@/components/ui/Toast'
import Link from 'next/link'

interface GroupBuy {
  id: string
  productId: string
  productName: string
  productSpec: string | null
  originalPrice: number
  groupPrice: number
  requiredPeople: number
  currentPeople: number
  maxStock: number | null
  status: 'active' | 'success' | 'expired' | 'closed'
  expiresAt: string
  createdAt: string
  actualMemberCount: number
}

interface Product {
  id: string
  name: string
  shortName?: string
  spec?: string
  price: number
  stock: number
  categoryLabel?: string
}

const STATUS_LABEL: Record<string, string> = {
  active: '进行中',
  success: '已成团',
  expired: '已过期',
  closed: '已关闭',
}
const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  active: { bg: 'rgba(16,185,129,0.18)', fg: '#b8860b' },
  success: { bg: 'rgba(184, 134, 11,0.18)', fg: '#b8860b' },
  expired: { bg: 'rgba(107,114,128,0.18)', fg: '#9ca3af' },
  closed: { bg: 'rgba(239,68,68,0.18)', fg: '#ef4444' },
}

export default function GroupBuysPage() {
  const toast = useToast()
  const [list, setList] = useState<GroupBuy[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [filter, setFilter] = useState<'all' | 'active' | 'success' | 'expired'>('all')
  const [viewGroup, setViewGroup] = useState<GroupBuy | null>(null)
  const [viewLoading, setViewLoading] = useState(false)
  const [viewMembers, setViewMembers] = useState<any[]>([])
  const [viewProduct, setViewProduct] = useState<any | null>(null)

  // 创建表单状态
  const [searchQ, setSearchQ] = useState('')
  const [searchResults, setSearchResults] = useState<Product[]>([])
  const [searching, setSearching] = useState(false)
  const [picked, setPicked] = useState<Product | null>(null)
  const [form, setForm] = useState({ requiredPeople: '3', durationDays: '7', maxStock: '' })
  const debounceRef = useRef<any>(null)

  const load = async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/admin/groupbuys?status=${filter === 'all' ? '' : filter}`, { credentials: 'include' })
      const json = await r.json()
      if (json.success) setList(json.groups)
      else toast.toast(json.error || '加载失败', 'err')
    } catch (e: any) {
      toast.toast(e.message, 'err')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [filter])

  // 商品搜索（debounce 300ms）
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!searchQ.trim()) { setSearchResults([]); return }
    setSearching(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/products?q=${encodeURIComponent(searchQ)}&inStock=1&limit=20`, { credentials: 'include' })
        const json = await r.json()
        if (json.success) {
          setSearchResults((json.products || []).map((p: any) => ({
            id: p.id, name: p.name, shortName: p.shortName, spec: p.spec,
            price: Number(p.price), stock: Number(p.stock), categoryLabel: p.categoryLabel,
          })))
        }
      } finally { setSearching(false) }
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [searchQ])

  const handleCreate = async () => {
    if (!picked) {
      toast.toast('请选择商品', 'err'); return
    }
    const people = Number(form.requiredPeople)
    if (!Number.isInteger(people) || people < 2 || people > 20) {
      toast.toast('人数必须 2-20 的整数', 'err'); return
    }
    const days = Number(form.durationDays)
    if (!Number.isInteger(days) || days < 1 || days > 30) {
      toast.toast('天数必须 1-30 的整数', 'err'); return
    }
    const ms = form.maxStock.trim() === '' ? null : Number(form.maxStock)
    if (ms !== null && (!Number.isInteger(ms) || ms < 1)) {
      toast.toast('限兑库存必须是 ≥1 的整数（留空=不限）', 'err'); return
    }
    setSubmitting(true)
    try {
      const r = await fetch('/api/admin/groupbuys', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: picked.id,
          requiredPeople: people,
          durationDays: days,
          maxStock: ms,
        }),
      })
      const json = await r.json()
      if (json.success) {
        toast.toast(`✓ 已开团「${json.group.productName}」¥${json.group.groupPrice} × ${people}人${ms ? `（限 ${ms} 份）` : ''}`, 'ok')
        setShowCreate(false); setPicked(null); setSearchQ(''); setSearchResults([])
        setForm({ requiredPeople: '3', durationDays: '7', maxStock: '' })
        load()
      } else {
        toast.toast(json.error || '开团失败', 'err')
      }
    } catch (e: any) {
      toast.toast(e.message, 'err')
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = async (g: GroupBuy) => {
    if (!await confirmDialog(`关闭拼团「${g.productName}」？`)) return
    try {
      const r = await fetch(`/api/admin/groupbuys/${g.id}`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'closed' }),
      })
      const json = await r.json()
      if (json.success) { toast.toast(`✓ 已关闭`, 'ok'); load() }
      else toast.toast(json.error || '关闭失败', 'err')
    } catch (e: any) { toast.toast(e.message, 'err') }
  }

  const handleDelete = async (g: GroupBuy) => {
    if (!await confirmDialog(`删除拼团「${g.productName}」？将一并删除所有成员记录，不可恢复`)) return
    try {
      const r = await fetch(`/api/admin/groupbuys/${g.id}`, {
        method: 'DELETE', credentials: 'include',
      })
      const json = await r.json()
      if (json.success) { toast.toast(`✓ 已删除`, 'ok'); load() }
      else toast.toast(json.error || '删除失败', 'err')
    } catch (e: any) { toast.toast(e.message, 'err') }
  }

  // ⭐ P3 2026-09-06 — 导出
  const [exporting, setExporting] = useState(false)
  const handleExport = async () => {
    setExporting(true)
    try {
      const params = new URLSearchParams()
      if (filter !== 'all') params.set('status', filter)
      const r = await fetch(`/api/admin/groupbuys/export?${params}`, { credentials: 'include' })
      if (!r.ok) { const j = await r.json().catch(()=>({})); toast.toast(`导出失败: ${j.error||r.statusText}`, 'err'); return }
      const blob = await r.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `拼团记录_${new Date().toISOString().slice(0, 10)}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      toast.toast(`✅ 已导出 ${list.length} 个团`, 'ok')
    } catch (e: any) { toast.toast(e.message, 'err') }
    finally { setExporting(false) }
  }

  const openView = async (g: GroupBuy) => {
    setViewGroup(g)
    setViewMembers([])
    setViewProduct(null)
    setViewLoading(true)
    try {
      const r = await fetch(`/api/groups/join?groupId=${g.id}`, { credentials: 'include' })
      const json = await r.json()
      if (json.success) {
        setViewMembers(json.members || [])
        setViewProduct({
          productStock: json.group.productStock,
          maxStock: json.group.maxStock,
          status: json.group.status,
        })
      }
    } catch {/* */}
    finally { setViewLoading(false) }
  }

  const closeView = () => { setViewGroup(null); setViewMembers([]); setViewProduct(null) }

  const stats = {
    total: list.length,
    active: list.filter((g) => g.status === 'active').length,
    success: list.filter((g) => g.status === 'success').length,
    expired: list.filter((g) => g.status === 'expired' || g.status === 'closed').length,
  }

  return (
    <AdminLayout title="🎯 拼团管理" active="groupbuys">
      {/* 统计卡片（响应式 grid） */}
      <div className="gb-stats-grid">
        <StatBox label="全部" value={stats.total} onClick={() => setFilter('all')} active={filter === 'all'} />
        <StatBox label="进行中" value={stats.active} color="#b8860b" onClick={() => setFilter('active')} active={filter === 'active'} />
        <StatBox label="已成团" value={stats.success} color="#b8860b" onClick={() => setFilter('success')} active={filter === 'success'} />
        <StatBox label="已结束" value={stats.expired} color="#6b7280" onClick={() => setFilter('expired')} active={filter === 'expired'} />
      </div>

      {/* 操作栏 */}
      <div className="gb-toolbar">
        <button onClick={() => setShowCreate(true)} className="gb-btn-primary">＋ 开新团</button>
        <button onClick={() => load()} className="gb-btn-ghost">🔄 刷新</button>
        <button onClick={handleExport} disabled={exporting} className="gb-btn-ghost" style={{ opacity: exporting ? 0.5 : 1, cursor: exporting ? 'wait' : 'pointer' }}>{exporting ? '导出中…' : '📥 导出 Excel'}</button>
        <span className="gb-tip">💡 团购价自动按原价 7 折，满员自动下单</span>
      </div>

      {/* 开团弹窗 */}
      {showCreate && (
        <ModalOverlay onClose={() => setShowCreate(false)}>
          <ModalCard title="🎯 开新拼团" onClose={() => setShowCreate(false)}>
            {/* 商品搜索 */}
            <FieldLabel>选择商品 <span className="gb-req">*</span></FieldLabel>
            {picked ? (
              <div className="gb-picked-box">
                <div>
                  <div className="gb-picked-name">{picked.shortName || picked.name}</div>
                  <div className="gb-picked-meta">
                    {picked.spec ? `${picked.spec} · ` : ''}¥{picked.price.toFixed(2)} · 库存 {picked.stock}
                    {picked.categoryLabel ? ` · ${picked.categoryLabel}` : ''}
                  </div>
                </div>
                <button onClick={() => { setPicked(null); setSearchQ('') }} className="gb-btn-sm" style={{ color: '#ef4444' }}>换</button>
              </div>
            ) : (
              <>
                <input
                  className="gb-input"
                  placeholder="🔍 搜索商品名 / 简称 / 规格..."
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  autoFocus
                />
                <div className="gb-results">
                  {searching && <div className="gb-hint">搜索中…</div>}
                  {!searching && searchQ && searchResults.length === 0 && <div className="gb-hint">没有匹配商品，试试别的关键词</div>}
                  {searchResults.map((p) => (
                    <div key={p.id} className="gb-result-item" onClick={() => { setPicked(p); setSearchQ(''); setSearchResults([]) }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="gb-result-name">{p.shortName || p.name}</div>
                        <div className="gb-result-meta">
                          {p.spec ? `${p.spec} · ` : ''}{p.categoryLabel ? `${p.categoryLabel} · ` : ''}¥{p.price.toFixed(2)} · 库存 {p.stock}
                        </div>
                      </div>
                      <span className="gb-btn-sm" style={{ color: '#b8860b' }}>选</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* 表单 */}
            <div className="gb-form-grid">
              <div>
                <FieldLabel>成团人数</FieldLabel>
                <input className="gb-input" type="number" min="2" max="20"
                  value={form.requiredPeople}
                  onChange={(e) => setForm({ ...form, requiredPeople: e.target.value })}
                />
                <div className="gb-hint">2-20 人，默认 3</div>
              </div>
              <div>
                <FieldLabel>持续天数</FieldLabel>
                <input className="gb-input" type="number" min="1" max="30"
                  value={form.durationDays}
                  onChange={(e) => setForm({ ...form, durationDays: e.target.value })}
                />
                <div className="gb-hint">1-30 天，自动 expired</div>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <FieldLabel>本团库存限额（可选）</FieldLabel>
                <input className="gb-input" type="number" min="1"
                  placeholder="留空 = 跟随商品库存"
                  value={form.maxStock}
                  onChange={(e) => setForm({ ...form, maxStock: e.target.value })}
                />
                <div className="gb-hint">达到上限后新成员无法加入，留空 = 不限</div>
              </div>
            </div>

            {/* 团购价预览 */}
            {picked && (
              <div className="gb-preview">
                <div>原价 <strong>¥{picked.price.toFixed(2)}</strong></div>
                <div className="gb-arrow">→</div>
                <div>团价 <strong className="gb-preview-price">¥{(Math.max(0.01, Math.round(picked.price * 0.7 * 100) / 100)).toFixed(2)}</strong></div>
                <div className="gb-discount">省 {Math.round((1 - 0.7) * 100)}%</div>
              </div>
            )}

            <div className="gb-modal-actions">
              <button onClick={() => setShowCreate(false)} className="gb-btn-ghost" disabled={submitting}>取消</button>
              <button onClick={handleCreate} className="gb-btn-primary" disabled={submitting || !picked}>
                {submitting ? '开团中…' : '确认开团'}
              </button>
            </div>
          </ModalCard>
        </ModalOverlay>
      )}

      {/* 查看详情 modal */}
      {viewGroup && (
        <ModalOverlay onClose={closeView}>
          <ModalCard title={`🎯 ${viewGroup.productName}`} onClose={closeView} wide>
            <div className="gb-view-grid">
              <InfoRow label="团 ID" value={<span style={{ fontFamily: 'monospace', fontSize: 12 }}>{viewGroup.id}</span>} />
              <InfoRow label="原价 / 团价" value={`¥${viewGroup.originalPrice.toFixed(2)} → ¥${viewGroup.groupPrice.toFixed(2)}`} />
              <InfoRow label="进度" value={`${viewGroup.currentPeople}/${viewGroup.requiredPeople} 人`} />
              <InfoRow label="库存限制" value={viewGroup.maxStock ? `${viewGroup.maxStock} 份` : '跟随商品库存'} />
              <InfoRow label="商品现库存" value={viewProduct ? `${viewProduct.productStock ?? '?'} 份` : '加载中…'} />
              <InfoRow label="状态" value={<StatusBadge status={viewGroup.status} />} />
              <InfoRow label="到期" value={<CountdownLabel expiresAt={viewGroup.expiresAt} />} />
              <InfoRow label="开团时间" value={new Date(viewGroup.createdAt).toLocaleString('zh-CN', { hour12: false })} />
            </div>

            <div className="gb-view-section-title">成员列表 ({viewMembers.length}/{viewGroup.requiredPeople})</div>
            {viewLoading ? <div className="gb-hint">加载中…</div> :
              viewMembers.length === 0 ? <div className="gb-hint">暂无成员</div> : (
                <div className="gb-members">
                  {viewMembers.map((m, i) => (
                    <div key={m.id} className="gb-member-row">
                      <div className="gb-member-avatar">{m.nickname.slice(0, 1)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="gb-member-name">
                          {m.nickname}
                          {i === 0 && <span className="gb-tag" style={{ background: 'rgba(251,191,36,0.18)', color: '#b8860b', marginLeft: 6 }}>团长</span>}
                        </div>
                        <div className="gb-member-meta">{m.phone.slice(0, 3)}****{m.phone.slice(-4)} · {new Date(m.joinedAt).toLocaleString('zh-CN', { hour12: false }).slice(5, 16)}</div>
                      </div>
                      {m.orderId && (
                        <Link href={`/orders?phone=${m.phone}`} target="_blank" className="gb-btn-sm" style={{ color: '#b8860b', textDecoration: 'none' }}>
                          查看订单 →
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              )
            }
          </ModalCard>
        </ModalOverlay>
      )}

      {/* 列表 */}
      {loading ? (
        <div className="gb-loading">加载中…</div>
      ) : list.length === 0 ? (
        <div className="gb-empty">
          <div className="gb-empty-emoji">🎯</div>
          <div className="gb-empty-title">还没有{filter !== 'all' ? `「${STATUS_LABEL[filter]}」` : ''}的拼团</div>
          <div className="gb-empty-hint">点击「＋ 开新团」开始</div>
        </div>
      ) : (
        <div className="gb-list">
          {list.map((g) => (
            <GroupRow key={g.id} g={g} onView={() => openView(g)} onClose={() => handleClose(g)} onDelete={() => handleDelete(g)} toast={toast} />
          ))}
        </div>
      )}

      <style jsx>{`
        .gb-stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 16px; margin-bottom: 24px; }
        .gb-toolbar { display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; align-items: center; }
        .gb-tip { margin-left: auto; font-size: 13px; color: #9ca3af; }
        .gb-req { color: #ef4444; }
        .gb-hint { font-size: 12px; color: #9ca3af; margin-top: 4px; }
        .gb-loading, .gb-empty { padding: 60px 20px; text-align: center; color: #9ca3af; background: rgba(255,255,255,0.03); border-radius: 16px; border: 1px dashed rgba(255,255,255,0.1); }
        .gb-empty-emoji { font-size: 48px; margin-bottom: 16px; }
        .gb-empty-title { font-size: 16px; margin-bottom: 8px; }
        .gb-empty-hint { font-size: 13px; }
        .gb-list { display: grid; gap: 12px; }
        .gb-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 16px; }
        .gb-card-head { display: flex; align-items: center; gap: 14px; margin-bottom: 12px; }
        .gb-card-name { font-size: 15px; font-weight: 600; color: #fff; }
        .gb-card-meta { font-size: 12px; color: #9ca3af; margin-top: 4px; }
        .gb-card-progress { margin-top: 8px; }
        .gb-progress-bar { height: 6px; background: rgba(255,255,255,0.06); border-radius: 3px; overflow: hidden; margin-top: 6px; }
        .gb-progress-fill { height: 100%; background: linear-gradient(90deg, #b8860b, #06b6d4); transition: width 0.3s; }
        .gb-status-badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 700; }
        .gb-status-active { background: rgba(16,185,129,0.18); color: #b8860b; }
        .gb-status-success { background: rgba(59,130,246,0.18); color: #60a5fa; }
        .gb-status-expired { background: rgba(107,114,128,0.18); color: #9ca3af; }
        .gb-status-closed { background: rgba(239,68,68,0.18); color: #f87171; }
        .gb-card-footer { display: flex; gap: 12px; margin-top: 10px; font-size: 11px; color: #9ca3af; flex-wrap: wrap; }
        .gb-card-footer > span:last-child { margin-left: auto; }
        .gb-result-item { display: flex; align-items: center; padding: 10px; border-radius: 8px; cursor: pointer; transition: background 0.15s; gap: 10px; }
        .gb-result-item:hover { background: rgba(184, 134, 11,0.15); }
        .gb-result-name { font-size: 14px; color: #fff; font-weight: 600; }
        .gb-result-meta { font-size: 12px; color: #9ca3af; margin-top: 2px; }
        .gb-results { max-height: 240px; overflow-y: auto; background: rgba(0,0,0,0.3); border-radius: 10px; padding: 6px; margin-top: 6px; border: 1px solid rgba(255,255,255,0.08); }
        .gb-picked-box { display: flex; align-items: center; gap: 12px; background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.3); border-radius: 10px; padding: 12px; margin-bottom: 6px; }
        .gb-picked-name { font-size: 14px; color: #fff; font-weight: 600; }
        .gb-picked-meta { font-size: 12px; color: #b8860b; margin-top: 4px; }
        .gb-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 16px; }
        .gb-preview { display: flex; align-items: center; gap: 12px; background: linear-gradient(135deg, rgba(74,222,128,0.15), rgba(184, 134, 11,0.15)); border: 1px solid rgba(184, 134, 11,0.3); border-radius: 10px; padding: 12px; margin-top: 16px; font-size: 13px; color: #fff; }
        .gb-arrow { color: #9ca3af; font-size: 16px; }
        .gb-preview-price { color: #4ade80; font-size: 18px; }
        .gb-discount { margin-left: auto; background: rgba(16,185,129,0.18); color: #b8860b; padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; }
        .gb-modal-actions { display: flex; gap: 8px; margin-top: 24px; justify-content: flex-end; }
        .gb-btn-primary { padding: 10px 16px; border-radius: 10px; border: none; cursor: pointer; background: linear-gradient(135deg, #4ade80, #b8860b); color: #fff; font-size: 14px; font-weight: 600; }
        .gb-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .gb-btn-ghost { padding: 10px 16px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1); cursor: pointer; background: transparent; color: #9ca3af; font-size: 14px; }
        .gb-btn-sm { padding: 6px 10px; border-radius: 8px; border: none; cursor: pointer; background: rgba(255,255,255,0.06); color: #fff; font-size: 12px; font-weight: 600; text-decoration: none; display: inline-block; }
        .gb-view-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 20px; margin-bottom: 20px; }
        .gb-view-section-title { font-size: 14px; color: #9ca3af; margin: 16px 0 10px; font-weight: 600; }
        .gb-member-row { display: flex; align-items: center; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.06); gap: 12px; }
        .gb-member-row:last-child { border-bottom: none; }
        .gb-member-avatar { width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #4ade80, #b8860b); display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 14px; flex-shrink: 0; }
        .gb-member-name { font-size: 14px; color: #fff; }
        .gb-member-meta { font-size: 12px; color: #9ca3af; margin-top: 2px; }
        .gb-tag { font-size: 11px; padding: 2px 8px; border-radius: 999px; font-weight: 600; display: inline-block; }

        @media (max-width: 640px) {
          .gb-stats-grid { grid-template-columns: 1fr 1fr; gap: 10px; }
          .gb-toolbar { gap: 8px; }
          .gb-tip { display: none; }
          .gb-form-grid { grid-template-columns: 1fr; }
          .gb-view-grid { grid-template-columns: 1fr; }
          .gb-card-head { flex-wrap: wrap; }
        }
      `}</style>
    </AdminLayout>
  )
}

function GroupRow({ g, onView, onClose, onDelete, toast }: { g: GroupBuy; onView: () => void; onClose: () => void; onDelete: () => void; toast: any }) {
  const [copied, setCopied] = useState(false)
  const isFull = g.currentPeople >= g.requiredPeople
  const progress = Math.min(100, (g.currentPeople / g.requiredPeople) * 100)
  const expiresAt = new Date(g.expiresAt)
  const expired = expiresAt < new Date()
  const daysLeft = Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 86400000))

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/groups/${g.id}` : `/groups/${g.id}`

  const copyShare = async () => {
    try { await navigator.clipboard.writeText(shareUrl); setCopied(true); toast.toast('✓ 链接已复制', 'ok'); setTimeout(() => setCopied(false), 1500) }
    catch { toast.toast('复制失败', 'err') }
  }

  return (
    <div className="gb-card">
      <div className="gb-card-head">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <span className="gb-card-name">{g.productName}</span>
            <StatusBadge status={g.status} />
            {g.status === 'active' && expired && <span className="gb-tag" style={{ background: 'rgba(239,68,68,0.18)', color: '#ef4444' }}>已过期</span>}
          </div>
          <div className="gb-card-meta">
            {g.productSpec ? `${g.productSpec} · ` : ''}
            ¥<span style={{ color: '#b8860b', fontWeight: 700 }}>{g.groupPrice.toFixed(2)}</span>
            <span style={{ textDecoration: 'line-through', marginLeft: 6 }}>¥{g.originalPrice.toFixed(2)}</span>
            <span style={{ marginLeft: 12 }}>× {g.currentPeople}/{g.requiredPeople} 人</span>
            {g.maxStock != null && (
              <span style={{ marginLeft: 12, color: '#b8860b' }}>· 库存上限 {g.maxStock}</span>
            )}
            {g.actualMemberCount > 0 && (
              <span style={{ marginLeft: 12 }}>· 真实成员 {g.actualMemberCount}</span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap' }}>
          <button onClick={copyShare} className="gb-btn-sm" style={{ color: copied ? '#b8860b' : '#3b82f6' }}>{copied ? '✓ 已复制' : '🔗 链接'}</button>
          <button onClick={onView} className="gb-btn-sm" style={{ color: '#b8860b' }}>👁 查看</button>
          {g.status === 'active' && <button onClick={onClose} className="gb-btn-sm" style={{ color: '#f59e0b' }}>关闭</button>}
          <button onClick={onDelete} className="gb-btn-sm" style={{ color: '#ef4444' }}>删除</button>
        </div>
      </div>

      <div className="gb-card-progress">
        <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 8, height: 8, overflow: 'hidden' }}>
          <div style={{ width: `${progress}%`, height: '100%', background: isFull ? 'linear-gradient(90deg, #b8860b, #4ade80)' : 'linear-gradient(90deg, #4ade80, #b8860b)', transition: 'width 0.3s' }} />
        </div>
      </div>

      <div className="gb-card-footer">
        <span>ID: {g.id.slice(0, 14)}…</span>
        {g.status === 'active' && !expired && <span style={{ color: daysLeft <= 2 ? '#f59e0b' : undefined }}>剩 {daysLeft} 天</span>}
        <span>{new Date(g.createdAt).toLocaleString('zh-CN', { hour12: false }).slice(5, 16)}</span>
      </div>
    </div>
  )
}

function StatBox({ label, value, color, onClick, active }: { label: string; value: number; color?: string; onClick: () => void; active: boolean }) {
  return (
    <div onClick={onClick} className="gb-stat-box" style={{ background: active ? 'rgba(184, 134, 11,0.15)' : 'rgba(255,255,255,0.04)', border: active ? '1px solid rgba(184, 134, 11,0.4)' : '1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: color || '#fff' }}>{value}</div>
      <style jsx>{` .gb-stat-box { border-radius: 14px; padding: 16px 20px; cursor: pointer; transition: all 0.15s; } `}</style>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS.expired
  return <span className="gb-tag" style={{ background: c.bg, color: c.fg }}>{STATUS_LABEL[status] || status}</span>
}

function CountdownLabel({ expiresAt }: { expiresAt: string }) {
  const [_, force] = useState(0)
  useEffect(() => { const t = setInterval(() => force((x) => x + 1), 60000); return () => clearInterval(t) }, [])
  const left = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)
  if (left <= 0) return <span style={{ color: '#ef4444' }}>已过期</span>
  const d = Math.floor(left / 86400), h = Math.floor((left % 86400) / 3600), m = Math.floor((left % 3600) / 60)
  return <span style={{ fontFamily: 'monospace' }}>{d > 0 ? `${d}天` : ''}{h.toString().padStart(2, '0')}:{m.toString().padStart(2, '0')}</span>
}

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return <div role="dialog" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>{children}</div>
}

function ModalCard({ title, children, onClose, wide }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div onClick={(e) => e.stopPropagation()} style={{ background: '#0a0f0d', border: '1px solid rgba(184, 134, 11,0.3)', borderRadius: 16, padding: 24, width: '100%', maxWidth: wide ? 640 : 480, maxHeight: '90vh', overflow: 'auto' }}>
      <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>{title}</span>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#9ca3af', fontSize: 20, cursor: 'pointer' }}>×</button>
      </h3>
      {children}
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label style={{ display: 'block', fontSize: 13, color: '#9ca3af', marginBottom: 6 }}>{children}</label>
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 14, color: '#fff' }}>{value}</div>
    </div>
  )
}
