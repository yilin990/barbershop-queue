'use client'

// ⭐ 奕霖 2026-08-07 17:31 反馈：「问题依旧」→ cloudflared s-maxage=31536000 缓存1年

import { confirmDialog } from '@/lib/ui-bus'
import { toast } from '@/lib/ui-bus'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/AppLayout'
import { useUserStore } from '@/stores/userStore'
import { saveCart } from '@/lib/cart'

interface CartItem {
  productId: string
  name: string
  spec?: string
  price: number
  quantity: number
  icon?: string
}

export default function CartPage() {
  const router = useRouter()
  const { user, isLoggedIn } = useUserStore()
  const [items, setItems] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCoupon, setSelectedCoupon] = useState<{ id: string; name: string; value: number; minSpend: number } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadCart()
    // 监听 storage 变化（跨 tab）+ cart-updated（同窗口）
    // ⭐ MEMORY §270 (2026-08-25 20:17) 奕霖反馈 /cart 数据不通
    // 真凶之一：这里只听 storage，但 storage 同窗口不触发 → 自己页面内的 +/- 删除不会触发这里
    // 修法：再加 cart-updated 监听（saveCart() 现在会派发）
    const onStorage = () => loadCart()
    const onCartUpdated = () => loadCart()
    window.addEventListener('storage', onStorage)
    window.addEventListener('cart-updated', onCartUpdated)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('cart-updated', onCartUpdated)
    }
  }, [])

  const loadCart = () => {
    try {
      const cart = JSON.parse(localStorage.getItem('cart') || '[]')
      setItems(cart)
    } catch (e) {
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  const updateQty = (idx: number, delta: number) => {
    const newItems = [...items]
    newItems[idx].quantity = Math.max(1, newItems[idx].quantity + delta)
    setItems(newItems)
    // ⭐ MEMORY §270：改走 saveCart()，自动派发 storage + cart-updated 两个事件
    // 同窗口 FloatingCart 立即同步（不再等 800ms 轮询）
    saveCart(newItems)
  }

  const removeItem = async (idx: number) => {
    if (!await confirmDialog(`确定移除「${items[idx].name}」？`)) return
    const newItems = items.filter((_, i) => i !== idx)
    setItems(newItems)
    // ⭐ MEMORY §270：同上，走 saveCart()
    saveCart(newItems)
  }

  const clearCart = async () => {
    if (!await confirmDialog('清空购物车？')) return
    setItems([])
    // ⭐ MEMORY §270：用 cart.ts 的 clearCart()（已派发 storage + cart-updated）
    // 注意不能叫同名避免覆盖 import——但函数体内调用 cart.ts 的 clearCart 会冲突
    // 解决：清空数组再调用 import 的 clearCartSaved()
    localStorage.removeItem('cart')
    window.dispatchEvent(new StorageEvent('storage', { key: 'cart' }))
    window.dispatchEvent(new CustomEvent('cart-updated'))
  }

  // ⭐ MEMORY §273 (2026-08-25 21:17) 奕霖反馈：购物车总价格 ¥NaN 误以为商品没加载
  // 真凶：任何 item.price / item.quantity 为 undefined/undefined，整个 reduce 都会产生 NaN
  // 修法：所有计算项包 Number() || 0，让所有脏数据(价格/数量缺失)可安全累加
  const subtotal = items.reduce((sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 0), 0)
  const totalItems = items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0)
  const discount = selectedCoupon && subtotal >= selectedCoupon.minSpend ? selectedCoupon.value : 0
  const shipping = subtotal > 0 ? 0 : 0 // 满 0 包邮
  const finalAmount = Math.max(0, subtotal - discount + shipping)

  const handleCheckout = async () => {
    if (items.length === 0) {
      toast.info('购物车是空的')
      return
    }
    // ⭐ 2026-07-24 兜底联：未登录不允许下单（订单需要归属用户）
    if (!isLoggedIn || !user?.phone) {
      toast.info('请先登录后再下单（订单会归属到您的账号）')
      router.push('/login')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: user.phone,
          customerName: user.nickname || '顾客',
          deliveryType: 'pickup',
          items: items.map((it) => ({
            productId: it.productId,
            name: it.name,
            spec: it.spec,
            price: it.price,
            quantity: it.quantity,
          })),
        }),
      })
      const json = await res.json()
      if (json.success) {
        // 清空购物车
        localStorage.removeItem('cart')
        setItems([])
        const o = json.order || {}
        const m = json.membership
        const finalAmt = Number(o.finalAmount) || 0
        const orderNo = o.orderNo || ''
        let msg = `🎉 下单成功！\n\n订单号: ${orderNo}\n实付: ¥${finalAmt.toFixed(2)}\n\n⏰ 商家核销后积分自动到账`
        if (m && m.upgraded) {
          msg += `\n💎 会员升级：${m.from} → ${m.to}\n累计消费: ¥${(Number(m.totalSpent) || 0).toFixed(2)}\n获得积分: ${m.pointsAdded || 0}`
        } else if (m) {
          msg += `\n💎 会员等级: ${m.to}\n累计消费: ¥${(Number(m.totalSpent) || 0).toFixed(2)}\n获得积分: ${m.pointsAdded || 0}`
        }
        toast.info(msg)
        router.push('/orders')
      } else {
        toast.error(`❌ 下单失败：${json.error || '未知错误'}`)
      }
    } catch (e: any) {
      toast.error(`❌ 网络错误：${e.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AppLayout title="购物车" showHeader>
      <div style={{ padding: '16px', paddingBottom: '240px' }}>
        {/* ⭐ 19:29 奕霖：顶部加"📦 我的订单"快捷入口（和 /orders 一致的功能） */}
        <div
          onClick={() => router.push('/orders')}
          style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '10px 14px', marginBottom: '12px',
            background: 'rgba(127, 220, 148, 0.08)',
            border: '1px solid rgba(127, 220, 148, 0.25)',
            borderRadius: '12px', cursor: 'pointer',
          }}
        >
          <span style={{ fontSize: '20px' }}>📦</span>
          <div style={{ flex: 1, fontSize: '13px', color: '#fbbf24', fontWeight: 600 }}>
            我的订单
          </div>
          <span style={{ fontSize: '16px', color: 'rgba(127, 220, 148, 0.5)' }}>→</span>
        </div>
        {/* 顶部标题栏 */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: '16px',
        }}>
          <div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#ffffff' }}>
              🛒 购物车
              <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginLeft: '8px', fontWeight: 400 }}>
                ({totalItems} 件)
              </span>
            </div>
          </div>
          {items.length > 0 && (
            <button
              onClick={clearCart}
              style={{
                padding: '6px 12px', borderRadius: '12px', border: 'none',
                background: 'rgba(255, 107, 107, 0.1)', color: '#ff6b6b',
                fontSize: '12px', cursor: 'pointer',
              }}>清空</button>
          )}
        </div>

        {/* 购物车列表 */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.4)' }}>
            加载中…
          </div>
        ) : items.length === 0 ? (
          <div style={{
            padding: '60px 20px', textAlign: 'center',
            borderRadius: '20px',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px dashed rgba(127, 220, 148, 0.2)',
          }}>
            <div style={{ fontSize: '60px', marginBottom: '16px' }}>🛒</div>
            <div style={{ fontSize: '15px', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>
              购物车空空如也
            </div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '20px' }}>
              去活动页秒杀价加购吧
            </div>
            <button
              onClick={() => router.push('/activity')}
              style={{
                padding: '10px 24px', borderRadius: '20px', border: 'none',
                background: '#fbbf24', color: '#0a0f0d',
                fontSize: '13px', fontWeight: 700, cursor: 'pointer',
              }}>去逛活动 →</button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
              {items.map((item, idx) => (
                <div key={idx} style={{
                  padding: '12px 14px', borderRadius: '16px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(127, 220, 148, 0.12)',
                  display: 'flex', alignItems: 'center', gap: '12px',
                }}>
                  {/* 图标 */}
                  <div style={{
                    width: '52px', height: '52px', borderRadius: '12px',
                    background: 'rgba(127, 220, 148, 0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '28px', flexShrink: 0,
                  }}>{item.icon || '🍵'}</div>

                  {/* 商品信息 */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* ⭐ MEMORY §273 奕霖 21:17：老的 cart item 可能是 product.id 错误添加的商品（name undefined） */}
                    {/* 这种是脏数据，显示"该商品已下架"提示用户清理 */}
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff', marginBottom: '2px' }}>
                      {item.name || <span style={{ color: 'rgba(255, 107, 107, 0.7)', fontSize: '12px' }}>该商品已下架，请删除</span>}
                    </div>
                    {item.spec && (
                      <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>
                        {item.spec}
                      </div>
                    )}
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#ff9a6b' }}>
                      ¥{Number(item.price || 0).toFixed(2)}
                    </div>
                  </div>

                  {/* 数量调整 + 删除 */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                    <button
                      onClick={() => removeItem(idx)}
                      style={{
                        padding: '2px 6px', borderRadius: '6px', border: 'none',
                        background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)',
                        fontSize: '10px', cursor: 'pointer',
                      }}>删除</button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        onClick={() => updateQty(idx, -1)}
                        disabled={item.quantity <= 1}
                        style={{
                          width: '24px', height: '24px', borderRadius: '50%',
                          background: item.quantity > 1 ? 'rgba(127, 220, 148, 0.15)' : 'rgba(255,255,255,0.05)',
                          border: 'none', color: item.quantity > 1 ? '#fbbf24' : 'rgba(255,255,255,0.2)',
                          fontSize: '14px', fontWeight: 700, cursor: item.quantity > 1 ? 'pointer' : 'not-allowed',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>−</button>
                      <span style={{ minWidth: '20px', textAlign: 'center', fontSize: '14px', fontWeight: 600, color: '#ffffff' }}>
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQty(idx, 1)}
                        style={{
                          width: '24px', height: '24px', borderRadius: '50%',
                          background: 'rgba(127, 220, 148, 0.15)', border: 'none',
                          color: '#fbbf24', fontSize: '14px', fontWeight: 700, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>+</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 优惠提示 */}
            {selectedCoupon && (
              <div style={{
                padding: '12px 14px', borderRadius: '14px', marginBottom: '16px',
                background: 'rgba(255, 107, 107, 0.1)',
                border: '1px solid rgba(255, 107, 107, 0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ fontSize: '13px', color: '#ff9a6b', fontWeight: 600 }}>
                    🎟️ {selectedCoupon.name}
                  </div>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>
                    满 ¥{selectedCoupon.minSpend} 可用
                  </div>
                </div>
                <button
                  onClick={() => setSelectedCoupon(null)}
                  style={{
                    padding: '4px 10px', borderRadius: '8px', border: 'none',
                    background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)',
                    fontSize: '11px', cursor: 'pointer',
                  }}>取消</button>
              </div>
            )}
          </>
        )}
      </div>

      {/* 底部结算栏 — 奕霖 2026-07-24 16:44 反馈被 TabBar(60px) + 浮窗按钮(60+44px) 遮挡 */}
      {items.length > 0 && (
        <div style={{
          position: 'fixed', left: 0, right: 0,
          // ⭐ 奕霖 2026-07-24 16:44: 64px → 110px, 避开 BottomTabBar(67) + 浮窗按钮区域
          bottom: `calc(110px + env(safe-area-inset-bottom, 0px))`,
          // ⭐ 奕霖 2026-07-24 16:44: zIndex 80 → 150, 比 TabBar(100) + 浮窗(200)安全
          zIndex: 150,
          background: 'linear-gradient(180deg, rgba(13, 31, 23, 0.95) 0%, rgba(10, 15, 13, 0.98) 100%)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderTop: '1px solid rgba(127, 220, 148, 0.2)',
          padding: '14px 20px',
          paddingBottom: `calc(14px + env(safe-area-inset-bottom, 0px))`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
          maxWidth: '420px', margin: '0 auto',
        }}>
          <div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>合计</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
              <span style={{ fontSize: '12px', color: '#ff9a6b' }}>¥</span>
              <span style={{ fontSize: '24px', fontWeight: 800, color: '#ff9a6b' }}>{finalAmount.toFixed(2)}</span>
              {discount > 0 && (
                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', textDecoration: 'line-through', marginLeft: '6px' }}>
                  ¥{subtotal.toFixed(2)}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={handleCheckout}
            disabled={submitting}
            style={{
              padding: '12px 28px', borderRadius: '24px', border: 'none',
              background: submitting ? 'rgba(127, 220, 148, 0.4)' : '#fbbf24',
              color: '#0a0f0d', fontSize: '15px', fontWeight: 700, cursor: submitting ? 'wait' : 'pointer',
              minWidth: '120px',
            }}>{submitting ? '提交中…' : '📝 提交订单'}</button>
        </div>
      )}
    </AppLayout>
  )
}
