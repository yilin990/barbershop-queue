/**
 * ⭐ 2026-09-20 14:26 奕霖立：理发店店长模式 PIN 认证
 *
 * 设计：
 * - PIN 长度：4 位数字
 * - 自动锁定：12h 默认（可自定义 30min/1h/2h/6h/12h/24h）
 * - 存储：localStorage（hash + salt，Web Crypto SHA-256）
 * - 错误限制：5 次错误 → 锁 1 分钟
 * - 忘记 PIN：MVP 不做（清浏览器缓存重设）
 */

const STORAGE_KEY = 'barber_manager_pin_v1'
const LAST_AUTH_KEY = 'barber_manager_last_auth_v1'
const REMIND_KEY = 'barber_manager_pin_remind_v1'

export type LockDuration = number

export const LOCK_DURATIONS: { label: string; value: number }[] = [
  { label: '30 分钟', value: 30 * 60 * 1000 },
  { label: '1 小时', value: 60 * 60 * 1000 },
  { label: '2 小时', value: 2 * 60 * 60 * 1000 },
  { label: '6 小时', value: 6 * 60 * 60 * 1000 },
  { label: '12 小时（推荐）', value: 12 * 60 * 60 * 1000 },
  { label: '24 小时', value: 24 * 60 * 60 * 1000 },
]

interface StoredPin {
  hash: string
  salt: string
  lockDuration: LockDuration
  createdAt: number
}

interface RemindState {
  dismissed: boolean
  dismissedAt?: number
}

/* ========== Web Crypto helpers ========== */

function generateSalt(): string {
  const arr = new Uint8Array(16)
  crypto.getRandomValues(arr)
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function hashPin(pin: string, salt: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(pin + ':' + salt)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

/* ========== Public API ========== */

export function hasPin(): boolean {
  if (typeof window === 'undefined') return false
  return !!localStorage.getItem(STORAGE_KEY)
}

export async function savePin(pin: string, lockDuration: LockDuration): Promise<void> {
  const salt = generateSalt()
  const hash = await hashPin(pin, salt)
  const stored: StoredPin = { hash, salt, lockDuration, createdAt: Date.now() }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
  setLastAuthTime()
}

export async function verifyPin(pin: string): Promise<boolean> {
  if (typeof window === 'undefined') return false
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return false
  const stored: StoredPin = JSON.parse(raw)
  const hash = await hashPin(pin, stored.salt)
  return hash === stored.hash
}

export function getLockDuration(): LockDuration {
  if (typeof window === 'undefined') return 12 * 60 * 60 * 1000
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return 12 * 60 * 60 * 1000
  const stored: StoredPin = JSON.parse(raw)
  return stored.lockDuration
}

export function setLastAuthTime(): void {
  localStorage.setItem(LAST_AUTH_KEY, Date.now().toString())
}

export function getLastAuthTime(): number {
  if (typeof window === 'undefined') return 0
  const raw = localStorage.getItem(LAST_AUTH_KEY)
  return raw ? parseInt(raw, 10) : 0
}

export function isLockExpired(): boolean {
  const lastAuth = getLastAuthTime()
  if (!lastAuth) return true
  const duration = getLockDuration()
  return Date.now() - lastAuth > duration
}

export function isPinSetAndValid(): boolean {
  // 检查 PIN 已设置且上次认证未过期
  return hasPin() && !isLockExpired()
}

/* ========== 免密宽限期 ⭐ 2026-09-20 14:37 奕霖拍板：锁定时长 = 免密宽限 ==========
 * 店长频繁点击，不要老输入密码
 * 宽限期内退出再开启：直接切换，无需 PIN
 */
export function isInGracePeriod(): boolean {
  const lastAuth = getLastAuthTime()
  if (!lastAuth) return false
  const duration = getLockDuration()
  return Date.now() - lastAuth < duration
}

export function getGraceRemainingMs(): number {
  const lastAuth = getLastAuthTime()
  if (!lastAuth) return 0
  const duration = getLockDuration()
  const remain = duration - (Date.now() - lastAuth)
  return remain > 0 ? remain : 0
}

/* ========== Change PIN ========== */

export async function changePin(oldPin: string, newPin: string, newLockDuration: LockDuration): Promise<boolean> {
  const ok = await verifyPin(oldPin)
  if (!ok) return false
  await savePin(newPin, newLockDuration)
  return true
}

/* ========== Reset (MVP 兜底：忘记 PIN 时清缓存) ========== */

export function clearPin(): void {
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem(LAST_AUTH_KEY)
}

/* ========== Remind (首次进店提示) ========== */

export function getRemindState(): RemindState {
  if (typeof window === 'undefined') return { dismissed: false }
  const raw = localStorage.getItem(REMIND_KEY)
  if (!raw) return { dismissed: false }
  return JSON.parse(raw)
}

export function dismissRemind(): void {
  const state: RemindState = { dismissed: true, dismissedAt: Date.now() }
  localStorage.setItem(REMIND_KEY, JSON.stringify(state))
}

/* ========== Error lock (5 次错锁 1 分钟) ========== */

const ERROR_KEY = 'barber_manager_error_v1'
const ERROR_THRESHOLD = 5
const ERROR_LOCK_MS = 60 * 1000

interface ErrorState {
  count: number
  lockedUntil?: number
}

export function getErrorState(): ErrorState {
  if (typeof window === 'undefined') return { count: 0 }
  const raw = localStorage.getItem(ERROR_KEY)
  if (!raw) return { count: 0 }
  return JSON.parse(raw)
}

export function recordError(): ErrorState {
  const prev = getErrorState()
  const next: ErrorState = { count: prev.count + 1 }
  if (next.count >= ERROR_THRESHOLD) {
    next.lockedUntil = Date.now() + ERROR_LOCK_MS
    next.count = 0
  }
  localStorage.setItem(ERROR_KEY, JSON.stringify(next))
  return next
}

export function clearErrors(): void {
  localStorage.removeItem(ERROR_KEY)
}

export function isErrorLocked(): boolean {
  const state = getErrorState()
  if (!state.lockedUntil) return false
  return Date.now() < state.lockedUntil
}

export function getErrorLockRemainingMs(): number {
  const state = getErrorState()
  if (!state.lockedUntil) return 0
  const remain = state.lockedUntil - Date.now()
  return remain > 0 ? remain : 0
}