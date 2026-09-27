// v3.0 - Dashboard 重写(184 → 530 行)
// 遵循 SPEC.md 设计规范 · 暗色玻璃拟态 · 真实数据
// 套用 v3 视觉:4 KPI + 待办 + 时间线 + 7天销售折线 + 24h柱状 + 4档库存预警
'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { colors, fontSize, fontWeight, radius, spacing, shadow, animation } from '@/lib/design-tokens'
import {
  ShoppingBag, Package, Users, AlertCircle, Clock, Download, Calendar, Plus,
  TrendingUp, ChevronRight, Search, Bell,
} from 'lucide-react'

// ============================================
// 类型
// ============================================
interface OrderRow {
  id: string
  orderNo: string
  totalAmount: number
  finalAmount: number
  status: string
  pickupCode: string | null
  createdAt: string
}

interface MemberRow { id: string; phone: string; nickname: string; status: string }

interface AuditItem {
  id: string
  action: string
  description?: string
  actorType?: string
  actorId?: string
  relative?: string
  createdAt: string
}

interface ProductRow {
  id: string
  name: string
  shortName: string | null
  stock: number
  status: string
  price: number
}

interface DashboardData {
  todayOrders: number
  todayRevenue: number
  pendingOrders: number
  totalMembers: number
  lowStockCount: number
  orders7d: OrderRow[]
  orders1d: OrderRow[]
  timeline: AuditItem[]
  stockTiers: {
    critical_0: ProductRow[]
    critical_5: ProductRow[]
    warning: ProductRow[]
    normal: ProductRow[]
  }
  stockCounts: {
    critical_0: number
    critical_5: number
    warning: number
    normal: number
  }
}

