'use client'

import { useEffect, useState, useCallback } from 'react'
import { useToast } from '@/components/ui/Toast'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { Button } from '@/components/ui/Button'
import { Card, SummaryCard } from '@/components/ui/Card'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { EmptyState, ErrorState, Loading } from '@/components/ui/States'
import { ResponsiveTable, type Column } from '@/components/ui/ResponsiveTable'
import { colors, fontSize, fontWeight, radius, spacing } from '@/lib/design-tokens'
import {
  Users, Search, RefreshCw, Eye, Coins, Wallet, Edit, Ban, CheckCircle2,
  TrendingUp, ShoppingCart, Trophy, Tag, UserCheck, X,
} from 'lucide-react'

interface Member {
  id: string
  phone: string
  nickname: string
  totalSpent: number
  totalOrders: number
  points: number
  level: '普通' | '银卡' | '金卡' | 'VIP'
  status: 'active' | 'deactivated'
  lastOrderAt: string | null
}

interface MemberProfile {
  customer: { id: string; phone: string; nickname: string; totalSpent: number; totalOrders: number; points: number; status: string }
  profile: {
    rfm: { R: string; F: string; M: string; daysSinceLast: number; orderCount: number; totalSpent: number }
    clv: number
    avgOrderAmount: number
    avgProductPrice: number
    priceSensitivity: string
    topCategories: { name: string; count: number; share: string }[]
    hourlyHistogram: number[]
    monthlyTrend: { month: string; count: number; amount: number }[]
    behaviorTags: string[]
    recentOrders: any[]
  }
}

type OpKind = 'points' | 'spent' | 'rename' | 'status' | null

