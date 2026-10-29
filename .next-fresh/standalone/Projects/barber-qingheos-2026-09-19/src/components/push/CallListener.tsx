'use client'

/**
 * CallListener.tsx - 顾客端叫号实时接收 (SSE)
 * 2026-10-07 清禾
 *
 * 顾客在店里等号时页面本来就开着 -> SSE 零安装零授权秒到，
 * 绕开 iOS Web Push 必须「添加到主屏幕」的限制。
 * 锁屏场景由 PushSetup 的 Wake Lock + Web Push 兜底。
 */

import { useEffect, useRef, useState } from 'react'

export interface CallAlert {
  title: string
  body: string
  at: number
}

export default function CallListener({
  phone,
  merchantId,
  onCall,
}: {
  phone: string
  merchantId: string
  onCall?: (a: CallAlert) => void
}) {
  const [online, setOnline] = useState(false)
  const esRef = useRef(null)
  const cbRef = useRef(onCall)

  useEffect(() => { cbRef.current = onCall }, [onCall])

  useEffect(() => {
    if (!phone || !merchantId) return
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') return

    const url = '/api/push/stream?merchantId=' + encodeURIComponent(merchantId)
      + '&phone=' + encodeURIComponent(phone)

    let closed = false
    let es = null

    const connect = () => {
      if (closed) return
      try {
        es = new EventSource(url)
        esRef.current = es
        es.addEventListener('ready', () => setOnline(true))
        es.addEventListener('call', (ev) => {
          try {
            const data = JSON.parse(ev.data)
            setOnline(true)
            if (cbRef.current) cbRef.current({
              title: data.title || '到号提醒',
              body: data.body || '',
              at: Date.now(),
            })
          } catch {
            /* 忽略坏包 */
          }
        })
        es.onerror = () => {
          setOnline(false)
          try { if (es) es.close() } catch { /* noop */ }
          if (!closed) setTimeout(connect, 3000)
        }
      } catch {
        setOnline(false)
      }
    }

    connect()

    return () => {
      closed = true
      try { if (es) es.close() } catch { /* noop */ }
      esRef.current = null
    }
  }, [phone, merchantId])

  if (!phone) return null
  return (
    <span
      title={online ? '到号提醒已连接' : '到号提醒未连接'}
      style={{
        display: 'inline-block',
        width: 6, height: 6, borderRadius: '50%',
        background: online ? '#22c55e' : '#ef4444',
        verticalAlign: 'middle', marginLeft: 6,
      }}
    />
  )
}
