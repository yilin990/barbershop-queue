'use client'
import { useEffect, useState, ReactNode } from 'react'
import { colors, fontSize, fontWeight, radius, spacing, breakpoint } from '@/lib/design-tokens'
import { Check } from 'lucide-react'

export interface Column<T> {
  key: string
  title: string
  width?: string | number
  /** 移动端隐藏 */
  hideOnMobile?: boolean
  render: (row: T, index: number) => ReactNode
  align?: 'left' | 'right' | 'center'
}

interface ResponsiveTableProps<T> {
  columns: Column<T>[]
  data: T[]
  rowKey: (row: T) => string
  loading?: boolean
  selectable?: boolean
  selectedIds?: string[]
  onSelectChange?: (ids: string[]) => void
  emptyState?: ReactNode
  /** 移动端卡片渲染（如果不传则自动从 columns[0] 取） */
  mobileCardRender?: (row: T) => ReactNode
}

/**
 * 响应式表格
 * - 桌面 (≥ 768px): 表格
 * - 移动 (< 768px): 卡片流
 */
export function ResponsiveTable<T>({
  columns,
  data,
  rowKey,
  loading,
  selectable,
  selectedIds = [],
  onSelectChange,
  emptyState,
  mobileCardRender,
}: ResponsiveTableProps<T>) {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < breakpoint.tablet)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const allSelected = data.length > 0 && data.every((row) => selectedIds.includes(rowKey(row)))
  const toggleAll = () => {
    if (!onSelectChange) return
    if (allSelected) onSelectChange([])
    else onSelectChange(data.map(rowKey))
  }
  const toggleOne = (id: string) => {
    if (!onSelectChange) return
    if (selectedIds.includes(id)) onSelectChange(selectedIds.filter((x) => x !== id))
    else onSelectChange([...selectedIds, id])
  }

  if (loading) {
    return (
      <div style={{ background: colors.bgPrimary, borderRadius: radius.xxl, padding: spacing[7], textAlign: 'center', color: colors.textSubtle }}>
        加载中…
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div style={{ background: colors.bgPrimary, borderRadius: radius.xxl, padding: spacing[14], border: `1px solid ${colors.border}` }}>
        {emptyState || <div style={{ textAlign: 'center', color: colors.textSubtle }}>暂无数据</div>}
      </div>
    )
  }

  // 移动端：卡片流
  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[3] }}>
        {data.map((row, idx) => {
          const id = rowKey(row)
          const isSelected = selectedIds.includes(id)
          return (
            <div
              key={id}
              role="article"
              onClick={() => selectable && toggleOne(id)}
              style={{
                background: colors.bgPrimary,
                border: `1px solid ${isSelected ? colors.primaryBorder : colors.border}`,
                borderRadius: radius.xxl,
                padding: spacing[5],
                cursor: selectable ? 'pointer' : 'default',
              }}
            >
              {selectable && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
                  {isSelected ? <Check size={18} color={colors.primary} /> : <div style={{ width: 18, height: 18, borderRadius: 4, border: `1px solid ${colors.borderMuted}` }} />}
                </div>
              )}
              {mobileCardRender ? mobileCardRender(row) : (
                <div>
                  {columns.slice(0, 3).map((col) => (
                    <div key={col.key} style={{ marginBottom: 4 }}>
                      <div style={{ fontSize: fontSize.xs, color: colors.textSubtle, marginBottom: 2 }}>{col.title}</div>
                      <div>{col.render(row, idx)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  // 桌面端：表格
  return (
    <div style={{ background: colors.bgPrimary, borderRadius: radius.xxl, overflow: 'hidden', border: `1px solid ${colors.border}` }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: colors.primaryBgSubtle, borderBottom: `1px solid ${colors.primaryBorder}` }}>
              {selectable && (
                <th style={{ padding: spacing[5], width: 32 }}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="全选"
                    style={{ cursor: 'pointer', accentColor: colors.primary }}
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{
                    padding: spacing[5],
                    textAlign: col.align || 'left',
                    fontSize: fontSize.xs,
                    color: colors.textSubtle,
                    fontWeight: fontWeight.semibold,
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                    width: col.width,
                  }}
                >
                  {col.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => {
              const id = rowKey(row)
              const isSelected = selectedIds.includes(id)
              return (
                <tr
                  key={id}
                  style={{
                    borderBottom: `1px solid ${colors.borderMuted}`,
                    background: isSelected ? colors.primaryBgSubtle : 'transparent',
                  }}
                >
                  {selectable && (
                    <td style={{ padding: spacing[5] }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleOne(id)}
                        aria-label={`选择 ${id}`}
                        style={{ cursor: 'pointer', accentColor: colors.primary }}
                      />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      style={{
                        padding: spacing[5],
                        fontSize: fontSize.base,
                        color: colors.text,
                        textAlign: col.align || 'left',
                      }}
                    >
                      {col.render(row, idx)}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}