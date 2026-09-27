'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import AppLayout from '@/components/AppLayout'
import { quickAddToCart, getCartCount } from '@/lib/cart'

interface FlashItem {
  id: string
  name: string
  spec: string | null
  price: number
  originalPrice?: number
  stock: number
  image: string | null
  category: string
}

/** Demo 使用的 phone（真实场景从 userStore 取） */
const DEMO_PHONE = '13800138000'

// 倒计时 hook（基于 server time 算差值）
function useCountdown(endAtIso: string | null) {
  const [remain, setRemain] = useState<number>(() =>
    endAtIso ? Math.max(0, new Date(endAtIso).getTime() - Date.now()) : 0
  )
  useEffect(() => {
    if (!endAtIso) return
    const t = setInterval(() => {
      const r = Math.max(0, new Date(endAtIso).getTime() - Date.now())
      setRemain(r)
    }, 1000)
    return () => clearInterval(t)
  }, [endAtIso])
  const h = Math.floor(remain / 3_600_000)
  const m = Math.floor((remain % 3_600_000) / 60_000)
  const s = Math.floor((remain % 60_000) / 1000)
  return { h, m, s, done: remain <= 0 }
}

// Toast（替换 alert）
function useToast() {
  const [msg, setMsg] = useState<{ text: string; kind: 'ok' | 'err' } | null>(null)
  const show = (text: string, kind: 'ok' | 'err' = 'ok') => {
    setMsg({ text, kind })
    setTimeout(() => setMsg(null), 2200)
  }
  return { msg, show }
}

type Banner = { id: string; title: string; subtitle: string; description: string; coverImage: string; endAt: string }
type FlashSale = { id: string; title: string; subtitle: string; productIds: string[]; endAt: string }
type Discount = { id: string; title: string; subtitle: string; description: string; endAt: string }
type Coupon = { id: string; name: string; value: number; minSpend: number; expiresAt: string }
type GroupBuy = {
  id: string
  productId: string | null
  productName: string
  productSpec: string | null
  originalPrice: number
  groupPrice: number
  requiredPeople: number
  currentPeople: number
  expiresAt: string
  icon: string
}

