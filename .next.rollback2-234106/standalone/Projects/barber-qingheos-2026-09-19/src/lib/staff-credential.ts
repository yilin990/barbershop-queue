/**
 * 门店员工 PIN 凭证验证（方案 B）
 *
 * 2026-10-12 奕霖选方案 B：PIN 不再明文写在源码里，改为查表鉴权。
 *
 * 设计要点：
 * 1. **同步 API** —— 现有 verifyAdminRequest / verifyStaffPin / verifyAdminPin
 *    / verifyStaffCookie / verifyDefaultPin 全是同步函数，改成 async 会波及
 *    所有调用点，漏一个 await 店长就登不进店。better-sqlite3 是同步驱动，
 *    这里用它保住同步签名，调用点零改动。
 * 2. **只存哈希** —— pinHash 为 scrypt 哈希，源码与 Git 里不再出现明文 PIN。
 * 3. **fail-closed** —— 读不到库/表不存在/哈希格式异常，一律判定为验证失败，
 *    绝不放行。鉴权出问题的默认方向永远是「拒绝」，不是「放行」。
 */

import path from 'path'
import crypto from 'crypto'
import Database from 'better-sqlite3'

export type CredentialRole = 'staff' | 'manager' | 'admin' | string

interface CredentialRow {
  merchantId: string
  role: string
  label: string
  pinHash: string
}

let cache: CredentialRow[] | null = null
let cacheStamp = 0

function resolveDbPath(): string {
  const envUrl = process.env.DATABASE_URL?.replace(/^file:/, '')
  const fs = require('fs')
  if (envUrl && fs.existsSync(envUrl)) return envUrl
  return path.join(process.cwd(), 'prisma', 'dev.db')
}

/** 进程内缓存：避免每个请求都开一次 DB 句柄 */
function loadCredentials(): CredentialRow[] {
  if (cache) return cache
  try {
    const db = new Database(resolveDbPath(), { readonly: true })
    try {
      cache = db
        .prepare(
          'SELECT merchantId, role, label, pinHash FROM "StaffCredential" WHERE active = 1'
        )
        .all() as CredentialRow[]
    } finally {
      db.close()
    }
  } catch {
    // fail-closed：读不到就当没有任何凭证
    cache = []
  }
  cacheStamp = Date.now()
  return cache
}

/** 校验单个哈希，格式不对一律 false */
function verifyHash(pin: string, stored: string): boolean {
  const parts = String(stored).split('$')
  if (parts[0] !== 'scrypt' || parts.length !== 3) return false
  try {
    const salt = Buffer.from(parts[1], 'hex')
    const expected = Buffer.from(parts[2], 'hex')
    if (expected.length === 0) return false
    const actual = crypto.scryptSync(pin, salt, expected.length)
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}

/**
 * 验证某个角色的 PIN。
 * merchantId 传具体门店时先精确匹配，再回退到通配符 '*'。
 */
export function verifyCredentialPin(
  role: CredentialRole,
  pin: string,
  merchantId?: string,
  opts?: { exact?: boolean }
): boolean {
  if (typeof pin !== 'string' || pin.length === 0) return false
  const rows = loadCredentials()
  const scoped = merchantId
    ? rows.filter((r) => r.role === role && (opts?.exact
        ? r.merchantId === merchantId
        : (r.merchantId === merchantId || r.merchantId === '*')))
    : rows.filter((r) => r.role === role)
  for (const r of scoped) {
    if (verifyHash(pin, r.pinHash)) return true
  }
  return false
}


/** 该角色当前有多少个可用凭证（管理端展示用） */
export function credentialCount(role?: CredentialRole): number {
  const rows = loadCredentials()
  return role ? rows.filter((r) => r.role === role).length : rows.length
}

/** 改库后手动刷新缓存；不改的话等进程重启 */
export function reloadCredentials(): number {
  cache = null
  return loadCredentials().length
}

export const __credentialLoadedAt = (): number => cacheStamp
export const __resetCacheForTest = (): void => {
  cache = null
}