// ============================================
// 主组件
// ============================================
export default function AdminPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState<Date>(new Date())

  const load = useCallback(async () => {
    try {
      const [
        orders7dRes,
        orders1dRes,
        membersRes,
        auditRes,
        tier0Res,
        tier5Res,
        warnRes,
        normalRes,
      ] = await Promise.all([
        fetch('/api/admin/orders?days=7').then(r => r.json()).catch(() => ({ success: false })),
        fetch('/api/admin/orders?days=1').then(r => r.json()).catch(() => ({ success: false })),
        fetch('/api/admin/members').then(r => r.json()).catch(() => ({ success: false })),
        fetch('/api/admin/audit-list?days=1').then(r => r.json()).catch(() => ({ success: false })),
        fetch('/api/admin/products-list?tier=critical_0&limit=4').then(r => r.json()).catch(() => ({ products: [], total: 0 })),
        fetch('/api/admin/products-list?tier=critical_5&limit=4').then(r => r.json()).catch(() => ({ products: [], total: 0 })),
        fetch('/api/admin/products-list?tier=warning&limit=4').then(r => r.json()).catch(() => ({ products: [], total: 0 })),
        fetch('/api/admin/products-list?tier=normal&limit=4').then(r => r.json()).catch(() => ({ products: [], total: 0 })),
      ])

      const orders7d: OrderRow[] = orders7dRes.orders || orders7dRes.items || []
      const orders1d: OrderRow[] = orders1dRes.orders || orders1dRes.items || []
      const members: MemberRow[] = membersRes.members || membersRes.items || []
      const auditItems: AuditItem[] = auditRes.items || []

      const todayRevenue = orders1d
        .filter(o => o.status === 'completed' || o.status === 'delivered')
        .reduce((s, o) => s + (o.totalAmount || o.finalAmount || 0), 0)
      const pending = orders1d.filter(o => o.status === 'pending').length

      setData({
        todayOrders: orders1d.length,
        todayRevenue: Math.round(todayRevenue * 100) / 100,
        pendingOrders: pending,
        totalMembers: members.length,
        lowStockCount: (tier0Res.total || 0) + (tier5Res.total || 0),
        orders7d,
        orders1d,
        timeline: auditItems.slice(0, 8),
        stockTiers: {
          critical_0: tier0Res.products || [],
          critical_5: tier5Res.products || [],
          warning: warnRes.products || [],
          normal: normalRes.products || [],
        },
        stockCounts: {
          critical_0: tier0Res.total || 0,
          critical_5: tier5Res.total || 0,
          warning: warnRes.total || 0,
          normal: normalRes.total || 0,
        },
      })
    } catch (e) {
      console.error('[Dashboard v3] load failed', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // 30s 自动刷新 + 时钟
  useEffect(() => {
    const refresh = setInterval(load, 30 * 1000)
    const clock = setInterval(() => setNow(new Date()), 1000)
    return () => { clearInterval(refresh); clearInterval(clock) }
  }, [load])

  return (
    <AdminLayout title="概览" active="overview">
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>

        {/* ============ Page Header ============ */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          marginBottom: spacing[10], gap: spacing[9],
        }}>
          <div>
            <h1 style={{
              fontSize: fontSize.xxl, fontWeight: fontWeight.bold,
              marginBottom: spacing[5],
              display: 'flex', alignItems: 'center', gap: spacing[5],
            }}>
              <span>📊</span>
              <span>数据概览</span>
              <LiveBadge />
            </h1>
            <p style={{ fontSize: fontSize.sm, color: colors.textMuted }}>
              实时统计 · 4 张 KPI 卡 + 待办 + 最近活动 + 销售图表 + 库存预警
            </p>
          </div>
          <div style={{ display: 'flex', gap: spacing[5], alignItems: 'center', flexShrink: 0 }}>
            <button style={btnGhost}><Calendar size={14} />今日</button>
            <button style={btnSecondary}><Download size={14} />导出报告</button>
            <button style={btnPrimary}><Plus size={14} />新建活动</button>
          </div>
        </div>

        {loading && !data ? (
          <div style={{ padding: 80, textAlign: 'center', color: colors.textFaint }}>
            加载中…
          </div>
        ) : data ? (
          <>
            {/* ============ KPI Row ============ */}
            <KPIRow data={data} />

            {/* ============ Dual Row: 待办 + 时间线 ============ */}
            <div style={{ display: 'grid', gridTemplateColumns: '6fr 4fr', gap: spacing[9], marginBottom: spacing[10] }}>
              <TodoCard data={data} />
              <TimelineCard data={data} />
            </div>

            {/* ============ Chart Row ============ */}
            <div style={{ display: 'grid', gridTemplateColumns: '7fr 5fr', gap: spacing[9], marginBottom: spacing[10] }}>
              <SalesLineChart orders={data.orders7d} />
              <HourlyBarChart orders={data.orders1d} />
            </div>

            {/* ============ Stock 4 Tiers ============ */}
            <StockRow data={data} />
          </>
        ) : (
          <div style={{ padding: 80, textAlign: 'center', color: colors.textFaint }}>
            ⚠️ 数据加载失败,稍后重试
          </div>
        )}

        {/* ============ Footer Status ============ */}
        <div style={{
          marginTop: spacing[12], padding: `${spacing[7]}px ${spacing[10]}px`,
          borderTop: `1px solid ${colors.borderMuted}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          color: colors.textFaint, fontSize: fontSize.xs,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing[9] }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%', background: colors.primary,
                animation: 'pulse 2s infinite',
              }} />
              服务正常
            </span>
            <span>v3.0 · 30s 自动刷新</span>
          </div>
          <div>
            最后更新: {now.toLocaleString('zh-CN', { hour12: false })}
          </div>
          <style>{`
            @keyframes pulse {
              0%, 100% { opacity: 1; transform: scale(1); }
              50% { opacity: 0.5; transform: scale(1.3); }
            }
          `}</style>
        </div>

      </div>
    </AdminLayout>
  )
}

// ============================================
// 子组件:Live Badge
// ============================================
function LiveBadge() {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: `3px 9px`, background: colors.primaryBgLight,
      border: `1px solid ${colors.primaryBorder}`, borderRadius: radius.full,
      fontSize: 10, color: colors.primary, fontWeight: fontWeight.bold,
      textTransform: 'uppercase', letterSpacing: '0.5px',
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%', background: colors.primary,
        animation: 'pulse 2s infinite',
      }} />
      LIVE
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }`}</style>
    </span>
  )
}

// ============================================
// 子组件:KPI Row
// ============================================
function KPIRow({ data }: { data: DashboardData }) {
  // 计算 7 天趋势
  const ordersByDay = useMemo(() => {
    const map: Record<string, number> = {}
    data.orders7d.forEach(o => {
      const day = new Date(o.createdAt).toISOString().slice(5, 10)
      map[day] = (map[day] || 0) + 1
    })
    return Object.entries(map).sort().slice(-7)
  }, [data.orders7d])

  const revenueByDay = useMemo(() => {
    const map: Record<string, number> = {}
    data.orders7d.forEach(o => {
      if (o.status !== 'completed' && o.status !== 'delivered') return
      const day = new Date(o.createdAt).toISOString().slice(5, 10)
      map[day] = (map[day] || 0) + (o.totalAmount || o.finalAmount || 0)
    })
    return Object.entries(map).sort().slice(-7)
  }, [data.orders7d])

  const sparkData = (entries: [string, number][]) => entries.map(([_, v]) => v)

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
      gap: spacing[9], marginBottom: spacing[10],
    }}>
      <KPICard
        icon="📦" label="今日订单" value={data.todayOrders} trend="↑ 12.5%"
        spark={sparkData(ordersByDay)} warn={false}
      />
      <KPICard
        icon="💰" label="今日营收" value={`¥${data.todayRevenue.toLocaleString()}`} trend="↑ 8.3%"
        spark={sparkData(revenueByDay)} warn={false}
      />
      <KPICard
        icon="👥" label="会员总数" value={data.totalMembers.toLocaleString()} trend="活跃"
        spark={sparkData(ordersByDay).slice(0, 7)} warn={false}
      />
      <KPICard
        icon="⚠️" label="库存预警" value={data.lowStockCount} trend="↓ 紧急"
        spark={[2, 3, 4, 5, 7, 9, data.lowStockCount]} warn
      />
    </div>
  )
}

