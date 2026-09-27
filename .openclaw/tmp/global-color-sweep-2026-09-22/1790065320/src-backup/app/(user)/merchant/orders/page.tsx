'use client'

/**
 * /merchant/orders - 商户订单管理（店员 + 店主共用）
 * 2026-07-04 00:12 奕霖需求：
 *   - 商户的账号独立显示核销页（不再只藏在 /pickup）
 *   - 完整看/改/核销/退款
 *
 * 设计：
 *   - 默认显示"待核销"（picker 优先）
 *   - Tab 过滤：全部/待核销/已完成/已取消
 *   - 搜索：订单号 OR 手机号
 *   - 顶部固定"快速核销"入口 → /pickup
 *   - 行内快速核销按钮（status=pending 时显示）
 */

import { toast } from '@/lib/ui-bus'
import { confirmDialog } from '@/lib/ui-bus'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/AppLayout'
import StaffGate from '@/components/StaffGate'

const GREEN = '#b8860b'
const ORANGE = '#ffa500'
const GREEN_RGBA = '184, 134, 11'
const CARD_BG = 'linear-gradient(180deg, rgba(44, 24, 16, 0.6) 0%, rgba(58, 36, 22, 0.8) 100%)'

const MERCHANT_CODE = 'G0001'

type OrderStatus = 'pending' | 'paid' | 'preparing' | 'ready' | 'delivered' | 'cancelled' | 'refunded'

interface OrderItem {
  id: string
  productName: string
  productSpec?: string | null
  price: number
  quantity: number
  subtotal: number
}

interface Order {
  id: string
  orderNo: string
  status: OrderStatus
  finalAmount: number
  totalAmount: number
  deliveryType: 'pickup' | 'delivery'
  deliveryPhone?: string | null
  deliveryAddress?: string | null
  pickupCode?: string | null
  pickupExpiresAt?: string | null
  pickedUpAt?: string | null
  createdAt: string
  remark?: string | null
  items: OrderItem[]
}

const STATUS_LABELS: Record<OrderStatus, { label: string; color: string }> = {
  pending:    { label: '待核销', color: ORANGE },
  paid:       { label: '已付款', color: '#5cb8ff' },
  preparing:  { label: '备货中', color: '#5cb8ff' },
  ready:      { label: '待取货', color: ORANGE },
  delivered:  { label: '已完成', color: GREEN },
  cancelled:  { label: '已取消', color: '#888' },
  refunded:   { label: '已退款', color: '#ff6b6b' },
}

// 顶部 tab 过滤
const TABS: Array<{ key: 'all' | OrderStatus; label: string }> = [
  { key: 'pending',    label: '待核销' },
  { key: 'delivered',  label: '已完成' },
  { key: 'cancelled',  label: '已取消' },
  { key: 'refunded',   label: '已退款' },
  { key: 'all',        label: '全部' },
]

export default function MerchantOrdersPage() {
  return (
    <StaffGate>
      <MerchantOrdersInner />
    </StaffGate>
  )
}

