'use client'

/**
 * AI 找发型主页 · 极简版（段 232 重构）
 *
 * 不同于：
 *  - /ai-find-drug/cases: 案例库独立专业页
 *  - /ai-find-drug/care: 护肤养护独立专业页
 *  - /ai-find-drug/products: 产品展示独立专业页
 *  - /ai-find-drug/demo: 真实案例 demo 独立专业页
 *
 * 这是"AI 找发型主页"，只保留 Hero + 4 大入口按钮 + 热门速选 + 全部分类。
 * 历史：2026-08-28 全改成造型版 → 2026-09-30 段 230 加 4 section 堆叠 → 段 232 改回极简 + 跳转。
 */

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'
import AppLayout from '@/components/AppLayout'
import { BUSINESS_CONFIG } from '@/config/business.config'

const GREEN = '#b8860b'

// 4 个独立专业页入口
const ENTRY_CARDS = [
  {
    href: '/ai-find-drug/cases',
    emoji: '📸',
    title: '进入案例库',
    subtitle: '15 款精选造型 · 男女皆备',
    desc: '按脸型 / 长度 / 性别筛选',
    color: 'rgba(184, 134, 11, 0.25)',
    accent: '#b8860b',
  },
  {
    href: '/ai-find-drug/care',
    emoji: '💆',
    title: '了解护肤养护',
    subtitle: '日常 / 周护 / 染后 3 大指南',
    desc: '专业养护建议 · 造型更持久',
    color: 'rgba(184, 134, 11, 0.18)',
    accent: '#b8860b',
  },
  {
    href: '/ai-find-drug/products',
    emoji: '📦',
    title: '查看造型产品',
    subtitle: '6 件造型师同款',
    desc: '发蜡 / 喷雾 / 洗发水 / 发膜',
    color: 'rgba(184, 134, 11, 0.22)',
    accent: '#b8860b',
  },
  {
    href: '/ai-find-drug/demo',
    emoji: '🎬',
    title: '真实改造案例',
    subtitle: '即将上线 · 占位',
    desc: '客户授权 before/after 对比',
    color: 'rgba(184, 134, 11, 0.15)',
    accent: '#b8860b',
  },
]

// 热门需求（精选 7 个最常见造型消费场景）
const HOT_CATEGORIES = [
  { icon: '✂️', name: '当季造型', desc: '近期热门风格' },
  { icon: '🥬', name: '染护套餐', desc: '洗发护发' },
  { icon: '💇', name: '造型配套', desc: '发蜡/发油/喷雾' },
  { icon: '👶', name: '儿童造型', desc: '发型图鉴' },
  { icon: '💪', name: '造型偏好', desc: '日常/约会/通勤' },
  { icon: '🍱', name: '造型搭配', desc: '休闲/约会/通勤' },
  { icon: '🔥', name: '当日特惠', desc: '限时折扣' },
]

// 全部分类（按造型消费场景划分）
const ALL_CATEGORIES = [
  '烫发造型', '染护套餐', '造型配套', '造型工具',
  '染护产品', '配套洗护', '风格配件', '日常护理',
  '儿童造型', '造型偏好', '造型搭配', '经典造型',
  '男士发型', '女士发型', '染发系列', '烫发系列',
  '节日礼品',
]

