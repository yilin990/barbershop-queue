'use client'

/**
 * StaffGate - 店员身份验证门
 *
 * 包裹需要店员权限的页面：
 *   <StaffGate>
 *     <PickupPage />
 *   </StaffGate>
 *
 * 未登录 → 显示 PIN 输入页
 * 已登录 → 直接渲染 children
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { isStaffAuthed, getSessionRemainingMinutes, clearStaffSession } from '@/lib/staff-auth'

const ORANGE = '#ffa500'
const ORANGE_RGBA = '255, 165, 0'

export default function StaffGate({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [authed, setAuthed] = useState<boolean | null>(null) // null = 还在检查
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [remainingMin, setRemainingMin] = useState(0)

  useEffect(() => {
    setAuthed(isStaffAuthed())
    setRemainingMin(getSessionRemainingMinutes())
    // 每分钟刷新一次剩余时间
    const t = setInterval(() => setRemainingMin(getSessionRemainingMinutes()), 60000)
    return () => clearInterval(t)
  }, [])

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!pin) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/auth/staff-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setAuthed(true)
        setRemainingMin(Math.floor((data.expiresIn || 3600) / 60))
        setPin('')
      } else {
        setError(data.error || 'PIN 错误，请联系店长获取')
      }
    } catch (e: any) {
      setError('网络异常，请重试')
    }
    setSubmitting(false)
  }

  const handleLogout = () => {
    clearStaffSession()
    setAuthed(false)
    setPin('')
    setError(null)
  }

  if (authed === null) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)' }}>
        检查中…
      </div>
    )
  }

  if (!authed) {
    return (
      <div style={{
        minHeight: '70vh',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
        position: 'relative',
      }}>
        {/* ⭐ 奕霖 2026-07-07 13:30：未输入 PIN 时也能返回 */}
        <button
          onClick={() => {
            if (typeof window !== 'undefined') {
              if (window.history.length > 1) router.back();
              else router.push('/me');
            }
          }}
          style={{
            position: 'absolute', top: 20, left: 20,
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 12px',
            background: 'rgba(127, 220, 148, 0.1)',
            border: '1px solid rgba(127, 220, 148, 0.3)',
            borderRadius: 10,
            color: 'rgba(127, 220, 148, 0.9)',
            fontSize: 13, fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
            zIndex: 10,
          }}
        >
          ← 返回我的
        </button>
        <div style={{
          maxWidth: 380, width: '100%',
          background: 'linear-gradient(180deg, rgba(35, 74, 53, 0.6) 0%, rgba(26, 58, 42, 0.8) 100%)',
          border: `1px solid rgba(${ORANGE_RGBA}, 0.2)`,
          borderRadius: 20,
          padding: 32,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35)',
          textAlign: 'center',
        }}>
          {/* 锁图标 */}
          <div style={{
            width: 72, height: 72, margin: '0 auto 20px',
            background: `linear-gradient(135deg, rgba(${ORANGE_RGBA}, 0.2), rgba(${ORANGE_RGBA}, 0.05))`,
            borderRadius: 18,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 36,
          }}>🔒</div>

          <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 6 }}>
            店员核销中心
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 24 }}>
            请输入店员 PIN 码进入
          </div>

          <form onSubmit={handleSubmit}>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={pin}
              onChange={(e) => {
                setPin(e.target.value.replace(/\D/g, ''))
                setError(null)
              }}
              placeholder="••••"
              autoFocus
              style={{
                width: '100%',
                padding: '16px',
                borderRadius: 12,
                border: `1.5px solid ${error ? '#ff6b6b' : `rgba(${ORANGE_RGBA}, 0.3)`}`,
                background: 'rgba(0,0,0,0.3)',
                color: ORANGE,
                fontSize: 28,
                fontWeight: 700,
                letterSpacing: 12,
                textAlign: 'center',
                fontFamily: 'monospace',
                outline: 'none',
                marginBottom: 12,
                boxSizing: 'border-box',
              }}
            />

            {error && (
              <div style={{
                padding: '10px 14px',
                borderRadius: 10,
                background: 'rgba(255, 107, 107, 0.1)',
                border: '1px solid rgba(255, 107, 107, 0.3)',
                color: '#ff6b6b',
                fontSize: 13,
                marginBottom: 12,
              }}>
                ❌ {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !pin}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: 12,
                border: 'none',
                background: !pin
                  ? 'rgba(255, 165, 0, 0.2)'
                  : `linear-gradient(135deg, ${ORANGE}, #ff8800)`,
                color: !pin ? 'rgba(255,255,255,0.4)' : '#0a0f0d',
                fontSize: 15, fontWeight: 700,
                cursor: !pin ? 'not-allowed' : 'pointer',
                marginBottom: 16,
              }}
            >
              {submitting ? '验证中…' : '🔓 进入核销中心'}
            </button>
          </form>

          <div style={{
            fontSize: 11, color: 'rgba(255,255,255,0.35)',
            lineHeight: 1.6, marginTop: 12,
            paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.05)',
          }}>
            🔐 0-1 阶段仅限店员使用<br />
            没有 PIN？请询问店长
          </div>
        </div>
      </div>
    )
  }

  // 已认证 - 显示 children + 顶部 logout 条
  return (
    <>
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '8px 16px',
        background: 'rgba(10, 15, 13, 0.85)',
        backdropFilter: 'blur(12px)',
        borderBottom: `1px solid rgba(${ORANGE_RGBA}, 0.15)`,
        fontSize: 12,
      }}>
        <span style={{ color: ORANGE }}>
          🔓 店员已登录 · 剩 {remainingMin} 分钟
        </span>
        <button
          onClick={handleLogout}
          style={{
            background: 'transparent',
            border: `1px solid rgba(${ORANGE_RGBA}, 0.3)`,
            color: ORANGE,
            padding: '4px 10px',
            borderRadius: 8,
            fontSize: 11,
            cursor: 'pointer',
          }}
        >
          退出
        </button>
      </div>
      {children}
    </>
  )
}
