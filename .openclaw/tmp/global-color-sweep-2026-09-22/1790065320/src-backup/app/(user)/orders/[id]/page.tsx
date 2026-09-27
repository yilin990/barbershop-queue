'use client'

/**
 * /orders/[id] - 订单详情页
 *
 * Day 5 重构 (v1.10.0-orders-real):
 * - 订单基本信息 + 商品列表 + 金额明细
 * - 订单时间轴 (创建/支付/完成)
 * - 取消订单 (调 /api/orders/[id] PATCH)
 * - 再来一单 (跳 /stores 带 orderNo)
 */

import { confirmDialog } from '@/lib/ui-bus'
import { toast } from '@/lib/ui-bus'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import AppLayout from '@/components/AppLayout'
import { useUserStore } from '@/stores/userStore'

interface OrderItem {
  id: string
  productId?: string
  productName: string
  productSpec?: string | null
  productImage?: string | null
  price: number
  quantity: number
  subtotal: number
}

interface Order {
  id: string
  orderNo: string
  status: string
  totalAmount: number
  discountAmount: number
  finalAmount: number
  deliveryType: 'pickup' | 'delivery'
  deliveryAddress?: string | null
  deliveryPhone?: string | null
  remark?: string | null
  createdAt: string
  paidAt?: string | null
  completedAt?: string | null
  // ⭐ 奕霖 2026-06-30 21:49
  pickupCode?: string | null
  pickupExpiresAt?: string | null
  pickedUpAt?: string | null
  items: OrderItem[]
  // 评价
  review?: {
    rating: number
    content: string
    createdAt: string
  } | null
}

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  pending:    { label: '待付款',  color: '#b8860b', bg: 'rgba(251, 191, 36, 0.15)' },
  paid:       { label: '已付款',  color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.15)' },
  preparing:  { label: '备货中',  color: '#a78bfa', bg: 'rgba(167, 139, 250, 0.15)' },
  ready:      { label: '待取货',  color: '#34d399', bg: 'rgba(52, 211, 153, 0.15)' },
  delivered:  { label: '已完成',  color: '#b8860b', bg: 'rgba(184, 134, 11, 0.15)' },
  cancelled:  { label: '已取消',  color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)' },
  refunded:   { label: '已退款',  color: '#f87171', bg: 'rgba(248, 113, 113, 0.15)' },
}

