'use client'

/**
 * AIRiskHint - AI 功能风险提示（奕霖 2026-07-06 13:37 决定）
 *
 * 触发条件：
 * - 首次进入 /pharmacist 或 /chat（带 AI 对话页）
 * - 上次展示时间 > 24h
 *
 * 关闭后：记录到 complianceStore.aiRiskHintAt
 * 不是强约束，是温和提醒（不勾选也能继续）
 */

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useComplianceStore, shouldShowAiHint, shouldShowAgreement } from '@/stores/complianceStore'

export default function AIRiskHint() {
  const { aiRiskHintAt, agreedAt, agreedVersion, markAiHintShown } = useComplianceStore()
  const [mounted, setMounted] = useState(false)
  const [show, setShow] = useState(false)

  useEffect(() => {
    setMounted(true)
    // ⭐ 奕霖 2026-07-06 13:37：未同意协议时禁止弹 AIRiskHint（避免遮罩冲突）
    if (shouldShowAgreement(agreedAt, agreedVersion)) {
      return  // 协议未确认，不弹 AIRiskHint
    }
    if (shouldShowAiHint(aiRiskHintAt)) {
      const t = setTimeout(() => setShow(true), 1200)
      return () => clearTimeout(t)
    }
  }, [aiRiskHintAt, agreedAt, agreedVersion])

  if (!mounted || !show) return null

  function handleClose() {
    markAiHintShown()
    setShow(false)
  }

  // ⭐ 奕霖 2026-07-06 14:07：Portal 渲染到 body，避免被遮挡
  const modal =
    <div
      role="alertdialog"
      aria-labelledby="ai-risk-title"
      onClick={handleClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99998,
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 380,
          background: 'linear-gradient(180deg, #142420 0%, #0d1f17 100%)',
          border: '1px solid rgba(251, 191, 36, 0.4)',
          borderRadius: 16,
          padding: 24,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div style={{
            width: 56, height: 56, margin: '0 auto 12px',
            borderRadius: '50%',
            background: 'rgba(251, 191, 36, 0.15)',
            border: '1px solid rgba(251, 191, 36, 0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28,
          }}>⚠️</div>
          <h2 id="ai-risk-title" style={{
            fontSize: 17, fontWeight: 700, color: '#b8860b', margin: 0,
          }}>
            AI 发型顾问使用须知
          </h2>
        </div>

        <div style={{
          background: 'rgba(255, 255, 255, 0.04)',
          borderRadius: 10,
          padding: '12px 14px',
          marginBottom: 16,
          fontSize: 13,
          lineHeight: 1.7,
          color: 'rgba(255, 255, 255, 0.85)',
        }}>
          <div style={{ marginBottom: 8 }}>
            🤖 造型助手是<strong>发型顾问</strong>，不是造型师、不是医生
          </div>
          <div style={{ marginBottom: 8 }}>
            🥗 造型建议<strong>仅供参考</strong>，不替代造型师或医生专业建议
          </div>
          <div style={{ marginBottom: 8 }}>
            🚨 急症（食物中毒/严重过敏/突发不适等）请<strong style={{ color: '#f87171' }}>立即拨打 120</strong>
          </div>
          <div>
            👶 儿童/老人/孕妇/慢病人群请咨询专业造型师或医生
          </div>
        </div>

        <button
          onClick={handleClose}
          autoFocus
          style={{
            width: '100%',
            padding: '12px 16px',
            fontSize: 14,
            fontWeight: 700,
            color: '#0a3018',
            background: 'linear-gradient(135deg, #b8860b 0%, #5cb85c 100%)',
            border: 'none',
            borderRadius: 10,
            cursor: 'pointer',
            letterSpacing: 0.5,
            boxShadow: '0 4px 12px rgba(184, 134, 11, 0.3)',
          }}
        >
          我已知晓，继续咨询
        </button>

        <div style={{
          textAlign: 'center',
          fontSize: 11,
          color: 'rgba(255, 255, 255, 0.4)',
          marginTop: 12,
        }}>
          24 小时内不再提示
        </div>
      </div>
    </div>

  if (typeof document === 'undefined') return null
  return createPortal(modal, document.body)
}