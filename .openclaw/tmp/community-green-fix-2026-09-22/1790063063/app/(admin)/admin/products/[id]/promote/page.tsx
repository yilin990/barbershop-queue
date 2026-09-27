'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Camera, Sparkles, Check, Loader2, AlertCircle, RefreshCw, Download } from 'lucide-react'

type TemplateKey = 'hot_deal' | 'new_arrival' | 'b2g1' | 'authentic'

const TEMPLATES: Array<{ key: TemplateKey; label: string; emoji: string; color: string; desc: string }> = [
  { key: 'hot_deal', label: '限时特价', emoji: '🔥', color: '#dc2626', desc: '右上角"限时特价" + 左下角黄色价签' },
  { key: 'new_arrival', label: '新品上市', emoji: '🆕', color: '#16a34a', desc: '左上角绿色 NEW 徽章' },
  { key: 'b2g1', label: '买二送一', emoji: '🎁', color: '#dc2626', desc: '中央红色圆形"买2送1"徽章' },
  { key: 'authentic', label: '正品保障', emoji: '🛡️', color: '#1e40af', desc: '右下角盾牌"100% 正品" + 厂家名' },
]

function escapeXml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildSvg(template: TemplateKey, text: any): string {
  const safeText = {
    discountPrice: escapeXml(text?.discountPrice || '9.9'),
    originalPrice: escapeXml(text?.originalPrice || '19.9'),
    manufacturer: escapeXml(text?.manufacturer || '厂家直供'),
    tagline: escapeXml(text?.tagline || ''),
  }

  switch (template) {
    case 'hot_deal':
      return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
  <polygon points="824,0 1024,0 1024,200 824,120" fill="#dc2626" />
  <text x="950" y="60" font-family="-apple-system,PingFang SC,sans-serif" font-size="36" font-weight="bold" fill="white" text-anchor="middle">限时</text>
  <text x="950" y="110" font-family="-apple-system,PingFang SC,sans-serif" font-size="32" font-weight="bold" fill="#fef08a" text-anchor="middle">特价</text>
  <rect x="20" y="860" width="320" height="140" rx="14" fill="#fbbf24" stroke="#dc2626" stroke-width="3"/>
  <text x="40" y="925" font-family="-apple-system,PingFang SC,sans-serif" font-size="56" font-weight="bold" fill="#dc2626">¥${safeText.discountPrice}</text>
  <text x="40" y="975" font-family="-apple-system,PingFang SC,sans-serif" font-size="24" fill="#7f1d1d">原价 ¥${safeText.originalPrice}</text>
</svg>`
    case 'new_arrival':
      return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
  <circle cx="120" cy="120" r="84" fill="#16a34a" stroke="#fff" stroke-width="6"/>
  <text x="120" y="110" font-family="Arial,sans-serif" font-size="44" font-weight="bold" fill="white" text-anchor="middle">NEW</text>
  <text x="120" y="148" font-family="-apple-system,PingFang SC,sans-serif" font-size="18" font-weight="bold" fill="white" text-anchor="middle">新到货</text>
  ${safeText.tagline ? `<text x="512" y="990" font-family="-apple-system,PingFang SC,sans-serif" font-size="28" fill="#15803d" text-anchor="middle">${safeText.tagline}</text>` : ''}
</svg>`
    case 'b2g1':
      return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
  <circle cx="512" cy="420" r="200" fill="#dc2626" stroke="#fff" stroke-width="8"/>
  <text x="512" y="380" font-family="-apple-system,PingFang SC,sans-serif" font-size="90" font-weight="bold" fill="white" text-anchor="middle">买2</text>
  <line x1="380" y1="410" x2="644" y2="410" stroke="#fef08a" stroke-width="4"/>
  <text x="512" y="490" font-family="-apple-system,PingFang SC,sans-serif" font-size="90" font-weight="bold" fill="#fef08a" text-anchor="middle">送1</text>
  <rect x="824" y="60" width="140" height="64" rx="32" fill="#fbbf24" stroke="#dc2626" stroke-width="3"/>
  <text x="894" y="105" font-family="-apple-system,PingFang SC,sans-serif" font-size="32" font-weight="bold" fill="#dc2626" text-anchor="middle">限时</text>
</svg>`
    case 'authentic':
      return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
  <g transform="translate(800, 800)">
    <polygon points="0,0 200,0 200,140 100,220 0,140" fill="#1e40af" stroke="#fff" stroke-width="6"/>
    <text x="100" y="80" font-family="-apple-system,PingFang SC,sans-serif" font-size="36" font-weight="bold" fill="white" text-anchor="middle">100%</text>
    <text x="100" y="130" font-family="-apple-system,PingFang SC,sans-serif" font-size="40" font-weight="bold" fill="#fef08a" text-anchor="middle">正品</text>
  </g>
  <rect x="100" y="940" width="600" height="60" rx="8" fill="#1e40af" opacity="0.92"/>
  <text x="400" y="980" font-family="-apple-system,PingFang SC,sans-serif" font-size="28" font-weight="bold" fill="white" text-anchor="middle">${safeText.manufacturer}</text>
</svg>`
  }
}

