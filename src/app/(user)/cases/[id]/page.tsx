import Link from 'next/link'
import { notFound } from 'next/navigation'
import AppLayout from '@/components/AppLayout'
import CASES from '@/data/hairstyle-cases.json'
import ShareButton from './ShareButton'

const GREEN = '#b8860b'

const FALLBACK_GRADIENTS: Record<string, string> = {
  m1: 'linear-gradient(135deg, #b8860b 0%, #5a3a25 100%)',
  m2: 'linear-gradient(135deg, #4a2f1f 0%, #8b6508 100%)',
  m3: 'linear-gradient(135deg, #2c1810 0%, #5a3a25 100%)',
  m4: 'linear-gradient(135deg, #8b6508 0%, #2c1810 100%)',
  f1: 'linear-gradient(135deg, #b8860b 0%, #4a2f1f 100%)',
  f2: 'linear-gradient(135deg, #5a3a25 0%, #b8860b 100%)',
  f3: 'linear-gradient(135deg, #8b6508 0%, #2c1810 100%)',
  f4: 'linear-gradient(135deg, #b8860b 0%, #5a3a25 100%)',
}

const GENDER_LABELS: Record<string, string> = {
  male: '男士',
  female: '女士',
  unisex: '通用',
}

const LENGTH_LABELS: Record<string, string> = {
  short: '短发',
  medium: '中发',
  long: '长发',
}

const COLOR_LABELS: Record<string, string> = {
  natural_black: '自然黑',
  natural_brown: '自然棕',
  bleached: '漂染',
  colored: '彩色',
}

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
  image: string
  image_prompt: string
}

