'use client'

import { useEffect, useState } from 'react'

/**
 * 老板今日动作 — 4 张可点击行动卡
 * ⭐ P0 #5 奕霖 2026-07-20 16:57 — 老板视角汇总
 * 数据来源：/api/admin/today（4 张 raw SQL 并发查）
 */
interface OutOfStockItem {
  id: string
  productCode: string
  name: string
  shortName: string | null
  price: number
}

interface TodayData {
  emergencyChats: number
  pendingOrders: { count: number; amount: number }
  outOfStockTop5: OutOfStockItem[]
  activeGroupBuys: number
  totalChats: number
  todayRevenue: number
  date: string
  // ⭐ P0 #7 奕霖 2026-07-20 17:09 — 补货摘要
  restock?: {
    urgent: number
    totalValue: number
    top5: Array<{
      id: string
      productCode: string
      name: string
      shortName: string | null
      price: number
      stock: number
      sold30d: number
      daysLeft: number | null
      suggestedRestock: number
      urgency: 'critical_0' | 'restock' | 'warning' | 'critical_5' | 'normal'
    }>
  }
}

const cardBase: React.CSSProperties = {
  borderRadius: 16,
  padding: '18px 20px',
  background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
  border: '1px solid rgba(255,255,255,0.08)',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  position: 'relative',
  overflow: 'hidden',
}

const cardThemes = {
  emergency: {
    accent: 'linear-gradient(180deg, #ef4444 0%, transparent 100%)',
    glow: '0 4px 20px rgba(239,68,68,0.18)',
    icon: '🚨',
    label: '今日紧急问诊',
    hint: 'AI 药师自动捕获',
  },
  pending: {
    accent: 'linear-gradient(180deg, #f59e0b 0%, transparent 100%)',
    glow: '0 4px 20px rgba(245,158,11,0.16)',
    icon: '⏳',
    label: '待核销订单',
    hint: '到店凭码取货',
  },
  outOfStock: {
    accent: 'linear-gradient(180deg, #dc2626 0%, transparent 100%)',
    glow: '0 4px 20px rgba(220,38,38,0.20)',
    icon: '💊',
    label: '售罄商品 Top 5',
    hint: '点击去补货',
  },
  groupBuy: {
    accent: 'linear-gradient(180deg, #8b5cf6 0%, transparent 100%)',
    glow: '0 4px 20px rgba(139,92,246,0.16)',
    icon: '🎯',
    label: '进行中拼团',
    hint: '邀好友拼团',
  },
}