function formatDateTime(s?: string | null) {
  if (!s) return '—'
  const d = new Date(s)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function OrderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { isLoggedIn } = useUserStore()
  const orderId = params.id as string

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)
  // ⭐ 奕霖 2026-06-30 21:49：确认收货
  const [confirming, setConfirming] = useState(false)

  const fetchOrder = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`/api/orders/${orderId}`, { cache: 'no-store' })
      const data = await res.json()
      if (data.success) {
        setOrder(data.order)
      } else {
        setError(data.error || '订单不存在')
      }
    } catch (e: any) {
      setError(e.message || '网络错误')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (orderId) fetchOrder()
  }, [orderId])

  const handleCancel = async () => {
    if (!order || cancelling) return
    if (!await confirmDialog('确定取消这个订单吗？取消后无法恢复。')) return
    try {
      setCancelling(true)
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      })
      const data = await res.json()
      if (data.success) {
        await fetchOrder()
        toast.info('已取消订单')
      } else {
        toast.error('取消失败：' + (data.error || '未知错误'))
      }
    } catch (e: any) {
      toast.error('取消失败：' + e.message)
    } finally {
      setCancelling(false)
    }
  }

  // ⭐ 奕霖 2026-06-30 21:49：用户确认收货
  const handleConfirm = async () => {
    if (!order || confirming) return
    if (!await confirmDialog('确认收到商品了吗？商家已交付完成？')) return
    try {
      setConfirming(true)
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'delivered' }),
      })
      const data = await res.json()
      if (data.success) {
        await fetchOrder()
        toast.success('🎉 确认收货成功，欢迎评价！')
      } else {
        toast.error('操作失败：' + (data.error || '未知错误'))
      }
    } catch (e: any) {
      toast.error('操作失败：' + e.message)
    } finally {
      setConfirming(false)
    }
  }

  if (!isLoggedIn) {
    return (
      <AppLayout title="订单详情">
        <div style={{ background: 'linear-gradient(180deg, rgba(44, 24, 16, 0.6) 0%, rgba(58, 36, 22, 0.8) 100%)', borderRadius: '18px', padding: '50px 24px', textAlign: 'center', border: '1px solid rgba(184, 134, 11, 0.1)' }}>
          <div style={{ fontSize: 64, marginBottom: '20px' }}>🔒</div>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 15 }}>请先登录</p>
          <Link href="/login" style={{ display: 'inline-block', marginTop: 16, padding: '12px 28px', borderRadius: '12px', background: '#b8860b', color: '#0d1f17', textDecoration: 'none', fontWeight: 700 }}>
            去登录
          </Link>
        </div>
      </AppLayout>
    )
  }

  if (loading) {
    return (
      <AppLayout title="订单详情">
        <div style={{ textAlign: 'center', padding: 60, color: 'rgba(184, 134, 11, 0.6)' }}>
          加载中…
        </div>
      </AppLayout>
    )
  }

  if (error || !order) {
    return (
      <AppLayout title="订单详情">
        <div style={{ background: 'rgba(248, 113, 113, 0.1)', border: '1px solid rgba(248, 113, 113, 0.3)', borderRadius: '18px', padding: '40px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>😢</div>
          <p style={{ color: '#fca5a5', fontSize: 15, margin: '0 0 16px' }}>{error || '订单不存在'}</p>
          <Link href="/orders" style={{ display: 'inline-block', padding: '10px 24px', borderRadius: '10px', background: 'rgba(184, 134, 11, 0.15)', color: '#b8860b', textDecoration: 'none', border: '1px solid rgba(184, 134, 11, 0.3)' }}>
            ← 返回订单列表
          </Link>
        </div>
      </AppLayout>
    )
  }

  const s = STATUS_LABEL[order.status] || STATUS_LABEL.pending
  const canCancel = order.status === 'pending' || order.status === 'paid'
  // ⭐ 奕霖 2026-06-30 21:49
  const canConfirm = order.status === 'ready' || order.status === 'paid'
  const canReview = order.status === 'delivered' && !order.review

  return (
    <AppLayout title="订单详情">
      {/* 状态横幅 */}
      <div style={{ background: `linear-gradient(135deg, ${s.color}25 0%, ${s.color}10 100%)`, borderRadius: '18px', padding: '24px 20px', border: `1px solid ${s.color}40`, marginBottom: 16, textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>
          {order.status === 'delivered' ? '✅' : order.status === 'cancelled' ? '🚫' : order.status === 'refunded' ? '↩️' : '⏳'}
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, color: s.color, marginBottom: 4 }}>{s.label}</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>订单号：{order.orderNo}</div>
      </div>

      {/* ⭐ 奕霖 2026-06-30 21:49：取货码大展示 + 复制 */}
      {order.pickupCode && order.status !== 'delivered' && order.status !== 'cancelled' && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(184, 134, 11, 0.15) 0%, rgba(184, 134, 11, 0.05) 100%)',
          borderRadius: '18px',
          padding: '20px',
          border: '2px solid rgba(184, 134, 11, 0.4)',
          marginBottom: 16,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '12px', color: 'rgba(184, 134, 11, 0.7)', marginBottom: '8px', letterSpacing: '2px' }}>
            到店出示取货码 · 店员核销
          </div>
          <div style={{
            fontSize: '36px',
            fontWeight: 700,
            color: '#b8860b',
            letterSpacing: '10px',
            fontFamily: 'monospace',
            marginBottom: '12px',
            textShadow: '0 0 20px rgba(184, 134, 11, 0.3)',
          }}>
            {order.pickupCode}
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
            <button
              onClick={() => {
                if (navigator?.clipboard && order.pickupCode) {
                  navigator.clipboard.writeText(order.pickupCode).then(() => {
                    toast.info(`取货码已复制：${order.pickupCode}`)
                  }).catch(() => {})
                }
              }}
              style={{
                padding: '8px 18px',
                borderRadius: '10px',
                border: '1px solid rgba(184, 134, 11, 0.4)',
                background: 'rgba(184, 134, 11, 0.15)',
                color: '#b8860b',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              📋 复制取货码
            </button>
            {canConfirm && (
              <button
                onClick={handleConfirm}
                disabled={confirming}
                style={{
                  padding: '8px 18px',
                  borderRadius: '10px',
                  border: 'none',
                  background: '#b8860b',
                  color: '#0a0f0d',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: confirming ? 'wait' : 'pointer',
                }}
              >
                {confirming ? '处理中…' : '✅ 确认收货'}
              </button>
            )}
          </div>
          {order.pickupExpiresAt && (
            <div style={{ fontSize: '11px', color: 'rgba(255, 187, 0, 0.7)', marginTop: '10px' }}>
              ⚠️ 过期时间：{new Date(order.pickupExpiresAt).toLocaleString('zh-CN')}
            </div>
          )}
        </div>
      )}

      {/* ⭐ 奕霖 2026-06-30 21:49：核销信息 */}
      {order.pickedUpAt && (
        <div style={{
          background: 'rgba(184, 134, 11, 0.08)',
          borderRadius: '12px',
          padding: '12px 16px',
          border: '1px solid rgba(184, 134, 11, 0.2)',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          <span style={{ fontSize: '20px' }}>✅</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13px', color: '#b8860b', fontWeight: 600 }}>商家已核销</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>
              {new Date(order.pickedUpAt).toLocaleString('zh-CN')}
            </div>
          </div>
        </div>
      )}

      {/* ⭐ 奕霖 2026-06-30 21:49：已评价展示 */}
      {order.review && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.08) 0%, rgba(245, 158, 11, 0.03) 100%)',
          borderRadius: '14px',
          padding: '16px',
          border: '1px solid rgba(251, 191, 36, 0.25)',
          marginBottom: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <span style={{ fontSize: '14px', color: '#b8860b', fontWeight: 600 }}>⭐ 我的评价</span>
            <div style={{ display: 'flex', gap: '2px' }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} style={{ fontSize: '16px', color: i < order.review!.rating ? '#b8860b' : 'rgba(255,255,255,0.2)' }}>
                  ★
                </span>
              ))}
            </div>
          </div>
          {order.review.content && (
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)', lineHeight: 1.6 }}>
              {order.review.content}
            </div>
          )}
        </div>
      )}

      {/* 商品列表 */}
      <div style={{ background: 'linear-gradient(180deg, rgba(44, 24, 16, 0.6) 0%, rgba(58, 36, 22, 0.8) 100%)', borderRadius: '18px', padding: '18px', border: '1px solid rgba(184, 134, 11, 0.1)', marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.85)', marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid rgba(184, 134, 11, 0.08)' }}>
          商品清单 ({order.items.length} 件)
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {order.items.map((item) => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 56, height: 56, borderRadius: 10,
                overflow: 'hidden', background: 'rgba(184, 134, 11, 0.08)',
                flexShrink: 0, position: 'relative',
                border: '1px solid rgba(184, 134, 11, 0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <img
                  src={item.productImage || `/api/product-image/${item.productId}`}
                  alt={item.productName}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  onError={(e) => {
                    const t = e.currentTarget as HTMLImageElement
                    t.style.display = 'none'
                    const p = t.parentElement
                    if (p) {
                      p.innerHTML = '<span style="font-size:28px;display:flex;align-items:center;justify-content:center;width:100%;height:100%;">🍵</span>'
                    }
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, color: '#fff', marginBottom: 4 }}>{item.productName}</div>
                {item.productSpec && (
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{item.productSpec}</div>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 14, color: '#fff' }}>¥{item.price.toFixed(2)}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>x{item.quantity}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 金额明细 */}
      <div style={{ background: 'linear-gradient(180deg, rgba(44, 24, 16, 0.6) 0%, rgba(58, 36, 22, 0.8) 100%)', borderRadius: '18px', padding: '18px', border: '1px solid rgba(184, 134, 11, 0.1)', marginBottom: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Row label="商品总额" value={`¥${order.totalAmount.toFixed(2)}`} />
          {order.discountAmount > 0 && <Row label="优惠减免" value={`-¥${order.discountAmount.toFixed(2)}`} color="#b8860b" />}
          <div style={{ height: 1, background: 'rgba(184, 134, 11, 0.1)', margin: '4px 0' }} />
          <Row label="实付金额" value={`¥${order.finalAmount.toFixed(2)}`} bold color="#b8860b" />
        </div>
      </div>

      {/* 配送信息 */}
      <div style={{ background: 'linear-gradient(180deg, rgba(44, 24, 16, 0.6) 0%, rgba(58, 36, 22, 0.8) 100%)', borderRadius: '18px', padding: '18px', border: '1px solid rgba(184, 134, 11, 0.1)', marginBottom: 14 }}>
        <Row label="取货方式" value={order.deliveryType === 'pickup' ? '门店自提' : '送货上门'} />
        {order.deliveryAddress && <Row label="配送地址" value={order.deliveryAddress} />}
        {order.deliveryPhone && <Row label="联系电话" value={order.deliveryPhone} />}
        {order.remark && <Row label="订单备注" value={order.remark} />}
      </div>

      {/* ⭐ 清禾 2026-08-02 14:34 奕霖需求：订单跟踪增强 5 阶段时间轴 */}
      <div style={{ background: 'linear-gradient(180deg, rgba(44, 24, 16, 0.6) 0%, rgba(58, 36, 22, 0.8) 100%)', borderRadius: '18px', padding: '18px', border: '1px solid rgba(184, 134, 11, 0.1)', marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.85)', marginBottom: 14 }}>订单进度</div>
        <Timeline label="下单" time={formatDateTime(order.createdAt)} done />
        <Timeline label="已付款" time={formatDateTime(order.paidAt)} done={['paid','preparing','ready','delivered'].includes(order.status)} active={order.status === 'paid'} />
        <Timeline label="备货中" time={order.status === 'preparing' ? '商家备货中...' : ''} done={['preparing','ready','delivered'].includes(order.status)} active={order.status === 'preparing'} />
        <Timeline label="待取货" time={order.status === 'ready' ? '商品已到店' : ''} done={['ready','delivered'].includes(order.status)} active={order.status === 'ready'} highlight={order.status === 'ready'} />
        <Timeline label="已取货" time={formatDateTime(order.pickedUpAt) || formatDateTime(order.completedAt)} done={['delivered'].includes(order.status)} last />
        {order.status === 'cancelled' && (
          <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(248, 113, 113, 0.15)', borderRadius: 8, color: '#fca5a5', fontSize: 12, textAlign: 'center' }}>
            ❌ 订单已取消
          </div>
        )}
      </div>

      {/* 操作按钮 */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <button
          onClick={() => router.back()}
          style={{ flex: 1, minWidth: 100, padding: '14px', borderRadius: '14px', background: 'rgba(184, 134, 11, 0.08)', color: 'rgba(184, 134, 11, 0.8)', border: '1px solid rgba(184, 134, 11, 0.2)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
        >
          ← 返回
        </button>
        {/* ⭐ 奕霖 2026-06-30 21:49：核销后可以评价 */}
        {canReview && (
          <Link
            href={`/orders/${order.id}/review`}
            style={{
              flex: 1,
              minWidth: 100,
              padding: '14px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #b8860b 0%, #f59e0b 100%)',
              color: '#0a0f0d',
              fontSize: 14,
              fontWeight: 700,
              textDecoration: 'none',
              textAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
            }}
          >
            ⭐ 去评价
          </Link>
        )}
        {canCancel && (
          <button
            onClick={handleCancel}
            disabled={cancelling}
            style={{ flex: 1, padding: '14px', borderRadius: '14px', background: 'rgba(248, 113, 113, 0.1)', color: '#fca5a5', border: '1px solid rgba(248, 113, 113, 0.3)', fontSize: 14, fontWeight: 600, cursor: cancelling ? 'wait' : 'pointer', opacity: cancelling ? 0.6 : 1 }}
          >
            {cancelling ? '取消中…' : '取消订单'}
          </button>
        )}
        {order.status === 'delivered' && (
          <Link href={`/stores?reorder=${order.orderNo}`} style={{ flex: 1, padding: '14px', borderRadius: '14px', background: 'linear-gradient(135deg, #b8860b 0%, #b8860b 100%)', color: '#0d1f17', border: 'none', fontSize: 14, fontWeight: 700, textAlign: 'center', textDecoration: 'none' }}>
            再来一单
          </Link>
        )}
      </div>
    </AppLayout>
  )
}

function Row({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: bold ? 15 : 13 }}>
      <span style={{ color: 'rgba(255,255,255,0.6)' }}>{label}</span>
      <span style={{ color: color || (bold ? '#fff' : 'rgba(255,255,255,0.85)'), fontWeight: bold ? 700 : 500, wordBreak: 'break-word', maxWidth: '60%', textAlign: 'right' }}>{value}</span>
    </div>
  )
}

function Timeline({ label, time, done, last, active, highlight }: { label: string; time: string; done: boolean; last?: boolean; active?: boolean; highlight?: boolean }) {
  const dotColor = done
    ? '#b8860b'
    : active
    ? '#b8860b'
    : 'rgba(184, 134, 11, 0.2)'
  const dotShadow = done
    ? '0 0 8px rgba(184, 134, 11, 0.5)'
    : active
    ? '0 0 8px rgba(251, 191, 36, 0.5)'
    : 'none'
  const labelColor = done
    ? '#fff'
    : active
    ? '#b8860b'
    : 'rgba(255,255,255,0.4)'
  return (
    <div style={{ display: 'flex', gap: 12, position: 'relative', paddingBottom: last ? 0 : 16, ...(highlight ? { padding: '6px 8px', background: 'rgba(251, 191, 36, 0.08)', borderRadius: 10, border: '1px solid rgba(251, 191, 36, 0.3)' } : {}) }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: 14, height: 14, borderRadius: '50%', background: dotColor, boxShadow: dotShadow, ...(active ? { animation: 'pulse 1.5s ease-in-out infinite' } : {}) }} />
        {!last && <div style={{ width: 2, flex: 1, background: done ? 'rgba(184, 134, 11, 0.3)' : 'rgba(184, 134, 11, 0.1)', marginTop: 4 }} />}
      </div>
      <div style={{ flex: 1, paddingTop: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: labelColor }}>
          {active && '⏳ '}{label}
        </div>
        <div style={{ fontSize: 12, color: done ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.3)', marginTop: 2 }}>{time || '—'}</div>
      </div>
    </div>
  )
}
