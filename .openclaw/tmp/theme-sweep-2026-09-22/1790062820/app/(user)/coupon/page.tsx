'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/AppLayout'
import { useUserStore } from '@/stores/userStore'

interface Coupon {
  id: string
  code: string
  name: string
  type: string
  value: number
  minSpend: number
  expiresAt: string
  status: 'unused' | 'used' | 'expired'
  createdAt: string
}

type Tab = 'unused' | 'used' | 'expired'

/**
 * ⭐ 奕霖 2026-08-05 15:22 需求：优惠券独立板块
 * - 用户视角：所有可用券（待使用 / 已使用 / 已过期）
 * - 核心操作：去使用 / 转赠（手机号）
 * - 空状态：去 /activity 领券
 */
export default function CouponPage() {
  const router = useRouter()
  const { user } = useUserStore()
  const phone = user?.phone || ''

  const [tab, setTab] = useState<Tab>('unused')
  const [list, setList] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [transferOf, setTransferOf] = useState<Coupon | null>(null)
  const [transferPhone, setTransferPhone] = useState('')
  const [toast, setToast] = useState<{ text: string; kind: 'ok' | 'err' } | null>(null)

  const showToast = (text: string, kind: 'ok' | 'err' = 'ok') => {
    setToast({ text, kind })
    setTimeout(() => setToast(null), 2200)
  }

  const load = () => {
    if (!phone) {
      setLoading(false)
      return
    }
    setLoading(true)
    fetch(`/api/coupons/my?phone=${phone}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setList(d.coupons || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(load, [phone])

  const now = Date.now()
  const enriched: Coupon[] = list.map((c) => ({
    ...c,
    status: c.status === 'used' ? 'used' : new Date(c.expiresAt).getTime() < now ? 'expired' : c.status,
  }))

  const stats = {
    unused: enriched.filter((c) => c.status === 'unused').length,
    used: enriched.filter((c) => c.status === 'used').length,
    expired: enriched.filter((c) => c.status === 'expired').length,
  }

  const filtered = enriched
    .filter((c) => c.status === tab)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const daysLeft = (c: Coupon) => {
    return Math.ceil((new Date(c.expiresAt).getTime() - now) / 86400000)
  }

  const handleTransfer = async () => {
    if (!transferOf || !transferPhone) return
    if (!/^1[3-9]\d{9}$/.test(transferPhone)) {
      showToast('请输入有效手机号', 'err')
      return
    }
    if (transferPhone === phone) {
      showToast('不能转赠给自己', 'err')
      return
    }
    const res = await fetch('/api/coupons/transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ couponId: transferOf.id, fromPhone: phone, toPhone: transferPhone }),
    })
    const data = await res.json()
    if (data.success) {
      showToast('✓ 转赠成功', 'ok')
      setTransferOf(null)
      setTransferPhone('')
      load()
    } else {
      showToast(data.error || '转赠失败', 'err')
    }
  }

  return (
    <AppLayout title="我的优惠券" activePath="/coupon">
      <div style={{ minHeight: '100vh', background: 'radial-gradient(ellipse at top, rgba(127, 220, 148, 0.12) 0%, transparent 50%), linear-gradient(180deg, #0a1410 0%, #060a08 100%)', color: '#fff', fontFamily: '-apple-system, "PingFang SC", sans-serif' }}>
        {/* Header */}
        <div style={{ padding: '20px 16px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.back()} style={{ background: 'rgba(127, 220, 148, 0.08)', color: '#fbbf24', padding: '6px 12px', borderRadius: 8, border: 'none', fontSize: 12, cursor: 'pointer' }}>← 返回</button>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>🎟️ 我的优惠券</h1>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, padding: '0 16px 16px' }}>
          <div style={{ background: 'linear-gradient(135deg, rgba(127, 220, 148, 0.15), rgba(127, 220, 148, 0.05))', border: '1px solid rgba(127, 220, 148, 0.3)', borderRadius: 12, padding: '14px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#fbbf24' }}>{stats.unused}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>待使用</div>
          </div>
          <div style={{ background: 'linear-gradient(135deg, rgba(127, 220, 148, 0.15), rgba(127, 220, 148, 0.05))', border: '1px solid rgba(127, 220, 148, 0.3)', borderRadius: 12, padding: '14px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#fbbf24' }}>{stats.used}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>已使用</div>
          </div>
          <div style={{ background: 'linear-gradient(135deg, rgba(127, 220, 148, 0.15), rgba(127, 220, 148, 0.05))', border: '1px solid rgba(127, 220, 148, 0.3)', borderRadius: 12, padding: '14px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#fbbf24' }}>{stats.expired}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>已过期</div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, padding: '4px', borderRadius: 12, background: 'rgba(127, 220, 148, 0.06)', border: '1px solid rgba(127, 220, 148, 0.12)', margin: '0 16px 16px' }}>
          {[
            { key: 'unused' as Tab, label: `待使用 (${stats.unused})` },
            { key: 'used' as Tab, label: `已使用 (${stats.used})` },
            { key: 'expired' as Tab, label: `已过期 (${stats.expired})` },
          ].map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              flex: 1, padding: '10px',
              borderRadius: 10, border: 'none', cursor: 'pointer',
              background: tab === t.key ? 'rgba(127, 220, 148, 0.15)' : 'transparent',
              color: tab === t.key ? '#fbbf24' : 'rgba(255,255,255,0.6)',
              fontSize: 13, fontWeight: 600,
              transition: 'all 0.2s ease',
            }}>{t.label}</button>
          ))}
        </div>

        {/* List */}
        <div style={{ padding: '0 16px 100px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.5)' }}>加载中...</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🎟️</div>
              <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.6)', marginBottom: 20 }}>
                {tab === 'unused' ? '暂无待使用优惠券' : tab === 'used' ? '暂无已使用优惠券' : '暂无已过期优惠券'}
              </div>
              {tab === 'unused' && (
                <button onClick={() => router.push('/activity#claim-coupons')} style={{
                  padding: '10px 20px', borderRadius: 12,
                  background: 'rgba(127, 220, 148, 0.15)',
                  border: '1px solid rgba(127, 220, 148, 0.3)',
                  color: '#fbbf24', fontSize: 13, fontWeight: 600,
                  cursor: 'pointer',
                }}>去活动领券 →</button>
              )}
            </div>
          ) : (
            filtered.map((c) => {
              const days = daysLeft(c)
              const isExpiring = days <= 3 && days > 0 && tab === 'unused'
              return (
                <div key={c.id} style={{
                  background: 'linear-gradient(135deg, rgba(127, 220, 148, 0.12) 0%, rgba(127, 220, 148, 0.04) 100%)',
                  border: '1px solid rgba(127, 220, 148, 0.25)',
                  borderRadius: 14, padding: 16, marginBottom: 12,
                  display: 'flex', alignItems: 'center', gap: 14,
                  opacity: tab === 'expired' ? 0.5 : 1,
                }}>
                  <div style={{
                    minWidth: 80, textAlign: 'center',
                    padding: '10px 8px',
                    background: 'rgba(127, 220, 148, 0.2)',
                    borderRadius: 10,
                  }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#fbbf24' }}>
                      {c.type === 'discount' ? `${c.value * 10}折` : `¥${c.value}`}
                    </div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>
                      {c.minSpend > 0 ? `满¥${c.minSpend}` : '无门槛'}
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 4 }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
                      {tab === 'unused' && (isExpiring ? `⚠️ ${days}天后过期` : `${days}天有效`)}
                      {tab === 'used' && '已使用'}
                      {tab === 'expired' && '已过期'}
                    </div>
                    <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
                      码：{c.code}
                    </div>
                  </div>
                  {tab === 'unused' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <button onClick={() => router.push('/products')} style={{
                        padding: '6px 12px', borderRadius: 8,
                        background: '#fbbf24', color: '#0a0f0d',
                        fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                      }}>去使用</button>
                      <button onClick={() => setTransferOf(c)} style={{
                        padding: '6px 12px', borderRadius: 8,
                        background: 'rgba(127, 220, 148, 0.15)', color: '#fbbf24',
                        border: '1px solid rgba(127, 220, 148, 0.3)',
                        fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      }}>转赠</button>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Transfer Modal */}
        {transferOf && (
          <div onClick={() => setTransferOf(null)} style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16,
          }}>
            <div onClick={(e) => e.stopPropagation()} style={{
              background: 'linear-gradient(180deg, #0f1612 0%, #0a0f0d 100%)',
              border: '1px solid rgba(127, 220, 148, 0.2)', borderRadius: 16,
              padding: 24, maxWidth: 360, width: '100%',
            }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fff', margin: '0 0 16px' }}>🎁 转赠优惠券</h3>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 16 }}>
                将「{transferOf.name}」转赠给其他用户
              </div>
              <input type="tel" placeholder="对方手机号" value={transferPhone}
                onChange={(e) => setTransferPhone(e.target.value)}
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 10,
                  background: 'rgba(255, 255, 255, 0.06)', border: '1px solid rgba(127, 220, 148, 0.3)',
                  color: '#fff', fontSize: 14, marginBottom: 16, boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setTransferOf(null)} style={{
                  flex: 1, padding: '12px', borderRadius: 10,
                  background: 'rgba(127, 220, 148, 0.08)', border: '1px solid rgba(127, 220, 148, 0.2)',
                  color: '#fbbf24', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                }}>取消</button>
                <button onClick={handleTransfer} style={{
                  flex: 2, padding: '12px', borderRadius: 10,
                  background: '#fbbf24', border: 'none',
                  color: '#0a0f0d', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                }}>✓ 确认转赠</button>
              </div>
            </div>
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div style={{
            position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)',
            background: toast.kind === 'ok' ? 'rgba(127, 220, 148, 0.95)' : 'rgba(255, 100, 100, 0.95)',
            color: '#0a0f0d', padding: '12px 20px', borderRadius: 10,
            fontSize: 14, fontWeight: 600, zIndex: 99999,
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
          }}>
            {toast.text}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
