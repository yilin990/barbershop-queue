'use client'

import { toast } from '@/lib/ui-bus'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/AppLayout'

const DEMO_PHONE = '13800138000'

interface Coupon {
  id: string
  code: string
  name: string
  type: string
  value: number
  minSpend: number
  status: string
  expiresAt: string
  createdAt: string
}

export default function MyCouponsPage() {
  const router = useRouter()
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'unused' | 'used' | 'expired'>('unused')

  useEffect(() => {
    const fetchCoupons = async () => {
      try {
        const res = await fetch(`/api/coupons/claim?phone=${DEMO_PHONE}`)
        const json = await res.json()
        if (json.success) {
          setCoupons(json.coupons)
        }
      } catch (e) {
        console.error('Fetch coupons failed:', e)
      } finally {
        setLoading(false)
      }
    }
    fetchCoupons()
  }, [])

  const now = new Date()
  const isExpired = (c: Coupon) => new Date(c.expiresAt) < now

  // 分组
  const unused = coupons.filter((c) => c.status === 'unused' && !isExpired(c))
  const used = coupons.filter((c) => c.status === 'used')
  const expired = coupons.filter((c) => isExpired(c) && c.status !== 'used')

  const tabs = [
    { key: 'unused' as const, label: '未使用', count: unused.length, color: '#fbbf24' },
    { key: 'used' as const, label: '已使用', count: used.length, color: '#9ca3af' },
    { key: 'expired' as const, label: '已过期', count: expired.length, color: '#ff9a6b' },
  ]
  const currentList = activeTab === 'unused' ? unused : activeTab === 'used' ? used : expired

  // 计算剩余天数
  const daysLeft = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - now.getTime()
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
  }

  return (
    <AppLayout title="我的优惠券" showHeader>
      <div style={{ padding: '16px', paddingBottom: '100px' }}>
        {/* 顶部统计 */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px',
          marginBottom: '16px',
        }}>
          {tabs.map((t) => (
            <div key={t.key} style={{
              padding: '16px 12px', borderRadius: '14px',
              background: activeTab === t.key
                ? `linear-gradient(135deg, ${t.color}22 0%, ${t.color}11 100%)`
                : 'rgba(255, 255, 255, 0.04)',
              border: activeTab === t.key
                ? `1px solid ${t.color}55`
                : '1px solid rgba(255, 255, 255, 0.06)',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }} onClick={() => setActiveTab(t.key)}>
              <div style={{ fontSize: '24px', fontWeight: 700, color: t.color, marginBottom: '4px' }}>
                {t.count}
              </div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>{t.label}</div>
            </div>
          ))}
        </div>

        {/* 标签页切换条 */}
        <div style={{
          display: 'flex', gap: '4px', padding: '4px',
          borderRadius: '12px', background: 'rgba(255, 255, 255, 0.04)',
          marginBottom: '16px',
        }}>
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
              flex: 1, padding: '10px',
              borderRadius: '10px', border: 'none', cursor: 'pointer',
              background: activeTab === t.key ? 'rgba(127, 220, 148, 0.15)' : 'transparent',
              color: activeTab === t.key ? '#fbbf24' : 'rgba(255,255,255,0.6)',
              fontSize: '13px', fontWeight: 600,
            }}>{t.label} ({t.count})</button>
          ))}
        </div>

        {/* 券列表 */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.4)' }}>
            加载中…
          </div>
        ) : currentList.length === 0 ? (
          <div style={{
            padding: '40px 20px', textAlign: 'center',
            borderRadius: '16px', background: 'rgba(255, 255, 255, 0.03)',
            border: '1px dashed rgba(127, 220, 148, 0.2)',
          }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>
              {activeTab === 'unused' ? '🎁' : activeTab === 'used' ? '✓' : '⏰'}
            </div>
            <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>
              {activeTab === 'unused' ? '还没有优惠券' : activeTab === 'used' ? '还没有使用过' : '没有过期券'}
            </div>
            {activeTab === 'unused' && (
              <button
                onClick={() => router.push('/activity#claim-coupons')}
                style={{
                  marginTop: '12px', padding: '8px 20px', borderRadius: '16px',
                  background: '#fbbf24', color: '#0a0f0d', border: 'none',
                  fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                }}>去活动页领券 →</button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {currentList.map((c) => {
              const days = daysLeft(c.expiresAt)
              return (
                <div key={c.id} style={{
                  position: 'relative',
                  padding: '14px 16px',
                  borderRadius: '14px',
                  background: activeTab === 'unused'
                    ? 'linear-gradient(135deg, rgba(255, 107, 107, 0.15) 0%, rgba(244, 114, 182, 0.1) 100%)'
                    : 'rgba(255, 255, 255, 0.04)',
                  border: activeTab === 'unused'
                    ? '1px solid rgba(255, 107, 107, 0.3)'
                    : '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex', alignItems: 'center', gap: '12px',
                  overflow: 'hidden',
                }}>
                  {/* 左侧：面值 */}
                  <div style={{
                    flexShrink: 0,
                    width: '70px', textAlign: 'center',
                    borderRight: '1px dashed rgba(255,255,255,0.15)',
                    paddingRight: '12px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '2px' }}>
                      <span style={{ fontSize: '12px', color: '#ff9a6b' }}>¥</span>
                      <span style={{ fontSize: '28px', fontWeight: 800, color: '#ff9a6b', lineHeight: 1 }}>
                        {c.value}
                      </span>
                    </div>
                    <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>
                      满{c.minSpend}可用
                    </div>
                  </div>

                  {/* 中间：详情 */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff', marginBottom: '4px' }}>
                      {c.name}
                    </div>
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>
                      {activeTab === 'unused' && days > 0 && (
                        <>⏰ 剩 {days} 天过期</>
                      )}
                      {activeTab === 'unused' && days === 0 && (
                        <span style={{ color: '#ff6b6b' }}>⚠️ 今日过期</span>
                      )}
                      {activeTab === 'used' && c.id && (
                        <>已使用 · {new Date(c.expiresAt).toLocaleDateString('zh-CN')}</>
                      )}
                      {activeTab === 'expired' && (
                        <>{new Date(c.expiresAt).toLocaleDateString('zh-CN')} 过期</>
                      )}
                    </div>
                    <div style={{
                      fontSize: '10px', color: 'rgba(255,255,255,0.35)',
                      marginTop: '4px', fontFamily: 'monospace',
                    }}>
                      码: {c.code}
                    </div>
                  </div>

                  {/* 右侧：状态/按钮 */}
                  <div style={{ flexShrink: 0 }}>
                    {activeTab === 'unused' && (
                      <button
                        onClick={() => toast.success(`🎉 跳转到结算页\n\n优惠码: ${c.code}\n优惠: 满 ${c.minSpend} 减 ${c.value}`)}
                        style={{
                          padding: '8px 14px', borderRadius: '14px', border: 'none',
                          background: '#ff9a6b', color: '#0a0f0d',
                          fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                        }}>去使用</button>
                    )}
                    {activeTab === 'used' && (
                      <span style={{
                        fontSize: '10px', padding: '4px 10px', borderRadius: '10px',
                        background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)',
                      }}>已使用</span>
                    )}
                    {activeTab === 'expired' && (
                      <span style={{
                        fontSize: '10px', padding: '4px 10px', borderRadius: '10px',
                        background: 'rgba(255, 107, 107, 0.1)', color: '#ff6b6b',
                      }}>已过期</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
