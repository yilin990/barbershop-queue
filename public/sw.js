/**
 * sw.js — 造型师助手 Service Worker
 * 职责：接收 Web Push 到号提醒 + 点击通知回到 /merchant
 * v1.0.0  2026-10-07 清禾
 *
 * iOS 前提：必须「添加到主屏幕」才收得到 push（Safari 标签页收不到）
 * Android / 桌面 Chrome：直接可用
 */

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (e) {
    data = { title: '到号提醒', body: event.data ? event.data.text() : '' }
  }

  event.waitUntil(
    self.registration.showNotification(data.title || '到号提醒', {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag || 'barber-call',
      renotify: true,
      requireInteraction: true,
      vibrate: [300, 120, 300, 120, 600],
      data: { url: data.url || '/merchant', payload: data },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const d = event.notification.data || {}
  const url = d.url || '/merchant'
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const c of all) {
        if ('focus' in c) {
          c.postMessage({ type: 'BARBER_CALL_PUSH', payload: d.payload })
          return c.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url)
    })()
  )
})
