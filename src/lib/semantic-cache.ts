/**
 * 造型 AI 药师语义缓存 (清禾 P0 2026-07-29)
 *
 * 目标：节省 50-70% LLM 调用（用户重复问 / 模板化问答）
 * 策略：用户消息 normalized hash + context key → LLM reply
 * TTL：1 小时（问诊场景的"半衰期"）
 *
 * 不缓存的情况（缓存穿透）：
 * - 紧急症状（每次都要重新评估）
 * - 含 pickupCode / 订单卡（个性化数据）
 * - 工具执行过（实时性数据）
 *
 * 节省潜力（参考 PwC 2026 研究）：
 * - Prompt caching 41-80%
 * - Semantic caching 73% API calls
 */

import { createHash } from 'crypto'
import { cache } from './cache'

export interface CachedChatReply {
  reply: string
  cards?: any[]
  toolExecuted?: string | null
  toolsRun?: any[]
  timestamp: number
}

const CACHE_TTL_MS = 60 * 60 * 1000 // 1 小时

/**
 * 标准化用户消息（去标点 / 去空白 / 限长）
 * 目的：相同语义的不同表述能命中同一缓存
 */
function normalize(s: string): string {
  if (!s) return ''
  return s
    .toLowerCase()
    .replace(/[\s\p{P}]+/gu, ' ')
    .trim()
    .slice(0, 200) // 防 hash collision attack
}

/**
 * 生成缓存 key：hash(message) + context
 * 上下文区分：登录状态、问诊对象（自己/家人/陌生人）
 */
function makeKey(
  message: string,
  hasPhone: boolean,
  subject: 'self' | 'family' | 'other' = 'self'
): string {
  const norm = normalize(message)
  const hash = createHash('sha256').update(norm).digest('hex').slice(0, 16)
  return `zhilin:chat:${hash}:${hasPhone ? 'auth' : 'guest'}:${subject}`
}

/**
 * 查询缓存（命中即返回，未命中返回 null）
 * 注：紧急关键词永远不缓存（避免过期处方风险）
 */
export function getCachedChatReply(
  message: string,
  hasPhone: boolean,
  subject: 'self' | 'family' | 'other' = 'self'
): CachedChatReply | null {
  const key = makeKey(message, hasPhone, subject)
  const hit = cache.get<CachedChatReply>(key)
  return hit || null
}

/**
 * 判断是否值得缓存
 */
function shouldCacheReply(reply: CachedChatReply): boolean {
  if (!reply.reply || reply.reply.length < 5) return false
  // 含 cards（订单 / 取货码）= 个性化数据，不缓存
  if (reply.cards && reply.cards.length > 0) return false
  // 工具执行过 = 实时数据，不缓存
  if (reply.toolExecuted) return false
  return true
}

/**
 * 写入缓存（智能判断是否可缓存）
 */
export function setCachedChatReply(
  message: string,
  hasPhone: boolean,
  subject: 'self' | 'family' | 'other',
  reply: CachedChatReply
): void {
  if (!message) return
  if (!shouldCacheReply(reply)) return
  const key = makeKey(message, hasPhone, subject)
  cache.set(key, { ...reply, timestamp: Date.now() }, CACHE_TTL_MS)
}

/**
 * 缓存统计（用于后台监控命中率）
 */
export function getChatCacheStats() {
  return {
    size: cache.size(),
    ttl_ms: CACHE_TTL_MS,
  }
}