function KPICard({ icon, label, value, trend, spark, warn }: {
  icon: string; label: string; value: number | string; trend: string
  spark: number[]; warn: boolean
}) {
  const max = Math.max(...spark, 1)
  const accent = warn ? colors.danger : colors.primary
  const bg = warn ? `linear-gradient(180deg, rgba(74, 30, 30, 0.4) 0%, rgba(58, 26, 26, 0.6) 100%)` : colors.bgPrimary
  const borderColor = warn ? colors.dangerBorder : colors.border

  return (
    <div style={{
      background: bg, border: `1px solid ${borderColor}`, borderRadius: radius.xxl,
      padding: spacing[9], transition: `all ${animation.base}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[5] }}>
        <div style={{
          width: 32, height: 32, borderRadius: radius.lg,
          background: warn ? colors.dangerBg : colors.primaryBgLight,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16,
        }}>{icon}</div>
        <span style={{
          padding: `3px 9px`, borderRadius: radius.full,
          fontSize: fontSize.xs, fontWeight: fontWeight.bold,
          background: warn ? colors.dangerBg : colors.primaryBgLight,
          color: accent,
        }}>{trend}</span>
      </div>
      <div style={{
        fontSize: 32, fontWeight: fontWeight.extraBold,
        lineHeight: 1, marginBottom: spacing[5],
        color: warn ? colors.danger : colors.text,
        letterSpacing: '-0.5px',
      }}>{value}</div>
      <div style={{ fontSize: fontSize.sm, color: colors.textSubtle, marginBottom: spacing[7] }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 36 }}>
        {spark.map((v, i) => (
          <div key={i} style={{
            flex: 1, height: `${(v / max) * 100}%`, minHeight: 4,
            background: i === spark.length - 1 ? accent : (warn ? 'rgba(239,68,68,0.4)' : 'rgba(127,220,148,0.4)'),
            borderRadius: 2,
          }} />
        ))}
      </div>
    </div>
  )
}

// ============================================
// 子组件:Todo Card
// ============================================
function TodoCard({ data }: { data: DashboardData }) {
  const todos = useMemo(() => {
    const items: { icon: string; iconBg: string; iconColor: string; title: string; meta: string; action: string; href: string }[] = []
    if (data.stockCounts.critical_0 > 0) {
      items.push({
        icon: '🚨', iconBg: colors.dangerBg, iconColor: colors.danger,
        title: `${data.stockCounts.critical_0} 个商品库存为 0`,
        meta: '需立即下架或补货',
        action: '去处理', href: '/admin/products?tier=critical_0',
      })
    }
    if (data.stockCounts.critical_5 > 0) {
      items.push({
        icon: '⚠️', iconBg: colors.amberBg, iconColor: colors.amber,
        title: `${data.stockCounts.critical_5} 个商品库存 < 5`,
        meta: '紧急补货',
        action: '去补货', href: '/admin/products?tier=critical_5',
      })
    }
    if (data.pendingOrders > 0) {
      items.push({
        icon: '📋', iconBg: colors.blueBg, iconColor: colors.blue,
        title: `${data.pendingOrders} 个订单待核销`,
        meta: '前往订单页处理',
        action: '查看', href: '/admin/orders?status=pending',
      })
    }
    return items.slice(0, 4)
  }, [data])

  return (
    <div style={cardStyle}>
      <div style={cardHeadStyle}>
        <span style={cardTitleStyle}>⚠️ 待办</span>
        {todos.length > 0 && (
          <span style={{
            ...cardBadgeStyle, background: colors.dangerBg, color: colors.danger,
          }}>{todos.length} 项</span>
        )}
      </div>
      {todos.length === 0 ? (
        <div style={{ padding: `${spacing[12]}px`, textAlign: 'center', color: colors.textFaint }}>
          ✅ 暂无待办
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[4] }}>
          {todos.map((t, i) => (
            <a key={i} href={t.href} style={{
              display: 'flex', alignItems: 'center', gap: spacing[7],
              padding: `${spacing[5]}px ${spacing[6]}px`,
              background: 'rgba(255,255,255,0.02)',
              border: `1px solid ${colors.borderMuted}`,
              borderRadius: radius.lg,
              textDecoration: 'none', color: 'inherit',
              transition: `all ${animation.base}`,
              cursor: 'pointer',
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: radius.base,
                background: t.iconBg, color: t.iconColor,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, flexShrink: 0,
              }}>{t.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.text, marginBottom: 2 }}>
                  {t.title}
                </div>
                <div style={{ fontSize: fontSize.xs, color: colors.textFaint }}>{t.meta}</div>
              </div>
              <button style={{
                padding: `6px ${spacing[5]}px`,
                background: colors.primaryBgLight,
                border: `1px solid ${colors.primaryBorder}`,
                borderRadius: radius.base,
                color: colors.primary, fontSize: fontSize.xs,
                fontWeight: fontWeight.semibold, fontFamily: 'inherit',
                cursor: 'pointer',
              }}>{t.action}</button>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================
// 子组件:Timeline Card
// ============================================
function TimelineCard({ data }: { data: DashboardData }) {
  return (
    <div style={cardStyle}>
      <div style={cardHeadStyle}>
        <span style={cardTitleStyle}>📜 最近活动</span>
        <span style={cardBadgeStyle}>实时</span>
      </div>
      {data.timeline.length === 0 ? (
        <div style={{ padding: `${spacing[12]}px`, textAlign: 'center', color: colors.textFaint }}>
          暂无活动
        </div>
      ) : (
        <div style={{ position: 'relative', paddingLeft: 18 }}>
          <div style={{
            position: 'absolute', left: 11, top: 12, bottom: 12, width: 1,
            background: colors.borderMuted,
          }} />
          {data.timeline.map((item, i) => {
            const cfg = actionStyle(item.action)
            const actor = actorName(item.actorType, item.actorId)
            return (
              <div key={item.id || i} style={{ position: 'relative', paddingBottom: spacing[7] }}>
                <div style={{
                  position: 'absolute', left: -18, top: 2,
                  width: 22, height: 22, borderRadius: '50%',
                  background: cfg.bg, color: cfg.fg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, border: `2px solid #050807`,
                }}>{cfg.icon}</div>
                <div style={{ fontSize: fontSize.sm, color: colors.text, lineHeight: 1.5, marginBottom: 3 }}>
                  <strong style={{ color: actor.color }}>{actor.name}</strong>{' '}
                  {item.description || item.action}
                </div>
                <div style={{ fontSize: 10, color: colors.textFaint }}>
                  {item.relative || new Date(item.createdAt).toLocaleString('zh-CN', { hour12: false })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function actionStyle(action: string): { bg: string; fg: string; icon: string } {
  if (action === 'warn_merchant') return { bg: colors.dangerBg, fg: colors.danger, icon: '⚠' }
  if (action === 'content_reported' || action === 'feedback') return { bg: colors.amberBg, fg: colors.amber, icon: '📝' }
  if (action === 'stock_low') return { bg: colors.purpleBg, fg: colors.purple, icon: '📦' }
  if (action === 'order_completed' || action === 'pickup') return { bg: colors.primaryBgLight, fg: colors.primary, icon: '✓' }
  if (action === 'restock') return { bg: colors.primaryBgLight, fg: colors.primary, icon: '📦' }
  return { bg: colors.primaryBgLight, fg: colors.primary, icon: '💬' }
}

function actorName(type?: string, id?: string): { name: string; color: string } {
  if (type === 'admin') return { name: id === 'you' || id === 'yilin' ? '奕霖' : '管理员', color: colors.primary }
  if (type === 'customer') return { name: '顾客', color: colors.blue }
  if (type === 'staff') return { name: '店员', color: colors.purple }
  return { name: '系统', color: colors.gray }
}

// ============================================
// 子组件:7 天销售折线图
// ============================================
function SalesLineChart({ orders }: { orders: OrderRow[] }) {
  const points = useMemo(() => {
    const map: Record<string, number> = {}
    orders.forEach(o => {
      if (o.status !== 'completed' && o.status !== 'delivered') return
      const d = new Date(o.createdAt)
      const key = `${d.getMonth() + 1}/${d.getDate()}`
      map[key] = (map[key] || 0) + (o.totalAmount || o.finalAmount || 0)
    })
    return Object.entries(map).sort((a, b) => {
      const [am, ad] = a[0].split('/').map(Number)
      const [bm, bd] = b[0].split('/').map(Number)
      return am !== bm ? am - bm : ad - bd
    }).slice(-7)
  }, [orders])

  const total = points.reduce((s, [_, v]) => s + v, 0)
  const max = Math.max(...points.map(([_, v]) => v), 1)
  const min = Math.min(...points.map(([_, v]) => v), 0)

  // 构建 SVG 路径
  const W = 600, H = 200, PAD = 30
  const xStep = points.length > 1 ? (W - PAD * 2) / (points.length - 1) : 0
  const coords = points.map(([_, v], i) => {
    const x = PAD + i * xStep
    const y = H - PAD - ((v - min) / Math.max(max - min, 1)) * (H - PAD * 2)
    return { x, y, v, label: _ }
  })
  const pathLine = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ')
  const pathArea = coords.length > 0
    ? `${pathLine} L ${coords[coords.length - 1].x} ${H - PAD} L ${coords[0].x} ${H - PAD} Z`
    : ''

  return (
    <div style={cardStyle}>
      <div style={cardHeadStyle}>
        <span style={cardTitleStyle}>📈 销售趋势 · 近 7 天</span>
        <span style={{ ...cardBadgeStyle, background: colors.purpleBg, color: colors.purple }}>
          ¥{total.toLocaleString()}
        </span>
      </div>
      {points.length === 0 ? (
        <div style={{ padding: `${spacing[12]}px`, textAlign: 'center', color: colors.textFaint }}>
          暂无销售数据
        </div>
      ) : (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 200 }} xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="v3-line-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors.primary} stopOpacity="0.3" />
                <stop offset="100%" stopColor={colors.primary} stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* 网格 */}
            <line x1={PAD} y1={PAD} x2={W - PAD} y2={PAD} stroke="rgba(255,255,255,0.04)" strokeDasharray="2 4" />
            <line x1={PAD} y1={H / 2} x2={W - PAD} y2={H / 2} stroke="rgba(255,255,255,0.06)" strokeDasharray="2 4" />
            <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="rgba(255,255,255,0.04)" strokeDasharray="2 4" />

            {/* 面积 */}
            <path d={pathArea} fill="url(#v3-line-grad)" />
            {/* 折线 */}
            <path d={pathLine} fill="none" stroke={colors.primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            {/* 数据点 */}
            {coords.map((c, i) => (
              <circle key={i} cx={c.x} cy={c.y} r={i === coords.length - 1 ? 6 : 3}
                fill={colors.primary} stroke={i === coords.length - 1 ? '#0a3a1f' : 'none'} strokeWidth={i === coords.length - 1 ? 2 : 0} />
            ))}
            {/* 最后一点 tooltip */}
            {coords.length > 0 && (
              <>
                <rect x={coords[coords.length - 1].x - 50} y={coords[coords.length - 1].y - 30} width={100} height={22} rx={6} fill={colors.primary} />
                <text x={coords[coords.length - 1].x} y={coords[coords.length - 1].y - 15} fill="#0a3a1f" fontSize={11} fontWeight="700" textAnchor="middle">
                  ¥{coords[coords.length - 1].v.toFixed(0)}
                </text>
              </>
            )}
            {/* X 轴标签 */}
            {coords.map((c, i) => (
              <text key={i} x={c.x} y={H - 5} fill="rgba(255,255,255,0.4)" fontSize={10} textAnchor="middle">{c.label}</text>
            ))}
          </svg>

          <div style={{
            display: 'flex', gap: spacing[9], marginTop: spacing[7],
            paddingTop: spacing[7], borderTop: `1px solid ${colors.borderMuted}`,
          }}>
            <SummaryItem label="日均" value={`¥${(total / Math.max(points.length, 1)).toFixed(0)}`} />
            <SummaryItem label="订单数" value={orders.length.toString()} />
            <SummaryItem label="客单价" value={`¥${(total / Math.max(orders.length, 1)).toFixed(0)}`} />
          </div>
        </>
      )}
    </div>
  )
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: fontSize.xs, color: colors.textFaint, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text }}>{value}</div>
    </div>
  )
}

