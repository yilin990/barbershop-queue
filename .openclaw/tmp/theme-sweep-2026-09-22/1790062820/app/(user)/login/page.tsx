'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUserStore } from '@/stores/userStore'

export default function LoginPage() {
  const [step, setStep] = useState<'phone' | 'code'>('phone')
  const [phone, setPhone] = useState('')
  const [codeDigits, setCodeDigits] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [devCode, setDevCode] = useState<string | null>(null)
  const [countdown, setCountdown] = useState(0)
  const codeInputRefs = useRef<(HTMLInputElement | null)[]>([])
  const { login, isLoggedIn } = useUserStore()
  const router = useRouter()
  // ⭐ 奕霖 2026-07-03：开发者模式 (有 SHOW_DEV_CODE env 或 dev 模式) 才显示验证码
// 后端同时配合：/api/auth/send-code 只有 SHOW_DEV_CODE=true 才返回 devCode
const isDev =
  process.env.NODE_ENV !== 'production' ||
  process.env.NEXT_PUBLIC_SHOW_DEV_CODE === 'true'

  useEffect(() => {
    if (countdown <= 0) return
    const timer = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000)
    return () => clearInterval(timer)
  }, [countdown])

  useEffect(() => {
    if (step === 'code') {
      setTimeout(() => codeInputRefs.current[0]?.focus(), 100)
    }
  }, [step])

  // ⭐ 清禾 2026-09-05 一键登录：本机已记住则 silent 登录
  useEffect(() => {
    if (isLoggedIn) {
      router.push('/merchant')
      return
    }
    // 读 document.cookie 找 zhilin-trust（httpOnly=false 不行,所以读不到 — 走 fallback 流程）
    // 注意:zhilin-trust 是 httpOnly=true,JS 读不到 → 这里用 document.cookie 看不到
    // → 服务端要在 /login 页面 SSR 时判断 trust cookie,直接 redirect
    // 但前端没法做这个判断,所以我们改成:前端尝试调 quick-login,服务端读 cookie 决定
    setLoading(true)
    fetch('/api/auth/quick-login', { method: 'POST' })
      .then(r => r.json())
      .then(data => {
        if (data.success && data.token && data.user) {
          login({
            id: data.user.id,
            phone: data.user.phone,
            nickname: data.user.nickname,
            avatar: data.user.avatar,
            role: data.user.role,
            points: data.user.points,
            createdAt: data.user.createdAt,
            lastLoginAt: data.user.lastLoginAt,
            token: data.token,
          }, data.token)
          router.push('/merchant')
        } else {
          // 本机未记住 / 设备变了 → 显示登录表单
          setLoading(false)
        }
      })
      .catch(() => setLoading(false))
  }, [isLoggedIn, router, login])

  const handlePhoneChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 11)
    setPhone(formatPhone(digits))
    setError('')
  }

  const formatPhone = (raw: string) => {
    if (raw.length <= 3) return raw
    if (raw.length <= 7) return `${raw.slice(0, 3)} ${raw.slice(3)}`
    return `${raw.slice(0, 3)} ${raw.slice(3, 7)} ${raw.slice(7)}`
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
      if (isDev && data.devCode) setDevCode(data.devCode)
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
    if (digit && index < 5) codeInputRefs.current[index + 1]?.focus()
    if (digit && index === 5) {
      const code = newDigits.join('')
      if (code.length === 6) verifyCode(rawPhone, code)
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
    setTimeout(() => verifyCode(rawPhone, pasted), 100)
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
      login({
        id: data.user.id,
        phone: data.user.phone,
        nickname: data.user.nickname,
        avatar: data.user.avatar,
        role: data.user.role,
        points: data.user.points,
        createdAt: data.user.createdAt,
        lastLoginAt: data.user.lastLoginAt,
        token: data.token,
      }, data.token)
      router.push('/merchant')
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

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'linear-gradient(175deg, #0d1f17 0%, #152b20 40%, #1a3a2a 70%, #1f4432 100%)',
      fontFamily: "'Noto Sans SC', -apple-system, sans-serif",
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
    }}>
      {/* Ambient glow */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: '500px', height: '500px',
        background: 'radial-gradient(circle, rgba(45, 90, 61, 0.15) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ width: '100%', maxWidth: '380px', position: 'relative', zIndex: 1 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{
            width: '72px', height: '72px',
            borderRadius: '18px',
            background: 'linear-gradient(135deg, rgba(127, 220, 148, 0.2) 0%, rgba(127, 220, 148, 0.06) 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '36px', margin: '0 auto 16px',
            border: '2px solid rgba(127, 220, 148, 0.2)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          }}>
            🍵
          </div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#fff', letterSpacing: '3px' }}>
            果蔬鲜生
          </h1>
          <p style={{ margin: '8px 0 0', fontSize: '13px', color: 'rgba(127, 220, 148, 0.6)', letterSpacing: '1px' }}>
            {step === 'phone' ? '登录后享受更多服务' : '请输入验证码'}
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: 'linear-gradient(180deg, rgba(35, 74, 53, 0.6) 0%, rgba(26, 58, 42, 0.8) 100%)',
          borderRadius: '24px', padding: '28px 24px',
          border: '1px solid rgba(127, 220, 148, 0.12)',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)',
        }}>
          {step === 'phone' ? (
            /* ===== PHONE STEP ===== */
            <div>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
                  color: 'rgba(127, 220, 148, 0.6)', fontSize: '16px', pointerEvents: 'none',
                }}>+86</span>
                <input
                  type="tel"
                  placeholder="请输入手机号"
                  value={phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  inputMode="numeric"
                  style={{
                    width: '100%', padding: '14px 16px 14px 52px',
                    borderRadius: '14px',
                    border: `1px solid ${error && rawPhone.length < 11 ? 'rgba(255, 80, 80, 0.5)' : 'rgba(127, 220, 148, 0.2)'}`,
                    background: 'rgba(127, 220, 148, 0.08)',
                    color: '#fff', fontSize: '17px', outline: 'none',
                    boxSizing: 'border-box', letterSpacing: '2px', fontFamily: 'monospace',
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
                    ? 'rgba(127, 220, 148, 0.3)'
                    : 'linear-gradient(135deg, #fbbf24 0%, #5fcc6f 100%)',
                  color: '#0d1f17', fontSize: '16px', fontWeight: 700,
                  cursor: sending || rawPhone.length !== 11 ? 'not-allowed' : 'pointer',
                  letterSpacing: '2px',
                  boxShadow: sending ? 'none' : '0 6px 24px rgba(127, 220, 148, 0.35)',
                  transition: 'all 0.3s ease',
                }}
              >
                {sending ? '发送中...' : '获取验证码'}
              </button>
            </div>
          ) : (
            /* ===== CODE STEP ===== */
            <div>
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
                      width: '46px', height: '54px', textAlign: 'center',
                      borderRadius: '12px',
                      border: `1px solid ${error ? 'rgba(255, 80, 80, 0.5)' : digit ? 'rgba(127, 220, 148, 0.4)' : 'rgba(127, 220, 148, 0.2)'}`,
                      background: digit ? 'rgba(127, 220, 148, 0.15)' : 'rgba(127, 220, 148, 0.08)',
                      color: '#fff', fontSize: '22px', fontWeight: 700, fontFamily: 'monospace',
                      outline: 'none', caretColor: '#fbbf24', transition: 'all 0.15s ease',
                    }}
                  />
                ))}
              </div>

              {isDev && devCode && (
                <div style={{
                  marginTop: '12px', padding: '10px 14px', borderRadius: '10px',
                  background: 'rgba(127, 220, 148, 0.08)',
                  border: '1px solid rgba(127, 220, 148, 0.2)',
                  color: '#fbbf24', fontSize: '12px', textAlign: 'center', fontFamily: 'monospace',
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

              {loading && (
                <div style={{ marginTop: '12px', textAlign: 'center', color: 'rgba(127, 220, 148, 0.7)', fontSize: '14px' }}>
                  登录中...
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
                <button onClick={handleBack} disabled={loading} style={{
                  padding: '10px 16px', borderRadius: '10px',
                  border: '1px solid rgba(127, 220, 148, 0.2)',
                  background: 'rgba(127, 220, 148, 0.05)',
                  color: 'rgba(127, 220, 148, 0.7)', fontSize: '13px', cursor: 'pointer',
                }}>← 返回</button>
                <button onClick={handleResend} disabled={countdown > 0 || loading} style={{
                  padding: '10px 16px', borderRadius: '10px', border: 'none',
                  background: countdown > 0 ? 'rgba(127, 220, 148, 0.08)' : 'rgba(127, 220, 148, 0.15)',
                  color: countdown > 0 ? 'rgba(127, 220, 148, 0.4)' : '#fbbf24',
                  fontSize: '13px', cursor: countdown > 0 ? 'not-allowed' : 'pointer', fontWeight: 600,
                }}>
                  {countdown > 0 ? `${countdown}s后重发` : '重新获取'}
                </button>
              </div>
            </div>
          )}

          <p style={{
            textAlign: 'center', fontSize: '11px',
            color: 'rgba(127, 220, 148, 0.4)', marginTop: '20px', letterSpacing: '0.3px',
          }}>
            登录即表示同意
            <a href="/user-agreement" target="_blank" rel="noopener" style={{ color: 'rgba(127,220,148,0.85)', textDecoration: 'underline', margin: '0 4px' }}>
              《果蔬鲜生用户协议》
            </a>
            与
            <a href="/privacy-policy" target="_blank" rel="noopener" style={{ color: 'rgba(127,220,148,0.85)', textDecoration: 'underline', margin: '0 4px' }}>
              《隐私政策》
            </a>
          </p>
        </div>

        <p style={{ textAlign: 'center', fontSize: '12px', color: 'rgba(127, 220, 148, 0.4)', marginTop: '24px' }}>
          <a href="/merchant" style={{ color: 'rgba(127, 220, 148, 0.6)', textDecoration: 'none' }}>先逛逛 →</a>
        </p>
      </div>
    </div>
  )
}