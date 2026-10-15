'use client'

/**
 * SkincareSection · 护肤说明 + 养护
 * 段 230 落地 · 2026-09-30 18:38
 *
 * 功能：客户可以了解日常护肤/护发流程 + 养护建议
 * 设计：可折叠步骤列表 + 卡片式展示
 */

import { useState } from 'react'

interface CareStep {
  emoji: string
  title: string
  description: string
  duration: string
}

interface CareGuide {
  id: string
  title: string
  emoji: string
  frequency: string
  steps: CareStep[]
}

const GUIDES: CareGuide[] = [
  {
    id: 'hair-daily',
    title: '日常护发',
    emoji: '💆',
    frequency: '每天',
    steps: [
      { emoji: '🧴', title: '选对洗发水', description: '油性头皮选控油型；干性/染烫选滋润型；敏感头皮选氨基酸类', duration: '1 min' },
      { emoji: '💧', title: '水温控制', description: '水温 38-40°C，过热会损伤毛鳞片导致头皮干燥', duration: '3 min' },
      { emoji: '🧴', title: '护发素', description: '涂在发尾 5cm 范围，不要涂头皮（会油）', duration: '2 min' },
      { emoji: '🌬️', title: '吹风机', description: '距离头发 15cm，先冷风后热风，避免集中一个点', duration: '5 min' },
    ],
  },
  {
    id: 'hair-weekly',
    title: '周护深层',
    emoji: '✨',
    frequency: '每周 1-2 次',
    steps: [
      { emoji: '🧖', title: '发膜', description: '洗发后涂发膜，停留 10-15 分钟（可戴浴帽加热）', duration: '15 min' },
      { emoji: '🪮', title: '头皮按摩', description: '指腹按摩头皮 3-5 分钟，促进血液循环', duration: '5 min' },
    ],
  },
  {
    id: 'hair-color-care',
    title: '染后养护',
    emoji: '🎨',
    frequency: '染后前 2 周',
    steps: [
      { emoji: '🚿', title: '延后洗头', description: '染后 48 小时内不洗头，让色素稳定', duration: '48h' },
      { emoji: '❄️', title: '冷水洗发', description: '冷水锁色，热水会让色素流失加快', duration: '3 min' },
      { emoji: '☀️', title: '防晒', description: '紫外线会让染发褪色，外出戴帽或用防晒喷雾', duration: '日常' },
    ],
  },
]

export default function SkincareSection() {
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
        <span>💆</span> 护肤 · 养护说明
        <span style={{
          fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.4)',
          marginLeft: 'auto',
        }}>到店前先了解</span>
      </h2>
      <p style={{
        fontSize: 11, color: 'rgba(255,255,255,0.5)',
        marginBottom: 14, lineHeight: 1.5,
      }}>专业养护建议 · 让造型更持久</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {GUIDES.map(guide => (
          <CareGuideCard key={guide.id} guide={guide} />
        ))}
      </div>
    </div>
  )
}

function CareGuideCard({ guide }: { guide: CareGuide }) {
  const [expanded, setExpanded] = useState(guide.id === 'hair-daily')

  return (
    <div style={{
      background: 'rgba(184, 134, 11, 0.05)',
      border: '1px solid rgba(184, 134, 11, 0.18)',
      borderRadius: 12,
      overflow: 'hidden',
    }}>
      {/* 标题栏（可点击） */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%',
          padding: '12px 14px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontFamily: 'inherit',
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 22 }}>{guide.emoji}</span>
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: 13,
            fontWeight: 700,
            color: '#fff',
            marginBottom: 2,
          }}>
            {guide.title}
          </div>
          <div style={{
            fontSize: 10,
            color: 'rgba(184, 134, 11, 0.85)',
          }}>
            {guide.frequency}
          </div>
        </div>
        <div style={{
          fontSize: 14,
          color: 'rgba(255,255,255,0.6)',
          transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s',
        }}>
          ›
        </div>
      </button>

      {/* 展开内容 */}
      {expanded && (
        <div style={{
          padding: '0 14px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          {guide.steps.map((step, i) => (
            <div key={i} style={{
              display: 'flex',
              gap: 10,
              padding: '10px',
              background: 'rgba(184, 134, 11, 0.08)',
              borderRadius: 8,
            }}>
              <div style={{
                fontSize: 22,
                flexShrink: 0,
                width: 36,
                height: 36,
                background: 'linear-gradient(135deg, rgba(184,134,11,0.25), rgba(184,134,11,0.08))',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {step.emoji}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 2,
                }}>
                  <span style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#fff',
                  }}>
                    {i + 1}. {step.title}
                  </span>
                  <span style={{
                    fontSize: 10,
                    color: 'rgba(184, 134, 11, 0.85)',
                    background: 'rgba(184, 134, 11, 0.15)',
                    padding: '1px 6px',
                    borderRadius: 8,
                  }}>
                    ⏱ {step.duration}
                  </span>
                </div>
                <div style={{
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.7)',
                  lineHeight: 1.5,
                }}>
                  {step.description}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}