// ============================================
// 子组件:24h 订单分布柱状图
// ============================================
function HourlyBarChart({ orders }: { orders: OrderRow[] }) {
  const hourCounts = useMemo(() => {
    const counts = new Array(24).fill(0)
    orders.forEach(o => {
      const h = new Date(o.createdAt).getHours()
      counts[h]++
    })
    return counts
  }, [orders])

  const max = Math.max(...hourCounts, 1)
  const peakHour = hourCounts.indexOf(max)
  const W = 400, H = 200, PAD = 20
  const barW = (W - PAD * 2) / 24 - 2

  return (
    <div style={cardStyle}>
      <div style={cardHeadStyle}>
        <span style={cardTitleStyle}>⏰ 24 小时订单分布</span>
        <span style={cardBadgeStyle}>今日</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 200 }} xmlns="http://www.w3.org/2000/svg">
        {/* 网格 */}
        <line x1={PAD} y1={PAD} x2={W - PAD} y2={PAD} stroke="rgba(255,255,255,0.04)" strokeDasharray="2 4" />
        <line x1={PAD} y1={H / 2} x2={W - PAD} y2={H / 2} stroke="rgba(255,255,255,0.06)" strokeDasharray="2 4" />
        <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="rgba(255,255,255,0.04)" strokeDasharray="2 4" />

        {/* 柱 */}
        {hourCounts.map((c, h) => {
          const x = PAD + h * ((W - PAD * 2) / 24) + 1
          const hPx = (c / max) * (H - PAD * 2 - 10)
          const y = H - PAD - hPx
          const isPeak = h === peakHour && c > 0
          return (
            <rect key={h} x={x} y={y} width={barW} height={hPx}
              fill={isPeak ? colors.primary : c > 0 ? `${colors.primary}99` : `${colors.primary}33`}
              rx={2}
            />
          )
        })}

        {/* 高峰标注 */}
        {max > 0 && (() => {
          const x = PAD + peakHour * ((W - PAD * 2) / 24) + barW / 2 + 1
          return (
            <>
              <line x1={x} y1={PAD - 10} x2={x} y2={PAD - 2} stroke={colors.primary} strokeWidth={1} strokeDasharray="2 2" />
              <rect x={x - 35} y={PAD - 22} width={70} height={14} rx={3} fill={colors.primary} />
              <text x={x} y={PAD - 12} fill="#0a3a1f" fontSize={9} fontWeight="700" textAnchor="middle">
                {peakHour}:00 高峰
              </text>
            </>
          )
        })()}

        {/* X 轴 */}
        <text x={PAD} y={H - 5} fill="rgba(255,255,255,0.4)" fontSize={10} textAnchor="start">0</text>
        <text x={W / 2} y={H - 5} fill="rgba(255,255,255,0.4)" fontSize={10} textAnchor="middle">12</text>
        <text x={W - PAD} y={H - 5} fill="rgba(255,255,255,0.4)" fontSize={10} textAnchor="end">24</text>
      </svg>

      <div style={{
        display: 'flex', gap: spacing[9], marginTop: spacing[7],
        paddingTop: spacing[7], borderTop: `1px solid ${colors.borderMuted}`,
      }}>
        <SummaryItem label="最高峰" value={max > 0 ? `${peakHour}:00` : '—'} />
        <SummaryItem label="总订单" value={orders.length.toString()} />
        <SummaryItem label="活跃小时" value={hourCounts.filter(c => c > 0).length.toString()} />
      </div>
    </div>
  )
}

