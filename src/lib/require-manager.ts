/**
 * 店长鉴权 —— v1.1.55 · 2026-10-08 清禾
 *
 * 🔴 背景：/api/members 全系列零鉴权，只校验 merchantId 前缀 'm_'。
 *    而 m_barber_001 不算秘密 —— 任何人知道就能：
 *      - GET  读全部会员余额 / 消费 / 流水
 *      - POST 开卡
 *      - POST /api/members/[phone] {action:'recharge'} 给任意手机号充值
 *    等于开了一条免单通道。
 *
 * ⚠️ 为什么 cookie 和 header 都认：
 *    会员面板和 MemberQuickSheet 用的是裸 fetch，没带 Authorization 头。
 *    只认 header 会把店长自己锁在外面。只认 cookie 则拦不住外部脚本。
 *    双通道 = 前端不用改，攻击面也堵上。
 */

import { NextRequest } from 'next/server'
import { extractToken, verifyToken, JwtPayload } from './jwt'
import { parseCookie } from './cookie'

/** 允许操作会员/储值的角色。库里实际取值：店长 / 普通 / VIP / 金卡 / chronic */
const MANAGER_ROLES = ['店长']

export interface AuthResult {
  ok: boolean
  payload?: JwtPayload
  error?: string
  status?: number
}

/** 取出请求里的 token：优先 Authorization 头，退回 zhilin-token cookie */
function readToken(request: NextRequest): string | null {
  const header = extractToken(request.headers.get('authorization'))
  if (header) return header
  const cookieToken = parseCookie(request.headers.get('cookie'), 'zhilin-token')
  if (!cookieToken) return null
  try {
    return decodeURIComponent(cookieToken)
  } catch {
    return cookieToken
  }
}

/** 只要求登录（任意角色）—— 用于读操作 */
export function requireLogin(request: NextRequest): AuthResult {
  const token = readToken(request)
  if (!token) return { ok: false, error: '请先登录', status: 401 }
  const payload = verifyToken(token)
  if (!payload) return { ok: false, error: '登录已过期，请重新登录', status: 401 }
  return { ok: true, payload }
}

/** 要求店长角色 —— 用于改钱（充值/扣款/调整/冻结/开卡）与读全部会员 */
export function requireManager(request: NextRequest): AuthResult {
  const r = requireLogin(request)
  if (!r.ok) return r
  const role = String(r.payload?.role || '').trim()
  if (!MANAGER_ROLES.includes(role)) {
    return { ok: false, error: '需要店长权限', status: 403 }
  }
  return r
}
