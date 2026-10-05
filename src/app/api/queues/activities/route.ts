/**
 * /api/queues/activities - 实时活动流 v1.1.20 (2026-10-05 奕霖立)
 *
 *   GET /api/queues/activities?merchantId=xxx
 *
 * 数据源：BarberQueue 表最近 24h 记录，按 updatedAt DESC
 * 派生逻辑：每条记录最多 1 个最新事件
 *   - completedAt 设了 → "✅ X 完成剪发"
 *   - 否则 startedAt → "🎉 X 开始理发"
 *   - 否则 arrivedAt → "👋 X 到店"
 *   - 否则 createdAt → "📅 X 预约"
 *
 * 与 /api/queues 的区别：/api/queues 返回订单列表（用于状态切换），
 *   /api/queues/activities 返回"刚刚发生的"事件流（用于实时活动面板）。
 *
 * 时区：所有时间字段（HH:mm 字符串）已经是 Asia/Shanghai，无需转换；
 *   createdAt/updatedAt 是 ISO DateTime，渲染时 .toLocaleTimeString('zh-CN', timeZone: 'Asia/Shanghai')。
 */

import { NextRequest } from 'next/server'
import Database from 'better-sqlite3'
import { errorResponse, successResponse } from '@/lib/error'

export const runtime = 'nodejs'

// ⭐ v1.1.2 改绝对路径（standalone cwd 不可靠）
const DB_PATH = '/Users/yilinzhao/Projects/barber-qingheos-2026-09-19/prisma/dev.db'

function getDb() {
  return new Database(DB_PATH)
}

// 把 ISO DateTime 格式化成 HH:mm（Asia/Shanghai 时区）
// ⭐ v1.1.21 (2026-10-05 12:35 奕霖立)：修 UTC→Shanghai 解析错位
//  Prisma @default(now()) 返回 UTC 但 SQLite 存为 YYYY-MM-DD HH:MM:SS 文本，
//  Node 的 new Date() 按 server 本地时区解析（Shanghai）会错 8h
//  修法：无 TZ designator 的就末尾补 'Z' 强制按 UTC 解析
function toHm(isoOrDate: string | Date): string {
  let dateStr = typeof isoOrDate === 'string' ? isoOrDate : isoOrDate.toISOString()
  if (!/Z$|[+-]\d{2}:?\d{2}$/.test(dateStr)) {
    dateStr = dateStr + 'Z'
  }
  return new Date(dateStr).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Shanghai',
  })
}

// 根据当前状态派生事件文案
function buildEventText(name: string, eventType: string): string {
  switch (eventType) {
    case 'completed':
      return `✅ ${name}完成剪发`
    case 'serving':
      return `🎉 ${name}开始理发`
    case 'arrived':
      return `👋 ${name}到店`
    case 'reserved':
      return `📅 ${name}预约`
    case 'no_show':
      return `❌ ${name}未到店`
    default:
      return `📌 ${name}更新`
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const merchantId = (searchParams.get('merchantId') || '').trim()
    if (!merchantId) return errorResponse(new Error('merchantId 必填'), 400)

    const db = getDb()
    // ⭐ 2026-10-05 12:01 v1.1.20 奕霖立：取最近 24h 活动，按 updatedAt 倒序
    const rows = db
      .prepare(
        `
        SELECT id, orderNo, customerName, status,
               createdAt, updatedAt, arrivedAt, startedAt, completedAt
        FROM BarberQueue
        WHERE merchantId = ?
          AND updatedAt >= datetime('now', '-1 day')
        ORDER BY updatedAt DESC
        LIMIT 30
      `
      )
      .all(merchantId)
    db.close()

    // 派生活动事件
    const events = rows.map((r: any) => {
      let eventTime: string
      let eventType: string
      if (r.completedAt) {
        eventTime = r.completedAt
        eventType = 'completed'
      } else if (r.startedAt) {
        eventTime = r.startedAt
        eventType = 'serving'
      } else if (r.arrivedAt) {
        eventTime = r.arrivedAt
        eventType = 'arrived'
      } else {
        eventTime = toHm(r.createdAt)
        eventType = 'reserved'
      }
      return {
        time: eventTime,
        text: buildEventText(r.customerName, eventType),
        orderNo: r.orderNo,
        timestamp: r.updatedAt,
      }
    })

    return successResponse({ activities: events, total: events.length })
  } catch (e: any) {
    return errorResponse(e, 500)
  }
}