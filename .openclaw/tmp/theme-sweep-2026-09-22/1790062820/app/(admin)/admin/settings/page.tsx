// v0.8.68.3 - 设置(合并原 activities + coupons + groupbuys + points + merchant)
'use client'
import { useState, useEffect, useCallback } from 'react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { Card, SummaryCard } from '@/components/ui/Card'
import { EmptyState, Loading } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { colors, fontSize, fontWeight, radius, spacing } from '@/lib/design-tokens'
import { Gift, Coins, Target, Star, Store } from 'lucide-react'

type Tab = 'merchant' | 'activities' | 'coupons' | 'points' | 'groupbuys'

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('merchant')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<any>({})
  const toast = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // 拉主要 API
      const results = await Promise.all([
        fetch('/api/admin/activities').then(r => r.json()).catch(() => ({ success: false })),
        fetch('/api/admin/coupons').then(r => r.json()).catch(() => ({ success: false })),
        fetch('/api/admin/points-config').then(r => r.json()).catch(() => ({ success: false })),
        fetch('/api/admin/groupbuys').then(r => r.json()).catch(() => ({ success: false })),
      ])
      setData({
        activities: results[0],
        coupons: results[1],
        points: results[2],
        groupbuys: results[3],
      })
    } catch (e: any) {
      toast.toast(e.message, 'err')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: 'merchant', label: '商户', icon: Store },
    { key: 'activities', label: '活动', icon: Gift },
    { key: 'coupons', label: '优惠券', icon: Coins },
    { key: 'points', label: '积分', icon: Star },
    { key: 'groupbuys', label: '拼团', icon: Target },
  ]

  return (
    <AdminLayout title="设置" active="settings">
      <div style={{ marginBottom: spacing[5] }}>
        <div style={{ fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text, marginBottom: spacing[3] }}>
          ⚙️ 设置
        </div>
        <div style={{ fontSize: fontSize.sm, color: colors.textMuted }}>
          商户配置 + 活动 + 优惠券 + 积分规则 + 拼团(原 5 个独立页合并)
        </div>
      </div>

      {/* Tab */}
      <div style={{ display: 'flex', gap: spacing[2], marginBottom: spacing[5], borderBottom: `1px solid ${colors.borderMuted}`, overflowX: 'auto' }}>
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
              minHeight: 44,
              whiteSpace: 'nowrap',
            }}
          >
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </div>

      {loading ? <Loading /> : (
        <>
          {tab === 'merchant' && <MerchantTab />}
          {tab === 'activities' && <ActivitiesTab data={data.activities} />}
          {tab === 'coupons' && <CouponsTab data={data.coupons} />}
          {tab === 'points' && <PointsTab data={data.points} onReload={load} />}
          {tab === 'groupbuys' && <GroupBuysTab data={data.groupbuys} />}
        </>
      )}
    </AdminLayout>
  )
}

function MerchantTab() {
  return (
    <Card title="商户配置">
      <EmptyState
        icon={<Store />}
        title="商户设置"
        description="商户基本信息、商户类型、营业执照等(后续迁移到此 Tab)"
      />
    </Card>
  )
}

