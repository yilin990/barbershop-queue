/**
 * 简单内存 rate limit（per-IP + per-phone）
 * - chat API: 30 req/min per phone（防滥用）
 * - send-code API: 1 req/min per phone（防刷）
 *
 * 生产环境建议换 Redis，但单进程够用
 */

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

// 定期清理过期 bucket
setInterval(() => {
  const now = Date.now()
  for (const [k, b] of buckets) {
    if (b.resetAt < now && b.resetAt + 3600 * 1000 < now) {
      buckets.delete(k)
    }
  }
}, 5 * 60 * 1000).unref?.()

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetMs: number
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now()
  const b = buckets.get(key)

  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: limit - 1, resetMs: windowMs }
  }

  if (b.count >= limit) {
    return { allowed: false, remaining: 0, resetMs: b.resetAt - now }
  }

  b.count++
  return {
    allowed: true,
    remaining: limit - b.count,
    resetMs: b.resetAt - now,
  }
}

export function getClientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  if (xff && xff !== '127.0.0.1' && xff !== '::1') return `xff:${xff}`
  const realIp = req.headers.get('x-real-ip')
  if (realIp && realIp !== '127.0.0.1' && realIp !== '::1') return `real:${realIp}`
  return 'local:localhost'
}