export default function PromotePhotoPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const productId = params.id

  const [product, setProduct] = useState<{ id: string; name: string; image: string | null; manufacturer?: string; price?: number } | null>(null)
  const [template, setTemplate] = useState<TemplateKey>('hot_deal')
  const [discountPrice, setDiscountPrice] = useState('9.9')
  const [originalPrice, setOriginalPrice] = useState('19.9')
  const [manufacturer, setManufacturer] = useState('')
  const [tagline, setTagline] = useState('')

  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // 加载商品信息
  useEffect(() => {
    loadProduct()
  }, [productId])

  async function loadProduct() {
    try {
      const res = await fetch(`/api/admin/products/${productId}/upload-photo`)
      const data = await res.json()
      if (data.success) {
        setProduct(data.product)
        // 自动用商品原图
        if (data.product.image && data.product.image.includes('/uploads/products/')) {
          // OK
        }
        // 自动填充厂家
        if (data.product.manufacturer) {
          setManufacturer(data.product.manufacturer)
        }
        // 自动填充价格
        if (data.product.price) {
          setOriginalPrice(String(data.product.price))
          setDiscountPrice((Number(data.product.price) * 0.7).toFixed(2))
        }
      } else {
        setError(data.error || '加载失败')
      }
    } catch (e: any) {
      setError(e.message)
    }
  }

  const baseImage = product?.image && product.image.includes('/uploads/products/')
    ? product.image
    : null

  // 实时预览 SVG
  const previewSvg = useMemo(() => {
    return buildSvg(template, {
      discountPrice,
      originalPrice,
      manufacturer,
      tagline,
    })
  }, [template, discountPrice, originalPrice, manufacturer, tagline])

  // 导出
  async function handleExport() {
    if (!baseImage) {
      setError('请先在拍照页上传商品图')
      return
    }
    setExporting(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch(`/api/admin/products/${productId}/promote-photo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseImagePath: baseImage,
          template,
          customText: {
            discountPrice,
            originalPrice,
            manufacturer,
            tagline,
          },
        }),
      })
      const data = await res.json()
      if (data.success) {
        setSuccess(`✅ 宣传图已生成：${data.url}（${(data.size/1024).toFixed(1)} KB）`)
        await loadProduct()
      } else {
        setError(data.error || '生成失败')
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f0fdf4 0%, #f7fee7 100%)', padding: '20px 16px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        {/* Header */}
        <button
          onClick={() => router.back()}
          aria-label="返回"
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px',
            background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(184, 134, 11,0.3)',
            borderRadius: 10, cursor: 'pointer', fontSize: 14, color: '#374151',
            marginBottom: 16,
          }}
        >
          <ArrowLeft size={16} />
          返回
        </button>

        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0a0f0d', margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sparkles size={22} color="#fbbf24" />
          商品图宣传编辑
        </h1>
        <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 20px' }}>
          {product ? `${product.name} · 加个营销标签，转化率涨 30%` : '加载中...'}
        </p>

        {/* 实时预览区 */}
        <Card>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#374151' }}>
            实时预览
          </div>
          {baseImage ? (
            <div style={{
              position: 'relative',
              width: '100%',
              maxWidth: 480,
              margin: '0 auto',
              aspectRatio: '1/1',
              background: '#fafafa',
              borderRadius: 12,
              overflow: 'hidden',
              border: '1px solid rgba(184, 134, 11,0.2)',
            }}>
              <img
                src={baseImage}
                alt="base"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
              <div
                style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
                dangerouslySetInnerHTML={{ __html: previewSvg.replace(/^<\?xml.*?\?>/, '').replace(/<svg /, '<svg width="100%" height="100%" preserveAspectRatio="xMidYMid meet" ') }}
              />
            </div>
          ) : (
            <div style={{
              padding: 40, textAlign: 'center', color: '#9ca3af',
              border: '2px dashed rgba(184, 134, 11,0.3)', borderRadius: 12, fontSize: 13,
            }}>
              ⚠️ 该商品还没有原图<br />
              请先到 <a href={`/admin/products/${productId}/photo`} style={{ color: '#fbbf24', textDecoration: 'underline' }}>拍照页</a> 上传一张
            </div>
          )}
        </Card>

        {/* 模板选择 */}
        <Card>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#374151' }}>
            选模板
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {TEMPLATES.map((t) => (
              <button
                key={t.key}
                onClick={() => setTemplate(t.key)}
                style={{
                  padding: 14,
                  background: template === t.key ? `${t.color}15` : 'rgba(255,255,255,0.8)',
                  border: `2px solid ${template === t.key ? t.color : 'rgba(184, 134, 11,0.2)'}`,
                  borderRadius: 12,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ fontSize: 20, marginBottom: 4 }}>{t.emoji}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: template === t.key ? t.color : '#374151' }}>
                  {t.label}
                </div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                  {t.desc}
                </div>
              </button>
            ))}
          </div>
        </Card>

        {/* 文字编辑 */}
        <Card>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#374151' }}>
            编辑文字
          </div>

          {template === 'hot_deal' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field label="特价价格" prefix="¥" value={discountPrice} onChange={setDiscountPrice} placeholder="9.9" />
              <Field label="原价" prefix="¥" value={originalPrice} onChange={setOriginalPrice} placeholder="19.9" />
            </div>
          )}

          {template === 'new_arrival' && (
            <Field label="底部说明文字（可选）" value={tagline} onChange={setTagline} placeholder="比如：本周刚到货" />
          )}

          {template === 'b2g1' && (
            <div style={{ fontSize: 13, color: '#6b7280', padding: 12, background: 'rgba(184, 134, 11,0.06)', borderRadius: 8 }}>
              ✨ 这个模板不需要编辑文字，开箱即用
            </div>
          )}

          {template === 'authentic' && (
            <Field label="厂家名（可选）" value={manufacturer} onChange={setManufacturer} placeholder="贵州果蔬鲜生有限公司" />
          )}
        </Card>

        {/* 导出按钮 */}
        <button
          onClick={handleExport}
          disabled={exporting || !baseImage}
          style={{
            ...primaryBtn,
            width: '100%',
            padding: '14px 20px',
            fontSize: 15,
            marginBottom: 16,
            background: (exporting || !baseImage) ? '#9ca3af' : '#fbbf24',
          }}
        >
          {exporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
          {exporting ? '生成中...' : '导出宣传图（自动更新商品主图）'}
        </button>

        {/* 错误/成功提示 */}
        {error && (
          <div style={{
            padding: 14, background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12,
            color: '#b91c1c', display: 'flex', alignItems: 'flex-start', gap: 8,
            marginBottom: 12,
          }}>
            <AlertCircle size={16} />
            <span style={{ fontSize: 13 }}>{error}</span>
          </div>
        )}
        {success && (
          <div style={{
            padding: 14, background: 'rgba(184, 134, 11,0.15)',
            border: '1px solid rgba(184, 134, 11,0.4)', borderRadius: 12,
            color: '#15803d', display: 'flex', alignItems: 'flex-start', gap: 8,
            marginBottom: 12,
          }}>
            <Check size={16} />
            <span style={{ fontSize: 13 }}>{success}</span>
          </div>
        )}
      </div>
    </div>
  )
}

const Field = ({
  label, value, onChange, prefix, placeholder,
}: { label: string; value: string; onChange: (v: string) => void; prefix?: string; placeholder?: string }) => (
  <div>
    <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }}>
      {label}
    </label>
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      {prefix && (
        <span style={{
          position: 'absolute', left: 12, color: '#6b7280', fontSize: 14, fontWeight: 500,
          pointerEvents: 'none',
        }}>
          {prefix}
        </span>
      )}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', padding: '12px 12px',
          paddingLeft: prefix ? 28 : 12,
          borderRadius: 10,
          background: '#fff',
          border: '1px solid rgba(184, 134, 11,0.3)',
          fontSize: 14, color: '#0a0f0d', outline: 'none',
          fontFamily: 'inherit',
          boxSizing: 'border-box',
        }}
      />
    </div>
  </div>
)

const Card = ({ children }: { children: React.ReactNode }) => (
  <div style={{
    background: 'rgba(255,255,255,0.85)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(184, 134, 11,0.15)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
  }}>
    {children}
  </div>
)

const primaryBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  padding: '12px 20px', background: '#fbbf24', color: '#0a0f0d',
  border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600,
  cursor: 'pointer', transition: 'all 0.15s',
  WebkitTapHighlightColor: 'transparent',
  touchAction: 'manipulation',
}