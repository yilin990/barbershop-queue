'use client'
import { colors, fontSize, fontWeight, radius, spacing } from '@/lib/design-tokens'
import type { CSSProperties, ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  style?: CSSProperties
  hoverable?: boolean
  onClick?: () => void
  padding?: number
  title?: ReactNode
  action?: ReactNode  // ⭐ 奕霖 2026-09-07 21:15 "按键打不开":title 行右侧操作区
}

/**
 * 统一 Card 容器
 */
export function Card({ children, style, hoverable, onClick, padding = spacing[7], title, action }: CardProps) {
  return (
    <div
      onClick={onClick}
      style={{
        background: colors.bgPrimary,
        border: `1px solid ${colors.border}`,
        borderRadius: radius.xxl,
        padding,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s ease',
        ...style,
      }}
      onMouseEnter={(e) => {
        if (hoverable) {
          e.currentTarget.style.borderColor = colors.primaryBorder
          e.currentTarget.style.transform = 'translateY(-1px)'
        }
      }}
      onMouseLeave={(e) => {
        if (hoverable) {
          e.currentTarget.style.borderColor = colors.border
          e.currentTarget.style.transform = 'translateY(0)'
        }
      }}
    >
      {(title || action) && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing[3],
          marginBottom: spacing[4],
          paddingBottom: spacing[3],
          borderBottom: `1px solid ${colors.borderFaint}`,
        }}>
          <div style={{
            fontSize: fontSize.lg,
            fontWeight: 600,
            color: colors.text,
            flex: 1,
            minWidth: 0,
          }}>
            {title}
          </div>
          {action && <div style={{ flexShrink: 0, display: 'flex', gap: spacing[2] }}>{action}</div>}
        </div>
      )}
      {children}
    </div>
  )
}

interface SummaryCardProps {
  label: string
  value: string | number
  prefix?: string
  suffix?: string
  color?: string
  icon?: ReactNode
}

export function SummaryCard({ label, value, prefix, suffix, color, icon }: SummaryCardProps) {
  return (
    <Card padding={spacing[4]}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {icon && <span style={{ color: color || colors.primary, display: 'inline-flex' }}>{icon}</span>}
        <div style={{ fontSize: fontSize.xs, color: colors.textSubtle }}>{label}</div>
      </div>
      <div style={{ fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: color || colors.text, marginTop: 4 }}>
        {prefix || ''}{typeof value === 'number' ? value.toLocaleString() : value}{suffix || ''}
      </div>
    </Card>
  )
}