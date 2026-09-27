/**
 * 商户后台 PIN 验证（奕霖 2026-07-08 22:27）
 *
 * 跟店员 PIN 分离：
 * - 店员 PIN（staffPins） → 核销取货码
 * - 商户后台 PIN（adminPins） → 进 /admin 管理
 *
 * 设计：
 * - 预设 3-4 个老板/店长 PIN（在 config 里）
 * - 输 PIN → 验证通过 → sessionStorage 存 1h
 * - 过期 → 重新输入
 * - 不跟用户登录 token 混（用户登录 ≠ 商户管理权限）
 *
 * 为什么单独一套：
 * - 店员是店内服务，PIN 给店长发
 * - 商户后台是经营数据 + 反馈处置，PIN 老板自己握着
 * - 一个是"做"，一个是"管"，**权限分离**
 */

import { BUSINESS_CONFIG } from '@/config/business.config'

// 从 config 读（生产环境可改 .env.local）
const ADMIN_PINS: string[] = (BUSINESS_CONFIG as any).adminPins || ['8888', '6666', '1314']

const STORAGE_KEY = 'zhilin-admin-auth'
const SESSION_TTL_MS = 60 * 60 * 1000 // 1 小时

interface AdminSession {
  pin: string
  loginAt: number
  expiresAt: number
}

export function verifyAdminPin(pin: string): boolean {
  return ADMIN_PINS.includes(pin.trim())
}

export function setAdminSession(pin: string): void {
  if (typeof window === 'undefined') return
  const now = Date.now()
  const session: AdminSession = {
    pin,
    loginAt: now,
    expiresAt: now + SESSION_TTL_MS,
  }
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  // 同步写 cookie，供服务端 API PATCH/POST 验证（不是 httpOnly，是同步标志）
  document.cookie = `zhilin-admin-token=${encodeURIComponent('pin-' + pin)}; Path=/; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}; SameSite=Lax`
}

export function getAdminSession(): AdminSession | null {
  if (typeof window === 'undefined') return null
  const raw = sessionStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    const session = JSON.parse(raw) as AdminSession
    if (Date.now() > session.expiresAt) {
      sessionStorage.removeItem(STORAGE_KEY)
      return null
    }
    return session
  } catch {
    sessionStorage.removeItem(STORAGE_KEY)
    return null
  }
}

export function isAdminAuthed(): boolean {
  if (typeof window === 'undefined') return false
  if (getAdminSession() !== null) return true
  // cookie fallback: zhilin-admin-token=pin-XXXX
  const m = document.cookie.match(/zhilin-admin-token=([^;]+)/)
  if (m) {
    const raw = decodeURIComponent(m[1])
    if (raw.startsWith('pin-')) {
      const pin = raw.slice(4)
      if (ADMIN_PINS.includes(pin)) return true
    }
  }
  return false
}

export function clearAdminSession(): void {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(STORAGE_KEY)
  document.cookie = 'zhilin-admin-token=; Path=/; Max-Age=0'
}

export function getAdminSessionRemainingMinutes(): number {
  const session = getAdminSession()
  if (!session) return 0
  return Math.max(0, Math.floor((session.expiresAt - Date.now()) / 60000))
}
