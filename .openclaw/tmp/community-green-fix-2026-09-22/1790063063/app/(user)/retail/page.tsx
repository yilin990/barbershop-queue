'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/AppLayout'
import StaffGate from '@/components/StaffGate'

// =====================================================
// /retail 收银台 — 奕霖 2026-08-03 16:32 反馈后恢复
// 原则：可折叠 ≠ 删掉
// 1. 4 个 tab（收银 + 库存 + 数据 + 订单）— 库存/数据 独立 tab
// 2. Hub 面板 → 默认折叠的"💎 福利"按钮
// 3. 玩法 → 底部可折叠 quick actions
// 4. 积分/券 → 结账时 inline 折叠
// 5. Phone 输入 → 顶部统一输入，备用 tab
//
// ⭐ 奕霖 2026-08-03 20:00 反馈"没有数据"根因：API 全要鉴权但页面没 StaffGate
// 修法：跟 /pickup 一样包 StaffGate（PIN 1234/5678/9012）
// =====================================================

interface CartItem {
  productId: string
  productName: string
  productSpec?: string
  price: number
  quantity: number
  stock: number
}

interface LoadedOrder {
  orderNo: string
  pickupCode: string
  items: CartItem[]
  finalAmount: number
}

interface Product {
  id: string
  name: string
  spec: string | null
  price: number
  memberPrice: number
  stock: number
  isLowStock: boolean
  isOutOfStock: boolean
  category?: string         // 分类戳（奕霖 20:47 反馈）
  updatedAt?: string       // 时间戳（奕霖 20:47 反馈）
}

// ⭐ MEMORY §308 v0.8.47 hotfix (2026-08-29 13:37 奕霖) — STATUS 提到模块顶层:
// v0.8.47 犯的错:STATUS 在 OrdersTab 函数体内 const,OrderDetailModal 是模块级函数
// 调用 STATUS[o.status] 时 undefined → 'STATUS is not defined' 报错 + 不弹窗
// 修法:把 STATUS 提到模块顶层,OrdersTab 和 OrderDetailModal 都能引用
const STATUS: any = {
  pending: { l: '待付款', c: '#fbbf24' },
  paid: { l: '已付款', c: '#60a5fa' },
  ready: { l: '待取货', c: '#34d399' },
  delivered: { l: '已完成', c: '#fbbf24' },
  cancelled: { l: '已取消', c: '#94a3b8' },
  completed: { l: '已完成', c: '#fbbf24' },
}

export default function RetailPage() {
  // ⭐ MEMORY §304 v0.8.44 (2026-08-29 13:08 奕霖) — 加回 PIN 验证:
  // v0.8.43 砍 StaffGate → v0.8.44 加回 StaffGate(只 1 关 PIN)
  // 从 /me 进 /retail:StaffGate 弹 PIN 框 → 输 PIN → 进收银台(1 关)
  return (
    <StaffGate>
      <RetailPageInner />
    </StaffGate>
  )
}

