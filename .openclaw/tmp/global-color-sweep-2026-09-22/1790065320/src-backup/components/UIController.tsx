/**
 * UIController · Toast 队列 + Confirm Modal 统一渲染
 * 挂在 AppLayout 根容器，订阅 ui-bus 全局状态
 */
'use client'

import { useUIBus } from '@/lib/ui-bus'
import { colors } from '@/lib/design-tokens'

// ============================================
// Toast 单条
// ============================================
function ToastItem({ id, type, message }: { id: string; type: 'success' | 'error' | 'warn' | 'info'; message: string }) {
  const dismissToast = useUIBus((s) => s.dismissToast)

  const cfg: Record<typeof type, { bg: string; border: string; icon: string; iconBg: string }> = {
    success: {
      bg: 'linear-gradient(135deg, rgba(184, 134, 11, 0.25) 0%, rgba(52, 200, 123, 0.18) 100%)',
      border: 'rgba(184, 134, 11, 0.45)',
      icon: '✓',
      iconBg: 'linear-gradient(135deg, #b8860b 0%, #34c87b 100%)',
    },
    error: {
      bg: 'linear-gradient(135deg, rgba(239, 68, 68, 0.22) 0%, rgba(220, 38, 38, 0.16) 100%)',
      border: 'rgba(239, 68, 68, 0.45)',
      icon: '✕',
      iconBg: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
    },
    warn: {
      bg: 'linear-gradient(135deg, rgba(245, 158, 11, 0.22) 0%, rgba(217, 119, 6, 0.16) 100%)',
      border: 'rgba(245, 158, 11, 0.45)',
      icon: '!',
      iconBg: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    },
    info: {
      bg: 'linear-gradient(135deg, rgba(167, 139, 250, 0.22) 0%, rgba(139, 92, 246, 0.16) 100%)',
      border: 'rgba(167, 139, 250, 0.45)',
      icon: 'i',
      iconBg: 'linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%)',
    },
  }
  const c = cfg[type]

  return (
    <div
      onClick={() => dismissToast(id)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        minWidth: '220px',
        maxWidth: '420px',
        padding: '12px 16px',
        marginBottom: '10px',
        background: c.bg,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: `1px solid ${c.border}`,
        borderRadius: '14px',
        boxShadow: '0 8px 28px rgba(0, 0, 0, 0.28), 0 2px 8px rgba(184, 134, 11, 0.08)',
        color: '#ffffff',
        fontSize: '14px',
        fontWeight: 500,
        lineHeight: 1.4,
        cursor: 'pointer',
        animation: 'toastSlideIn 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
        fontFamily: "'Noto Sans SC', -apple-system, sans-serif",
      }}
    >
      <div
        style={{
          width: '24px',
          height: '24px',
          borderRadius: '50%',
          background: c.iconBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontWeight: 700,
          fontSize: '13px',
          flexShrink: 0,
          boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
        }}
      >
        {c.icon}
      </div>
      <span style={{ flex: 1, wordBreak: 'break-word' }}>{message}</span>
    </div>
  )
}

// ============================================
// Toast 容器（顶部居中）
// ============================================
export function ToastContainer() {
  const toasts = useUIBus((s) => s.toasts)
  if (toasts.length === 0) return null

  return (
    <>
      <style>{`
        @keyframes toastSlideIn {
          from { opacity: 0; transform: translateY(-12px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
      <div
        style={{
          position: 'fixed',
          top: 'max(20px, env(safe-area-inset-top, 20px))',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          pointerEvents: 'none',
        }}
      >
        {toasts.map((t) => (
          <div key={t.id} style={{ pointerEvents: 'auto' }}>
            <ToastItem id={t.id} type={t.type} message={t.message} />
          </div>
        ))}
      </div>
    </>
  )
}

// ============================================
// Confirm Modal
// ============================================
export function ConfirmDialog() {
  const req = useUIBus((s) => s.confirmReq)
  const resolve = useUIBus((s) => s.resolveConfirm)

  if (!req) return null

  const isDanger = req.tone === 'danger'
  const confirmBg = isDanger
    ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
    : 'linear-gradient(135deg, #b8860b 0%, #34c87b 100%)'
  const confirmShadow = isDanger
    ? '0 4px 16px rgba(239, 68, 68, 0.4)'
    : '0 4px 16px rgba(184, 134, 11, 0.4)'

  return (
    <>
      <style>{`
        @keyframes cdlFade { from {opacity:0} to {opacity:1} }
        @keyframes cdlPop  { from {opacity:0; transform: scale(0.92) translateY(8px)} to {opacity:1; transform: scale(1) translateY(0)} }
      `}</style>
      <div
        onClick={() => resolve(false)}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.55)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          animation: 'cdlFade 0.18s ease-out',
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            background: 'linear-gradient(165deg, #1a3a2a 0%, #152b20 100%)',
            border: '1px solid rgba(184, 134, 11, 0.35)',
            borderRadius: '20px',
            padding: '24px 22px 18px',
            maxWidth: '340px',
            width: '100%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 30px rgba(184, 134, 11,0.1)',
            animation: 'cdlPop 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
            color: '#fff',
            fontFamily: "'Noto Sans SC', -apple-system, sans-serif",
          }}
        >
          {req.title && (
            <div
              style={{
                fontSize: '17px',
                fontWeight: 700,
                marginBottom: '10px',
                color: '#fff',
              }}
            >
              {req.title}
            </div>
          )}
          <div
            style={{
              fontSize: '14.5px',
              lineHeight: 1.55,
              color: 'rgba(255,255,255,0.92)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {req.message}
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '22px' }}>
            <button
              onClick={() => resolve(false)}
              style={{
                flex: 1,
                padding: '11px 0',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.18)',
                borderRadius: '12px',
                color: 'rgba(255,255,255,0.85)',
                fontSize: '15px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              {req.cancelText || '取消'}
            </button>
            <button
              onClick={() => resolve(true)}
              style={{
                flex: 1,
                padding: '11px 0',
                background: confirmBg,
                border: 'none',
                borderRadius: '12px',
                color: isDanger ? '#fff' : '#0a3a1f',
                fontSize: '15px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: confirmShadow,
              }}
            >
              {req.confirmText || '确定'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}