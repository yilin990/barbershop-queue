/**
 * 内存缓存（清禾 2026-07-03 奕霖反馈：库存查询慢，加缓存）
 *
 * 简单 LRU 风格：TTL 过期 + 最大条数
 * - 默认 TTL：5 分钟
 * - 默认 max：200 条
 * - 适合 search_products / 商品详情 / 简单查询
 *
 * 生产环境建议接 Redis，但 v1.0 内存够用（10K 商品，TTL 5min）
 */

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

class MemoryCache {
  private store = new Map<string, CacheEntry<any>>()
  private readonly ttlMs: number
  private readonly maxSize: number

  constructor(ttlMs:number = 5*60*1000, maxSize:number = 200){
    this.ttlMs = ttlMs
    this.maxSize = maxSize
  }

  get<T>(key:string):T|undefined {
    const entry = this.store.get(key)
    if(!entry) return undefined
    if(Date.now() > entry.expiresAt){
      this.store.delete(key)
      return undefined
    }
    return entry.data as T
  }

  set<T>(key:string, data:T, ttlMs?:number):void {
    if(this.store.size >= this.maxSize){
      // 简单 FIFO：删最老的
      const oldestKey = this.store.keys().next().value
      if(oldestKey) this.store.delete(oldestKey)
    }
    this.store.set(key, {
      data,
      expiresAt: Date.now() + (ttlMs ?? this.ttlMs),
    })
  }

  delete(key:string):void { this.store.delete(key) }
  clear():void { this.store.clear() }
  size():number { return this.store.size }

  // 缓存包装函数
  async wrap<T>(key:string, fn:()=>Promise<T>, ttlMs?:number):Promise<T> {
    const hit = this.get<T>(key)
    if(hit !== undefined) return hit
    const data = await fn()
    this.set(key, data, ttlMs)
    return data
  }
}

// 全局单例（开发 hot reload 友好）
declare global {
  // eslint-disable-next-line no-var
  var __qinghe_cache:MemoryCache | undefined
}

export const cache = globalThis.__qinghe_cache ?? new MemoryCache(5*60*1000, 200)
if(!globalThis.__qinghe_cache) globalThis.__qinghe_cache = cache