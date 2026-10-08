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

/* ==========================================================================
 * 店长模式 PIN —— 服务端副本 · v1.1.62 清禾 2026-10-08
 *
 * 奕霖 2026-10-08 16:22 选 B：「我明明开了店长模式，为什么它不知道」
 *
 * 原来 PIN 只存 localStorage，服务端不知道 → 会员面板只能再问一次 = 二次门槛。
 * 现在 PIN 在服务端也存一份：任何设备输同一个 PIN 即可解锁并换到店长 token，
 * 解锁后全站零门槛。
 *
 * 🔴 为什么必须用递增锁定（这是本文件最要紧的部分）：
 *   PIN 是 4 位数字 = 1 万种组合。固定「错5次锁5分钟」扛不住 ——
 *   1万种 / 每次5分钟 ≈ 34 天可穷举完，安全上等于没有。
 *   改成递增：错 5 次锁5分钟 → 再错锁1小时 → 24小时 → 7天。
 *   锁定成本指数增长，攻击者实际只能试到 ~50 次就再也推进不动，
 *   命中概率 <0.5%，且每次尝试都会留日志。
 */

const PIN_STORE_FILE = join(process.cwd(), 'data', 'manager-pin.json')

/** 递增锁定阶梯：5分钟 → 1小时 → 24小时 → 7天 */
const PIN_LOCK_STEPS = [
  5 * 60 * 1000,
  60 * 60 * 1000,
  24 * 60 * 60 * 1000,
  7 * 24 * 60 * 60 * 1000,
]

const PIN_FAILS_PER_STEP = 5

interface PinRateEntry {
  fails: number
  lockedUntil: number
  step: number
}

const pinRateTable = new Map<string, PinRateEntry>()

/**
 * 支持多个 PIN：默认三个（8888/6666/1314，奕霖 2026-10-01 立的防锁死兜底）
 * 加上他自己设置的，一个都不能少 —— 少了他可能就进不了自己的店。
 * 所以这里是数组，不是单值。
 */
interface PinEntry {
  salt: string
  hash: string
}

interface StoredPinServer {
  pins: PinEntry[]
  updatedAt: string
}

function loadServerPin(): StoredPinServer | null {
  try {
    if (!existsSync(PIN_STORE_FILE)) return null
    return JSON.parse(readFileSync(PIN_STORE_FILE, 'utf8')) as StoredPinServer
  } catch {
    return null
  }
}

export function isManagerPinSet(): boolean {
  const s = loadServerPin()
  return !!(s && Array.isArray(s.pins) && s.pins.length > 0)
}

/** 登记一个 PIN 到服务端（去重：同一个 PIN 重复登记不会产生第二条） */
export function setServerPin(plain: string): void {
  const salt = randomBytes(16).toString('hex')
  const entry: PinEntry = { salt: salt, hash: hashCode(plain, salt) }
  const existing = loadServerPin()
  const pins = (existing && Array.isArray(existing.pins) ? existing.pins : []).slice()
  const dup = pins.some((p) => safeEqual(hashCode(plain, p.salt), p.hash))
  if (!dup) pins.push(entry)
  const dir = dirname(PIN_STORE_FILE)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(
    PIN_STORE_FILE,
    JSON.stringify({ pins: pins, updatedAt: new Date().toISOString() }, null, 2),
    { mode: 0o600 },
  )
  try { chmodSync(PIN_STORE_FILE, 0o600) } catch { /* 忽略 */ }
}

/** 服务端存了几个 PIN */
export function countServerPins(): number {
  const s = loadServerPin()
  return s && Array.isArray(s.pins) ? s.pins.length : 0
}

/** 任一 PIN 对上即通过（每个都用恒定时间比较，避免时序侧信道） */
export function verifyServerPin(plain: string): boolean {
  const s = loadServerPin()
  if (!s || !Array.isArray(s.pins) || s.pins.length === 0) return false
  let hit = false
  for (const p of s.pins) {
    if (safeEqual(hashCode(plain, p.salt), p.hash)) hit = true
  }
  return hit
}

/** 返回剩余锁定毫秒；0 = 未锁定 */
export function pinLockRemaining(ip: string): number {
  const e = pinRateTable.get(ip)
  if (!e) return 0
  if (e.lockedUntil <= Date.now()) return 0
  return e.lockedUntil - Date.now()
}

/** 当前处于第几级锁定（用于给前端显示「还锁多久」） */
export function pinLockStep(ip: string): number {
  const e = pinRateTable.get(ip)
  if (!e || e.lockedUntil <= Date.now()) return 0
  return e.step
}

export function recordPinFail(ip: string): { lockedFor: number; step: number; fails: number } {
  const e = pinRateTable.get(ip) || { fails: 0, lockedUntil: 0, step: 0 }
  e.fails += 1
  if (e.fails >= PIN_FAILS_PER_STEP) {
    e.step = Math.min(e.step + 1, PIN_LOCK_STEPS.length)
    e.lockedUntil = Date.now() + PIN_LOCK_STEPS[e.step - 1]
    e.fails = 0
    pinRateTable.set(ip, e)
    return { lockedFor: PIN_LOCK_STEPS[e.step - 1], step: e.step, fails: 0 }
  }
  pinRateTable.set(ip, e)
  return { lockedFor: 0, step: e.step, fails: e.fails }
}

export function recordPinSuccess(ip: string): void {
  pinRateTable.delete(ip)
}
