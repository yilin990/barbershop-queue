'use client'

/**
 * CasesLibrary · 发型案例库
 * 段 215 落地 · 2026-09-30 18:30
 *
 * 功能：客户可以浏览发型案例 → 自助判断想要的发型 → 到店沟通
 * 数据源：src/data/hairstyle-cases.json
 *
 * 设计原则：
 * - 2列瀑布流 + 筛选器（脸型 / 长度 / 性别）
 * - 每卡片：照片 + 名称 + 价格 + 脸型适配 + 标签
 * - 图片加载失败 → 渐变色 fallback（永不白屏）
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import CASES from '@/data/hairstyle-cases.json'

interface HairstyleCase {
  id: string
  name: string
  tagline: string
  length: 'short' | 'medium' | 'long'
  gender: 'male' | 'female' | 'unisex'
  color: string
  face_shape: string[]
  vibe: string[]
  description: string
  duration_min: number
  price_range: string
  popularity: number
  tags: string[]
  image: string | null
  image_prompt?: string
  _status?: string
}

const FACE_SHAPE_OPTIONS = [
  { value: 'round', label: '圆脸', icon: '⭕' },
  { value: 'long', label: '长脸', icon: '📏' },
  { value: 'square', label: '方脸', icon: '⬜' },
  { value: 'oval', label: '椭圆', icon: '🥚' },
  { value: 'heart', label: '心形', icon: '💗' },
]

const LENGTH_OPTIONS = [
  { value: 'short', label: '短发' },
  { value: 'medium', label: '中发' },
  { value: 'long', label: '长发' },
]

const GENDER_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'male', label: '👨 男士' },
  { value: 'female', label: '👩 女士' },
]

// 渐变色 fallback（图片未到位时用）
const FALLBACK_GRADIENTS: Record<string, string> = {
  m1: 'linear-gradient(135deg, #8b6508 0%, #5a3a25 100%)',
  m2: 'linear-gradient(135deg, #b8860b 0%, #8b6508 100%)',
  m3: 'linear-gradient(135deg, #2c1810 0%, #4a2f1f 100%)',
  m4: 'linear-gradient(135deg, #4a2f1f 0%, #b8860b 100%)',
  f1: 'linear-gradient(135deg, #b8860b 0%, #5a3a25 100%)',
  f2: 'linear-gradient(135deg, #5a3a25 0%, #2c1810 100%)',
  f3: 'linear-gradient(135deg, #b8860b 0%, #2c1810 100%)',
  f4: 'linear-gradient(135deg, #8b6508 0%, #2c1810 100%)',
  // ⭐ 2026-10-03 清禾补齐：m5-m7 / f5-f8 这 7 个 id 原先既没有渐变兜底，
  //    对应图片文件也从未创建（查过 16 份历史备份，全都是 8 张）。
  //    补上兜底后，即使图片缺失也显示有色块，而不是空白。
  m5: 'linear-gradient(135deg, #2c1810 0%, #8b6508 100%)',
  m6: 'linear-gradient(135deg, #4a2f1f 0%, #8b6508 100%)',
  m7: 'linear-gradient(135deg, #5a3a25 0%, #b8860b 100%)',
  f5: 'linear-gradient(135deg, #8b6508 0%, #4a2f1f 100%)',
  f6: 'linear-gradient(135deg, #b8860b 0%, #2c1810 100%)',
  f7: 'linear-gradient(135deg, #5a3a25 0%, #b8860b 100%)',
  f8: 'linear-gradient(135deg, #4a2f1f 0%, #2c1810 100%)',
}

export default function CasesLibrary() {
  const [faceShape, setFaceShape] = useState<string | null>(null)
  const [length, setLength] = useState<string | null>(null)
  const [gender, setGender] = useState<string>('all')

  const cases = CASES as HairstyleCase[]

  const filtered = cases.filter(c => {
    if (faceShape && !c.face_shape.includes(faceShape)) return false
    if (length && c.length !== length) return false
    if (gender !== 'all' && c.gender !== gender && c.gender !== 'unisex') return false
    return true
  })

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
        <span>📸</span> 发型案例库
        <span style={{
          fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.4)',
          marginLeft: 'auto',
        }}>{filtered.length} 款 · 到店沟通更准</span>
      </h2>
      <p style={{
        fontSize: 11, color: 'rgba(255,255,255,0.5)',
        marginBottom: 14, lineHeight: 1.5,
      }}>看图种草 · 自助判断 · 到店指给理发师</p>

      {/* 筛选器 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
        {/* 性别 */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
          {GENDER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setGender(opt.value)}
              style={{
                flexShrink: 0,
                padding: '6px 14px',
                fontSize: 12,
                fontWeight: 600,
                background: gender === opt.value
                  ? 'linear-gradient(135deg, #b8860b, #8b6508)'
                  : 'rgba(184, 134, 11, 0.08)',
                color: gender === opt.value ? '#1a1a1a' : 'rgba(255,255,255,0.7)',
                border: gender === opt.value
                  ? '1px solid #b8860b'
                  : '1px solid rgba(184, 134, 11, 0.2)',
                borderRadius: 20,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                fontFamily: 'inherit',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* 长度 */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
          <button
            onClick={() => setLength(null)}
            style={{
              flexShrink: 0,
              padding: '5px 12px',
              fontSize: 11,
              fontWeight: 600,
              background: length === null
                ? 'rgba(184, 134, 11, 0.25)'
                : 'rgba(184, 134, 11, 0.06)',
              color: length === null ? '#fff' : 'rgba(255,255,255,0.6)',
              border: '1px solid rgba(184, 134, 11, 0.2)',
              borderRadius: 16,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              fontFamily: 'inherit',
            }}
          >
            全部长度
          </button>
          {LENGTH_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setLength(opt.value)}
              style={{
                flexShrink: 0,
                padding: '5px 12px',
                fontSize: 11,
                fontWeight: 600,
                background: length === opt.value
                  ? 'rgba(184, 134, 11, 0.25)'
                  : 'rgba(184, 134, 11, 0.06)',
                color: length === opt.value ? '#fff' : 'rgba(255,255,255,0.6)',
                border: '1px solid rgba(184, 134, 11, 0.2)',
                borderRadius: 16,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                fontFamily: 'inherit',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* 脸型 */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
          <button
            onClick={() => setFaceShape(null)}
            style={{
              flexShrink: 0,
              padding: '5px 12px',
              fontSize: 11,
              fontWeight: 600,
              background: faceShape === null
                ? 'rgba(184, 134, 11, 0.25)'
                : 'rgba(184, 134, 11, 0.06)',
              color: faceShape === null ? '#fff' : 'rgba(255,255,255,0.6)',
              border: '1px solid rgba(184, 134, 11, 0.2)',
              borderRadius: 16,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              fontFamily: 'inherit',
            }}
          >
            全部脸型
          </button>
          {FACE_SHAPE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setFaceShape(opt.value)}
              style={{
                flexShrink: 0,
                padding: '5px 12px',
                fontSize: 11,
                fontWeight: 600,
                background: faceShape === opt.value
                  ? 'rgba(184, 134, 11, 0.25)'
                  : 'rgba(184, 134, 11, 0.06)',
                color: faceShape === opt.value ? '#fff' : 'rgba(255,255,255,0.6)',
                border: '1px solid rgba(184, 134, 11, 0.2)',
                borderRadius: 16,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                fontFamily: 'inherit',
              }}
            >
              {opt.icon} {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 案例网格 */}
      {filtered.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '40px 20px',
          color: 'rgba(255,255,255,0.5)',
          fontSize: 13,
        }}>
          没有匹配的案例 · 试试其他筛选
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '10px',
        }}>
          {filtered.map((c) => (
            <CaseCard key={c.id} data={c} />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * ⭐ 2026-10-03 清禾改造：CSS 背景图 → <picture> + <img>
 *
 * 改造前的问题：
 *   图片用 `background: url(...)` 渲染 → 404 时浏览器**不显示任何提示**，
 *   只留一块空白（用户反馈"部分图片没有"）。
 *   另外 PNG 平均 250KB，走隧道单张要 1.2-1.9s。
 *
 * 改造后：
 *   - WebP 优先、PNG 兜底（8 张实测 1915KB → 321KB，-83%）
 *   - 加载失败 onError 自动隐藏 <img>，露出底层渐变占位（永不白屏）
 *   - loading="lazy" 让首屏外的图不抢带宽
 */
function CaseImage({ src, fallbackId, name }: { src: string | null; fallbackId: string; name: string }) {
  const [failed, setFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)

  // src 为 null / 加载失败 → 不渲染 <img>，直接显示下方渐变
  if (!src || failed) return null

  const webp = src.replace(/\.png$/, '.webp')

  return (
    <picture>
      <source srcSet={webp} type="image/webp" />
      <img
        src={src}
        alt={`${name} 发型效果图`}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        onLoad={() => setLoaded(true)}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: loaded ? 1 : 0,
          transition: 'opacity 0.35s ease',
        }}
      />
    </picture>
  )
}

function CaseCard({ data }: { data: HairstyleCase }) {
  const router = useRouter()
  const genderIcon = data.gender === 'male' ? '👨' : data.gender === 'female' ? '👩' : '🧑'
  const lengthLabel = data.length === 'short' ? '短发' : data.length === 'medium' ? '中发' : '长发'

  return (
    <div style={{
      background: 'rgba(184, 134, 11, 0.05)',
      border: '1px solid rgba(184, 134, 11, 0.15)',
      borderRadius: 14,
      overflow: 'hidden',
      cursor: 'pointer',
      transition: 'all 0.2s',
    }}
    onClick={() => {
      router.push(`/cases/${data.id}`)
    }}
    >
      {/* 照片区：渐变垫底 + <img> 叠在上面（加载失败自动露出渐变，不再空白） */}
      <div style={{
        aspectRatio: '1 / 1',
        background: FALLBACK_GRADIENTS[data.id] || 'linear-gradient(135deg, #b8860b, #2c1810)',
        position: 'relative',
        display: 'flex',
        alignItems: 'flex-end',
        padding: 10,
      }}>
        <CaseImage src={data.image} fallbackId={data.id} name={data.name} />
        {/* 顶部标签 */}
        <div style={{
          position: 'absolute',
          top: 8,
          left: 8,
          display: 'flex',
          gap: 4,
        }}>
          <span style={{
            background: 'rgba(0, 0, 0, 0.55)',
            color: '#fff',
            padding: '2px 8px',
            borderRadius: 10,
            fontSize: 10,
            fontWeight: 600,
            backdropFilter: 'blur(8px)',
          }}>
            {genderIcon} {lengthLabel}
          </span>
          {data.popularity >= 5 && (
            <span style={{
              background: 'linear-gradient(135deg, #ff6b6b, #ff4757)',
              color: '#fff',
              padding: '2px 8px',
              borderRadius: 10,
              fontSize: 10,
              fontWeight: 700,
            }}>
              🔥 热门
            </span>
          )}
        </div>
        {/* 底部价格 */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.55)',
          color: '#fff',
          padding: '4px 10px',
          borderRadius: 8,
          fontSize: 11,
          fontWeight: 700,
          backdropFilter: 'blur(8px)',
        }}>
          {data.price_range}
        </div>
      </div>

      {/* 信息 */}
      <div style={{ padding: '10px 12px' }}>
        <div style={{
          fontSize: 13,
          fontWeight: 700,
          color: '#fff',
          marginBottom: 2,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {data.name}
        </div>
        <div style={{
          fontSize: 11,
          color: 'rgba(184, 134, 11, 0.85)',
          marginBottom: 6,
        }}>
          {data.tagline}
        </div>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 3,
        }}>
          {data.face_shape.slice(0, 3).map((f) => (
            <span key={f} style={{
              background: 'rgba(184, 134, 11, 0.15)',
              color: 'rgba(255,255,255,0.7)',
              padding: '2px 6px',
              borderRadius: 6,
              fontSize: 9,
            }}>
              {f === 'round' ? '圆脸' :
               f === 'long' ? '长脸' :
               f === 'square' ? '方脸' :
               f === 'oval' ? '椭圆' :
               f === 'heart' ? '心形' : f}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}