'use client'

interface StopButtonProps {
  visible: boolean
  onStop: () => void
}

/**
 * 打断按钮
 * - AI正在说话时显示在右下角浮动
 * - 点击立刻停止TTS播放 + 中止流式接收
 */
export default function StopButton({ visible, onStop }: StopButtonProps) {
  if (!visible) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 1000,
        animation: 'stopBtnIn 0.2s ease-out forwards',
      }}
    >
      <button
        onClick={onStop}
        title="停止说话"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '10px 18px',
          borderRadius: '24px',
          background: 'linear-gradient(135deg, rgba(255, 80, 80, 0.85) 0%, rgba(220, 50, 50, 0.75) 100%)',
          border: '1px solid rgba(255, 100, 100, 0.5)',
          color: '#fff',
          fontSize: '13px',
          fontWeight: 600,
          cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(255, 60, 60, 0.4), 0 2px 8px rgba(0,0,0,0.3)',
          transition: 'all 0.15s ease',
          letterSpacing: '0.5px',
        }}
        onMouseDown={e => {
          ;(e.target as HTMLButtonElement).style.transform = 'scale(0.95)'
        }}
        onMouseUp={e => {
          ;(e.target as HTMLButtonElement).style.transform = 'scale(1)'
        }}
      >
        <span style={{ fontSize: '16px' }}>🔇</span>
        <span>停止</span>
      </button>
      <style>{`
        @keyframes stopBtnIn {
          from { opacity: 0; transform: translateY(10px) scale(0.9); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  )
}