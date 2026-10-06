/**
 * GET /api/push/debug - 推送链路实时状态（排查用）
 * 2026-10-07 清禾
 *
 * online  : 当前 SSE 在线连接（手机号 + 存活秒数）
 * pushSubs: Web Push 订阅（含 UA，可判断是不是 iPhone）
 * recent  : 最近叫号日志（含 sse-hit / sse-miss）
 */

import { NextResponse } from 'next/server'
import { getDb } from '@/lib/webpush-server'
import { listClients } from '@/lib/sse-registry'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const db = getDb()
  let pushSubs: unknown[] = []
  let recent: unknown[] = []
  try {
    pushSubs = db
      .prepare('SELECT phone, userAgent, createdAt FROM PushSubscription ORDER BY createdAt DESC')
      .all() as never
    recent = db
      .prepare('SELECT phone, status, error, createdAt FROM PushLog ORDER BY createdAt DESC LIMIT 12')
      .all() as never
  } finally {
    db.close()
  }

  return NextResponse.json({
    now: new Date().toISOString(),
    online: listClients(),
    pushSubs,
    recent,
  })
}
