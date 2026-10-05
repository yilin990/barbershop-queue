'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { useToast } from '@/components/ui/Toast'

interface Activity {
  id: string
  title: string
  subtitle: string
  type: string
  status: string
  startAt: string
  endAt: string
  createdAt: string
  description?: string
  coverImage?: string
  // ⭐ v3.0 统计字段
  views?: number
  clicks?: number
  productIds?: string[]
}

interface NewActivityForm {
  title: string
  subtitle: string
  type: string
  startAt: string
  endAt: string
  description: string
  coverImage: string
  productIds: string[]  // ⭐ v2.1（奕霖 2026-07-18）：活动绑定商品
  discountTiers?: { minSpend: number; value: number }[]  // ⭐ 奕霖 2026-08-05 18:24 满减规则
}

const statusColor = (s: string) => {
  if (s === 'active' || s === 'published') return { bg: 'rgba(184, 134, 11, 0.18)', color: '#b8860b', label: '进行中' }
  if (s === 'draft') return { bg: 'rgba(107, 114, 128, 0.18)', color: '#9ca3af', label: '草稿' }
  if (s === 'ended') return { bg: 'rgba(239, 68, 68, 0.18)', color: '#ef4444', label: '已结束' }
  if (s === 'cancelled') return { bg: 'rgba(239, 68, 68, 0.18)', color: '#ef4444', label: '已取消' }
  return { bg: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', label: s }
}

const typeIcon = (t: string) => {
  if (t === 'promotion') return '🎁'
  if (t === 'flash_sale') return '⚡'
  if (t === 'banner') return '📣'
  if (t === 'new_arrival') return '🆕'
  if (t === 'points_double') return '💎'
  if (t === 'discount') return '💰'
  return '📌'
}

const typeLabel = (t: string): string => {
  const map: Record<string, string> = {
    promotion: '满减促销',
    flash_sale: '限时秒杀',
    banner: '广告横幅',
    new_arrival: '新品上市',
    points_double: '积分翻倍',
    discount: '直接打折',
  }
  return map[t] || '其他'
}

export default function ActivitiesPage() {
  const [list, setList] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Activity | null>(null)
  // ⭐ v3.0 状态过滤（奕霖 23:55 反馈"先推进活动界面"）
  const [statusFilterState, setStatusFilterState] = useState<'all' | 'active' | 'draft' | 'ended' | 'cancelled'>('all')
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
  const [busy, setBusy] = useState(false)

  const load = () => {
    setLoading(true)
    fetch('/api/admin/activities', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => { if (d.success) setList(d.activities) })
      .finally(() => setLoading(false))
  }

  useEffect(load, [])
  // ⭐ 奕霖 2026-09-07 20:52 "没有添加活动按键":从 settings 跳过来 ?action=create 自动开
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('action') === 'create') {
      setShowCreate(true)
      // 清掉 URL param,避免刷新重复触发
      params.delete('action')
      const newSearch = params.toString()
      const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '')
      window.history.replaceState({}, '', newUrl)
    }
  }, [])

  // ⭐ 奕霖 2026-08-05 21:29：删除活动（按钮已加，函数补上）
  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`确定删除活动「${title}」？此操作不可恢复`)) return
    try {
      const res = await fetch(`/api/admin/activities/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) { showToast('✓ 已删除', 'ok'); load() }
      else showToast(data.error || '删除失败', 'err')
    } catch (e: any) { showToast(e.message || '网络错误', 'err') }
  }

  const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2500)
  }

  const [creating, setCreating] = useState<NewActivityForm>({ title: '', subtitle: '', type: 'promotion', startAt: '', endAt: '', description: '', coverImage: '', productIds: [], discountTiers: [] })
  const [creating_, setCreatingBusy] = useState(false)
  const [generatingAI, setGeneratingAI] = useState(false)  // ⭐ 奕霖 2026-08-05 20:20 AI 图生成中状态
  const [showCreate, setShowCreate] = useState(false)

  const handleCreate = async () => {
    if (!creating.title.trim()) { showToast('❌ 活动标题不能为空', 'err'); return }
    setCreatingBusy(true)
    try {
      const r = await fetch('/api/admin/activities', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: creating.title.trim(),
          subtitle: creating.subtitle.trim(),
          type: creating.type,
          startAt: creating.startAt || undefined,
          endAt: creating.endAt || undefined,
          description: creating.description || undefined,
          coverImage: creating.coverImage || undefined,
          productIds: creating.productIds,  // ⭐ v2.1: 传给 API（之前 API 总是收 [])
          // ⭐ 奕霖 2026-08-05 18:24 满减规则：tiers → rules JSON
          rules: creating.type === 'promotion' && (creating.discountTiers?.length || 0) > 0
            ? { tiers: creating.discountTiers }
            : undefined,
        }),
      })
      const result = await r.json()
      if (r.status === 401) showToast('❌ 登录已过期', 'err')
      else if (result.success) {
        showToast(`✅ 活动「${creating.title}」已创建`)
        setCreating({ title: '', subtitle: '', type: 'promotion', startAt: '', endAt: '', description: '', coverImage: '', productIds: [] })
        setShowCreate(false)
        load()
      } else {
        showToast(`❌ ${result.error || '失败'}`, 'err')
      }
    } catch (e: any) {
      showToast(`❌ ${e.message}`, 'err')
    } finally {
      setCreatingBusy(false)
    }
  }

  const handleSave = async (a: Activity, patch: Partial<Activity>) => {
    setBusy(true)
    try {
      const r = await fetch(`/api/admin/activities/${a.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const result = await r.json()
      if (r.status === 401) showToast('❌ 登录已过期', 'err')
      else if (result.success) {
        showToast(`✅ 已保存（${result.updatedFields} 个字段）`)
        load()
        setEditing(null)
      } else {
        showToast(`❌ ${result.error}`, 'err')
      }
    } catch (e: any) {
      showToast(`❌ ${e.message}`, 'err')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AdminLayout title="活动管理" active="activities">
      <div style={{ minHeight: '100vh', background: 'radial-gradient(ellipse at top, rgba(184, 134, 11, 0.04) 0%, transparent 50%), linear-gradient(180deg, #0a0f0d 0%, #050807 100%)', color: '#fff', fontFamily: '-apple-system, "PingFang SC", sans-serif' }}>
        <div style={{ background: 'rgba(15, 22, 18, 0.6)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid rgba(184, 134, 11, 0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 24px' }}>
            <Link href="/admin" style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(184, 134, 11, 0.08)', color: '#b8860b', fontSize: 12, textDecoration: 'none' }}>← 数据概览</Link>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>🎁 活动管理</h1>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>共 {list.length} 场</span>
              <button onClick={() => setShowCreate(true)} style={{ padding: '6px 14px', borderRadius: 8, background: 'rgba(184, 134, 11, 0.18)', color: '#b8860b', border: '1px solid rgba(184, 134, 11, 0.3)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>+ 新建活动</button>
            </div>
          </div>
        </div>

        {/* ⭐ v3.0 统计面板（奕霖 23:55 反馈"先推进活动界面"） */}
        {!loading && list.length > 0 && (() => {
          const counts = { active: 0, draft: 0, ended: 0, cancelled: 0 }
          let totalViews = 0, totalClicks = 0
          list.forEach((a: any) => {
            if (a.status === 'active' || a.status === 'published') counts.active++
            else if (a.status === 'draft') counts.draft++
            else if (a.status === 'ended') counts.ended++
            else if (a.status === 'cancelled') counts.cancelled++
            totalViews += a.views || 0
            totalClicks += a.clicks || 0
          })
          const stats = [
            { l: '总活动', v: list.length, c: '#ffffff', u: '场' },
            { l: '进行中', v: counts.active, c: '#b8860b', u: '场' },
            { l: '草稿', v: counts.draft, c: '#9ca3af', u: '场' },
            { l: '已结束', v: counts.ended, c: '#ef4444', u: '场' },
            { l: '总浏览', v: totalViews, c: '#60a5fa', u: '次' },
            { l: '总点击', v: totalClicks, c: '#b8860b', u: '次' },
          ]
          return (
            <div style={{ padding: '0 24px 16px', maxWidth: 900, display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
              {stats.map((c, i) => (
                <div key={i} style={{ background: 'rgba(15, 22, 18, 0.6)', border: `1px solid ${c.c}33`, borderRadius: 12, padding: '12px 14px' }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>{c.l}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                    <span style={{ fontSize: 22, fontWeight: 800, color: c.c }}>{c.v}</span>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{c.u}</span>
                  </div>
                </div>
              ))}
            </div>
          )
        })()}

        {/* ⭐ v4.0 一键模板区（奕霖 8-4 01:49 全权开干） */}
        <div style={{ padding: '0 24px 12px', maxWidth: 900 }}>
          <div style={{ background: 'rgba(184, 134, 11, 0.06)', border: '1px solid rgba(184, 134, 11, 0.18)', borderRadius: 14, padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 14 }}>📋</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#b8860b' }}>一键模板创建</span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>点击下方模板即自动创建并发布（30 天有效期）</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {[
                { key: 'full_reduction', icon: '🎁', title: '满减特惠', desc: '满 100 减 10 / 满 200 减 30 / 满 500 减 80', color: '#b8860b' },
                { key: 'flash_sale', icon: '⚡', title: '限时秒杀', desc: '24h 倒计时 · 8 折 · 限 100 件', color: '#ff9a6b' },
                { key: 'new_user', icon: '🆕', title: '新人专享', desc: '首单 9 折 · 注册 7 天内可用', color: '#60a5fa' },
                { key: 'points_double', icon: '💎', title: '积分翻倍', desc: '消费 1 元 = 4 分（双倍）', color: '#a78bfa' },
              ].map((tpl) => (
                <button
                  key={tpl.key}
                  disabled={creating_}
                  onClick={async () => {
                    setCreatingBusy(true)
                    try {
                      const r = await fetch('/api/admin/activities/quick-create', {
                        method: 'POST',
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ template: tpl.key, days: 30 }),
                      })
                      const result = await r.json()
                      if (result.success) {
                        showToast(`✅ ${result.message}`)
                        load()
                      } else {
                        showToast(`❌ ${result.error || '失败'}`, 'err')
                      }
                    } catch (e: any) {
                      showToast(`❌ ${e.message}`, 'err')
                    } finally {
                      setCreatingBusy(false)
                    }
                  }}
                  style={{
                    padding: '12px 10px', borderRadius: 10,
                    background: `${tpl.color}11`,
                    border: `1px solid ${tpl.color}44`,
                    color: '#fff', cursor: creating_ ? 'wait' : 'pointer',
                    textAlign: 'left', fontFamily: 'inherit',
                  }}
                >
                  <div style={{ fontSize: 18, marginBottom: 4 }}>{tpl.icon}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, color: tpl.color }}>{tpl.title}</div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', lineHeight: 1.4 }}>{tpl.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ⭐ v3.0 状态过滤 chips（奕霖 23:55 反馈） */}
        {!loading && list.length > 0 && (() => {
          const counts: Record<string, number> = { all: list.length, active: 0, draft: 0, ended: 0, cancelled: 0 }
          list.forEach((a: any) => {
            if (a.status === 'active' || a.status === 'published') counts.active++
            else if (a.status === 'draft') counts.draft++
            else if (a.status === 'ended') counts.ended++
            else if (a.status === 'cancelled') counts.cancelled++
          })
          const chips = [
            { v: 'all', l: '全部', n: counts.all, c: '#b8860b' },
            { v: 'active', l: '进行中', n: counts.active, c: '#b8860b' },
            { v: 'draft', l: '草稿', n: counts.draft, c: '#9ca3af' },
            { v: 'ended', l: '已结束', n: counts.ended, c: '#ef4444' },
            { v: 'cancelled', l: '已取消', n: counts.cancelled, c: '#9ca3af' },
          ]
          return (
            <div style={{ padding: '0 24px 12px', maxWidth: 900, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {chips.map((f) => (
                <button key={f.v} onClick={() => setStatusFilterState(f.v as any)} style={{
                  padding: '6px 14px', borderRadius: 20,
                  background: statusFilterState === f.v ? `${f.c}22` : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${statusFilterState === f.v ? f.c : 'rgba(255,255,255,0.08)'}`,
                  color: statusFilterState === f.v ? f.c : 'rgba(255,255,255,0.6)',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  {f.l}
                  <span style={{
                    padding: '0 6px', borderRadius: 8,
                    background: statusFilterState === f.v ? `${f.c}33` : 'rgba(255,255,255,0.08)',
                    fontSize: 10, fontWeight: 700,
                  }}>{f.n}</span>
                </button>
              ))}
            </div>
          )
        })()}

        <div style={{ padding: '24px', maxWidth: 900 }}>
          {loading ? (
            <Center>加载活动中…</Center>
          ) : list.length === 0 ? (
            <Center>🎁 暂无活动</Center>
          ) : (() => {
              const filtered = statusFilterState === 'all' ? list : list.filter((a: any) => a.status === statusFilterState)
              if (filtered.length === 0) {
                return <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.4)' }}>当前筛选下无活动</div>
              }
              return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filtered.map((a) => {
                const sc = statusColor(a.status)
                return (
                  <div key={a.id} style={{ background: 'rgba(15, 22, 18, 0.6)', border: '1px solid rgba(184, 134, 11, 0.08)', borderRadius: 14, padding: 16, display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                    {a.coverImage ? (
                      <img src={a.coverImage} alt={a.title} style={{ width: 64, height: 64, borderRadius: 10, objectFit: 'cover', flexShrink: 0, background: 'rgba(255,255,255,0.05)' }} />
                    ) : (
                      <div style={{ width: 64, height: 64, borderRadius: 12, background: 'rgba(184, 134, 11, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>{typeIcon(a.type)}</div>
                    )}
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 15, fontWeight: 700 }}>{a.title}</span>
                        <span style={{ padding: '2px 10px', borderRadius: 6, background: sc.bg, color: sc.color, fontSize: 11, fontWeight: 700 }}>{sc.label}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>{a.subtitle}</div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 6, fontFamily: 'monospace' }}>
                        {typeLabel(a.type)} · {new Date(a.startAt).toLocaleDateString('zh-CN')} ~ {new Date(a.endAt).toLocaleDateString('zh-CN')}
                      </div>
                      {/* ⭐ v3.0 统计：浏览/点击/绑定商品/CTR */}
                      <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 11, color: 'rgba(255,255,255,0.5)', flexWrap: 'wrap' }}>
                        <span>👁 <span style={{ color: '#60a5fa', fontWeight: 700 }}>{a.views ?? 0}</span> 浏览</span>
                        <span>🖱 <span style={{ color: '#b8860b', fontWeight: 700 }}>{a.clicks ?? 0}</span> 点击</span>
                        <span>🛒 <span style={{ color: '#b8860b', fontWeight: 700 }}>{Array.isArray(a.productIds) ? a.productIds.length : 0}</span> 商品</span>
                        <span style={{ color: 'rgba(255,255,255,0.3)' }}>CTR {(a.views ?? 0) > 0 ? (((a.clicks ?? 0) / (a.views ?? 0)) * 100).toFixed(1) : '0'}%</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <button onClick={() => setEditing(a)} style={{ padding: '6px 14px', borderRadius: 8, background: 'rgba(184, 134, 11, 0.15)', color: '#b8860b', border: '1px solid rgba(184, 134, 11, 0.3)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>✏ 编辑</button>
                      <button onClick={() => handleDelete(a.id, a.title)} style={{ padding: '6px 14px', borderRadius: 8, background: 'rgba(248, 113, 113, 0.15)', color: '#f87171', border: '1px solid rgba(248, 113, 113, 0.3)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>🗑 删除</button>
                    </div>
                  </div>
                )
              })}
            </div>
              )
            })()}
        </div>

        {editing && (
          <EditModal
            activity={editing}
            onClose={() => setEditing(null)}
            onSave={(patch) => handleSave(editing, patch)}
            busy={busy}
          />
        )}

        {showCreate && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ background: 'rgba(15, 22, 18, 0.95)', border: '1px solid rgba(184, 134, 11, 0.3)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 480, maxHeight: '85vh', display: 'flex', flexDirection: 'column', fontFamily: '-apple-system, "PingFang SC", sans-serif', color: '#fff' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, flexShrink: 0 }}>🎁 新建活动</h3>
              <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4, minHeight: 0 }}>
              <Field label="活动标题">
                <input value={creating.title} onChange={(e) => setCreating({ ...creating, title: e.target.value })} style={inputStyle} placeholder="如：双十二满减" />
              </Field>
              <Field label="副标题">
                <input value={creating.subtitle} onChange={(e) => setCreating({ ...creating, subtitle: e.target.value })} style={inputStyle} placeholder="一句话说明" />
              </Field>
              <Field label="类型">
                <select value={creating.type} onChange={(e) => setCreating({ ...creating, type: e.target.value })} style={inputStyle}>
                  <option value="promotion">🎁 满减促销</option>
                  <option value="discount">💰 直接打折</option>
                  <option value="new_arrival">🆕 新品上市</option>
                  <option value="points_double">💎 积分翻倍</option>
                  <option value="flash_sale">⚡ 限时秒杀</option>
                  <option value="banner">📣 广告横幅</option>
                </select>
              </Field>
              {/* ⭐ 奕霖 2026-08-05 18:24 满减规则：多档（满 X 减 Y）*/}
              {creating.type === 'promotion' && (
                <Field label="满减规则（多档）">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {(creating.discountTiers || []).map((t, i) => (
                      <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', width: 24 }}>满</span>
                        <input
                          type="number"
                          value={t.minSpend || ''}
                          onChange={(e) => {
                            const next = [...(creating.discountTiers || [])]
                            next[i] = { ...next[i], minSpend: parseFloat(e.target.value) || 0 }
                            setCreating({ ...creating, discountTiers: next })
                          }}
                          placeholder="100"
                          style={{ ...inputStyle, flex: 1 }}
                        />
                        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>减</span>
                        <input
                          type="number"
                          value={t.value || ''}
                          onChange={(e) => {
                            const next = [...(creating.discountTiers || [])]
                            next[i] = { ...next[i], value: parseFloat(e.target.value) || 0 }
                            setCreating({ ...creating, discountTiers: next })
                          }}
                          placeholder="20"
                          style={{ ...inputStyle, flex: 1 }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const next = (creating.discountTiers || []).filter((_, idx) => idx !== i)
                            setCreating({ ...creating, discountTiers: next })
                          }}
                          style={{ padding: '4px 10px', borderRadius: 6, background: 'rgba(248, 113, 113, 0.15)', color: '#f87171', border: 'none', fontSize: 11, cursor: 'pointer' }}
                        >删</button>
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => {
                          const next = [...(creating.discountTiers || []), { minSpend: 0, value: 0 }]
                          setCreating({ ...creating, discountTiers: next })
                        }}
                        style={{ flex: 1, padding: '8px', borderRadius: 8, background: 'rgba(184, 134, 11, 0.1)', color: '#b8860b', border: '1px dashed rgba(184, 134, 11, 0.3)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                      >+ 加一档</button>
                      <button
                        type="button"
                        onClick={() => setCreating({ ...creating, discountTiers: [{ minSpend: 50, value: 10 }, { minSpend: 100, value: 20 }, { minSpend: 200, value: 40 }, { minSpend: 300, value: 60 }, { minSpend: 500, value: 100 }] })}
                        style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(184, 134, 11, 0.06)', color: 'rgba(184, 134, 11, 0.7)', border: '1px solid rgba(184, 134, 11, 0.2)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                      >⚡ 5 档模板</button>
                    </div>
                  </div>
                </Field>
              )}
              <Field label="开始时间（可选）">
                <input type="datetime-local" value={creating.startAt} onChange={(e) => setCreating({ ...creating, startAt: e.target.value })} style={inputStyle} />
              </Field>
              <Field label="结束时间（可选）">
                <input type="datetime-local" value={creating.endAt} onChange={(e) => setCreating({ ...creating, endAt: e.target.value })} style={inputStyle} />
              </Field>
              <Field label="封面图">
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input value={creating.coverImage} onChange={(e) => setCreating({ ...creating, coverImage: e.target.value })} style={inputStyle} placeholder="/uploads/activities/xxx.png 或 https://..." />
                  <ImageUploader onUploaded={(url) => setCreating({ ...creating, coverImage: url })} />
                  {/* ⭐ v2.1: 一键使用 AI demo 图（让封面立刻有图，后续可手动换）*/}
                  <button
                    type="button"
                    onClick={async () => {
                      if (generatingAI) return
                      setGeneratingAI(true)
                      try {
                        const res = await fetch('/api/ai/activity-image', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            title: creating.title || '活动',
                            subtitle: creating.subtitle || '',
                          }),
                        })
                        const data = await res.json()
                        if (data.success && data.url) {
                          setCreating({ ...creating, coverImage: data.url })
                          showToast(`✓ AI 图已生成（${data.source}）`, 'ok')
                        } else {
                          showToast(`❌ ${data.error || '生成失败'}`, 'err')
                        }
                      } catch (e: any) {
                        showToast(`❌ ${e.message || '网络错误'}`, 'err')
                      } finally {
                        setGeneratingAI(false)
                      }
                    }}
                    disabled={generatingAI}
                    title="AI 自动生成活动封面图（奕霖 2026-08-05 20:20）"
                    style={{ padding: '6px 12px', borderRadius: 8, background: generatingAI ? 'rgba(184, 134, 11, 0.04)' : 'rgba(184, 134, 11, 0.12)', color: generatingAI ? 'rgba(184, 134, 11, 0.5)' : '#b8860b', border: '1px solid rgba(184, 134, 11, 0.3)', fontSize: 11, fontWeight: 600, cursor: generatingAI ? 'wait' : 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
                  >
                    {generatingAI ? '⏳ 生成中...' : '🎨 AI 图'}
                  </button>
                </div>
                {creating.coverImage && <img src={creating.coverImage} alt="封面预览" style={{ marginTop: 6, maxHeight: 80, borderRadius: 6 }} />}
              </Field>
              {/* ⭐ v2.1: 商品选择器（之前 /admin/activities 完全没接商品）*/}
              <Field label="活动商品（可多选）">
                <ProductPicker
                  selectedIds={creating.productIds}
                  onChange={(ids) => setCreating({ ...creating, productIds: ids })}
                />
              </Field>
              <Field label="详细描述（支持 Markdown，可选）">
                <textarea value={creating.description} onChange={(e) => setCreating({ ...creating, description: e.target.value })} rows={4} style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 12 }} placeholder="活动详情描述，例：**满100减20**，需**遵医嘱**服用..." />
              </Field>
              <ComplianceChecker title={creating.title} subtitle={creating.subtitle} description={creating.description} onFix={(fix) => setCreating({ ...creating, ...fix })} />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255, 255, 255, 0.08)', justifyContent: 'flex-end', flexShrink: 0 }}>
                <button onClick={() => setShowCreate(false)} style={secondaryBtn}>取消</button>
                <button onClick={handleCreate} disabled={creating_} style={{ ...primaryBtn, opacity: creating_ ? 0.5 : 1 }}>
                  {creating_ ? '创建中…' : '创建'}
                </button>
              </div>
            </div>
          </div>
        )}

        {toast && (
          <div style={{ position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)', background: toast.type === 'ok' ? 'rgba(184, 134, 11, 0.95)' : 'rgba(239, 68, 68, 0.95)', color: toast.type === 'ok' ? '#0a3a1f' : '#fff', padding: '10px 20px', borderRadius: 10, fontWeight: 600, fontSize: 13, zIndex: 200 }}>{toast.msg}</div>
        )}
      </div>
    </AdminLayout>
  )
}

function EditModal({ activity, onClose, onSave, busy }: { activity: Activity; onClose: () => void; onSave: (patch: Partial<Activity>) => void; busy: boolean }) {
  const [title, setTitle] = useState(activity.title)
  const [subtitle, setSubtitle] = useState(activity.subtitle || '')
  const [status, setStatus] = useState(activity.status)
  const [type, setType] = useState(activity.type)
  const [description, setDescription] = useState((activity as any).description || '')
  const [coverImage, setCoverImage] = useState((activity as any).coverImage || '')
  // v3.0 — 时间编辑
  const toLocalInput = (s?: string) => {
    if (!s) return ''
    try {
      const d = new Date(s)
      const pad = (n: number) => String(n).padStart(2, '0')
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
    } catch { return '' }
  }
  const [startAt, setStartAt] = useState(toLocalInput(activity.startAt))
  const [endAt, setEndAt] = useState(toLocalInput(activity.endAt))
  // v3.0 — 满减规则编辑
  const [discountTiers, setDiscountTiers] = useState<{ minSpend: string; value: string }[]>(() => {
    try {
      const r = (activity as any).rules
      const obj = typeof r === 'string' ? JSON.parse(r) : r
      if (Array.isArray(obj)) return obj.map((t: any) => ({ minSpend: String(t.minSpend ?? ''), value: String(t.value ?? '') }))
      if (obj && typeof obj === 'object') {
        return Object.entries(obj).map(([k, v]) => {
          const m = k.match(/满(\d+(?:\.\d+)?)减(\d+(?:\.\d+)?)/)
          if (m) return { minSpend: m[1], value: m[2] }
          return { minSpend: '', value: String(v) }
        })
      }
    } catch {}
    return []
  })
  // ⭐ v2.1（奕霖 2026-07-18）：接 productIds（之前 EditModal 完全不管它）
  const [productIds, setProductIds] = useState<string[]>(() => {
    const v = (activity as any).productIds
    if (Array.isArray(v)) return v
    if (typeof v === 'string') { try { return JSON.parse(v) } catch { return [] } }
    return []
  })

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'rgba(15, 22, 18, 0.95)', border: '1px solid rgba(184, 134, 11, 0.2)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 480, maxHeight: '85vh', display: 'flex', flexDirection: 'column', fontFamily: '-apple-system, "PingFang SC", sans-serif', color: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20, flexShrink: 0 }}>
          <span style={{ fontSize: 22 }}>✏</span>
          <h2 style={{ margin: '0 0 0 12px', fontSize: 16, fontWeight: 700 }}>编辑活动</h2>
          <button onClick={onClose} style={{ marginLeft: 'auto', width: 28, height: 28, borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 14 }}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4, minHeight: 0 }}>

        <Field label="活动标题">
          <input value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="副标题">
          <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} style={inputStyle} placeholder="一句话说明" />
        </Field>
        <Field label="类型">
          <select value={type} onChange={(e) => setType(e.target.value)} style={inputStyle}>
            <option value="promotion">🎁 满减促销</option>
            <option value="flash_sale">⚡ 限时秒杀</option>
            <option value="banner">📣 广告横幅</option>
            <option value="new_arrival">🆕 新品上市</option>
            <option value="points_double">💎 积分翻倍</option>
            <option value="discount">💰 直接打折</option>
          </select>
        </Field>
        <Field label="状态">
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={inputStyle}>
            <option value="draft">📝 草稿</option>
            <option value="published">✓ 发布（进行中）</option>
            <option value="ended">⏹ 已结束</option>
            <option value="cancelled">✕ 取消</option>
          </select>
        </Field>

        <Field label="封面图">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input value={coverImage} onChange={(e) => setCoverImage(e.target.value)} style={inputStyle} placeholder="/uploads/activities/xxx.png 或 https://..." />
            <ImageUploader onUploaded={(url) => setCoverImage(url)} />
            <button
              type="button"
              onClick={() => setCoverImage('/ai-covers/activity-cover-demo.png')}
              title="使用 AI 生成的示例图占位"
              style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(184, 134, 11, 0.12)', color: '#b8860b', border: '1px solid rgba(184, 134, 11, 0.3)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
            >
              🎨 AI 图
            </button>
          </div>
          {coverImage && <img src={coverImage} alt="封面预览" style={{ marginTop: 6, maxHeight: 80, borderRadius: 6 }} />}
        </Field>
        {/* v3.0 — 时间编辑 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <Field label="开始时间">
            <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="结束时间">
            <input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} style={inputStyle} />
          </Field>
        </div>

        {/* v3.0 — 满减规则编辑 */}
        <Field label="满减规则（多档叠加）">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {discountTiers.map((t, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: '#9ca3af', whiteSpace: 'nowrap' }}>满</span>
                <input type="number" min="0" step="0.01" value={t.minSpend} placeholder="100"
                  onChange={(e) => setDiscountTiers(discountTiers.map((x, j) => j === i ? { ...x, minSpend: e.target.value } : x))}
                  style={{ ...inputStyle, flex: 1 }} />
                <span style={{ fontSize: 12, color: '#9ca3af', whiteSpace: 'nowrap' }}>减</span>
                <input type="number" min="0" step="0.01" value={t.value} placeholder="20"
                  onChange={(e) => setDiscountTiers(discountTiers.map((x, j) => j === i ? { ...x, value: e.target.value } : x))}
                  style={{ ...inputStyle, flex: 1 }} />
                <button type="button" onClick={() => setDiscountTiers(discountTiers.filter((_, j) => j !== i))}
                  style={{ padding: '6px 10px', borderRadius: 6, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>
              </div>
            ))}
            <button type="button" onClick={() => setDiscountTiers([...discountTiers, { minSpend: '', value: '' }])}
              style={{ padding: '8px 12px', borderRadius: 6, background: 'rgba(184, 134, 11, 0.12)', border: '1px solid rgba(184, 134, 11, 0.3)', color: '#b8860b', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              ➕ 添加一档
            </button>
            {discountTiers.length > 0 && (
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                预览: {discountTiers.filter(t => t.minSpend && t.value).map(t => `满¥${t.minSpend}减¥${t.value}`).join(' · ') || '(填写中)'}
              </div>
            )}
          </div>
        </Field>

        {/* ⭐ v2.1: 编辑活动也能选商品 */}
        <Field label="活动商品（可多选）">
          <ProductPicker
            selectedIds={productIds}
            onChange={setProductIds}
          />
        </Field>

        <Field label="详细描述（Markdown，可选）">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 12 }} placeholder="** 活动详情**\n- 满100减20\n- 需遵医嘱" />
        </Field>

        <ComplianceChecker title={title} subtitle={subtitle} description={description} onFix={(fix) => {
          if (fix.title !== undefined) setTitle(fix.title)
          if (fix.subtitle !== undefined) setSubtitle(fix.subtitle)
          if (fix.description !== undefined) setDescription(fix.description)
        }} />
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255, 255, 255, 0.08)', justifyContent: 'flex-end', flexShrink: 0 }}>
          <button onClick={onClose} style={secondaryBtn}>取消</button>
          <button
            onClick={() => onSave({
              title, subtitle, status, type, description, coverImage, productIds,
              startAt: startAt ? new Date(startAt).toISOString() : undefined,
              endAt: endAt ? new Date(endAt).toISOString() : undefined,
              rules: discountTiers.filter(t => t.minSpend && t.value).length > 0
                ? discountTiers.filter(t => t.minSpend && t.value)
                : undefined,
            } as any)}
            disabled={busy}
            style={{ ...primaryBtn, opacity: busy ? 0.5 : 1, cursor: busy ? 'wait' : 'pointer' }}
          >{busy ? '保存中…' : '保存'}</button>
        </div>
      </div>
    </div>
  )
}

/**
 * ⭐ v2.1（奕霖 2026-07-18）：商品选择器（之前 /admin/activities 完全没接商品选择）
 * - 顶部 chips：已选商品（× 取消）
 * - 搜索框：debounce 300ms 调 /api/products?q=&inStock=1
 * - 列表项：点一下 toggle（加入 / 移除）
 */
function ProductPicker({ selectedIds, onChange }: { selectedIds: string[]; onChange: (ids: string[]) => void }) {
  const [searchQ, setSearchQ] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [info, setInfo] = useState<Record<string, { name: string; price: number }>>({})
  const debounceRef = useRef<any>(null)

  // 加载已选商品名称（用于 chip 显示）
  useEffect(() => {
    const missing = selectedIds.filter((id) => !info[id])
    if (missing.length === 0) return
    let cancelled = false
    ;(async () => {
      const newInfo: typeof info = {}
      for (const id of missing) {
        try {
          const r = await fetch(`/api/products/${id}`, { credentials: 'include' })
          const j = await r.json()
          if (j.success && j.product) {
            newInfo[id] = { name: String(j.product.name || id), price: Number(j.product.price) || 0 }
          }
        } catch {}
        newInfo[id] = newInfo[id] || { name: id.slice(-8), price: 0 }
      }
      if (!cancelled) setInfo((s) => ({ ...s, ...newInfo }))
    })()
    return () => { cancelled = true }
  }, [selectedIds.join(',')])

  // 搜索 debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!searchQ.trim()) { setSearchResults([]); return }
    setSearching(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/products?q=${encodeURIComponent(searchQ)}&inStock=1&limit=10`, { credentials: 'include' })
        const j = await r.json()
        if (j.success) {
          setSearchResults((j.products || []).map((p: any) => ({
            id: p.id, name: p.name, shortName: p.shortName,
            price: Number(p.price) || 0, stock: Number(p.stock) || 0,
            categoryLabel: p.categoryLabel,
          })))
        }
      } finally { setSearching(false) }
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [searchQ])

  function toggle(id: string) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id])
    setInfo((s) => s[id] ? s : { ...s, [id]: { name: id.slice(-8), price: 0 } })
  }

  return (
    <div>
      {selectedIds.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {selectedIds.map((id) => (
            <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: 'rgba(184, 134, 11, 0.15)', border: '1px solid rgba(184, 134, 11, 0.3)', borderRadius: 6, fontSize: 11, color: '#b8860b' }}>
              💊 {info[id]?.name || id.slice(-10)}
              <span style={{ fontSize: 10, opacity: 0.7 }}>¥{(info[id]?.price || 0).toFixed(2)}</span>
              <button type="button" onClick={() => toggle(id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0, marginLeft: 2, fontSize: 14, lineHeight: 1, fontFamily: 'inherit' }} title="移除">×</button>
            </span>
          ))}
        </div>
      )}
      <input
        value={searchQ}
        onChange={(e) => setSearchQ(e.target.value)}
        placeholder="🔍 搜索商品名（例：感冒、氨咖、板蓝根）添加..."
        style={{ width: '100%', padding: '8px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 12, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
      />
      {searching && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', padding: '6px 4px' }}>搜索中…</div>}
      {!searching && searchQ && searchResults.length === 0 && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', padding: '6px 4px' }}>没有匹配商品，试试别的关键词</div>}
      {searchResults.length > 0 && (
        <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, padding: 4, marginTop: 4 }}>
          {searchResults.map((p) => {
            const isOn = selectedIds.includes(p.id)
            return (
              <button
                type="button"
                key={p.id}
                onClick={() => toggle(p.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px', background: isOn ? 'rgba(184, 134, 11, 0.18)' : 'rgba(255,255,255,0.04)', border: isOn ? '1px solid rgba(184, 134, 11, 0.4)' : '1px solid transparent', borderRadius: 6, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
              >
                <span style={{ flex: 1, fontSize: 12, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>{p.categoryLabel}</span>
                <span style={{ fontSize: 11, color: '#b8860b', fontWeight: 600 }}>¥{p.price.toFixed(2)}</span>
                <span style={{ fontSize: 14, color: isOn ? '#b8860b' : 'rgba(255,255,255,0.3)', fontWeight: 700 }}>{isOn ? '✓' : '+'}</span>
              </button>
            )
          })}
        </div>
      )}
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 6 }}>已选 {selectedIds.length} 件商品 · 搜索结果 {searchResults.length} 件</div>
    </div>
  )
}

function ImageUploader({ onUploaded }: { onUploaded: (url: string) => void }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('file', f)
      const r = await fetch('/api/admin/activities/upload', { method: 'POST', credentials: 'include', body: fd })
      const d = await r.json()
      if (d.success) {
        onUploaded(d.url)
        toast.toast('✅ 图片上传成功', 'ok')
      } else {
        toast.toast('上传失败：' + d.error, 'err')
      }
    } catch (e: any) { toast.toast(e.message, 'err') } finally { setBusy(false) }
  }
  return (
    <label style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(167, 139, 250, 0.15)', color: '#a78bfa', border: '1px solid rgba(167, 139, 250, 0.3)', fontSize: 11, fontWeight: 600, cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center' }}>
      <input type="file" accept="image/*" onChange={onChange} disabled={busy} style={{ display: 'none' }} />
      {busy ? '⏳ 上传中' : '📤 上传'}
    </label>
  )
}

function ComplianceChecker({ title, subtitle, description, onFix }: { title: string; subtitle: string; description: string; onFix: (fix: { title?: string; subtitle?: string; description?: string }) => void }) {
  const toast = useToast()
  const [result, setResult] = useState<{ score: number; passed: boolean; issues: { level: string; text: string; suggestion: string }[] } | null>(null)
  const [busy, setBusy] = useState(false)

  const run = async () => {
    setBusy(true)
    try {
      const r = await fetch('/api/admin/activities/compliance-check', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, subtitle, description }),
      })
      const d = await r.json()
      if (d.success) {
        setResult(d)
        toast.toast(d.passed ? '✅ 合规检查通过' : `⚠️ 发现 ${d.issues?.length || 0} 个问题`, d.passed ? 'ok' : 'err')
      }
    } catch (e: any) { toast.toast(e.message, 'err') } finally { setBusy(false) }
  }

  return (
    <div style={{ marginBottom: 14 }}>
      <button onClick={run} disabled={busy} style={{ padding: '8px 14px', borderRadius: 8, background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)', fontSize: 12, fontWeight: 600, cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
        {busy ? '扫描中…' : '🛡 AI 合规扫描'}
      </button>
      {result && (
        <div style={{ marginTop: 10, padding: 12, borderRadius: 8, background: result.passed ? 'rgba(184, 134, 11, 0.08)' : 'rgba(239, 68, 68, 0.08)', border: `1px solid ${result.passed ? 'rgba(184, 134, 11, 0.3)' : 'rgba(239, 68, 68, 0.3)'}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: result.passed ? '#b8860b' : '#ef4444' }}>
              {result.passed ? '✅ 通过' : '❌ 不通过'} · {result.issues.filter((i) => i.level === 'critical').length} 严重 / {result.issues.filter((i) => i.level === 'warning').length} 警告 / {result.issues.filter((i) => i.level === 'info').length} 提示
            </span>
            <span style={{ fontSize: 18, fontWeight: 800, color: result.score >= 80 ? '#b8860b' : result.score >= 50 ? '#f59e0b' : '#ef4444' }}>{result.score}/100</span>
          </div>
          {result.issues.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {result.issues.map((iss, i) => (
                <div key={i} style={{ fontSize: 11, padding: '6px 10px', borderRadius: 6, background: iss.level === 'critical' ? 'rgba(239, 68, 68, 0.12)' : iss.level === 'warning' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(184, 134, 11, 0.12)', color: iss.level === 'critical' ? '#ef4444' : iss.level === 'warning' ? '#f59e0b' : '#b8860b', borderLeft: `3px solid ${iss.level === 'critical' ? '#ef4444' : iss.level === 'warning' ? '#f59e0b' : '#b8860b'}` }}>
                  <strong>{iss.level === 'critical' ? '严重' : iss.level === 'warning' ? '警告' : '提示'}:</strong> {iss.text}
                  <div style={{ color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>💡 {iss.suggestion}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: 'rgba(184, 134, 11, 0.8)' }}>✨ 完美！未检测到合规问题</div>
          )}
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 6, fontWeight: 600 }}>{label}</div>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
  color: '#fff', fontSize: 13, fontFamily: 'inherit', outline: 'none',
}
const primaryBtn: React.CSSProperties = { padding: '8px 20px', borderRadius: 8, background: 'rgba(184, 134, 11, 0.18)', color: '#b8860b', border: '1px solid rgba(184, 134, 11, 0.3)', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }
const secondaryBtn: React.CSSProperties = { padding: '8px 20px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }
function Center({ children }: { children: React.ReactNode }) {
  return <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.4)' }}>{children}</div>
}
