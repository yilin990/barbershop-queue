/**
 * 服务端进程内缓存（2026-07-15 15:55 奕霖授权）
 *
 * 目的：绕过 cloudflare 不缓存的问题，直接在 next.js 进程内缓存高频只读 API
 * 原理：内存 Map<key, {data, expiresAt}>，TTL 过期则重新计算
 *
 * vs cache-headers.ts 的区别：
 * - cache-headers 是 HTTP 层缓存头（依赖 cloudflare 边缘）
 * - server-cache 是 server 进程缓存（独立于 CDN）
 *
 * 使用场景：
 * - /api/products（6801 件商品不变，5min 缓存足够）
 * - /api/merchant（商户信息基本不变，1h）
 *
 * 注意事项：
 * - 商品下单会改 stock，但 stock 变化不频繁（5min 内变 1-2 次可接受）
 * - Next.js dev mode 单进程，prod build 也单进程（除非 cluster），缓存直接生效
 * - 进程重启后缓存失效（数据从 SQLite 重读，可接受）
 */

type CacheEntry<T> = {
  data: T
  expiresAt: number
}

const cache = new Map<string, CacheEntry<any>>()

/**
 * 通用 cache get-or-fetch
 * @param key 缓存 key（建议包含完整参数）
 * @param ttl 秒
 * @param fetcher 计算函数（首次或过期时执行）
 */
export async function serverCache<T>(
  key: string,
  ttl: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const now = Date.now()
  const hit = cache.get(key)
  if (hit && hit.expiresAt > now) {
    return hit.data as T
  }

  const data = await fetcher()
  cache.set(key, { data, expiresAt: now + ttl * 1000 })
  return data
}

/**
 * 让某个 key 失效（用户下单后调用，清掉商品缓存让 stock 实时生效）
 */
export function invalidateCache(keyPattern: string): number {
  let count = 0
  for (const key of cache.keys()) {
    if (key.includes(keyPattern)) {
      cache.delete(key)
      count++
    }
  }
  return count
}

/**
 * 清空所有缓存（debug 用）
 */
export function clearAllCache(): number {
  const size = cache.size
  cache.clear()
  return size
}

/**
 * 获取缓存统计
 */
export function getCacheStats() {
  const now = Date.now()
  let expired = 0
  let active = 0
  for (const entry of cache.values()) {
    if (entry.expiresAt > now) active++
    else expired++
  }
  return {
    total: cache.size,
    active,
    expired,
    keys: Array.from(cache.keys()),
  }
}