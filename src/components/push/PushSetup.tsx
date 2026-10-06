'use client'

/**
 * PushSetup.tsx - 顾客端「到号提醒」开关
 * 2026-10-07 清禾 - 造型项目叫号推送
 *
 * 覆盖场景：
 *   Android Chrome  : 一键开启，后台/锁屏都能收
 *   iOS Safari      : 必须先「添加到主屏幕」，本组件给引导
 *   兜底             : Wake Lock 保持屏幕常亮，前台轮询命中即响（iPhone 没装也有效）
 *
 * 订阅按 (phone, merchantId) 绑定，授权一次长期有效。
 */

import { useCallback, useEffect, useRef, useState } from 'react'

type Status = 'idle' | 'unsupported' | 'need-install' | 'denied' | 'on' | 'busy' | 'error'

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
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
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
  const [status, setStatus] = useState<Status>('idle')
  const [msg, setMsg] = useState('')
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null)

  const set = useCallback(
    (s: Status) => {
      setStatus(s)
      onStateChange?.(s)
    },
    [onStateChange]
  );

  // 初始化：注册 SW + 探测权限 + 兜底 Wake Lock
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      set('unsupported')
      return
    }

    if (isIOS() && !isStandalone()) {
      set('need-install')
      return
    }

    if (Notification.permission === 'granted') set('on')

    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => set('error'))
  }, [set]);

  // 兜底：页面可见时保持屏幕常亮（iPhone 没装 PWA 也能响）
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
        /* 拒绝或不支持，静默 */
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
  }, []);

  // 收到推送点击 → 回到页面
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === 'BARBER_CALL_PUSH') window.focus()
    }
    navigator.serviceWorker.addEventListener('message', onMsg)
    return () => navigator.serviceWorker.removeEventListener('message', onMsg)
  }, []);

  const enable = useCallback(async () => {
    if (!phone) {
      setMsg('先取号，才能开启到号提醒')
      return
    }
    set('busy')
    setMsg('')
    try {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') {
        set('denied')
        setMsg('浏览器拒绝了通知权限')
        return
      }
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

      const r = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, merchantId, subscription: sub.toJSON() }),
      })
      if (!r.ok) throw new Error('订阅保存失败')
      set('on')
      setMsg('已开启，到号会推送到这台手机')
    } catch (e) {
      set('error')
      setMsg((e as Error).message || '开启失败')
    }
  }, [phone, merchantId, set])

  if (status === 'on') {
    return (
      <span style={{ fontSize: 12, color: '#15803d', fontWeight: 600 }}>
        🔔 到号提醒已开启
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
        <div style={{ marginTop: 4, opacity: 0.8 }}>（未添加时页面保持常亮，叫号也会响）</div>
      </div>
    )
  }

  if (status === 'unsupported') {
    return <span style={{ fontSize: 12, color: '#78716c' }}>当前浏览器不支持推送，页面会保持常亮</span>
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
  );
}
