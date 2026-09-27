/**
 * 购物车工具 · 清禾 2026-07-17
 *
 * 用 localStorage 持久化（无需登录、无需后端）
 * 与 /cart/page.tsx 的 cart 键完全兼容
 *
 * 数据结构：
 * [
 *   { productId, name, spec, price, quantity, icon }
 * ]
 */

export interface CartItem {
  productId: string
  name: string
  spec?: string
  price: number
  quantity: number
  icon?: string
  image?: string
  category?: string
}

const CART_KEY = 'cart'

// 读取购物车
export function getCart(): CartItem[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) || '[]')
  } catch {
    return []
  }
}

// 写入购物车
export function saveCart(items: CartItem[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(CART_KEY, JSON.stringify(items))
  // ⭐ MEMORY §270 (2026-08-25 20:17) 奕霖反馈 /cart 数据不通
  // 真凶：StorageEvent 同窗口不会触发（浏览器机制），所以 FloatingCart 角标要靠 800ms 兜底轮询
  // 修法：saveCart 同时派发 CustomEvent('cart-updated')，同窗口立即通知所有监听者
  window.dispatchEvent(new StorageEvent('storage', { key: CART_KEY }))
  window.dispatchEvent(new CustomEvent('cart-updated'))
}

// 计算购物车商品总数（用于角标）
export function getCartCount(): number {
  return getCart().reduce((sum, it) => sum + it.quantity, 0)
}

// 计算购物车总价
export function getCartTotal(): number {
  return getCart().reduce((sum, it) => sum + it.price * it.quantity, 0)
}

/**
 * 加入购物车（核心函数）
 * - 同 productId + spec 已存在 → 数量 +1
 * - 新商品 → 追加
 * - 返回新的购物车
 */
export function addToCart(item: Omit<CartItem, 'quantity'> & { quantity?: number }): CartItem[] {
  const cart = getCart()
  const qty = item.quantity || 1
  // 同 productId + spec 视为同一商品
  const existingIdx = cart.findIndex(
    (c) => c.productId === item.productId && c.spec === item.spec
  )
  if (existingIdx >= 0) {
    cart[existingIdx].quantity += qty
  } else {
    cart.push({ ...item, quantity: qty })
  }
  saveCart(cart)
  return cart
}

// 移除某商品
export function removeFromCart(productId: string, spec?: string): CartItem[] {
  const cart = getCart().filter(
    (c) => !(c.productId === productId && c.spec === spec)
  )
  saveCart(cart)
  return cart
}

// 修改数量
export function updateCartQty(productId: string, spec: string | undefined, delta: number): CartItem[] {
  const cart = getCart()
  const idx = cart.findIndex((c) => c.productId === productId && c.spec === spec)
  if (idx >= 0) {
    cart[idx].quantity = Math.max(1, cart[idx].quantity + delta)
    saveCart(cart)
  }
  return cart
}

// 清空
export function clearCart(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(CART_KEY)
  // ⭐ MEMORY §270 同步派发 cart-updated，让 FloatingCart 角标立即归零（不靠 800ms 轮询）
  window.dispatchEvent(new StorageEvent('storage', { key: CART_KEY }))
  window.dispatchEvent(new CustomEvent('cart-updated'))
}

/**
 * 快捷加购：接受商品对象，自动判断是否已在购物车
 * 返回 { added: boolean, newCount: number, message: string }
 */
export function quickAddToCart(product: {
  id: string
  name: string
  price: number
  spec?: string | null
  category?: string | null
  categoryLabel?: string | null
  image?: string | null
  icon?: string
}): { added: boolean; newCount: number; alreadyInCart: boolean; message: string } {
  const before = getCart()
  const alreadyInCart = before.some(
    (c) => c.productId === product.id && c.spec === (product.spec || undefined)
  )
  const after = addToCart({
    productId: product.id,
    name: product.name,
    spec: product.spec || undefined,
    price: product.price,
    icon: product.icon || categoryToIcon(product.category || product.categoryLabel),
    image: product.image || undefined,
    category: product.category || product.categoryLabel || undefined,
  })
  const newCount = after.reduce((sum, it) => sum + it.quantity, 0)
  return {
    added: true,
    alreadyInCart,
    newCount,
    message: alreadyInCart
      ? `✓ 已在购物车，数量 +1`
      : `✓ 已加入购物车`,
  }
}

// 分类 → 默认图标
function categoryToIcon(category?: string | null): string {
  if (!category) return '🍵'
  const map: Record<string, string> = {
    // 果蔬大类
    '新鲜水果': '🍎',
    '时令水果': '🍎',
    '新鲜蔬菜': '🥬',
    '蔬菜': '🥬',
    '粮油米面': '🍚',
    '粮油': '🌾',
    '水果': '🍎',
    // 果蔬子类
    '叶菜类': '🥗',
    '根茎类': '🥕',
    '菌菇类': '🍄',
    '柑橘类': '🍊',
    '浆果类': '🍓',
    '瓜果类': '🍉',
    '米面': '🌾',
    '肉蛋蛋白': '🥚',
    '海鲜水产': '🐟',
    '有机': '🌿',
    '绿色': '🌿',
    // 兜底
    '食品': '🍎',
    '日用品': '🛒',
    '其他': '🍃',
  }
  return map[category] || '🍃'
}
