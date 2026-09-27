'use client'

// ⭐ 奕霖 2026-08-25 14:30 反馈：商品卡片点一下能看见商品信息的小弹窗
// 复用 /products/[id] 字段但只显示关键信息（不显示门店卡片/地图/快捷入口等冗余）
// modal 底部 2 个按钮：🛒 加入购物车 / 📦 提交订单（弹窗内不跳页，加购后 toast 提示）

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { formatWeight, formatStock } from '@/lib/format'
// ⭐ 2026-08-25 22:07 奕霖：🔍 弹窗里要展示每日图(3天早中晚)
import FreshnessTimeline from '@/components/FreshnessTimeline'
import { quickAddToCart, getCartCount } from '@/lib/cart'
import { toast } from '@/lib/ui-bus'

const GREEN = '#fbbf24'
const GREEN_RGB = '184, 134, 11'
const CARD_BG = 'linear-gradient(180deg, rgba(35, 74, 53, 0.5) 0%, rgba(26, 58, 42, 0.7) 100%)'

interface Props {
  productId: string | null
  onClose: () => void
  /** 加购成功的回调（用于触发 FloatingCart 角标刷新）*/
  onAdded?: () => void
}

interface Product {
  id: string
  name: string
  shortName?: string
  spec?: string
  price: number
  memberPrice?: number
  points?: number
  category?: string
  categoryLabel?: string
  qualityClass?: string
  stock: number
  unit?: string
  weightGram?: number
  sales30d?: number
  sales30_60d?: number
  sales60_90d?: number
  manufacturer?: string
  barcode?: string
  productCode?: string
  productType?: string
  image?: string
  imageEmoji?: string
  functionTags?: string[]
  description?: string
}

