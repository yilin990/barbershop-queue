'use client'

/**
 * ⭐ 2026-09-21 13:50 清禾自主推进：付费墙 UI（接段93 拍板 2 档定价）
 *
 * 设计原则：
 *  - 2 档定价（基础免费 + 智能 ¥99/月），砍了 AI 旗舰版 ¥299/月
 *  - 老板和客人都能看到入口，但不打扰主流程
 *  - 基础版永远免费（流量入口）
 *  - 智能版强调"你已经有数据了，升级后这些数据会自动变钱"
 *
 * 触发位置（v1.0.0）：
 *  - PIN 首次进店提示底部（客人也能看到，但不打扰）
 *  - BookingSection 顶部菜单"💎 会员中心"（老板主动点）
 */

import { useState } from 'react'

export interface PricingPlan {
  id: 'free' | 'smart'
  name: string
  price: number  // 元/月，0 = 免费
  emoji: string
  features: string[]
  ctaText: string
  highlight?: boolean  // 推荐徽章
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'free',
    name: '基础免费版',
    price: 0,
    emoji: '🎁',
    features: [
      '✅ 扫码进店（客人自助）',
      '✅ 在线预约',
      '✅ 现场取号',
      '✅ 实时排队（客人可见）',
      '✅ 2 个理发师',
      '✅ 100 单/月',
    ],
    ctaText: '当前套餐',
  },
  {
    id: 'smart',
    name: '智能版',
    price: 99,
    emoji: '🤖',
    features: [
      '✅ 基础版全部功能',
      '✨ AI 自动分配理发师',
      '✨ 智能改约（客人想换时间，一键推荐最优空档）',
      '✨ 客户回访（30/60/90 天自动提醒）',
      '✨ 数据分析（周报/月报自动推送）',
      '✨ 不限理发师数',
      '✨ 不限订单数',
    ],
    ctaText: '立即升级',
    highlight: true,
  },
]

interface PricingModalProps {
  currentPlan?: 'free' | 'smart'  // 当前用户套餐
  onClose: () => void
  onSelectPlan?: (planId: 'free' | 'smart') => void | Promise<void>
  t?: any  // theme tokens（暂时 default）
}

const DEFAULT_T = {
  primary: '#b8860b',
  primarySoft: 'rgba(184, 134, 11, 0.15)',
  bgCard: '#fff8e7',
  bgPage: '#fdf6e3',
  text: '#3e2723',
  textMuted: 'rgba(62, 39, 35, 0.6)',
  border: 'rgba(184, 134, 11, 0.2)',
  bgDeep: 'rgba(184, 134, 11, 0.04)',
}

