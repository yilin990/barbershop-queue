/**
 * Admin JWT 鉴权（Day 4 落地 · 奕霖 2026-07-25）
 *
 * 替代所有 inline checkAdminAuth() 的统一鉴权层：
 * - 读 cookie zhilin-admin-token=pin-XXXX OR jwttoken=XXXX
 * - 验 PIN（白名单）或 verify JWT（Bearer token）
 * - 返回 { ok, role } 供 route 用
 *
 * 不替换登录流程（已有 admin-auth.ts setAdminSession + lib/jwt.ts signToken）
 * 这里只把"在每个 route 里重复的鉴权抽出来"，并支持真 JWT。
 *
 * 迁移路径（最小破坏）：
 * 1. 现有 cookie `zhilin-admin-token=pin-XXXX` → 仍兼容（PIN 直接通过）
 * 2. 新增 `zhilin-admin-jwt=XXXX` → 真 JWT，可解密回 admin payload
 * 3. 路由调 verifyAdminRequest() 一次，全站统一
 */

import type { NextRequest } from 'next/server'
import { verifyCredentialPin } from './staff-credential'
import { verifyToken } from './jwt'

// ⭐ 2026-10-12：服务端鉴权改为查数据库（scrypt 哈希，方案 B）
// 明文 PIN 已从 config 移除；本文件仅被 src/app/api/**/route.ts 引用，确认为纯服务端

export type AdminAuthResult =
  | { ok: true; via: 'pin' | 'jwt'; pin?: string; payload?: Record<string, any> }
  | { ok: false; reason: 'no_token' | 'invalid_pin' | 'invalid_jwt'; status: 401 | 403 }

const ADMIN_JWT_COOKIE = 'zhilin-admin-jwt'
const ADMIN_PIN_COOKIE = 'zhilin-admin-token'
const STAFF_PIN_COOKIE = 'zhilin-staff-token'

function readCookie(req: NextRequest, name: string): string | null {
  return req.cookies.get(name)?.value
    ?? req.headers.get('cookie')?.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))?.[1]
    ?? null
}

export function verifyAdminRequest(req: NextRequest): AdminAuthResult {
  // 优先级 1：真 JWT cookie（专用 zhilin-admin-jwt 名字）
  const jwtToken = readCookie(req, ADMIN_JWT_COOKIE)
    ?? req.headers.get('authorization')?.slice(7).trim()
    ?? null
  if (jwtToken) {
    const payload = verifyToken(jwtToken)
    if (payload && (payload.role === 'admin' || payload.role === 'merchant' || payload.role === 'manager')) {
      return { ok: true, via: 'jwt', payload: payload as any }
    }
    return { ok: false, reason: 'invalid_jwt', status: 401 }
  }

  // 优先级 2：zhilin-admin-token cookie（AdminLogin 真商户登录写在这）
  //   - 形态 A：JWT（verify-code 路由 signToken 后写在这里）
  //   - 形态 B：pin-XXXX（legacy PIN-only 登录）
  const tokenCookie = readCookie(req, ADMIN_PIN_COOKIE)
  if (tokenCookie) {
    if (tokenCookie.startsWith('pin-')) {
      // legacy PIN 模式
      const pin = tokenCookie.slice(4)
      if (verifyCredentialPin('admin', pin)) return { ok: true, via: 'pin', pin }
      return { ok: false, reason: 'invalid_pin', status: 403 }
    }
    // JWT 模式（admin-login 验证码登录）
    const payload = verifyToken(tokenCookie)
    if (payload && (payload.role === 'admin' || payload.role === 'merchant' || payload.role === 'manager' || payload.role === 'staff')) {
      return { ok: true, via: 'jwt', payload: payload as any }
    }
    return { ok: false, reason: 'invalid_jwt', status: 401 }
  }

  // 优先级 3：店员 PIN cookie（StaffGate 核销场景，pin-XXXX 格式）
  const staffCookie = readCookie(req, STAFF_PIN_COOKIE)
  if (staffCookie && staffCookie.startsWith('pin-')) {
    const pin = staffCookie.slice(4)
    if (verifyCredentialPin('staff', pin)) return { ok: true, via: 'pin', pin }
  }

  // ⭐ 优先级 4：StaffGate 实际写的 cookie（zhilin-staff-session，JSON {pin, expiresAt} 格式）
  //   奕霖 2026-08-03 21:00 反馈"订单没有数据"根因：staff cookie 名字 + 格式不匹配
  const staffSessionCookie = readCookie(req, 'zhilin-staff-session')
  if (staffSessionCookie) {
    let raw = staffSessionCookie
    try { raw = decodeURIComponent(staffSessionCookie) } catch { /* 原样 */ }
    // ⭐ 2026-10-28 新形态：JWT(role=staff, 1h)（cookie 里不再放明文 PIN）
    if (raw.split('.').length === 3) {
      const payload = verifyToken(raw)
      if (payload && String(payload.role || '') === 'staff') {
        return { ok: true, via: 'jwt', payload: payload as any }
      }
    }
    // 老形态：JSON { pin, expiresAt }
    try {
      const parsed = JSON.parse(raw)
      if (parsed.pin && verifyCredentialPin('staff', parsed.pin) && parsed.expiresAt > Date.now()) {
        return { ok: true, via: 'pin', pin: parsed.pin }
      }
    } catch {}
  }

  return { ok: false, reason: 'no_token', status: 401 }
}

/**
 * 返回 Response，未鉴权时给到 caller 直接返回
 */
export function unauthorized(result: Extract<AdminAuthResult, { ok: false }>) {
  return Response.json(
    { success: false, error: result.reason === 'no_token' ? '请先登录商户后台' : '鉴权失败：' + result.reason },
    { status: result.status }
  )
}
