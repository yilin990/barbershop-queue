/**
 * tenant.ts - 多租户配置加载器
 *
 * 工作原理:
 * 1. 从 URL 路径提取 merchantId (如 /zhilin/map → 'zhilin')
 * 2. 先查内存缓存 (性能)
 * 3. 再查 data/merchants/{id}/config.json 文件
 * 4. 找不到则用默认 business.config.ts (默认造型师助手)
 *
 * 第一个商户 (默认造型师助手) 走 / 路径, 不需要 [merchantId]
 * 后续商户用 /[merchantId] 动态路由
 *
 * 数据流:
 *   URL /[merchantId]/* → lib/tenant.ts → BUSINESS_CONFIG 或 per-merchant config
 */

import { BUSINESS_CONFIG, type BusinessConfig } from '@/config/business.config'

// 缓存: 同一 merchantId 多次请求只读一次文件
const cache = new Map<string, BusinessConfig>()

/**
 * 加载指定商户的配置
 * @param merchantId 商户 ID (URL 路径中的 [merchantId] 段)
 * @returns 该商户的配置, 找不到则返回默认造型师助手配置
 */
export async function loadMerchantConfig(merchantId: string | null | undefined): Promise<BusinessConfig> {
  // 1. 无 merchantId → 默认造型师助手
  if (!merchantId) {
    return BUSINESS_CONFIG
  }

  // 2. 默认商户用默认 config (避免重复读文件)
  if (merchantId === BUSINESS_CONFIG.id || merchantId === 'zhilin') {
    return BUSINESS_CONFIG
  }

  // 3. 查缓存
  if (cache.has(merchantId)) {
    return cache.get(merchantId)!
  }

  // 4. 查 per-merchant 配置文件
  try {
    // 服务端: 读文件系统
    if (typeof window === 'undefined') {
      const fs = await import('fs/promises')
      const path = await import('path')
      const configPath = path.join(process.cwd(), 'data', 'merchants', merchantId, 'config.json')
      const content = await fs.readFile(configPath, 'utf-8')
      const config = JSON.parse(content) as BusinessConfig
      cache.set(merchantId, config)
      return config
    }
    // 客户端: 走 API (备用方案)
    const res = await fetch(`/api/merchants/${merchantId}/config`)
    if (res.ok) {
      const config = await res.json() as BusinessConfig
      cache.set(merchantId, config)
      return config
    }
  } catch {
    // 静默失败, 走默认
  }

  // 5. 找不到 → 兜底用默认造型师助手 config (不抛错, 避免用户看到错误页)
  return BUSINESS_CONFIG
}

/**
 * 清除缓存 (供 admin 改 config 后调用)
 */
export function clearMerchantCache(merchantId?: string) {
  if (merchantId) {
    cache.delete(merchantId)
  } else {
    cache.clear()
  }
}

/**
 * 判断给定路径是否为动态租户路由
 * 排除掉 api/, _next/, 静态资源
 */
export function isTenantPath(pathname: string): boolean {
  if (pathname.startsWith('/api/')) return false
  if (pathname.startsWith('/_next/')) return false
  if (pathname.startsWith('/favicon')) return false
  if (pathname.includes('.')) return false  // 静态资源
  return true
}

/**
 * 从 URL 路径提取 merchantId
 * /zhilin/map → 'zhilin'
 * /map → null (默认)
 * / → null
 */
export function extractMerchantId(pathname: string): string | null {
  if (!isTenantPath(pathname)) return null
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length === 0) return null
  return segments[0] || null
}
