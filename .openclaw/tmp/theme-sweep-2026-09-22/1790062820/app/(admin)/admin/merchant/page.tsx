'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AdminLayout } from '@/components/admin/AdminLayout'

interface Merchant {
  id: string
  name: string
  shortName: string | null
  phone: string | null
  address: string | null
  businessHours: string | null
  primaryColor: string
  accentColor: string
  pointsRate: number
  pointValue: number
  minPointsRedeem: number
  status: string
  memberCount: number
  orderCount: number
  productCount: number
}

export default function MerchantPage() {
  const [list, setList] = useState<Merchant[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/merchant-list', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => { if (d.success) setList(d.merchants) })
      .finally(() => setLoading(false))
  }, [])

  return (
    <AdminLayout title="商户设置" active="merchant">
      <div style={{ minHeight: '100vh', background: 'radial-gradient(ellipse at top, rgba(127, 220, 148, 0.04) 0%, transparent 50%), linear-gradient(180deg, #0a0f0d 0%, #050807 100%)', color: '#fff', fontFamily: '-apple-system, "PingFang SC", sans-serif' }}>
        <div style={{ background: 'rgba(15, 22, 18, 0.6)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid rgba(127, 220, 148, 0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 24px' }}>
            <Link href="/admin" style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(127, 220, 148, 0.08)', color: '#fbbf24', fontSize: 12, textDecoration: 'none' }}>← 数据概览</Link>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>🏪 商户管理</h1>
            <div style={{ marginLeft: 'auto', fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>共 {list.length} 家</div>
          </div>
        </div>

        <div style={{ padding: '24px', maxWidth: 1000 }}>
          {loading ? (
            <Center>加载商户中…</Center>
          ) : list.length === 0 ? (
            <Center>🏪 暂无商户</Center>
          ) : list.map((m) => <MerchantCard key={m.id} m={m} />)}
        </div>
      </div>
    </AdminLayout>
  )
}

function MerchantCard({ m }: { m: Merchant }) {
  return (
    <div style={{ background: 'rgba(15, 22, 18, 0.6)', border: '1px solid rgba(127, 220, 148, 0.1)', borderRadius: 16, padding: 20, marginBottom: 16, position: 'relative', overflow: 'hidden' }}>
      {/* 顶部品牌带 */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: `linear-gradient(90deg, ${m.primaryColor || '#0A2818'} 0%, ${m.accentColor || '#C9A961'} 100%)` }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginTop: 8 }}>
        <div style={{ width: 56, height: 56, borderRadius: 14, background: `linear-gradient(135deg, ${m.primaryColor || '#0A2818'} 0%, ${m.accentColor || '#C9A961'} 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
          {(m.shortName || m.name)[0]}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{m.name}</h2>
            <span style={{ padding: '2px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'rgba(127, 220, 148, 0.15)', color: '#fbbf24' }}>
              {m.status === 'active' ? '营业中' : m.status}
            </span>
          </div>
          {m.address && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginBottom: 4 }}>📍 {m.address}</div>}
          <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'rgba(255,255,255,0.5)', flexWrap: 'wrap' }}>
            {m.phone && <span>📞 {m.phone}</span>}
            {m.businessHours && <span>⏰ {m.businessHours}</span>}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 16 }}>
        <Stat label="会员" value={m.memberCount} suffix="人" />
        <Stat label="订单" value={m.orderCount} suffix="单" />
        <Stat label="商品" value={m.productCount} suffix="件" />
      </div>

      <div style={{ marginTop: 16, padding: '12px 14px', background: 'rgba(127, 220, 148, 0.04)', borderRadius: 10 }}>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>积分规则</div>
        <div style={{ display: 'flex', gap: 18, fontSize: 12, color: 'rgba(255,255,255,0.8)', flexWrap: 'wrap' }}>
          <span>每消费 <strong style={{ color: '#fbbf24' }}>¥1</strong> 累计 <strong style={{ color: '#fbbf24' }}>{(m.pointsRate * 100).toFixed(0)}</strong> 分</span>
          <span>每 <strong style={{ color: '#fbbf24' }}>{m.minPointsRedeem}</strong> 分抵 <strong style={{ color: '#fbbf24' }}>¥{(m.minPointsRedeem * m.pointValue).toFixed(1)}</strong></span>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, suffix }: { label: string; value: number; suffix: string }) {
  return (
    <div style={{ background: 'rgba(15, 22, 18, 0.4)', border: '1px solid rgba(127, 220, 148, 0.08)', borderRadius: 10, padding: '10px 12px' }}>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: '#fbbf24', marginTop: 2 }}>{value.toLocaleString()} <span style={{ fontSize: 11, fontWeight: 500, color: 'rgba(127, 220, 148, 0.7)' }}>{suffix}</span></div>
    </div>
  )
}

function Center({ children }: { children: React.ReactNode }) {
  return <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.4)' }}>{children}</div>
}
