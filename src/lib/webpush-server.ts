/**
 * webpush-server.ts - 服务端 Web Push (VAPID)
 * 2026-10-07 清禾 - 造型项目叫号推送
 *
 * 订阅按 (phone, merchantId) 绑定，不绑 queueId
 *   -> 顾客只需授权一次，之后每一张单子都能收到；刷新页面不丢
 * VAPID 密钥从 .openclaw/secrets/vapid.json 读（已 gitignore）
 */

import webpush from 'web-push'
import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'

const ROOT = '/Users/yilinzhao/Projects/barber-qingheos-2026-09-19'
const DB_PATH = path.join(ROOT, 'prisma/dev.db')
const VAPID_PATH = path.join(ROOT, '.openclaw/secrets/vapid.json')

let vapidReady = false

function ensureVapid() {
  if (vapidReady) return
  if (!fs.existsSync(VAPID_PATH)) throw new Error('VAPID key missing: ' + VAPID_PATH)
  const keys = JSON.parse(fs.readFileSync(VAPID_PATH, 'utf-8'))
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:barber@qingheos.cn',
    keys.publicKey,
    keys.privateKey
  )
  vapidReady = true
}

export function getVapidPublicKey(): string {
  // NOTE: web-push@3.6.7 无 getVapidPublicKey API，直接读自己的密钥文件
  if (!fs.existsSync(VAPID_PATH)) throw new Error('VAPID key missing: ' + VAPID_PATH)
  return JSON.parse(fs.readFileSync(VAPID_PATH, 'utf-8')).publicKey
}

export function getDb() {
  return new Database(DB_PATH)
}

function newId(prefix: string) {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

const UPSERT_SQL = [
  'INSERT INTO PushSubscription (id, phone, merchantId, endpoint, p256dh, auth, userAgent)',
  'VALUES (?, ?, ?, ?, ?, ?, ?)',
  'ON CONFLICT(endpoint) DO UPDATE SET',
  'phone = excluded.phone,',
  'merchantId = excluded.merchantId,',
  'p256dh = excluded.p256dh,',
  'auth = excluded.auth,',
  'userAgent = excluded.userAgent,',
  "updatedAt = datetime('now')"
].join(' ')

export function upsertSubscription(p: {
  phone: string
  merchantId: string
  endpoint: string
  p256dh: string
  auth: string
  userAgent?: string
}) {
  const db = getDb()
  try {
    db.prepare(UPSERT_SQL).run(
      newId('ps'), p.phone, p.merchantId, p.endpoint, p.p256dh, p.auth, p.userAgent || null
    )
    return true
  } finally {
    db.close()
  }
}

export function removeSubscription(endpoint: string) {
  const db = getDb()
  try {
    return db.prepare('DELETE FROM PushSubscription WHERE endpoint = ?').run(endpoint).changes > 0
  } finally {
    db.close()
  }
}

export function writeLog(queueId: string, phone: string | null, status: string, error?: string) {
  const db = getDb()
  try {
    db.prepare('INSERT INTO PushLog (id, queueId, phone, status, error) VALUES (?, ?, ?, ?, ?)').run(
      newId('pl'), queueId, phone, status, error || null
    )
  } catch {
    /* log failure must not block */
  } finally {
    db.close()
  }
}

export interface CallPayload {
  title: string
  body: string
  url?: string
  tag?: string
}

export async function pushToPhone(
  phone: string,
  merchantId: string,
  payload: CallPayload
): Promise<{ sent: number; failed: number; pruned: number; error?: string }> {
  ensureVapid()
  const db = getDb()
  let subs: Array<{ id: string; endpoint: string; p256dh: string; auth: string }>
  try {
    subs = db
      .prepare('SELECT id, endpoint, p256dh, auth FROM PushSubscription WHERE phone = ? AND merchantId = ?')
      .all(phone, merchantId) as never
  } finally {
    db.close()
  }

  if (!subs.length) {
    return { sent: 0, failed: 0, pruned: 0, error: '该手机号没有开启到号提醒' }
  }

  let sent = 0
  let failed = 0
  let pruned = 0
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      )
      sent++
    } catch (err) {
      const sc = (err as { statusCode?: number }).statusCode
      if (sc === 404 || sc === 410) {
        removeSubscription(sub.endpoint)
        pruned++
      } else {
        failed++
      }
    }
  }
  return { sent, failed, pruned }
}
