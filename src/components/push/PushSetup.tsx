'use client'

/**
 * PushSetup.tsx - 顾客端「到号提醒」开关
 * 2026-10-07 清禾 - 造型项目叫号推送
 *
 * 重写原因 - 修死锁：
 *   旧 bug: Notification.permission === 'granted' 就直接 set('on')，
 *   但权限允许 != 订阅存在。之前授权成功、订阅 POST 失败之后，
 *   组件永远显示「已开启」而服务端一条订阅都没有，用户再也点不到第二次。
 *   现在: 权限允许时挂载即自动补订阅（subscribe() 不需要用户手势，
 *   只有 requestPermission() 需要），并按 endpoint 幂等补登记。
 *
 * 手机号可后补: upsertSubscription 以 endpoint 为冲突键并更新 phone，
 *   所以先订阅、拿到手机号再补登记即可，服务端会自行认领。
 */

import { useCallback, useEffect, useRef, useState } from 'react'

type Status =
  | 'checking'
  | 'unsupported'
  | 'need-install'
  | 'need-permission'
  | 'denied'
  | 'on'
  | 'pending-phone'
  | 'busy'
  | 'error'

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  )
}

export default function PushSetup({
  phone,
  merchantId,
  compact = false,
  onStateChange,
}: {
  phone: string
  merchantId: string
  compact?: boolean
  onStateChange?: (status: Status) => void
}) {
  const [status, setStatus] = useState<Status>('checking')
  const [probe, setProbe] = useState(0)
  const [msg, setMsg] = useState('')
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null)
  const registeredRef = useRef<string>('')

  const set = useCallback(
    (s: Status) => {
      setStatus(s)
      onStateChange?.(s)
    },
    [onStateChange]
  )

  /**
   * 拿到（或创建）订阅并向服务端登记。
   * 只有 requestPermission() 需要用户手势；subscribe() 可在挂载时直接跑。
   */
  const ensureSubscribed = useCallback(async (): Promise<'on' | 'pending-phone' | 'need-permission' | 'denied'> => {
    if (Notification.permission === 'denied') return 'denied'
    if (Notification.permission !== 'granted') return 'need-permission'

    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
    await navigator.serviceWorker.ready

    const res = await fetch('/api/push/vapid-public-key')
    const { publicKey } = await res.json()
    if (!publicKey) throw new Error('拿不到 VAPID 公钥')

    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })
    }

    // 按 endpoint 幂等补登记；手机号后补也没问题（服务端以 endpoint 为冲突键更新 phone）
    const endpoint = sub.endpoint
    const sig = endpoint + '|' + (phone || '') + '|' + merchantId
    if (registeredRef.current !== sig) {
      const r = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phone || '',
          merchantId,
          subscription: sub.toJSON(),
        }),
      })
      if (!r.ok) throw new Error('订阅保存失败 ' + r.status)
      registeredRef.current = sig
    }

    return phone ? 'on' : 'pending-phone'
  }, [phone, merchantId])

  // 初始化：注册 SW -> 探测权限 -> 能自动修就自动修
  useEffect(() => {
    let cancelled = false

    const run = async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        set('unsupported')
        return
      }
      if (isIOS() && !isStandalone()) {
        set('need-install')
        return
      }
      try {
        const st = await ensureSubscribed()
        if (!cancelled) set(st)
      } catch (e) {
        console.warn('[PushSetup] 自动补订阅失败:', e)
        if (!cancelled) set('error')
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [set, ensureSubscribed, probe])

  // 手机号后到：登录/取号拿到 phone 后自动补登记，不要求用户再点一次
  useEffect(() => {
    if (!phone) return
    if (Notification.permission !== 'granted') return
    if (isIOS() && !isStandalone()) return
    if (registeredRef.current.endsWith('|' + phone + '|' + merchantId)) return
    ensureSubscribed()
      .then(st => set(st))
      .catch(() => {})
  }, [phone, merchantId, ensureSubscribed, set])

  // 兜底：页面可见时保持屏幕常亮
  useEffect(() => {
    let cancelled = false
    const nav = navigator as unknown as {
      wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> }
    }
    if (!nav.wakeLock) return

    const acquire = async () => {
      try {
        const wl = await nav.wakeLock!.request('screen')
        if (cancelled) {
          wl.release()
          return
        }
        wakeLockRef.current = wl
      } catch {
        /* 静默 */
      }
    }
    const onVis = () => {
      if (document.visibilityState === 'visible') acquire()
    }

    if (document.visibilityState === 'visible') acquire()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVis)
      wakeLockRef.current?.release().catch(() => {})
    }
  }, [])

  // 收到推送点击 -> 回到页面
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === 'BARBER_CALL_PUSH') window.focus()
    }
    navigator.serviceWorker.addEventListener('message', onMsg)
    return () => navigator.serviceWorker.removeEventListener('message', onMsg)
  }, [])

  // 回到前台时重新核对（iOS 从后台切回会重连）
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') setProbe((n) => n + 1)
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  const enable = useCallback(async () => {
    set('busy')
    setMsg('')
    try {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') {
        set('denied')
        setMsg('浏览器拒绝了通知权限')
        return
      }
      registeredRef.current = ''
      const st = await ensureSubscribed()
      set(st)
      if (st === 'on') setMsg('已开启，关掉页面也能收到叫号')
    } catch (e) {
      set('error')
      setMsg((e as Error).message || '开启失败')
    }
  }, [ensureSubscribed, set])

  if (status === 'on') {
    return (
      <span style={{ fontSize: 12, color: '#15803d', fontWeight: 600 }}>
        🔔 到号提醒已开启（关页面也能收）
      </span>
    )
  }

  if (status === 'pending-phone') {
    return (
      <span style={{ fontSize: 12, color: '#92400e' }}>
        🔔 已授权，取号/登录后自动绑定手机号
      </span>
    )
  }

  if (status === 'need-install') {
    return (
      <div style={{ fontSize: 12, lineHeight: 1.8, color: '#92400e' }}>
        <div style={{ fontWeight: 700, marginBottom: 2 }}>📱 开启到号提醒（iPhone）</div>
        <div>1. 点底部「分享」按钮</div>
        <div>2. 选「添加到主屏幕」</div>
        <div>3. 回到桌面图标打开，再点这里</div>
        <button
          data-qh-probe-btn
          onClick={() => setProbe((n) => n + 1)}
          style={{
            marginTop: 8,
            padding: '8px 14px',
            background: '#b8860b',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          我已添加到主屏，重新检测
        </button>
      </div>
    )
  }

  if (status === 'unsupported') {
    return (
      <span style={{ fontSize: 12, color: '#78716c' }}>
        当前浏览器不支持后台推送，页面会保持常亮
      </span>
    )
  }

  if (status === 'checking') {
    return <span style={{ fontSize: 12, color: '#78716c' }}>检测推送状态…</span>
  }

  return (
    <div>
      <button
        onClick={enable}
        disabled={status === 'busy' || status === 'denied'}
        style={{
          padding: compact ? '5px 10px' : '7px 14px',
          background: '#b8860b',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          fontSize: compact ? 11 : 12,
          fontWeight: 700,
          cursor: status === 'denied' ? 'not-allowed' : 'pointer',
          opacity: status === 'denied' ? 0.5 : 1,
        }}
      >
        {status === 'busy' ? '开启中…' : status === 'denied' ? '通知已被拒绝' : '🔔 开启到号提醒'}
      </button>
      {msg && (
        <div style={{ fontSize: 11, color: '#92400e', marginTop: 4 }}>{msg}</div>
      )}
    </div>
  )
}
