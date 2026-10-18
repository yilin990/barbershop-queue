// ⭐ 奕霖 2026-10-04 00:04：内联 SVG 替代 Iconify（真 SSR，零客户端渲染延迟）
//
// 数据来自 Material Symbols（material-symbols:auto-awesome / material-symbols:style）
// 路径 body 提取自 @iconify-json/material-symbols/icons.json
//
// 优势：
//   1. 真 SSR — 直接 <svg> 进 initial HTML，无 hydration 闪烁
//   2. zero runtime — 不依赖 Iconify 包
//   3. CSS 完全可控（fill / stroke / opacity / drop-shadow）

import type { CSSProperties } from 'react'

type IconProps = {
  size?: number
  style?: CSSProperties
  className?: string
  title?: string
}

/**
 * auto-awesome · sparkle · 造型 AI 大卡 + 底部 nav
 * 原始 body: <path fill="currentColor" d="m19 9l-1.25-2.75L15 5l2.75-1.25L19 1..."/>
 * viewBox 24×24
 */
export function AutoAwesomeIcon({ size = 24, style, className, title }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      style={style}
      className={className}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title ? <title>{title}</title> : null}
      <path d="m19 9l-1.25-2.75L15 5l2.75-1.25L19 1l1.25 2.75L23 5l-2.75 1.25L19 9Zm0 14l-1.25-2.75L15 19l2.75-1.25L19 15l1.25 2.75L23 19l-2.75 1.25L19 23ZM9 20l-2.5-5.5L1 12l5.5-2.5L9 4l2.5 5.5L17 12l-5.5 2.5L9 20Z" />
    </svg>
  )
}

/**
 * style · palette/brush · 风格库底部 nav
 * 原始 body 包含 3 个子 path（画笔 + 色块 + 圆点）
 * viewBox 24×24
 */
export function StyleIcon({ size = 24, style, className, title }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      style={style}
      className={className}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title ? <title>{title}</title> : null}
      <path d="m3.975 19.8l-.85-.35q-.775-.325-1.037-1.125t.087-1.575l1.8-3.9zm4 2.2q-.825 0-1.412-.587T5.975 20v-6l2.65 7.35q.075.175.15.338t.2.312zm5.15-.1q-.8.3-1.55-.075t-1.05-1.175l-4.45-12.2q-.3-.8.05-1.562t1.15-1.038l7.55-2.75q.8-.3 1.55.075t1.05 1.175l4.45 12.2q.3.8-.05 1.563t-1.15 1.037zM11.688 9.713q.287-.288.287-.713t-.287-.712T10.975 8t-.712.288T9.975 9t.288.713t.712.287t.713-.288" />
    </svg>
  )
}

/**
 * shopping-cart · 购物车 · /me 烟筒积分预览 + 兑换按钮
 * viewBox 24×24
 */
export function ShoppingCartIcon({ size = 24, style, className, title }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      style={style}
      className={className}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title ? <title>{title}</title> : null}
      <path d="M5.588 21.413Q5 20.825 5 20t.588-1.412T7 18t1.413.588T9 20t-.587 1.413T7 22t-1.412-.587m10 0Q15 20.825 15 20t.588-1.412T17 18t1.413.588T19 20t-.587 1.413T17 22t-1.412-.587M5.2 4h14.75q.575 0 .875.513t.025 1.037l-3.55 6.4q-.275.5-.737.775T15.55 13H8.1L7 15h12v2H7q-1.125 0-1.7-.987t-.05-1.963L6.6 11.6L3 4H1V2h3.25z" />
    </svg>
  )
}