/**
 * POST /api/queues/[id]/call - 叫号推送（服务端）
 * 2026-10-07 清禾 - 造型项目
 *
 * 设计：
 *   - 叫号从「纯前端弹窗」升级为「服务端动作」
 *   - 店长点两下不会发两条（60 秒去重窗口）
 *   - 多台平板/换设备都走这一个入口，不会各发各的
 *   - 不改 status：叫号推送 与「开始理发」保持两个独立动作（不改现有店务流程）
 *
 * Body: { force?: boolean }  force=true 跳过去重
 */

import { NextRequest, NextResponse } from 'next/server'
import { pushToPhone, getDb, writeLog } from '@/lib/webpush-server'
import { broadcastCall } from '@/lib/sse-registry'

export const runtime = 'nodejs'

const DEDUPE_WINDOW_MS = 60_000

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    let body: { force?: boolean } = {}
    try {
      body = await request.json()
    } catch {
      body = {}
    }

    const db = getDb()
    let q: Record<string, string> | undefined
    try {
      q = db
        .prepare(
          'SELECT id, merchantId, orderNo, customerName, customerPhone, service, stylistName, status FROM BarberQueue WHERE id = ?'
        )
        .get(id) as Record<string, string> | undefined
    } finally {
      db.close()
    }

    if (!q) {
      return NextResponse.json({ success: false, error: '单号不存在' }, { status: 404 })
    }

    // 去重：同一单 60 秒内只推一次
    if (!body.force) {
      const db2 = getDb()
      let recent: { createdAt: string } | undefined
      try {
        recent = db2
          .prepare("SELECT createdAt FROM PushLog WHERE queueId = ? AND status = 'sent' ORDER BY createdAt DESC LIMIT 1")
          .get(id) as { createdAt: string } | undefined
      } finally {
        db2.close()
      }
      if (recent?.createdAt) {
        const ts = Date.parse(recent.createdAt.includes('T') ? recent.createdAt : recent.createdAt.replace(' ', 'T') + 'Z')
        if (Number.isFinite(ts) && Date.now() - ts < DEDUPE_WINDOW_MS) {
          return NextResponse.json({ success: true, deduped: true })
        }
      }
    }

    const no = q.orderNo ? `单号 ${q.orderNo}` : ''
    const stylist = q.stylistName && q.stylistName !== 'Will be assigned' ? `${q.stylistName} 老师` : ''
    const payload = {
      title: '到号提醒',
      body: [q.customerName, q.service, stylist, no].filter(Boolean).join(' · ') + ' 请到店',
      url: '/merchant',
      // ⭐ 2026-10-07 修「连续提醒不了」：
      //   tag 相同 = Web Push 直接「替换」旧通知，不是新增，所以连着叫同一单只会看到一条。
      //   改成每次叫号生成唯一 tag → 每次都是一条新通知，逐条累积。
      tag: 'barber-call-' + q.id + '-' + Date.now().toString(36),
    }

    // SSE 优先: 页面开着就能收到 (iPhone Safari 零安装)
    let sseDelivered = 0
    try {
      sseDelivered = broadcastCall(q.customerPhone, q.merchantId, payload)
    } catch {
      sseDelivered = 0
    }

    const result = await pushToPhone(q.customerPhone, q.merchantId, payload)

    // SSE 送达独立记账，之前只记 Web Push 导致 SSE 命中与否完全不可见
    if (sseDelivered > 0) {
      writeLog(q.id, q.customerPhone, 'sse-hit', 'delivered=' + sseDelivered)
    } else {
      writeLog(q.id, q.customerPhone, 'sse-miss', 'no live SSE client')
    }

    if (result.sent > 0) {
      writeLog(q.id, q.customerPhone, 'sent')
    } else {
      writeLog(q.id, q.customerPhone, 'failed', result.error || 'no subscription')
    }

    return NextResponse.json({
      success: true,
      queue: {
        id: q.id,
        orderNo: q.orderNo,
        customerName: q.customerName,
        customerPhone: q.customerPhone,
        service: q.service,
        stylistName: q.stylistName,
      },
      push: result,
      sseDelivered,
    })
  } catch (e) {
    return NextResponse.json(
      { success: false, error: (e as Error).message },
      { status: 500 }
    )
  }
}
