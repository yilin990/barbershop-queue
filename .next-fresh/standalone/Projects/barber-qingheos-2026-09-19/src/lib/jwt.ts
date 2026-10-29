import jwt from 'jsonwebtoken'
import fs from 'fs'
import path from 'path'

/**
 * JWT 密钥 · 2026-10-28 加固
 *
 * 🔴 原来这里是 `process.env.JWT_SECRET || 'zhilin-pharmacy-secret-2026'` ——
 *   兜底密钥写死在源码里 = 密钥公开（git 历史里也有），
 *   任何人都能自己签一个 role=admin 的 token，整套鉴权直接形同虚设。
 *
 *   现在改成 fail-closed：
 *     1. 优先读环境变量 JWT_SECRET
 *     2. 其次读 <项目根>/data/jwt.secret 文件（运维放，不进 git）
 *     3. 都没有 → 直接抛错，宁可服务不可用，也不给「假密钥兜底」留后门
 *
 *   ⚠️ 部署影响（必须由主控/运维执行，代码不负责）：
 *     生产进程必须提供 JWT_SECRET，否则所有需要签发/校验 token 的接口会 500。
 *     例：PORT=3070 ... JWT_SECRET="$(openssl rand -hex 32)" node server.js
 *     或把密钥写进 data/jwt.secret（chmod 600）。
 *     换密钥 = 现有登录态全部失效一次（用户重新登录一次即可）。
 */

const JWT_EXPIRES_IN = '30d'

export interface JwtPayload {
  userId: string
  phone: string
  role: string
  /**
   * 'full' = 正常登录态（短信验证码 / 一键登录 / 店长 PIN 签发）
   * 'soft' = 软会话：顾客预约后签发，只能读「自己手机号」的数据，不能碰门店侧
   */
  scope?: 'full' | 'soft'
}

function readSecretFromFile(): string | null {
  try {
    const root = process.cwd().includes(path.join('.next', 'standalone'))
      ? process.cwd().slice(0, process.cwd().indexOf(path.join('.next', 'standalone')))
      : process.cwd()
    const file = path.join(root, 'data', 'jwt.secret')
    if (!fs.existsSync(file)) return null
    const v = fs.readFileSync(file, 'utf8').trim()
    return v.length >= 16 ? v : null
  } catch {
    return null
  }
}

let cachedSecret: string | null = null

/** 取密钥；取不到就抛错（fail-closed） */
export function jwtSecret(): string {
  if (cachedSecret) return cachedSecret
  const fromEnv = (process.env.JWT_SECRET || '').trim()
  if (fromEnv.length >= 16) {
    cachedSecret = fromEnv
    return cachedSecret
  }
  const fromFile = readSecretFromFile()
  if (fromFile) {
    cachedSecret = fromFile
    return cachedSecret
  }
  throw new Error(
    '[jwt] 缺少 JWT_SECRET —— 已 fail-closed 拒绝签发/校验 token。' +
    '请在进程环境里设置 JWT_SECRET（>=16 位）或写入 <项目根>/data/jwt.secret（chmod 600）。',
  )
}

/**
 * Sign a JWT token for a user
 */
export function signToken(payload: JwtPayload, expiresIn: string = JWT_EXPIRES_IN): string {
  const body: JwtPayload = { ...payload, scope: payload.scope || 'full' }
  return jwt.sign(body, jwtSecret(), { expiresIn } as jwt.SignOptions)
}

/**
 * 签发「软会话」token —— 顾客预约（无需登录）后由服务端签发，
 * 绑定该手机号，只能读自己手机号的数据（不能读门店经营数据）。
 */
export function signSoftToken(phone: string): string {
  return jwt.sign(
    { userId: `soft_${phone}`, phone, role: 'guest', scope: 'soft' },
    jwtSecret(),
    { expiresIn: '7d' },
  )
}

/**
 * Verify and decode a JWT token
 * Returns null if invalid or expired
 */
export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, jwtSecret()) as JwtPayload
    return decoded
  } catch {
    return null
  }
}

/**
 * Extract token from Authorization header
 */
export function extractToken(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null
  return authHeader.slice(7)
}
