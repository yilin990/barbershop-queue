'use client'

/**
 * /orders - 我的订单页
 * - v0.8.64 重构：4 张统计卡 + 搜索 + 状态筛选 + 复用 OrderCard
 * - v1.1.7 升级：合并零售订单 + barber 预约/取号
 * - v1.1.8 升级：软登录 + 全模块通用
 * - v1.1.9 升级：去墨绿残留 + 字体清晰加粗
 * - v1.1.10 升级（2026-10-05 01:35）：整体排版升级 + 累计消费摘要 + section divider + 加大间距
 */

import { useEffect, useMemo, useState } from 'react'
import AppLayout from '@/components/AppLayout'
import OrderCard from '@/components/OrderCard'
import { type OrderCardData } from '@/domain/chat/service'
import { colors, fontSize, fontWeight, radius, spacing } from '@/lib/design-tokens'
import { useUserStore } from '@/stores/userStore'
import { useRouter } from 'next/navigation'
import LoginModal from '@/components/LoginModal'

type Label = { text: string; color: string; bg: string }

// ⭐ v1.1.12 奕霖立：scheduledDate ('today'/'tomorrow'/'dayAfter' word) 转实际 YYYY-MM-DD
// ⭐ 必须用 Asia/Shanghai 时区，不能用 toISOString()（UTC 会晚 8 小时）— 上轮 bug：上海凌晨 0-8 点 toISOString() 返回昨天，tomorrow 永远少 1 天
function dateKeyToActual(key: string | undefined): string {
  // 用 sv-SE locale + asia/Shanghai timezone → 输出 "YYYY-MM-DD" 格式（上海本地日期）
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' })
  if (key === 'today') return today
  if (key === 'tomorrow') {
    const d = new Date(today + 'T00:00:00Z')
    d.setUTCDate(d.getUTCDate() + 1)
    return d.toISOString().slice(0, 10)
  }
  if (key === 'dayAfter') {
    const d = new Date(today + 'T00:00:00Z')
    d.setUTCDate(d.getUTCDate() + 2)
    return d.toISOString().slice(0, 10)
  }
  // 已经是 YYYY-MM-DD 格式则原样返回
  return key || today
}

function buildLabels(o: OrderCardData & { source?: string }): Label[] {
  const labels: Label[] = []
  const today = new Date().toISOString().slice(0, 10)
  const orderDate = (o.createdAt || '').slice(0, 10)
  if (orderDate === today && o.status === 'pending') {
    labels.push({ text: '🆕 今日新单', color: '#b91c1c', bg: 'rgba(254, 226, 226, 0.6)' })
  }
  if (o.source && o.source !== 'normal') {
    let srcLabel = '📦 ' + o.source
    if (o.source === 'flash_sale') srcLabel = '⚡ 限时特价'
    else if (o.source === 'group_buy') srcLabel = '👥 拼团'
    else if (o.source === 'activity') srcLabel = '🎁 活动'
    labels.push({ text: srcLabel, color: '#a78bfa', bg: 'rgba(167, 139, 250, 0.15)' })
  }
  if ((o.finalAmount || 0) >= 100) {
    labels.push({ text: '💎 大单', color: '#b91c1c', bg: 'rgba(254, 226, 226, 0.6)' })
  }
  return labels
}

