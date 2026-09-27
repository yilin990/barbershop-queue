'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/AppLayout'
import { quickAddToCart, getCartCount } from '@/lib/cart'
import FreshnessTimeline from '@/components/FreshnessTimeline'
import MerchantFloatingButton from '@/components/merchant/MerchantFloatingButton'

const GREEN = '#fbbf24'
const GREEN_RGB = '127, 220, 148'
const CARD_BG = 'linear-gradient(180deg, rgba(35, 74, 53, 0.5) 0%, rgba(26, 58, 42, 0.7) 100%)'

const QM_LABELS: Record<string, { label: string; color: string }> = {
  'OTC': { label: 'OTC', color: 'rgba(127, 220, 148, 0.95)' },
  '保健食品': { label: '保健食品', color: 'rgba(255, 213, 79, 0.95)' },
  '医疗器械': { label: '医疗器械', color: 'rgba(127, 200, 255, 0.95)' },
  '消毒用品': { label: '消毒用品', color: 'rgba(189, 178, 255, 0.95)' },
  '中药饮片': { label: '中药饮片', color: 'rgba(255, 184, 108, 0.95)' },
  '中药成药': { label: '中成药', color: 'rgba(255, 184, 108, 0.95)' },
  '化妆用品': { label: '化妆用品', color: 'rgba(255, 154, 200, 0.95)' },
  '日用品': { label: '日用品', color: 'rgba(180, 180, 180, 0.95)' },
  '食品': { label: '食品', color: 'rgba(255, 213, 79, 0.7)' },
  '计生用品': { label: '计生用品', color: 'rgba(255, 154, 200, 0.7)' },
  '生物制品': { label: '生物制品', color: 'rgba(127, 220, 148, 0.7)' },
  // ⭐ MEMORY 183 — 处方药整条移出线上体系：'处方药' / 'Rx' / '处方' 都不显示
  '处方药': { label: '', color: 'rgba(127, 220, 148, 0.95)' },
  'Rx': { label: '', color: 'rgba(127, 220, 148, 0.95)' },
  '处方': { label: '', color: 'rgba(127, 220, 148, 0.95)' },
}

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [product, setProduct] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [chatLoading, setChatLoading] = useState(false)

  useEffect(() => {
    fetch(`/api/products/${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setProduct(data.product)
        else setError(data.error || '加载失败')
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <AppLayout title="商品详情" activePath="/products">
        <div style={{ padding: '60px', textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>
          <div style={{ fontSize: '40px' }}>⏳</div>
          <div style={{ marginTop: '12px', fontSize: '13px' }}>加载中...</div>
        </div>
      </AppLayout>
    )
  }

  if (error || !product) {
    return (
      <AppLayout title="商品不存在" activePath="/products">
        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
          <div style={{ fontSize: '48px' }}>😢</div>
          <div style={{ marginTop: '12px', fontSize: '14px' }}>{error || '没找到这个商品'}</div>
          <button
            onClick={() => router.back()}
            style={{
              marginTop: '20px',
              padding: '8px 20px',
              borderRadius: '12px',
              background: `rgba(${GREEN_RGB}, 0.15)`,
              border: `1px solid rgba(${GREEN_RGB}, 0.3)`,
              color: GREEN,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            返回
          </button>
        </div>
      </AppLayout>
    )
  }

  const qm = QM_LABELS[product.qualityClass] || { label: product.qualityClass || '其他', color: 'rgba(255,255,255,0.5)' }
  const outOfStock = product.stock === 0
  const tags = product.functionTags ? product.functionTags.split(/[/\s,，]+/).filter(Boolean) : []
  const memberPrice = product.memberPrice || product.price
  const points = product.points || 0
  const discount = memberPrice < product.price ? Math.round((1 - memberPrice / product.price) * 100) : 0

  // 跳到 果小蔬（带商品上下文）
  const askZhixiaoyao = async () => {
    setChatLoading(true)
    try {
      // 把商品存到 localStorage，果小蔬启动时读
      const ctx = {
        type: 'product_consult',
        productId: product.id,
        productName: product.name,
        productSpec: product.spec,
        timestamp: Date.now(),
      }
      localStorage.setItem('zhixiaoyao_pending_context', JSON.stringify(ctx))
      router.push('/pharmacist?from=product&pid=' + product.id)
    } finally {
      setChatLoading(false)
    }
  }

  return (
    <AppLayout
      title={product.shortName || product.name}
      activePath="/products"
    >
      <div style={{ paddingBottom: '120px' }}>
        {/* 大图区 */}
        <div
          style={{
            margin: '12px 16px',
            background: `linear-gradient(135deg, rgba(${GREEN_RGB}, 0.12), rgba(${GREEN_RGB}, 0.04))`,
            borderRadius: '20px',
            aspectRatio: '1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            border: `1px solid rgba(${GREEN_RGB}, 0.1)`,
            overflow: 'hidden',
          }}
        >
          <img
            src={`/api/product-image/${product.id}`}
            alt={product.name}
            style={{
              width: '70%',
              height: '70%',
              objectFit: 'contain',
            }}
          />
          {outOfStock && (
            <div
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                padding: '6px 14px',
                background: 'rgba(255, 100, 100, 0.95)',
                color: '#fff',
                fontSize: '12px',
                fontWeight: 700,
                borderRadius: '8px',
              }}
            >
              暂时缺货
            </div>
          )}
          {discount > 0 && (
            <div
              style={{
                position: 'absolute',
                top: '16px',
                left: '16px',
                padding: '6px 14px',
                background: `linear-gradient(135deg, #ff6b6b, #ff4d4d)`,
                color: '#fff',
                fontSize: '12px',
                fontWeight: 700,
                borderRadius: '8px',
              }}
            >
              会员立省 {discount}%
            </div>
          )}
        </div>

        {/* 主要信息 */}
        <div
          style={{
            margin: '0 16px',
            padding: '16px',
            background: CARD_BG,
            borderRadius: '16px',
            border: `1px solid rgba(${GREEN_RGB}, 0.08)`,
          }}
        >
          {/* 标签 */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
            <span
              style={{
                padding: '3px 10px',
                borderRadius: '6px',
                background: qm.color,
                color: '#0a0f0d',
                fontSize: '11px',
                fontWeight: 700,
              }}
            >
              {qm.label}
            </span>
            {tags.map((t: string, i: number) => (
              <span
                key={i}
                style={{
                  padding: '3px 10px',
                  borderRadius: '6px',
                  background: `rgba(${GREEN_RGB}, 0.12)`,
                  color: GREEN,
                  fontSize: '11px',
                  fontWeight: 500,
                  border: `1px solid rgba(${GREEN_RGB}, 0.2)`,
                }}
              >
                #{t}
              </span>
            ))}
          </div>
          
          {/* 商品名 */}
          <div
            style={{
              fontSize: '17px',
              fontWeight: 600,
              color: '#fff',
              lineHeight: 1.4,
              marginBottom: '8px',
            }}
          >
            {product.name}
          </div>
          
          {/* 规格 */}
          {product.spec && (
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.55)', marginBottom: '14px' }}>
              规格：{product.spec}
            </div>
          )}
          
          {/* 价格区 */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '4px' }}>
            {memberPrice > 0 && memberPrice < product.price ? (
              <span style={{ fontSize: '28px', fontWeight: 700, color: GREEN }}>
                ¥{memberPrice.toFixed(2)}
              </span>
            ) : (
              <span style={{ fontSize: '28px', fontWeight: 700, color: GREEN }}>
                ¥{product.price?.toFixed(2) || '0.00'}
              </span>
            )}
            {memberPrice > 0 && memberPrice < product.price && (
              <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', textDecoration: 'line-through' }}>
                原价 ¥{product.price.toFixed(2)}
              </span>
            )}
          </div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
            {points > 0 ? `购买可获 ${points} 积分` : '购买无积分'}
          </div>
        </div>

        {/* 详细信息 */}
        <div
          style={{
            margin: '12px 16px',
            padding: '16px',
            background: CARD_BG,
            borderRadius: '16px',
            border: `1px solid rgba(${GREEN_RGB}, 0.08)`,
          }}
        >
          <div style={{ fontSize: '14px', fontWeight: 600, color: GREEN, marginBottom: '12px' }}>
            📋 商品信息
          </div>
          

          {product.manufacturer && <InfoRow label="生产企业" value={product.manufacturer} />}
          {product.barcode && <InfoRow label="条形码" value={product.barcode} mono />}
          {product.medicalCode && <InfoRow label="医保编码" value={product.medicalCode} mono />}
          {product.productCode && <InfoRow label="商品编号" value={product.productCode} mono />}
          {product.dosage && <InfoRow label="剂型" value={product.dosage} />}
          {product.unit && <InfoRow label="单位" value={product.unit} />}
          {product.productType && <InfoRow label="类型" value={product.productType} />}
          
          <InfoRow
            label="库存"
            value={outOfStock ? '❌ 暂时缺货' : `✓ ${product.stock} ${product.unit || '件'}`}
            highlight={outOfStock ? 'red' : 'green'}
          />
          
          {product.sales30d > 0 && (
            <>
              <InfoRow label="30天销量" value={`${product.sales30d} 件`} />
              <InfoRow label="历史销量" value={`近90天 ${(product.sales30_60d || 0) + (product.sales60_90d || 0) + product.sales30d} 件`} />
            </>
          )}
        </div>

        {/* 商户信息 */}
        <div
          style={{
            margin: '0 16px',
            padding: '16px',
            background: CARD_BG,
            borderRadius: '16px',
            border: `1px solid rgba(${GREEN_RGB}, 0.08)`,
          }}
        >
          <div style={{ fontSize: '14px', fontWeight: 600, color: GREEN, marginBottom: '12px' }}>
            🏪 售卖门店
          </div>
          <div style={{ fontSize: '14px', color: '#fff', marginBottom: '4px' }}>{product.merchantName}</div>
          {product.merchantPhone && (
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>📞 {product.merchantPhone}</div>
          )}
        </div>

        {/* ⭐ 2026-08-28 奕霖：每日图时间线(早/中/晚 × 今天/昨天/前天) */}
        <div style={{ margin: '12px 16px' }}>
          <FreshnessTimeline productId={product.id} />
        </div>

        {/* 温馨提示 */}
        <div
          style={{
            margin: '12px 16px',
            padding: '12px 14px',
            background: 'rgba(255, 213, 79, 0.08)',
            border: '1px solid rgba(255, 213, 79, 0.2)',
            borderRadius: '12px',
            fontSize: '11.5px',
            color: 'rgba(255, 213, 79, 0.85)',
            lineHeight: 1.6,
          }}
        >
          ⚠️ <strong>温馨提示</strong>：商品以实物为准，部分时令果蔬根据季节调整；如有品质问题，门店支持现场退换。
        </div>
      </div>

      {/* 底部固定操作栏 */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '12px 16px',
          paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
          background: 'linear-gradient(180deg, rgba(13, 31, 23, 0.7) 0%, rgba(13, 31, 23, 0.98) 100%)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderTop: `1px solid rgba(${GREEN_RGB}, 0.15)`,
          zIndex: 100,
          display: 'flex',
          gap: '10px',
        }}
      >
        <button
          onClick={askZhixiaoyao}
          disabled={chatLoading}
          style={{
            flex: 1,
            padding: '14px',
            borderRadius: '14px',
            border: `1px solid rgba(${GREEN_RGB}, 0.3)`,
            background: 'transparent',
            color: GREEN,
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          🍵 问果小蔬
        </button>
        <button
          onClick={() => router.push('/pharmacist?action=order&pid=' + product.id)}
          disabled={outOfStock}
          style={{
            flex: 1.5,
            padding: '14px',
            borderRadius: '14px',
            border: 'none',
            background: outOfStock
              ? 'rgba(255,255,255,0.1)'
              : `linear-gradient(135deg, #fbbf24, #4ade80)`,
            color: outOfStock ? 'rgba(255,255,255,0.4)' : '#0a0f0d',
            fontSize: '14px',
            fontWeight: 700,
            cursor: outOfStock ? 'not-allowed' : 'pointer',
          }}
        >
          {outOfStock ? '缺货中' : '🛒 下单'}
        </button>
      </div>

      {/* ⭐ MEMORY §247 — 2026-08-29 奕霖:继续沿用 🥑 这个按键,做后台管理快捷入口 */}
      <MerchantFloatingButton productId={product.id} merchantId={product.merchantId || 'm_grocery_001'} />
    </AppLayout>
  )
}

function InfoRow({ label, value, mono, highlight }: { label: string; value: string; mono?: boolean; highlight?: 'green' | 'red' }) {
  const color = highlight === 'green' ? GREEN : highlight === 'red' ? 'rgba(255,150,150,0.9)' : 'rgba(255,255,255,0.85)'
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        padding: '8px 0',
        borderBottom: '1px dashed rgba(255,255,255,0.06)',
        fontSize: '12.5px',
      }}
    >
      <span style={{ color: 'rgba(255,255,255,0.5)', flexShrink: 0 }}>{label}</span>
      <span
        style={{
          color,
          fontFamily: mono ? 'monospace' : 'inherit',
          textAlign: 'right',
          wordBreak: 'break-all',
          maxWidth: '65%',
        }}
      >
        {value || '—'}
      </span>
    </div>
  )
}
