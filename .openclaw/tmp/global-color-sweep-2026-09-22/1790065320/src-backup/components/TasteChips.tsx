'use client'

/**
 * 🍽️ 口味快速标签 — 单选 chip 选择器
 * ⭐ MEMORY §271 — 奕霖 2026-08-26 加
 *
 * 设计原则（来自奕霖偏好 2026-08-25 23:56）：
 * - 不要让用户手动填"我喜欢..."(不准)
 * - 用 8 个预定义 chip 让用户 1 击选一个
 * - 选中态视觉强（绿底绿字）
 * - 紧凑布局，wrap 多行
 *
 * 存储：只内存态（不写 DB），减少后端复杂度
 * 后续可扩展到 localStorage 持久化
 */

import { useState, useEffect } from 'react'

const GREEN = '#b8860b'
const GREEN_RGBA = '184, 134, 11'

// 8 个预设标签（按用户偏好 2026-07-15 00:14：紧凑 + 视觉一致）
export const TASTE_OPTIONS = [
  { key: 'sweet',     icon: '🍬', label: '香甜',    desc: '糖分高、口感软' },
  { key: 'sour',      icon: '🍋', label: '酸甜',    desc: '柑橘、莓果、酸奶' },
  { key: 'juicy',     icon: '🍉', label: '果汁感',  desc: '水分足、入口爆汁' },
  { key: 'crispy',    icon: '🥕', label: '清脆',    desc: '苹果、萝卜、黄瓜' },
  { key: 'soft',      icon: '🍌', label: '软糯',    desc: '香蕉、芒果、熟透桃' },
  { key: 'fresh',     icon: '🥬', label: '清新',    desc: '蔬菜、薄荷、绿叶' },
  { key: 'rich',      icon: '🥑', label: '醇厚',    desc: '牛油果、坚果、菌菇' },
  { key: 'seasonal',  icon: '🌱', label: '当季',    desc: '什么新鲜吃什么' },
]

const STORAGE_KEY = 'zhilin:taste'

export default function TasteChips() {
  const [selected, setSelected] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const v = localStorage.getItem(STORAGE_KEY)
      if (v && TASTE_OPTIONS.some((o) => o.key === v)) setSelected(v)
    } catch (e) {}
  }, [])

  function pick(key: string) {
    const next = selected === key ? null : key  // 再点取消
    setSelected(next)
    try {
      if (next) localStorage.setItem(STORAGE_KEY, next)
      else localStorage.removeItem(STORAGE_KEY)
    } catch (e) {}
  }

  const current = TASTE_OPTIONS.find((o) => o.key === selected)

  return (
    <div style={{
      marginTop: 14,
      background: 'rgba(184, 134, 11, 0.05)',
      border: `1px solid rgba(${GREEN_RGBA}, 0.15)`,
      borderRadius: 14, padding: 14,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 10,
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
          🍽️ 口味偏好
        </div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>
          {mounted ? (current ? `已选 · ${current.label}` : '选一个') : '加载中'}
        </div>
      </div>

      <div style={{
        fontSize: 11, color: 'rgba(255,255,255,0.55)', marginBottom: 10, lineHeight: 1.6,
      }}>
        选一个口味，下次聊天果小蔬会按这个方向推荐 🌿
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 6,
      }}>
        {TASTE_OPTIONS.map((o) => {
          const isSel = selected === o.key
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => pick(o.key)}
              title={o.desc}
              style={{
                padding: '8px 4px',
                borderRadius: 10,
                border: isSel
                  ? `1.5px solid ${GREEN}`
                  : '1px solid rgba(184, 134, 11, 0.15)',
                background: isSel
                  ? 'rgba(184, 134, 11, 0.2)'
                  : 'rgba(184, 134, 11, 0.04)',
                color: isSel ? GREEN : 'rgba(255,255,255,0.75)',
                fontSize: 12, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                transition: 'all 0.15s ease',
              }}
            >
              <span style={{ fontSize: 16 }}>{o.icon}</span>
              <span>{o.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
