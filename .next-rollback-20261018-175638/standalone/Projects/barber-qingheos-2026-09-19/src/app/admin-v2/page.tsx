'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import AdminGate from '@/components/AdminGate'

interface Stat { value: number; trend: string; spark: number[]; label: string; prefix?: string; warn?: boolean }
interface Todo { type: string; title: string; meta: string; action: string }
interface Log { id: string; action: string; text: string; actor: string; time: string; relative: string }

export default function AdminV2Page() {
  const [data, setData] = useState<{ stats: Record<string, Stat>; todos: Todo[]; timeline: Log[]; meta: any } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/admin-v2/dashboard')
      .then((r) => r.json())
      .then((d) => { if (d.success) setData(d); else setError(d.error || '加载失败') })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <AdminGate>
      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', minHeight: '100vh', background: 'linear-gradient(180deg, #0a0f0d 0%, #050807 100%)', color: '#fff', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "PingFang SC", sans-serif' }}>
        <Sidebar />
        <Main loading={loading} error={error} data={data} />
      </div>
    </AdminGate>
  )
}

function Sidebar() {
  const itemStyle = (active = false): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
    borderRadius: 8, fontSize: 13, cursor: 'pointer', marginBottom: 2,
    color: active ? '#b8860b' : 'rgba(255,255,255,0.7)',
    background: active ? 'rgba(184, 134, 11, 0.12)' : 'transparent',
    fontWeight: active ? 600 : 400,
  })
  return (
    <aside style={{ background: 'rgba(20, 28, 24, 0.6)', borderRight: '1px solid rgba(184, 134, 11, 0.08)', padding: '20px 16px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 8px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)', marginBottom: 16 }}>
        <span style={{ fontSize: 22 }}><Coffee size={22} strokeWidth={1.5} style={{ display: 'inline-block', verticalAlign: 'middle' }} /></span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#b8860b' }}>造型后台</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>v2 真实数据版</div>
        </div>
      </div>

      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 1.2, padding: '0 8px 8px' }}>主导航</div>
      <div style={itemStyle(true)}><BarChart3 size={12} strokeWidth={1.5} style={{ marginRight: 4, verticalAlign: '-2px', display: 'inline-block' }} />数据概览</div>
      <div style={itemStyle()}><Store size={12} strokeWidth={1.5} style={{ marginRight: 4, verticalAlign: '-2px', display: 'inline-block' }} />商户管理</div>
      <div style={itemStyle()}>👥 会员管理</div>
      <div style={itemStyle()}><Pill size={12} strokeWidth={1.5} style={{ marginRight: 4, verticalAlign: '-2px', display: 'inline-block' }} />药品管理</div>
      <div style={itemStyle()}><Gift size={12} strokeWidth={1.5} style={{ marginRight: 4, verticalAlign: '-2px', display: 'inline-block' }} />活动管理</div>
      <div style={itemStyle()}>📣 广告宣传</div>

      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 1.2, padding: '0 8px 8px', marginTop: 16 }}>运营</div>
      <div style={itemStyle()}><ClipboardList size={12} strokeWidth={1.5} style={{ marginRight: 4, verticalAlign: '-2px', display: 'inline-block' }} />订单管理</div>
      <div style={itemStyle()}>🛡 反馈中心</div>
      <div style={itemStyle()}>📜 审计日志</div>

      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 1.2, padding: '0 8px 8px', marginTop: 16 }}>系统</div>
      <div style={itemStyle()}>⚙ 设置</div>

      <div style={{ flex: 1 }} />

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: 12, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 8px' }}>
        <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg, #b8860b, #34c87b)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#0a3a1f' }}>奕</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 600 }}>奕霖</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>Owner</div>
        </div>
      </div>
      <Link href="/me" style={{ display: 'block', padding: '8px 12px', marginTop: 8, fontSize: 12, color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}>← 返回我的</Link>
      <Link href="/admin" style={{ display: 'block', padding: '8px 12px', fontSize: 11, color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>↩ v1 旧版</Link>
    </aside>
  )
}

function Main({ loading, error, data }: { loading: boolean; error: string; data: any }) {
  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>加载中…</div>
  if (error) return <div style={{ padding: 60, textAlign: 'center', color: '#ef4444' }}>❌ {error}</div>
  if (!data) return null

  return (
    <main style={{ padding: '24px 32px', overflowY: 'auto', color: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}><BarChart3 size={12} strokeWidth={1.5} style={{ marginRight: 4, verticalAlign: '-2px', display: 'inline-block' }} />数据概览</h1>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{data.meta?.date} · {new Date(data.meta?.lastUpdate).toLocaleTimeString('zh-CN', { hour12: false })}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        <StatCard icon={Package} stat={data.stats.orders} />
        <StatCard icon={DollarSign} stat={data.stats.revenue} />
        <StatCard icon="👥" stat={data.stats.members} />
        <StatCard icon="🛡" stat={data.stats.pending} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <Card title="⚠️ 待办" count={data.todos.length}>
          {data.todos.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 13 }}><CheckCircle size={12} strokeWidth={1.5} style={{ marginRight: 4, verticalAlign: '-2px', display: 'inline-block' }} />暂无待办</div>
          ) : (
            data.todos.map((t: Todo, i: number) => (
              <div key={i} style={{ display: 'flex', gap: 12, padding: 12, borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', marginBottom: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 18 }}>{t.type === 'feedback' ? '🛡' : '💊'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: '#fff', fontWeight: 600 }}>{t.title}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{t.meta}</div>
                </div>
                <button style={{ padding: '4px 10px', borderRadius: 6, background: 'rgba(184, 134, 11, 0.15)', color: '#b8860b', fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>{t.action}</button>
              </div>
            ))
          )}
        </Card>

        <Card title="📜 最近活动" count="实时" live>
          {data.timeline.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>暂无活动</div>
          ) : (
            data.timeline.map((l: Log) => {
              const dotColor = l.action === 'warn_merchant' ? '#ef4444' : l.action === 'content_reported' ? '#f59e0b' : l.action === 'stock_low' ? '#a78bfa' : '#b8860b'
              const dotBg = l.action === 'warn_merchant' ? 'rgba(239,68,68,0.2)' : l.action === 'content_reported' ? 'rgba(245,158,11,0.2)' : l.action === 'stock_low' ? 'rgba(167,139,250,0.2)' : 'rgba(184, 134, 11,0.2)'
              const icon = l.action === 'warn_merchant' ? '⚠' : l.action === 'content_reported' ? '📝' : l.action === 'stock_low' ? '💊' : l.action === 'order_completed' ? '✓' : '💬'
              return (
                <div key={l.id} style={{ display: 'flex', gap: 12, paddingBottom: 12, position: 'relative' }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: dotBg, color: dotColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, flexShrink: 0 }}>{icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)' }}>
                      <strong style={{ color: '#fff' }}>{l.actor === 'admin' ? '奕霖' : l.actor === 'customer' ? '顾客' : l.actor === 'system' ? '系统' : '店员'}</strong>{' '}
                      {l.text}
                    </div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{l.relative}</div>
                  </div>
                </div>
              )
            })
          )}
        </Card>
      </div>

      <div style={{ background: 'linear-gradient(135deg, rgba(184, 134, 11, 0.15), rgba(52, 200, 123, 0.05))', border: '1px solid rgba(184, 134, 11, 0.3)', borderRadius: 14, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ fontSize: 24 }}>🧪</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#b8860b' }}>v2 真实数据版</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>走的是 SQLite 真表，不是 mock。审计日志来自 AuditLog 表</div>
        </div>
        <Link href="/admin" style={{ padding: '8px 14px', borderRadius: 8, background: 'rgba(184, 134, 11, 0.15)', color: '#b8860b', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>回退 v1</Link>
      </div>
    </main>
  )
}

function StatCard({ icon, stat }: { icon: string; stat: Stat }) {
  const max = Math.max(...stat.spark, 1)
  return (
    <div style={{
      background: stat.warn
        ? 'linear-gradient(180deg, rgba(74, 30, 30, 0.4) 0%, rgba(58, 26, 26, 0.6) 100%)'
        : 'linear-gradient(180deg, rgba(44, 24, 16, 0.4) 0%, rgba(58, 36, 22, 0.6) 100%)',
      border: `1px solid ${stat.warn ? 'rgba(239,68,68,0.3)' : 'rgba(184, 134, 11,0.15)'}`,
      borderRadius: 14, padding: 18,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <span style={{
          fontSize: 11, padding: '2px 8px', borderRadius: 6, fontWeight: 700,
          background: stat.warn ? 'rgba(239,68,68,0.15)' : 'rgba(184, 134, 11,0.15)',
          color: stat.warn ? '#ef4444' : '#b8860b',
        }}>{stat.trend}</span>
      </div>
      <div style={{ fontSize: 32, fontWeight: 800, lineHeight: 1, marginBottom: 6, color: stat.warn ? '#ef4444' : '#fff' }}>
        {stat.prefix || ''}{typeof stat.value === 'number' ? (stat.prefix === '¥' ? stat.value.toFixed(0) : stat.value) : stat.value}
      </div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 10 }}>{stat.label}</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 32 }}>
        {stat.spark.map((v, i) => (
          <div key={i} style={{
            flex: 1, height: `${(v / max) * 100}%`, minHeight: 4,
            background: stat.warn ? '#ef4444' : (i === stat.spark.length - 1 ? '#b8860b' : 'rgba(184, 134, 11,0.4)'),
            borderRadius: 2,
          }} />
        ))}
      </div>
    </div>
  )
}

function Card({ title, count, children, live }: { title: string; count: number | string; children: React.ReactNode; live?: boolean }) {
  return (
    <div style={{ background: 'rgba(20, 28, 24, 0.5)', border: '1px solid rgba(184, 134, 11, 0.08)', borderRadius: 14, padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 14, fontWeight: 700 }}>{title}</span>
        <span style={{
          marginLeft: 'auto', padding: '1px 8px', borderRadius: 8, fontSize: 10, fontWeight: 700,
          background: live ? 'rgba(184, 134, 11, 0.15)' : 'rgba(239, 68, 68, 0.2)',
          color: live ? '#b8860b' : '#ef4444',
        }}>{count}</span>
      </div>
      {children}
    </div>
  )
}