export default function AIFindProductPage() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const { name } = BUSINESS_CONFIG

  // 立即搜发型
  const handleSearch = () => {
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`)
    } else {
      router.push('/search')
    }
  }

  // 进入造型助手对话
  const handleAIConsult = () => {
    router.push('/pharmacist')
  }

  // 进入商品分类
  const handleCategory = (cat: string) => {
    router.push(`/products?category=${encodeURIComponent(cat)}`)
  }

  return (
    <AppLayout title="AI 找发型">
      <div style={{ padding: '8px 16px 180px' }}>
        {/* ============ Hero 区：大搜索框 ============ */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(184, 134, 11,0.18) 0%, rgba(184, 134, 11,0.06) 100%)',
          border: '1.5px solid rgba(184, 134, 11,0.35)',
          borderRadius: '20px',
          padding: '24px 20px',
          marginBottom: '16px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '40px', marginBottom: '8px' }}>✂️</div>
          <h1 style={{
            fontSize: '22px', fontWeight: 800, color: '#fff',
            marginBottom: '6px', letterSpacing: '-0.5px',
          }}>AI 找发型</h1>
          <p style={{
            fontSize: '13px', color: GREEN,
            fontWeight: 500, marginBottom: '18px',
          }}>说需求 · 造型助手帮你选风格</p>

          {/* 大搜索框 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(44, 24, 16, 0.5)',
            border: '1px solid rgba(184, 134, 11, 0.3)',
            borderRadius: '14px',
            padding: '4px 4px 4px 14px',
          }}>
            <span style={{ fontSize: '16px', opacity: 0.7 }}>🔍</span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="说需求,如「我要做清爽短发」"
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#fff',
                fontSize: '15px',
                padding: '12px 4px',
                fontFamily: 'inherit',
              }}
            />
            <button
              onClick={handleSearch}
              style={{
                background: 'linear-gradient(135deg, #b8860b, #8b6508)',
                color: '#2c1810',
                border: 'none',
                borderRadius: '12px',
                padding: '10px 16px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >搜发型</button>
          </div>
        </div>

        {/* ============ AI 立即问（突出入口）============ */}
        <button
          onClick={handleAIConsult}
          style={{
            width: '100%',
            padding: '16px 20px',
            marginBottom: '24px',
            background: 'linear-gradient(135deg, rgba(184, 134, 11,0.25), rgba(184,134,11,0.12))',
            border: '1.5px solid rgba(184, 134, 11,0.4)',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            cursor: 'pointer',
            textAlign: 'left',
            boxShadow: '0 6px 20px rgba(184, 134, 11,0.18)',
            fontFamily: 'inherit',
          }}
        >
          <div style={{
            width: 44, height: 44,
            background: 'linear-gradient(135deg, #b8860b, #8b6508)',
            borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, flexShrink: 0,
          }}>🥗</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff', marginBottom: 2 }}>
              让 造型助手帮你选
            </div>
            <div style={{ fontSize: '11.5px', color: 'rgba(184, 134, 11, 0.7)' }}>
              对话式挑选 · 24h 在线 · 一键下单取货
            </div>
          </div>
          <div style={{ fontSize: '20px', color: GREEN, opacity: 0.7 }}>›</div>
        </button>

        {/* ============ 4 大入口按钮卡片（段 232 重构）============ */}
        <div style={{
          marginBottom: '24px',
        }}>
          <h2 style={{
            fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.6)',
            marginBottom: 12, letterSpacing: '0.5px',
            textTransform: 'uppercase',
          }}>
            专业服务
          </h2>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}>
            {ENTRY_CARDS.map((card, i) => (
              <Link
                key={i}
                href={card.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '16px 18px',
                  background: `linear-gradient(135deg, ${card.color} 0%, rgba(44, 24, 16, 0.5) 100%)`,
                  border: '1.5px solid rgba(184, 134, 11, 0.3)',
                  borderRadius: '16px',
                  textDecoration: 'none',
                  color: 'inherit',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                  transition: 'transform 0.15s, border-color 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.borderColor = 'rgba(184, 134, 11, 0.6)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.borderColor = 'rgba(184, 134, 11, 0.3)'
                }}
              >
                <div style={{
                  width: 52, height: 52,
                  background: 'linear-gradient(135deg, rgba(184, 134, 11, 0.4), rgba(184, 134, 11, 0.1))',
                  borderRadius: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 28, flexShrink: 0,
                }}>{card.emoji}</div>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: 15, fontWeight: 700, color: '#fff',
                    marginBottom: 3,
                  }}>{card.title}</div>
                  <div style={{
                    fontSize: 12, color: 'rgba(184, 134, 11, 0.9)',
                    fontWeight: 600, marginBottom: 2,
                  }}>{card.subtitle}</div>
                  <div style={{
                    fontSize: 11, color: 'rgba(255,255,255,0.55)',
                  }}>{card.desc}</div>
                </div>
                <div style={{
                  fontSize: 24, color: GREEN, opacity: 0.6,
                  fontWeight: 300,
                }}>›</div>
              </Link>
            ))}
          </div>
        </div>

        {/* ============ 热门需求（速选）============ */}
        <div style={{
          background: 'rgba(44, 24, 16, 0.3)',
          borderRadius: '16px',
          padding: '18px 16px',
          marginBottom: '16px',
          border: '1px solid rgba(184, 134, 11, 0.1)',
        }}>
          <h2 style={{
            fontSize: 14, fontWeight: 700, color: '#fff',
            marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span>🔥</span> 热门需求速选
            <span style={{
              fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.4)',
              marginLeft: 'auto',
            }}>点选即可</span>
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '8px',
          }}>
            {HOT_CATEGORIES.map((cat, i) => (
              <button
                key={i}
                onClick={() => handleCategory(cat.name)}
                style={{
                  padding: '12px 4px',
                  background: 'rgba(184, 134, 11, 0.06)',
                  border: '1px solid rgba(184, 134, 11, 0.15)',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  textAlign: 'center',
                  fontFamily: 'inherit',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(184, 134, 11, 0.15)'
                  e.currentTarget.style.borderColor = 'rgba(184, 134, 11, 0.4)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(184, 134, 11, 0.06)'
                  e.currentTarget.style.borderColor = 'rgba(184, 134, 11, 0.15)'
                }}
              >
                <div style={{ fontSize: '24px', marginBottom: '4px' }}>{cat.icon}</div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#fff', marginBottom: '2px' }}>{cat.name}</div>
                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)' }}>{cat.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* ============ 全部分类（浏览）============ */}
        <div style={{
          background: 'rgba(44, 24, 16, 0.3)',
          borderRadius: '16px',
          padding: '18px 16px',
          marginBottom: '16px',
          border: '1px solid rgba(184, 134, 11, 0.1)',
        }}>
          <h2 style={{
            fontSize: 14, fontWeight: 700, color: '#fff',
            marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span>📋</span> 全部分类
            <span style={{
              fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.4)',
              marginLeft: 'auto',
            }}>{ALL_CATEGORIES.length} 类</span>
          </h2>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px',
          }}>
            {ALL_CATEGORIES.map((cat, i) => (
              <button
                key={i}
                onClick={() => handleCategory(cat)}
                style={{
                  padding: '6px 12px',
                  background: 'rgba(184, 134, 11, 0.05)',
                  border: '1px solid rgba(184, 134, 11, 0.15)',
                  borderRadius: '100px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  color: 'rgba(255,255,255,0.75)',
                  fontFamily: 'inherit',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(184, 134, 11, 0.18)'
                  e.currentTarget.style.borderColor = 'rgba(184, 134, 11, 0.4)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(184, 134, 11, 0.05)'
                  e.currentTarget.style.borderColor = 'rgba(184, 134, 11, 0.15)'
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div style={{
          textAlign: 'center', padding: '16px 0',
          fontSize: 11, color: 'rgba(255,255,255,0.3)',
        }}>
          © 2026 {name} · AI 找发型
        </div>
      </div>
    </AppLayout>
  )
}