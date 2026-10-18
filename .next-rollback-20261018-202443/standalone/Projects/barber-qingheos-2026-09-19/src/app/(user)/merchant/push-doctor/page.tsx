'use client'

/*
 * /merchant/push-doctor - 推送自检页
 * 2026-10-07 清禾：iPhone 显示收到过通知但服务端查不到 iPhone 订阅，
 * 需要一个能在真机上直接看到「卡在哪一步」的地方。
 */

import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_MERCHANT_ID } from '@/lib/merchant'

type Row = { k: string; v: string; ok: boolean | null }

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export default function PushDoctor() {
  const [rows, setRows] = useState<Row[]>([])
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const scan = useCallback(async () => {
    const next: Row[] = []
    const push = (k: string, v: string, ok: boolean | null) => next.push({ k, v, ok })

    const ua = navigator.userAgent
    const dev = /iPhone|iPad|iPod/.test(ua) ? 'iPhone / iPad'
      : (/Android/.test(ua) ? 'Android' : (/Macintosh/.test(ua) ? 'Mac' : '其他'))
    push('设备', dev, null)

    const standalone = (navigator as unknown as { standalone?: boolean }).standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches
    push('独立窗口(已加主屏)', standalone ? '是' : '否 —— 必须从桌面图标打开', standalone)

    if (!('serviceWorker' in navigator)) {
      push('Service Worker', '不支持', false)
      setRows(next); return
    }

    let reg: ServiceWorkerRegistration | null = null
    try {
      reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
      await navigator.serviceWorker.ready
      push('Service Worker', '已注册并激活', true)
    } catch (e) {
      push('Service Worker', '注册失败 ' + (e as Error).message, false)
    }

    // ⭐ 清禾 2026-10-08 00:02：iOS Safari 没有 Notification 全局，裸访问会抛 ReferenceError
    const N = (typeof window !== 'undefined')
      ? (window as unknown as { Notification?: typeof Notification }).Notification
      : null
    push('通知权限', N ? N.permission : '浏览器不支持',
      N ? (N.permission === 'granted' ? true : N.permission === 'denied' ? false : null) : false)

    let sub: PushSubscription | null = null
    try { sub = reg ? await reg.pushManager.getSubscription() : null } catch { sub = null }
    push('本机订阅', sub ? '存在' : '不存在', !!sub)
    if (sub) push('endpoint', sub.endpoint.slice(-28), true)

    setRows(next)
    return sub
  }, [])

  useEffect(() => { scan() }, [scan])

  const enable = useCallback(async () => {
    setBusy(true); setMsg('')
    try {
      const N2 = (window as unknown as { Notification?: typeof Notification }).Notification
      if (!N2) { setMsg('这个浏览器不支持 Web Push 通知'); setBusy(false); return }
      const perm = await N2.requestPermission()
      if (perm !== 'granted') { setMsg('通知权限未允许：' + perm); setBusy(false); return }
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
      await navigator.serviceWorker.ready
      const res = await fetch('/api/push/vapid-public-key')
      const { publicKey } = await res.json()
      let sub = await reg.pushManager.getSubscription()
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        })
      }
      const url = new URL(window.location.href)
      const phone = url.searchParams.get('phone') || ''
      const r = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, merchantId: DEFAULT_MERCHANT_ID, subscription: sub.toJSON() }),
      })
      setMsg(r.ok ? ('订阅成功，已登记到服务端 phone=[' + phone + ']') : ('登记失败 ' + r.status + ' ' + (await r.text())))
    } catch (e) {
      setMsg('失败：' + (e as Error).message)
    }
    scan()
    setBusy(false)
  }, [scan])

  return (
    <div style={{ padding: 20, fontFamily: 'system-ui', maxWidth: 520, margin: '0 auto' }}>
      <h2 style={{ fontSize: 18, marginBottom: 4 }}>🔔 推送自检</h2>
      <p style={{ fontSize: 12, color: '#78716c', marginBottom: 14 }}>
        这一页必须用「桌面图标」打开，不是从 Safari 书签点
      </p>
      <div style={{ border: '1px solid #e7e5e4', borderRadius: 10, overflow: 'hidden' }}>
        {rows.map((r, i) => (
          <div key={i} style={{
            display: 'flex', justifyContent: 'space-between', gap: 10,
            padding: '9px 12px', fontSize: 13,
            borderBottom: i < rows.length - 1 ? '1px solid #f5f5f4' : 'none',
          }}>
            <span style={{ color: '#78716c' }}>{r.k}</span>
            <span style={{
              fontWeight: 700, textAlign: 'right', wordBreak: 'break-all',
              color: r.ok === true ? '#15803d' : r.ok === false ? '#b91c1c' : '#44403c',
            }}>{r.v}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button onClick={enable} disabled={busy} style={{
          flex: 1, padding: '12px 0', background: '#b8860b', color: '#fff',
          border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer',
        }}>{busy ? '处理中…' : '开启推送并自检'}</button>
        <button onClick={() => scan()} style={{
          padding: '12px 16px', background: '#fff', color: '#44403c',
          border: '1px solid #d6d3d1', borderRadius: 8, fontSize: 14, cursor: 'pointer',
        }}>重新检测</button>
      </div>
      {msg && <div style={{ marginTop: 10, fontSize: 13, color: '#92400e', lineHeight: 1.7 }}>{msg}</div>}
      <p style={{ marginTop: 18, fontSize: 11, color: '#a8a29e', lineHeight: 1.8 }}>
「独立窗口=否」和「本机订阅=不存在」→ iPhone 没订阅成功，只能靠页面开着收。<br />
全绿之后，我这边就能看到你的 iPhone 订阅，可以做真机到号验收。
      </p>
    </div>
  )
}
