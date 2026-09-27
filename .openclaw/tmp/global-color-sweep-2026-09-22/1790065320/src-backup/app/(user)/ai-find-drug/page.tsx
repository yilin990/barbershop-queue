'use client'

/**
 * AI 找商品页 · 2026-08-28 奕霖要求全改成果蔬版
 *
 * 不同于：
 *  - /search: 搜索结果列表页（已存在）
 *  - /products: 商品分类浏览页（已存在）
 *
 * 这是"AI 找商品主页"，专注于"对话式挑果蔬"：
 *  - 大搜索框 + 语音输入入口
 *  - 7 个热门需求速选卡（应季水果/新鲜蔬菜/...）
 *  - 17 个全部分类速选 chip
 *  - AI 推荐位（吸睛的"立即问 果小蔬"）
 *
 * 历史：2026-07-02 原版是医药(AI 找药),MEMORY §269 之前已部分改成果蔬,
 *       §282 再次清理残留,本页整页重写。
 */

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import AppLayout from '@/components/AppLayout'
import { BUSINESS_CONFIG } from '@/config/business.config'

const GREEN = '#b8860b'
const GREEN_RGBA = '184, 134, 11'

// 热门需求（精选 7 个最常见果蔬消费场景）
const HOT_CATEGORIES = [
  { icon: '🍎', name: '应季水果', desc: '当季鲜采直送' },
  { icon: '🥬', name: '新鲜蔬菜', desc: '叶菜根茎齐全' },
  { icon: '🍚', name: '粮油米面', desc: '东北米/面粉/油' },
  { icon: '👶', name: '宝宝辅食', desc: '果泥/蔬菜泥' },
  { icon: '💪', name: '慢病忌口', desc: '低糖/低盐/低脂' },
  { icon: '🍱', name: '营养搭配', desc: '早餐/健身/晚餐' },
  { icon: '🔥', name: '当日特惠', desc: '限时折扣' },
]

// 全部分类（按果蔬消费场景划分，不含医药/Rx）
const ALL_CATEGORIES = [
  '时令水果', '新鲜蔬菜', '粮油米面', '肉禽蛋奶',
  '海鲜水产', '豆制品', '调味品', '坚果零食',
  '宝宝辅食', '慢病忌口', '营养搭配', '早餐食材',
  '火锅食材', '烧烤食材', '沙拉轻食', '汤品煲汤',
  '节日礼品',
]

export default function AIFindProductPage() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const { name } = BUSINESS_CONFIG

  // 立即搜商品
  const handleSearch = () => {
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`)
    } else {
      router.push('/search')
    }
  }

  // 进入 果小蔬对话
  const handleAIConsult = () => {
    router.push('/pharmacist')
  }

  // 进入商品分类
  const handleCategory = (cat: string) => {
    router.push(`/products?category=${encodeURIComponent(cat)}`)
  }

  return (
    <AppLayout title="AI 找商品">
      {/* ⭐ 奕霖 2026-07-24 16:53 反馈图：FAB 压住最后几件商品「加入购物车」按钮。FAB 顶 y ≈ bottom(96)+52=148 → paddingBottom 180 清理 */}
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
          <div style={{ fontSize: '40px', marginBottom: '8px' }}>🍎</div>
          <h1 style={{
            fontSize: '22px', fontWeight: 800, color: '#fff',
            marginBottom: '6px', letterSpacing: '-0.5px',
          }}>AI 找商品</h1>
          <p style={{
            fontSize: '13px', color: GREEN,
            fontWeight: 500, marginBottom: '18px',
          }}>说需求 · 果小蔬帮你选合适的果蔬</p>

          {/* 大搜索框 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(10, 20, 15, 0.5)',
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
              placeholder="说需求或商品,如「我想做番茄炒蛋」"
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
                background: 'linear-gradient(135deg, #2dd4bf, #14b8a6)',
                color: '#0a0f0d',
                border: 'none',
                borderRadius: '12px',
                padding: '10px 16px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >搜商品</button>
          </div>
        </div>

        {/* ============ AI 立即问（突出入口）============ */}
        <button
          onClick={handleAIConsult}
          style={{
            width: '100%',
            padding: '16px 20px',
            marginBottom: '20px',
            background: 'linear-gradient(135deg, rgba(184, 134, 11,0.25), rgba(45,212,191,0.12))',
            border: '1.5px solid rgba(184, 134, 11,0.4)',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            cursor: 'pointer',
            textAlign: 'left',
            boxShadow: '0 6px 20px rgba(184, 134, 11,0.18)',
          }}
        >
          <div style={{
            width: 44, height: 44,
            background: 'linear-gradient(135deg, #2dd4bf, #14b8a6)',
            borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, flexShrink: 0,
          }}>🥗</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff', marginBottom: 2 }}>
              让 果小蔬帮你选
            </div>
            <div style={{ fontSize: '11.5px', color: 'rgba(184, 134, 11, 0.7)' }}>
              对话式挑选 · 24h 在线 · 一键下单取货
            </div>
          </div>
          <div style={{ fontSize: '20px', color: GREEN, opacity: 0.7 }}>›</div>
        </button>

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
          © 2026 {name} · AI 找商品
        </div>
      </div>
    </AppLayout>
  )
}