export default function MembersPage() {
  const toast = useToast()
  const [list, setList] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [levelFilter, setLevelFilter] = useState<'all' | 'VIP' | '金卡' | '银卡' | '普通'>('all')
  const [q, setQ] = useState('')
  const [profile, setProfile] = useState<MemberProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [op, setOp] = useState<{ kind: OpKind; member: Member } | null>(null)
  const [delta, setDelta] = useState('')
  const [nickname, setNickname] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmToggle, setConfirmToggle] = useState<Member | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await fetch('/api/admin/members', { credentials: 'include' })
      const d = await r.json()
      if (d.success) setList(d.members || [])
      else setError(d.error || '加载失败')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = list.filter((m) => {
    if (levelFilter !== 'all' && m.level !== levelFilter) return false
    if (q) {
      const t = q.toLowerCase()
      return m.nickname?.toLowerCase().includes(t) || m.phone.includes(q)
    }
    return true
  })

  const openProfile = async (m: Member) => {
    setProfileLoading(true)
    setProfile(null)
    try {
      const r = await fetch(`/api/admin/members/${m.id}/profile`, { credentials: 'include' })
      const d = await r.json()
      if (d.success) setProfile(d)
      else toast.toast(d.error || '加载画像失败', 'err')
    } catch (e: any) {
      toast.toast(e.message, 'err')
    } finally {
      setProfileLoading(false)
    }
  }

  const submitOp = async () => {
    if (!op) return
    setBusy(true)
    try {
      let body: any = { action: op.kind }
      if (op.kind === 'points' || op.kind === 'spent') {
        const n = Number(delta)
        if (!Number.isFinite(n) || n === 0) { toast.toast('请输入非零数字', 'err'); setBusy(false); return }
        body.delta = n
      } else if (op.kind === 'rename') {
        if (!nickname.trim()) { toast.toast('请输入新昵称', 'err'); setBusy(false); return }
        body.nickname = nickname.trim()
      } else if (op.kind === 'status') {
        body.status = op.member.status === 'deactivated' ? 'active' : 'deactivated'
      }
      const r = await fetch(`/api/admin/members/${op.member.id}`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const result = await r.json()
      if (r.status === 401) toast.toast('登录已过期', 'err')
      else if (result.success) {
        toast.toast(`✅ ${result.desc}`, 'ok')
        setOp(null); setDelta(''); setNickname('')
        load()
      } else {
        toast.toast(result.error || '失败', 'err')
      }
    } catch (e: any) {
      toast.toast(e.message, 'err')
    } finally {
      setBusy(false)
    }
  }

  const levelColor = (lv: string) => {
    if (lv === 'VIP') return { bg: colors.purpleBg, color: colors.purple }
    if (lv === '金卡') return { bg: colors.amberBg, color: colors.amber }
    if (lv === '银卡') return { bg: colors.grayBg, color: colors.gray }
    return { bg: colors.bgHover, color: colors.textSubtle }
  }

  const totalSpent = list.reduce((s, m) => s + m.totalSpent, 0)
  const totalOrders = list.reduce((s, m) => s + m.totalOrders, 0)
  const totalPoints = list.reduce((s, m) => s + m.points, 0)
  const blockedCount = list.filter((m) => m.status === 'deactivated').length

  const columns: Column<Member>[] = [
    {
      key: 'user',
      title: '会员',
      render: (m) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #b8860b, #34c87b)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: fontWeight.bold, color: colors.primaryDeep, flexShrink: 0 }}>
            {(m.nickname || m.phone || '?')[0]}
          </div>
          <span style={{ fontWeight: fontWeight.semibold, fontSize: fontSize.base }}>{m.nickname || '未命名'}</span>
        </div>
      ),
    },
    {
      key: 'phone',
      title: '手机',
      hideOnMobile: true,
      render: (m) => <span style={{ fontFamily: 'monospace', fontSize: fontSize.xs, color: colors.textSubtle }}>{m.phone.slice(0, 3)}****{m.phone.slice(-4)}</span>,
    },
    {
      key: 'totalSpent',
      title: '总消费',
      align: 'right',
      render: (m) => <span style={{ fontWeight: fontWeight.bold, color: colors.primary }}>¥{m.totalSpent}</span>,
    },
    {
      key: 'totalOrders',
      title: '订单',
      align: 'right',
      hideOnMobile: true,
      render: (m) => m.totalOrders,
    },
    {
      key: 'points',
      title: '积分',
      align: 'right',
      hideOnMobile: true,
      render: (m) => m.points,
    },
    {
      key: 'level',
      title: '等级',
      render: (m) => {
        const lc = levelColor(m.level)
        return <span style={{ padding: '3px 10px', borderRadius: radius.sm, background: lc.bg, color: lc.color, fontSize: fontSize.xs, fontWeight: fontWeight.bold }}>{m.level}</span>
      },
    },
    {
      key: 'status',
      title: '状态',
      hideOnMobile: true,
      render: (m) => m.status === 'deactivated'
        ? <span style={{ padding: '2px 8px', borderRadius: radius.sm, background: colors.dangerBg, color: colors.danger, fontSize: 10, fontWeight: fontWeight.bold }}>已屏蔽</span>
        : <span style={{ padding: '2px 8px', borderRadius: radius.sm, background: colors.primaryBgSubtle, color: colors.primary, fontSize: 10, fontWeight: fontWeight.bold }}>活跃</span>,
    },
    {
      key: 'actions',
      title: '操作',
      align: 'right',
      render: (m) => (
        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="success" onClick={() => openProfile(m)}>
            <Eye size={12} /> 画像
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setOp({ kind: 'points', member: m })}>
            <Coins size={12} />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setOp({ kind: 'spent', member: m })}>
            <Wallet size={12} />
          </Button>
          <Button size="sm" variant={m.status === 'deactivated' ? 'success' : 'danger'} onClick={() => setConfirmToggle(m)}>
            {m.status === 'deactivated' ? <CheckCircle2 size={12} /> : <Ban size={12} />}
          </Button>
        </div>
      ),
    },
  ]

  const mobileCardRender = (m: Member) => {
    const lc = levelColor(m.level)
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: spacing[4] }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #b8860b, #34c87b)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: fontWeight.bold, color: colors.primaryDeep, flexShrink: 0 }}>
            {(m.nickname || m.phone || '?')[0]}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: fontWeight.semibold }}>{m.nickname || '未命名'}</div>
            <div style={{ fontSize: fontSize.xs, color: colors.textSubtle, fontFamily: 'monospace' }}>{m.phone.slice(0, 3)}****{m.phone.slice(-4)}</div>
          </div>
          <span style={{ padding: '3px 10px', borderRadius: radius.sm, background: lc.bg, color: lc.color, fontSize: fontSize.xs, fontWeight: fontWeight.bold }}>{m.level}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing[3], fontSize: fontSize.xs, marginBottom: spacing[4] }}>
          <div>
            <div style={{ color: colors.textSubtle }}>消费</div>
            <div style={{ fontWeight: fontWeight.bold, color: colors.primary, fontSize: fontSize.md }}>¥{m.totalSpent}</div>
          </div>
          <div>
            <div style={{ color: colors.textSubtle }}>订单</div>
            <div style={{ fontWeight: fontWeight.bold, fontSize: fontSize.md }}>{m.totalOrders}</div>
          </div>
          <div>
            <div style={{ color: colors.textSubtle }}>积分</div>
            <div style={{ fontWeight: fontWeight.bold, color: colors.amber, fontSize: fontSize.md }}>{m.points}</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: spacing[2] }}>
          <Button size="sm" variant="primary" block onClick={() => openProfile(m)}>
            <Eye size={14} /> 画像
          </Button>
          <Button size="sm" variant="secondary" block onClick={() => setOp({ kind: 'points', member: m })}>
            <Coins size={14} /> 调整
          </Button>
        </div>
      </div>
    )
  }

  return (
    <AdminLayout title="会员管理" active="members">
      {/* 筛选 */}
      <Card style={{ marginBottom: spacing[5] }} padding={spacing[5]}>
        <div style={{ display: 'flex', gap: spacing[3], flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: colors.textSubtle }} />
            <input
              type="search"
              placeholder="🔍 搜索昵称/手机号…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="搜索会员"
              style={{
                width: '100%', minHeight: 44, padding: '10px 14px 10px 36px', borderRadius: radius.lg,
                background: colors.bgInput, border: `1px solid ${colors.borderMuted}`,
                color: colors.text, fontSize: fontSize.sm, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
          <Button variant="secondary" onClick={load}>
            <RefreshCw size={14} />
            刷新
          </Button>
        </div>
        <div style={{ marginTop: spacing[5], display: 'flex', gap: spacing[2], flexWrap: 'wrap' }}>
          {(['all', 'VIP', '金卡', '银卡', '普通'] as const).map((lv) => (
            <button
              key={lv}
              onClick={() => setLevelFilter(lv)}
              aria-pressed={levelFilter === lv}
              style={{
                padding: '10px 16px', borderRadius: radius.full, fontSize: fontSize.sm, fontWeight: fontWeight.semibold,
                border: `1px solid ${levelFilter === lv ? colors.primaryBorderStrong : colors.borderMuted}`,
                background: levelFilter === lv ? colors.primaryBgLight : 'transparent',
                color: levelFilter === lv ? colors.primary : colors.textMuted,
                cursor: 'pointer', fontFamily: 'inherit', minHeight: 44,
              }}
            >{lv === 'all' ? '全部' : lv}</button>
          ))}
        </div>
      </Card>

      {/* 数据 */}
      {loading ? (
        <Loading text="加载会员中…" />
      ) : error ? (
        <ErrorState error={error} onRetry={load} />
      ) : list.length === 0 ? (
        <EmptyState icon={<Users size={48} strokeWidth={1.5} />} title="暂无会员" description="还没有任何会员数据" />
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: spacing[3], marginBottom: spacing[5] }}>
            <SummaryCard label="会员数" value={list.length} suffix=" 人" icon={<Users size={14} />} />
            <SummaryCard label="总消费" value={totalSpent} prefix="¥" color={colors.primary} icon={<Wallet size={14} />} />
            <SummaryCard label="总订单" value={totalOrders} suffix=" 单" icon={<ShoppingCart size={14} />} />
            <SummaryCard label="总积分" value={totalPoints} suffix=" 分" color={colors.amber} icon={<Coins size={14} />} />
          </div>

          <ResponsiveTable
            columns={columns}
            data={filtered}
            rowKey={(m) => m.id}
            mobileCardRender={mobileCardRender}
          />

          <div style={{ marginTop: spacing[5], fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'center' }}>
            显示 {filtered.length} / {list.length} 位会员 · 已屏蔽 {blockedCount}
          </div>
        </>
      )}

      {/* 操作弹窗 */}
      {op && (
        <Modal
          open={true}
          onClose={() => { setOp(null); setDelta(''); setNickname('') }}
          title={
            op.kind === 'points' ? `💎 调整积分 - ${op.member.nickname || op.member.phone}` :
            op.kind === 'spent' ? `💰 调整消费 - ${op.member.nickname || op.member.phone}` :
            op.kind === 'rename' ? `✏ 修改昵称 - ${op.member.nickname || op.member.phone}` :
            op.kind === 'status' ? (op.member.status === 'deactivated' ? '✅ 恢复账号' : '🚫 屏蔽账号') : ''
          }
          footer={
            <>
              <Button variant="ghost" onClick={() => { setOp(null); setDelta(''); setNickname('') }}>取消</Button>
              <Button variant="primary" onClick={submitOp} loading={busy}>确认</Button>
            </>
          }
        >
          {op.kind === 'points' && (
            <div>
              <div style={{ fontSize: fontSize.sm, color: colors.textSubtle, marginBottom: spacing[4] }}>当前积分：<span style={{ color: colors.primary, fontWeight: fontWeight.bold }}>{op.member.points}</span></div>
              <label style={{ display: 'block', fontSize: fontSize.xs, color: colors.textSubtle, marginBottom: 4 }}>± 数字（正=加，负=减）</label>
              <input type="number" value={delta} onChange={(e) => setDelta(e.target.value)} placeholder="如 100 或 -50" autoFocus style={inputField} />
            </div>
          )}
          {op.kind === 'spent' && (
            <div>
              <div style={{ fontSize: fontSize.sm, color: colors.textSubtle, marginBottom: spacing[4] }}>当前消费：<span style={{ color: colors.primary, fontWeight: fontWeight.bold }}>¥{op.member.totalSpent}</span></div>
              <label style={{ display: 'block', fontSize: fontSize.xs, color: colors.textSubtle, marginBottom: 4 }}>± 金额</label>
              <input type="number" value={delta} onChange={(e) => setDelta(e.target.value)} placeholder="如 100 或 -50" autoFocus style={inputField} />
            </div>
          )}
          {op.kind === 'rename' && (
            <div>
              <label style={{ display: 'block', fontSize: fontSize.xs, color: colors.textSubtle, marginBottom: 4 }}>新昵称（≤20字）</label>
              <input value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={20} autoFocus style={inputField} />
            </div>
          )}
          {op.kind === 'status' && (
            <div style={{ fontSize: fontSize.sm, color: colors.textMuted, lineHeight: 1.6 }}>
              {op.member.status === 'deactivated' ? '确认恢复此客户账号？' : '确认屏蔽此客户账号？屏蔽后无法下单。'}
            </div>
          )}
        </Modal>
      )}

      <ConfirmDialog
        open={!!confirmToggle}
        title={confirmToggle ? `${confirmToggle.status === 'deactivated' ? '恢复' : '屏蔽'}「${confirmToggle.nickname || confirmToggle.phone}」？` : ''}
        description={confirmToggle?.status === 'active' ? '屏蔽后该用户无法登录和下单' : '恢复后该用户可以正常下单'}
        confirmText={confirmToggle?.status === 'active' ? '屏蔽' : '恢复'}
        danger={confirmToggle?.status === 'active'}
        onConfirm={() => confirmToggle && setOp({ kind: 'status', member: confirmToggle })}
        onCancel={() => setConfirmToggle(null)}
      />

      {/* 画像弹窗 */}
      {(profile || profileLoading) && (
        <Modal open={true} onClose={() => setProfile(null)} title={`👤 ${profile?.customer.nickname || '会员'} - 行为画像`} width={720}>
          {profileLoading ? (
            <Loading text="计算画像中…" />
          ) : profile ? (
            <div style={{ fontFamily: '-apple-system, "PingFang SC", sans-serif' }}>
              <SectionTitle>🎯 RFM 分层</SectionTitle>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: spacing[2], marginBottom: spacing[7] }}>
                <ProfileStat label="R (最近)" value={profile.profile.rfm.R} sub={profile.profile.rfm.daysSinceLast !== null ? `${profile.profile.rfm.daysSinceLast}天前` : '新'} color={colors.primary} />
                <ProfileStat label="F (频率)" value={profile.profile.rfm.F} sub={`${profile.profile.rfm.orderCount}单`} color={colors.purple} />
                <ProfileStat label="M (金额)" value={profile.profile.rfm.M} sub={`¥${profile.profile.rfm.totalSpent.toFixed(0)}`} color={colors.amber} />
                <ProfileStat label="CLV 预估" value={`¥${profile.profile.clv.toLocaleString()}`} sub="生命周期价值" color="#ec4899" />
              </div>

              <SectionTitle>💡 行为指标</SectionTitle>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: spacing[2], marginBottom: spacing[7] }}>
                <ProfileStat label="客单价" value={`¥${profile.profile.avgOrderAmount}`} sub="平均" />
                <ProfileStat label="件单价" value={`¥${profile.profile.avgProductPrice}`} sub="平均商品价" />
                <ProfileStat label="价格敏感度" value={profile.profile.priceSensitivity} sub="从客单推导" />
              </div>

              {profile.profile.topCategories.length > 0 && (
                <>
                  <SectionTitle>🛒 复购品类 TOP {profile.profile.topCategories.length}</SectionTitle>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: spacing[7] }}>
                    {profile.profile.topCategories.map((c) => (
                      <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ flex: '0 0 100px', fontSize: fontSize.sm, color: colors.textMuted }}>{c.name}</div>
                        <div style={{ flex: 1, height: 10, background: colors.bgHover, borderRadius: 5, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${c.share}%`, background: 'linear-gradient(90deg, #a78bfa, #7c3aed)', borderRadius: 5 }} />
                        </div>
                        <div style={{ flex: '0 0 70px', textAlign: 'right', fontSize: fontSize.xs, color: colors.textSubtle }}>{c.count} 件 · {c.share}%</div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <SectionTitle>📈 月度趋势 (6月)</SectionTitle>
              <div style={{ display: 'flex', gap: 4, height: 70, alignItems: 'flex-end', marginBottom: spacing[5], padding: '4px 0' }}>
                {profile.profile.monthlyTrend.map((m) => {
                  const max = Math.max(...profile.profile.monthlyTrend.map((x) => x.amount), 1)
                  const h = Math.max((m.amount / max) * 60, m.amount > 0 ? 3 : 1)
                  return (
                    <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <div style={{ width: '100%', height: h, background: 'linear-gradient(180deg, #a78bfa, #7c3aed)', borderRadius: 4 }} title={`${m.month}: ¥${m.amount.toFixed(0)}`} />
                      <div style={{ fontSize: 9, color: colors.textMuted, fontFamily: 'monospace' }}>{m.month.slice(5)}</div>
                    </div>
                  )
                })}
              </div>

              <SectionTitle>🏷️ 行为推断 (从订单推导，不编)</SectionTitle>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: spacing[7] }}>
                {profile.profile.behaviorTags.map((tag, i) => (
                  <span key={i} style={{ padding: '6px 14px', borderRadius: radius.full, background: colors.purpleBg, border: `1px solid ${colors.purpleBorder}`, color: '#c4b5fd', fontSize: fontSize.xs, fontWeight: fontWeight.semibold }}>{tag}</span>
                ))}
              </div>

              <div style={{ padding: spacing[4], borderRadius: radius.lg, background: colors.primaryBgSubtle, border: `1px solid ${colors.primaryBorder}`, fontSize: fontSize.xs, color: colors.textMuted, lineHeight: 1.6 }}>
                💡 <strong style={{ color: colors.primary }}>这是行为画像，不是 AI 性格</strong>。所有标签从真实订单推导（复购/价格/时段/CLV），不推测用户"性格"或"喜不喜欢"等隐私属性。
              </div>
            </div>
          ) : null}
        </Modal>
      )}
    </AdminLayout>
  )
}

const inputField: React.CSSProperties = {
  width: '100%', minHeight: 48, padding: '12px 14px', borderRadius: radius.lg,
  background: colors.bgInput, border: `1px solid ${colors.borderStrong}`,
  color: colors.text, fontSize: fontSize.lg, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: fontSize.base, fontWeight: fontWeight.bold, marginBottom: spacing[3], color: colors.text }}>{children}</div>
}

function ProfileStat({ label, value, sub, color }: { label: string; value: any; sub?: string; color?: string }) {
  return (
    <div style={{ background: colors.purpleBg, border: `1px solid ${colors.purpleBorder}`, borderRadius: radius.lg, padding: `${spacing[3]} ${spacing[5]}` }}>
      <div style={{ fontSize: fontSize.xs, color: colors.textSubtle, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: color || colors.text, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: colors.textMuted, marginTop: 2 }}>{sub}</div>}
    </div>
  )
}