export default function TodayActions() {
  const [data, setData] = useState<TodayData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/today', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => { if (d.success) setData(d.today); })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 14,
        marginBottom: 18,
      }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{ ...cardBase, opacity: 0.4, cursor: 'default', padding: '28px 20px' }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>加载中…</div>
          </div>
        ))}
      </div>
    )
  }
  if (!data) return null

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
      gap: 14,
      marginBottom: 18,
    }}>
      {/* 🚨 紧急问诊 */}
      <div
        onClick={() => (window.location.href = '/admin/ai-chat?emergency=1')}
        style={{ ...cardBase, boxShadow: data.emergencyChats > 0 ? cardThemes.emergency.glow : 'none' }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
        onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
      >
        <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: cardThemes.emergency.accent }} />
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>{cardThemes.emergency.hint}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 32, fontWeight: 800, color: data.emergencyChats > 0 ? '#fca5a5' : '#fff' }}>
            {data.emergencyChats}
          </span>
          <span style={{ fontSize: 22 }}>{cardThemes.emergency.icon}</span>
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{cardThemes.emergency.label}</div>
        {data.emergencyChats > 0 && (
          <div style={{
            marginTop: 8, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
            background: 'rgba(239,68,68,0.2)', color: '#fca5a5', display: 'inline-block',
            animation: data.emergencyChats >= 1 ? 'tierPulse 2s ease-in-out infinite' : undefined,
          }}>
            需立即处理
          </div>
        )}
      </div>

      {/* ⏳ 待核销订单 */}
      <div
        onClick={() => (window.location.href = '/admin/orders?status=pending')}
        style={{ ...cardBase, boxShadow: data.pendingOrders.count > 0 ? cardThemes.pending.glow : 'none' }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
        onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
      >
        <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: cardThemes.pending.accent }} />
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>{cardThemes.pending.hint}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 32, fontWeight: 800, color: data.pendingOrders.count > 0 ? '#fcd34d' : '#fff' }}>
            {data.pendingOrders.count}
          </span>
          <span style={{ fontSize: 22 }}>{cardThemes.pending.icon}</span>
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{cardThemes.pending.label}</div>
        {data.pendingOrders.amount > 0 && (
          <div style={{ marginTop: 8, fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
            总额 ¥{data.pendingOrders.amount.toFixed(2)}
          </div>
        )}
      </div>

      {/* 💊 售罄 Top 5 */}
      <div
        onClick={() => (window.location.href = '/admin/products?tier=critical_0')}
        style={{ ...cardBase, boxShadow: data.outOfStockTop5.length > 0 ? cardThemes.outOfStock.glow : 'none' }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
        onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
      >
        <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: cardThemes.outOfStock.accent }} />
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>{cardThemes.outOfStock.hint}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 32, fontWeight: 800, color: data.outOfStockTop5.length > 0 ? '#fca5a5' : '#fff' }}>
            {data.outOfStockTop5.length}
          </span>
          <span style={{ fontSize: 22 }}>{cardThemes.outOfStock.icon}</span>
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{cardThemes.outOfStock.label}</div>
        {data.outOfStockTop5.length > 0 && (
          <div style={{ marginTop: 8, fontSize: 10, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
            {data.outOfStockTop5.slice(0, 3).map((p) => (
              <div key={p.id} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                · {p.shortName || p.name}
              </div>
            ))}
            {data.outOfStockTop5.length > 3 && (
              <div style={{ fontSize: 9, marginTop: 2 }}>等 {data.outOfStockTop5.length} 件</div>
            )}
          </div>
        )}
      </div>

      {/* 🎯 进行中拼团 */}
      <div
        onClick={() => (window.location.href = '/admin/groupbuys')}
        style={{ ...cardBase, boxShadow: data.activeGroupBuys > 0 ? cardThemes.groupBuy.glow : 'none' }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
        onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
      >
        <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: cardThemes.groupBuy.accent }} />
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>{cardThemes.groupBuy.hint}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 32, fontWeight: 800, color: data.activeGroupBuys > 0 ? '#c4b5fd' : '#fff' }}>
            {data.activeGroupBuys}
          </span>
          <span style={{ fontSize: 22 }}>{cardThemes.groupBuy.icon}</span>
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{cardThemes.groupBuy.label}</div>
      </div>

      {/* 📦 P0 #7 今日应补货 Top（30 天销量反推） */}
      {data.restock && data.restock.top5.length > 0 && (
        <div
          onClick={() => (window.location.href = '/admin/products?restock=urgent')}
          style={{
            ...cardBase,
            gridColumn: 'span 2',
            boxShadow: data.restock.urgent > 0
              ? '0 4px 20px rgba(34,197,94,0.20)'
              : 'none',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
        >
          <div style={{
            position: 'absolute', top: 0, left: 0, width: 4, height: '100%',
            background: 'linear-gradient(180deg, #22c55e 0%, transparent 100%)',
          }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>30 天销量反推</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                <span style={{ fontSize: 28, fontWeight: 800, color: data.restock.urgent > 0 ? '#86efac' : '#fff' }}>
                  {data.restock.urgent}
                </span>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>件应补 · ¥{data.restock.totalValue.toFixed(0)}</span>
              </div>
            </div>
            <span style={{ fontSize: 28 }}>📦</span>
          </div>
          {/* Top 3 列表（紧凑） */}
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', lineHeight: 1.7 }}>
            {data.restock.top5.slice(0, 3).map((p, i) => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, minWidth: 0,
                }}>
                  {i + 1}. {p.shortName || p.name}
                </span>
                <span style={{
                  color: p.urgency === 'restock' ? '#86efac' : p.urgency === 'warning' ? '#fde047' : '#9ca3af',
                  fontWeight: 600, flexShrink: 0,
                }}>
                  +{p.suggestedRestock}
                </span>
              </div>
            ))}
            {data.restock.top5.length > 3 && (
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                等 {data.restock.top5.length} 件（点击看全部）
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes tierPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.55; }
        }
      `}</style>
    </div>
  )
}
