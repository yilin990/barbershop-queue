// v0.8.68.3 - 顾客管理(合并原 members + users + feedbacks)
'use client'
import { useState, useEffect, useCallback } from 'react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { Card, SummaryCard } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { EmptyState, Loading } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { colors, fontSize, fontWeight, radius, spacing } from '@/lib/design-tokens'
import { Users, MessageSquare, Star, Phone, TrendingUp } from 'lucide-react'

type Tab = 'members' | 'users' | 'feedbacks'

export default function CustomersPage() {
  const [tab, setTab] = useState<Tab>('members')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<any>(null)
  const toast = useToast()
  // ⭐ P3 2026-09-06 — 顾客画像入口
  const [profilePhone, setProfilePhone] = useState<string | null>(null)
  // ⭐ P3 2026-09-06 — 导出
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    setExporting(true)
    try {
      const r = await fetch('/api/admin/customers/export', { credentials: 'include' })
      if (!r.ok) { const j = await r.json().catch(()=>({})); toast.toast(`导出失败: ${j.error||r.statusText}`, 'err'); return }
      const blob = await r.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `顾客名单_${new Date().toISOString().slice(0, 10)}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      toast.toast('✅ 已导出', 'ok')
    } catch (e: any) { toast.toast(e.message, 'err') }
    finally { setExporting(false) }
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // 并行拉 3 个 API
      const [m, f] = await Promise.all([
        fetch('/api/admin/members').then(r => r.json()).catch(() => ({ success: false })),
        fetch('/api/admin/feedbacks-list').then(r => r.json()).catch(() => ({ success: false })),
      ])
      setData({ members: m, feedbacks: f })
    } catch (e: any) {
      toast.toast(e.message, 'err')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: 'members', label: '会员', icon: Users },
    { key: 'users', label: '用户', icon: Phone },
    { key: 'feedbacks', label: '反馈', icon: MessageSquare },
  ]

  return (
    <AdminLayout title="顾客管理" active="customers">
      <div style={{ marginBottom: spacing[5] }}>
        <div style={{ fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text, marginBottom: spacing[3] }}>
          👥 顾客管理
        </div>
        <div style={{ fontSize: fontSize.sm, color: colors.textMuted }}>
          统一管理会员 + 用户 + 反馈(原 3 个独立页合并)
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          style={{ marginTop: 12, padding: '8px 16px', borderRadius: 8, background: 'linear-gradient(135deg, #b8860b, #4ade80)', color: '#0a0f0d', fontSize: 13, fontWeight: 700, border: 'none', cursor: exporting ? 'wait' : 'pointer', opacity: exporting ? 0.6 : 1 }}
        >
          {exporting ? '导出中…' : '📥 导出名单'}
        </button>
      </div>

      {/* Tab 切换 */}
      <div style={{ display: 'flex', gap: spacing[2], marginBottom: spacing[5], borderBottom: `1px solid ${colors.borderMuted}` }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            aria-pressed={tab === t.key}
            style={{
              padding: '12px 20px',
              background: 'transparent',
              border: 'none',
              borderBottom: tab === t.key ? `2px solid ${colors.primary}` : '2px solid transparent',
              color: tab === t.key ? colors.primary : colors.textMuted,
              fontSize: fontSize.sm,
              fontWeight: tab === t.key ? fontWeight.semibold : fontWeight.medium,
              cursor: 'pointer',
              fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: spacing[2],
            }}
          >
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </div>

      {loading ? <Loading /> : (
        <>
          {tab === 'members' && <MembersTab data={data?.members} onShowProfile={setProfilePhone} />}
          {tab === 'users' && <UsersTab data={data?.members} />}
          {tab === 'feedbacks' && <FeedbacksTab data={data?.feedbacks} />}
        </>
      )}

      {profilePhone && (
        <CustomerProfileModal
          phone={profilePhone}
          onClose={() => setProfilePhone(null)}
          onToast={(text, kind) => toast.toast(text, kind)}
        />
      )}
    </AdminLayout>
  )
}

function MembersTab({ data, onShowProfile }: { data: any; onShowProfile: (phone: string) => void }) {
  const members = data?.members || []
  const total = members.length
  const vip = members.filter((m: any) => m.level === 'vip' || m.level === 'gold').length
  const active30d = members.filter((m: any) => {
    if (!m.lastLoginAt) return false
    const days = (Date.now() - new Date(m.lastLoginAt).getTime()) / 86400000
    return days <= 30
  }).length

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: spacing[4], marginBottom: spacing[5] }}>
        <SummaryCard label="总会员" value={total} icon={<Users />} />
        <SummaryCard label="VIP/金卡" value={vip} icon={<Star />} />
        <SummaryCard label="30 天活跃" value={active30d} icon={<TrendingUp />} />
      </div>
      <Card title="会员列表">
        {members.length === 0 ? <EmptyState icon={<Users />} title="还没有会员" /> : (
          <div style={{ overflow: 'auto' }}>
            <table style={{ width: '100%', fontSize: fontSize.sm, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${colors.borderMuted}` }}>
                  <th style={{ textAlign: 'left', padding: spacing[3], color: colors.textMuted }}>手机</th>
                  <th style={{ textAlign: 'left', padding: spacing[3], color: colors.textMuted }}>昵称</th>
                  <th style={{ textAlign: 'left', padding: spacing[3], color: colors.textMuted }}>等级</th>
                  <th style={{ textAlign: 'right', padding: spacing[3], color: colors.textMuted }}>积分</th>
                </tr>
              </thead>
              <tbody>
                {members.slice(0, 50).map((m: any) => (
                  <tr key={m.id}
                    onClick={() => onShowProfile(m.phone)}
                    style={{ borderBottom: `1px solid ${colors.borderMuted}`, cursor: 'pointer', transition: 'background 0.15s' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(184, 134, 11,0.06)' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                    title="点击查看画像">
                    <td style={{ padding: spacing[3], color: colors.text }}>{m.phone}</td>
                    <td style={{ padding: spacing[3], color: colors.textMuted }}>{m.nickname || '-'}</td>
                    <td style={{ padding: spacing[3] }}>
                      <span style={{ padding: '4px 10px', borderRadius: radius.full, fontSize: fontSize.xs, background: colors.primaryBgLight, color: colors.primary }}>
                        {m.level || '普通'}
                      </span>
                    </td>
                    <td style={{ padding: spacing[3], textAlign: 'right', color: colors.text }}>{m.points || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  )
}

function UsersTab({ data }: { data: any }) {
  return (
    <Card title="用户列表">
      <EmptyState
        icon={<Phone />}
        title="用户视图"
        description="用户是注册过手机号的所有人(含未成为会员的)。原 users 页面已并入会员 Tab。"
      />
    </Card>
  )
}

function FeedbacksTab({ data }: { data: any }) {
  const items = data?.items || []
  return (
    <Card title={`反馈 (${items.length})`}>
      {items.length === 0 ? <EmptyState icon={<MessageSquare />} title="暂无反馈" /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[3] }}>
          {items.slice(0, 20).map((f: any) => (
            <div key={f.id} style={{ padding: spacing[4], borderRadius: radius.lg, background: colors.bgHover, border: `1px solid ${colors.borderMuted}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing[2] }}>
                <span style={{ fontSize: fontSize.sm, color: colors.text, fontWeight: fontWeight.semibold }}>{f.userName || f.phone || '匿名'}</span>
                <span style={{ fontSize: fontSize.xs, color: colors.textMuted }}>{f.relative || f.time}</span>
              </div>
              <div style={{ fontSize: fontSize.sm, color: colors.textMuted, lineHeight: 1.6 }}>{f.content}</div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}


// ⭐ P3 2026-09-06 — 顾客画像 Modal(API 已存在但 UI 没接,Phase 3 接入)
function CustomerProfileModal({ phone, onClose, onToast }: { phone: string; onClose: () => void; onToast: (text: string, kind: 'ok'|'err') => void }) {
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [adjust, setAdjust] = useState({ delta: '', reason: '' })
  const [adjusting, setAdjusting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/admin/customers/${phone}/profile`, { credentials: 'include' })
      const d = await r.json()
      if (d.success) setProfile(d.profile)
      else onToast(d.error || '加载失败', 'err')
    } catch (e: any) { onToast(e.message, 'err') }
    finally { setLoading(false) }
  }, [phone])

  useEffect(() => { load() }, [load])

  async function doAdjust() {
    const delta = Number(adjust.delta)
    if (!Number.isInteger(delta) || delta === 0) { onToast('积分变动必须是非 0 整数', 'err'); return }
    if (!adjust.reason.trim()) { onToast('请填写原因', 'err'); return }
    setAdjusting(true)
    try {
      const r = await fetch('/api/admin/points-adjust', {
        method: 'POST', credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone, delta, reason: adjust.reason }),
      })
      const d = await r.json()
      if (d.success) {
        onToast(`✅ 已${delta > 0 ? '送' : '扣'} ${Math.abs(delta)} 分,余额 ${d.balance}`, 'ok')
        setAdjust({ delta: '', reason: '' })
        load()
      } else {
        onToast(d.error || '失败', 'err')
      }
    } finally { setAdjusting(false) }
  }

  return (
    <div role="dialog" onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#0a0f0d', border: `1px solid ${colors.primary}`, borderRadius: 16, padding: 24, width: '100%', maxWidth: 640, maxHeight: '90vh', overflow: 'auto', color: colors.text }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: fontSize.lg, color: colors.text }}>👤 顾客画像</h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: colors.textMuted, fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: colors.textMuted }}>加载中…</div>
        ) : !profile ? (
          <div style={{ textAlign: 'center', padding: 40, color: colors.textMuted }}>暂无画像数据</div>
        ) : (
          <>
            {/* 基础信息 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, padding: 16, background: 'rgba(184, 134, 11,0.05)', borderRadius: 10, marginBottom: 16, border: `1px solid rgba(184, 134, 11,0.2)` }}>
              <InfoField label="手机号" value={profile.phone} mono />
              <InfoField label="昵称" value={profile.nickname || '未设置'} />
              <InfoField label="等级" value={profile.tier} highlight />
              <InfoField label="积分" value={`${profile.points} 分`} highlight />
              <InfoField label="累计消费" value={`¥${profile.totalSpentAll?.toFixed(2)}`} />
              <InfoField label="订单数" value={`${profile.totalOrders} 单`} />
              <InfoField label="平均客单" value={`¥${profile.avgOrder?.toFixed(2)}`} />
              <InfoField label="取消率" value={`${profile.cancelledRate}%`} />
            </div>

            {/* 画像标签 */}
            {profile.tags?.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: fontSize.xs, color: colors.textSubtle, marginBottom: 8, fontWeight: fontWeight.semibold }}>🏷️ 画像标签</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {profile.tags.map((t: any, i: number) => (
                    <span key={i} style={{ padding: '6px 12px', borderRadius: radius.full, fontSize: fontSize.sm, fontWeight: fontWeight.semibold, background: `${t.color}22`, color: t.color, border: `1px solid ${t.color}44` }}>
                      {t.emoji} {t.text}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 品类偏好 + 时段偏好 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 16 }}>
              {profile.categoryPreference?.length > 0 && (
                <div>
                  <div style={{ fontSize: fontSize.xs, color: colors.textSubtle, marginBottom: 8, fontWeight: fontWeight.semibold }}>🛒 品类偏好</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {profile.categoryPreference.slice(0, 5).map((c: any) => (
                      <div key={c.category} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: fontSize.xs, color: colors.text, minWidth: 60 }}>{c.category}</span>
                        <div style={{ flex: 1, height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(100, c.percent)}%`, height: '100%', background: 'linear-gradient(90deg, #b8860b, #4ade80)', transition: 'width 0.3s' }} />
                        </div>
                        <span style={{ fontSize: fontSize.xs, color: colors.textMuted, minWidth: 40, textAlign: 'right' }}>{c.percent}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {profile.timePreference?.length > 0 && (
                <div>
                  <div style={{ fontSize: fontSize.xs, color: colors.textSubtle, marginBottom: 8, fontWeight: fontWeight.semibold }}>⏰ 时段偏好</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {profile.timePreference.map((t: any) => (
                      <div key={t.period} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: fontSize.xs, color: colors.text, minWidth: 60 }}>{t.label}</span>
                        <div style={{ flex: 1, height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(100, t.percent)}%`, height: '100%', background: 'linear-gradient(90deg, #b8860b, #f59e0b)' }} />
                        </div>
                        <span style={{ fontSize: fontSize.xs, color: colors.textMuted, minWidth: 40, textAlign: 'right' }}>{t.percent}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 最近订单 */}
            {profile.recentOrders?.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: fontSize.xs, color: colors.textSubtle, marginBottom: 8, fontWeight: fontWeight.semibold }}>📦 最近 {profile.recentOrders.length} 单</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {profile.recentOrders.map((o: any) => (
                    <div key={o.orderNo} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, fontSize: fontSize.xs }}>
                      <span style={{ color: colors.textMuted, fontFamily: 'monospace' }}>{o.orderNo?.slice(-10)}</span>
                      <span style={{ color: colors.text }}>{o.itemCount} 件</span>
                      <span style={{ color: colors.primary, fontWeight: fontWeight.semibold }}>¥{o.finalAmount?.toFixed(2)}</span>
                      <span style={{ color: colors.textSubtle, fontSize: 10 }}>{o.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ⭐ P3 手动调整积分 */}
            <div style={{ padding: 16, background: 'linear-gradient(135deg, rgba(184, 134, 11,0.08), rgba(184, 134, 11,0.02))', borderRadius: 10, border: `1px solid rgba(184, 134, 11,0.3)` }}>
              <div style={{ fontSize: fontSize.xs, color: colors.primary, marginBottom: 12, fontWeight: fontWeight.bold, display: 'flex', alignItems: 'center', gap: 6 }}>
                ⚡ 手动调整积分(当前 {profile.points} 分)
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input
                  type="number"
                  placeholder="+ 送分 / - 扣分"
                  value={adjust.delta}
                  onChange={(e) => setAdjust({ ...adjust, delta: e.target.value })}
                  style={{ flex: 1, minWidth: 100, padding: '10px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: `1px solid ${colors.borderMuted}`, color: colors.text, fontSize: fontSize.sm, outline: 'none', boxSizing: 'border-box' }}
                />
                <input
                  type="text"
                  placeholder="原因(必填,如:补偿/补发)"
                  value={adjust.reason}
                  onChange={(e) => setAdjust({ ...adjust, reason: e.target.value })}
                  style={{ flex: 2, minWidth: 160, padding: '10px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: `1px solid ${colors.borderMuted}`, color: colors.text, fontSize: fontSize.sm, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <button
                onClick={doAdjust}
                disabled={adjusting || !adjust.delta || !adjust.reason.trim()}
                style={{ width: '100%', padding: '10px 16px', borderRadius: 8, background: adjusting ? 'rgba(184, 134, 11,0.3)' : colors.primary, color: '#0a0f0d', fontWeight: fontWeight.bold, border: 'none', cursor: adjusting ? 'wait' : 'pointer', fontSize: fontSize.sm, opacity: (!adjust.delta || !adjust.reason.trim()) ? 0.5 : 1 }}
              >
                {adjusting ? '提交中…' : '⚡ 确认调整'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function InfoField({ label, value, highlight, mono }: { label: string; value: any; highlight?: boolean; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: colors.textSubtle, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: fontSize.sm, color: highlight ? colors.primary : colors.text, fontWeight: highlight ? fontWeight.bold : fontWeight.normal, fontFamily: mono ? 'monospace' : 'inherit' }}>{value}</div>
    </div>
  )
}