export default function OrdersPage() {
  const router = useRouter()
  const { user, token, isLoggedIn } = useUserStore()
  const phone = user?.phone || ''
  const [orders, setOrders] = useState<OrderCardData[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'delivered' | 'cancelled'>('all')
  // ⭐ v1.1.18 奕霖立：预约 vs 商品分类过滤（独立于状态过滤，可叠加）
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'booking' | 'product'>('all')
  const [search, setSearch] = useState('')
  const [showLoginModal, setShowLoginModal] = useState(false)

  // ⭐ 奕霖 2026-09-06 22:51 升级: 未登录 → 弹 LoginModal (而不是静态提示), 不调 API 不查别人订单
  // ⭐ 2026-10-05 01:27 奕霖升级：只看 phone，不看 isLoggedIn（已登录的账号全模块通用，/orders 不再单独登录）
  useEffect(() => {
    let cancelled = false
    if (!phone) {
      setOrders([])
      setLoading(false)
      setShowLoginModal(true)
      return
    }
    setShowLoginModal(false)
    ;(async () => {
      try {
        // ⭐ 2026-10-05 01:06 奕霖立：合并零售订单 + barber 预约/取号
        const [ordersRes, queuesRes] = await Promise.all([
          fetch(`/api/orders?phone=${encodeURIComponent(phone)}&limit=50`, {
            credentials: 'include',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          }),
          fetch(`/api/queues?phone=${encodeURIComponent(phone)}&limit=50`, { cache: 'no-store' }),
        ])
        const [ordersData, queuesData] = await Promise.all([ordersRes.json(), queuesRes.json()])
        if (!cancelled) {
          // 零售订单
          const retailList: OrderCardData[] = (ordersData.orders || []).map((o: any) => ({
            type: 'order' as const,
            orderId: o.id || o.orderNo,
            orderNo: o.orderNo,
            status: (o.status === 'completed' ? 'delivered' : o.status) as OrderCardData['status'],
            statusLabel: o.status || '',
            pickupCode: o.pickupCode || undefined,
            finalAmount: o.finalAmount ?? o.totalAmount ?? 0,
            itemCount: o.itemCount ?? 0,
            itemSummary: o.itemSummary || `${o.itemCount || 0} 件商品`,
            createdAt: o.createdAt || '',
            source: (o.source || 'normal') as OrderCardData['source'],  // ⭐ v1.1.17：零售订单 source
          }))
          // ⭐ barber 预约/取号（映射 status: reserved→pending, completed→delivered, cancelled→cancelled）
          const barberStatusMap: Record<string, { s: OrderCardData['status']; label: string }> = {
            reserved: { s: 'pending', label: '已预约' },
            arrived: { s: 'pending', label: '已到店' },
            serving: { s: 'pending', label: '服务中' },
            completed: { s: 'delivered', label: '已完成' },
            cancelled: { s: 'cancelled', label: '已取消' },
            no_show: { s: 'cancelled', label: '未到店' },
          }
          const barberList: OrderCardData[] = (queuesData.queues || []).map((q: any) => {
            const m = barberStatusMap[q.status] || { s: 'pending' as const, label: q.status }
            // ⭐ v1.1.11 奕霖立：数据打通 — 所有字段从 q 真实读取，fallback 优雅
            const actualDate = dateKeyToActual(q.scheduledDate)
            const timeStr = q.scheduledAt || ''
            const serviceName = q.service || '理发服务'
            const stylistName = q.stylistName || '待分配理发师'
            return {
              type: 'order' as const,
              orderId: q.id,
              orderNo: q.orderNo,
              status: m.s,
              statusLabel: m.label,
              pickupCode: q.pickupCode || undefined,
              finalAmount: q.finalAmount ?? 0,
              itemCount: 1,
              itemSummary: `${serviceName} · ${stylistName} · ${actualDate} ${timeStr}`.trim(),
              createdAt: q.createdAt || '',
              // ⭐ v1.1.11：加 4 个结构化字段，让卡牌展示具体项目 + 理发师 + 真日期
              serviceName,
              stylistName,
              scheduledDate: actualDate,
              scheduledTime: timeStr,
              source: (q.type === 'ticket' ? 'ticket' : 'booking') as OrderCardData['source'],  // ⭐ v1.1.17：预约 vs 取号
            }
          })
          // ⭐ v1.1.19 奕霖立：dedupe by orderNo（预约双写导致同 orderNo 出现 2 次）
          // barberList 覆盖 retailList（barberList 有 service/stylist/scheduledDate 结构化信息）
          const orderMap = new Map<string, OrderCardData>()
          for (const o of retailList) orderMap.set(o.orderNo, o)
          for (const o of barberList) orderMap.set(o.orderNo, o)  // barberList 覆盖
          const allList = Array.from(orderMap.values()).sort((a, b) =>
            (b.createdAt || '').localeCompare(a.createdAt || '')
          )
          setOrders(allList as any)
        }
      } catch (e) {
        if (!cancelled) setOrders([])
      }
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
    // ⭐ 2026-10-05 01:28 奕霖修复：deps 加 phone，Zustand rehydrate 后 useEffect 重跑（之前 [] 永远只跑一次，hydrate 后 modal 关不掉）
  }, [phone])

  const stats = useMemo(() => ({
    all: orders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    delivered: orders.filter(o => o.status === 'delivered').length,
    cancelled: orders.filter(o => o.status === 'cancelled').length,
  }), [orders])

  // ⭐ v1.1.10 奕霖立：累计消费金额（只算已完成的 retail 订单，barber 暂不计）
  const totalSpent = useMemo(() =>
    orders
      .filter(o => o.status === 'delivered' && (o.finalAmount || 0) > 0)
      .reduce((sum, o) => sum + (o.finalAmount || 0), 0),
    [orders]
  )

  // ⭐ v1.1.18 奕霖立：分类统计（预约 vs 商品）
  const categoryStats = useMemo(() => ({
    booking: orders.filter(o => o.source === 'booking' || o.source === 'ticket').length,
    product: orders.filter(o => !o.source || o.source === 'normal' || o.source === 'pos-store' || o.source === 'flash_sale' || o.source === 'group' || o.source === 'activity').length,
  }), [orders])

  const filtered = useMemo(() => {
    // 第一层：状态过滤
    let list = filter === 'all' ? orders : orders.filter(o => o.status === filter)
    // ⭐ v1.1.18 第二层：分类过滤（预约 vs 商品）
    if (categoryFilter !== 'all') {
      if (categoryFilter === 'booking') {
        list = list.filter(o => o.source === 'booking' || o.source === 'ticket')
      } else if (categoryFilter === 'product') {
        list = list.filter(o => !o.source || o.source === 'normal' || o.source === 'pos-store' || o.source === 'flash_sale' || o.source === 'group' || o.source === 'activity')
      }
    }
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(o =>
        o.orderNo.toLowerCase().includes(q) ||
        (o.pickupCode || '').toLowerCase().includes(q)
      )
    }
    return list
  }, [orders, filter, categoryFilter, search])

  const filterLabel = (() => {
    const statusPart = filter === 'all' ? '全部' : filter === 'pending' ? '待核销' : filter === 'delivered' ? '已完成' : '已取消'
    const categoryPart = categoryFilter === 'booking' ? '预约' : categoryFilter === 'product' ? '商品' : ''
    if (categoryPart) return `${categoryPart} · ${statusPart}`
    return statusPart === '全部' ? '全部订单' : `已筛选 · ${statusPart}`
  })()

  return (
    <AppLayout title="我的订单" activePath="/orders">
      <div style={{ padding: `${spacing[5]} ${spacing[4]}`, maxWidth: 800, margin: '0 auto' }}>
        {/* ⭐ v1.1.10 奕霖升级：标题区加大间距 + 累计消费摘要行 */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{
            color: '#2c1810',
            fontSize: 24,
            fontWeight: 800,
            margin: 0,
            letterSpacing: '0.5px',
          }}>
            📦 我的订单
          </h1>
          <p style={{
            color: 'rgba(44, 24, 16, 0.7)',
            fontSize: 14,
            fontWeight: 500,
            margin: `${spacing[3]} 0 0`,
          }}>
            共 <span style={{ color: '#b91c1c', fontWeight: 700 }}>{orders.length}</span> 单 · 待核销 <span style={{ color: '#b91c1c', fontWeight: 700 }}>{stats.pending}</span>
            {totalSpent > 0 && (
              <> · 累计消费 <span style={{ color: '#b91c1c', fontWeight: 700 }}>¥{totalSpent.toFixed(2)}</span></>
            )}
          </p>
        </div>

        {/* ⭐ v1.1.10 奕霖升级：StatCards 间距加大 (8→12) + marginBottom 加大 (10→24) + 全部用深红家族 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
          marginBottom: 24,
        }}>
          <StatCard label="全部" value={stats.all} color="#2c1810" active={filter === 'all'} onClick={() => setFilter('all')} />
          <StatCard label="待核销" value={stats.pending} color="#b45309" active={filter === 'pending'} onClick={() => setFilter('pending')} />
          <StatCard label="已完成" value={stats.delivered} color="#b91c1c" active={filter === 'delivered'} onClick={() => setFilter('delivered')} />
          <StatCard label="已取消" value={stats.cancelled} color="rgba(44, 24, 16, 0.5)" active={filter === 'cancelled'} onClick={() => setFilter('cancelled')} />
        </div>

        {/* ⭐ v1.1.18 奕霖立：预约 vs 商品 分类 Tab（独立维度，可与状态叠加） */}
        <div style={{
          display: 'flex', gap: 10, marginBottom: 16,
          flexWrap: 'wrap',
        }}>
          <CategoryChip
            label="📦 全部"
            count={orders.length}
            active={categoryFilter === 'all'}
            onClick={() => setCategoryFilter('all')}
          />
          <CategoryChip
            label="📅 预约"
            count={categoryStats.booking}
            active={categoryFilter === 'booking'}
            onClick={() => setCategoryFilter('booking')}
          />
          <CategoryChip
            label="🛍️ 商品"
            count={categoryStats.product}
            active={categoryFilter === 'product'}
            onClick={() => setCategoryFilter('product')}
          />
        </div>

        {/* ⭐ v1.1.10 奕霖升级：分隔线 + 区段标签（仅当有订单时显示） */}
        {orders.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            marginBottom: 16,
          }}>
            <div style={{
              fontSize: 13, fontWeight: 700,
              color: 'rgba(44, 24, 16, 0.7)',
              letterSpacing: '1px',
            }}>
              {filterLabel}
              <span style={{ marginLeft: 6, color: '#b91c1c' }}>· {filtered.length}</span>
            </div>
            <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(185, 28, 28, 0.2) 0%, transparent 100%)' }} />
          </div>
        )}

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 搜订单号 / 取货码"
          style={{
            width: '100%',
            padding: `12px 16px`,
            background: 'rgba(255, 255, 255, 0.85)',
            border: '1.5px solid rgba(185, 28, 28, 0.2)',
            borderRadius: 12,
            color: '#2c1810',
            fontSize: 15,
            fontWeight: 500,
            outline: 'none',
            boxSizing: 'border-box',
            marginBottom: 20,
            boxShadow: '0 2px 8px rgba(185, 28, 28, 0.04)',
          }}
        />

        {loading ? (
          <div style={{
            textAlign: 'center',
            padding: spacing[6],
            color: 'rgba(44, 24, 16, 0.75)',
            fontSize: 14,
            fontWeight: 500,
          }}>
            加载中...
          </div>
        ) : !isLoggedIn || !phone ? (
          <div style={{
            textAlign: 'center', padding: spacing[8],
            color: 'rgba(44, 24, 16, 0.75)', fontSize: 14, fontWeight: 500,
          }}>
            请先登录后查看订单
          </div>
        ) : filtered.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: spacing[6],
            color: 'rgba(44, 24, 16, 0.75)',
            fontSize: 14,
            fontWeight: 500,
          }}>
            {search
              ? `没有匹配 "${search}" 的订单`
              : filter === 'all'
              ? '暂无订单'
              : `暂无${filter === 'pending' ? '待核销' : filter === 'delivered' ? '已完成' : '已取消'}的订单`}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {filtered.map((o, i) => {
              const labels = buildLabels(o as any)
              return (
                <div key={`${o.orderId}-${i}`} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {labels.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingLeft: 4 }}>
                      {labels.map((l, j) => (
                        <span key={j} style={{
                          padding: '4px 12px',
                          borderRadius: 10,
                          fontSize: 12,
                          fontWeight: 700,
                          color: l.color,
                          background: l.bg,
                          border: '1px solid ' + l.color + '40',
                        }}>
                          {l.text}
                        </span>
                      ))}
                    </div>
                  )}
                  <OrderCard data={o} />
                </div>
              )
            })}
          </div>
        )}
      </div>
      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </AppLayout>
  )
}

