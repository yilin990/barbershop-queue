'use client'

/**
 * ProductsSection · 产品展示 + 介绍
 * 段 230 落地 · 2026-09-30 18:39
 *
 * 功能：客户可以看造型产品（精油/发蜡/喷雾）→ 了解产品 → 到店购买
 * 设计：3 列网格 + 详情展开
 */

import { useState } from 'react'

interface Product {
  id: string
  name: string
  emoji: string
  category: 'styling' | 'care' | 'color'
  price: string
  short_desc: string
  long_desc: string
  usage: string
  suitable_for: string[]
  badge?: string
}

const PRODUCTS: Product[] = [
  {
    id: 'p1',
    name: '哑光造型发蜡',
    emoji: '🎨',
    category: 'styling',
    price: '¥128',
    short_desc: '男生短发哑光定型',
    long_desc: '专业级哑光定型发蜡，强力定型 8 小时，不油腻不结块，自然哑光质感。',
    usage: '取黄豆大小，在掌心搓匀后抓出造型',
    suitable_for: ['短发', '中发', '纹理造型'],
    badge: '热销',
  },
  {
    id: 'p2',
    name: '保湿造型喷雾',
    emoji: '💦',
    category: 'styling',
    price: '¥88',
    short_desc: '女生卷发保湿定型',
    long_desc: '清爽保湿 + 持久定型，含有摩洛哥坚果油，保湿不毛躁。',
    usage: '距离头发 20cm 喷 2-3 下，自然风干或吹风',
    suitable_for: ['长发', '卷发', '染发'],
  },
  {
    id: 'p3',
    name: '氨基酸洗发水',
    emoji: '🧴',
    category: 'care',
    price: '¥98',
    short_desc: '敏感头皮温和清洁',
    long_desc: '弱酸性氨基酸配方，pH 5.5，温和不刺激，适合敏感头皮和染烫后修护。',
    usage: '湿发后取适量按摩头皮，停留 2 分钟',
    suitable_for: ['敏感头皮', '染烫后', '每日'],
    badge: '推荐',
  },
  {
    id: 'p4',
    name: '发膜深层滋养',
    emoji: '🧖',
    category: 'care',
    price: '¥158',
    short_desc: '沙龙级周护发膜',
    long_desc: '含有摩洛哥坚果油 + 角蛋白，深层滋养修复，每周 1-2 次，让头发恢复柔顺亮泽。',
    usage: '洗发后涂发尾，戴浴帽 10-15 分钟',
    suitable_for: ['干枯', '受损', '染烫'],
  },
  {
    id: 'p5',
    name: '染后锁色精华',
    emoji: '💎',
    category: 'color',
    price: '¥168',
    short_desc: '染发后锁色防褪',
    long_desc: '专门为染后头发设计，锁色因子 + 抗氧化，延缓褪色 4 周以上。',
    usage: '洗发后半干时涂抹，无需冲洗',
    suitable_for: ['染发人群', '亮色染'],
  },
  {
    id: 'p6',
    name: '头皮舒缓精华',
    emoji: '🌿',
    category: 'care',
    price: '¥138',
    short_desc: '止痒控油',
    long_desc: '含有茶树 + 薄荷精华，舒缓头皮瘙痒，调节油脂分泌，头皮清爽一整天。',
    usage: '洗头前滴 3-5 滴在头皮上按摩 5 分钟',
    suitable_for: ['油性头皮', '头屑', '瘙痒'],
  },
]

const CATEGORY_LABELS: Record<string, { label: string; emoji: string }> = {
  styling: { label: '造型', emoji: '🎨' },
  care: { label: '护理', emoji: '💆' },
  color: { label: '染护', emoji: '💎' },
}

const FALLBACK_GRADIENTS: Record<string, string> = {
  p1: 'linear-gradient(135deg, #b8860b 0%, #5a3a25 100%)',
  p2: 'linear-gradient(135deg, #4a2f1f 0%, #8b6508 100%)',
  p3: 'linear-gradient(135deg, #2c1810 0%, #5a3a25 100%)',
  p4: 'linear-gradient(135deg, #8b6508 0%, #2c1810 100%)',
  p5: 'linear-gradient(135deg, #b8860b 0%, #4a2f1f 100%)',
  p6: 'linear-gradient(135deg, #5a3a25 0%, #b8860b 100%)',
}

