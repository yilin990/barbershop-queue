// v0.8.68.1 - 商品管理子组件共享类型 + 工具函数
export interface Product {
  id: string
  productCode: string
  name: string
  shortName?: string
  spec?: string
  price: number
  totalAmount: number
  stock: number
  unit?: string
  category?: string
  retakeCount?: number
  categoryLabel?: string
  manufacturer?: string
  image?: string | null
  status: 'active' | 'inactive'
}

export interface Category { label: string; code: string; count: number }

export function isMobileView(): boolean {
  if (typeof window === 'undefined') return false
  return window.innerWidth < 768
}
