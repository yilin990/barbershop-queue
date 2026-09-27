'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { ResponsiveTable, type Column } from '@/components/ui/ResponsiveTable'
import { useToast } from '@/components/ui/Toast'
import { colors, fontSize, fontWeight, radius, spacing } from '@/lib/design-tokens'

interface OrderRow {
  id: string
  orderNo: string
  customerName: string
  customerPhone: string
  totalAmount: number
  status: string
  pickupCode: string | null
  createdAt: string
  itemCount: number
}

export default function OrdersPage() {
  const toast = useToast()
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'today' | 'pending' | 'completed'>('all')
  // ⭐ 2026-07-13 23:45 奕霖授权：现在就行动，加导出 Excel
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [exporting, setExporting] = useState(false)
  const [exportMsg, setExportMsg] = useState<string | null>(null)

  const handleExport = async () => {
    setExporting(true)
    setExportMsg(null)
    try {
      const params = new URLSearchParams()
      if (fromDate) params.set('from', fromDate)
      if (toDate) params.set('to', toDate)
      if (filter !== 'all') {
        if (filter === 'pending') params.set('status', 'pending')
        else if (filter === 'completed') params.set('status', 'delivered')
      }
      const r = await fetch(`/api/admin/orders/export?${params}`, { credentials: 'include' })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        setExportMsg(`导出失败：${j.error || r.statusText}`)
        toast.toast(`导出失败：${j.error || r.statusText}`, 'err')
        return
      }
      const blob = await r.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `果蔬订单_${fromDate || '全部'}_${toDate || '至今'}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      setExportMsg(`✓ 导出成功（${orders.length} 笔订单）`)
      toast.toast(`✅ 已导出 ${orders.length} 笔订单`, 'ok')
    } catch (e: any) {
      setExportMsg(`导出失败：${e.message}`)
    } finally {
      setExporting(false)
      setTimeout(() => setExportMsg(null), 5000)
    }
  }

  useEffect(() => {
    fetch('/api/admin/orders', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => { if (d.success) setOrders(d.orders); })
      .finally(() => setLoading(false))
  }, [])

  const filtered = orders.filter((o) => {
    if (filter === 'all') return true
    if (filter === 'today') {
      const d = new Date(o.createdAt).toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' })
      return d === new Date().toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' })
    }
    if (filter === 'pending') return o.status === 'pending' || o.status === '待核销'
    if (filter === 'completed') return o.status === 'delivered' || o.status === 'completed' || o.status === 'completed'
    return true
  })

  const statusColor = (s: string) => {
    if (s === 'pending' || s === '待核销') return { bg: 'rgba(245, 158, 11, 0.18)', color: '#f59e0b' }
    if (s === 'delivered' || s === 'completed') return { bg: 'rgba(184, 134, 11, 0.18)', color: '#b8860b' }
    if (s === 'cancelled') return { bg: 'rgba(239, 68, 68, 0.18)', color: '#ef4444' }
    return { bg: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }
  }

  return (
    <AdminLayout title="订单管理" active="orders">
      <div style={{ minHeight: '100vh', background: 'radial-gradient(ellipse at top, rgba(184, 134, 11, 0.04) 0%, transparent 50%), linear-gradient(180deg, #0a0f0d 0%, #050807 100%)', color: '#fff', fontFamily: '-apple-system, "PingFang SC", sans-serif' }}>
        {/* Top bar */}
        <div style={topBar}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 24px', borderBottom: '1px solid rgba(184, 134, 11, 0.08)' }}>
            <Link href="/admin" style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(184, 134, 11, 0.08)', color: '#b8860b', fontSize: 12, textDecoration: 'none' }}>← 数据概览</Link>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>📋 订单管理</h1>
            <div style={{ marginLeft: 'auto', fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>共 {orders.length} 笔订单</div>
          </div>
          {/* Filter */}
          <div style={{ display: 'flex', gap: 8, padding: '12px 24px' }}>
            {[
              { key: 'all', label: '全部', n: orders.length },
              { key: 'today', label: '今日' },
              { key: 'pending', label: '待核销' },
              { key: 'completed', label: '已完成' },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key as any)}
                style={{
                  padding: '6px 14px', borderRadius: 10,
                  border: `1px solid ${filter === f.key ? 'rgba(184, 134, 11, 0.4)' : 'rgba(255,255,255,0.08)'}`,
                  background: filter === f.key ? 'rgba(184, 134, 11, 0.15)' : 'transparent',
                  color: filter === f.key ? '#b8860b' : 'rgba(255,255,255,0.6)',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >{f.label}</button>
            ))}
            {/* ⭐ 导出 Excel 工具栏 */}
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>导出范围：</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                style={{ padding: '4px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 11, fontFamily: 'inherit' }}
              />
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>→</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                style={{ padding: '4px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 11, fontFamily: 'inherit' }}
              />
              <button
                onClick={handleExport}
                disabled={exporting}
                style={{
                  padding: '6px 14px', borderRadius: 10,
                  border: '1px solid rgba(184, 134, 11, 0.4)',
                  background: exporting ? 'rgba(184, 134, 11, 0.08)' : 'rgba(184, 134, 11, 0.18)',
                  color: '#b8860b', fontSize: 12, fontWeight: 600, cursor: exporting ? 'wait' : 'pointer',
                  fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                {exporting ? '⏳ 导出中…' : '📥 导出 Excel'}
              </button>
              {exportMsg && <span style={{ fontSize: 11, color: exportMsg.startsWith('✓') ? '#b8860b' : '#f59e0b' }}>{exportMsg}</span>}
            </div>
          </div>
        </div>

        <div style={{ padding: '0 24px 40px', maxWidth: 1200 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.4)' }}>加载订单中…</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.4)' }}>
              <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.3 }}>📋</div>
              <div>暂无订单</div>
            </div>
          ) : (
            <ResponsiveTable<OrderRow>
              columns={[
                { key: 'orderNo', title: '订单号', render: (o) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{o.orderNo}</span> },
                { key: 'customer', title: '顾客', render: (o) => (
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{o.customerName || '匿名'}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{o.customerPhone ? o.customerPhone.slice(0, 6) + '****' : '-'}</div>
                  </div>
                )},
                { key: 'amount', title: '金额', render: (o) => <span style={{ fontWeight: 700, color: '#b8860b' }}>¥{o.totalAmount}</span> },
                { key: 'itemCount', title: '商品数', render: (o) => <>{o.itemCount}</>, hideOnMobile: true },
                { key: 'status', title: '状态', render: (o) => {
                  const sc = statusColor(o.status)
                  return <span style={{ padding: '3px 10px', borderRadius: 6, background: sc.bg, color: sc.color, fontSize: 11, fontWeight: 600 }}>{o.status}</span>
                }},
                { key: 'pickup', title: '取货码', render: (o) => o.pickupCode ? (
                  <span style={{ padding: '4px 12px', borderRadius: 6, background: 'rgba(184, 134, 11, 0.15)', color: '#b8860b', fontFamily: 'monospace', fontWeight: 700, fontSize: 13, letterSpacing: 1 }}>{o.pickupCode}</span>
                ) : <span style={{ color: 'rgba(255,255,255,0.3)' }}>-</span> },
                { key: 'time', title: '创建时间', render: (o) => (
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
                    {new Date(o.createdAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }).slice(0, 16)}
                  </span>
                ), hideOnMobile: true },
              ]}
              data={filtered}
              rowKey={(o) => o.id}
              mobileCardRender={(o) => {
                const sc = statusColor(o.status)
                return (
                  <div onClick={() => (window.location.href = `/admin/orders/${encodeURIComponent(o.orderNo)}`)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{o.orderNo}</span>
                      <span style={{ padding: '3px 10px', borderRadius: 6, background: sc.bg, color: sc.color, fontSize: 10, fontWeight: 600 }}>{o.status}</span>
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{o.customerName || '匿名'}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{o.itemCount} 件商品</span>
                      <span style={{ fontWeight: 700, color: '#b8860b', fontSize: 16 }}>¥{o.totalAmount}</span>
                    </div>
                    {o.pickupCode && (
                      <div style={{ marginTop: 8, padding: 8, background: 'rgba(184, 134, 11, 0.08)', borderRadius: 6, textAlign: 'center' }}>
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginRight: 6 }}>取货码</span>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#b8860b', fontSize: 16, letterSpacing: 2 }}>{o.pickupCode}</span>
                      </div>
                    )}
                  </div>
                )
              }}
            />
          )}
        </div>
      </div>
    </AdminLayout>
  )
}

const topBar: React.CSSProperties = { background: 'rgba(15, 22, 18, 0.6)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid rgba(184, 134, 11, 0.05)' }
const cell: React.CSSProperties = { padding: '12px', fontSize: 13, color: '#fff' }
