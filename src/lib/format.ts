// 价格 + 重量 格式化工具
// 2026-08-24 奕霖偏好：单位显示"X 元/Y 克"（多少钱多少克）

export function formatWeight(weightGram: number | null | undefined): string {
  const w = weightGram || 500
  if (w >= 1000) {
    const kg = w / 1000
    return kg % 1 === 0 ? `${kg}kg` : `${kg.toFixed(1)}kg`
  }
  return `${w}g`
}

export function formatPricePerWeight(
  price: number | null | undefined,
  weightGram: number | null | undefined,
  memberPrice?: number | null
): string {
  const p = (memberPrice && memberPrice < (price || 0)) ? memberPrice : price
  const safeP = p || 0
  return `¥${safeP.toFixed(2)}/${formatWeight(weightGram)}`
}

export function formatStock(stock: number, unit: string | null | undefined, weightGram: number | null | undefined): string {
  const u = unit || '件'
  const w = formatWeight(weightGram)
  return `${stock} ${u}(${w})`
}
