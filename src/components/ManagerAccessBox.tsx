'use client'

import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { useUserStore } from '@/stores/userStore'

/**
 * 店长快速进入 —— v1.1.60 清禾 2026-10-08
 *
 * 奕霖需求（2026-10-08 15:41）：「我需求是每个设备都能打开这个页面」
 *
 * 店长以前只能短信验证码登录，而 zhilin-token 绑设备指纹，换设备必重来。
 * 这里给店长第二条路：手机号 + 访问码，不发短信，任何设备都能进。
 *
 * 刻意做成折叠的小入口，不抢顾客的验证码登录 —— 店长自己知道点哪里。
 *
 * 不用 useSearchParams：那会要求整个页面包 Suspense，构建会报错。
 * 改成提交时直接读 window.location.search，客户端行为，无构建风险。
 */

function returnTo(): string {
  if (typeof window === 'undefined') return '/merchant'
  const raw = new URLSearchParams(window.location.search).get('redirect') || ''
  // 只接受站内相对路径，拒绝 //evil.com 这种协议相对地址
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/merchant'
  if (raw === '/login') return '/merchant'
  return raw
}

const GOLD = '#b8860b'

interface Props {
  /** 登录成功后跳哪；不传就读 URL 上的 ?redirect= */
  redirectTo?: string
  /** 登录成功后回调。用于「原地登录原地刷新」，省掉跳页 */
  onSuccess?: () => void
  /** 默认就展开（用于页面里直接给登录框） */
  autoOpen?: boolean
}

export default function ManagerAccessBox({ redirectTo, onSuccess, autoOpen }: Props = {}) {
  const [open, setOpen] = useState(!!autoOpen)
  const [phone, setPhone] = useState('')
  const [accessCode, setAccessCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const login = useUserStore((s) => s.login)

  const submit = async () => {
    if (loading) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/manager-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.replace(/\D/g, ''), accessCode }),
      })
      const data = await res.json()
      if (!data.success) {
        setError(data.error || '登录失败')
        return
      }
      login(
        {
          id: data.user.id,
          phone: data.user.phone,
          nickname: data.user.nickname,
          avatar: data.user.avatar,
          role: data.user.role,
          points: data.user.points,
          createdAt: data.user.createdAt,
        },
        data.token,
      )
      if (onSuccess) {
        onSuccess()
        router.refresh()
      } else {
        router.push(redirectTo || returnTo())
        router.refresh()
      }
    } catch {
      setError('网络错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <div style={{ textAlign: 'center', marginTop: '14px' }}>
        <button
          onClick={() => setOpen(true)}
          style={{
            background: 'none',
            border: 'none',
            color: 'rgba(184, 134, 11, 0.65)',
            fontSize: '12px',
            cursor: 'pointer',
            textDecoration: 'underline',
            padding: '4px 8px',
          }}
        >
          🔑 店长快速进入
        </button>
      </div>
    )
  }

  const inputStyle: CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '11px 12px',
    border: '1px solid rgba(184, 134, 11, 0.35)',
    borderRadius: '8px',
    background: 'rgba(255, 255, 255, 0.75)',
    color: '#3d2b1a',
    fontSize: '15px',
    outline: 'none',
  }

  return (
    <div
      style={{
        marginTop: '14px',
        padding: '14px',
        border: '1px dashed rgba(184, 134, 11, 0.35)',
        borderRadius: '10px',
        background: 'rgba(184, 134, 11, 0.05)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '10px',
        }}
      >
        <span style={{ fontSize: '13px', color: GOLD, fontWeight: '600' }}>🔑 店长快速进入</span>
        <button
          onClick={() => {
            setOpen(false)
            setError('')
          }}
          style={{
            background: 'none',
            border: 'none',
            color: 'rgba(184, 134, 11, 0.5)',
            fontSize: '12px',
            cursor: 'pointer',
          }}
        >
          收起
        </button>
      </div>

      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="店长手机号"
        inputMode="numeric"
        autoComplete="username"
        style={{ ...inputStyle, marginBottom: '8px' }}
      />
      <input
        value={accessCode}
        onChange={(e) => setAccessCode(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit()
        }}
        placeholder="8 位访问码"
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        style={{ ...inputStyle, marginBottom: error ? '8px' : '0', letterSpacing: '2px' }}
      />

      {error && (
        <div style={{ color: '#c0392b', fontSize: '12px', margin: '8px 0' }}>{error}</div>
      )}

      <button
        onClick={submit}
        disabled={loading}
        style={{
          width: '100%',
          padding: '12px',
          border: 'none',
          borderRadius: '8px',
          background: loading ? 'rgba(184,134,11,0.5)' : GOLD,
          color: '#fff',
          fontSize: '15px',
          cursor: loading ? 'default' : 'pointer',
          marginTop: '10px',
        }}
      >
        {loading ? '验证中…' : '进入店长面板'}
      </button>
    </div>
  )
}
