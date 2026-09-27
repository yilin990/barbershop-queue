'use client'
import { useState } from 'react'

/**
 * 店主 PIN 弹窗
 *
 * ⭐ MEMORY 246 — 奕霖 2026-08-20 17:42 拍板：商品管理后台快捷通道
 * 输对 PIN → 跳 /admin/products 或 /admin/products/[id]
 */

export interface MerchantPinDialogProps {
  open: boolean
  onClose: () => void
  onSuccess: (verifiedAt: number) => void
  onVerify: (pin: string) => boolean
  title?: string
  hint?: string
}

export default function MerchantPinDialog({
  open,
  onClose,
  onSuccess,
  onVerify,
  title = '🔧 店主验证',
  hint = '请输入店主 PIN（默认 1234）',
}: MerchantPinDialogProps) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [shake, setShake] = useState(false)

  if (!open) return null

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (pin.length < 4) {
      setError('PIN 至少 4 位')
      triggerShake()
      return
    }
    const ok = onVerify(pin)
    if (ok) {
      setError('')
      setPin('')
      onSuccess(Date.now())
    } else {
      setError('PIN 不对，再试试')
      triggerShake()
      setPin('')
    }
  }

  const triggerShake = () => {
    setShake(true)
    setTimeout(() => setShake(false), 400)
  }

  const handleClose = () => {
    setPin('')
    setError('')
    onClose()
  }

  return (
    <div
      onClick={handleClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'rgba(20, 25, 30, 0.95)',
          border: '1px solid rgba(127, 220, 148, 0.3)',
          borderRadius: 20,
          padding: '28px 24px',
          width: '100%', maxWidth: 380,
          color: '#fff',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          animation: shake ? 'shake 0.4s' : 'popIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(127,220,148,0.3), rgba(127,220,148,0.1))',
            border: '2px solid rgba(127,220,148,0.5)',
            margin: '0 auto 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28,
          }}>
            🔧
          </div>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{title}</h3>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>{hint}</p>
        </div>

        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={pin}
            onChange={(e) => { setPin(e.target.value.replace(/\D/g, '').slice(0, 8)); setError('') }}
            placeholder="输入 PIN"
            autoFocus
            inputMode="numeric"
            pattern="[0-9]*"
            style={{
              width: '100%', padding: '14px 16px',
              background: 'rgba(0,0,0,0.4)',
              border: `1.5px solid ${error ? '#ff6b6b' : 'rgba(127,220,148,0.4)'}`,
              borderRadius: 12,
              color: '#fff', fontSize: 18,
              textAlign: 'center', letterSpacing: 6,
              outline: 'none',
              boxSizing: 'border-box',
              fontFamily: 'monospace',
              marginTop: 20,
            }}
          />
          {error && (
            <div style={{ color: '#ff6b6b', fontSize: 13, textAlign: 'center', marginTop: 8 }}>
              {error}
            </div>
          )}
          <button
            type="submit"
            style={{
              width: '100%', padding: '14px',
              marginTop: 16,
              background: 'linear-gradient(135deg, #fbbf24, #4a9d65)',
              border: 'none', borderRadius: 12,
              color: '#0a0f0d', fontSize: 15, fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(127,220,148,0.3)',
            }}
          >
            ✓ 验证进入管理后台
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 14, fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
          点空白处关闭 · 输错 3 次不锁定
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-8px); }
          75% { transform: translateX(8px); }
        }
        @keyframes popIn {
          from { transform: scale(0.85); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
