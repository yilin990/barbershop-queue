/**
 * 会员等级常量 + 纯函数（client-safe，不依赖 server-only 模块）
 * 任何客户端组件只能 import 这个文件，不能 import ./membership.ts
 */

export const MEMBERSHIP_TIERS = [
  // ⭐ 奕霖 2026-08-03 22:27 改：消费 1 元 = 4 分（之前是 1 分基础 + 等级倍数）
  { name: '普通', icon: '🌱', minSpent: 0,     discount: 0,    pointsRate: 4.0, color: '#9ca3af' },
  { name: '银卡', icon: '🥈', minSpent: 500,   discount: 0.05, pointsRate: 4.8, color: '#c0c4cc' },
  { name: '金卡', icon: '🥇', minSpent: 2000,  discount: 0.10, pointsRate: 6.0, color: '#b8860b' },
  { name: 'VIP',  icon: '👑', minSpent: 10000, discount: 0.15, pointsRate: 8.0, color: '#f472b6' },
] as const

export type TierName = (typeof MEMBERSHIP_TIERS)[number]['name']

/** 根据累计消费额计算等级 */
export function computeRole(totalSpent: number): typeof MEMBERSHIP_TIERS[number] {
  let tier: typeof MEMBERSHIP_TIERS[number] = MEMBERSHIP_TIERS[0]
  for (const t of MEMBERSHIP_TIERS) {
    if (totalSpent >= t.minSpent) {
      tier = t
    }
  }
  return tier
}

/** 计算下一级还差多少 */
export function nextTier(totalSpent: number): {
  tier: (typeof MEMBERSHIP_TIERS)[number] | null
  need: number
  progress: number
} {
  const current = computeRole(totalSpent)
  const currentIndex = MEMBERSHIP_TIERS.findIndex((t) => t.name === current.name)
  const next = MEMBERSHIP_TIERS[currentIndex + 1]
  if (!next) {
    return { tier: null, need: 0, progress: 100 }
  }
  const need = next.minSpent - totalSpent
  const range = next.minSpent - current.minSpent
  const progress = range > 0 ? ((totalSpent - current.minSpent) / range) * 100 : 0
  return {
    tier: next,
    need: Math.max(0, need),
    progress: Math.min(100, Math.max(0, progress)),
  }
}
