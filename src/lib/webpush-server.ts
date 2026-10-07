/**
 * webpush-server.ts - 服务端 Web Push (VAPID)
 * 2026-10-07 清禾 - 造型项目叫号推送
 *
 * v1.1.36 (2026-10-07 11:45 清禾) iOS 叫号推送闭环 - 奕霖真机确认 iPhone 能收到。
 *   tag 每次叫号唯一(同 tag 会互相替换) + APNs priority 10(否则 iOS 静默投递没声音)。
 *   注意: web-push@3.6.7 没有 silent 选项, 传了直接抛错会打挂全部推送。
 *   注意: iOS vibrate 自定义模式不支持, 震动只能跟系统设置。
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
      // ⭐ 2026-10-07 修「没有声音」：
      //   web-push 不会自动设 apns-priority，APNs 默认 5（低优先级）
      //   → iOS 静默投递，只进通知中心不响铃。必须显式给 10。
      //
      //   ⚠️ 踩坑：不要传 silent！web-push@3.6.7 的合法选项只有
      //   headers / gcmAPIKey / vapidDetails / TTL / contentEncoding /
      //   urgency / topic / proxy / agent / timeout。传 silent 会直接抛
      //   "'silent' is an invalid option"，导致每一次推送都 fail。
      //   声音默认就是有的（不设即有声），由 apns-priority 决定会不会被静默。
      //
      //   ⚠️ 也不要手动塞 apns-push-type —— Web Push 走 APNs 时由 web-push
      //   自己处理 topic/type，手动加会冲突。
      const isApple = /apple\.com/.test(sub.endpoint)
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
        isApple ? { headers: { 'apns-priority': '10' } } : undefined
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