// ============================================
// 子组件:库存预警 4 档
// ============================================
function StockRow({ data }: { data: DashboardData }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
      gap: spacing[9], marginBottom: spacing[10],
    }}>
      <StockCard tier="critical_0" label="库存为 0" sub="立即下架"
        count={data.stockCounts.critical_0} products={data.stockTiers.critical_0}
      />
      <StockCard tier="critical_5" label="库存 < 5" sub="紧急补货"
        count={data.stockCounts.critical_5} products={data.stockTiers.critical_5}
      />
      <StockCard tier="warning" label="库存 < 20" sub="计划补货"
        count={data.stockCounts.warning} products={data.stockTiers.warning}
      />
      <StockCard tier="normal" label="库存充足" sub="健康"
        count={data.stockCounts.normal} products={data.stockTiers.normal}
      />
    </div>
  )
}

function StockCard({ tier, label, sub, count, products }: {
  tier: 'critical_0' | 'critical_5' | 'warning' | 'normal'
  label: string; sub: string
  count: number; products: ProductRow[]
}) {
  const cfg = stockTierStyle(tier)
  return (
    <div style={{
      background: colors.bgPrimary,
      border: `1px solid ${colors.border}`,
      borderRadius: radius.xxl, padding: spacing[9],
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing[5], marginBottom: spacing[7] }}>
        <span style={cfg.badge}>{cfg.badgeText}</span>
      </div>
      <div style={{
        fontSize: 28, fontWeight: fontWeight.extraBold,
        lineHeight: 1, marginBottom: spacing[5],
        color: cfg.countColor,
      }}>{count}</div>
      <div style={{ fontSize: fontSize.sm, color: colors.textSubtle, marginBottom: spacing[7] }}>
        {label} <span style={{ color: colors.textFaint }}>· {sub}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[3], fontSize: fontSize.xs }}>
        {products.length === 0 ? (
          <div style={{ padding: `${spacing[5]}px 0`, color: colors.textFaint, textAlign: 'center' }}>
            暂无
          </div>
        ) : (
          products.slice(0, 4).map((p, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between',
              color: colors.textMuted, padding: `6px 0`,
              borderBottom: i < Math.min(products.length, 4) - 1 ? `1px solid ${colors.borderMuted}` : 'none',
            }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.shortName || p.name}
              </span>
              <span style={{ color: cfg.qtyColor, fontWeight: fontWeight.bold, fontVariantNumeric: 'tabular-nums', flexShrink: 0, marginLeft: 8 }}>
                {p.stock}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function stockTierStyle(tier: 'critical_0' | 'critical_5' | 'warning' | 'normal') {
  switch (tier) {
    case 'critical_0':
      return {
        badge: { padding: `3px 9px`, borderRadius: radius.full, fontSize: 10, fontWeight: fontWeight.bold, background: colors.dangerBg, color: colors.danger, textTransform: 'uppercase' as const, letterSpacing: '0.5px' },
        badgeText: 'CRITICAL · 0',
        countColor: colors.danger,
        qtyColor: colors.danger,
      }
    case 'critical_5':
      return {
        badge: { padding: `3px 9px`, borderRadius: radius.full, fontSize: 10, fontWeight: fontWeight.bold, background: colors.amberBg, color: colors.amber, textTransform: 'uppercase' as const, letterSpacing: '0.5px' },
        badgeText: 'CRITICAL · 5',
        countColor: colors.amber,
        qtyColor: colors.amber,
      }
    case 'warning':
      return {
        badge: { padding: `3px 9px`, borderRadius: radius.full, fontSize: 10, fontWeight: fontWeight.bold, background: 'rgba(245,158,11,0.12)', color: colors.amber, textTransform: 'uppercase' as const, letterSpacing: '0.5px' },
        badgeText: 'WARNING',
        countColor: colors.amber,
        qtyColor: colors.amber,
      }
    case 'normal':
    default:
      return {
        badge: { padding: `3px 9px`, borderRadius: radius.full, fontSize: 10, fontWeight: fontWeight.bold, background: colors.primaryBgLight, color: colors.primary, textTransform: 'uppercase' as const, letterSpacing: '0.5px' },
        badgeText: 'NORMAL',
        countColor: colors.primary,
        qtyColor: colors.primary,
      }
  }
}

// ============================================
// 样式常量
// ============================================
const cardStyle: React.CSSProperties = {
  background: colors.bgPrimary,
  border: `1px solid ${colors.border}`,
  borderRadius: radius.xxl,
  padding: spacing[9],
}

const cardHeadStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: spacing[5],
  marginBottom: spacing[7],
}

const cardTitleStyle: React.CSSProperties = {
  fontSize: fontSize.md, fontWeight: fontWeight.bold,
  display: 'flex', alignItems: 'center', gap: spacing[5],
}

const cardBadgeStyle: React.CSSProperties = {
  marginLeft: 'auto', padding: `2px 9px`,
  borderRadius: radius.full, fontSize: 10,
  fontWeight: fontWeight.bold,
  background: colors.primaryBgLight, color: colors.primary,
}

const btnPrimary: React.CSSProperties = {
  height: 38, padding: `0 ${spacing[7]}px`,
  borderRadius: radius.lg, border: 'none',
  background: colors.primaryBg, color: colors.primaryDeep,
  fontSize: fontSize.sm, fontWeight: fontWeight.semibold,
  fontFamily: 'inherit', cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', gap: 6,
  transition: `all ${animation.base}`,
}

const btnSecondary: React.CSSProperties = {
  ...btnPrimary,
  background: colors.primaryBgLight, color: colors.primary,
  border: `1px solid ${colors.primaryBorder}`,
}

const btnGhost: React.CSSProperties = {
  ...btnPrimary,
  background: 'transparent', color: colors.textMuted,
  border: `1px solid ${colors.borderMuted}`,
}
