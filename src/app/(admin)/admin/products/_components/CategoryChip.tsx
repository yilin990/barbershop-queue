// v0.8.68.1 - 分类 chip 按钮(顶部筛选条)
'use client'
import { colors, fontSize, fontWeight, radius } from '@/lib/design-tokens'

interface Props {
  label: string
  count: number
  active: boolean
  onClick: () => void
}

export function CategoryChip({ label, count, active, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      style={{
        padding: '10px 16px',
        borderRadius: radius.full,
        fontSize: fontSize.xs,
        fontWeight: fontWeight.semibold,
        border: `1px solid ${active ? colors.primaryBorderStrong : colors.borderMuted}`,
        background: active ? colors.primaryBgLight : 'transparent',
        color: active ? colors.primary : colors.textMuted,
        cursor: 'pointer',
        fontFamily: 'inherit',
        minHeight: 44,
      }}
    >
      {label} ({count})
    </button>
  )
}
