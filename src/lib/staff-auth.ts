/**
 * 店员身份验证（0-1 阶段：PIN 码）
 *
 * 2026-07-04 00:38 奕霖需求：
 *   - 核销页只给"几个商户的工作人员"使用
 *   - 不用做完整的注册/登录系统（0-1 阶段太重）
 *   - 用 PIN 码 + sessionStorage 简单做
 *
 * 设计：
 *   - 预设 3-5 个店员 PIN（在 config 里）
 *   - 店员输入 PIN → 验证通过 → sessionStorage 存 1h
 *   - sessionStorage 过期 → 重新输入
 *   - 只防君子不防小人（0-1 阶段够用）
 *
 * 后续可升级：
 *   - DB 存 staff 表 + 密码哈希
 *   - 每个商户独立的 staff 列表
 *   - 操作审计日志
 */

import { BUSINESS_CONFIG } from '@/config/business.config'

// 从 config 读 PIN 列表（生产环境可改 .env.local）
const STAFF_PINS: string[] = (BUSINESS_CONFIG as any).staffPins || ['1234', '5678', '9012']

const STORAGE_KEY = 'zhilin_staff_auth'
export const STAFF_COOKIE_KEY = 'zhilin-staff-session'
const SESSION_TTL_MS = 60 * 60 * 1000 // 1 小时

interface StaffSession {
  pin: string
  loginAt: number
  expiresAt: number
}

/** 验证 PIN 是否有效 */
export function verifyStaffPin(pin: string): boolean {
  return STAFF_PINS.includes(pin.trim())
}

/** 存 session */
export function setStaffSession(pin: string): void {
  if (typeof window === 'undefined') return
  const now = Date.now()
  const session: StaffSession = {
    pin,
    loginAt: now,
    expiresAt: now + SESSION_TTL_MS,
  }
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  // 同时设 cookie 让服务端能验证（0-1 阶段简化）
  // cookie 值 = JSON.stringify({ pin, expiresAt })
  // 注：cookie 是明文验证，仅限单店内网使用
  const cookieValue = encodeURIComponent(JSON.stringify({ pin, expiresAt: session.expiresAt }))
  document.cookie = `${STAFF_COOKIE_KEY}=${cookieValue}; path=/; max-age=${Math.floor(SESSION_TTL_MS / 1000)}; SameSite=Lax`
}

/** 读 session */
export function getStaffSession(): StaffSession | null {
  if (typeof window === 'undefined') return null
  const raw = sessionStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    const session = JSON.parse(raw) as StaffSession
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

/** 是否已认证 */
export function isStaffAuthed(): boolean {
  return getStaffSession() !== null
}

/** 退出登录 */
export function clearStaffSession(): void {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(STORAGE_KEY)
  document.cookie = `${STAFF_COOKIE_KEY}=; path=/; max-age=0`
}

/**
 * 服务端验证 staff cookie（2026-07-14 补）
 * 仅在 Node.js 环境调用（用于 API route）
 */
export function verifyStaffCookie(cookieHeader: string): { success: boolean; pin?: string; error?: string } {
  // ⭐ MEMORY §304 v0.8.44 (2026-08-29 13:08 奕霖) — 加回 PIN 验证:
  // v0.8.43 砍 StaffGate + verifyStaffCookie 接受 user JWT,任何登录用户都能进收银台
  // v0.8.44 还原:只接受 staff-session cookie(从 StaffGate 输 PIN 获得)
  // 效果:从 /me 进 /retail 必须先输 PIN(StaffGate 弹窗)→ 1 关验证
  const match = cookieHeader.split(';').map(s => s.trim()).find(s => s.startsWith(`${STAFF_COOKIE_KEY}=`))
  if (!match) return { success: false, error: '未携带店员会话' }
  try {
    const raw = match.split('=')[1]
    const decoded = decodeURIComponent(raw)
    const session = JSON.parse(decoded) as { pin: string; expiresAt: number }
    if (!session?.pin || !session?.expiresAt) return { success: false, error: '会话格式错误' }
    if (Date.now() > session.expiresAt) return { success: false, error: '会话已过期' }
    if (!STAFF_PINS.includes(session.pin.trim())) return { success: false, error: 'PIN 不在白名单' }
    return { success: true, pin: session.pin }
  } catch {
    return { success: false, error: '会话解析失败' }
  }
}

/** 剩余时间（分钟） */
export function getSessionRemainingMinutes(): number {
  const session = getStaffSession()
  if (!session) return 0
  return Math.max(0, Math.floor((session.expiresAt - Date.now()) / 60000))
}