function ActivitiesTab({ data }: { data: any }) {
  const items = data?.items || data?.activities || []
  return (
    <Card title={`营销活动 (${items.length})`} action={
      <div style={{ display: 'flex', gap: spacing[2] }}>
        <a href="/admin/activities?action=create" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '8px 14px', borderRadius: radius.base, background: 'linear-gradient(135deg, #fbbf24, #4ade80)', color: '#0a0f0d', border: 'none', fontSize: fontSize.sm, fontWeight: fontWeight.bold, cursor: 'pointer', textDecoration: 'none' }}>
          + 新建活动
        </a>
        <a href="/admin/activities" style={{ display: 'inline-flex', alignItems: 'center', gap: spacing[2], padding: '8px 14px', borderRadius: radius.base, background: 'transparent', color: colors.primary, border: `1px solid ${colors.primary}`, textDecoration: 'none', fontSize: fontSize.sm, fontWeight: fontWeight.semibold }}>
          <Gift size={14} /> 管理 →
        </a>
      </div>
    }>
      {items.length === 0 ? <EmptyState icon={<Gift />} title="暂无活动" description="点击右上'管理活动'新建/编辑营销活动" /> : (
        <div>
          <div style={{ padding: spacing[2], marginBottom: spacing[3], background: 'rgba(127, 220, 148, 0.08)', border: '1px solid rgba(127, 220, 148, 0.2)', borderRadius: radius.base, fontSize: fontSize.xs, color: '#fbbf24' }}>
            ✏️ 完整编辑/新建/删除在右上"管理活动"页
          </div>
          {items.slice(0, 20).map((a: any) => (
            <div key={a.id} style={{ padding: spacing[3], borderBottom: `1px solid ${colors.borderMuted}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: fontSize.sm, color: colors.text, fontWeight: fontWeight.semibold }}>{a.title || a.name}</div>
                <div style={{ fontSize: fontSize.xs, color: colors.textMuted, marginTop: 4 }}>{a.startAt} ~ {a.endAt}</div>
              </div>
              <span style={{ fontSize: fontSize.xs, color: colors.textMuted, padding: '2px 8px', background: 'rgba(127, 220, 148, 0.15)', borderRadius: 4 }}>{a.type || '活动'}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

function CouponsTab({ data, onReload }: { data: any; onReload?: () => void }) {
  const items = data?.items || data?.coupons || []
  const toast = useToast()
  // ⭐ 奕霖 2026-09-07 20:52 "没有添加优惠劵按键":inline + 新建
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: '', minSpend: 0, value: 10, days: 30, type: 'discount' })

  const create = async () => {
    if (!form.name.trim()) { toast.toast('请输入券名', 'err'); return }
    if (form.value <= 0) { toast.toast('优惠值必须 > 0', 'err'); return }
    if (form.minSpend > 0 && form.value >= form.minSpend) { toast.toast('优惠值 < 满减门槛', 'err'); return }
    setCreating(true)
    try {
      const res = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, value: form.value, minSpend: form.minSpend, expiresInDays: form.days, type: form.type }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || '创建失败')
      toast.toast('✓ 券已创建', 'ok')
      setShowCreate(false)
      setForm({ name: '', minSpend: 0, value: 10, days: 30, type: 'discount' })
      onReload?.()
    } catch (e: any) {
      toast.toast(e.message || '创建失败', 'err')
    } finally {
      setCreating(false)
    }
  }

  const labelStyle = { fontSize: fontSize.xs, color: colors.textMuted, marginBottom: 4, display: 'block' } as const
  const inputStyle = {
    width: '100%', padding: '8px 12px', borderRadius: radius.base,
    border: `1px solid ${colors.borderMuted}`, background: 'rgba(255,255,255,0.04)',
    color: colors.text, fontSize: fontSize.sm, outline: 'none', fontFamily: 'inherit',
  } as const

  return (
    <Card title={`优惠券 (${items.length})`} action={
      <div style={{ display: 'flex', gap: spacing[2] }}>
        <button onClick={() => setShowCreate(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '8px 14px', borderRadius: radius.base, background: 'linear-gradient(135deg, #fbbf24, #4ade80)', color: '#0a0f0d', border: 'none', fontSize: fontSize.sm, fontWeight: fontWeight.bold, cursor: 'pointer' }}>
          + 新建优惠券
        </button>
        <a href="/admin/coupons" style={{ display: 'inline-flex', alignItems: 'center', gap: spacing[2], padding: '8px 14px', borderRadius: radius.base, background: 'transparent', color: colors.primary, border: `1px solid ${colors.primary}`, textDecoration: 'none', fontSize: fontSize.sm, fontWeight: fontWeight.semibold }}>
          <Coins size={14} /> 管理 →
        </a>
      </div>
    }>
      {items.length === 0 ? <EmptyState icon={<Coins />} title="暂无优惠券" description="点击右上'管理优惠券'新建/编辑优惠券" /> : (
        <div>
          <div style={{ padding: spacing[2], marginBottom: spacing[3], background: 'rgba(127, 220, 148, 0.08)', border: '1px solid rgba(127, 220, 148, 0.2)', borderRadius: radius.base, fontSize: fontSize.xs, color: '#fbbf24' }}>
            ✏️ 新建/编辑/批量操作在右上"管理优惠券"页
          </div>
          {items.slice(0, 20).map((c: any) => (
            <div key={c.id} style={{ padding: spacing[3], borderBottom: `1px solid ${colors.borderMuted}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: fontSize.sm, color: colors.text, fontWeight: fontWeight.semibold }}>{c.name}</div>
                <div style={{ fontSize: fontSize.xs, color: colors.textMuted, marginTop: 4 }}>满 ¥{c.minSpend} 减 ¥{c.amount}</div>
              </div>
              <div style={{ fontSize: fontSize.xs, color: colors.textMuted, padding: '2px 8px', background: 'rgba(127, 220, 148, 0.15)', borderRadius: 4 }}>已发 {c.total}</div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <div onClick={() => setShowCreate(false)} style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#0a0f0d', border: '1px solid #fbbf24', borderRadius: 16, padding: 20, width: '100%', maxWidth: 440, color: '#fff' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>🎟️ 新建优惠券</h3>
            <label style={labelStyle}>券名 (≤ 30 字)</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="例：满100减20" style={inputStyle} />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>满减门槛</label>
                <input type="number" value={form.minSpend} onChange={(e) => setForm({ ...form, minSpend: Number(e.target.value) || 0 })} placeholder="100" style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>优惠值</label>
                <input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: Number(e.target.value) || 0 })} placeholder="20" style={inputStyle} />
              </div>
            </div>
            <label style={{ ...labelStyle, marginTop: 8 }}>有效天数 (1-365)</label>
            <input type="number" value={form.days} onChange={(e) => setForm({ ...form, days: Number(e.target.value) || 30 })} placeholder="30" style={inputStyle} />
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={() => setShowCreate(false)} style={{ flex: 1, padding: '10px', borderRadius: radius.base, background: 'transparent', border: `1px solid ${colors.borderMuted}`, color: colors.text, cursor: 'pointer', fontSize: fontSize.sm }}>取消</button>
              <button onClick={create} disabled={creating} style={{ flex: 2, padding: '10px', borderRadius: radius.base, background: 'linear-gradient(135deg, #fbbf24, #4ade80)', color: '#0a0f0d', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: fontSize.sm }}>{creating ? '创建中...' : '创建'}</button>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}

function PointsTab({ data, onReload }: { data: any; onReload?: () => void }) {
  const cfg = data?.config || {}
  const isDefault = data?.isDefault || false
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    earnRate: cfg.earnRate ?? 0.05,
    pointValue: cfg.pointValue ?? 0.01,
    minRedeem: cfg.minRedeem ?? 100,
    pointsToYuanRate: cfg.pointsToYuanRate ?? 0.02,
    maxDeductPercent: cfg.maxDeductPercent ?? 50,
    minPointsToUse: cfg.minPointsToUse ?? 100,
    deductEnabled: cfg.deductEnabled ?? true,
  })

  const startEdit = () => {
    setForm({
      earnRate: cfg.earnRate ?? 0.05,
      pointValue: cfg.pointValue ?? 0.01,
      minRedeem: cfg.minRedeem ?? 100,
      pointsToYuanRate: cfg.pointsToYuanRate ?? 0.02,
      maxDeductPercent: cfg.maxDeductPercent ?? 50,
      minPointsToUse: cfg.minPointsToUse ?? 100,
      deductEnabled: cfg.deductEnabled ?? true,
    })
    setEditing(true)
  }

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/points-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          earnRate: Number(form.earnRate),
          pointValue: Number(form.pointValue),
          minRedeem: Number(form.minRedeem),
          pointsToYuanRate: Number(form.pointsToYuanRate),
          maxDeductPercent: Number(form.maxDeductPercent),
          minPointsToUse: Number(form.minPointsToUse),
          deductEnabled: Boolean(form.deductEnabled),
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || '保存失败')
      toast.toast('积分规则已保存', 'ok')
      setEditing(false)
      onReload?.()
    } catch (e: any) {
      toast.toast(e.message || '保存失败', 'err')
    } finally {
      setSaving(false)
    }
  }

  const labelStyle = { fontSize: fontSize.sm, color: colors.text, fontWeight: fontWeight.semibold, marginBottom: spacing[1], display: 'block' } as const
  const hintStyle = { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 4 } as const
  const inputStyle = {
    width: '100%', padding: '10px 14px', borderRadius: radius.base,
    border: '1px solid rgba(127, 220, 148, 0.3)',
    background: 'rgba(255,255,255,0.04)', color: colors.text,
    fontSize: fontSize.sm, outline: 'none', fontFamily: 'inherit',
  } as const

  if (!editing) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[4] }}>
        {isDefault && (
          <div style={{ padding: spacing[3], background: 'rgba(251, 191, 36, 0.1)', border: '1px solid rgba(251, 191, 36, 0.3)', borderRadius: radius.base, fontSize: fontSize.sm, color: '#fbbf24' }}>
            ⚠️ 当前显示默认值,点编辑保存后写入数据库
          </div>
        )}

        <Card title="积分赚取规则" action={
          <button onClick={startEdit} style={{ padding: '8px 16px', borderRadius: radius.base, background: colors.primary, color: '#fff', border: 'none', fontWeight: fontWeight.semibold, cursor: 'pointer', fontSize: fontSize.sm }}>✏️ 编辑</button>
        }>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: spacing[4] }}>
            <SummaryCard label="返积分率" value={cfg.earnRate != null ? `${(cfg.earnRate * 100).toFixed(1)}%` : '5%'} icon={<Star />} />
            <SummaryCard label="兑换时 1 分 = " value={cfg.pointValue != null ? `¥${cfg.pointValue.toFixed(2)}` : '¥0.01'} icon={<Coins />} />
            <SummaryCard label="最低兑换" value={cfg.minRedeem != null ? `${cfg.minRedeem} 分` : '100 分'} icon={<Target />} />
          </div>
        </Card>

        <Card title="积分抵扣规则 (POS 收银)" action={
          <button onClick={startEdit} style={{ padding: '8px 16px', borderRadius: radius.base, background: colors.primary, color: '#fff', border: 'none', fontWeight: fontWeight.semibold, cursor: 'pointer', fontSize: fontSize.sm }}>✏️ 编辑</button>
        }>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: spacing[4] }}>
            <SummaryCard label="抵扣率" value={cfg.pointsToYuanRate != null ? `1 分 = ¥${cfg.pointsToYuanRate.toFixed(2)}` : '1 分 = ¥0.02'} icon={<Coins />} />
            <SummaryCard label="最多抵订单" value={cfg.maxDeductPercent != null ? `${cfg.maxDeductPercent}%` : '50%'} icon={<Target />} />
            <SummaryCard label="最低使用" value={cfg.minPointsToUse != null ? `${cfg.minPointsToUse} 分` : '100 分'} icon={<Gift />} />
            <SummaryCard label="抵扣开关" value={cfg.deductEnabled === false ? '❌ 已关闭' : '✅ 开启'} icon={<Star />} />
          </div>
        </Card>

        <Card title="积分兑换商品">
          <a href="/admin/points" style={{ display: 'inline-flex', alignItems: 'center', gap: spacing[2], padding: `${spacing[2]} ${spacing[4]}`, background: colors.primary, color: '#fff', borderRadius: radius.base, fontSize: fontSize.sm, fontWeight: fontWeight.semibold, textDecoration: 'none' }}>
            <Target size={16} /> 管理兑换商品 →
          </a>
          <div style={{ marginTop: spacing[3], fontSize: fontSize.xs, color: colors.textMuted }}>
            积分兑换商品的增删改查在 /admin/points 页操作(已有完整 CRUD)
          </div>
        </Card>
      </div>
    )
  }

  return (
    <Card title="编辑积分规则">
      <div style={{ fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.text, marginBottom: spacing[3] }}>📥 积分赚取</div>
      <div style={{ marginBottom: spacing[3] }}>
        <label style={labelStyle}>返积分率 (0-1)</label>
        <input type="number" step="0.01" min="0" max="1" value={form.earnRate} onChange={(e) => setForm({ ...form, earnRate: e.target.value as any })} style={inputStyle} />
        <div style={hintStyle}>消费返积分比例,如 0.05 = 5%</div>
      </div>
      <div style={{ marginBottom: spacing[3] }}>
        <label style={labelStyle}>兑换时 1 分 = (元)</label>
        <input type="number" step="0.01" min="0.01" value={form.pointValue} onChange={(e) => setForm({ ...form, pointValue: e.target.value as any })} style={inputStyle} />
        <div style={hintStyle}>积分换商品时 1 积分的价值</div>
      </div>
      <div style={{ marginBottom: spacing[4] }}>
        <label style={labelStyle}>最低兑换 (分)</label>
        <input type="number" min="0" value={form.minRedeem} onChange={(e) => setForm({ ...form, minRedeem: e.target.value as any })} style={inputStyle} />
        <div style={hintStyle}>积分兑换商品至少需要的分数</div>
      </div>

      <div style={{ borderTop: `1px solid ${colors.borderMuted}`, paddingTop: spacing[4], marginTop: spacing[4] }}>
        <div style={{ fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.text, marginBottom: spacing[3] }}>💰 积分抵扣 (POS 收银)</div>
        <div style={{ marginBottom: spacing[3] }}>
          <label style={labelStyle}>抵扣率 (1 分 = X 元)</label>
          <input type="number" step="0.01" min="0.01" value={form.pointsToYuanRate} onChange={(e) => setForm({ ...form, pointsToYuanRate: e.target.value as any })} style={inputStyle} />
          <div style={hintStyle}>收银时 1 积分抵多少元 (默认 0.02 = 50 分抵 1 元)</div>
        </div>
        <div style={{ marginBottom: spacing[3] }}>
          <label style={labelStyle}>最多抵订单 (%)</label>
          <input type="number" min="1" max="100" value={form.maxDeductPercent} onChange={(e) => setForm({ ...form, maxDeductPercent: e.target.value as any })} style={inputStyle} />
          <div style={hintStyle}>单笔最多抵订单总额的 X%</div>
        </div>
        <div style={{ marginBottom: spacing[3] }}>
          <label style={labelStyle}>最低使用分数</label>
          <input type="number" min="0" value={form.minPointsToUse} onChange={(e) => setForm({ ...form, minPointsToUse: e.target.value as any })} style={inputStyle} />
          <div style={hintStyle}>低于此分数不能用积分抵扣</div>
        </div>
        <div style={{ marginBottom: spacing[4] }}>
          <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: spacing[2] }}>
            <input type="checkbox" checked={form.deductEnabled} onChange={(e) => setForm({ ...form, deductEnabled: e.target.checked })} />
            启用积分抵扣
          </label>
          <div style={hintStyle}>关闭后顾客在 POS 收银时不能用积分</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: spacing[3], marginTop: spacing[4] }}>
        <button onClick={() => setEditing(false)} disabled={saving} style={{ flex: 1, padding: '12px 16px', borderRadius: radius.base, background: 'transparent', border: `1px solid ${colors.borderMuted}`, color: colors.text, cursor: 'pointer', fontSize: fontSize.sm }}>取消</button>
        <button onClick={save} disabled={saving} style={{ flex: 2, padding: '12px 16px', borderRadius: radius.base, background: colors.primary, color: '#fff', border: 'none', fontWeight: fontWeight.semibold, cursor: 'pointer', fontSize: fontSize.sm }}>{saving ? '保存中...' : '保存'}</button>
      </div>
    </Card>
  )
}

