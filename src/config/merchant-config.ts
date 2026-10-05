/**
 * merchant-config.ts - 多租户配置注册表（v1.0 2026-09-05）
 *
 * 背景：
 0 - cloudflared 把 zhilin.qingheos.cn 和 grocery.qingheos.cn 都路由到同一个 production
 0 - 之前 root layout 静态 import BUSINESS_CONFIG（芝林），所以 grocery 域名用户也看到芝林 brand
 *
 * 设计：
 0 - 注册表：MERCHANT_REGISTRY 维护所有商户配置（key 是 merchantId 或 URL slug）
 0 - 同步版：getMerchantConfigSync(merchantId) → 给 middleware / RootLayout 用（headers 同步可读）
 0 - 异步版：getMerchantConfigAsync(merchantId) → 兼容已有 service.ts 接口（保留文件系统 fallback）
 *
 * 未来扩展：
 0 - 商户 config 可移到 data/merchants/{id}/config.json
 0 - 或从数据库读（按 Merchant 表 industry 字段）
 */

import { BUSINESS_CONFIG } from './business.config'

// ===== 芝林配置（hardcoded 备用，type: pharmacy） =====
export const ZHILIN_CONFIG = {
  id: 'zhilin-001',
  type: 'pharmacy' as const,
  name: '芝林大药房',
  shortName: '芝林',
  slogan: '您的专属健康顾问',
  description: 'AI赋能 · 去中心化 · 专属服务。芝林大药房，铜仁人自己的健康顾问。',
  brandStory: {
    title: '一间药房，二十年',
    subtitle: '近一点，再近一点。',
    paragraphs: [
      '铜仁老社区的巷口，有一间开了近二十年的药房。',
      '最早的时候，只有一排旧药柜和一位坐堂的老爷子。街坊邻居有个头疼脑热，总爱先来这里问问。老爷子不急着开药，先沏杯茶，聊聊最近吃了什么、睡得好不好。',
      '后来老爷子走了，店里来了一位新店员。街坊们发现，他耳朵不太灵光，交流起来要多说几遍。但奇怪的是，大家反而更愿意来找他——因为他认真，每一次拿药都要反复确认剂量，生怕出错。',
      '二十年，小店慢慢变成老店。药架换过几茬，招牌也重新刷过漆。但那些熟悉的街坊，进门还是习惯先喊一声"来了啊"，像回家一样。',
    ],
    highlights: [
      { icon: '🌿', label: '近二十年老药房' },
      { icon: '🍵', label: '先问诊，再开药' },
      { icon: '🤝', label: '反复确认剂量' },
      { icon: '🏠', label: '街坊的"第二个家"' },
    ],
  },
  contact: {
    phone: '+86 18 30 85 67 187',
    address: '贵州省铜仁市碧江区锦江南路304号',
    coords: [109.200269, 27.732818] as [number, number],
    hours: '08:00-21:00',
  },
  theme: {
    bgDeep: '#2c1810',
    bgCard: '#2c1810',
    bgCardHover: '#1a2420',
    teal: '#b8860b',
    tealDark: '#8b6508',
    tealGlow: 'rgba(184, 134, 11, 0.15)',
    green: '#b8860b',
    greenDark: '#b8860b',
    text: '#fffaf0',
    textSecondary: '#9ca3af',
    textMuted: '#6b7280',
    glassBorder: 'rgba(184, 134, 11, 0.2)',
    accent: '#f472b6',
  },
  assets: {
    logo: '/merchant-logo.jpg',
    banner: '/zhilin-banner-logo.jpg',
    qrcode: '/merchant-qr.png',
    favicon: '/favicon.ico',
  },
  staffPins: ['1234', '5678', '9012', '2468'],
  adminPins: ['8888', '6666', '1314'],
} as const

// ===== 造型配置（从 business.config.ts 取，type: grocery） =====
// business.config.ts 已经被 fork 改成 type: grocery + name: 造型师助手 + id: guoshu-001
export const GUOSHU_CONFIG = BUSINESS_CONFIG

// ===== 注册表 =====
// key 是 merchantId 或 URL slug，方便 middleware 按 Host 头 / URL 路径查找
export const MERCHANT_REGISTRY = {
  // 芝林
  'zhilin-001': ZHILIN_CONFIG,
  'zhilin': ZHILIN_CONFIG,
  // 造型
  'guoshu-001': GUOSHU_CONFIG,
  'guoshu': GUOSHU_CONFIG,
  'grocery': GUOSHU_CONFIG,
  'fruit': GUOSHU_CONFIG,
} as const

export type MerchantId = keyof typeof MERCHANT_REGISTRY

// ===== 同步版（middleware / RootLayout 用）=====
// fallback 顺序：merchantId 命中 → ZHILIN（默认）
export function getMerchantConfigSync(merchantId: string | null | undefined) {
  if (!merchantId) return ZHILIN_CONFIG
  return (MERCHANT_REGISTRY as any)[merchantId] || ZHILIN_CONFIG
}

// ===== 异步版（兼容已有 service.ts 接口）=====
// 保留扩展点：未来可读 data/merchants/{id}/config.json 或数据库
export async function getMerchantConfigAsync(merchantId: string | null | undefined) {
  return getMerchantConfigSync(merchantId)
}