export default function ProductsSection() {
  return (
    <div style={{
      background: 'rgba(44, 24, 16, 0.3)',
      borderRadius: '16px',
      padding: '18px 16px',
      marginBottom: '16px',
      border: '1px solid rgba(184, 134, 11, 0.1)',
    }}>
      <h2 style={{
        fontSize: 14, fontWeight: 700, color: '#fff',
        marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span>📦</span> 产品展示
        <span style={{
          fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.4)',
          marginLeft: 'auto',
        }}>到店可购买</span>
      </h2>
      <p style={{
        fontSize: 11, color: 'rgba(255,255,255,0.5)',
        marginBottom: 14, lineHeight: 1.5,
      }}>造型师同款 · 自己在家也能用</p>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '8px',
      }}>
        {PRODUCTS.map(p => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </div>
  )
}

function ProductCard({ product }: { product: Product }) {
  const [showDetail, setShowDetail] = useState(false)
  const cat = CATEGORY_LABELS[product.category]

  return (
    <>
      <button
        onClick={() => setShowDetail(true)}
        style={{
          background: 'rgba(184, 134, 11, 0.05)',
          border: '1px solid rgba(184, 134, 11, 0.15)',
          borderRadius: 12,
          padding: 0,
          cursor: 'pointer',
          overflow: 'hidden',
          fontFamily: 'inherit',
          textAlign: 'left',
          position: 'relative',
        }}
      >
        {/* 占位图 */}
        <div style={{
          aspectRatio: '1 / 1',
          background: FALLBACK_GRADIENTS[product.id],
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}>
          <span style={{ fontSize: 36 }}>{product.emoji}</span>
          {product.badge && (
            <span style={{
              position: 'absolute',
              top: 6,
              right: 6,
              background: product.badge === '热销'
                ? 'linear-gradient(135deg, #ff6b6b, #ff4757)'
                : 'linear-gradient(135deg, #b8860b, #8b6508)',
              color: '#fff',
              padding: '2px 6px',
              borderRadius: 6,
              fontSize: 9,
              fontWeight: 700,
            }}>
              {product.badge}
            </span>
          )}
        </div>
        {/* 信息 */}
        <div style={{ padding: '8px 10px' }}>
          <div style={{
            fontSize: 11,
            fontWeight: 700,
            color: '#fff',
            marginBottom: 2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {product.name}
          </div>
          <div style={{
            fontSize: 9,
            color: 'rgba(184, 134, 11, 0.85)',
            marginBottom: 3,
          }}>
            {cat.emoji} {cat.label}
          </div>
          <div style={{
            fontSize: 12,
            fontWeight: 700,
            color: '#b8860b',
          }}>
            {product.price}
          </div>
        </div>
      </button>

      {/* 详情 modal */}
      {showDetail && (
        <div
          onClick={() => setShowDetail(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'linear-gradient(135deg, #2c1810, #3a2416)',
              borderRadius: 16,
              padding: 20,
              maxWidth: 360,
              width: '100%',
              border: '1px solid rgba(184, 134, 11, 0.4)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginBottom: 14,
            }}>
              <div style={{
                width: 60,
                height: 60,
                background: FALLBACK_GRADIENTS[product.id],
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 36,
                flexShrink: 0,
              }}>
                {product.emoji}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: '#fff',
                  marginBottom: 4,
                }}>
                  {product.name}
                </div>
                <div style={{
                  fontSize: 12,
                  color: 'rgba(184, 134, 11, 0.85)',
                }}>
                  {cat.emoji} {cat.label} · {product.price}
                </div>
              </div>
            </div>

            <p style={{
              fontSize: 13,
              color: 'rgba(255,255,255,0.85)',
              lineHeight: 1.6,
              marginBottom: 14,
            }}>
              {product.long_desc}
            </p>

            <div style={{
              background: 'rgba(184, 134, 11, 0.1)',
              borderRadius: 8,
              padding: '10px 12px',
              marginBottom: 10,
            }}>
              <div style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#b8860b',
                marginBottom: 4,
              }}>
                📝 使用方法
              </div>
              <div style={{
                fontSize: 12,
                color: 'rgba(255,255,255,0.8)',
                lineHeight: 1.5,
              }}>
                {product.usage}
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#b8860b',
                marginBottom: 6,
              }}>
                ✅ 适合
              </div>
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 4,
              }}>
                {product.suitable_for.map(s => (
                  <span key={s} style={{
                    background: 'rgba(184, 134, 11, 0.15)',
                    color: '#fff',
                    padding: '3px 8px',
                    borderRadius: 10,
                    fontSize: 11,
                  }}>
                    {s}
                  </span>
                ))}
              </div>
            </div>

            <button
              onClick={() => setShowDetail(false)}
              style={{
                width: '100%',
                padding: '12px',
                background: 'linear-gradient(135deg, #b8860b, #8b6508)',
                color: '#1a1a1a',
                border: 'none',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              关闭
            </button>
          </div>
        </div>
      )}
    </>
  )
}