export function PricingModal({ currentPlan = 'free', onClose, onSelectPlan, t = DEFAULT_T }: PricingModalProps) {
  const [busy, setBusy] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)

  async function handleSelect(planId: 'free' | 'smart') {
    if (planId === currentPlan) {
      // 当前套餐
      onClose()
      return
    }
    if (!onSelectPlan) {
      // 演示模式：未对接后端
      setSelectedPlan(planId)
      setTimeout(() => {
        alert(`演示模式：\n\n点击了"${planId === 'smart' ? '智能版 ¥99/月' : '基础免费版'}"\n\n真实接 Stripe/微信支付后才能扣款。\n\n请联系奕霖开通支付。`)
        onClose()
      }, 600)
      return
    }
    setBusy(true)
    try {
      await onSelectPlan(planId)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 16,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: t.bgCard,
        borderRadius: 16,
        width: '100%', maxWidth: 480,
        maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 16px 48px rgba(0, 0, 0, 0.2)',
        border: `1px solid ${t.border}`,
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px 8px',
        }}>
          <h3 style={{ fontSize: 20, fontWeight: 700, color: t.text, margin: 0 }}>
            💎 选择套餐
          </h3>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none',
            fontSize: 24, color: t.textMuted,
            cursor: 'pointer', padding: 0, lineHeight: 1,
          }}>×</button>
        </div>

        <p style={{
          padding: '0 24px 16px',
          fontSize: 13, color: t.textMuted, margin: 0,
        }}>
          基础免费版永久免费。智能版 ¥99/月，30 天无理由退订。
        </p>

        {/* 2 卡片横排（手机端自动竖排） */}
        <div style={{
          padding: '0 20px 20px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 12,
        }}>
          {PRICING_PLANS.map(plan => {
            const isCurrent = plan.id === currentPlan
            const isSelected = selectedPlan === plan.id
            return (
              <div key={plan.id} style={{
                position: 'relative',
                background: plan.highlight ? t.primarySoft : t.bgDeep,
                border: `2px solid ${plan.highlight ? t.primary : t.border}`,
                borderRadius: 12,
                padding: 16,
                transition: 'all 0.15s',
              }}>
                {plan.highlight && (
                  <div style={{
                    position: 'absolute', top: -10, right: 12,
                    background: t.primary, color: '#fff',
                    padding: '3px 10px', borderRadius: 12,
                    fontSize: 10, fontWeight: 700,
                    boxShadow: '0 2px 6px rgba(184, 134, 11, 0.3)',
                  }}>⭐ 推荐</div>
                )}
                {isCurrent && (
                  <div style={{
                    position: 'absolute', top: 8, left: 8,
                    background: 'rgba(45, 125, 50, 0.15)', color: '##b8860b',
                    padding: '2px 8px', borderRadius: 8,
                    fontSize: 10, fontWeight: 700,
                  }}>当前</div>
                )}

                {/* 头部 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <span style={{ fontSize: 22 }}>{plan.emoji}</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: t.text }}>
                    {plan.name}
                  </span>
                </div>

                {/* 价格 */}
                <div style={{ marginBottom: 12 }}>
                  <span style={{ fontSize: 28, fontWeight: 800, color: plan.highlight ? t.primary : t.text }}>
                    {plan.price === 0 ? '免费' : `¥${plan.price}`}
                  </span>
                  {plan.price > 0 && (
                    <span style={{ fontSize: 13, color: t.textMuted, marginLeft: 4 }}>
                      /月
                    </span>
                  )}
                </div>

                {/* 功能列表 */}
                <ul style={{
                  listStyle: 'none', padding: 0, margin: '0 0 14px',
                  fontSize: 12, color: t.text, lineHeight: 1.7,
                }}>
                  {plan.features.map((f, i) => (
                    <li key={i} style={{ marginBottom: 2 }}>{f}</li>
                  ))}
                </ul>

                {/* CTA 按钮 */}
                <button
                  onClick={() => handleSelect(plan.id)}
                  disabled={busy || isCurrent}
                  style={{
                    width: '100%', padding: '10px 12px',
                    background: isCurrent ? 'rgba(45, 125, 50, 0.1)' :
                                plan.highlight ? t.primary : t.bgCard,
                    color: isCurrent ? '##b8860b' :
                           plan.highlight ? '#fff' : t.text,
                    border: `1px solid ${
                      isCurrent ? '##b8860b' :
                      plan.highlight ? t.primary : t.border
                    }`,
                    borderRadius: 8,
                    fontSize: 13, fontWeight: 700,
                    cursor: isCurrent ? 'default' : 'pointer',
                    transition: 'all 0.15s',
                    opacity: busy && isSelected ? 0.6 : 1,
                  }}
                >
                  {isCurrent ? '✓ 当前套餐' : plan.ctaText}
                </button>
              </div>
            )
          })}
        </div>

        {/* 信任元素 */}
        <div style={{
          padding: '16px 24px 20px',
          borderTop: `1px solid ${t.border}`,
          display: 'flex', flexWrap: 'wrap',
          justifyContent: 'space-around', gap: 8,
          fontSize: 11, color: t.textMuted,
        }}>
          <span>🔒 数据安全</span>
          <span>💰 30 天试用</span>
          <span>↩️ 随时退订</span>
          <span>📥 数据导出</span>
        </div>
      </div>
    </div>
  )
}

// ==============================================
// 极简版：内嵌到 BookingSection 顶部的"升级 banner"
// ==============================================
export function UpgradeBanner({ currentPlan = 'free', onClick, t = DEFAULT_T }: {
  currentPlan?: 'free' | 'smart'
  onClick: () => void
  t?: any
}) {
  if (currentPlan === 'smart') return null
  return (
    <div
      onClick={onClick}
      style={{
        margin: '0 0 16px',
        padding: '10px 14px',
        background: 'linear-gradient(135deg, rgba(184, 134, 11, 0.12), rgba(184, 134, 11, 0.04))',
        border: `1px dashed ${t.primary}`,
        borderRadius: 10,
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 8,
        transition: 'all 0.15s',
      }}>
      <span style={{ fontSize: 12, color: t.text }}>
        💎 <b>智能版 ¥99/月</b> — AI 自动分配 + 客户回访 + 数据分析
      </span>
      <span style={{
        fontSize: 11, fontWeight: 700, color: t.primary,
        padding: '3px 10px', background: t.primarySoft, borderRadius: 12,
      }}>
        升级 →
      </span>
    </div>
  )
}