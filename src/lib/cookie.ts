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
 * 登录类 cookie 是否加 Secure。
 *
 * 默认加（生产走 https 代理，浏览器只在 https 下才发 Secure cookie）。
 * 例外：局域网直连 http://<内网IP>:3070 调试时，Secure cookie 会被浏览器丢掉 →
 * 这种情况用环境变量 COOKIE_SECURE=false 临时关掉。
 * （localhost 例外：Chrome/Firefox 把 localhost 当安全上下文，Secure cookie 照常工作。）
 */
export function cookieSecure(req?: { headers: Headers; nextUrl?: { protocol?: string } } | null): boolean {
  const v = (process.env.COOKIE_SECURE || '').trim().toLowerCase()
  if (v === 'false' || v === '0' || v === 'off') return false
  if (v === 'true' || v === '1' || v === 'on') return true
  // 默认：按「本次请求是不是 https」决定。
  //   为什么不能一律 true：理发店是「店内 Wi-Fi 直连 Mac」的场景（http://192.168.x.x:3070），
  //   浏览器在 http 页面上一律丢弃 Secure cookie → 顾客登录态直接消失（比不加密还糟）。
  //   走 cloudflared 的公网入口是 https → 自动加 Secure。
  if (req) {
    const proto = (req.headers?.get('x-forwarded-proto') || '').split(',')[0].trim()
    if (proto) return proto === 'https'
    const urlProto = req.nextUrl?.protocol
    if (urlProto) return urlProto === 'https:'
  }
  return true
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
