'use client'

/**
 * VoiceOverlay - 语音录音小气泡提示 (v6.2)
 *
 * v6.2 简化：
 * - 状态机：idle / recording / streaming / processing / too-short
 * - 删 sliding-cancel 状态（v6.2 流式分块不需要滑动取消）
 * - 录音中按钮上方显示小气泡 + 实时识别文字
 */

import type { VoiceRecording } from '@/hooks/useVoiceRecording'

interface VoiceOverlayProps {
  voice: VoiceRecording
}

export default function VoiceOverlay({ voice }: VoiceOverlayProps) {
  const isRecording = voice.state === 'recording'
  const isStreaming = voice.state === 'streaming'

  if (isRecording || isStreaming) {
    return (
      <div
        style={{
          position: 'absolute',
          bottom: 'calc(100% + 10px)',
          left: '50%',
          transform: 'translateX(-50%)',
          pointerEvents: 'none',
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 6,
        }}
      >
        {/* 状态提示气泡 */}
        <div
          style={{
            padding: '6px 14px',
            background: 'rgba(58, 36, 22, 0.95)',
            border: '1px solid rgba(184, 134, 11, 0.3)',
            borderRadius: 14,
            fontSize: 12,
            color: '#b8860b',
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#b8860b',
              animation: 'pulseDot 1s ease-in-out infinite',
            }}
          />
          {isStreaming ? '🎙️ 实时识别中...' : '松开发送 · 点击结束'}
        </div>

        {/* 实时识别文字 */}
        {voice.interimText && (
          <div
            style={{
              padding: '6px 12px',
              background: 'rgba(58, 36, 22, 0.85)',
              border: '1px solid rgba(184, 134, 11, 0.2)',
              borderRadius: 10,
              fontSize: 13,
              color: 'rgba(255, 255, 255, 0.9)',
              maxWidth: 240,
              maxHeight: 80,
              overflow: 'hidden',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }}
          >
            {voice.interimText}
            <span
              style={{
                display: 'inline-block',
                width: 2,
                height: 12,
                background: '#b8860b',
                marginLeft: 2,
                verticalAlign: 'middle',
                animation: 'blinkDot 0.8s ease-in-out infinite',
              }}
            />
          </div>
        )}

        <style>{`
          @keyframes pulseDot {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.4; transform: scale(0.7); }
          }
          @keyframes blinkDot {
            0%, 100% { opacity: 1; }
            50% { opacity: 0; }
          }
        `}</style>
      </div>
    )
  }

  return null
}

/** 太短提示气泡（独立组件） */
export function VoiceTooShortHint({ visible }: { visible: boolean }) {
  if (!visible) return null
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 'calc(100% + 10px)',
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '6px 12px',
        background: 'rgba(255, 80, 80, 0.95)',
        borderRadius: 10,
        fontSize: 12,
        color: '#fff',
        whiteSpace: 'nowrap',
        zIndex: 100,
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        pointerEvents: 'none',
      }}
    >
      ⚠️ 说话时间太短
    </div>
  )
}