function StatCard({ label, value, color, active, onClick }: {
  label: string
  value: number
  color: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? 'rgba(185, 28, 28, 0.12)' : 'rgba(255, 255, 255, 0.75)',
        backdropFilter: 'blur(8px)',
        border: '1px solid ' + (active ? '#b91c1c' : 'rgba(185, 28, 28, 0.2)'),
        borderRadius: 12,
        padding: 12,
        cursor: 'pointer',
        textAlign: 'center',
        transition: 'all 0.2s',
        boxShadow: active
          ? '0 2px 8px rgba(185, 28, 28, 0.12)'
          : '0 2px 6px rgba(44, 24, 16, 0.04)',
      }}
    >
      <div style={{
        fontSize: 26,
        fontWeight: 800,
        color,
        lineHeight: 1.2,
      }}>
        {value}
      </div>
      <div style={{
        fontSize: 13,
        color: 'rgba(44, 24, 16, 0.7)',
        fontWeight: 500,
        marginTop: 4,
      }}>
        {label}
      </div>
    </button>
  )
}

// ⭐ v1.1.18 奕霖立：预约 vs 商品 分类 chip
function CategoryChip({ label, count, active, onClick }: {
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '8px 16px',
        borderRadius: 999,
        background: active
          ? 'linear-gradient(135deg, rgba(185, 28, 28, 0.18) 0%, rgba(185, 28, 28, 0.1) 100%)'
          : 'rgba(255, 255, 255, 0.75)',
        border: active
          ? '1.5px solid #b91c1c'
          : '1.5px solid rgba(185, 28, 28, 0.18)',
        cursor: 'pointer',
        transition: 'all 0.2s',
        boxShadow: active
          ? '0 2px 8px rgba(185, 28, 28, 0.18)'
          : '0 1px 3px rgba(44, 24, 16, 0.04)',
      }}
    >
      <span style={{
        fontSize: 14, fontWeight: 700,
        color: active ? '#b91c1c' : '#2c1810',
      }}>{label}</span>
      <span style={{
        padding: '1px 10px',
        borderRadius: 999,
        background: active ? '#b91c1c' : 'rgba(185, 28, 28, 0.12)',
        color: active ? '#fff' : '#b91c1c',
        fontSize: 12, fontWeight: 700,
        minWidth: 22,
        textAlign: 'center',
      }}>{count}</span>
    </button>
  )
}
