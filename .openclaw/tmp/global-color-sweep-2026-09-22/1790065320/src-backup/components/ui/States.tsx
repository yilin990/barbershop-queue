'use client'
import { colors, fontSize, fontWeight, radius, spacing } from '@/lib/design-tokens'
import { Button } from './Button'
import type { ReactNode } from 'react'
import { Package, AlertTriangle, FileSearch, Loader2 } from 'lucide-react'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
}

/**
 * 空状态 - 含引导
 */
export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: `${spacing[14]} ${spacing[7]}`,
        color: colors.textSubtle,
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          padding: spacing[8],
          borderRadius: radius.full,
          background: colors.bgHover,
          marginBottom: spacing[6],
        }}
      >
        <div style={{ color: colors.textGhost, opacity: 0.6 }}>
          {icon || <FileSearch size={48} strokeWidth={1.5} />}
        </div>
      </div>
      <div style={{ fontSize: fontSize.md, color: colors.textMuted, marginBottom: 4 }}>{title}</div>
      {description && (
        <div style={{ fontSize: fontSize.sm, color: colors.textFaint, maxWidth: 360, margin: '0 auto 20px' }}>
          {description}
        </div>
      )}
      {action && <Button variant="primary" onClick={action.onClick}>{action.label}</Button>}
    </div>
  )
}

interface ErrorStateProps {
  title?: string
  error?: string
  onRetry?: () => void
}

/**
 * 错误状态 - 含重试按钮
 */
export function ErrorState({ title = '加载失败', error, onRetry }: ErrorStateProps) {
  return (
    <div
      role="alert"
      style={{
        textAlign: 'center',
        padding: `${spacing[14]} ${spacing[7]}`,
        color: colors.textSubtle,
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          padding: spacing[8],
          borderRadius: radius.full,
          background: colors.dangerBg,
          marginBottom: spacing[6],
        }}
      >
        <AlertTriangle size={48} strokeWidth={1.5} color={colors.danger} />
      </div>
      <div style={{ fontSize: fontSize.md, color: colors.danger, marginBottom: 4 }}>{title}</div>
      {error && (
        <div style={{ fontSize: fontSize.xs, color: colors.textFaint, maxWidth: 480, margin: '0 auto 16px', fontFamily: 'monospace' }}>
          {error}
        </div>
      )}
      {onRetry && <Button variant="secondary" onClick={onRetry}>↻ 重试</Button>}
    </div>
  )
}

interface SkeletonProps {
  width?: string | number
  height?: string | number
  radius?: number
  style?: React.CSSProperties
}

/**
 * 骨架屏 - 单个块
 */
export function Skeleton({ width = '100%', height = 16, radius: r = radius.sm, style }: SkeletonProps) {
  return (
    <div
      className="qinghe-skeleton"
      style={{
        width,
        height,
        borderRadius: r,
        background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 100%)',
        backgroundSize: '200% 100%',
        animation: 'qinghe-skeleton-shimmer 1.5s ease-in-out infinite',
        ...style,
      }}
    />
  )
}

/**
 * 骨架屏 - 表格行
 */
export function SkeletonRow({ cols = 5 }: { cols?: number }) {
  return (
    <div style={{ display: 'flex', gap: spacing[5], padding: `${spacing[5]} ${spacing[7]}`, borderBottom: `1px solid ${colors.borderMuted}` }}>
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} height={14} width={`${100 / cols}%`} />
      ))}
    </div>
  )
}

interface LoadingProps {
  text?: string
  showSpinner?: boolean
}

/**
 * 加载中 - 通用
 */
export function Loading({ text = '加载中…', showSpinner = true }: LoadingProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{ textAlign: 'center', padding: spacing[14], color: colors.textSubtle, fontSize: fontSize.sm }}
    >
      {showSpinner && (
        <Loader2
          size={32}
          color={colors.primary}
          style={{ animation: 'qinghe-spin 1s linear infinite', marginBottom: spacing[4] }}
        />
      )}
      <div>{text}</div>
    </div>
  )
}

/**
 * 通用空 + 包装
 */
export function NotFound({ resource = '数据' }: { resource?: string }) {
  return <EmptyState icon={<Package size={48} strokeWidth={1.5} />} title={`暂无${resource}`} description="数据可能还未生成，或筛选条件过严" />
}