'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** ⭐ 奕霖 2026-07-06 13:37：合规确认 store
 *
 * 三层合规：
 * 1. 协议确认（一次性，强制）
 * 2. AI 风险提示（24h 冷却）
 * 3. 紧急关键词提示（永久，每次检测到症状时插入浮条）
 *
 * 不耦合 userStore，未登录用户也要看到协议确认。
 */

const AGREEMENT_VERSION = '1.1.0'  // 协议版本号，绑定到 docs/user-agreement.md

export interface ComplianceState {
  /** 用户协议同意时间戳（null = 未同意） */
  agreedAt: number | null
  /** 用户协议同意时的版本号（null = 未同意） */
  agreedVersion: string | null
  /** AI 风险提示最后展示时间（24h 冷却） */
  aiRiskHintAt: number | null
  /** 用户是否被识别为"老用户"（已同意过老版本协议，避免升级时骚扰） */
  isLegacyUser: boolean

  /** 确认同意 */
  agree: () => void
  /** 标记 AI 风险提示已展示 */
  markAiHintShown: () => void
  /** 重置协议确认（用于协议大版本升级时强制重弹） */
  resetAgreement: () => void
}

export const useComplianceStore = create<ComplianceState>()(
  persist(
    (set) => ({
      agreedAt: null,
      agreedVersion: null,
      aiRiskHintAt: null,
      isLegacyUser: false,

      agree: () => {
        set({
          agreedAt: Date.now(),
          agreedVersion: AGREEMENT_VERSION,
        })
      },

      markAiHintShown: () => {
        set({ aiRiskHintAt: Date.now() })
      },

      resetAgreement: () => {
        set({
          agreedAt: null,
          agreedVersion: null,
        })
      },
    }),
    {
      name: 'zhilin-compliance-storage',
      partialize: (state) => ({
        agreedAt: state.agreedAt,
        agreedVersion: state.agreedVersion,
        aiRiskHintAt: state.aiRiskHintAt,
        isLegacyUser: state.isLegacyUser,
      }),
    }
  )
)

/** ⭐ 工具：是否需要展示 AI 风险提示（24h 冷却） */
export function shouldShowAiHint(aiRiskHintAt: number | null): boolean {
  if (aiRiskHintAt === null) return true
  const elapsed = Date.now() - aiRiskHintAt
  return elapsed > 24 * 60 * 60 * 1000
}

/** ⭐ 工具：是否需要展示协议确认 */
export function shouldShowAgreement(agreedAt: number | null, agreedVersion: string | null): boolean {
  if (agreedAt === null) return true
  // 协议版本升级时也要重新确认
  if (agreedVersion !== AGREEMENT_VERSION) return true
  return false
}

export { AGREEMENT_VERSION }