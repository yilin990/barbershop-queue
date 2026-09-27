'use client'

/**
 * ⭐ 我常买的 — 自动从订单历史算 Top 5
 * ⭐ MEMORY §270+ — 奕霖 2026-08-25 加 / 2026-08-26 抽共享组件
 *
 * 设计：
 * - 自动从 /api/orders 拉订单，按 productId 聚合
 * - 只算已完成的（cancelled 不算）
 * - Top 5 按购买次数降序
 * - 空订单显示"还没有订单记录"引导
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'

const GREEN = '#b8860b'
const GREEN_RGBA = '184, 134, 11'

interface FrequentItem {
  productId: string
  productName: string
  productImage?: string
  productSpec?: string
  price: number
  buyCount: number
  totalQty: number
  totalSpent: number
  lastBoughtAt: string
}

export default function FrequentItems({ phone, embedded = false }: { phone?: string; embedded?: boolean }) {
  const [items, setItems] = useState<FrequentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [totalOrders, setTotalOrders] = useState(0)
  const [totalSpent, setTotalSpent] = useState(0)

  useEffect(() => {
    if (!phone) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    fetch(`/api/orders?phone=${phone}&limit=100`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        const orders: any[] = data?.orders || []
        const map = new Map<string, FrequentItem>()
        for (const o of orders) {
          if (o.status === 'cancelled') continue
          for (const it of o.items || []) {
            const ex = map.get(it.productId)
            const qty = Number(it.quantity || 0)
            const created = o.createdAt
            if (ex) {
              ex.buyCount += 1
              ex.totalQty += qty
              ex.totalSpent += Number(it.subtotal || it.price * qty || 0)
              if (new Date(created) > new Date(ex.lastBoughtAt)) ex.lastBoughtAt = created
            } else {
              map.set(it.productId, {
                productId: it.productId,
                productName: it.productName,
                productImage: it.productImage,
                productSpec: it.productSpec,
                price: Number(it.price || 0),
                buyCount: 1,
                totalQty: qty,
                totalSpent: Number(it.subtotal || it.price * qty || 0),
                lastBoughtAt: created,
              })
            }
          }
        }
        const list = Array.from(map.values())
          .sort((a, b) => b.buyCount - a.buyCount || b.totalSpent - a.totalSpent)
          .slice(0, 5)
        setItems(list)
        setTotalOrders(orders.filter((o) => o.status !== 'cancelled').length)
        setTotalSpent(orders
          .filter((o) => o.status !== 'cancelled')
          .reduce((sum, o) => sum + Number(o.finalAmount || o.totalAmount || 0), 0))
        setLoading(false)
      })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [phone])

  return (
    <div style={{
      marginTop: embedded ? 0 : 16,
      background: embedded
        ? 'transparent'
        : 'linear-gradient(135deg, rgba(184, 134, 11,0.08), rgba(44,24,16,0.3))',
      borderRadius: embedded ? 0 : 16, padding: embedded ? 0 : 16,
      border: embedded ? 'none' : `1px solid rgba(${GREEN_RGBA}, 0.18)`,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 12,
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>
          ⭐ 我常买的
        </div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>
          自动从订单历史算
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '20px 0', color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
          正在回忆你买过什么…
        </div>
      )}

      {!loading && items.length === 0 && (
        <div style={{ textAlign: 'center', padding: '20px 0', color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
          <div style={{ fontSize: 28, marginBottom: 6 }}>🛒</div>
          还没有订单记录
          <div style={{ marginTop: 6, fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
            买过一次后，造型助手会记住你最爱什么
          </div>
          <Link href="/ai-find-drug" style={{
            display: 'inline-block', marginTop: 10, padding: '6px 14px',
            background: 'rgba(184, 134, 11,0.15)',
            color: GREEN, fontSize: 12, fontWeight: 600,
            borderRadius: 8, textDecoration: 'none',
          }}>🛒 去逛逛果蔬 →</Link>
        </div>
      )}

      {!loading && items.length > 0 && (
        <>
          <div style={{
            display: 'flex', gap: 8, marginBottom: 12,
            padding: '8px 10px',
            background: 'rgba(0,0,0,0.25)', borderRadius: 8,
          }}>
            <Stat label="订单" value={String(totalOrders)} />
            <Stat label="种商品" value={String(items.length)} />
            <Stat label="总消费" value={`¥${totalSpent.toFixed(0)}`} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {items.map((it, idx) => (
              <Link
                key={it.productId}
                href={`/products/${it.productId}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 10px',
                  background: 'rgba(44,24,16,0.5)',
                  border: '1px solid rgba(184, 134, 11,0.12)',
                  borderRadius: 10, textDecoration: 'none',
                  color: '#fff',
                }}
              >
                <div style={{
                  fontSize: 12, fontWeight: 800, color: GREEN,
                  width: 18, textAlign: 'center', flexShrink: 0,
                }}>{idx + 1}</div>
                {it.productImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.productImage} alt={it.productName}
                    style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }}
                  />
                ) : (
                  <div style={{
                    width: 36, height: 36, borderRadius: 6,
                    background: 'rgba(184, 134, 11,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, flexShrink: 0,
                  }}>🥬</div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 12, fontWeight: 600,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{it.productName}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 1 }}>
                    ¥{it.price.toFixed(2)}{it.productSpec ? ` · ${it.productSpec}` : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 11, color: GREEN, fontWeight: 700 }}>
                    ×{it.buyCount}
                  </div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>次</div>
                </div>
              </Link>
            ))}
          </div>

          <div style={{
            marginTop: 10, padding: '8px 10px',
            background: 'rgba(184, 134, 11,0.08)',
            borderRadius: 8, fontSize: 11, color: 'rgba(255,255,255,0.7)',
            lineHeight: 1.6,
          }}>
            🌿 <span style={{ color: GREEN, fontWeight: 700 }}>造型助手记住了</span> —
            下次聊天会主动推荐，不用再说"我想买上次那个"
          </div>
        </>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: GREEN }}>{value}</div>
      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginTop: 1 }}>{label}</div>
    </div>
  )
}
