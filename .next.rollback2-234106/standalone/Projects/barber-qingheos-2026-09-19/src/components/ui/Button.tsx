'use client'
import { colors, fontSize, fontWeight, radius, spacing, touchTarget, animation } from '@/lib/design-tokens'
import type { CSSProperties, ReactNode, ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  block?: boolean
  icon?: ReactNode
  loading?: boolean
}

/**
 * 统一 Button 组件
 * - 触控目标 ≥ 44px (iOS HIG)
 * - focus-visible 边框（键盘可访问）
 * - hover/active 反馈
 */
export function Button({
  variant = 'primary',
  size = 'md',
  block,
  icon,
  loading,
  children,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const sizeMap = {
    sm: { padding: '6px 12px', fontSize: fontSize.xs, minHeight: 36 },
    md: { padding: '10px 18px', fontSize: fontSize.sm, minHeight: touchTarget.min },
    lg: { padding: '12px 24px', fontSize: fontSize.md, minHeight: touchTarget.comfortable },
  } as const

  const variantMap = {
    primary: { bg: colors.primaryBg, color: colors.primaryDeep, border: 'transparent' },
    secondary: { bg: colors.bgPrimary, color: colors.text, border: colors.primaryBorder },
    ghost: { bg: 'transparent', color: colors.textMuted, border: colors.borderMuted },
    danger: { bg: colors.dangerBg, color: colors.danger, border: colors.dangerBorder },
    success: { bg: colors.primaryBgLight, color: colors.primary, border: colors.primaryBorder },
  } as const

  const s = sizeMap[size]
  const v = variantMap[variant]

  const baseStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: s.padding,
    fontSize: s.fontSize,
    fontWeight: fontWeight.semibold,
    fontFamily: 'inherit',
    minHeight: s.minHeight,
    borderRadius: radius.base,
    background: v.bg,
    color: v.color,
    border: `1px solid ${v.border}`,
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    transition: animation.fast,
    width: block ? '100%' : 'auto',
    outline: 'none',
    userSelect: 'none',
    ...style,
  }

  return (
    <button
      type="button"
      disabled={disabled || loading}
      aria-busy={loading}
      style={baseStyle}
      onFocus={(e) => {
        if (!disabled && !loading) {
          e.currentTarget.style.boxShadow = `0 0 0 2px ${colors.primary}, 0 0 0 4px ${colors.primaryBorder}`
        }
      }}
      onBlur={(e) => {
        e.currentTarget.style.boxShadow = 'none'
      }}
      {...rest}
    >
      {loading ? '⏳ 处理中…' : (
        <>
          {icon && <span style={{ display: 'inline-flex' }}>{icon}</span>}
          {children}
        </>
      )}
    </button>
  )
}