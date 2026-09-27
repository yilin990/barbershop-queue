/**
 * 设计系统 Tokens · 果蔬鲜生
 * 所有页面必须引用这里，不要写魔法数字
 */

// ============================================
// 颜色
// ============================================
export const colors = {
  // 主色 - 草本绿
  primary: '#b8860b',
  primaryDark: '#34c87b',
  primaryDeep: '#0a3a1f',
  primaryBg: 'rgba(184, 134, 11, 0.95)',
  primaryBgLight: 'rgba(184, 134, 11, 0.15)',
  primaryBgSubtle: 'rgba(184, 134, 11, 0.08)',
  primaryBorder: 'rgba(184, 134, 11, 0.3)',
  primaryBorderStrong: 'rgba(184, 134, 11, 0.4)',

  // 辅助色
  purple: '#a78bfa',
  purpleBg: 'rgba(167, 139, 250, 0.15)',
  purpleBorder: 'rgba(167, 139, 250, 0.3)',

  amber: '#f59e0b',
  amberBg: 'rgba(245, 158, 11, 0.18)',
  amberBorder: 'rgba(245, 158, 11, 0.3)',

  danger: '#ef4444',
  dangerBg: 'rgba(239, 68, 68, 0.18)',
  dangerBorder: 'rgba(239, 68, 68, 0.3)',

  gray: '#9ca3af',
  grayBg: 'rgba(107, 114, 128, 0.18)',
  grayBorder: 'rgba(107, 114, 128, 0.3)',

  // 文字 / 背景
  text: '#fff',
  textMuted: 'rgba(255,255,255,0.7)',
  textSubtle: 'rgba(255,255,255,0.5)',
  textFaint: 'rgba(255,255,255,0.4)',
  textGhost: 'rgba(255,255,255,0.3)',

  bgPrimary: 'rgba(15, 22, 18, 0.6)',
  bgSecondary: 'rgba(15, 22, 18, 0.95)',
  bgElevated: 'rgba(15, 22, 18, 0.4)',
  bgInput: 'rgba(0,0,0,0.3)',
  bgHover: 'rgba(255,255,255,0.04)',

  bgPage: 'radial-gradient(ellipse at top, rgba(184, 134, 11, 0.04) 0%, transparent 50%), linear-gradient(180deg, #2c1810 0%, #1a0e08 100%)',

  border: 'rgba(184, 134, 11, 0.08)',
  borderStrong: 'rgba(184, 134, 11, 0.15)',
  borderMuted: 'rgba(255,255,255,0.06)',
} as const

// ============================================
// 字体
// ============================================
export const fontSize = {
  xs: 11,
  sm: 12,
  base: 13,
  md: 14,
  lg: 15,
  xl: 16,
  xxl: 18,
  xxxl: 22,
  display: 28,
} as const

export const fontWeight = {
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  extrabold: 800,
} as const

// ============================================
// 间距 (基于 4px grid)
// ============================================
export const spacing = {
  px: 1,
  0: 0,
  1: 4,
  2: 6,
  3: 8,
  4: 10,
  5: 12,
  6: 14,
  7: 16,
  8: 20,
  9: 24,
  10: 32,
  11: 40,
  12: 48,
  14: 60,
  16: 80,
} as const

// ============================================
// 圆角
// ============================================
export const radius = {
  sm: 4,
  md: 6,
  base: 8,
  lg: 10,
  xl: 12,
  xxl: 14,
  xxxl: 16,
  full: 9999,
} as const

// ============================================
// 阴影
// ============================================
export const shadow = {
  sm: '0 2px 8px rgba(0,0,0,0.15)',
  md: '0 4px 16px rgba(0,0,0,0.25)',
  lg: '0 8px 32px rgba(0,0,0,0.4)',
  glow: '0 0 24px rgba(184, 134, 11, 0.2)',
} as const

// ============================================
// 触控目标 (iOS HIG ≥ 44pt, Material ≥ 48dp)
// ============================================
export const touchTarget = {
  min: 44,    // iOS 标准
  comfortable: 48, // Material 标准
} as const

// ============================================
// 断点
// ============================================
export const breakpoint = {
  mobile: 640,   // 移动端
  tablet: 768,   // 平板（折叠点）
  desktop: 1024, // 桌面
  wide: 1280,    // 宽屏
} as const

export const media = {
  mobile: `@media (max-width: ${breakpoint.tablet - 1}px)`,
  tablet: `@media (min-width: ${breakpoint.tablet}px) and (max-width: ${breakpoint.desktop - 1}px)`,
  desktop: `@media (min-width: ${breakpoint.desktop}px)`,
  wide: `@media (min-width: ${breakpoint.wide}px)`,
} as const

// ============================================
// 动画
// ============================================
export const animation = {
  fast: '0.15s ease',
  base: '0.25s ease',
  slow: '0.4s ease',
} as const

// ============================================
// z-index
// ============================================
export const zIndex = {
  base: 0,
  dropdown: 50,
  sticky: 60,
  toolbar: 70,
  drawer: 80,
  modal: 90,
  toast: 100,
  tooltip: 110,
} as const

// ============================================
// 移动端 / 桌面 工具
// ============================================
export function isMobileViewport(): boolean {
  if (typeof window === 'undefined') return false
  return window.innerWidth < breakpoint.tablet
}