function RetailPageInner() {
  const router = useRouter()
  const [tab, setTab] = useState<'pos' | 'dashboard' | 'orders'>('pos')

  // ⭐ MEMORY §303 v0.8.43 (2026-08-29 02:21 奕霖) — 砍掉第一关 StaffGate:
  // 之前:StaffGate 包 4 个 tab → 每次进要输 PIN
  // 现在:去掉 StaffGate → 直接进收银台
  // 唯一验证:6位取货码(第二关,在 /api/admin/retail/orders/by-pickup-code API 层保留)
  // 注:收银/数据/订单 tab 的 API 会自动尝试 fetch,失败时显示空(用户偏好优先:1 关验证 > 多 tab 数据)
  return (
    <AppLayout title="果蔬收银台" showHeader>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 16px' }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <TabButton active={tab === 'pos'} onClick={function() { setTab('pos'); }}>🛒 收银</TabButton>
            <TabButton active={tab === 'dashboard'} onClick={function() { setTab('dashboard'); }}>📊 数据</TabButton>
            <TabButton active={tab === 'orders'} onClick={function() { setTab('orders'); }}>📜 订单</TabButton>
            <button
              onClick={function() { router.push('/pickup/snapshots') }}
              title="每日图（查找商品 + 上传图片，自动压缩，3天自动删除）"
              style={{
                width: '38px', height: '30px', borderRadius: '8px',
                border: '1px solid rgba(184, 134, 11, 0.5)',
                background: 'linear-gradient(135deg, rgba(184, 134, 11, 0.18) 0%, rgba(74, 157, 101, 0.12) 100%)',
                color: '#a8e6b8', fontSize: '16px',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}
            >🥑</button>
          </div>
          {tab === 'pos' ? <POSTab /> : tab === 'dashboard' ? <DashboardTab /> : <OrdersTab />}
      </div>
    </AppLayout>
  )
}

function TabButton(props: { active: boolean; onClick: () => void; children: any }) {
  return (
    <button
      onClick={props.onClick}
      style={{
        flex: 1, padding: '10px 8px', minWidth: 70,
        borderRadius: '12px',
        border: props.active ? '1px solid #fbbf24' : '1px solid rgba(184, 134, 11, 0.15)',
        background: props.active ? 'rgba(184, 134, 11, 0.15)' : 'rgba(255, 255, 255, 0.03)',
        color: props.active ? '#fbbf24' : 'rgba(255,255,255,0.6)',
        fontSize: '13px', fontWeight: 600, cursor: 'pointer',
      }}
    >
      {props.children}
    </button>
  )
}

function Card(props: { children: any; style?: any; onClick?: () => void }) {
  return (
    <div onClick={props.onClick} style={{
      padding: '14px 16px', borderRadius: '14px', marginBottom: '10px',
      background: 'rgba(255, 255, 255, 0.03)',
      border: '1px solid rgba(184, 134, 11, 0.1)',
      ...props.style,
    }}>{props.children}</div>
  )
}

// =====================================================
// POSTab — 核心收银台（3 步：查顾客 → 加商品 → 结账）
// =====================================================

function POSTab() {
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [unifiedInput, setUnifiedInput] = useState('')
  const [inputMode, setInputMode] = useState<'' | 'pickup' | 'phone'>('')
  const [lookingUp, setLookingUp] = useState(false)
  const [loadedOrder, setLoadedOrder] = useState<LoadedOrder | null>(null)
  const [customer, setCustomer] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [successOrder, setSuccessOrder] = useState<any>(null)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  // ⭐ Hub 真数据 state（奕霖 2026-08-03 20:20 反馈"数据没有完善"）
  const [customerCoupons, setCustomerCoupons] = useState<any[]>([])
  const [activeActivities, setActiveActivities] = useState<any[]>([])
  const [customerOrdersCount, setCustomerOrdersCount] = useState(0)
  const [hubLoaded, setHubLoaded] = useState(false)
  // ⭐ 商品分页（奕霖 20:47 反馈"固定最大可滚动 + 超了换下一页"）
  const [productPage, setProductPage] = useState(1)
  const PRODUCT_PAGE_SIZE = 12
  // ⭐ 积分抵扣 state（奕霖 2026-08-03 20:20 反馈"积分抵扣再做大一点"）
  const [couponInput, setCouponInput] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null)  // 选中的券详情
  const [usePoints, setUsePoints] = useState(false)
  const debounceRef = useRef<any>(null)

  // 商品搜索
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) { setProducts([]); return }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch('/api/admin/retail/products?q=' + encodeURIComponent(query) + '&pageSize=50')
        const json = await res.json()
        if (json.success) setProducts(json.items || [])
        setProductPage(1)
      } catch (e) { setProducts([]) }
      finally { setSearching(false) }
    }, 300)
    return function() { if (debounceRef.current) clearTimeout(debounceRef.current); }
  }, [query])

  // 统一输入处理（取货码 6 位 / 手机号 11 位）
  function handleUnifiedInputChange(value: string) {
    var v = value.replace(/\D/g, '').slice(0, 11)
    setUnifiedInput(v); setError(null)
    if (v.length === 6) setInputMode('pickup')
    else if (v.length === 11 && v.startsWith('1')) setInputMode('phone')
    else setInputMode('')
  }

  async function handleUnifiedLookup() {
    if (inputMode !== 'pickup' && inputMode !== 'phone') return
    setLookingUp(true); setError(null)
    try {
      if (inputMode === 'pickup') await lookupByPickupCode(unifiedInput)
      else await lookupByPhone(unifiedInput)
    } finally { setLookingUp(false) }
  }

  async function lookupByPickupCode(code: string) {
    try {
      const res = await fetch('/api/admin/retail/orders/by-pickup-code?code=' + code)
      const json = await res.json()
      if (json.success && json.found) applyLoadedOrder(json.order, json.customer, json.items)
      else setError(json.message || '取货码无效')
    } catch (e: any) { setError('查询错误：' + e.message) }
  }

  async function lookupByPhone(phone: string) {
    try {
      // ⭐ 并行查客户 + 订单 + 优惠券 + 活动（奕霖 2026-08-03 20:20 反馈 Hub 要拉真数据）
      const [customerRes, ordersRes, couponsRes, activitiesRes] = await Promise.all([
        fetch('/api/admin/retail/customers?phone=' + phone),
        // ⭐ MEMORY §306 v0.8.46 (2026-08-29 13:24 奕霖) — merchantCode 修复:
// 之前用 0005(芝林药房旧 code),导致 POSTab 查订单 API 查的是芝林数据,不是果蔬
// 改成 G0001(果蔬鲜生 m_grocery_001 的 code),跟全项目统一
fetch('/api/orders?merchantCode=G0001&phone=' + phone + '&limit=10'),
        fetch('/api/admin/retail/coupons/user?phone=' + phone),
        fetch('/api/admin/activities?status=active'),
      ])
      const customerJson = await customerRes.json()
      const ordersJson = await ordersRes.json()
      const couponsJson = await couponsRes.json()
      const activitiesJson = await activitiesRes.json()
      // 存 Hub 数据
      setCustomerCoupons(couponsJson.success ? (couponsJson.coupons || []) : [])
      setActiveActivities(activitiesJson.success ? (activitiesJson.activities || activitiesJson.items || []) : [])
      setCustomerOrdersCount(ordersJson.success ? (ordersJson.orders || []).length : 0)
      setHubLoaded(true)
      const loadableOrders = (ordersJson.orders || []).filter(function(o: any) {
        return ['pending', 'confirmed', 'delivered', 'paid'].indexOf(o.status) >= 0 && o.pickupCode
      })
      if (loadableOrders.length > 0) {
        const firstOrder = loadableOrders[0]
        await lookupByPickupCode(firstOrder.pickupCode)
        if (customerJson.success && customerJson.found) setCustomer(customerJson.customer)
        return
      }
      if (customerJson.success && customerJson.found) {
        setCustomer(customerJson.customer); setLoadedOrder(null); setCart([])
      } else { setError(customerJson.message || '该手机号无会员记录'); setCustomer(null) }
    } catch (e: any) { setError('查询错误：' + e.message) }
  }

  function applyLoadedOrder(order: any, customerData: any, items: any[]) {
    var orderItems: CartItem[] = (items || []).map(function(it: any) {
      return {
        productId: it.productId, productName: it.productName,
        productSpec: it.productSpec, price: it.price,
        quantity: it.quantity, stock: 999,
      }
    })
    setCart(orderItems)
    setLoadedOrder({ orderNo: order.orderNo, pickupCode: order.pickupCode, items: orderItems, finalAmount: order.finalAmount })
    if (customerData) {
      setCustomer({
        ...customerData,
        tier: customerData.totalSpent >= 5000 ? 'VIP'
              : customerData.totalSpent >= 2000 ? '金卡'
              : customerData.totalSpent >= 500 ? '银卡' : '普通',
      })
    }
    setError(null)
  }

  function clearLoadedOrder() {
    setLoadedOrder(null); setCart([]); setUnifiedInput(''); setInputMode('')
    setCouponInput(''); setUsePoints(false); setAppliedCoupon(null)
    setCustomerCoupons([]); setActiveActivities([]); setHubLoaded(false)
  }

  // 购物车
  function addToCart(p: Product) {
    if (p.isOutOfStock) return
    setCart(function(prev) {
      const exist = prev.find(function(i) { return i.productId === p.id; })
      if (exist) {
        if (exist.quantity >= p.stock) return prev
        return prev.map(function(i) {
          return i.productId === p.id ? { ...i, quantity: i.quantity + 1 } : i
        })
      }
      return [...prev, {
        productId: p.id, productName: p.name, productSpec: p.spec || undefined,
        price: p.memberPrice && p.memberPrice > 0 ? p.memberPrice : p.price,
        quantity: 1, stock: p.stock,
      }]
    })
  }

  function updateQty(productId: string, delta: number) {
    setCart(function(prev) {
      return prev.flatMap(function(i) {
        if (i.productId !== productId) return [i]
        const newQty = i.quantity + delta
        if (newQty <= 0) return []
        if (newQty > i.stock) return [i]
        return [{ ...i, quantity: newQty }]
      })
    })
  }

  // 结账（含积分/券）
  async function handleCheckout() {
    if (cart.length === 0) { setError('购物车是空的'); return }
    setCheckoutLoading(true); setError(null)
    try {
      const pointsToUse = usePoints && customer && customer.points >= 50 ? Math.min(Math.floor(total * 0.5 / 0.02), customer.points) : 0
      const res = await fetch('/api/admin/retail/pos/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.map(function(i) { return { productId: i.productId, quantity: i.quantity }; }),
          customerPhone: customer ? customer.phone : undefined,
          pointsUsed: pointsToUse,
          couponCode: couponInput.trim() || undefined,
        }),
      })
      const json = await res.json()
      if (json.success) {
        setSuccessOrder({ ...json.order, pointsEarned: json.pointsEarned })
        clearLoadedOrder()
      } else { setError(json.error || '结账失败') }
    } catch (e: any) { setError('网络错误：' + e.message) }
    finally { setCheckoutLoading(false) }
  }

  const total = cart.reduce(function(s, i) { return s + i.price * i.quantity; }, 0)
  const pointsDiscount = usePoints && customer && customer.points >= 50
    ? Math.min(Math.floor(total * 0.5 / 0.02), customer.points) * 0.02 : 0
  const couponDiscount = appliedCoupon && total >= (appliedCoupon.minSpend || 0)
    ? Math.min(appliedCoupon.value || 0, total) : 0
  const finalTotal = Math.max(0, total - pointsDiscount - couponDiscount)
  // ⭐ 获得积分预览（奕霖 22:27 改：4% cashback）
  const earnedPoints = Math.floor(finalTotal * 4)

  // 结账成功
  if (successOrder) {
    return (
      <div style={{ padding: '32px 20px', borderRadius: '20px', background: 'rgba(184, 134, 11, 0.08)', border: '1px solid rgba(184, 134, 11, 0.3)', textAlign: 'center' }}>
        <div style={{ fontSize: '60px', marginBottom: '16px' }}>✅</div>
        <div style={{ fontSize: '18px', color: '#fbbf24', fontWeight: 700, marginBottom: '12px' }}>结账成功</div>
        <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', marginBottom: '8px' }}>
          订单号：<span style={{ fontFamily: 'monospace', color: '#fff' }}>{successOrder.orderNo}</span>
        </div>
        <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.7)', marginBottom: '4px' }}>取货码</div>
        <div style={{ fontSize: '32px', color: '#fbbf24', fontWeight: 800, letterSpacing: '6px', fontFamily: 'monospace', marginBottom: '16px' }}>
          {successOrder.pickupCode}
        </div>
        <div style={{ fontSize: '18px', color: '#ffffff', fontWeight: 600, marginBottom: '16px' }}>
          实付 ¥{successOrder.finalAmount.toFixed(2)}
        </div>
        {successOrder.pointsEarned > 0 && (
          <div style={{ fontSize: '13px', color: 'rgba(184, 134, 11, 0.8)', marginBottom: '16px' }}>
            🎁 顾客获得 {successOrder.pointsEarned} 积分
          </div>
        )}
        <button onClick={function() { setSuccessOrder(null); }} style={{
          marginTop: '12px', padding: '10px 24px', borderRadius: '14px',
          border: '1px solid #fbbf24', background: 'transparent', color: '#fbbf24',
          fontSize: '14px', fontWeight: 600, cursor: 'pointer',
        }}>下一单</button>
      </div>
    )
  }

  return (
    <div>
      {/* 步骤 1：顶部统一输入（取货码/手机号）*/}
      {loadedOrder ? (
        // 已加载订单（可编辑商品列表）
        <div style={{
          padding: '14px 16px', borderRadius: '16px', marginBottom: '12px',
          background: 'linear-gradient(135deg, rgba(184, 134, 11, 0.15), rgba(45, 138, 79, 0.08))',
          border: '1px solid rgba(184, 134, 11, 0.5)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 12, color: '#fbbf24', fontWeight: 700, marginBottom: 4 }}>✅ 已加载订单 · 可编辑</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>
                <span style={{ fontFamily: 'monospace', color: '#fff' }}>{loadedOrder.orderNo}</span>
                {' · '}{cart.length} 件 · ¥<span style={{ color: '#fbbf24', fontWeight: 700 }}>{total.toFixed(2)}</span>
                {' · '}<span style={{ color: '#ffd700' }}>🔢 {loadedOrder.pickupCode}</span>
              </div>
            </div>
            <button onClick={clearLoadedOrder} style={{
              padding: '6px 12px', borderRadius: '8px',
              background: 'rgba(255,107,107,0.15)', border: '1px solid rgba(255,107,107,0.3)',
              color: '#ff6b6b', fontSize: 11, fontWeight: 700, cursor: 'pointer',
            }}>清除</button>
          </div>
          {cart.map(function(item) {
            return (
              <div key={item.productId} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '6px 4px', marginTop: 4, borderRadius: '6px',
                background: 'rgba(255, 255, 255, 0.04)',
              }}>
                <div style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
                  <div style={{ fontSize: 12, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.productName}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                    ¥{item.price.toFixed(2)} × {item.quantity} = ¥{(item.price * item.quantity).toFixed(2)}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button onClick={function() { updateQty(item.productId, -1); }} style={{
                    width: 24, height: 24, borderRadius: '50%', border: 'none',
                    background: item.quantity === 1 ? 'rgba(255,107,107,0.18)' : 'rgba(184, 134, 11, 0.2)',
                    color: item.quantity === 1 ? '#ff6b6b' : '#fbbf24',
                    fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  }}>{item.quantity === 1 ? '×' : '−'}</button>
                  <span style={{ minWidth: 22, textAlign: 'center', fontSize: 13, color: '#fbbf24', fontWeight: 700 }}>{item.quantity}</span>
                  <button onClick={function() { updateQty(item.productId, 1); }} style={{
                    width: 24, height: 24, borderRadius: '50%', border: 'none',
                    background: 'rgba(184, 134, 11, 0.2)', color: '#fbbf24',
                    fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  }}>+</button>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        // 统一输入（取货码/手机号）
        <div style={{
          padding: '14px 16px', borderRadius: '16px', marginBottom: '12px',
          background: 'rgba(184, 134, 11, 0.06)',
          border: '1px solid rgba(184, 134, 11, 0.2)',
        }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 6, fontWeight: 600 }}>
            🔍 查顾客（6 位取货码 或 11 位手机号）
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="tel" inputMode="numeric" pattern="[0-9]*"
              value={unifiedInput}
              onChange={function(e) { handleUnifiedInputChange(e.target.value); }}
              onKeyDown={function(e) { if (e.key === 'Enter' && (inputMode === 'pickup' || inputMode === 'phone')) handleUnifiedLookup(); }}
              placeholder="6 位取货码 或 11 位手机号" maxLength={11}
              style={{
                flex: 1, padding: '12px 14px', borderRadius: '10px',
                fontFamily: 'monospace', letterSpacing: 3, fontSize: 16, fontWeight: 700,
                border: inputMode === 'pickup' ? '1px solid #fbbf24'
                     : inputMode === 'phone' ? '1px solid #c4b5fd'
                     : '1px solid rgba(184, 134, 11, 0.3)',
                background: 'rgba(0,0,0,0.3)', color: inputMode === 'phone' ? '#c4b5fd' : '#fbbf24',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
            <button
              onClick={handleUnifiedLookup}
              disabled={lookingUp || (inputMode !== 'pickup' && inputMode !== 'phone')}
              style={{
                padding: '12px 18px', borderRadius: '10px', border: 'none',
                background: (inputMode === 'pickup' || inputMode === 'phone') ? '#fbbf24' : 'rgba(184, 134, 11, 0.3)',
                color: '#0a0f0d', fontSize: 14, fontWeight: 700,
                cursor: (inputMode === 'pickup' || inputMode === 'phone') ? 'pointer' : 'not-allowed',
              }}
            >{lookingUp ? '加载中...' : '🔍 查询'}</button>
          </div>
        </div>
      )}

      {/* ⭐ Hub 面板：拉真数据（奕霖 2026-08-03 20:20 反馈"数据不完善"） */}
      {customer && (
        <div style={{
          marginBottom: 12, padding: '14px 16px', borderRadius: '14px',
          background: 'linear-gradient(135deg, rgba(184, 134, 11, 0.10), rgba(99, 179, 237, 0.06))',
          border: '1px solid rgba(184, 134, 11, 0.25)',
        }}>
          {/* 顾客状态卡：常显，不折叠 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: 'linear-gradient(135deg, #fbbf24, #4a9d65)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, color: '#0a0f0d', fontWeight: 700,
            }}>{customer.nickname ? customer.nickname.charAt(0) : '👤'}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, color: '#fff', fontWeight: 700 }}>
                {customer.nickname || '顾客'} <span style={{
                  fontSize: 11, padding: '1px 6px', borderRadius: 4,
                  background: customer.tier === 'VIP' ? 'rgba(251, 191, 36, 0.2)'
                            : customer.tier === '金卡' ? 'rgba(251, 191, 36, 0.15)'
                            : 'rgba(255, 255, 255, 0.08)',
                  color: customer.tier === 'VIP' || customer.tier === '金卡' ? '#fbbf24' : 'rgba(255,255,255,0.6)',
                  marginLeft: 4,
                }}>{customer.tier || '普通'}</span>
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                {customer.totalOrders || 0} 单 · 总消费 ¥{Number(customer.totalSpent || 0).toFixed(2)}
              </div>
            </div>
          </div>

          {/* 4 列数据网格：积分 / 券 / 活动 / 订单 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <HubCard
              icon="💎" label="积分" value={customer.points || 0} unit="分"
              hint={customer.points >= 50 ? `可抵 ¥${(Math.min(customer.points, 50 * Math.floor((customer.points || 0) / 50)) * 0.02).toFixed(2)}` : '满 50 分起抵'}
              color="#fbbf24"
            />
            <HubCard
              icon="🎟️" label="优惠券" value={customerCoupons.length} unit="张可用"
              hint={customerCoupons.length > 0 ? customerCoupons[0].name : '暂无'}
              color="#fbbf24"
            />
            <HubCard
              icon="🔥" label="活动" value={activeActivities.length} unit="个进行中"
              hint={activeActivities.length > 0 ? activeActivities[0].title : '暂无'}
              color="#f97316"
            />
            <HubCard
              icon="📦" label="订单" value={customerOrdersCount} unit="单"
              hint={`${customerOrdersCount} 单历史`}
              color="#60a5fa"
            />
          </div>

          {/* 主动营销话术 */}
          {customer.points >= 50 && (
            <div style={{
              marginTop: 10, padding: '8px 12px', borderRadius: '8px',
              background: 'rgba(184, 134, 11, 0.08)', border: '1px dashed rgba(184, 134, 11, 0.3)',
              fontSize: 12, color: '#fbbf24',
            }}>
              💡 主动营销：您有 <b>{customer.points}</b> 分，可抵 <b>¥{(Math.floor((customer.points || 0) / 50) * 1).toFixed(2)}</b>，要抵吗？
            </div>
          )}
          {customerCoupons.length > 0 && (
            <div style={{
              marginTop: 6, padding: '8px 12px', borderRadius: '8px',
              background: 'rgba(251, 191, 36, 0.08)', border: '1px dashed rgba(251, 191, 36, 0.3)',
              fontSize: 12, color: '#fbbf24',
            }}>
              💡 可用券：{customerCoupons.map(function(c) { return c.name; }).join('、')}（结账时输入券码）
            </div>
          )}
        </div>
      )}

      {/* 步骤 2：商品搜索 */}
      <div style={{
        padding: '12px 16px', borderRadius: '14px', marginBottom: '12px',
        background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(184, 134, 11, 0.15)',
      }}>
        <input
          type="text" value={query}
          onChange={function(e) { setQuery(e.target.value); }}
          placeholder="🔍 搜索商品名 / 拼音码 / 条形码"
          style={{
            width: '100%', padding: '8px 0', border: 'none', background: 'transparent',
            color: '#ffffff', fontSize: 15, outline: 'none', fontFamily: 'inherit',
          }}
        />
      </div>

      {searching && <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)', padding: '20px' }}>搜索中...</div>}
      {!searching && query && products.length === 0 && (
        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', padding: '20px' }}>没找到商品</div>
      )}
      {/* ⭐ 商品列表：固定 max-height 50vh + 内部滚动 + 分页加载更多（奕霖 20:47） */}
      <div style={{ maxHeight: '50vh', overflowY: 'auto', marginBottom: 8, paddingRight: 4 }}>
      {products.slice(0, productPage * PRODUCT_PAGE_SIZE).map(function(p) {
        var cartItem = cart.find(function(c) { return c.productId === p.id; })
        var cartQty = cartItem ? cartItem.quantity : 0
        var unitPrice = p.memberPrice && p.memberPrice > 0 ? p.memberPrice : p.price
        return (
          <div key={p.id} style={{
            padding: '12px 14px', borderRadius: '14px', marginBottom: '8px',
            background: cartQty > 0 ? 'rgba(184, 134, 11, 0.08)' : 'rgba(255, 255, 255, 0.03)',
            border: cartQty > 0 ? '1px solid rgba(184, 134, 11, 0.4)' : '1px solid rgba(184, 134, 11, 0.1)',
            opacity: p.isOutOfStock ? 0.5 : 1,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
                <div style={{ fontSize: 14, color: '#ffffff', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.name}
                  {p.isLowStock && <span style={{ marginLeft: 8, color: '#ffbb00', fontSize: 11 }}>低库存 {p.stock}</span>}
                </div>
                {p.spec && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{p.spec}</div>}
                {/* ⭐ 分类戳 + 时间戳（奕霖 20:47 反馈） */}
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2, display: 'flex', gap: 6 }}>
                  <span>📂 {p.category || '未分类'}</span>
                  <span>🕒 {p.updatedAt ? new Date(p.updatedAt).toLocaleDateString('zh-CN') : '—'}</span>
                </div>
              </div>
              <div style={{ fontSize: 16, color: '#fbbf24', fontWeight: 700, flexShrink: 0 }}>¥{unitPrice.toFixed(2)}</div>
            </div>
            {cartQty > 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTop: '1px dashed rgba(184, 134, 11, 0.2)' }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>已在订单中 · 小计 ¥{(unitPrice * cartQty).toFixed(2)}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button onClick={function() { updateQty(p.id, -1); }} style={{
                    width: 28, height: 28, borderRadius: '50%', border: 'none',
                    background: cartQty === 1 ? 'rgba(255,107,107,0.18)' : 'rgba(184, 134, 11, 0.2)',
                    color: cartQty === 1 ? '#ff6b6b' : '#fbbf24',
                    fontSize: 16, fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{cartQty === 1 ? '×' : '−'}</button>
                  <span style={{ minWidth: 28, textAlign: 'center', fontSize: 16, color: '#fbbf24', fontWeight: 700, fontFamily: 'monospace' }}>{cartQty}</span>
                  <button onClick={function() { addToCart(p); }} style={{
                    width: 28, height: 28, borderRadius: '50%', border: 'none',
                    background: 'rgba(184, 134, 11, 0.2)', color: '#fbbf24',
                    fontSize: 16, fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>+</button>
                </div>
              </div>
            ) : (
              <button onClick={function() { addToCart(p); }} disabled={p.isOutOfStock} style={{
                width: '100%', marginTop: 8, padding: '6px 10px', borderRadius: '8px', border: 'none',
                background: p.isOutOfStock ? 'rgba(255,255,255,0.04)' : 'rgba(184, 134, 11, 0.12)',
                color: p.isOutOfStock ? 'rgba(255,255,255,0.3)' : '#fbbf24',
                fontSize: 12, fontWeight: 700, cursor: p.isOutOfStock ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              }}>🛒 加入订单</button>
            )}
          </div>
        )
      })}
      </div>
      {/* ⭐ 加载更多分页按钮（奕霖 20:47 反馈"超了换下一页"） */}
      {products.length > productPage * PRODUCT_PAGE_SIZE && (
        <button onClick={function() { setProductPage(function(p) { return p + 1; }); }} style={{
          width: '100%', padding: '12px', borderRadius: '12px', marginBottom: 12,
          background: 'rgba(184, 134, 11, 0.08)', border: '1px dashed rgba(184, 134, 11, 0.4)',
          color: '#fbbf24', fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}>
          📦 加载更多（还有 {products.length - productPage * PRODUCT_PAGE_SIZE} 件未显示）
        </button>
      )}

      {/* 步骤 3：粘底结账按钮（折叠积分/券） */}
      {cart.length > 0 && (
        <div style={{
          position: 'sticky', bottom: 16, marginTop: 16,
          padding: '16px', borderRadius: '16px',
          background: 'rgba(10, 26, 18, 0.97)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          border: '1px solid rgba(184, 134, 11, 0.45)',
          boxShadow: '0 -4px 32px rgba(0, 0, 0, 0.5), 0 0 16px rgba(184, 134, 11, 0.25)',
          zIndex: 10,
        }}>
          {error && (
            <div style={{
              marginBottom: 10, padding: '8px 12px', borderRadius: '8px',
              background: 'rgba(255, 107, 107, 0.1)', border: '1px solid rgba(255, 107, 107, 0.3)',
              color: '#ff6b6b', fontSize: 12,
            }}>❌ {error}</div>
          )}
          {/* ⭐ 积分/券做大块可视化（奕霖 2026-08-03 20:20 反馈"积分抵扣再做大一点"） */}
          {customer && customer.points >= 50 && (
            <div style={{
              padding: '12px 14px', borderRadius: '12px', marginBottom: 10,
              background: usePoints
                ? 'linear-gradient(135deg, rgba(184, 134, 11, 0.18), rgba(45, 138, 79, 0.10))'
                : 'rgba(184, 134, 11, 0.06)',
              border: usePoints ? '2px solid rgba(184, 134, 11, 0.6)' : '1px solid rgba(184, 134, 11, 0.2)',
              cursor: 'pointer',
            }} onClick={function() { setUsePoints(!usePoints); }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 22 }}>💎</span>
                    <span style={{ fontSize: 14, color: '#fff', fontWeight: 700 }}>用积分抵扣</span>
                    {usePoints && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#fbbf24', color: '#0a0f0d', fontWeight: 700 }}>已开启</span>}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>
                    余额 <span style={{ color: '#fbbf24', fontWeight: 700 }}>{customer.points}</span> 分 ·
                    本单最多抵 <span style={{ color: '#fbbf24', fontWeight: 700 }}>¥{pointsDiscount.toFixed(2)}</span>
                  </div>
                </div>
                <div style={{
                  width: 40, height: 24, borderRadius: '12px',
                  background: usePoints ? '#fbbf24' : 'rgba(255,255,255,0.15)',
                  position: 'relative', transition: 'all 0.2s',
                  flexShrink: 0,
                }}>
                  <div style={{
                    position: 'absolute', top: 2, left: usePoints ? 18 : 2,
                    width: 20, height: 20, borderRadius: '50%',
                    background: usePoints ? '#0a0f0d' : '#fff',
                    transition: 'all 0.2s',
                  }} />
                </div>
              </div>
            </div>
          )}

          {/* 优惠券大块输入（同样放大） */}
          {customerCoupons.length > 0 && (
            <div style={{
              padding: '12px 14px', borderRadius: '12px', marginBottom: 10,
              background: 'rgba(251, 191, 36, 0.06)', border: '1px solid rgba(251, 191, 36, 0.2)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: 18 }}>🎟️</span>
                <span style={{ fontSize: 13, color: '#fbbf24', fontWeight: 700 }}>有 {customerCoupons.length} 张可用券</span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {customerCoupons.slice(0, 2).map(function(c) {
                  var eligible = total >= (c.minSpend || 0)
                  var isSelected = appliedCoupon && appliedCoupon.id === c.id
                  return (
                    <button
                      key={c.id}
                      onClick={function() {
                        // ⭐ 奕霖 21:00 反馈"券点了不能取消"：再点一次取消选中
                        if (isSelected) {
                          setCouponInput(''); setAppliedCoupon(null)
                        } else {
                          setCouponInput(c.code); setAppliedCoupon(c)
                        }
                      }}
                      disabled={!eligible}
                      style={{
                        flex: 1, padding: '8px 10px', borderRadius: '8px', textAlign: 'left',
                        background: couponInput === c.code ? 'rgba(184, 134, 11, 0.15)' : 'rgba(255,255,255,0.04)',
                        border: couponInput === c.code ? '1.5px solid #fbbf24' : '1px solid rgba(251, 191, 36, 0.3)',
                        color: eligible ? '#fff' : 'rgba(255,255,255,0.3)',
                        cursor: eligible ? 'pointer' : 'not-allowed',
                        fontSize: 11,
                      }}
                    >
                      <div style={{ fontWeight: 700 }}>{c.name}</div>
                      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                        {eligible ? `省 ¥${c.value}` : `需满 ¥${c.minSpend}`} · 剩 {c.daysLeft}天
                      </div>
                    </button>
                  )
                })}
              </div>
              {appliedCoupon && (
                <div style={{ marginTop: 6, fontSize: 11, color: '#fbbf24' }}>
                  ✅ 已选：{appliedCoupon.name}（省 ¥{appliedCoupon.value}）
                </div>
              )}
            </div>
          )}

          {/* ⭐ 已选商品小预览（防误下单，奕霖 20:47 反馈"小字显示，避免不注意"） */}
          <details style={{ marginBottom: 10 }}>
            <summary style={{
              fontSize: 11, color: 'rgba(255,255,255,0.5)', cursor: 'pointer',
              padding: '4px 0', listStyle: 'none',
            }}>📦 已选 {cart.length} 件（小字预览，点击展开确认）</summary>
            <div style={{
              marginTop: 6, padding: 8, background: 'rgba(0,0,0,0.2)', borderRadius: 6,
              maxHeight: 120, overflowY: 'auto',
            }}>
              {cart.map(function(i) {
                return (
                  <div key={i.productId} style={{
                    fontSize: 11, color: 'rgba(255,255,255,0.65)', lineHeight: '20px',
                    display: 'flex', justifyContent: 'space-between',
                  }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
                      {i.productName}
                    </span>
                    <span style={{ fontFamily: 'monospace' }}>
                      ×{i.quantity} = ¥{(i.price * i.quantity).toFixed(2)}
                    </span>
                  </div>
                )
              })}
            </div>
          </details>

          {/* ⭐ 计费明细（永远展示，用不用卷都有，奕霖 20:47 反馈） */}
          <div style={{
            padding: '10px 12px', borderRadius: '10px', marginBottom: 10,
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(184, 134, 11, 0.15)',
            fontSize: 13,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ color: 'rgba(255,255,255,0.7)' }}>商品小计（{cart.length} 件）</span>
              <span style={{ color: '#fff' }}>¥{total.toFixed(2)}</span>
            </div>
            {pointsDiscount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: '#fbbf24' }}>💎 积分抵扣</span>
                <span style={{ color: '#fbbf24' }}>-¥{pointsDiscount.toFixed(2)}</span>
              </div>
            )}
            {couponDiscount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: '#fbbf24' }}>🎟️ 优惠券{appliedCoupon ? '（' + appliedCoupon.name + '）' : ''}</span>
                <span style={{ color: '#fbbf24' }}>-¥{couponDiscount.toFixed(2)}</span>
              </div>
            )}
            {earnedPoints > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ color: 'rgba(184, 134, 11, 0.7)', fontSize: 12 }}>🎁 获得积分</span>
                <span style={{ color: '#fbbf24', fontSize: 12, fontWeight: 700 }}>+{earnedPoints} 分</span>
              </div>
            )}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: 6, marginTop: 4,
            }}>
              <span style={{ color: '#fff', fontWeight: 600 }}>实付</span>
              <span style={{ fontSize: 22, color: '#fbbf24', fontWeight: 800 }}>
                ¥{finalTotal.toFixed(2)}
              </span>
            </div>
          </div>
          <button
            onClick={handleCheckout} disabled={checkoutLoading}
            style={{
              width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
              background: '#fbbf24', color: '#0a0f0d',
              fontSize: 16, fontWeight: 700, cursor: checkoutLoading ? 'wait' : 'pointer',
            }}
          >{checkoutLoading ? '结账中...' : '✅ 确认结账'}</button>
        </div>
      )}
    </div>
  )
}

// =====================================================
// InventoryTab — 库存管理（独立 tab，折叠收好）
// =====================================================

function InventoryTab() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'low' | 'out'>('all')

  useEffect(() => {
    setLoading(true)
    fetch('/api/admin/retail/products?pageSize=50')
      .then(function(r) { return r.json(); })
      .then(function(j) { if (j.success) setItems(j.items || []); })
      .catch(function() {})
      .finally(function() { setLoading(false); })
  }, [])

  const filtered = items.filter(function(p) {
    if (filter === 'low') return p.isLowStock && !p.isOutOfStock
    if (filter === 'out') return p.isOutOfStock
    return true
  })

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <FilterChip active={filter === 'all'} onClick={function() { setFilter('all'); }}>全部 {items.length}</FilterChip>
        <FilterChip active={filter === 'low'} onClick={function() { setFilter('low'); }}>⚠️ 低库存</FilterChip>
        <FilterChip active={filter === 'out'} onClick={function() { setFilter('out'); }}>🚫 售罄</FilterChip>
      </div>
      {loading ? (
        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)', padding: '40px' }}>加载中...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', padding: '40px' }}>暂无商品</div>
      ) : (
        filtered.slice(0, 50).map(function(p) {
          return (
            <div key={p.id} style={{
              padding: '12px 14px', borderRadius: '12px', marginBottom: 6,
              background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(184, 134, 11, 0.1)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
                <div style={{ fontSize: 13, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                {p.spec && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{p.spec}</div>}
              </div>
              <div style={{
                fontSize: 14, fontWeight: 700,
                color: p.isOutOfStock ? '#ff6b6b' : p.isLowStock ? '#ffbb00' : '#fbbf24',
              }}>
                {p.isOutOfStock ? '🚫 售罄' : '⚠️ ' + p.stock}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

function FilterChip(props: { active: boolean; onClick: () => void; children: any }) {
  return (
    <button onClick={props.onClick} style={{
      padding: '6px 14px', borderRadius: '20px',
      border: props.active ? '1px solid #fbbf24' : '1px solid rgba(184, 134, 11, 0.15)',
      background: props.active ? 'rgba(184, 134, 11, 0.15)' : 'rgba(255, 255, 255, 0.03)',
      color: props.active ? '#fbbf24' : 'rgba(255,255,255,0.6)',
      fontSize: 12, fontWeight: 600, cursor: 'pointer',
    }}>{props.children}</button>
  )
}

function HubCard(props: { icon: string; label: string; value: any; unit: string; hint: string; color: string }) {
  return (
    <div style={{
      padding: '10px 12px', borderRadius: '10px',
      background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.06)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 14 }}>{props.icon}</span>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>{props.label}</span>
      </div>
      <div style={{ fontSize: 18, color: props.color, fontWeight: 800 }}>
        {props.value}<span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginLeft: 2, fontWeight: 500 }}>{props.unit}</span>
      </div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{props.hint}</div>
    </div>
  )
}

// =====================================================
// DashboardTab — 数据统计（独立 tab，简化版）
// =====================================================

function DashboardTab() {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [scrollDays, setScrollDays] = useState(10)  // ⭐ 奕霖 21:23 反馈"10天滚动摘要"

  useEffect(() => {
    setLoading(true)
    fetch('/api/admin/retail/dashboard')
      .then(function(r) { return r.json(); })
      .then(function(j) { if (j.success) setStats(j); })
      .catch(function() {})
      .finally(function() { setLoading(false); })
  }, [])

  if (loading) return <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)', padding: '40px' }}>加载中...</div>
  if (!stats) return <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', padding: '40px' }}>暂无数据</div>

  // ⭐ 字段映射：API 返回嵌套 sales.{today,week,month} 格式
  var today = (stats.sales && stats.sales.today) || {}
  var yesterday = (stats.sales && stats.sales.yesterday) || {}
  var week = (stats.sales && stats.sales.week) || {}
  var month = (stats.sales && stats.sales.month) || {}
  var dailyRev = stats.dailyRevenue || []
  var lowStockArr = stats.lowStockProducts || []
  var outStockArr = stats.outOfStockProducts || []
  var customerStats = stats.customerStats || {}

  // ⭐ 10 天滚动摘要（奕霖 21:23 反馈）
  var dailyRevArr = dailyRev.slice(-scrollDays)
  var totalRevInRange = dailyRevArr.reduce(function(s: number, d: any) { return s + Number(d.revenue || 0); }, 0)
  var totalOrdersInRange = dailyRevArr.reduce(function(s: number, d: any) { return s + Number(d.orders || 0); }, 0)

  return (
    <div>
      {/* 4 个核心指标卡 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <StatCard label="今日订单" value={today.orders || 0} unit="单" icon="📦" />
        <StatCard label="今日营收" value={today.revenue || 0} unit="¥" icon="💰" />
        <StatCard label="昨日对比" value={yesterday.revenue || 0} unit="¥" icon="📊" />
        <StatCard label="客单价" value={today.avgOrder || 0} unit="¥" icon="💵" />
      </div>

      {/* 周/月汇总 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <Card>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>本周营收</div>
          <div style={{ fontSize: 18, color: '#fbbf24', fontWeight: 800 }}>¥{week.revenue || 0}<span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginLeft: 4 }}>· {week.orders || 0} 单</span></div>
        </Card>
        <Card>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>本月营收</div>
          <div style={{ fontSize: 18, color: '#fbbf24', fontWeight: 800 }}>¥{month.revenue || 0}<span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginLeft: 4 }}>· {month.orders || 0} 单</span></div>
        </Card>
      </div>

      {/* ⭐ 10 天滚动摘要（奕霖 21:23 反馈） */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 13, color: '#fbbf24', fontWeight: 700 }}>📊 最近 {scrollDays} 天滚动摘要</div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={function() { setScrollDays(7); }} style={{
              padding: '4px 8px', borderRadius: '8px', fontSize: 10,
              background: scrollDays === 7 ? 'rgba(184, 134, 11, 0.2)' : 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(184, 134, 11, 0.2)',
              color: scrollDays === 7 ? '#fbbf24' : 'rgba(255,255,255,0.6)',
              cursor: 'pointer',
            }}>7天</button>
            <button onClick={function() { setScrollDays(10); }} style={{
              padding: '4px 8px', borderRadius: '8px', fontSize: 10,
              background: scrollDays === 10 ? 'rgba(184, 134, 11, 0.2)' : 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(184, 134, 11, 0.2)',
              color: scrollDays === 10 ? '#fbbf24' : 'rgba(255,255,255,0.6)',
              cursor: 'pointer',
            }}>10天</button>
            <button onClick={function() { setScrollDays(30); }} style={{
              padding: '4px 8px', borderRadius: '8px', fontSize: 10,
              background: scrollDays === 30 ? 'rgba(184, 134, 11, 0.2)' : 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(184, 134, 11, 0.2)',
              color: scrollDays === 30 ? '#fbbf24' : 'rgba(255,255,255,0.6)',
              cursor: 'pointer',
            }}>30天</button>
          </div>
        </div>
        <div style={{
          fontSize: 11, color: 'rgba(255,255,255,0.6)', marginBottom: 8,
          display: 'flex', justifyContent: 'space-between',
        }}>
          <span>总计 ¥{totalRevInRange.toFixed(2)}</span>
          <span>{totalOrdersInRange} 单</span>
        </div>
        {/* 横向滚动摘要条 */}
        <div style={{
          display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4,
          maxHeight: 120, overflowY: 'auto',
        }}>
          {dailyRevArr.map(function(d: any, idx: number) {
            var maxRev = Math.max.apply(null, dailyRevArr.map(function(x: any) { return Number(x.revenue || 0); }).concat([1]))
            var heightPct = (Number(d.revenue || 0) / maxRev) * 80
            return (
              <div key={idx} style={{
                flex: '0 0 auto', minWidth: 56,
                padding: '6px 4px', borderRadius: '8px',
                background: 'rgba(184, 134, 11, 0.04)', border: '1px solid rgba(184, 134, 11, 0.1)',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>{d.day}</div>
                <div style={{
                  width: 30, height: Math.max(heightPct, 4),
                  background: 'linear-gradient(180deg, #fbbf24, #4a9d65)',
                  borderRadius: '3px', margin: '0 auto',
                }} />
                <div style={{ fontSize: 10, color: '#fbbf24', fontWeight: 700, marginTop: 4 }}>¥{Number(d.revenue || 0).toFixed(0)}</div>
                <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>{d.orders || 0}单</div>
              </div>
            )
          })}
        </div>
      </Card>

      {/* 库存预警 */}
      {(lowStockArr.length > 0 || outStockArr.length > 0) && (
        <Card>
          <div style={{ fontSize: 13, color: '#ffbb00', fontWeight: 700, marginBottom: 8 }}>⚠️ 库存预警</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
            低库存 <span style={{ color: '#ffbb00', fontWeight: 700 }}>{lowStockArr.length}</span> 件 ·
            售罄 <span style={{ color: '#ff6b6b', fontWeight: 700 }}>{outStockArr.length}</span> 件
          </div>
        </Card>
      )}
    </div>
  )
}

function StatCard(props: { label: string; value: any; unit: string; icon: string }) {
  return (
    <div style={{
      padding: '14px', borderRadius: '14px',
      background: 'rgba(184, 134, 11, 0.06)', border: '1px solid rgba(184, 134, 11, 0.15)',
    }}>
      <div style={{ fontSize: 18, marginBottom: 4 }}>{props.icon}</div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>{props.label}</div>
      <div style={{ fontSize: 20, color: '#fbbf24', fontWeight: 800 }}>
        {props.value}<span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginLeft: 2 }}>{props.unit}</span>
      </div>
    </div>
  )
}

// =====================================================
// OrdersTab — 订单列表
// =====================================================

function OrdersTab() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  // ⭐ MEMORY §307 v0.8.47 (2026-08-29 13:27 奕霖) — 点击订单看下单了啥
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null)

  // ⭐ 奕霖 21:00 反馈"订单没数据"根因：之前用 /api/orders 强制要 phone 参数
  //    改成 /api/admin/orders/（verifyAdminRequest 已支持 StaffGate cookie）
  useEffect(function() {
    setLoading(true)
    fetch('/api/admin/orders?limit=50&days=7')
      .then(function(r) { return r.json(); })
      .then(function(j) { if (j.success) setOrders(j.orders || []); })
      .catch(function() {})
      .finally(function() { setLoading(false); })
  }, [])

  // ⭐ MEMORY §308 v0.8.47 hotfix — STATUS 提到模块顶层(line 49),OrdersTab 直接引用
  // ⭐ 奕霖 21:23 反馈"订单里加完成和未完成的"
  // ⭐ 奕霖 23:37 反馈"旧订单还在"：默认 unfinished（不要一来一片乱）
  const [statusFilter, setStatusFilter] = useState<'all' | 'unfinished' | 'finished' | 'cancelled'>('unfinished')

  if (loading) return <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)', padding: '40px' }}>加载中...</div>
  if (orders.length === 0) return <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', padding: '40px' }}>暂无订单</div>

  // ⭐ 按筛选过滤（奕霖 21:23 反馈）
  var filteredOrders = orders.filter(function(o: any) {
    if (statusFilter === 'finished') return ['completed', 'delivered'].indexOf(o.status) >= 0
    if (statusFilter === 'unfinished') return ['pending', 'paid', 'ready'].indexOf(o.status) >= 0
    if (statusFilter === 'cancelled') return o.status === 'cancelled'
    return true
  })

  var countAll = orders.length
  var countUnfinished = orders.filter(function(o: any) { return ['pending', 'paid', 'ready'].indexOf(o.status) >= 0; }).length
  var countFinished = orders.filter(function(o: any) { return ['completed', 'delivered'].indexOf(o.status) >= 0; }).length
  var countCancelled = orders.filter(function(o: any) { return o.status === 'cancelled'; }).length
  if (orders.length === 0) return <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', padding: '40px' }}>暂无订单</div>

  // ⭐ 按时间+分类分组（奕霖 20:47 反馈"按时间和分类戳，进行分类"）
  //    用 filteredOrders 而非 orders，让筛选生效
  var grouped: Record<string, any[]> = {}
  filteredOrders.forEach(function(o) {
    var date = (o.createdAt || '').slice(0, 10) || '未知日期'
    if (!grouped[date]) grouped[date] = []
    grouped[date].push(o)
  })

  return (
    <div>
      {/* ⭐ 状态筛选 chips（奕霖 21:23 反馈"完成和未完成"） */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        <button onClick={function() { setStatusFilter('all'); }} style={{
          padding: '6px 12px', borderRadius: '20px',
          background: statusFilter === 'all' ? 'rgba(184, 134, 11, 0.2)' : 'rgba(255,255,255,0.04)',
          border: statusFilter === 'all' ? '1px solid #fbbf24' : '1px solid rgba(184, 134, 11, 0.15)',
          color: statusFilter === 'all' ? '#fbbf24' : 'rgba(255,255,255,0.6)',
          fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}>📋 全部 {countAll}</button>
        <button onClick={function() { setStatusFilter('unfinished'); }} style={{
          padding: '6px 12px', borderRadius: '20px',
          background: statusFilter === 'unfinished' ? 'rgba(251, 191, 36, 0.2)' : 'rgba(255,255,255,0.04)',
          border: statusFilter === 'unfinished' ? '1px solid #fbbf24' : '1px solid rgba(184, 134, 11, 0.15)',
          color: statusFilter === 'unfinished' ? '#fbbf24' : 'rgba(255,255,255,0.6)',
          fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}>⏳ 未完成 {countUnfinished}</button>
        <button onClick={function() { setStatusFilter('finished'); }} style={{
          padding: '6px 12px', borderRadius: '20px',
          background: statusFilter === 'finished' ? 'rgba(52, 211, 153, 0.2)' : 'rgba(255,255,255,0.04)',
          border: statusFilter === 'finished' ? '1px solid #34d399' : '1px solid rgba(184, 134, 11, 0.15)',
          color: statusFilter === 'finished' ? '#34d399' : 'rgba(255,255,255,0.6)',
          fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}>✅ 已完成 {countFinished}</button>
        <button onClick={function() { setStatusFilter('cancelled'); }} style={{
          padding: '6px 12px', borderRadius: '20px',
          background: statusFilter === 'cancelled' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(255,255,255,0.04)',
          border: statusFilter === 'cancelled' ? '1px solid #94a3b8' : '1px solid rgba(184, 134, 11, 0.15)',
          color: statusFilter === 'cancelled' ? '#94a3b8' : 'rgba(255,255,255,0.6)',
          fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}>🚫 已取消 {countCancelled}</button>
      </div>

      {filteredOrders.length === 0 && (
        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', padding: '40px' }}>
          当前筛选下没有订单
        </div>
      )}

      {/* ⭐ 按时间+分类分组（奕霖 20:47 反馈） */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>📅 按日期分组（最近 {filteredOrders.length} 单）</span>
      </div>

      {Object.entries(grouped).map(function(entry: any) {
        var date = entry[0]
        var dayOrders = entry[1]
        return (
          <div key={date} style={{ marginBottom: 16 }}>
            {/* 日期 section header */}
            <div style={{
              padding: '8px 12px', marginBottom: 8,
              background: 'rgba(184, 134, 11, 0.06)', borderRadius: '10px',
              border: '1px solid rgba(184, 134, 11, 0.15)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontSize: 13, color: '#fbbf24', fontWeight: 700 }}>📅 {date}</span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{dayOrders.length} 单 · ¥{dayOrders.reduce(function(s: number, o: any) { return s + Number(o.totalAmount || o.finalAmount || 0); }, 0).toFixed(2)}</span>
            </div>
            {dayOrders.map(function(o: any) {
              var s = STATUS[o.status] || { l: o.status, c: '#94a3b8' }
              // ⭐ MEMORY §307 v0.8.47 (2026-08-29 13:27 奕霖) — 显示下单人 + 点击弹窗
              var customerLabel = o.customerName || o.deliveryPhone || o.customerPhone || '未关联顾客'
              var phoneLabel = o.deliveryPhone || o.customerPhone || ''
              return (
                <div key={o.id} onClick={function() { setSelectedOrder(o); }} style={{
                  padding: '12px 14px', borderRadius: '12px', marginBottom: 6,
                  background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(184, 134, 11, 0.1)',
                  cursor: 'pointer', transition: 'all 0.2s ease',
                }}
                  onMouseEnter={function(e: any) { e.currentTarget.style.background = 'rgba(184, 134, 11, 0.08)'; e.currentTarget.style.borderColor = 'rgba(184, 134, 11, 0.3)'; }}
                  onMouseLeave={function(e: any) { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'; e.currentTarget.style.borderColor = 'rgba(184, 134, 11, 0.1)'; }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
                      <div style={{ fontSize: 13, color: '#fff', fontWeight: 600, marginBottom: 4 }}>
                        <span style={{ fontSize: 10, color: s.c, marginRight: 6, padding: '1px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.06)' }}>{s.l}</span>
                        {o.orderNo.slice(-8)}
                      </div>
                      {/* ⭐ MEMORY §307 v0.8.47 — 显示下单人 */}
                      <div style={{ fontSize: 11, color: '#fbbf24', marginBottom: 4, fontWeight: 600 }}>
                        👤 {customerLabel}{phoneLabel ? ' · 📞 ' + phoneLabel : ''}
                      </div>
                      {/* ⭐ 时间戳 + 取货码 + 商品数 */}
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', display: 'flex', gap: 8 }}>
                        <span>🕒 {o.createdAt ? new Date(o.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                        {o.pickupCode && <span>🔢 {o.pickupCode}</span>}
                        <span>📦 {(o.itemCount || (o.items && o.items.length) || 0)}件</span>
                      </div>
                    </div>
                    <div style={{ fontSize: 16, color: '#fbbf24', fontWeight: 700, flexShrink: 0 }}>¥{Number(o.totalAmount || o.finalAmount || 0).toFixed(2)}</div>
                  </div>
                </div>
              )
            })}

            {/* ⭐ MEMORY §307 v0.8.47 (2026-08-29 13:27 奕霖) — 订单详情弹窗(点击订单后显示) */}
            {selectedOrder && <OrderDetailModal order={selectedOrder} onClose={function() { setSelectedOrder(null); }} />}
          </div>
        )
      })}
    </div>
  )
}

// ⭐ MEMORY §307 v0.8.47 — 订单详情弹窗组件
function OrderDetailModal(props: { order: any; onClose: () => void }) {
  var o = props.order
  var s = STATUS[o.status] || { l: o.status, c: '#94a3b8' }
  var items = o.items || []
  var totalQty = items.reduce(function(sum: number, it: any) { return sum + Number(it.quantity || 0); }, 0)

  // ⭐ MEMORY §310 v0.8.50 (2026-08-29 13:45 奕霖) — 用户画像(行为数据驱动)
  // 按 memories 偏好[2026-07-14 12:38]:基于行为数据画像,不依赖 AI 生成性格标签
  var phone = (o.deliveryPhone || o.customerPhone || '').toString()
  var profileState = useState<any>(null)
  var profile = profileState[0]
  var setProfile = profileState[1]
  var profileLoadingState = useState<boolean>(false)
  var profileLoading = profileLoadingState[0]
  var setProfileLoading = profileLoadingState[1]
  // ⭐ MEMORY §311 v0.8.51 (2026-08-29 13:59 奕霖) — 折叠近期消费记录
  // 按 memories 偏好[2026-08-24 19:36]:默认收起 + 1 次点击展开(避免深层嵌套)
  var showRecentState = useState<boolean>(false)
  var showRecent = showRecentState[0]
  var setShowRecent = showRecentState[1]

  useEffect(function() {
    if (!/^1\d{10}$/.test(phone)) {
      setProfile(null)
      return
    }
    setProfileLoading(true)
    fetch('/api/admin/customers/' + phone + '/profile', { credentials: 'include' })
      .then(function(r) { return r.json(); })
      .then(function(j) {
        if (j && j.success) setProfile(j.profile)
        else setProfile(null)
      })
      .catch(function() { setProfile(null); })
      .finally(function() { setProfileLoading(false); })
  }, [phone])

  return (
    <div onClick={function(e: any) { if (e.target === e.currentTarget) props.onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}>
      <div style={{
        background: 'linear-gradient(135deg, rgba(26, 58, 42, 0.95), rgba(15, 22, 18, 0.98))',
        borderRadius: '18px', padding: '16px', width: 'calc(100vw - 32px)', maxWidth: 340,
        border: '1px solid rgba(184, 134, 11, 0.25)',
        boxShadow: '0 20px 48px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(184, 134, 11, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
        maxHeight: '80vh', overflowY: 'auto',
      }}>
        {/* header: 订单号 + 关闭按钮 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>订单号</div>
            <div style={{ fontSize: 14, color: '#fff', fontWeight: 700, fontFamily: 'monospace' }}>{o.orderNo}</div>
          </div>
          <button onClick={function() { props.onClose(); }} style={{
            width: 26, height: 26, borderRadius: '50%',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            color: 'rgba(255,255,255,0.5)', fontSize: 13, cursor: 'pointer',
          }}>×</button>
        </div>

        {/* 状态条 */}
        <div style={{ padding: '10px 12px', borderRadius: 12, marginBottom: 12, background: 'rgba(184, 134, 11, 0.06)', border: '1px solid ' + s.c + '33' }}>
          <span style={{ fontSize: 11, color: s.c, padding: '2px 8px', borderRadius: 6, background: s.c + '22', fontWeight: 700 }}>{s.l}</span>
          <span style={{ marginLeft: 10, fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
            {o.createdAt ? new Date(o.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
          </span>
        </div>

        {/* 顾客信息 */}
        <div style={{ padding: '10px 12px', borderRadius: 10, marginBottom: 10, background: 'rgba(184, 134, 11, 0.06)', border: '1px solid rgba(184, 134, 11, 0.15)' }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>👤 下单人</div>
          <div style={{ fontSize: 14, color: '#fff', fontWeight: 600 }}>{o.customerName || '匿名顾客'}</div>
          <div style={{ fontSize: 12, color: 'rgba(184, 134, 11,0.85)', marginTop: 4 }}>
            📞 {o.deliveryPhone || o.customerPhone || '无手机号'}
          </div>
        </div>

        {/* ⭐ MEMORY §310 v0.8.50 — 画像标签(行为数据驱动,不是 AI 生成性格标签) */}
        {profile && profile.tags && profile.tags.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginBottom: 5 }}>🧠 画像标签</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {profile.tags.map(function(tag: any, idx: number) {
                return (
                  <span key={idx} style={{
                    fontSize: 10, padding: '3px 8px', borderRadius: 10,
                    background: tag.color + '22', border: '1px solid ' + tag.color + '55',
                    color: tag.color, fontWeight: 600,
                  }}>{tag.emoji + ' ' + tag.text}</span>
                )
              })}
            </div>
          </div>
        )}

        {/* ⭐ MEMORY §310 v0.8.50 — 消费概览(3 列 grid) */}
        {profile && (profile.totalOrders > 0 || profile.validSpent > 0) && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginBottom: 5 }}>📊 消费概览</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
              <div style={{ padding: '6px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.04)', textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)' }}>订单</div>
                <div style={{ fontSize: 13, color: '#fbbf24', fontWeight: 700 }}>{profile.totalOrders}</div>
              </div>
              <div style={{ padding: '6px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.04)', textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)' }}>消费</div>
                <div style={{ fontSize: 13, color: '#fbbf24', fontWeight: 700 }}>¥{Math.round(profile.validSpent)}</div>
              </div>
              <div style={{ padding: '6px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.04)', textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)' }}>客单</div>
                <div style={{ fontSize: 13, color: '#fbbf24', fontWeight: 700 }}>¥{Math.round(profile.avgOrder)}</div>
              </div>
            </div>
          </div>
        )}

        {/* 6 位取货码(奕霖偏好左下角显示) */}
        {o.pickupCode && (
          <div style={{ padding: '10px', borderRadius: 10, marginBottom: 10, background: 'linear-gradient(135deg, rgba(184, 134, 11, 0.10), rgba(74, 157, 101, 0.06))', border: '1px solid rgba(184, 134, 11, 0.20)', textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginBottom: 3 }}>取货码</div>
            <div style={{ fontSize: 22, color: '#fbbf24', fontWeight: 800, fontFamily: 'monospace', letterSpacing: '3px' }}>{o.pickupCode}</div>
          </div>
        )}

        {/* 商品清单 */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>📦 商品 ({items.length}件 · 共 {totalQty}份)</div>
          {items.length === 0 ? (
            <div style={{ padding: 12, textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 12, background: 'rgba(255,255,255,0.03)', borderRadius: 10 }}>无明细</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map(function(it: any, idx: number) {
                return (
                  <div key={idx} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px', borderRadius: 10,
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(184, 134, 11, 0.08)',
                  }}>
                    {it.productImage && (
                      <img src={it.productImage} style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover' }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: '#fff', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.productName}</div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>{it.productSpec || '无规格'}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 12, color: '#fbbf24', fontWeight: 700 }}>¥{Number(it.subtotal || 0).toFixed(2)}</div>
                      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>×{it.quantity}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 金额汇总 */}
        <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(184, 134, 11, 0.05)', border: '1px solid rgba(184, 134, 11, 0.12)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>订单总额</span>
            <span style={{ fontSize: 18, color: '#fbbf24', fontWeight: 800 }}>¥{Number(o.totalAmount || o.finalAmount || 0).toFixed(2)}</span>
          </div>
          {o.posRecordedAmount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>实付金额(POS 录入)</span>
              <span style={{ fontSize: 11, color: '#a8e6b8', fontWeight: 600 }}>¥{Number(o.posRecordedAmount).toFixed(2)}</span>
            </div>
          )}
        </div>

        {o.remark && (
          <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
            💬 {o.remark}
          </div>
        )}

        {/* ⭐ MEMORY §311 v0.8.51 — 近期消费记录(默认折叠,1 次点击展开) */}
        {profile && profile.recentOrders && profile.recentOrders.length > 0 && (function() {
          var recentTotal = profile.recentOrders.reduce(function(s: number, ro: any) { return s + Number(ro.totalAmount || 0); }, 0)
          var cancelledCount = profile.recentOrders.filter(function(ro: any) { return ro.status === 'cancelled'; }).length
          return (
            <div style={{ marginTop: 10 }}>
              {/* 标题栏(可点击,1 次点击展开) */}
              <div onClick={function() { setShowRecent(!showRecent); }} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '7px 10px', borderRadius: 6, cursor: 'pointer',
                background: 'rgba(184, 134, 11, 0.06)', border: '1px solid rgba(184, 134, 11, 0.2)',
                userSelect: 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>
                  <span style={{ color: '#fbbf24', fontSize: 9, transition: 'transform 0.2s', transform: showRecent ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                  <span>📋 近期消费</span>
                  <span style={{ color: 'rgba(255,255,255,0.45)' }}>{profile.recentOrders.length}单 · ¥{Math.round(recentTotal)}{cancelledCount > 0 ? ' · ' + cancelledCount + '取消' : ''}</span>
                </div>
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>{showRecent ? '点击收起' : '点击展开'}</span>
              </div>
              {/* 展开后的订单列表 */}
              {showRecent && (
                <div style={{ marginTop: 4 }}>
                  {profile.recentOrders.map(function(ro: any, idx: number) {
                    var rs = STATUS[ro.status] || { l: ro.status, c: '#94a3b8' }
                    return (
                      <div key={idx} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '6px 8px', marginBottom: 3, borderRadius: 6,
                        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)',
                        fontSize: 10,
                      }}>
                        <div style={{ minWidth: 0, flex: 1, marginRight: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <span style={{ color: rs.c, fontWeight: 600 }}>{rs.l}</span>
                          <span style={{ color: 'rgba(255,255,255,0.5)', marginLeft: 4 }}>{(ro.orderNo || '').slice(-6)}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          <span style={{ color: 'rgba(255,255,255,0.45)' }}>{ro.itemCount}件</span>
                          <span style={{ color: '#fbbf24', fontWeight: 600 }}>¥{Number(ro.totalAmount || 0).toFixed(0)}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })()}
      </div>
    </div>
  )
}