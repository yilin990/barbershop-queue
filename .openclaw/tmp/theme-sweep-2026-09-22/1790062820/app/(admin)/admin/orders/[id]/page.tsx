'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import AdminGate from '@/components/AdminGate'

interface OrderDetail {
  id: string
  orderNo: string
  totalAmount: number
  status: string
  pickupCode: string | null
  createdAt: string
  pickedUpAt: string | null
  pickedUpBy: string | null
  customerName: string | null
  customerPhone: string | null
  customerSpent: number
}
interface OrderItem {
  id: string
  productName: string
  quantity: number
  price: number
  subtotal: number
}

const statusFlow = [
  { key: 'pending', label: '待核销', icon: '⏳', color: '#f59e0b' },
  { key: 'delivered', label: '已核销', icon: '✓', color: '#fbbf24' },
  { key: 'completed', label: '已完成', icon: '✓', color: '#34c87b' },
  { key: 'cancelled', label: '已取消', icon: '✕', color: '#ef4444' },
]

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [items, setItems] = useState<OrderItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/admin/orders/${id}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) { setOrder(d.order); setItems(d.items) }
        else setError(d.error || '加载失败')
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  const currentStep = statusFlow.findIndex((s) => s.key === order?.status)

  return (
    <AdminGate>
      <div style={{ minHeight: '100vh', background: 'radial-gradient(ellipse at top, rgba(127, 220, 148, 0.04) 0%, transparent 50%), linear-gradient(180deg, #0a0f0d 0%, #050807 100%)', color: '#fff', fontFamily: '-apple-system, "PingFang SC", sans-serif' }}>
        <div style={{ background: 'rgba(15, 22, 18, 0.6)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid rgba(127, 220, 148, 0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 24px' }}>
            <button onClick={() => router.back()} style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(127, 220, 148, 0.08)', color: '#fbbf24', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', border: 'none' }}>← 返回列表</button>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>📋 订单详情</h1>
            {order && <div style={{ marginLeft: 'auto', fontSize: 11, color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' }}>{order.orderNo}</div>}
          </div>
        </div>

        <div style={{ padding: '24px', maxWidth: 900 }}>
          {loading ? (
            <Center>加载订单中…</Center>
          ) : error ? (
            <Center>❌ {error}</Center>
          ) : order ? (
            <>
              {/* 顶部摘要 */}
              <div style={{ background: 'rgba(15, 22, 18, 0.6)', border: '1px solid rgba(127, 220, 148, 0.1)', borderRadius: 16, padding: 20, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>订单金额</div>
                    <div style={{ fontSize: 32, fontWeight: 800, color: '#fbbf24', letterSpacing: -1 }}>¥{order.totalAmount}</div>
                  </div>
                  {order.pickupCode && (
                    <div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>取货码</div>
                      <div style={{ padding: '10px 18px', borderRadius: 10, background: 'rgba(127, 220, 148, 0.15)', color: '#fbbf24', fontFamily: 'monospace', fontSize: 22, fontWeight: 800, letterSpacing: 2 }}>{order.pickupCode}</div>
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                    <div>创建时间</div>
                    <div style={{ color: '#fff', fontFamily: 'monospace', marginTop: 4 }}>{new Date(order.createdAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })}</div>
                  </div>
                </div>

                {/* 状态流 */}
                <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
                  <div style={{ position: 'absolute', top: 18, left: '12%', right: '12%', height: 2, background: 'rgba(127, 220, 148, 0.15)', zIndex: 0 }} />
                  {statusFlow.map((s, i) => {
                    const active = i <= currentStep && currentStep >= 0
                    return (
                      <div key={s.key} style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: '50%',
                          background: active ? s.color : 'rgba(255,255,255,0.05)',
                          color: active ? '#0a3a1f' : 'rgba(255,255,255,0.3)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 16, fontWeight: 800,
                          border: active ? 'none' : '1px solid rgba(255,255,255,0.1)',
                        }}>{s.icon}</div>
                        <div style={{ fontSize: 11, color: active ? '#fbbf24' : 'rgba(255,255,255,0.4)', fontWeight: 600 }}>{s.label}</div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* 顾客 */}
              {order.customerName && (
                <div style={{ background: 'rgba(15, 22, 18, 0.6)', border: '1px solid rgba(127, 220, 148, 0.08)', borderRadius: 14, padding: 16, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, #fbbf24, #34c87b)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#0a3a1f' }}>
                    {order.customerName[0]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{order.customerName}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' }}>
                      {order.customerPhone ? order.customerPhone.slice(0, 3) + '****' + order.customerPhone.slice(-4) : '-'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>历史消费</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#fbbf24' }}>¥{order.customerSpent}</div>
                  </div>
                </div>
              )}

              {/* 商品列表 */}
              <div style={{ background: 'rgba(15, 22, 18, 0.6)', border: '1px solid rgba(127, 220, 148, 0.08)', borderRadius: 14, overflow: 'hidden', marginBottom: 16 }}>
                <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center' }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>🛒 商品清单</span>
                  <span style={{ marginLeft: 'auto', fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{items.length} 件</span>
                </div>
                {items.length === 0 ? (
                  <div style={{ padding: 30, textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>无商品</div>
                ) : items.map((it, i) => (
                  <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: i < items.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(127, 220, 148, 0.08)', color: '#fbbf24', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>💊</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{it.productName}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>¥{it.price} × {it.quantity}</div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#fbbf24' }}>¥{it.subtotal}</div>
                  </div>
                ))}
                <div style={{ padding: '14px 16px', background: 'rgba(127, 220, 148, 0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>合计</span>
                  <span style={{ fontSize: 18, fontWeight: 800, color: '#fbbf24' }}>¥{order.totalAmount}</span>
                </div>
              </div>

              {/* 核销信息 */}
              {order.pickedUpAt && (
                <div style={{ background: 'rgba(127, 220, 148, 0.06)', border: '1px solid rgba(127, 220, 148, 0.2)', borderRadius: 14, padding: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fbbf24', marginBottom: 8 }}>✓ 已核销</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
                    时间：{new Date(order.pickedUpAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })}
                  </div>
                  {order.pickedUpBy && (
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>
                      操作员：{order.pickedUpBy}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </AdminGate>
  )
}

function Center({ children }: { children: React.ReactNode }) {
  return <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.4)' }}>{children}</div>
}
