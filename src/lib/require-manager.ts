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
import { prisma } from './db'

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

/** 要求店长角色 —— 用于改钱（充值/扣款/调整/冻结/开卡）与读全部会员。
 *
 * ⭐ v1.1.58 2026-10-08 奕霖截图反馈「需要店长权限」后改：
 *   原来只信 JWT 里的 role 快照。JWT 有效期 30 天，role 是签发那一刻写进去的，
 *   所以「角色后来升了但旧 token 还在用」会一直 403 ——
 *   奕霖自己的账号 DB 里明明是「店长」，却在自己面板上被拦。
 *   现在改成以 DB 实时 role 为准：改角色立刻生效，不用等 token 过期或重新登录。
 */
export async function requireManager(request: NextRequest): Promise<AuthResult> {
  const r = requireLogin(request)
  if (!r.ok) return r

  const userId = String(r.payload?.userId || '').trim()
  if (!userId) return { ok: false, error: '登录已过期，请重新登录', status: 401 }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  })
  if (!user) return { ok: false, error: '用户不存在，请重新登录', status: 401 }

  const role = String(user.role || '').trim()
  if (!MANAGER_ROLES.includes(role)) {
    return { ok: false, error: '需要店长权限', status: 403 }
  }
  return { ok: true, payload: { ...(r.payload as JwtPayload), role: user.role } }
}
