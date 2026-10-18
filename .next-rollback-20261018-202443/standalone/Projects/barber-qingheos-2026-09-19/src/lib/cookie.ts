/**
 * Cookie 工具（兼容 Next.js 16 + Turbopack cookies() API bug）
 * 直接用 request.headers.cookie 解析 + NextResponse.cookies.set 设置
 */

export function parseCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=')
    if (k === name) return decodeURIComponent(rest.join('='))
  }
  return undefined
}

export interface CookieOptions {
  maxAge?: number
  path?: string
  sameSite?: 'lax' | 'strict' | 'none'
  httpOnly?: boolean
  secure?: boolean
}

/**
 * 构造 Set-Cookie header value
 */
export function buildSetCookie(
  name: string,
  value: string,
  opts: CookieOptions = {},
): string {
  const parts = [`${name}=${encodeURIComponent(value)}`]
  parts.push(`Path=${opts.path ?? '/'}`)
  if (opts.maxAge !== undefined) parts.push(`Max-Age=${opts.maxAge}`)
  if (opts.httpOnly !== false) parts.push('HttpOnly')
  if (opts.sameSite) parts.push(`SameSite=${opts.sameSite.charAt(0).toUpperCase() + opts.sameSite.slice(1)}`)
  if (opts.secure) parts.push('Secure')
  return parts.join('; ')
}
