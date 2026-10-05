/**
 * Cloudflare 缓存 header 工具（2026-07-15 14:50 奕霖授权）
 *
 * 目的：让 Cloudflare 免费 plan 也能缓存 API 响应
 * 原理：next.js API 默认不返回 Cache-Control，Cloudflare cf-cache-status = DYNAMIC 不缓存
 *       加 Cache-Control 后，Cloudflare 自动按 s-maxage 缓存
 *
 * 使用：
 *   import { cacheHeaders, CACHE_TTL } from '@/lib/cache-headers'
 *   return NextResponse.json(data, { headers: cacheHeaders(CACHE_TTL.LIST) })
 *
 * 不同数据用不同 TTL：
 *   - LIST (商品列表): 5min（库存可能变，5min 平衡）
 *   - DETAIL (商品详情): 5min
 *   - STATIC (商户信息): 1h（变更少）
 *   - USER_DATA (订单/购物车): 0（不缓存，隐私 + 实时性）
 */

export const CACHE_TTL = {
  /** 商品列表/搜索结果 - 5min */
  LIST: 300,
  /** 商品详情 - 5min */
  DETAIL: 300,
  /** 商户/品牌/分类 - 1h */
  STATIC: 3600,
  /** 活动/广告/通知 - 1min（变化略频繁） */
  SHORT: 60,
  /** 用户数据 - 0（不缓存） */
  NONE: 0,
} as const

export type CacheTTL = (typeof CACHE_TTL)[keyof typeof CACHE_TTL]

/**
 * 生成 Cloudflare 友好 cache headers
 * - public: 中间 CDN/浏览器都能缓存
 * - max-age=N: 浏览器缓存 N 秒
 * - s-maxage=N: CDN 缓存 N 秒（覆盖 max-age）
 * - stale-while-revalidate: 缓存过期后仍可用，同时后台刷新
 */
export function cacheHeaders(maxAge: CacheTTL): Record<string, string> {
  if (maxAge === 0) {
    return {
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'CDN-Cache-Control': 'no-store',
      'Cloudflare-CDN-Cache-Control': 'no-store',
    }
  }

  // stale-while-revalidate = 10x max-age（让用户始终有响应，后台更新）
  const swr = maxAge * 10

  return {
    'Cache-Control': `public, max-age=${maxAge}, s-maxage=${maxAge}, stale-while-revalidate=${swr}`,
    'CDN-Cache-Control': `max-age=${maxAge}`,
    'Cloudflare-CDN-Cache-Control': `public, max-age=${maxAge}, must-revalidate`,
    // 覆盖 next.js 默认的 vary 头（包含 next-router-*，让 Cloudflare 不缓存）
    'Vary': 'Accept-Encoding',
  }
}