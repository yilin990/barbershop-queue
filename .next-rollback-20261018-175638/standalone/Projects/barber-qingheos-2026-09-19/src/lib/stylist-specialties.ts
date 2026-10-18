// ⭐ 2026-09-20 16:17 奕霖拍板：方案 B — 发型↔理发师矩阵
// 用途：客人端推荐 + 控制台展示 + 团队隐性业绩

export type StylistName = 'Tony' | 'Amy' | 'Lily'
export type ServiceType = '剪发' | '染发' | '烫发' | '护理' | '造型'
export type SkillLevel = 1 | 2 | 3 // ⭐ / ⭐⭐ / ⭐⭐⭐

export interface StylistProfile {
  name: StylistName
  emoji: string
  years: number
  signature: string           // 一句话卖点
  specialties: Record<ServiceType, SkillLevel>
}

export const STYLIST_PROFILES: Record<StylistName, StylistProfile> = {
  Tony: {
    name: 'Tony',
    emoji: '👨‍🎨',
    years: 3,
    signature: '渐变剪 + 潮流造型一把好手',
    specialties: { 剪发: 3, 染发: 2, 烫发: 1, 护理: 2, 造型: 3 },
  },
  Amy: {
    name: 'Amy',
    emoji: '👩‍💼',
    years: 5,
    signature: '染烫专家 + 护理细致入微',
    specialties: { 剪发: 2, 染发: 3, 烫发: 3, 护理: 3, 造型: 2 },
  },
  Lily: {
    name: 'Lily',
    emoji: '💁‍♀️',
    years: 2,
    signature: '快剪女王，急性子最爱',
    specialties: { 剪发: 3, 染发: 2, 烫发: 2, 护理: 2, 造型: 2 },
  },
}

export const ALL_STYLISTS: StylistName[] = ['Tony', 'Amy', 'Lily']
export const ALL_SERVICES: ServiceType[] = ['剪发', '染发', '烫发', '护理', '造型']

/** 渲染星级（1/2/3 → ⭐/⭐⭐/⭐⭐⭐） */
export function renderStars(level: SkillLevel): string {
  return '⭐'.repeat(level)
}

/** 给定服务项目，按擅长度排序理发师（高→低） */
export function recommendStylist(service: ServiceType): StylistProfile[] {
  return ALL_STYLISTS
    .map(name => STYLIST_PROFILES[name])
    .sort((a, b) => b.specialties[service] - a.specialties[service])
}

/** 单个理发师擅长服务（按星级降序） */
export function getTopServices(stylist: StylistName): { service: ServiceType; level: SkillLevel }[] {
  const profile = STYLIST_PROFILES[stylist]
  return (Object.entries(profile.specialties) as [ServiceType, SkillLevel][])
    .map(([service, level]) => ({ service, level }))
    .sort((a, b) => b.level - a.level)
}

/** 顶配标志：某理发师在某项目上 ⭐⭐⭐ */
export function isTopMatch(stylist: StylistName, service: ServiceType): boolean {
  return STYLIST_PROFILES[stylist].specialties[service] === 3
}