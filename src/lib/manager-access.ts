import { createHash, randomBytes, timingSafeEqual } from 'crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'fs'
import { dirname, join } from 'path'

/**
 * 店长访问码 —— v1.1.60 · 2026-10-08 清禾
 *
 * 奕霖需求（2026-10-08 15:41）：「我需求是每个设备都能打开这个页面」
 *
 * 背景：/merchant/members 需要店长权限，但店长登录只有短信验证码一条路。
 * zhilin-token 是 host-only cookie + 绑设备指纹，换设备必然要重新登录。
 * 奕霖今天第三次撞上「换设备打不开」—— 试点阶段这是不可接受的摩擦。
 *
 * 做法：任何设备 登录页输「手机号 + 访问码」直接签发正常 token，下游零改动。
 *
 * 为什么不把 4 位店长 PIN 搬上服务端：4 位数字只有 1 万种组合，放到服务端
 * 就成了可暴力破解的靶子。访问码用 8 位字母数字（62^8 约 2.2e14 组合）+ 服务端限频。
 *
 * 安全约束（都在服务端，绕不过浏览器）：
 *   - 只认 role=店长 的账号，普通用户拿着码也进不去
 *   - 5 次失败 锁 5 分钟，按 IP 记
 *   - 恒定时间比较，防时序侧信道
 *   - 服务端只存 salt+hash，不存明文
 */

const STORE_FILE = join(process.cwd(), 'data', 'manager-access-code.json')

/** 允许的角色 —— 与 require-manager.ts 保持一致 */
const MANAGER_ROLES = ['店长']

/** 限频：5 次失败锁 5 分钟 */
const MAX_FAILS = 5
const LOCK_MS = 5 * 60 * 1000

interface StoredCode {
  salt: string
  hash: string
  hint: string
  updatedAt: string
}

interface RateEntry {
  fails: number
  lockedUntil: number
}

/*
 * 进程内限频表。重启会清空 —— 这是可接受的第二道防线：
 * 主防线是访问码 62^8 的组合空间，限频只负责让在线爆破不现实。
 */
const rateTable = new Map<string, RateEntry>()

function hashCode(plain: string, salt: string): string {
  return createHash('sha256').update(plain + ':' + salt).digest('hex')
}

/** 生成访问码：8 位字母数字，剔除易混字符（0 O 1 I l） */
export function generateAccessCode(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  const bytes = randomBytes(8)
  let out = ''
  for (let i = 0; i < 8; i++) out += alphabet[bytes[i] % alphabet.length]
  return out
}

/** 设置访问码（明文只在这一刻出现，落盘后只有 hash） */
export function setAccessCode(plain: string): StoredCode {
  const salt = randomBytes(16).toString('hex')
  const stored: StoredCode = {
    salt: salt,
    hash: hashCode(plain, salt),
    hint: plain.slice(0, 2) + '****' + plain.slice(-2),
    updatedAt: new Date().toISOString(),
  }
  const dir = dirname(STORE_FILE)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(STORE_FILE, JSON.stringify(stored, null, 2), { mode: 0o600 })
  try { chmodSync(STORE_FILE, 0o600) } catch { /* 文件系统不支持就算了 */ }
  return stored
}

function loadCode(): StoredCode | null {
  try {
    if (!existsSync(STORE_FILE)) return null
    return JSON.parse(readFileSync(STORE_FILE, 'utf8')) as StoredCode
  } catch {
    return null
  }
}

export function isManagerAccessReady(): boolean {
  return loadCode() !== null
}

/** 恒定时间比较，避免时序侧信道 */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8')
  const bufB = Buffer.from(b, 'utf8')
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

export function verifyAccessCode(plain: string): boolean {
  const stored = loadCode()
  if (!stored || !stored.salt || !stored.hash) return false
  return safeEqual(hashCode(plain, stored.salt), stored.hash)
}

export function isManagerRole(role: unknown): boolean {
  return MANAGER_ROLES.indexOf(String(role || '').trim()) !== -1
}

/* ========== 限频 ========== */

/** 返回剩余锁定毫秒；0 表示未锁定 */
export function lockRemaining(ip: string): number {
  const e = rateTable.get(ip)
  if (!e) return 0
  if (e.lockedUntil <= Date.now()) {
    if (e.fails >= MAX_FAILS) rateTable.delete(ip)
    return 0
  }
  return e.lockedUntil - Date.now()
}

export function recordFail(ip: string): { fails: number; lockedFor: number } {
  const e = rateTable.get(ip) || { fails: 0, lockedUntil: 0 }
  e.fails += 1
  if (e.fails >= MAX_FAILS) {
    e.lockedUntil = Date.now() + LOCK_MS
    e.fails = 0
    rateTable.set(ip, e)
    return { fails: MAX_FAILS, lockedFor: LOCK_MS }
  }
  rateTable.set(ip, e)
  return { fails: e.fails, lockedFor: 0 }
}

export function recordSuccess(ip: string): void {
  rateTable.delete(ip)
}

/** 定期清理过期条目，防止 Map 无限增长 */
export function sweepRateTable(): void {
  const now = Date.now()
  rateTable.forEach((v, k) => {
    if (v.lockedUntil <= now && v.fails < MAX_FAILS) rateTable.delete(k)
  })
}
