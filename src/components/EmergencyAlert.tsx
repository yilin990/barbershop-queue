'use client'

/**
 * EmergencyAlert - 紧急症状关键词浮条（奕霖 2026-07-06 13:37 决定）
 *
 * v2.2（奕霖 2026-07-20 16:28 反馈重审）：
 * - 前后端关键词统一用共享模块 @/lib/emergency-keywords（之前前端内嵌 30+ 词、后端 10 词，
 *   导致 "持续高烧" 触发前端弹窗但后端 isEmergency=0，老板后台看不见用户真实急救需求）
 * - 加真拨号按钮 <a href="tel:120">（之前 tel:120 是 span 文字，用户看不到会主动拨号）
 * - 加 dismiss 按钮（×，v2.1）：用户主动关闭
 *
 * 关键词覆盖：胸痛/胸闷/呼吸困难/咳血/晕倒/失去意识/严重过敏/中毒/自杀等
 */

import { useState, useEffect, useRef } from 'react'
import {
  detectEmergencyKeyword,
  EMERGENCY_KEYWORDS as SHARED_KEYWORDS,
} from '@/lib/emergency-keywords'

interface EmergencyAlertProps {
  /** ⭐ v2.1: 最后一条「已发送」的用户消息（不再是实时输入态）*/
  lastUserMessage?: string
  /** 检测到紧急关键词时的回调（用于后端审计日志） */
  onEmergencyDetected?: (keyword: string, source: 'user') => void
}

/**
 * 顶部红色浮条
 * ⭐ v2.1: 检测「已发送的用户消息」+「AI 回复」中的紧急关键词
 * - 加 dismiss 按钮（×）：用户主动关闭
 * - 新一轮对话（新 lastUserMessage）时自动重置 dismissed
 *
 * ⭐ v2.2: 关键词源切换为共享模块（前后端同源，老板后台可见）
 */
export default function EmergencyAlert({
  lastUserMessage,
  onEmergencyDetected,
}: EmergencyAlertProps) {
  const [triggered, setTriggered] = useState<string | null>(null)
  const [triggerSource, setTriggerSource] = useState<'user' | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const lastCheckedRef = useRef({ user: '' })

  useEffect(() => {
    // ⭐ v2.1：检测已发送的用户消息
    // ⭐ v6.9 回退（奕霖 2026-07-31 23:29 反馈）：
    // 取消 AI 回复检测 — AI 解释时也会用到紧急关键词（如"胸痛可能是..."），
    // 用户分不清是 AI 说的还是自己说的状态。现在只检测用户消息。
    if (lastUserMessage && lastUserMessage !== lastCheckedRef.current.user) {
      lastCheckedRef.current.user = lastUserMessage
      const kw = detectEmergencyKeyword(lastUserMessage)
      if (kw) {
        setTriggered(kw)
        setTriggerSource('user')
        setDismissed(false) // ⭐ 新一轮紧急内容触发时，自动重置 dismissed
        onEmergencyDetected?.(kw, 'user')
      }
    }
  }, [lastUserMessage, onEmergencyDetected])

  if (!triggered || dismissed) return null

  return (
    <div
      role="alert"
      style={{
        background: 'linear-gradient(135deg, rgba(220, 38, 38, 0.95) 0%, rgba(185, 28, 28, 0.95) 100%)',
        border: '1px solid rgba(255, 99, 99, 0.5)',
        borderRadius: 10,
        padding: '12px 14px',
        margin: '0 10px 10px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        boxShadow: '0 4px 16px rgba(220, 38, 38, 0.35)',
        animation: 'emergPulse 2s ease-in-out infinite',
        flexShrink: 0,
        position: 'relative',
      }}
    >
      <style>{`
        @keyframes emergPulse {
          0%, 100% { box-shadow: 0 4px 16px rgba(220, 38, 38, 0.35); }
          50% { box-shadow: 0 4px 24px rgba(220, 38, 38, 0.6); }
        }
      `}</style>
      <div style={{
        fontSize: 24,
        flexShrink: 0,
        animation: 'emergShake 0.4s ease-in-out',
      }}>🚨</div>
      <style>{`
        @keyframes emergShake {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-12deg); }
          75% { transform: rotate(12deg); }
        }
      `}</style>
      <div style={{ flex: 1, color: '#fff', fontSize: 12.5, lineHeight: 1.55, paddingRight: 28 }}>
        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>
          症状可能严重，请立即就医！
        </div>
        <div style={{ opacity: 0.95 }}>
          您提到「<strong>{triggered}</strong>」{triggerSource === 'user' ? '' : '，AI 已识别'}，
          <strong style={{ fontSize: 14 }}>请立即拨打 120</strong>或前往最近的医院急诊。
        </div>
        {/* ⭐ v2.2: 真一键拨号按钮 — 用户点直接跳转拨号界面
            之前 tel:120 是 span 文字，奕霖指出"用户看不到会主动拨号" */}
        <a
          href="tel:120"
          style={{
            marginTop: 10,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: '#fff',
            color: '#dc2626',
            padding: '10px 16px',
            borderRadius: 8,
            fontWeight: 800,
            fontSize: 14,
            textDecoration: 'none',
            boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
            border: '2px solid rgba(255,255,255,0.85)',
          }}
        >
          📞 立即拨打 120
        </a>
        <div style={{
          marginTop: 8,
          fontSize: 11,
          opacity: 0.9,
        }}>
          🏥 铜仁市急救中心 / 碧江区人民医院 · 急诊 24h
        </div>
      </div>
      {/* ⭐ v2.1: dismiss 按钮（×）— 用户主动关闭，不再永久霸占屏幕 */}
      <button
        onClick={() => setDismissed(true)}
        aria-label="关闭紧急提醒"
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          width: 24,
          height: 24,
          borderRadius: 6,
          border: 'none',
          background: 'rgba(255, 255, 255, 0.18)',
          color: '#fff',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 16,
          fontWeight: 700,
          lineHeight: 1,
          padding: 0,
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => { ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(255, 255, 255, 0.32)' }}
        onMouseLeave={e => { ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(255, 255, 255, 0.18)' }}
      >
        ×
      </button>
    </div>
  )
}

/** 工具函数：导出关键词列表（供后端审计 / 测试用） — v2.2 改用共享模块导出 */
export const EMERGENCY_KEYWORDS_LIST = [...SHARED_KEYWORDS]

/** v2.2: 检测函数走共享模块 — 保留旧签名避免外部 import 破 */
export function detectEmergency(text: string): string | null {
  return detectEmergencyKeyword(text)
}