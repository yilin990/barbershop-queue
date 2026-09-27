'use client'

/**
 * ChatStatusBar - 状态栏组件
 *
 * 从 ChatWindow 提取 (Day 3.2, v1.8.1-chatwindow-split)
 *
 * 职责:
 * - 显示 AI 思考/说话状态
 * - 说话时显示 3 个跳动的点
 *
 * Props:
 * - statusText: 状态文本 ("果小蔬正在思考..." / "正在念...")
 * - speaking: 是否正在说话 (TTS 在播放)
 * - loading: 是否在等响应
 */

interface ChatStatusBarProps {
  statusText: string
  speaking: boolean
  loading: boolean
  errorMsg?: string | null
  onRetry?: () => void
}

export default function ChatStatusBar({ statusText, speaking, loading, errorMsg, onRetry }: ChatStatusBarProps) {
  if (!(loading || speaking || errorMsg) || (!errorMsg && !statusText)) return null

  return (
    <div
      style={{
        padding: '6px 12px',
        background: 'rgba(13, 31, 23, 0.8)',
        border: '1px solid rgba(184, 134, 11, 0.15)',
        borderRadius: '10px',
        fontSize: '11px',
        color: '#b8860b',
        marginBottom: '8px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        animation: 'msgSlideIn 0.2s ease-out forwards',
      }}
    >
      <span style={{color: errorMsg ? '#ff6b6b' : 'inherit'}}>{errorMsg || statusText}</span>
      {errorMsg && onRetry && (
        <button
          onClick={onRetry}
          style={{marginLeft: '8px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(255,107,107,0.15)', border: '1px solid rgba(255,107,107,0.4)', color: '#ff6b6b', fontSize: '11px', cursor: 'pointer'}}
        >
          重试
        </button>
      )}
      {speaking && (
        <span style={{ display: 'flex', gap: '3px' }}>
          {[0, 1, 2].map(d => (
            <span
              key={d}
              className="typing-dot"
              style={{
                width: '5px',
                height: '5px',
                background: '#b8860b',
                borderRadius: '50%',
                display: 'inline-block',
              }}
            />
          ))}
        </span>
      )}
    </div>
  )
}
