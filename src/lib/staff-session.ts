/**
 * 店员会话校验（服务端专用）· 2026-10-28
 *
 * 从 staff-auth.ts 拆出来的原因：staff-auth.ts 会被客户端组件 import，
 * 验 PIN 的逻辑不能跟着进前端包。
 *
 * ⭐ 会话形态（2026-10-28 加固）：
 *   老：cookie = JSON.stringify({ pin, expiresAt }) —— 明文 PIN 落在 cookie 里，抓包即得永久密码。
 *   新：cookie = JWT(role=staff, 1h) —— 抓包只拿到 1 小时的会话。
 *   老格式继续兼容（已有 cookie 在过期前仍然有效）。
 */

import { STAFF_PIN_HASHES, PIN_PEPPER } from '@/config/business.secrets'
import { verifyPinHashes } from './pin-hash'
import { verifyToken } from './jwt'

export const STAFF_COOKIE_KEY = 'zhilin-staff-session'
/** 客户端可读的无密钥标记（仅 UI 用：判断「已解锁」） */
export const STAFF_OK_COOKIE = 'zhilin-staff-ok'

function readRawCookie(cookieHeader: string, name: string): string | null {
  const match = cookieHeader
    .split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith(`${name}=`))
  if (!match) return null
  return match.slice(name.length + 1)
}

/**
 * 服务端验证 staff cookie。
 * - JWT 形态：验签 + role 必须是 staff
 * - 老 JSON 形态：{ pin, expiresAt } + PIN 哈希白名单
 */
export function verifyStaffCookie(cookieHeader: string): { success: boolean; pin?: string; error?: string } {
  const raw = readRawCookie(cookieHeader, STAFF_COOKIE_KEY)
  if (!raw) return { success: false, error: '未携带店员会话' }
  let value = raw
  try { value = decodeURIComponent(raw) } catch { /* 原样 */ }

  // ① JWT 形态
  if (value.split('.').length === 3) {
    const payload = verifyToken(value)
    if (payload && String(payload.role || '') === 'staff') {
      return { success: true }
    }
    return { success: false, error: '店员会话无效' }
  }

  // ② 老 JSON 形态
  try {
    const session = JSON.parse(value) as { pin: string; expiresAt: number }
    if (!session?.pin || !session?.expiresAt) return { success: false, error: '会话格式错误' }
    if (Date.now() > session.expiresAt) return { success: false, error: '会话已过期' }
    if (!verifyPinHashes(session.pin, STAFF_PIN_HASHES, PIN_PEPPER)) {
      return { success: false, error: 'PIN 不在白名单' }
    }
    return { success: true, pin: session.pin }
  } catch {
    return { success: false, error: '会话解析失败' }
  }
}
