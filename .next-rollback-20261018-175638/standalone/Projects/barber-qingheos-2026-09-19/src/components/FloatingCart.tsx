'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  getCart,
  getCartCount,
  getCartTotal,
  removeFromCart,
  updateCartQty,
  type CartItem,
} from '@/lib/cart'

interface FloatingCartProps {
  /** 是否下方有 BottomTabBar（chat 页 false） */
  hasBottomTab?: boolean
}

const CART_KEY = 'cart'

/**
 * 全站浮窗购物车（2026-07-18 by 清禾）
 *
 * 适用：所有用户页面（/chat /activity /products /search /merchant 等）
 * 排除：/cart /pickup /admin /merchant admin side /login /agreement
 *
 * 监听 cart.ts saveCart 派发的 storage 事件 → 实时同步
 * 展开：底部抽屉（移动友好）→ 商品列表 + 增减 + 总价 + 去结算
 */
export default function FloatingCart({ hasBottomTab = true }: FloatingCartProps) {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [count, setCount] = useState(0)
  const [items, setItems] = useState<CartItem[]>([])
  const [open, setOpen] = useState(false)
  const [bump, setBump] = useState(0) // 数字变化时小动画

  const refresh = () => {
    setCount(getCartCount())
    setItems(getCart())
  }

  useEffect(() => {
    setMounted(true)
    refresh()
    const onStorage = (e: StorageEvent) => {
      if (e.key === CART_KEY || e.key === null) refresh()
    }
    // ⭐ 19:16 奕霖：StorageEvent 同窗口不触发，补 CustomEvent 监听
    const onCartUpdated = () => refresh()
    window.addEventListener('storage', onStorage)
    window.addEventListener('cart-updated', onCartUpdated)
    // 兜底轮询（防御性）
    const t = setInterval(() => {
      const c = getCartCount()
      setCount((prev) => {
        if (prev !== c) {
          setBump((b) => b + 1)
          setItems(getCart())
        }
        return c
      })
    }, 800)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('cart-updated', onCartUpdated)
      clearInterval(t)
    }
  }, [])

  if (!mounted) return null
  // ⭐ 奕霖 2026-07-24 16:36 反馈：“只在两个页面有浮窗” → 原来是购物车空时完全不渲染
  // 改为：购物车空时也渲染一个小空购物袋图标，仅 count>0 时加角标 + 价格
  // 这样每一个页面都能点进 /cart，浮窗一直可见
  const isEmpty = count === 0

  const total = getCartTotal()
  // ⭐ 奕霖 2026-07-24 16:53 反馈图：FAB 压住了 TabBar「附近/我的」 + 商品「加入购物车」按钮
  // 之前 84px 只留 TabBar 上 17px 空白不够，FAB 自身 52px 高，导致 x 重叠
  // 修复：TabBar 上至少留 24px 清晰空格，bottom → 96px；同时再加 ChatInput 退避（无 TabBar 但有输入框的页）
  const bottom = hasBottomTab
    ? 96
    : `calc(108px + env(safe-area-inset-bottom, 0px))`

  return (
    <>
      {/* 主按钮 - ⭐ 19:29 奕霖：点开抽屉；cart 内部"去结算"和购物车图标 click 都跳 /cart */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="购物车"
        style={{
          position: 'fixed',
          // ⭐ 奕霖 2026-07-24 03:25：小屏适配——右边缘 12px，靠拇指区域
          right: 12,
          // ⭐ 奕霖 2026-07-24 16:36 “位置上移一点”：购物车空时再往上提一点
          bottom: isEmpty ? `calc(112px + env(safe-area-inset-bottom, 0px))` : bottom,
          // ⭐ 奕霖 2026-07-24 03:47：zIndex 90 会被 ChatWindow wrapper zIndex=100 遮 → 提到 200，保证浮在所有层之上
          zIndex: 200,
          // ⭐ 奕霖 2026-07-24 16:36 购物车空时变小、变透明 —不抢重点但点点得了
          width: isEmpty ? 44 : 60,
          height: isEmpty ? 44 : 52,
          borderRadius: isEmpty ? 22 : 26,
          // ⭐ 奕霖 2026-07-24 03:25：粉紫 → 绿色主题（#b8860b 主色家族）；空状态调低透明度
          background: isEmpty
            ? 'rgba(184, 134, 11, 0.18)'
            : 'linear-gradient(135deg, #b8860b 0%, #b8860b 100%)',
          color: '#0a1f17',
          border: isEmpty
            ? '1.5px solid rgba(184, 134, 11,0.4)'
            : '1.5px solid rgba(255,255,255,0.18)',
          backdropFilter: isEmpty ? 'blur(12px)' : undefined,
          WebkitBackdropFilter: isEmpty ? 'blur(12px)' : undefined,
          cursor: 'pointer',
          boxShadow: isEmpty
            ? '0 4px 16px rgba(0,0,0,0.3)'
            : '0 8px 24px rgba(184, 134, 11,0.45), inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -2px 0 rgba(0,0,0,0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          animation: bump ? 'none' : undefined,
          transition: 'transform 0.18s ease, box-shadow 0.18s ease, background 0.2s ease',
        }}
        onMouseEnter={undefined}
      >
        {/* ⭐ 奕霖 2026-07-24 03:25：SVG 购物袋图标（替代 emoji，更精致）+ ¥价金额 */}
        <svg width={isEmpty ? 20 : 22} height={isEmpty ? 20 : 22} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 8z" stroke="#0a1f17" strokeWidth={isEmpty ? 2 : 1.8} strokeLinejoin="round" fill={isEmpty ? 'rgba(184, 134, 11,0.25)' : 'rgba(10,31,23,0.08)'}/>
          <path d="M9 8V6a3 3 0 0 1 6 0v2" stroke="#0a1f14" strokeWidth={isEmpty ? 2 : 1.8} strokeLinecap="round"/>
        </svg>
        {count > 0 && (
          <span style={{
            fontSize: 14, fontWeight: 700, color: '#0a1f17',
            lineHeight: 1, fontFamily: '-apple-system, BlinkMacSystemFont',
            letterSpacing: -0.3,
          }}>
            {count > 99 ? '99+' : count}
          </span>
        )}
        {count > 0 && (
          <span
            key={bump}
            style={{
              position: 'absolute',
              // ⭐ 奕霖 2026-07-24 16:53 截图：¥角标“”略出 FAB 圆形边界” → 从 -6/-6 调近到 -3/-3，让 border 贴 FAB 圆边
              top: -3,
              right: -3,
              minWidth: 18,
              height: 18,
              padding: '0 5px',
              borderRadius: 9,
              background: '#fb923c',
              color: '#0a1f17',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 10,
              fontWeight: 800,
              border: '1.5px solid #2c1810',
              animation: 'gb-pop 0.3s ease',
              boxShadow: '0 2px 6px rgba(251,146,60,0.5)',
              lineHeight: 1,
            }}
          >
            ¥
          </span>
        )}
        <style jsx>{`
          @keyframes gb-pop {
            0% { transform: scale(0.5); }
            60% { transform: scale(1.18); }
            100% { transform: scale(1); }
          }
        `}</style>
      </button>

      {/* 展开抽屉 */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            zIndex: 95,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            animation: 'gb-fade 0.18s ease',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 480,
              background: '#2c1810',
              border: '1px solid rgba(168,85,247,0.3)',
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              borderBottom: 'none',
              padding: 20,
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              paddingBottom: 'calc(20px + env(safe-area-inset-bottom))',
              animation: 'gb-slide 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#fff' }}>
                🛒 购物车 <span style={{ color: '#a855f7' }}>({count})</span>
              </h3>
              <button
                onClick={() => setOpen(false)}
                aria-label="关闭"
                style={{ background: 'transparent', border: 'none', color: '#9ca3af', fontSize: 24, cursor: 'pointer', lineHeight: 1 }}
              >
                ×
              </button>
            </div>

            {items.length === 0 ? (
              <div style={{ padding: '60px 20px', textAlign: 'center', color: '#9ca3af' }}>
                <div style={{ fontSize: 64 }}>🛒</div>
                <div style={{ marginTop: 12, fontSize: 14 }}>购物车空空如也</div>
                <button
                  onClick={() => { setOpen(false); router.push('/ai-find-drug') }}
                  style={{
                    marginTop: 20,
                    padding: '10px 24px',
                    background: 'rgba(168,85,247,0.15)',
                    color: '#a855f7',
                    border: '1px solid rgba(168,85,247,0.3)',
                    borderRadius: 10,
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  去逛逛造型 →
                </button>
              </div>
            ) : (
              <>
                <div style={{ flex: 1, overflowY: 'auto', marginRight: -8, paddingRight: 8 }}>
                  {items.map((item, i) => (
                    <div
                      key={`${item.productId}-${item.spec || ''}`}
                      style={{
                        display: 'flex',
                        gap: 12,
                        padding: '12px 0',
                        borderBottom: i < items.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                        alignItems: 'center',
                      }}
                    >
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 8,
                          background: 'rgba(255,255,255,0.06)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 24,
                          flexShrink: 0,
                        }}
                      >
                        {item.image ? (
                          <img
                            src={item.image}
                            alt=""
                            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }}
                          />
                        ) : (
                          '💊'
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 14,
                            color: '#fff',
                            fontWeight: 600,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={item.name}
                        >
                          {item.name}
                        </div>
                        {item.spec && (
                          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{item.spec}</div>
                        )}
                        <div style={{ marginTop: 4, color: '#a855f7', fontWeight: 700, fontSize: 14 }}>
                          ¥{Number(item.price || 0).toFixed(2)}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                        <button
                          onClick={() => {
                            removeFromCart(item.productId, item.spec)
                            refresh()
                          }}
                          aria-label="删除"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#9ca3af',
                            cursor: 'pointer',
                            fontSize: 16,
                            padding: 0,
                          }}
                        >
                          ×
                        </button>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <button
                            onClick={() => {
                              updateCartQty(item.productId, item.spec, (item.quantity || 1) - 1)
                              refresh()
                            }}
                            style={qtyBtn}
                            aria-label="减"
                          >
                            −
                          </button>
                          <span style={{ color: '#fff', fontSize: 13, minWidth: 24, textAlign: 'center' }}>
                            {item.quantity || 1}
                          </span>
                          <button
                            onClick={() => {
                              updateCartQty(item.productId, item.spec, (item.quantity || 1) + 1)
                              refresh()
                            }}
                            style={qtyBtn}
                            aria-label="加"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div
                  style={{
                    borderTop: '1px solid rgba(255,255,255,0.08)',
                    paddingTop: 12,
                    marginTop: 12,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ color: '#9ca3af', fontSize: 14 }}>合计</span>
                    <span style={{ color: '#a855f7', fontWeight: 700, fontSize: 20 }}>
                      ¥{total.toFixed(2)}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setOpen(false)
                      // ⭐ 19:29 奕霖：router.push 在 Portal/抽屉后偶发失效，改用 window.location.href 强制跳
                      if (typeof window !== 'undefined') window.location.href = '/cart'
                    }}
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      borderRadius: 12,
                      border: 'none',
                      background: 'linear-gradient(135deg, #f472b6, #a855f7)',
                      color: '#fff',
                      fontSize: 16,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    去结算 →
                  </button>
                </div>
              </>
            )}
          </div>

          <style jsx>{`
            @keyframes gb-fade {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes gb-slide {
              from { transform: translateY(40px); opacity: 0.4; }
              to { transform: translateY(0); opacity: 1; }
            }
          `}</style>
        </div>
      )}
    </>
  )
}

const qtyBtn: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 6,
  background: 'rgba(255,255,255,0.08)',
  color: '#fff',
  border: 'none',
  cursor: 'pointer',
  fontSize: 16,
  fontWeight: 600,
}