export default function ProductQuickView({ productId, onClose, onAdded }: Props) {
  const router = useRouter()
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [addedJustNow, setAddedJustNow] = useState(false)
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    if (!productId) {
      setProduct(null)
      setError('')
      return
    }
    let cancelled = false
    setLoading(true)
    setError('')
    fetch(`/api/products/${encodeURIComponent(productId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        if (data.success) setProduct(data.product)
        else setError(data.error || '加载失败')
      })
      .catch((e) => {
        if (!cancelled) setError(e.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [productId])

  useEffect(() => {
    if (!productId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    // 锁定背景滚动
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [productId, onClose])

  if (!productId) return null

  const handleAdd = async () => {
    if (!product || adding) return
    setAdding(true)
    try {
      // ⭐ MEMORY §271 (2026-08-25 20:50) 奕霖反馈：购物车加购成功但抽屉里没显示商品和价格
      // 真凶：quickAddToCart 之前被传错了参数 (product.id, 1)，库函数需要完整的 product 对象
      // 修法：传整个 product 对象，让 quickAddToCart 内部读取 name/price/spec/image/icon
      quickAddToCart(product)
      setAddedJustNow(true)
      onAdded?.()
      // ⭐ 19:16 奕霖：StorageEvent 同窗口不触发，改用 CustomEvent
      window.dispatchEvent(new CustomEvent('cart-updated'))
      toast.success(`已加入购物车 🛒 ${product.name}`)
      setTimeout(() => setAddedJustNow(false), 1500)
    } catch (e) {
      console.error('[ProductQuickView] 加购失败', e)
      toast.error('加购失败，请重试')
    } finally {
      setAdding(false)
    }
  }

  const handleBuyNow = async () => {
    if (!product || adding) return
    setAdding(true)
    try {
      // ⭐ MEMORY §271 同上修复
      quickAddToCart(product)
      window.dispatchEvent(new CustomEvent('cart-updated'))
      toast.success('正在结算 → →')
      // ⭐ 19:29 奕霖：router.push 在 Portal 后失效，改用 window.location.href 强制跳转
      setTimeout(() => {
        onClose()
        if (typeof window !== 'undefined') {
          window.location.href = '/cart'
        }
      }, 200)
    } catch (e) {
      console.error('[ProductQuickView] 提交订单失败', e)
      toast.error('结算失败，请重试')
    } finally {
      setAdding(false)
    }
  }

  const memberPrice = product?.memberPrice ?? product?.price ?? 0
  const outOfStock = product ? product.stock <= 0 : false

  if (!productId) return null
  if (typeof document === 'undefined') return null  // ⭐ 18:57 SSR-safe：服务端不渲染 Portal

  // ⭐ 18:57 奕霖：createPortal 到 document.body，跳出 ChatWindow wrapper 的 position:relative 容器
  // 否则 position:fixed 会相对那个 wrapper 定位，不是 viewport，弹窗被顶到底部
  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',  // ⭐ 18:51 奕霖：屏幕中间对齐（不要靠上，符合居中偏好）
        justifyContent: 'center',
        padding: '12px',
        paddingTop: 'calc(64px + env(safe-area-inset-top, 0px))',  // ⭐ 18:57 奕霖：避开底部 TabBar/聊天输入框（占 ~64px）
        paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))',  // 避开 iPhone 小白条
        animation: 'fadeIn 0.2s ease',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 340,
          maxHeight: '70vh',
          background: 'linear-gradient(180deg, #0f1a14 0%, #0a120e 100%)',  // ⭐ 高级感：渐变深绿黑
          borderRadius: 20,  // ⭐ 17:49 奕霖：圆角全统一 20px
          border: `1px solid rgba(${GREEN_RGB}, 0.18)`,
          boxShadow: `0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(${GREEN_RGB}, 0.06), inset 0 1px 0 rgba(255,255,255,0.04)`,  // ⭐ 多层投影高级
          display: 'flex',
          flexDirection: 'column',
          animation: 'popIn 0.32s cubic-bezier(0.34, 1.56, 0.64, 1)',  // ⭐ 从 slideUpFromBottom 改 popIn
          overflow: 'hidden',
        }}
      >
        {/* ⭐ 22:02 奕霖：加明显的左上角"← 返回"键(虽然点弹窗外能退,但要明确返回)*/}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            left: 10,
            top: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 10px',
            borderRadius: '14px',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.7)',
            fontSize: 12,
            cursor: 'pointer',
            zIndex: 10,
          }}
          aria-label="返回"
        >
          ← 返回
        </button>
        {/* ⭐ 17:49 奕霖：去掉拖动条，关闭按钮统一右上角绝对定位 */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            right: 10,
            top: 10,
            width: 30,
            height: 30,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.7)',
            fontSize: 14,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
          }}
          aria-label="关闭"
        >
          ✕
        </button>
        {/* 内容区（可滚动）- ⭐ 17:49 紧凑 padding */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '36px 18px 18px' }}>
          {loading ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>
              <div style={{ fontSize: 36 }}>⏳</div>
              <div style={{ marginTop: 10, fontSize: 12 }}>加载中…</div>
            </div>
          ) : error || !product ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
              <div style={{ fontSize: 40 }}>😢</div>
              <div style={{ marginTop: 10, fontSize: 13 }}>{error || '没找到这个商品'}</div>
            </div>
          ) : (
            <>
              {/* 商品图 */}
              <div
                style={{
                  width: '100%',
                  aspectRatio: '1 / 1',
                  background: CARD_BG,
                  borderRadius: 14,
                  border: `1px solid rgba(${GREEN_RGB}, 0.1)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  marginBottom: 14,
                }}
              >
                <img
                  src={`/api/product-image/${product.id}`}
                  alt={product.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none'
                    const parent = (e.currentTarget as HTMLImageElement).parentElement
                    if (parent && !parent.querySelector('.emoji-fallback')) {
                      const fallback = document.createElement('div')
                      fallback.className = 'emoji-fallback'
                      fallback.style.fontSize = '64px'
                      fallback.textContent = product.imageEmoji || product.categoryLabel || '🍎'
                      parent.appendChild(fallback)
                    }
                  }}
                />
              </div>

              {/* 标签 + 商品名 */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                  {product.qualityClass && product.qualityClass !== 'OTC' && (
                    <span
                      style={{
                        padding: '3px 9px',
                        borderRadius: 6,
                        background: `rgba(${GREEN_RGB}, 0.18)`,
                        color: GREEN,
                        fontSize: 10,
                        fontWeight: 600,
                        border: `1px solid rgba(${GREEN_RGB}, 0.25)`,
                      }}
                    >
                      {product.qualityClass}
                    </span>
                  )}
                  {product.categoryLabel && (
                    <span
                      style={{
                        padding: '3px 9px',
                        borderRadius: 6,
                        background: 'rgba(255,255,255,0.06)',
                        color: 'rgba(255,255,255,0.65)',
                        fontSize: 10,
                        fontWeight: 500,
                      }}
                    >
                      {product.categoryLabel}
                    </span>
                  )}
                  {product.productCode && (
                    <span
                      style={{
                        padding: '3px 9px',
                        borderRadius: 6,
                        background: 'transparent',
                        color: 'rgba(255,255,255,0.4)',
                        fontSize: 10,
                        fontFamily: 'monospace',
                      }}
                    >
                      #{product.productCode}
                    </span>
                  )}
                </div>

                <div style={{ fontSize: 16, fontWeight: 600, color: '#fff', lineHeight: 1.4, marginBottom: 6 }}>
                  {product.name}
                </div>

                {product.spec && (
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>规格：{product.spec}</div>
                )}
              </div>

              {/* 价格区 */}
              <div
                style={{
                  background: CARD_BG,
                  borderRadius: 14,
                  border: `1px solid rgba(${GREEN_RGB}, 0.08)`,
                  padding: 14,
                  marginBottom: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
                  <span style={{ fontSize: 26, fontWeight: 700, color: GREEN }}>
                    ¥{(memberPrice < product.price ? memberPrice : product.price)?.toFixed(2)}/
                    {formatWeight(product.weightGram)}
                  </span>
                  {memberPrice < product.price && (
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', textDecoration: 'line-through' }}>
                      零售 ¥{product.price?.toFixed(2)}/{formatWeight(product.weightGram)}
                    </span>
                  )}
                </div>
                {product.points ? (
                  <div style={{ fontSize: 11, color: `rgba(${GREEN_RGB}, 0.7)` }}>购买可获 {product.points} 积分</div>
                ) : (
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>购买无积分</div>
                )}
              </div>

              {/* 商品信息 */}
              <div
                style={{
                  background: CARD_BG,
                  borderRadius: 14,
                  border: `1px solid rgba(${GREEN_RGB}, 0.08)`,
                  padding: 14,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: GREEN, marginBottom: 10 }}>📋 商品信息</div>

                <InfoRow label="参考重量" value={`${product.unit || '件'} · ${formatWeight(product.weightGram)}`} />
                <InfoRow
                  label="库存"
                  value={
                    outOfStock
                      ? '❌ 暂时缺货'
                      : `✓ ${product.stock}${product.unit ? ' ' + product.unit : ''} · ${formatStock(product.stock)}`
                  }
                  highlight={outOfStock ? 'red' : 'green'}
                />
                {product.sales30d && product.sales30d > 0 ? (
                  <InfoRow label="30天销量" value={`${product.sales30d} 件`} />
                ) : null}
                {product.sales30d && product.sales30d > 0 ? (
                  <InfoRow
                    label="累计销量"
                    value={`近90天 ${(product.sales30_60d || 0) + (product.sales60_90d || 0) + product.sales30d} 件`}
                  />
                ) : null}
                {product.manufacturer ? <InfoRow label="生产企业" value={product.manufacturer} /> : null}
                {product.productCode ? <InfoRow label="商品编号" value={product.productCode} mono /> : null}
                {product.barcode ? <InfoRow label="条形码" value={product.barcode} mono /> : null}
              </div>

              {/* ⭐ 2026-08-25 22:07 奕霖：🔍 弹窗里要展示每日图(3天早中晚) */}
              <div style={{ marginTop: 14 }}>
                <FreshnessTimeline productId={product.id} />
              </div>
            </>
          )}
        </div>

        {/* 底部 2 个按钮 */}
        {product && !loading && (
          <div
            style={{
              display: 'flex',
              gap: 8,
              padding: '12px 16px',
              borderTop: `1px solid rgba(${GREEN_RGB}, 0.1)`,
              background: 'rgba(0,0,0,0.4)',
            }}
          >
            <button
              onClick={handleAdd}
              disabled={outOfStock || adding}
              style={{
                flex: 1,
                padding: '13px 12px',
                borderRadius: 12,
                background: outOfStock ? 'rgba(255,255,255,0.04)' : `rgba(${GREEN_RGB}, 0.12)`,
                border: `1px solid rgba(${GREEN_RGB}, ${outOfStock ? 0.05 : 0.3})`,
                color: outOfStock ? 'rgba(255,255,255,0.3)' : GREEN,
                fontSize: 14,
                fontWeight: 600,
                cursor: outOfStock ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                transition: 'all 0.15s',
              }}
            >
              {addedJustNow ? '✓ 已加入' : '🛒 加入购物车'}
            </button>
            <button
              onClick={handleBuyNow}
              disabled={outOfStock || adding}
              style={{
                flex: 1,
                padding: '13px 12px',
                borderRadius: 12,
                background: outOfStock
                  ? 'rgba(255,255,255,0.04)'
                  : `linear-gradient(135deg, rgba(${GREEN_RGB}, 0.95) 0%, rgba(74, 157, 101, 0.95) 100%)`,
                border: 'none',
                color: outOfStock ? 'rgba(255,255,255,0.3)' : '#0a0f0d',
                fontSize: 14,
                fontWeight: 700,
                cursor: outOfStock ? 'not-allowed' : 'pointer',
                boxShadow: outOfStock ? 'none' : `0 4px 14px rgba(${GREEN_RGB}, 0.3)`,
              }}
            >
              提交订单
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes popIn { from { transform: scale(0.92); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      `}</style>
    </div>,
    document.body  // ⭐ 18:57 奕霖：Portal 到 body，fixed 相对 viewport 不再被 ChatWindow wrapper 困住
  )
}

function InfoRow({ label, value, mono, highlight }: { label: string; value: string; mono?: boolean; highlight?: 'green' | 'red' }) {
  const valueColor =
    highlight === 'red' ? '#ff6b6b' : highlight === 'green' ? GREEN : 'rgba(255,255,255,0.85)'
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '5px 0',
        fontSize: 12,
        borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}
    >
      <span style={{ color: 'rgba(255,255,255,0.5)' }}>{label}</span>
      <span
        style={{
          color: valueColor,
          fontFamily: mono ? 'monospace' : 'inherit',
          fontSize: mono ? 11 : 12,
        }}
      >
        {value}
      </span>
    </div>
  )
}
