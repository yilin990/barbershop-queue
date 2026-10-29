/**
 * api-client.ts — 统一前端 fetch wrapper（Day 5 奕霖 2026-07-25）
 *
 * 解决问题：
 *   1. 自动给 /api/admin* 加 admin JWT（Bearer or cookie 透明）
 *   2. 401 自动跳 /admin/login（除非 silent）
 *   3. timeout + 错误统一 toast
 *   4. 返回 {ok, status, data, error} 不抛异常
 *
 * 用法：
 *   const r = await api('/api/admin/products-list', { method: 'GET' })
 *   if (r.ok) { const list = r.data.items }
 *   const r2 = await api('/api/orders', { method: 'POST', body: { ... } })
 */
import { toast } from './ui-bus'

const DEFAULT_TIMEOUT_MS = 15_000
const ADMIN_PATHS = ['/api/admin', '/api/admin-v2']
const AUTH_PATHS = ['/api/auth/me'] // 用户态自动带 Bearer

export type ApiMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface ApiOptions {
  method?: ApiMethod
  /** JSON body — 自动 JSON.stringify + Content-Type */
  body?: unknown
  /** FormData（上传）— body 会被忽略 */
  formData?: FormData
  /** 额外 headers（会覆盖默认） */
  headers?: Record<string, string>
  /** 默认 15s */
  timeoutMs?: number
  /** 默认自动判定（路径以 /api/admin* 开头时） */
  withAdminAuth?: boolean
  /** 默认自动判定（路径以 /api/auth/* 开头时） */
  withUserAuth?: boolean
  /** 失败不弹 toast（401 / 网络 / 5xx 都不弹） */
  silent?: boolean
  /** fetch credentials，默认 same-origin（自动带 cookie） */
  credentials?: RequestCredentials
}

export type ApiResult<T = any> = {
  ok: boolean
  status: number
  data?: T
  error?: string
  /** 401 时携带，便于调用方决定是否重登录 */
  authExpired?: boolean
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))
  return m ? decodeURIComponent(m[1]) : null
}

function needsAdminAuth(path: string): boolean {
  return ADMIN_PATHS.some(p => path.startsWith(p))
}

function needsUserAuth(path: string): boolean {
  if (path.startsWith('/api/admin')) return false // 管理员优先于用户
  if (path.startsWith('/api/orders') || path.startsWith('/api/groups')
      || path.startsWith('/api/points') || path.startsWith('/api/cart')) return true
  return AUTH_PATHS.some(p => path.startsWith(p))
}

function buildHeaders(path: string, opts: ApiOptions): Headers {
  const headers = new Headers(opts.headers || {})
  if (!headers.has('Accept')) headers.set('Accept', 'application/json')
  return headers
}

async function doFetch(path: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    return await fetch(path, { ...init, signal: ctrl.signal })
  } finally {
    clearTimeout(t)
  }
}

/**
 * 主调用函数
 */
export async function api<T = any>(path: string, opts: ApiOptions = {}): Promise<ApiResult<T>> {
  const {
    method = 'GET',
    body,
    formData,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    withAdminAuth,
    withUserAuth,
    silent = false,
    credentials = 'same-origin',
  } = opts

  const headers = buildHeaders(path, opts)

  // Body 处理
  let finalBody: BodyInit | undefined
  if (formData) {
    finalBody = formData
    // FormData 自动带 boundary，Content-Type 让浏览器设
  } else if (body !== undefined) {
    finalBody = JSON.stringify(body)
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  }

  // 自动加 Authorization
  const isAdmin = withAdminAuth ?? needsAdminAuth(path)
  const isUser = withUserAuth ?? needsUserAuth(path)
  if (isAdmin && !headers.has('Authorization')) {
    const token = readCookie('zhilin-admin-token')
    if (token && !token.startsWith('pin-')) {
      // 跳过 PIN 模式 cookie（legacy 不发 Bearer）
      headers.set('Authorization', `Bearer ${token}`)
    }
  }
  if (isUser && !headers.has('Authorization')) {
    const token = readCookie('zhilin-token') || readCookie('zhilin-user-token')
    if (token) headers.set('Authorization', `Bearer ${token}`)
  }

  let res: Response
  try {
    res = await doFetch(path, {
      method,
      headers,
      body: finalBody,
      credentials,
    }, timeoutMs)
  } catch (e: any) {
    const isAbort = e?.name === 'AbortError'
    const msg = isAbort ? '请求超时，请检查网络' : ('网络错误：' + (e?.message ?? 'unknown'))
    if (!silent) toast.error(msg)
    return { ok: false, status: 0, error: msg }
  }

  const status = res.status
  let data: any = null
  const ctype = res.headers.get('content-type') || ''
  if (ctype.includes('application/json')) {
    try {
      data = await res.json()
    } catch {
      data = null
    }
  } else if (ctype.includes('text/')) {
    data = await res.text()
  } else {
    // 二进制 / blob
    try { data = await res.blob() } catch { data = null }
  }

  // 401 / 403 处理
  if (status === 401 && isAdmin) {
    if (!silent) {
      toast.warn('登录已过期，正在跳转登录页...')
      // 跳登录（保留 next 参数）
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/admin/login')) {
        const next = encodeURIComponent(window.location.pathname + window.location.search)
        setTimeout(() => { window.location.href = `/admin/login?next=${next}` }, 600)
      }
    }
    return { ok: false, status, error: data?.error || '请先登录商户后台', authExpired: true }
  }

  // 业务侧 success=false
  if (data && typeof data === 'object' && 'success' in data) {
    if (data.success === false) {
      if (!silent && data.error) toast.error(data.error)
      return { ok: false, status, data, error: data.error }
    }
  }

  // 5xx
  if (status >= 500) {
    const msg = data?.error || `服务器错误 (${status})`
    if (!silent) toast.error(msg)
    return { ok: false, status, data, error: msg }
  }

  return { ok: status >= 200 && status < 300, status, data, error: data?.error }
}

// ============ 便捷别名 ============

export const get = <T = any>(path: string, opts?: Omit<ApiOptions, 'method' | 'body' | 'formData'>) =>
  api<T>(path, { ...opts, method: 'GET' })

export const post = <T = any>(path: string, body?: unknown, opts?: Omit<ApiOptions, 'method' | 'body'>) =>
  api<T>(path, { ...opts, method: 'POST', body })

export const patch = <T = any>(path: string, body?: unknown, opts?: Omit<ApiOptions, 'method' | 'body'>) =>
  api<T>(path, { ...opts, method: 'PATCH', body })

export const del = <T = any>(path: string, opts?: Omit<ApiOptions, 'method' | 'body' | 'formData'>) =>
  api<T>(path, { ...opts, method: 'DELETE' })

export const upload = <T = any>(path: string, formData: FormData, opts?: Omit<ApiOptions, 'method' | 'formData'>) =>
  api<T>(path, { ...opts, method: 'POST', formData })