export default function ActivityPage() {
  const [loading, setLoading] = useState(true)
  const [banners, setBanners] = useState<Banner[]>([])
  const [flashSales, setFlashSales] = useState<FlashSale[]>([])
  const [discounts, setDiscounts] = useState<Discount[]>([])
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [claimedIds, setClaimedIds] = useState<Set<string>>(new Set())
  const [claimingId, setClaimingId] = useState<string | null>(null)
  // ⭐ 奕霖 00:57: 领券区可折叠
  const [couponsExpanded, setCouponsExpanded] = useState(true)
  const [groupBuys, setGroupBuys] = useState<GroupBuy[]>([])
  const [cartCount, setCartCount] = useState(0)
  const [flashProducts, setFlashProducts] = useState<Record<string, any[]>>({})
  const router = useRouter()
  const [items, setItems] = useState<FlashItem[]>([])
  const toast = useToast()

  // 拉数据
  useEffect(() => {
    setCartCount(getCartCount())
    const onUpdate = () => setCartCount(getCartCount())
    window.addEventListener('storage', onUpdate)
    return () => window.removeEventListener('storage', onUpdate)
  }, [])

  // 排序 + 埋点（奕霖 8-4 01:49 全权开干：活动界面 v4.0）
  const trackActivity = async (activityId: string, action: 'view' | 'click' | 'join') => {
    try {
      await fetch(`/api/activity/track?action=${action}&id=${activityId}`, { method: 'GET' })
    } catch {
      // 静默失败
    }
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/public/activities', { cache: 'no-store' })
        const json = await res.json()
        if (cancelled || !json.success) return

        // 排序：banner 按时间倒序，flashSale 按 endAt 升序（最快结束的在前），discount 按 rules value 降序（满减最大在前）
        const sortedBanners = (json.banners || []).slice().sort((a: any, b: any) => {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        })
        const sortedFlash = (json.flashSales || []).slice().sort((a: any, b: any) => {
          return new Date(a.endAt).getTime() - new Date(b.endAt).getTime()
        })
        const sortedDiscount = (json.discounts || []).slice().sort((a: any, b: any) => {
          // 从 rules 解析"满X减Y"里的X
          const getValue = (d: any) => {
            try {
              const r = JSON.parse(d.rules || '{}')
              const nums = Object.keys(r).filter((k) => k.startsWith('满')).map((k) => parseInt(k.replace('满', '')) || 0)
              return Math.max(...nums, 0)
            } catch { return 0 }
          }
          return getValue(b) - getValue(a)
        })

        setBanners(sortedBanners)
        setFlashSales(sortedFlash)
        setDiscounts(sortedDiscount)
        setCoupons(json.coupons || [])
        // ⭐ 奕霖 00:53: 拉用户已领的券, 标记哪些模板已领取
        try {
          const myRes = await fetch(`/api/coupons/my?phone=${DEMO_PHONE}`, { cache: 'no-store' })
          const myJson = await myRes.json()
          if (myJson.success && Array.isArray(myJson.coupons)) {
            // 用 name+value+minSpend 组合做指纹, 匹配活动模板
            const ownedKeys = new Set<string>()
            for (const c of myJson.coupons) {
              if (c.status === 'unused') {
                ownedKeys.add(`${c.name}|${c.value}|${c.minSpend}`)
              }
            }
            setClaimedIds(ownedKeys)
          }
        } catch {}
        // 强制展开为变量避免 lint
        setGroupBuys(json.groupBuys || [])

        // 拉秒杀关联的商品详情
        const allIds: string[] = []
        sortedFlash.forEach((f: FlashSale) => allIds.push(...(f.productIds || [])))
        if (allIds.length > 0) {
          const map = await fetchProductsByIds(allIds)
          if (!cancelled) setFlashProducts(map)
        }

        // ⭐ view 埋点：页面 mount 时记录所有活动被"看到"
        const allActivityIds = [
          ...sortedBanners.map((b: any) => b.id),
          ...sortedFlash.map((f: any) => f.id),
          ...sortedDiscount.map((d: any) => d.id),
        ]
        allActivityIds.forEach((id) => trackActivity(id, 'view'))
      } catch (e: any) {
        toast.show(`加载失败：${e.message}`, 'err')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 用第一个 banner 做倒计时
  const mainBanner = banners[0]
  const cd = useCountdown(mainBanner?.endAt || null)

  if (loading) {
    return (
      <AppLayout title="活动中心" showHeader>
        <div style={{ padding: '60px', textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>⏳</div>
          加载中...
        </div>
      </AppLayout>
    )
  }

  if (banners.length === 0 && flashSales.length === 0 && groupBuys.length === 0) {
    return (
      <AppLayout title="活动中心" showHeader>
        <div style={{ padding: '80px 20px', textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
          <div style={{ fontSize: '60px', marginBottom: '20px' }}>🎁</div>
          <div style={{ fontSize: '16px', color: '#fff', marginBottom: '8px' }}>暂无活动</div>
          <div style={{ fontSize: '12px' }}>商家还没有上架活动，敬请期待～</div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout title="活动中心" showHeader>
      <div style={{ padding: '16px', paddingBottom: '100px' }}>
        {/* 节日大 banner（来自真数据） */}
        {mainBanner && (
          <div style={{
            position: 'relative',
            padding: '14px 16px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #c1272d 0%, #d35400 50%, #f39c12 100%)',
            overflow: 'hidden',
            marginBottom: '20px',
            boxShadow: '0 8px 32px rgba(193, 39, 45, 0.3)',
          }}>
            <div style={{
              position: 'absolute', top: '-30px', right: '-30px',
              width: '180px', height: '180px',
              background: 'radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%)',
            }} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.85)', marginBottom: '8px', letterSpacing: '2px' }}>
                {mainBanner.title}
              </div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#ffffff', marginBottom: '4px' }}>
                {mainBanner.subtitle || mainBanner.description || '限时特惠'}
              </div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.85)', marginBottom: '20px' }}>
                {cd.done ? '活动已结束' : '⏱ 倒计时'}
              </div>
              {!cd.done && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                  {[
                    { v: cd.h, l: '时' },
                    { v: cd.m, l: '分' },
                    { v: cd.s, l: '秒' },
                  ].map((t, i) => (
                    <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <span style={{
                        padding: '3px 8px', borderRadius: '6px',
                        background: 'rgba(0,0,0,0.35)',
                        fontSize: '13px', fontWeight: 700, color: '#ffffff',
                        minWidth: '32px', textAlign: 'center',
                        fontVariantNumeric: 'tabular-nums',
                      }}>{String(t.v).padStart(2, '0')}</span>
                      {i < 2 && <span style={{ color: 'rgba(255,255,255,0.6)' }}>:</span>}
                    </span>
                  ))}
                </div>
              )}
              <button
                onClick={() => {
                  // ⭐ v4.0：banner 立即抢购 = track click + scroll 到秒杀区
                  if (mainBanner) trackActivity(mainBanner.id, 'click')
                  window.scrollTo({ top: 400, behavior: 'smooth' })
                }}
                style={{
                  padding: '12px 36px', borderRadius: '24px',
                  background: '#ffffff', color: '#c1272d', border: 'none',
                  fontSize: '14px', fontWeight: 700, cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                }}
              >立即抢购</button>
            </div>
          </div>
        )}

        {/* 限时秒杀（真数据） */}
        {flashSales.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>⚡</span>
                <span style={{ fontSize: '17px', fontWeight: 700, color: '#ffffff' }}>限时秒杀</span>
              </div>
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>{flashSales.length} 个进行中 →</span>
            </div>
            {flashSales.map((f) => {
              // ⭐ 奕霖 2026-08-05 17:45 修：fetchProductsByIds 返 '*' 共享池，读 '*' 而非 f.id
              const items = flashProducts['*'] || []
              return (
                <div key={f.id} style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '13px', color: '#ff9a6b', marginBottom: '8px', fontWeight: 600 }}>
                    {f.title} {f.subtitle && `· ${f.subtitle}`}
                  </div>
                  {items.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>
                      活动商品加载中…
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      {items.slice(0, 4).map((p) => {
                        const outOfStock = (p.stock ?? 0) <= 0
                        const price = p.price ?? 0
                        const original = price * 1.5 // demo: 原价 = 现价 × 1.5（无原价字段）
                        return (
                          <div
                            key={p.id}
                            onClick={() => {
                              if (outOfStock) {
                                toast.show('该商品暂时缺货', 'err')
                                return
                              }
                              // ⭐ v4.0：秒杀商品点击 → 埋点 + 加入购物车
                              trackActivity(f.id, 'click')
                              quickAddToCart({
                                id: p.id,
                                name: p.name,
                                price,
                                spec: p.spec,
                                category: p.category,
                              })
                              setCartCount(getCartCount())
                              toast.show(`✓ ${p.name} 已加入购物车`)
                            }}
                            style={{
                              padding: '10px',
                              borderRadius: '14px',
                              background: 'rgba(255, 255, 255, 0.04)',
                              border: '1px solid rgba(255, 107, 107, 0.15)',
                              position: 'relative',
                              cursor: outOfStock ? 'not-allowed' : 'pointer',
                              transition: 'transform 0.15s ease, border-color 0.15s ease',
                              opacity: outOfStock ? 0.5 : 1,
                            }}
                          >
                            <div style={{
                              position: 'absolute', top: '6px', right: '6px',
                              padding: '2px 6px', borderRadius: '8px',
                              background: 'rgba(255, 107, 107, 0.85)',
                              fontSize: '9px', color: '#ffffff', fontWeight: 600,
                            }}>秒杀</div>
                            <div style={{
                              width: '100%', aspectRatio: '4/3',
                              background: 'rgba(127, 220, 148, 0.05)',
                              borderRadius: '8px', marginBottom: '6px',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 28, overflow: 'hidden',
                            }}>
                              {p.image ? <img src={p.image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '🍵'}
                            </div>
                            <div style={{ fontSize: '11px', color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '2px' }}>{p.name}</div>
                            <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', marginBottom: '6px' }}>{p.spec || ''}</div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '4px' }}>
                              <span style={{ fontSize: '15px', fontWeight: 700, color: '#ff6b6b' }}>¥{price.toFixed(2)}</span>
                              <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', textDecoration: 'line-through' }}>¥{original.toFixed(2)}</span>
                            </div>
                            <div style={{ fontSize: '9px', color: outOfStock ? '#ff9a6b' : 'rgba(255,255,255,0.5)' }}>
                              {outOfStock ? '缺货' : `剩 ${p.stock} 件`}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* 满减/促销（真数据） */}
        {discounts.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <span style={{ fontSize: '20px' }}>🎯</span>
              <span style={{ fontSize: '17px', fontWeight: 700, color: '#ffffff' }}>满减活动</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {discounts.map((d) => (
                <div
                  key={d.id}
                  onClick={() => {
                    // ⭐ v4.0：满减活动点击 = 埋点 + 跳商品列表页
                    trackActivity(d.id, 'click')
                    window.location.href = `/search?activity=${d.id}`
                  }}
                  style={{
                    padding: '14px 16px', borderRadius: '14px',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(127, 220, 148, 0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '40px', height: '40px', borderRadius: '12px',
                      background: 'rgba(127, 220, 148, 0.15)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '20px',
                    }}>🎫</div>
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff', marginBottom: '2px' }}>{d.title}</div>
                      <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>
                        {d.subtitle || d.description || '点击查看活动商品 →'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 可领取的满减券（奕霖 00:53 重做: 票券样式 + 实时已领取状态） */}
        {coupons.length > 0 && (() => {
          const TIER_EMOJI: Record<string, string> = { '5': '🌱', '15': '🥬', '40': '🛒', '80': '🏠' }
          return (
            <div id="claim-coupons" style={{ marginBottom: '20px', scrollMarginTop: 80 }}>
              <div
                onClick={() => setCouponsExpanded((v) => !v)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  marginBottom: couponsExpanded ? '14px' : '0',
                  cursor: 'pointer', userSelect: 'none',
                }}>
                <span style={{ fontSize: '20px' }}>🎁</span>
                <span style={{ fontSize: '17px', fontWeight: 700, color: '#ffffff' }}>可领取优惠券</span>
                <span style={{
                  fontSize: '10px', padding: '2px 8px', borderRadius: 8,
                  background: 'rgba(127, 220, 148, 0.18)', color: '#fbbf24', fontWeight: 700,
                  marginLeft: 'auto', marginRight: 8,
                }}>{coupons.filter(c => claimedIds.has(`${c.name}|${c.value}|${c.minSpend}`)).length}/{coupons.length} 已领</span>
                <span style={{
                  fontSize: 14, color: 'rgba(255,255,255,0.6)',
                  transition: 'transform 0.2s ease',
                  transform: couponsExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                  display: 'inline-block',
                }}>▾</span>
              </div>
              {couponsExpanded && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {coupons.map((c) => {
                  const key = `${c.name}|${c.value}|${c.minSpend}`
                  const owned = claimedIds.has(key)
                  const claiming = claimingId === c.id
                  return (
                    <div key={c.id} style={{
                      padding: '12px 14px',
                      borderRadius: '12px',
                      background: owned ? 'rgba(127, 220, 148, 0.05)' : 'rgba(127, 220, 148, 0.08)',
                      border: owned ? '1px solid rgba(127, 220, 148, 0.15)' : '1px solid rgba(127, 220, 148, 0.25)',
                      display: 'flex', alignItems: 'center', gap: '10px',
                      opacity: owned ? 0.55 : 1,
                      transition: 'all 0.25s ease',
                    }}>
                      {/* ⭐ 奕霖 01:02: 极简风格 - 只用图标, 去掉大色块和解释文字 */}
                      <span style={{ fontSize: 22, flexShrink: 0, lineHeight: 1 }}>{TIER_EMOJI[String(c.value)] || '🎟️'}</span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: owned ? 'rgba(255,255,255,0.5)' : '#ffffff', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                      {/* 右侧按钮 */}
                      <button
                        disabled={owned || claiming}
                        onClick={async () => {
                          setClaimingId(c.id)
                          try {
                            const res = await fetch('/api/coupons/claim', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                phone: DEMO_PHONE,
                                name: c.name,
                                value: c.value,
                                minSpend: c.minSpend,
                                expiresAtDays: 30,
                              }),
                            })
                            const json = await res.json()
                            if (json.success) {
                              // ⭐ 实时标记已领取, 按钮立即变 "已领取"
                              setClaimedIds((prev) => new Set([...prev, key]))
                              toast.show(`✓ ${c.name} 领取成功！优惠码 ${json.coupon.code}`)
                            } else {
                              toast.show(`领取失败：${json.error}`, 'err')
                            }
                          } catch (e: any) {
                            toast.show(`网络错误：${e.message}`, 'err')
                          } finally {
                            setClaimingId(null)
                          }
                        }}
                        style={{
                          flexShrink: 0,
                          padding: '10px 18px', borderRadius: '14px',
                          border: owned ? '1px solid rgba(127, 220, 148, 0.3)' : 'none',
                          background: owned
                            ? 'rgba(127, 220, 148, 0.1)'
                            : 'linear-gradient(135deg, #fbbf24 0%, #4ade80 100%)',
                          color: owned ? '#fbbf24' : '#0a0f0d',
                          fontSize: 13, fontWeight: 700,
                          cursor: owned ? 'default' : (claiming ? 'wait' : 'pointer'),
                          transition: 'all 0.25s ease',
                          minWidth: 72, textAlign: 'center',
                        }}>
                        {owned ? '✓ 已领取' : claiming ? '领取中…' : '领取'}
                      </button>
                    </div>
                  )
                })}
              </div>
              )}
            </div>
          )
        })()}

        {/* 拼团（GroupBuy 表真数据 + 真实人数） */}
        {groupBuys.length > 0 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <span style={{ fontSize: '20px' }}>🛒</span>
              <span style={{ fontSize: '17px', fontWeight: 700, color: '#ffffff' }}>拼团砍价</span>
              <span style={{
                fontSize: '10px', padding: '2px 8px', borderRadius: 8,
                background: 'rgba(244, 114, 182, 0.18)', color: '#f472b6', fontWeight: 700,
                marginLeft: 'auto',
              }}>进行中 · {groupBuys.length} 团</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {groupBuys.map((g) => {
                const progress = Math.min(100, (g.currentPeople / g.requiredPeople) * 100)
                return (
                  <div key={g.id} style={{
                    padding: '16px',
                    borderRadius: '16px',
                    background: 'linear-gradient(135deg, rgba(244, 114, 182, 0.1) 0%, rgba(168, 85, 247, 0.1) 100%)',
                    border: '1px solid rgba(244, 114, 182, 0.2)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '56px', height: '56px', borderRadius: '12px',
                          background: 'rgba(255, 255, 255, 0.06)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '32px',
                        }}>{g.icon}</div>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff', marginBottom: '4px' }}>{g.productName}</div>
                          {g.productSpec && (
                            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>{g.productSpec}</div>
                          )}
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                            <span style={{ fontSize: '20px', fontWeight: 700, color: '#f472b6' }}>¥{g.groupPrice.toFixed(2)}</span>
                            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', textDecoration: 'line-through' }}>¥{g.originalPrice.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            const res = await fetch('/api/groups/join', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                groupId: g.id,
                                phone: DEMO_PHONE,
                                nickname: '活动用户',
                              }),
                            })
                            const json = await res.json()
                            if (json.success) {
                              const grp = json.group
                              toast.show(`✓ 已加入拼团！进度 ${grp.currentPeople}/${grp.requiredPeople}`)
                              // 刷新一次数据
                              setTimeout(() => window.location.reload(), 800)
                            } else {
                              toast.show(`参与失败：${json.error}`, 'err')
                            }
                          } catch (e: any) {
                            toast.show(`网络错误：${e.message}`, 'err')
                          }
                        }}
                        style={{
                          padding: '10px 18px', borderRadius: '20px', border: 'none',
                          background: 'linear-gradient(135deg, #f472b6 0%, #a855f7 100%)',
                          color: '#ffffff', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                        }}>去拼团</button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>进度</div>
                      <div style={{ flex: 1, position: 'relative', height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{
                          position: 'absolute', left: 0, top: 0, height: '100%',
                          width: `${progress}%`,
                          background: 'linear-gradient(90deg, #f472b6 0%, #a855f7 100%)',
                          borderRadius: '3px',
                          transition: 'width 0.5s ease',
                        }} />
                      </div>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: '#f472b6' }}>{g.currentPeople}/{g.requiredPeople}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 购物车浮动按钮 */}
        {cartCount > 0 && (
          <button
            onClick={() => (window.location.href = '/cart')}
            style={{
              position: 'fixed', right: '20px', bottom: '100px',
              width: '56px', height: '56px', borderRadius: '28px',
              background: 'linear-gradient(135deg, #fbbf24, #4ade80)',
              color: '#0a0f0d', fontSize: '22px', fontWeight: 700,
              border: 'none', cursor: 'pointer',
              boxShadow: '0 8px 24px rgba(127, 220, 148, 0.4)',
              zIndex: 50,
            }}
          >
            🛒
            <span style={{
              position: 'absolute', top: '-4px', right: '-4px',
              minWidth: '22px', height: '22px', borderRadius: '11px',
              background: '#ff6b6b', color: '#fff',
              fontSize: '11px', fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '0 6px',
            }}>{cartCount}</span>
          </button>
        )}

        {/* Toast 浮层 */}
        {toast.msg && (
          <div style={{
            position: 'fixed', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            padding: '14px 24px', borderRadius: '12px',
            background: toast.msg.kind === 'err' ? 'rgba(255, 107, 107, 0.95)' : 'rgba(127, 220, 148, 0.95)',
            color: '#0a0f0d', fontSize: '14px', fontWeight: 600,
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            zIndex: 200, maxWidth: '80vw', textAlign: 'center',
          }}>
            {toast.msg.text}
          </div>
        )}
      </div>
    </AppLayout>
  )
}

/** 批量拉秒杀商品详情 */
async function fetchProductsByIds(ids: string[]): Promise<Record<string, any[]>> {
  const map: Record<string, any[]> = {}
  // 简单方案：每个 id 单独 GET（demo 阶段 id 数量 ≤ 6）
  // 如果 id 多，再换 POST /api/products/batch
  await Promise.all(
    ids.map(async (id) => {
      try {
        const res = await fetch(`/api/products/${id}`, { cache: 'no-store' })
        const json = await res.json()
        if (json.success && json.product) {
          // 按 id 分组（多个秒杀可能共享商品）
          if (!map['_pool']) map['_pool'] = []
          map['_pool'].push(json.product)
        }
      } catch {
        // 忽略单个失败
      }
    })
  )
  // 把 _pool 平铺到每个秒杀活动
  if (map['_pool']) {
    const pool = map['_pool']
    // 不区分具体活动，秒杀共享同一组商品
    // 这里简化：所有秒杀都用 pool，flashSale id 不再单独分组
    return { '*': pool }
  }
  return {}
}