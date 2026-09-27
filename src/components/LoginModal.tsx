'use client'

import { useState, useRef, useEffect } from 'react'
import { useUserStore } from '@/stores/userStore'

interface LoginModalProps {
  isOpen: boolean
  onClose: () => void
}

type LoginStep = 'phone' | 'code'

// Format phone as 3-4-4
function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 7) return `${digits.slice(0, 3)} ${digits.slice(3)}`
  return `${digits.slice(0, 3)} ${digits.slice(3, 7)} ${digits.slice(7)}`
}

export default function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const [step, setStep] = useState<LoginStep>('phone')
  const [phone, setPhone] = useState('')
  const [codeDigits, setCodeDigits] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [devCode, setDevCode] = useState<string | null>(null)
  const [countdown, setCountdown] = useState(0)
  const codeInputRefs = useRef<(HTMLInputElement | null)[]>([])
  const login = useUserStore((s) => s.login)
  const isDev = process.env.NODE_ENV !== 'production'

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return
    const timer = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000)
    return () => clearInterval(timer)
  }, [countdown])

  // Focus first code input when entering code step
  useEffect(() => {
    if (step === 'code') {
      setTimeout(() => codeInputRefs.current[0]?.focus(), 100)
    }
  }, [step])

  // ⭐ 奕霖 2026-09-06 22:59 修复: 弹窗打开时锁 body 滚动, 关闭时还原
  useEffect(() => {
    if (!isOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [isOpen])

  const handlePhoneChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 11)
    setPhone(formatPhone(digits))
    setError('')
  }

  const handleSendCode = async () => {
    const rawPhone = phone.replace(/\D/g, '')
    if (rawPhone.length !== 11) {
      setError('请输入正确的11位手机号')
      return
    }

    setSending(true)
    setError('')
    try {
      const res = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: rawPhone }),
      })
      const data = await res.json()
      if (!data.success) {
        setError(data.error || '发送失败')
        return
      }
      // In dev mode, store the returned code for display
      if (isDev && data.devCode) {
        setDevCode(data.devCode)
      }
      setStep('code')
      setCountdown(60)
    } catch {
      setError('网络错误，请重试')
    } finally {
      setSending(false)
    }
  }

  const handleCodeChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1)
    const newDigits = [...codeDigits]
    newDigits[index] = digit
    setCodeDigits(newDigits)
    setError('')

    // Auto-advance to next input
    if (digit && index < 5) {
      codeInputRefs.current[index + 1]?.focus()
    }

    // Auto-submit when all 6 digits entered
    if (digit && index === 5) {
      const code = newDigits.join('')
      if (code.length === 6) {
        verifyCode(rawPhone, code)
      }
    }
  }

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !codeDigits[index] && index > 0) {
      codeInputRefs.current[index - 1]?.focus()
    }
  }

  const handleCodePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length !== 6) return
    const newDigits = pasted.split('')
    setCodeDigits(newDigits)
    // Auto-submit
    setTimeout(() => verifyCode(phone.replace(/\D/g, ''), pasted), 100)
  }

  const verifyCode = async (rawPhone: string, code: string) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: rawPhone, code }),
      })
      const data = await res.json()
      if (!data.success) {
        setError(data.error || '验证失败')
        return
      }
      const user = {
        id: data.user.id,
        phone: data.user.phone,
        nickname: data.user.nickname,
        avatar: data.user.avatar,
        role: data.user.role,
        points: data.user.points,
        createdAt: data.user.createdAt,
      }
      login(user, data.token)
      onClose()
      // Reset state for next open
      setTimeout(() => {
        setStep('phone')
        setPhone('')
        setCodeDigits(['', '', '', '', '', ''])
        setDevCode(null)
        setError('')
        setCountdown(0)
      }, 300)
    } catch {
      setError('网络错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = () => {
    if (countdown > 0) return
    setStep('phone')
    setCodeDigits(['', '', '', '', '', ''])
    setDevCode(null)
  }

  const handleBack = () => {
    setStep('phone')
    setCodeDigits(['', '', '', '', '', ''])
    setDevCode(null)
    setError('')
  }

  const rawPhone = phone.replace(/\D/g, '')

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: '16px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          position: 'relative',
          width: 'calc(100% - 32px)',
          maxWidth: '480px',
          maxHeight: 'calc(100vh - 100px - env(safe-area-inset-bottom, 0px))',
          background: 'linear-gradient(180deg, #2c1810 0%, #1a0e08 50%, #2c1810 100%)',
          borderRadius: '20px',
          padding: '0 0 20px',
          border: '1px solid rgba(184, 134, 11, 0.15)',
          boxShadow: '0 8px 40px rgba(0, 0, 0, 0.5)',
          overflow: 'auto',
          overscrollBehavior: 'contain',
        }}
      >
        {/* Handle bar */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 0' }}>
          <div style={{ width: '36px', height: '4px', background: 'rgba(184, 134, 11, 0.3)', borderRadius: '2px' }} />
        </div>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px 0' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#fff', letterSpacing: '1px' }}>
              {step === 'phone' ? '登录果蔬鲜生' : '输入验证码'}
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'rgba(184, 134, 11, 0.7)', letterSpacing: '0.5px' }}>
              {step === 'phone' ? '登录后即可评论、反馈、分享故事' : `验证码已发送至 ${phone}`}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: '32px', height: '32px', borderRadius: '50%',
              background: 'rgba(184, 134, 11, 0.1)',
              border: '1px solid rgba(184, 134, 11, 0.2)',
              color: 'rgba(184, 134, 11, 0.8)',
              fontSize: '16px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: '24px 24px 0' }}>
          {step === 'phone' ? (
            /* ===== PHONE STEP ===== */
            <div>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
                  color: 'rgba(184, 134, 11, 0.6)', fontSize: '16px', pointerEvents: 'none',
                }}>
                  +86
                </span>
                <input
                  type="tel"
                  placeholder="请输入手机号"
                  value={phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  inputMode="numeric"
                  style={{
                    width: '100%',
                    padding: '14px 16px 14px 52px',
                    borderRadius: '14px',
                    border: `1px solid ${error && rawPhone.length < 11 ? 'rgba(255, 80, 80, 0.5)' : 'rgba(184, 134, 11, 0.2)'}`,
                    background: 'rgba(184, 134, 11, 0.08)',
                    color: '#fff',
                    fontSize: '17px',
                    outline: 'none',
                    boxSizing: 'border-box',
                    letterSpacing: '2px',
                    fontFamily: 'monospace',
                  }}
                />
              </div>

              {error && (
                <div style={{
                  marginTop: '10px', padding: '10px 14px', borderRadius: '10px',
                  background: 'rgba(255, 80, 80, 0.1)', border: '1px solid rgba(255, 80, 80, 0.3)',
                  color: '#ff6b6b', fontSize: '13px',
                }}>
                  {error}
                </div>
              )}

              <button
                onClick={handleSendCode}
                disabled={sending || rawPhone.length !== 11}
                style={{
                  width: '100%', marginTop: '16px', padding: '16px',
                  borderRadius: '14px', border: 'none',
                  background: sending || rawPhone.length !== 11
                    ? 'rgba(184, 134, 11, 0.3)'
                    : 'linear-gradient(135deg, #b8860b 0%, #b8860b 100%)',
                  color: '#2c1810', fontSize: '16px', fontWeight: 700,
                  cursor: sending || rawPhone.length !== 11 ? 'not-allowed' : 'pointer',
                  letterSpacing: '2px',
                  boxShadow: sending ? 'none' : '0 6px 24px rgba(184, 134, 11, 0.35)',
                  transition: 'all 0.3s ease',
                }}
              >
                {sending ? '发送中...' : '获取验证码'}
              </button>

              {/* Wechat placeholder */}
              <div style={{
                marginTop: '20px', textAlign: 'center', padding: '16px',
                borderRadius: '14px', border: '1px dashed rgba(184, 134, 11, 0.15)',
                background: 'rgba(184, 134, 11, 0.03)',
              }}>
                <div style={{ fontSize: '28px', marginBottom: '6px' }}>💬</div>
                <p style={{ margin: 0, fontSize: '12px', color: 'rgba(184, 134, 11, 0.5)' }}>
                  微信登录即将上线，敬请期待
                </p>
              </div>
            </div>
          ) : (
            /* ===== CODE STEP ===== */
            <div>
              {/* 6-digit code inputs */}
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }} onPaste={handleCodePaste}>
                {codeDigits.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { codeInputRefs.current[i] = el }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleCodeChange(i, e.target.value)}
                    onKeyDown={(e) => handleCodeKeyDown(i, e)}
                    disabled={loading}
                    style={{
                      width: '46px',
                      height: '54px',
                      textAlign: 'center',
                      borderRadius: '12px',
                      border: `1px solid ${error ? 'rgba(255, 80, 80, 0.5)' : digit ? 'rgba(184, 134, 11, 0.4)' : 'rgba(184, 134, 11, 0.2)'}`,
                      background: digit
                        ? 'rgba(184, 134, 11, 0.15)'
                        : 'rgba(184, 134, 11, 0.08)',
                      color: '#fff',
                      fontSize: '22px',
                      fontWeight: 700,
                      fontFamily: 'monospace',
                      outline: 'none',
                      caretColor: '#b8860b',
                      transition: 'all 0.15s ease',
                    }}
                  />
                ))}
              </div>

              {/* Dev mode: show returned code */}
              {isDev && devCode && (
                <div style={{
                  marginTop: '12px', padding: '10px 14px', borderRadius: '10px',
                  background: 'rgba(184, 134, 11, 0.08)',
                  border: '1px solid rgba(184, 134, 11, 0.2)',
                  color: '#b8860b', fontSize: '12px', textAlign: 'center',
                  fontFamily: 'monospace',
                }}>
                  📱 开发模式验证码：{devCode}
                </div>
              )}

              {error && (
                <div style={{
                  marginTop: '12px', padding: '10px 14px', borderRadius: '10px',
                  background: 'rgba(255, 80, 80, 0.1)', border: '1px solid rgba(255, 80, 80, 0.3)',
                  color: '#ff6b6b', fontSize: '13px',
                }}>
                  {error}
                </div>
              )}

              {/* Loading overlay */}
              {loading && (
                <div style={{
                  marginTop: '12px', textAlign: 'center',
                  color: 'rgba(184, 134, 11, 0.7)', fontSize: '14px',
                }}>
                  登录中...
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
                <button
                  onClick={handleBack}
                  disabled={loading}
                  style={{
                    padding: '10px 16px', borderRadius: '10px',
                    border: '1px solid rgba(184, 134, 11, 0.2)',
                    background: 'rgba(184, 134, 11, 0.05)',
                    color: 'rgba(184, 134, 11, 0.7)', fontSize: '13px', cursor: 'pointer',
                  }}
                >
                  ← 返回
                </button>
                <button
                  onClick={handleResend}
                  disabled={countdown > 0 || loading}
                  style={{
                    padding: '10px 16px', borderRadius: '10px',
                    border: 'none',
                    background: countdown > 0 ? 'rgba(184, 134, 11, 0.08)' : 'rgba(184, 134, 11, 0.15)',
                    color: countdown > 0 ? 'rgba(184, 134, 11, 0.4)' : '#b8860b',
                    fontSize: '13px', cursor: countdown > 0 ? 'not-allowed' : 'pointer',
                    fontWeight: 600,
                  }}
                >
                  {countdown > 0 ? `${countdown}s后重发` : '重新获取'}
                </button>
              </div>
            </div>
          )}

          <p style={{
            textAlign: 'center', fontSize: '11px',
            color: 'rgba(184, 134, 11, 0.4)', marginTop: '20px', letterSpacing: '0.3px',
          }}>
            登录即表示同意《果蔬鲜生用户协议》与《隐私政策》
          </p>
        </div>
      </div>
    </div>
  )
}