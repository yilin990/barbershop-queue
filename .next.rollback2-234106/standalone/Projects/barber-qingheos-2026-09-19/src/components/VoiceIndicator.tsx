'use client'

import { useEffect, useState } from 'react'

interface VoiceIndicatorProps {
  /** 是否正在说话 */
  speaking: boolean
  /** 说话内容预览（可选） */
  text?: string
  /** 尺寸：small=头像旁 / large=全屏中央 */
  size?: 'small' | 'large'
}

/**
 * 造型助手"正在说话"呼吸光圈
 * - AI正在生成/播放时显示绿色光波扩散动画
 * - small: 头像右下角小圆点
 * - large: 全屏中央大光圈
 */
export default function VoiceIndicator({ speaking, text, size = 'small' }: VoiceIndicatorProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (speaking) {
      setVisible(true)
    } else {
      // 动画结束后再隐藏
      const t = setTimeout(() => setVisible(false), 600)
      return () => clearTimeout(t)
    }
  }, [speaking])

  if (!visible && !speaking) return null

  if (size === 'large') {
    return (
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
          pointerEvents: 'none',
        }}
      >
        {/* 外圈 */}
        <div
          style={{
            position: 'relative',
            width: '120px',
            height: '120px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {[0, 1, 2].map(i => (
            <div
              key={i}
              style={{
                position: 'absolute',
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                border: '2px solid rgba(184, 134, 11, 0.6)',
                animation: speaking ? `voiceGlow${i} 2s ease-out infinite` : 'none',
                animationDelay: `${i * 0.4}s`,
                opacity: speaking ? undefined : 0,
              }}
            />
          ))}
          {/* 中心头像 */}
          <div
            style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(184, 134, 11, 0.4) 0%, rgba(184, 134, 11, 0.2) 100%)',
              border: '2px solid rgba(184, 134, 11, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              boxShadow: '0 0 30px rgba(184, 134, 11, 0.4)',
              zIndex: 1,
            }}
          >
            🍵
          </div>
        </div>
        {/* 文字 */}
        {text && (
          <div
            style={{
              padding: '8px 16px',
              background: 'rgba(13, 31, 23, 0.9)',
              border: '1px solid rgba(184, 134, 11, 0.3)',
              borderRadius: '12px',
              fontSize: '13px',
              color: '#b8860b',
              maxWidth: '280px',
              textAlign: 'center',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            }}
          >
            {text.slice(0, 60)}{text.length > 60 ? '...' : ''}
          </div>
        )}
        <style>{`
          @keyframes voiceGlow0 {
            0% { transform: scale(0.8); opacity: 0.8; }
            100% { transform: scale(2); opacity: 0; }
          }
          @keyframes voiceGlow1 {
            0% { transform: scale(0.8); opacity: 0.6; }
            100% { transform: scale(2.2); opacity: 0; }
          }
          @keyframes voiceGlow2 {
            0% { transform: scale(0.8); opacity: 0.4; }
            100% { transform: scale(2.4); opacity: 0; }
          }
        `}</style>
      </div>
    )
  }

  // small: 头像右下角
  return (
    <div
      style={{
        position: 'relative',
        width: '16px',
        height: '16px',
        flexShrink: 0,
      }}
    >
      {speaking && (
        <>
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              background: 'rgba(184, 134, 11, 0.3)',
              animation: 'voicePulseSmall 1.2s ease-in-out infinite',
            }}
          />
          <style>{`
            @keyframes voicePulseSmall {
              0%, 100% { transform: translate(-50%, -50%) scale(0.8); opacity: 0.8; }
              50% { transform: translate(-50%, -50%) scale(1.5); opacity: 0; }
            }
          `}</style>
        </>
      )}
      {/* 固定小点 */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: speaking ? '#b8860b' : 'transparent',
          boxShadow: speaking ? '0 0 8px rgba(184, 134, 11, 0.8)' : 'none',
          transition: 'background 0.3s ease',
        }}
      />
    </div>
  )
}