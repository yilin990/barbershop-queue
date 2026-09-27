'use client'

/**
 * AdminGate - 商户后台 PIN 验证门
 *
 * 包裹需要商户管理权限的页面：
 *   <AdminGate>
 *     <AdminPage />
 *   </AdminGate>
 *
 * 未登录 → 显示 PIN 输入页（紫底，跟店员橙区分）
 * 已登录 → 渲染 children + 顶部 logout 条
 *
 * 奕霖 2026-07-08 22:27：商户后台不是给用户的，需要安全码
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  verifyAdminPin,
  setAdminSession,
  isAdminAuthed,
  getAdminSessionRemainingMinutes,
  clearAdminSession,
} from '@/lib/admin-auth'

const PURPLE = '#a78bfa'
const PURPLE_RGBA = '167, 139, 250'

export default function AdminGate({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [authed, setAuthed] = useState<boolean | null>(null) // null = 还在检查
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [remainingMin, setRemainingMin] = useState(0)

  useEffect(() => {
    setAuthed(isAdminAuthed())
    setRemainingMin(getAdminSessionRemainingMinutes())
    const t = setInterval(() => setRemainingMin(getAdminSessionRemainingMinutes()), 60000)
    return () => clearInterval(t)
  }, [])

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!pin) return
    setSubmitting(true)
    setError(null)
    setTimeout(() => {
      if (verifyAdminPin(pin)) {
        setAdminSession(pin)
        setAuthed(true)
        setRemainingMin(60)
        setPin('')
      } else {
        setError('安全码错误，请联系老板/店长获取')
        setPin('')
      }
      setSubmitting(false)
    }, 300)
  }

  const handleLogout = () => {
    clearAdminSession()
    setAuthed(false)
    setRemainingMin(0)
  }

  // 还在 hydrate 状态
  if (authed === null) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(180deg, #0a0f0d, #050807)' }}>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>验证中…</div>
      </div>
    )
  }

  // 未认证 - 显示 PIN 输入页
  if (!authed) {
    return (
      <div
        style={{
          minHeight: '100dvh',
          background: 'linear-gradient(180deg, #0a0f0d, #050807)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 380,
            background: `linear-gradient(180deg, rgba(${PURPLE_RGBA}, 0.08) 0%, rgba(${PURPLE_RGBA}, 0.02) 100%)`,
            border: `1px solid rgba(${PURPLE_RGBA}, 0.2)`,
            borderRadius: 18,
            padding: '32px 24px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 56, marginBottom: 16 }}>🛡️</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#fff', margin: '0 0 6px' }}>商户管理后台</h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: '0 0 24px' }}>
            此功能仅供商户内部使用，请输入安全码进入
          </p>

          <form onSubmit={handleSubmit}>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="••••"
              autoFocus
              disabled={submitting}
              style={{
                width: '100%',
                padding: '16px',
                fontSize: 24,
                textAlign: 'center',
                letterSpacing: '8px',
                background: 'rgba(0, 0, 0, 0.3)',
                border: `1px solid rgba(${PURPLE_RGBA}, 0.3)`,
                borderRadius: 12,
                color: '#fff',
                outline: 'none',
                fontFamily: 'inherit',
                marginBottom: 12,
              }}
            />

            {error && (
              <div
                style={{
                  color: '#ef4444',
                  fontSize: 13,
                  marginBottom: 12,
                  padding: '8px 12px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  borderRadius: 8,
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || pin.length < 4}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: 12,
                border: 'none',
                background: submitting || pin.length < 4
                  ? `rgba(${PURPLE_RGBA}, 0.2)`
                  : `linear-gradient(135deg, ${PURPLE}, #7c3aed)`,
                color: submitting || pin.length < 4 ? 'rgba(255,255,255,0.4)' : '#0a0f0d',
                fontSize: 15,
                fontWeight: 700,
                cursor: submitting || pin.length < 4 ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {submitting ? '验证中…' : '🔓 进入管理后台'}
            </button>
          </form>

          <div style={{ marginTop: 20, fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
            没有安全码？请联系老板或店长
          </div>

          <div
            onClick={() => router.push('/me')}
            style={{
              marginTop: 16,
              fontSize: 12,
              color: 'rgba(167, 139, 250, 0.7)',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            ← 返回我的
          </div>
        </div>
      </div>
    )
  }

  // 已认证 - 显示 children + 顶部 admin 状态条
  // 奕霖 2026-08-02 00:30：刘海手机不适配 + 顶部 UI 简陋 → 重做整个 admin 状态条
  // 奕霖 2026-08-02 00:30 反馈：刘海手机不适配（之前 padding 没 env(safe-area-inset-top)）+ UI 太简陋
  return (
    <>
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          // ⭐ 刘海适配：顶部 padding 必须包含 safe-area-inset-top，否则 iPhone 顶部内容被刘海遮挡
          padding: 'calc(8px + env(safe-area-inset-top, 0px)) 14px 8px',
          background: 'linear-gradient(180deg, rgba(15, 22, 18, 0.92) 0%, rgba(10, 15, 13, 0.82) 100%)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: `1px solid rgba(${PURPLE_RGBA}, 0.18)`,
          boxShadow: '0 2px 12px rgba(0, 0, 0, 0.3)',
        }}
      >
        {/* 头像 + Owner 标识（保持 Sidebar 视觉一致） */}
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 700, color: '#fff',
          boxShadow: '0 0 12px rgba(167, 139, 250, 0.45)',
          flexShrink: 0,
        }}>奕</div>

        {/* 名称 + 状态 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: 600, color: '#fff',
            display: 'flex', alignItems: 'center', gap: 6,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            奕霖
            <span style={{
              fontSize: 9, padding: '1px 5px', borderRadius: 4,
              background: 'rgba(167, 139, 250, 0.2)', color: '#a78bfa',
              fontWeight: 700, letterSpacing: 0.5,
              flexShrink: 0,
            }}>OWNER</span>
          </div>
          <div style={{
            fontSize: 10, color: 'rgba(255,255,255,0.5)',
            marginTop: 2,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{
              display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
              background: remainingMin > 10 ? '#b8860b' : remainingMin > 3 ? '#f59e0b' : '#ef4444',
              boxShadow: remainingMin > 10 ? '0 0 4px rgba(34,197,94,0.6)' : 'none',
              flexShrink: 0,
            }} />
            <span>管理后台 · 剩 {remainingMin} 分钟</span>
          </div>
        </div>

        {/* 退出按钮 - 大触控目标 + 反馈 */}
        <button
          type="button"
          onClick={handleLogout}
          aria-label="退出登录"
          style={{
            minHeight: 36,
            padding: '6px 12px',
            borderRadius: 10,
            border: `1px solid rgba(${PURPLE_RGBA}, 0.3)`,
            background: 'rgba(167, 139, 250, 0.1)',
            color: PURPLE,
            fontSize: 12, fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', gap: 4,
            flexShrink: 0,
            transition: 'all 0.15s',
          }}
        >
          <span>退出</span>
        </button>
      </div>
      {children}
    </>
  )
}
