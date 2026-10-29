/**
 * 商户后台 PIN 会话（客户端安全的部分）· 2026-10-28 加固
 *
 * ⚠️ 本文件会被客户端组件 import（AdminGate / AdminLayout / me/points 页），
 *    所以这里**不能**再 import 任何带密钥的模块。
 *    验 PIN 的判定搬到服务端：src/lib/admin-pin.ts + POST /api/admin/auth/admin-pin。
 *
 * 跟旧版的差别：
 *   旧：verifyAdminPin(pin) 在浏览器里比对哈希 → 哈希被打进前端包 → 6 位 PIN 可离线爆破
 *   新：浏览器只负责「提交 PIN」，服务端校验并下发 httpOnly 会话 cookie
 */

const STORAGE_KEY = 'zhilin-admin-auth'
const SESSION_TTL_MS = 60 * 60 * 1000 // 1 小时

/** 客户端可见的「已解锁」标记（不含任何密钥，纯粹给 UI 用） */
export const ADMIN_OK_COOKIE = 'zhilin-admin-ok'

interface AdminSession {
  loginAt: number
  expiresAt: number
}

/**
 * 记录「后台已解锁」的本地状态。
 *
 * ⭐ 2026-10-28：**不再保存 PIN**。
 *   旧版把明文 PIN 放进 sessionStorage（XSS 可读）；现在真正的凭证是服务端下发的
 *   httpOnly cookie，这里只留时间戳，纯粹给 UI 用。
 */
export function setAdminSession(_pin?: string): void {
  if (typeof window === 'undefined') return
  const now = Date.now()
  const session: AdminSession = {
    loginAt: now,
    expiresAt: now + SESSION_TTL_MS,
  }
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  // ⭐ 2026-10-28：不再由前端写 zhilin-admin-token（里面有明文 PIN，XSS 可读）。
  //   真正的凭证由服务端 /api/admin/auth/admin-pin 以 httpOnly cookie 下发。
  //   前端只写一个不含密钥的标记，给 UI 判断「已解锁」。
  document.cookie = `${ADMIN_OK_COOKIE}=1; Path=/; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}; SameSite=Lax`
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

/**
 * 是否已解锁（仅 UI 判断用）。
 * ⭐ 真正的判定永远在服务端（httpOnly cookie + 每次请求复核）。
 */
export function isAdminAuthed(): boolean {
  if (typeof window === 'undefined') return false
  if (getAdminSession() !== null) return true
  const m = document.cookie.match(new RegExp(`(^| )${ADMIN_OK_COOKIE}=([^;]+)`))
  return !!m
}

export function clearAdminSession(): void {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(STORAGE_KEY)
  document.cookie = `${ADMIN_OK_COOKIE}=; Path=/; Max-Age=0`
}

export function getAdminSessionRemainingMinutes(): number {
  const s = getAdminSession()
  if (!s) return 0
  return Math.max(0, Math.floor((s.expiresAt - Date.now()) / 60000))
}