export default async function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const c = (CASES as HairstyleCase[]).find(c => c.id === id)
  if (!c) notFound()

  const related = (CASES as HairstyleCase[])
    .filter(r => r.id !== c.id && (r.gender === c.gender || r.length === c.length))
    .slice(0, 3)

  const genderIcon = c.gender === 'male' ? '👨' : c.gender === 'female' ? '👩' : '🧑'

  return (
    <AppLayout title={c.name}>
      <div style={{ padding: '8px 16px 180px' }}>
        {/* 顶部：返回 + 面包屑 + 分享 */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          marginBottom: 16, flexWrap: 'wrap',
        }}>
          <Link
            href="/ai-find-drug/cases"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '6px 12px',
              background: 'rgba(184, 134, 11, 0.1)',
              border: '1px solid rgba(184, 134, 11, 0.3)',
              borderRadius: 100,
              color: '#b8860b',
              textDecoration: 'none',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <span style={{ fontSize: 14 }}>←</span>
            <span>返回</span>
          </Link>

          {/* 面包屑 */}
          <nav style={{
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 12, color: 'rgba(255,255,255,0.45)',
            flex: 1, minWidth: 0,
          }} aria-label="breadcrumb">
            <Link
              href="/ai-find-drug/cases"
              style={{
                color: 'rgba(255,255,255,0.5)',
                textDecoration: 'none',
                fontWeight: 500,
                maxWidth: 120,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              案例库
            </Link>
            <span style={{ opacity: 0.4 }}>›</span>
            <span style={{
              color: 'rgba(184, 134, 11, 0.85)',
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minWidth: 0,
            }}>
              {c.name}
            </span>
          </nav>

          {/* 分享按钮 */}
          <ShareButton
            title={`${c.name} · ${c.tagline}`}
            text={`看看这个发型：${c.name} - ${c.tagline}，参考价 ${c.price_range}，用时 ${c.duration_min} 分钟`}
            url={`/cases/${c.id}`}
          />
        </div>

        {/* 大图占位 */}
        <div style={{
          aspectRatio: '4 / 5',
          maxHeight: 400,
          background: FALLBACK_GRADIENTS[c.id] || 'linear-gradient(135deg, #b8860b, #2c1810)',
          borderRadius: 20,
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
          border: '1px solid rgba(184, 134, 11, 0.2)',
        }}>
          {/* 真实图片（如果有） */}
          {c.image && (
            <img
              src={c.image}
              alt={c.name}
              style={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%',
                objectFit: 'cover',
              }}
            />
          )}
          {/* 渐变遮罩 + emoji 占位 */}
          <div style={{
            position: 'relative', zIndex: 1,
            fontSize: 80,
            opacity: c.image ? 0.15 : 1,
            filter: c.image ? 'blur(2px)' : 'none',
          }}>
            💇
          </div>

          {/* 顶部信息卡 */}
          <div style={{
            position: 'absolute', top: 16, left: 16,
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(8px)',
            padding: '6px 12px',
            borderRadius: 100,
            fontSize: 12, color: '#fff',
            fontWeight: 600,
            zIndex: 2,
          }}>
            {genderIcon} {GENDER_LABELS[c.gender]} · {LENGTH_LABELS[c.length]}
          </div>

          {/* 底部热度 */}
          <div style={{
            position: 'absolute', bottom: 16, right: 16,
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(8px)',
            padding: '6px 12px',
            borderRadius: 100,
            fontSize: 13, color: '#fff',
            fontWeight: 700,
            zIndex: 2,
          }}>
            🔥 {c.popularity}.0
          </div>
        </div>

        {/* 标题 + tagline */}
        <div style={{ marginBottom: 18 }}>
          <div style={{
            fontSize: 11, color: GREEN, fontWeight: 700,
            letterSpacing: 1, textTransform: 'uppercase',
            marginBottom: 4,
          }}>#{c.id} · {COLOR_LABELS[c.color] || c.color}</div>
          <h1 style={{
            fontSize: 26, fontWeight: 800, color: '#fff',
            marginBottom: 6, lineHeight: 1.2,
          }}>{c.name}</h1>
          <p style={{
            fontSize: 14, color: 'rgba(255,255,255,0.6)',
            margin: 0,
          }}>{c.tagline}</p>
        </div>

        {/* 价格 + 时长 双卡 */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
          marginBottom: 20,
        }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(184, 134, 11, 0.2), rgba(184, 134, 11, 0.05))',
            border: '1px solid rgba(184, 134, 11, 0.3)',
            borderRadius: 14,
            padding: '14px 16px',
          }}>
            <div style={{ fontSize: 11, color: 'rgba(184, 134, 11, 0.8)', fontWeight: 600, marginBottom: 4 }}>💰 参考价</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#b8860b' }}>{c.price_range}</div>
          </div>
          <div style={{
            background: 'rgba(44, 24, 16, 0.5)',
            border: '1px solid rgba(184, 134, 11, 0.2)',
            borderRadius: 14,
            padding: '14px 16px',
          }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 600, marginBottom: 4 }}>⏱ 用时</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>{c.duration_min} 分钟</div>
          </div>
        </div>

        {/* 描述 */}
        <div style={{
          background: 'rgba(44, 24, 16, 0.4)',
          border: '1px solid rgba(184, 134, 11, 0.15)',
          borderRadius: 16,
          padding: '18px 18px',
          marginBottom: 16,
        }}>
          <h2 style={{
            fontSize: 13, fontWeight: 700, color: '#fff',
            marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span>📝</span> 描述
          </h2>
          <p style={{
            fontSize: 14, color: 'rgba(255,255,255,0.85)',
            lineHeight: 1.7, margin: 0,
          }}>{c.description}</p>
        </div>

        {/* vibe + 适配脸型 */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
          marginBottom: 16,
        }}>
          <div style={{
            background: 'rgba(184, 134, 11, 0.06)',
            border: '1px solid rgba(184, 134, 11, 0.2)',
            borderRadius: 14,
            padding: '14px 16px',
          }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: 600, marginBottom: 8 }}>✨ 风格</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {c.vibe.map(v => (
                <span key={v} style={{
                  background: 'rgba(184, 134, 11, 0.2)',
                  color: '#fff',
                  padding: '3px 10px',
                  borderRadius: 100,
                  fontSize: 12,
                  fontWeight: 600,
                }}>{v}</span>
              ))}
            </div>
          </div>
          <div style={{
            background: 'rgba(184, 134, 11, 0.06)',
            border: '1px solid rgba(184, 134, 11, 0.2)',
            borderRadius: 14,
            padding: '14px 16px',
          }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: 600, marginBottom: 8 }}>💆 适配脸型</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {c.face_shape.map(f => (
                <span key={f} style={{
                  background: 'rgba(184, 134, 11, 0.2)',
                  color: '#fff',
                  padding: '3px 10px',
                  borderRadius: 100,
                  fontSize: 12,
                  fontWeight: 600,
                }}>{f}</span>
              ))}
            </div>
          </div>
        </div>

        {/* 标签 */}
        {c.tags && c.tags.length > 0 && (
          <div style={{
            background: 'rgba(44, 24, 16, 0.3)',
            borderRadius: 14,
            padding: '14px 16px',
            marginBottom: 16,
          }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 600, marginBottom: 8 }}>🏷️ 标签</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {c.tags.map(t => (
                <span key={t} style={{
                  background: 'rgba(184, 134, 11, 0.1)',
                  color: 'rgba(255,255,255,0.85)',
                  padding: '3px 10px',
                  borderRadius: 6,
                  fontSize: 11,
                }}>#{t}</span>
              ))}
            </div>
          </div>
        )}

        {/* 行动按钮 */}
        <Link
          href="/search"
          style={{
            display: 'block',
            padding: '14px 20px',
            marginBottom: 24,
            background: 'linear-gradient(135deg, #b8860b, #8b6508)',
            color: '#1a1a1a',
            borderRadius: 14,
            textAlign: 'center',
            textDecoration: 'none',
            fontSize: 15,
            fontWeight: 700,
            boxShadow: '0 4px 14px rgba(184, 134, 11, 0.3)',
          }}
        >
          🔍 找同款造型
        </Link>

        {/* 相关案例 */}
        {related.length > 0 && (
          <div>
            <h2 style={{
              fontSize: 16, fontWeight: 700, color: '#fff',
              marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span>🔥</span> 相关案例
            </h2>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 8,
            }}>
              {related.map(r => (
                <Link
                  key={r.id}
                  href={`/cases/${r.id}`}
                  style={{
                    background: 'rgba(184, 134, 11, 0.05)',
                    border: '1px solid rgba(184, 134, 11, 0.15)',
                    borderRadius: 12,
                    overflow: 'hidden',
                    textDecoration: 'none',
                    color: 'inherit',
                    transition: 'transform 0.15s',
                  }}
                >
                  <div style={{
                    aspectRatio: '1 / 1',
                    background: FALLBACK_GRADIENTS[r.id] || 'linear-gradient(135deg, #b8860b, #2c1810)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 28,
                  }}>💇</div>
                  <div style={{ padding: '8px 10px' }}>
                    <div style={{
                      fontSize: 11, fontWeight: 700, color: '#fff',
                      overflow: 'hidden', textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap', marginBottom: 2,
                    }}>{r.name}</div>
                    <div style={{
                      fontSize: 10, color: 'rgba(184, 134, 11, 0.85)',
                      fontWeight: 600,
                    }}>{r.price_range}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}