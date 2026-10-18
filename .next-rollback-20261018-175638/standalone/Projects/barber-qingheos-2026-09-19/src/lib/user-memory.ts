/**
 * user-memory.ts — 用户长期记忆事实（2026-08-02 清禾 P0）
 *
 * 造型 AI 药师核心壁垒：用户说过的关键事 → 持久化 → 下次对话自动想起
 *
 * 跟清禾自己 SOUL.md / MEMORY.md 一样的设计：
 * - 每条 fact 是结构化的（category / confidence / source / expiresAt）
 * - 默认持久化到 SQLite（不只 localStorage）
 * - 跨设备同步（用手机号）
 * - 主动权在用户（可删 / 可改）
 *
 * ⭐ 自动提炼（Phase 2）：对话结束调 LLM 提炼 3-5 关键事实
 * 当前只手动调用（POST /api/profile/facts）
 */

import { prisma } from './db'
import { randomUUID } from 'crypto'

export type FactCategory = 'health' | 'family' | 'preference' | 'history' | 'other'

export interface MemoryFact {
  id: string
  userId?: string | null
  phone: string
  fact: string
  category: FactCategory
  confidence: number
  source: string
  isActive: boolean
  createdAt: string
  expiresAt?: string | null
}

/**
 * 保存一条记忆事实
 */
export async function saveMemoryFact(params: {
  phone: string
  userId?: string
  fact: string
  category?: FactCategory
  confidence?: number
  source?: string
  expiresAt?: string
}): Promise<string> {
  const id = randomUUID()
  await prisma.$executeRawUnsafe(
    `INSERT INTO user_memory_facts
     (id, userId, phone, fact, category, confidence, source, expiresAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    params.userId || null,
    params.phone,
    params.fact.slice(0, 500),
    params.category || 'other',
    params.confidence ?? 0.8,
    params.source || 'manual',
    params.expiresAt || null
  )
  return id
}

/**
 * 查询某用户的全部活跃记忆事实
 */
export async function getMemoryFacts(phone: string, userId?: string): Promise<MemoryFact[]> {
  const now = new Date().toISOString()
  let rows: any[] = []
  try {
    if (userId) {
      rows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT * FROM user_memory_facts
         WHERE (phone = ? OR userId = ?) AND isActive = 1
           AND (expiresAt IS NULL OR expiresAt > ?)
         ORDER BY createdAt DESC LIMIT 100`,
        phone, userId, now
      )
    } else {
      rows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT * FROM user_memory_facts
         WHERE phone = ? AND isActive = 1
           AND (expiresAt IS NULL OR expiresAt > ?)
         ORDER BY createdAt DESC LIMIT 100`,
        phone, now
      )
    }
  } catch (err: any) {
    console.error('[user-memory] getMemoryFacts error:', err?.message || err)
    return []
  }
  return rows.map((r: any) => ({
    id: r.id,
    userId: r.userId,
    phone: r.phone,
    fact: r.fact,
    category: r.category,
    confidence: r.confidence,
    source: r.source,
    isActive: r.isActive === 1,
    createdAt: r.createdAt,
    expiresAt: r.expiresAt,
  }))
}

/**
 * 软删除一条记忆
 */
export async function deleteMemoryFact(id: string): Promise<boolean> {
  try {
    const result = await prisma.$executeRawUnsafe(
      `UPDATE user_memory_facts SET isActive = 0 WHERE id = ?`,
      id
    )
    return Number(result) > 0
  } catch (err: any) {
    console.error('[user-memory] deleteMemoryFact error:', err?.message || err)
    return false
  }
}

/**
 * 格式化为 AI 上下文片段（注入 system prompt）
 *
 * 按 category 分组，让 AI 一眼看清"用户说过哪些事"
 */
export function formatFactsForAI(facts: MemoryFact[]): string {
  if (!facts || facts.length === 0) return ''
  const grouped: Record<string, string[]> = {}
  for (const f of facts) {
    if (!grouped[f.category]) grouped[f.category] = []
    grouped[f.category].push(f.fact)
  }

  const labels: Record<string, string> = {
    health: '健康',
    family: '家庭',
    preference: '偏好',
    history: '历史',
    other: '其他',
  }

  const lines: string[] = ['【用户长期记忆】（这些是用户之前说过的，请自然地"记得"，不要每次都问）']
  for (const [cat, items] of Object.entries(grouped)) {
    lines.push(`- ${labels[cat] || cat}：${items.join('；')}`)
  }
  return '\n' + lines.join('\n')
}