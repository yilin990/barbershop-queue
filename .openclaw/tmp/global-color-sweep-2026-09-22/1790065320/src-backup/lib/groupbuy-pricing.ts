/**
 * 智能让利算法（奕霖 2026-08-05 18:08 需求）
 *
 * 核心：按每个商品自己的毛利点算最优让利
 * - 高毛利（>30%）：让利空间大
 * - 中毛利（15-30%）：让利适中
 * - 低毛利（<15%）：让利极少
 * - 触底保护：max(成本×1.05, 原价×让利最低比例)
 *
 * 商家保底 = 成本 × 1.05（保 5% 毛利）
 */

export interface SmartPriceInput {
  costPrice: number      // 商家录入的进货价
  originalPrice: number  // 售价
  /** 当前拼团人数（2/3/4+） */
  people: 2 | 3 | 4
}

export interface SmartPriceOutput {
  /** 3 档团购价（按 2/3/4 人） */
  tier2: number
  tier3: number
  tier4: number
  /** 当前档位的最优价 */
  current: number
  /** 节省金额（原价 - 当前价） */
  saved: number
  /** 节省比例 */
  savedPercent: number
  /** 当前毛利率（团购价下） */
  profitMargin: number
  /** 毛利档位 */
  tier: 'high' | 'mid' | 'low' | 'unprofitable'
  /** 触底保护触发？ */
  isFloor: boolean
}

/** 毛利分档让利曲线（每档独立配） */
const MARGIN_TIERS = {
  high: { people2: 0.95, people3: 0.90, people4: 0.85 },  // >30% 毛利
  mid:  { people2: 0.95, people3: 0.92, people4: 0.88 },  // 15-30%
  low:  { people2: 0.98, people3: 0.95, people4: 0.92 },  // <15%
}

/** 触底价 = max(成本 × 1.05, 原价 × 档位最低) */
function floorPrice(costPrice: number, originalPrice: number, tier: 'high' | 'mid' | 'low'): number {
  const minPercent = MARGIN_TIERS[tier].people4
  return Math.max(costPrice * 1.05, originalPrice * minPercent)
}

/** 判断毛利档 */
function getTier(margin: number): 'high' | 'mid' | 'low' | 'unprofitable' {
  if (margin >= 0.30) return 'high'
  if (margin >= 0.15) return 'mid'
  if (margin >= 0.05) return 'low'
  return 'unprofitable'  // 毛利 < 5% 不参与拼团
}

/** 计算 3 档价 */
function calculateTier(costPrice: number, originalPrice: number, tier: 'high' | 'mid' | 'low', people: 2 | 3 | 4): number {
  const percent = MARGIN_TIERS[tier][`people${people}` as keyof typeof MARGIN_TIERS.high]
  const idealPrice = originalPrice * percent
  const floor = floorPrice(costPrice, originalPrice, tier)
  return Math.max(idealPrice, floor)
}

/** 主函数：算智能让利 */
export function calcSmartPrice(input: SmartPriceInput): SmartPriceOutput {
  const { costPrice, originalPrice, people } = input

  // 边界检查
  if (costPrice <= 0 || originalPrice <= 0) {
    return {
      tier2: originalPrice,
      tier3: originalPrice,
      tier4: originalPrice,
      current: originalPrice,
      saved: 0,
      savedPercent: 0,
      profitMargin: 0,
      tier: 'unprofitable',
      isFloor: false,
    }
  }

  const margin = (originalPrice - costPrice) / originalPrice
  const tier = getTier(margin)

  // 毛利不够，不让利
  if (tier === 'unprofitable') {
    return {
      tier2: originalPrice,
      tier3: originalPrice,
      tier4: originalPrice,
      current: originalPrice,
      saved: 0,
      savedPercent: 0,
      profitMargin: margin,
      tier,
      isFloor: false,
    }
  }

  const tier2 = calculateTier(costPrice, originalPrice, tier, 2)
  const tier3 = calculateTier(costPrice, originalPrice, tier, 3)
  const tier4 = calculateTier(costPrice, originalPrice, tier, 4)
  const current = people >= 4 ? tier4 : people === 3 ? tier3 : tier2

  return {
    tier2: round2(tier2),
    tier3: round2(tier3),
    tier4: round2(tier4),
    current: round2(current),
    saved: round2(originalPrice - current),
    savedPercent: round2(((originalPrice - current) / originalPrice) * 100),
    profitMargin: round2(((current - costPrice) / current) * 100),
    tier,
    isFloor: current === floorPrice(costPrice, originalPrice, tier),
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** 给商家看：批量算让利预览 */
export function previewBatch(items: Array<{ costPrice: number; originalPrice: number }>): Array<{
  margin: number
  tier: string
  profitMargin: number
  savedPercent: number
  recommend: number
}> {
  return items.map((item) => {
    const result = calcSmartPrice({ ...item, people: 3 })
    return {
      margin: round2(((item.originalPrice - item.costPrice) / item.originalPrice) * 100),
      tier: result.tier,
      profitMargin: result.profitMargin,
      savedPercent: result.savedPercent,
      recommend: result.current,
    }
  })
}