function GroupBuysTab({ data }: { data: any }) {
  const items = data?.items || data?.groupBuys || []
  return (
    <Card title={`拼团 (${items.length})`} action={
      <a href="/admin/groupbuys" style={{ display: 'inline-flex', alignItems: 'center', gap: spacing[2], padding: '8px 14px', borderRadius: radius.base, background: colors.primary, color: '#fff', textDecoration: 'none', fontSize: fontSize.sm, fontWeight: fontWeight.semibold }}>
        <Target size={14} /> 管理拼团 →
      </a>
    }>
      {items.length === 0 ? <EmptyState icon={<Target />} title="暂无拼团" description="点击右上'管理拼团'新建/编辑拼团" /> : (
        <div>
          <div style={{ padding: spacing[2], marginBottom: spacing[3], background: 'rgba(127, 220, 148, 0.08)', border: '1px solid rgba(127, 220, 148, 0.2)', borderRadius: radius.base, fontSize: fontSize.xs, color: '#fbbf24' }}>
            ✏️ 新建/关闭/复制链接/删除在右上"管理拼团"页
          </div>
          {items.slice(0, 20).map((g: any) => (
            <div key={g.id} style={{ padding: spacing[3], borderBottom: `1px solid ${colors.borderMuted}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: fontSize.sm, color: colors.text, fontWeight: fontWeight.semibold }}>{g.productName || g.id}</div>
                <div style={{ fontSize: fontSize.xs, color: colors.textMuted, marginTop: 4 }}>
                  {g.currentPeople}/{g.targetPeople} 人 · ¥{g.groupPrice}
                </div>
              </div>
              <span style={{ fontSize: fontSize.xs, color: colors.textMuted, padding: '2px 8px', background: 'rgba(168, 85, 247, 0.15)', borderRadius: 4 }}>{g.status || 'active'}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
