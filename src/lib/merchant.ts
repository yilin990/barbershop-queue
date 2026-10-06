/**
 * 商户 ID 单一真相源 (single source of truth)
 *
 * 2026-10-07 清禾立
 * 背景: BookingSection 里 8 处硬编码 'm_barber_001', 换第二家理发店推送/排队链路会断。
 * 根因不是常量写死, 而是组件签名 BookingSection() 不接 props, 商户 ID 根本没法传进去。
 *
 * 优先级: props > URL 参数 > 环境变量 > 默认值
 * 这样单商户部署零改动, 第二商户只需路由 /[merchantId] 传参。
 */

/** 默认商户 (第一家理发店)。可用 NEXT_PUBLIC_MERCHANT_ID 覆盖, 适配私有化部署。 */
export const DEFAULT_MERCHANT_ID =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_MERCHANT_ID) || 'm_barber_001'

/**
 * 从 URL query 解析商户 ID。
 * 兼容 ?merchantId=m_barber_002 与 ?mid=m_barber_002 两种写法。
 */
export function resolveMerchantIdFromQuery(params: URLSearchParams | null | undefined): string | null {
  if (!params) return null
  return params.get('merchantId') || params.get('mid') || null
}

/**
 * 最终解析: 显式传入 > URL > 默认。
 * 显式传入为空 (''/null/undefined) 时自动回落到 URL, 再回落到默认值。
 */
export function resolveMerchantId(explicit?: string | null, search?: string | null): string {
  const direct = (explicit || '').trim()
  if (direct) return direct

  const fromUrl = resolveMerchantIdFromQuery(
    typeof window !== 'undefined' && search !== null ? new URLSearchParams(search) : null
  )
  if (fromUrl) return fromUrl

  return DEFAULT_MERCHANT_ID
}
