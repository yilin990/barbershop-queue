'use client'

import { Suspense } from 'react'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function AdminLoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'phone' | 'code'>('phone')
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState('')
  const [devCode, setDevCode] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [merchantInfo, setMerchantInfo] = useState<any>(null)

  // 倒计时
  useEffect(() => {
    if (countdown <= 0) return
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  // 检查是否已登录（防跳登录页）
  useEffect(() => {
    fetch('/api/admin/auth/me')
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          const next = searchParams.get('next') || '/admin'
          router.replace(next)
        }
      })
      .catch(() => {})
  }, [router, searchParams])

  const handleSendCode = async () => {
    setError('')
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      setError('请输入正确的手机号')
      return
    }
    setSending(true)
    try {
      const res = await fetch('/api/admin/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      })
      const data = await res.json()
      if (data.success) {
        setStep('code')
        setCountdown(60)
        if (data.devCode) setDevCode(data.devCode)  // 开发环境直接显示
        if (data.merchant) setMerchantInfo(data.merchant)
      } else {
        setError(data.error || '发送失败')
      }
    } catch (e: any) {
      setError('网络错误：' + (e?.message ?? 'unknown'))
    } finally {
      setSending(false)
    }
  }

  const handleVerify = async () => {
    setError('')
    if (!/^\d{6}$/.test(code)) {
      setError('验证码必须是 6 位数字')
      return
    }
    setVerifying(true)
    try {
      const res = await fetch('/api/admin/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code }),
      })
      const data = await res.json()
      if (data.success) {
        const next = searchParams.get('next') || '/admin'
        router.replace(next)
      } else {
        setError(data.error || '验证码错误')
      }
    } catch (e: any) {
      setError('网络错误：' + (e?.message ?? 'unknown'))
    } finally {
      setVerifying(false)
    }
  }

  const handleResend = () => {
    if (countdown > 0) return
    setCode('')
    setDevCode('')
    handleSendCode()
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #2c1810 0%, #3d2817 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      <div style={{
        background: 'rgba(255,255,255,0.04)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(201, 169, 97, 0.2)',
        borderRadius: 24,
        padding: '40px 32px',
        width: '100%',
        maxWidth: 420,
        boxShadow: '0 24px 60px rgba(0,0,0,0.4)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            fontSize: 48,
            marginBottom: 8,
          }}>🌿</div>
          <h1 style={{
            color: '#C9A961',
            fontSize: 24,
            fontWeight: 700,
            margin: '0 0 8px 0',
          }}>理发店管理后台</h1>
          <p style={{
            color: 'rgba(255,255,255,0.5)',
            fontSize: 13,
            margin: 0,
          }}>管理员登录</p>
        </div>

        {merchantInfo && (
          <div style={{
            background: 'rgba(184, 134, 11, 0.1)',
            border: '1px solid rgba(184, 134, 11, 0.3)',
            borderRadius: 12,
            padding: 12,
            marginBottom: 16,
            fontSize: 13,
            color: '#b8860b',
            textAlign: 'center',
          }}>
            ✓ 验证身份：<b>{merchantInfo.name}</b>
            <span style={{ opacity: 0.6, marginLeft: 6 }}>({merchantInfo.role})</span>
          </div>
        )}

        {/* Step 1: Phone */}
        {step === 'phone' && (
          <>
            <label style={{
              display: 'block',
              color: 'rgba(255,255,255,0.7)',
              fontSize: 13,
              marginBottom: 8,
              fontWeight: 500,
            }}>
              管理员手机号
            </label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
              onKeyDown={e => e.key === 'Enter' && handleSendCode()}
              placeholder="13800138000"
              autoFocus
              maxLength={11}
              style={{
                width: '100%',
                padding: '14px 16px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 12,
                color: '#fff',
                fontSize: 16,
                marginBottom: 16,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <button
              onClick={handleSendCode}
              disabled={sending || phone.length !== 11}
              style={{
                width: '100%',
                padding: '14px',
                background: sending || phone.length !== 11
                  ? 'rgba(201, 169, 97, 0.3)'
                  : 'linear-gradient(135deg, #C9A961, #a88a45)',
                color: '#2c1810',
                border: 'none',
                borderRadius: 12,
                fontSize: 16,
                fontWeight: 600,
                cursor: sending || phone.length !== 11 ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {sending ? '发送中...' : '获取验证码'}
            </button>
          </>
        )}

        {/* Step 2: Code */}
        {step === 'code' && (
          <>
            <div style={{
              color: 'rgba(255,255,255,0.6)',
              fontSize: 13,
              marginBottom: 16,
              textAlign: 'center',
            }}>
              验证码已发送到 <b style={{ color: '#C9A961' }}>{phone}</b>
            </div>
            <label style={{
              display: 'block',
              color: 'rgba(255,255,255,0.7)',
              fontSize: 13,
              marginBottom: 8,
              fontWeight: 500,
            }}>
              6 位验证码
            </label>
            <input
              type="text"
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={e => e.key === 'Enter' && handleVerify()}
              placeholder="123456"
              autoFocus
              maxLength={6}
              style={{
                width: '100%',
                padding: '14px 16px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 12,
                color: '#fff',
                fontSize: 24,
                letterSpacing: 8,
                textAlign: 'center',
                marginBottom: 12,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            {devCode && (
              <div style={{
                background: 'rgba(245, 158, 11, 0.15)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: 8,
                padding: '8px 12px',
                marginBottom: 16,
                fontSize: 12,
                color: '#b8860b',
                textAlign: 'center',
              }}>
                🛠️ 开发模式验证码：<b style={{ fontFamily: 'monospace' }}>{devCode}</b>
              </div>
            )}
            <button
              onClick={handleVerify}
              disabled={verifying || code.length !== 6}
              style={{
                width: '100%',
                padding: '14px',
                background: verifying || code.length !== 6
                  ? 'rgba(184, 134, 11, 0.3)'
                  : 'linear-gradient(135deg, #b8860b, #a88a45)',
                color: '#2c1810',
                border: 'none',
                borderRadius: 12,
                fontSize: 16,
                fontWeight: 600,
                cursor: verifying || code.length !== 6 ? 'not-allowed' : 'pointer',
                marginBottom: 12,
              }}
            >
              {verifying ? '验证中...' : '登录'}
            </button>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 13,
            }}>
              <button
                onClick={() => { setStep('phone'); setCode(''); setDevCode(''); setError(''); }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'rgba(255,255,255,0.5)',
                  cursor: 'pointer',
                  padding: 4,
                }}
              >
                ← 改手机号
              </button>
              <button
                onClick={handleResend}
                disabled={countdown > 0}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: countdown > 0 ? 'rgba(255,255,255,0.3)' : '#b8860b',
                  cursor: countdown > 0 ? 'not-allowed' : 'pointer',
                  padding: 4,
                }}
              >
                {countdown > 0 ? `${countdown}s 后重发` : '重新发送'}
              </button>
            </div>
          </>
        )}

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 8,
            padding: 12,
            marginTop: 16,
            fontSize: 13,
            color: '#fca5a5',
            textAlign: 'center',
          }}>
            {error}
          </div>
        )}

        <div style={{
          marginTop: 24,
          paddingTop: 16,
          borderTop: '1px solid rgba(255,255,255,0.06)',
          textAlign: 'center',
          fontSize: 11,
          color: 'rgba(255,255,255,0.3)',
        }}>
          🌿 造型师助手 · 商家管理系统
        </div>
      </div>
    </div>
  )
}


export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, color: '#fff' }}>登录中...</div>}>
      <AdminLoginContent />
    </Suspense>
  )
}
