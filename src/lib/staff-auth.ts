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

// ⭐ 本文件会被客户端组件 import —— **不能** import 任何服务端模块
//   （staff-session.ts → business.secrets → PIN 哈希，会被打进浏览器包）。
//   所以 cookie 名字在这里本地定义一份（纯字符串，无密钥）。
const STAFF_COOKIE_KEY = 'zhilin-staff-session'
const STAFF_OK_COOKIE = 'zhilin-staff-ok'

// ⭐ 2026-10-28：本文件会被客户端组件（StaffGate.tsx）import，
//   所以这里**不能**再 import 任何带密钥的模块（config/business.secrets）。
//   验 PIN 的逻辑搬到服务端专用文件：
//     · verifyStaffPin    → src/lib/staff-pin.ts
//     · verifyStaffCookie → src/lib/staff-session.ts
//   否则 6 位 PIN 的哈希会被打进浏览器包，可离线爆破。

const STORAGE_KEY = 'zhilin_staff_auth'
export { STAFF_COOKIE_KEY }
const SESSION_TTL_MS = 60 * 60 * 1000 // 1 小时

interface StaffSession {
  pin: string
  loginAt: number
  expiresAt: number
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

/* ⚠️ 服务端验证 staff cookie 请直接 import { verifyStaffCookie } from '@/lib/staff-session'。
   这里**故意不再导出** —— 本文件会被客户端组件 import，
   转出等于把密钥材料拖进前端包。 */


/**
 * 是否存在「已解锁」标记 cookie（zhilin-staff-ok）。
 *
 * ⭐ 2026-10-28：真正的会话 cookie 是 httpOnly，浏览器 JS 读不到，
 *   所以服务端额外下发一个**不含任何密钥**的标记 cookie 给 UI 判断用。
 */
export function hasStaffMarker(): boolean {
  if (typeof document === 'undefined') return false
  const m = document.cookie.match(new RegExp(`(^| )${STAFF_OK_COOKIE}=([^;]+)`))
  return !!m
}

/** 剩余时间（分钟） */
export function getSessionRemainingMinutes(): number {
  const session = getStaffSession()
  if (!session) return 0
  return Math.max(0, Math.floor((session.expiresAt - Date.now()) / 60000))
}
