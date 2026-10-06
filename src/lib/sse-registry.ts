/**
 * sse-registry.ts - 叫号实时推送连接注册表（SSE）
 * 2026-10-07 清禾
 *
 * 为什么需要它：
 *   Web Push 在 iOS 上必须「添加到主屏幕」才能用，转化路径太长。
 *   顾客在店里等号时页面本来就是开着的 -> 用 SSE 直接把叫号推到页面，
 *   零安装、零授权、iPhone Safari 直接可用。
 *
 * 存内存是有意为之：连接只在浏览器标签页存活期间有意义，
 *   服务重启后客户端会自动重连并重新登记，不需要持久化。
 */

export interface SseClient {
  id: string
  phone: string
  merchantId: string
  send: (data: string) => void
  createdAt: number
}

const g = globalThis as unknown as {
  __qingheSseClients?: Map<string, SseClient>
}

function store(): Map<string, SseClient> {
  if (!g.__qingheSseClients) g.__qingheSseClients = new Map()
  return g.__qingheSseClients
}

let seq = 0

export function addClient(c: Omit<SseClient, 'id' | 'createdAt'>): SseClient {
  const client: SseClient = {
    ...c,
    id: 'sse_' + Date.now().toString(36) + '_' + (seq++).toString(36),
    createdAt: Date.now(),
  }
  store().set(client.id, client)
  return client
}

export function removeClient(id: string) {
  store().delete(id)
}

export function clientCount(): number {
  return store().size
}

/**
 * 把叫号事件推给某个手机号当前所有在线连接
 * 返回实际送达的连接数
 */
export function broadcastCall(phone: string, merchantId: string, payload: unknown): number {
  let n = 0
  for (const c of store().values()) {
    if (c.phone !== phone || c.merchantId !== merchantId) continue
    try {
      c.send('event: call\ndata: ' + JSON.stringify(payload) + '\n\n')
      n++
    } catch {
      store().delete(c.id)
    }
  }
  return n
}
