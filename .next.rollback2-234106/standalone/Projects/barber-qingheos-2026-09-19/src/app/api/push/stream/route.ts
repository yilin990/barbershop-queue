/**
 * GET /api/push/stream - 叫号实时推送（SSE 长连接）
 * 2026-10-07 清禾
 *
 * 用法（前端）：
 *   new EventSource('/api/push/stream?merchantId=m_barber_001&phone=1xxxxxxxxxx')
 *   es.addEventListener('call', e => ...)
 *
 * 为什么不是 Web Push：
 *   iOS Safari 必须「添加到主屏幕」才支持 Web Push，顾客几乎不会做这步。
 *   顾客在店里等号时页面本来就开着，SSE 零安装零授权即可收到。
 */

import { NextRequest } from 'next/server'
import { addClient, removeClient, clientCount } from '@/lib/sse-registry'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const HEARTBEAT_MS = 25_000

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const phone = (searchParams.get('phone') || '').trim()
  const merchantId = (searchParams.get('merchantId') || '').trim()

  if (!phone || !merchantId) {
    return new Response('phone & merchantId required', { status: 400 })
  }

  const encoder = new TextEncoder()

  let clientId = ''
  let heartbeat: ReturnType<typeof setInterval> | undefined

  const stream = new ReadableStream({
    start(controller) {
      const send = (chunk: string) => {
        controller.enqueue(encoder.encode(chunk))
      }

      // 立刻握手，客户端能确认连上了
      send('retry: 3000\n\n')
      send('event: ready\ndata: ' + JSON.stringify({ online: clientCount() + 1 }) + '\n\n')

      const c = addClient({ phone, merchantId, send })
      clientId = c.id

      heartbeat = setInterval(() => {
        try {
          send(': ping\n\n')
        } catch {
          if (clientId) removeClient(clientId)
          if (heartbeat) clearInterval(heartbeat)
        }
      }, HEARTBEAT_MS)

      request.signal.addEventListener('abort', () => {
        if (clientId) removeClient(clientId)
        if (heartbeat) clearInterval(heartbeat)
        try {
          controller.close()
        } catch {
          /* 已关闭 */
        }
      })
    },
    cancel() {
      if (clientId) removeClient(clientId)
      if (heartbeat) clearInterval(heartbeat)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