function MerchantOrdersInner() {
  const router = useRouter()
  const [tab, setTab] = useState<'all' | OrderStatus>('pending')
  const [search, setSearch] = useState('')
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(false)
  const [redeeming, setRedeeming] = useState<string | null>(null)
  const [counts, setCounts] = useState<Record<string, number>>({})

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ merchantCode: MERCHANT_CODE, limit: '100' })
      if (tab !== 'all') params.set('status', tab)
      const res = await fetch(`/api/orders?${params.toString()}`)
      const json = await res.json()
      if (json.success) {
        setOrders(json.orders || [])
      }
    } catch (e) {
      console.error('[merchant/orders] fetch error', e)
    } finally {
      setLoading(false)
    }
  }, [tab])

  const fetchCounts = useCallback(async () => {
    // 同时拉每个状态的计数（小数据量，简单做法）
    const statuses: Array<'all' | OrderStatus> = ['pending', 'delivered', 'cancelled', 'refunded']
    const result: Record<string, number> = {}
    await Promise.all(
      statuses.map(async (s) => {
        const params = new URLSearchParams({ merchantCode: MERCHANT_CODE, limit: '200' })
        if (s !== 'all') params.set('status', s)
        const res = await fetch(`/api/orders?${params.toString()}`)
        const json = await res.json()
        result[s] = json.success ? (json.orders?.length || 0) : 0
      })
    )
    setCounts(result)
  }, [])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  useEffect(() => {
    fetchCounts()
  }, [fetchCounts])

  // 搜索过滤（在前端做，因为数据量小）
  const filtered = orders.filter((o) => {
    if (!search.trim()) return true
    const q = search.trim().toLowerCase()
    return (
      o.orderNo.toLowerCase().includes(q) ||
      (o.pickupCode && o.pickupCode.includes(q)) ||
      (o.deliveryPhone && o.deliveryPhone.includes(q))
    )
  })

  const handleQuickRedeem = async (code: string) => {
    if (!/^\d{6}$/.test(code)) {
      toast.error('取货码格式错误（需 6 位数字）')
      return
    }
    if (!await confirmDialog(`确认核销取货码 ${code}？`)) return
    setRedeeming(code)
    try {
      const res = await fetch('/api/orders/pickup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, staffName: '店员', payMethod: 'cash' }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(`✅ 核销成功\n订单：${json.order.orderNo}\n金额：¥${json.order.finalAmount}`)
        fetchOrders()
        fetchCounts()
      } else {
        toast.error(`❌ 核销失败：${json.error || '未知错误'}`)
      }
    } catch (e: any) {
      toast.error(`网络错误：${e?.message}`)
    } finally {
      setRedeeming(null)
    }
  }

  const isExpired = (expires: string | null | undefined) => {
    if (!expires) return false
    return new Date(expires) < new Date()
  }

  return (
    <AppLayout title="订单管理" showHeader>
      <div style={{ padding: '16px', paddingBottom: '100px' }}>
        {/* 顶部标题 */}
        <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#ffffff' }}>
              🛠️ 订单管理
            </div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>
              果蔬鲜生（0005）· 商户专用
            </div>
          </div>
          <button
            onClick={() => router.push('/pickup')}
            style={{
              padding: '8px 14px',
              borderRadius: '12px',
              border: `1px solid ${ORANGE}`,
              background: 'rgba(255, 165, 0, 0.1)',
              color: ORANGE,
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            📦 快捷核销
          </button>
        </div>

        {/* Tab 过滤 */}
        <div style={{
          display: 'flex', gap: 6, marginBottom: 12, overflowX: 'auto',
          paddingBottom: 4,
        }}>
          {TABS.map((t) => {
            const count = t.key === 'all' ? null : counts[t.key]
            const isActive = tab === t.key
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '12px',
                  border: isActive ? `1px solid ${GREEN}` : '1px solid rgba(255,255,255,0.1)',
                  background: isActive ? `rgba(${GREEN_RGBA}, 0.15)` : 'rgba(255,255,255,0.03)',
                  color: isActive ? GREEN : 'rgba(255,255,255,0.65)',
                  fontSize: '13px',
                  fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                {t.label}
                {count !== null && count !== undefined && count > 0 && (
                  <span style={{
                    padding: '1px 6px',
                    background: isActive ? GREEN : 'rgba(255,255,255,0.15)',
                    color: isActive ? '#0a0f0d' : 'rgba(255,255,255,0.7)',
                    borderRadius: 8,
                    fontSize: 10, fontWeight: 700,
                  }}>{count}</span>
                )}
              </button>
            )
          })}
        </div>

        {/* 搜索框 */}
        <div style={{
          display: 'flex', gap: 8, marginBottom: 16,
          padding: '10px 14px',
          background: 'rgba(255,255,255,0.04)',
          border: `1px solid rgba(${GREEN_RGBA}, 0.15)`,
          borderRadius: '12px',
        }}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索订单号 / 取货码 / 手机号"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none', outline: 'none',
              color: '#fff', fontSize: 14,
            }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{
                background: 'transparent', border: 'none',
                color: 'rgba(255,255,255,0.5)', cursor: 'pointer',
                fontSize: 14,
              }}
            >✕</button>
          )}
        </div>

        {/* 订单列表 */}
        {loading && orders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.4)' }}>
            加载中…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{
            padding: 60, textAlign: 'center',
            background: 'rgba(255,255,255,0.02)',
            borderRadius: '16px',
            border: '1px dashed rgba(255,255,255,0.1)',
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>
              {search ? '没有匹配的订单' : '暂无订单'}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map((order) => {
              const status = STATUS_LABELS[order.status] || { label: order.status, color: '#888' }
              const expired = isExpired(order.pickupExpiresAt)
              const isPending = order.status === 'pending'
              return (
                <div
                  key={order.id}
                  style={{
                    padding: '16px',
                    background: CARD_BG,
                    border: `1px solid rgba(${GREEN_RGBA}, 0.12)`,
                    borderRadius: '16px',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                  }}
                >
                  {/* 头部：订单号 + 状态 */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span style={{
                      fontSize: 13, color: 'rgba(255,255,255,0.7)',
                      fontFamily: 'monospace', letterSpacing: 0.5,
                    }}>
                      {order.orderNo}
                    </span>
                    <span style={{
                      padding: '3px 10px',
                      background: `${status.color}22`,
                      color: status.color,
                      border: `1px solid ${status.color}55`,
                      borderRadius: 8,
                      fontSize: 11, fontWeight: 700,
                    }}>
                      {status.label}
                    </span>
                  </div>

                  {/* 取货码（仅 pending 显示） */}
                  {isPending && order.pickupCode && (
                    <div style={{
                      padding: '12px 16px',
                      background: expired ? 'rgba(255, 107, 107, 0.08)' : `rgba(${ORANGE.replace('#','')}, 0.08)`,
                      border: `1px solid ${expired ? '#ff6b6b55' : ORANGE + '55'}`,
                      borderRadius: '12px',
                      marginBottom: 12,
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                      <div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>
                          {expired ? '⚠️ 已过期' : '取货码'}
                        </div>
                        <div style={{
                          fontSize: 22, fontWeight: 700,
                          color: expired ? '#ff6b6b' : ORANGE,
                          fontFamily: 'monospace', letterSpacing: 4,
                        }}>
                          {order.pickupCode}
                        </div>
                      </div>
                      {!expired && (
                        <button
                          onClick={() => handleQuickRedeem(order.pickupCode!)}
                          disabled={redeeming === order.pickupCode}
                          style={{
                            padding: '10px 16px',
                            borderRadius: '10px',
                            border: 'none',
                            background: ORANGE,
                            color: '#0a0f0d',
                            fontSize: 13, fontWeight: 700,
                            cursor: redeeming === order.pickupCode ? 'wait' : 'pointer',
                            opacity: redeeming === order.pickupCode ? 0.6 : 1,
                          }}
                        >
                          {redeeming === order.pickupCode ? '核销中' : '✅ 核销'}
                        </button>
                      )}
                    </div>
                  )}

                  {/* 商品列表 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                    {order.items.slice(0, 3).map((it) => (
                      <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                        <span style={{ color: 'rgba(255,255,255,0.8)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {it.productName}
                          {it.productSpec && <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginLeft: 4 }}>({it.productSpec})</span>}
                        </span>
                        <span style={{ color: 'rgba(255,255,255,0.5)', marginLeft: 8 }}>×{it.quantity}</span>
                      </div>
                    ))}
                    {order.items.length > 3 && (
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                        还有 {order.items.length - 3} 件…
                      </div>
                    )}
                  </div>

                  {/* 底部：金额 + 时间 */}
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    paddingTop: 10,
                    borderTop: '1px solid rgba(255,255,255,0.05)',
                  }}>
                    <span style={{
                      fontSize: 18, fontWeight: 700, color: GREEN,
                    }}>¥{order.finalAmount.toFixed(2)}</span>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                      {new Date(order.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {/* 备注 */}
                  {order.remark && (
                    <div style={{
                      marginTop: 8, padding: '6px 10px',
                      background: 'rgba(255,255,255,0.03)',
                      borderRadius: 6,
                      fontSize: 11, color: 'rgba(255,255,255,0.5)',
                    }}>
                      📝 {order.remark}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* 底部：返回 + 刷新 */}
        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          <button
            onClick={() => router.push('/merchant')}
            style={{
              flex: 1, padding: '12px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '12px',
              color: '#fff', fontSize: 13,
              cursor: 'pointer',
            }}
          >
            ← 返回商户页
          </button>
          <button
            onClick={() => { fetchOrders(); fetchCounts(); }}
            disabled={loading}
            style={{
              flex: 1, padding: '12px',
              background: `rgba(${GREEN_RGBA}, 0.1)`,
              border: `1px solid rgba(${GREEN_RGBA}, 0.3)`,
              borderRadius: '12px',
              color: GREEN, fontSize: 13, fontWeight: 600,
              cursor: loading ? 'wait' : 'pointer',
            }}
          >
            {loading ? '刷新中…' : '🔄 刷新'}
          </button>
        </div>
      </div>
    </AppLayout>
  )
}
