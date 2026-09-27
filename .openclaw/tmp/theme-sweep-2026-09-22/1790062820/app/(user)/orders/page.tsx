'use client'

/**
 * /orders - 我的订单页 (v0.8.64 重构)
 *
 * 设计：
 * - 4 张统计卡（全部/待核销/已完成/已取消）
 * - 搜索框（订单号 / 取货码）
 * - 状态筛选 chip
 * - 复用 OrderCard 组件
 * - 每个订单加标签：今日新单 / 限时特价 / 拼团 / 活动 / 大单
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

function buildLabels(o: OrderCardData & { source?: string }): Label[] {
  const labels: Label[] = []
  const today = new Date().toISOString().slice(0, 10)
  const orderDate = (o.createdAt || '').slice(0, 10)
  if (orderDate === today && o.status === 'pending') {
    labels.push({ text: '🆕 今日新单', color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.15)' })
  }
  if (o.source && o.source !== 'normal') {
    let srcLabel = '📦 ' + o.source
    if (o.source === 'flash_sale') srcLabel = '⚡ 限时特价'
    else if (o.source === 'group_buy') srcLabel = '👥 拼团'
    else if (o.source === 'activity') srcLabel = '🎁 活动'
    labels.push({ text: srcLabel, color: '#a78bfa', bg: 'rgba(167, 139, 250, 0.15)' })
  }
  if ((o.finalAmount || 0) >= 100) {
    labels.push({ text: '💎 大单', color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.12)' })
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
  const [search, setSearch] = useState('')
  const [showLoginModal, setShowLoginModal] = useState(false)

  // ⭐ 奕霖 2026-09-06 22:51 升级: 未登录 → 弹 LoginModal (而不是静态提示), 不调 API 不查别人订单
  useEffect(() => {
    let cancelled = false
    if (!isLoggedIn || !phone) {
      setOrders([])
      setLoading(false)
      setShowLoginModal(true)
      return
    }
    setShowLoginModal(false)
    ;(async () => {
      try {
        const r = await fetch(`/api/orders?phone=${encodeURIComponent(phone)}&limit=50`, {
          credentials: 'include',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        const d = await r.json()
        if (!cancelled) {
          const list: OrderCardData[] = (d.orders || []).map((o: any) => ({
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
          }))
          setOrders(list as any)
        }
      } catch (e) {
        if (!cancelled) setOrders([])
      }
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  const stats = useMemo(() => ({
    all: orders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    delivered: orders.filter(o => o.status === 'delivered').length,
    cancelled: orders.filter(o => o.status === 'cancelled').length,
  }), [orders])

  const filtered = useMemo(() => {
    let list = filter === 'all' ? orders : orders.filter(o => o.status === filter)
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(o =>
        o.orderNo.toLowerCase().includes(q) ||
        (o.pickupCode || '').toLowerCase().includes(q)
      )
    }
    return list
  }, [orders, filter, search])

  return (
    <AppLayout title="我的订单" activePath="/orders">
      <div style={{ padding: spacing[4], maxWidth: 800, margin: '0 auto' }}>
        <div style={{ marginBottom: spacing[4] }}>
          <h1 style={{
            color: colors.text,
            fontSize: fontSize.xl,
            fontWeight: fontWeight.bold,
            margin: 0,
          }}>
            📦 我的订单
          </h1>
          <p style={{
            color: colors.textMuted,
            fontSize: fontSize.sm,
            margin: `${spacing[2]} 0 0`,
          }}>
            共 {orders.length} 单 · 待核销 {stats.pending}
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: spacing[3],
          marginBottom: spacing[4],
        }}>
          <StatCard label="全部" value={stats.all} color={colors.text} active={filter === 'all'} onClick={() => setFilter('all')} />
          <StatCard label="待核销" value={stats.pending} color="#ffaa3b" active={filter === 'pending'} onClick={() => setFilter('pending')} />
          <StatCard label="已完成" value={stats.delivered} color="#fbbf24" active={filter === 'delivered'} onClick={() => setFilter('delivered')} />
          <StatCard label="已取消" value={stats.cancelled} color={colors.textMuted} active={filter === 'cancelled'} onClick={() => setFilter('cancelled')} />
        </div>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 搜订单号 / 取货码"
          style={{
            width: '100%',
            padding: `${spacing[3]} ${spacing[4]}`,
            background: 'rgba(13, 25, 20, 0.55)',
            border: `1px solid ${colors.border}`,
            borderRadius: radius.md,
            color: colors.text,
            fontSize: fontSize.base,
            outline: 'none',
            boxSizing: 'border-box',
            marginBottom: spacing[4],
          }}
        />

        {loading ? (
          <div style={{
            textAlign: 'center',
            padding: spacing[6],
            color: colors.textMuted,
            fontSize: fontSize.sm,
          }}>
            加载中...
          </div>
        ) : !isLoggedIn || !phone ? (
          <div style={{
            textAlign: 'center', padding: spacing[8],
            color: colors.textMuted, fontSize: fontSize.sm,
          }}>
            请先登录后查看订单
          </div>
        ) : filtered.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: spacing[6],
            color: colors.textMuted,
            fontSize: fontSize.sm,
          }}>
            {search
              ? `没有匹配 "${search}" 的订单`
              : filter === 'all'
              ? '暂无订单'
              : `暂无${filter === 'pending' ? '待核销' : filter === 'delivered' ? '已完成' : '已取消'}的订单`}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[3] }}>
            {filtered.map((o, i) => {
              const labels = buildLabels(o as any)
              return (
                <div key={`${o.orderId}-${i}`} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {labels.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingLeft: 4 }}>
                      {labels.map((l, j) => (
                        <span key={j} style={{
                          padding: '3px 10px',
                          borderRadius: 10,
                          fontSize: 11,
                          fontWeight: 600,
                          color: l.color,
                          background: l.bg,
                          border: '1px solid ' + l.color + '30',
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
        background: active ? 'rgba(127, 220, 148, 0.18)' : 'rgba(13, 25, 20, 0.55)',
        backdropFilter: 'blur(8px)',
        border: '1px solid ' + (active ? '#fbbf24' : 'rgba(127, 220, 148, 0.15)'),
        borderRadius: radius.lg,
        padding: spacing[3],
        cursor: 'pointer',
        textAlign: 'center',
        transition: 'all 0.2s',
      }}
    >
      <div style={{
        fontSize: fontSize.xxl,
        fontWeight: fontWeight.bold,
        color,
        lineHeight: 1,
      }}>
        {value}
      </div>
      <div style={{
        fontSize: fontSize.xs,
        color: colors.textMuted,
        marginTop: spacing[1],
      }}>
        {label}
      </div>
    </button>
  )
}
