'use client'

/**
 * VoiceProcessingIndicator - 语音识别中倒计时指示器 (v1.0)
 *
 * v6.0 后端走 MediaRecorder + whisper (本地 CPU 慢), 用户有 5-10s 等待感
 * 这个组件显示 "正在识别... 5s" 倒计时, 让用户心理有预期
 *
 * 触发: voice.state === 'processing' 时显示
 * 位置: VoiceInput 上方小气泡旁边
 * 内部: useEffect + setInterval(1000) 每秒更新
 *
 * 设计:
 * - 渐变绿色背景 (跟录音中红色对应)
 * - 跳动的 spinner (CSS 动画)
 * - 实时倒计时 ("⏳ 正在识别... 5s")
 * - 30s 兜底 (避免永远显示)
 */
import { useEffect, useState } from 'react'

interface VoiceProcessingIndicatorProps {
  visible: boolean
  maxSeconds?: number
}

export default function VoiceProcessingIndicator({
  visible,
  maxSeconds = 30,
}: VoiceProcessingIndicatorProps) {
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    if (!visible) {
      setSeconds(0)
      return
    }
    setSeconds(0)
    const t = setInterval(() => {
      setSeconds(s => {
        const next = s + 1
        if (next >= maxSeconds) {
          clearInterval(t)
        }
        return next
      })
    }, 1000)
    return () => clearInterval(t)
  }, [visible, maxSeconds])

  if (!visible) return null

  const isLong = seconds >= 10

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '60px',
        right: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 12px',
        borderRadius: 20,
        background: 'linear-gradient(135deg, rgba(184, 134, 11, 0.18) 0%, rgba(184, 134, 11, 0.08) 100%)',
        border: '1px solid rgba(184, 134, 11, 0.35)',
        color: '#b8860b',
        fontSize: '12px',
        fontWeight: 600,
        zIndex: 10,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        animation: 'voice-processing-fade-in 0.2s ease-out',
      }}
    >
      <span
        style={{
          display: 'inline-block',
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: '#b8860b',
          animation: 'voice-processing-pulse 1.2s ease-in-out infinite',
        }}
      />
      <span>正在识别… {seconds}s</span>
      {isLong && (
        <span style={{ fontSize: '10px', color: 'rgba(184, 134, 11, 0.6)' }}>
          (本地较慢)
        </span>
      )}
    </div>
  )
}
