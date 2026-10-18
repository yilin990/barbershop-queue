'use client'

import { useState, useRef } from 'react'

/**
 * MiniChart - mini area chart
 * 替代之前简陋的 sparkline（只几个柱子）
 * 升级点：
 * - 真实 area chart（线 + 渐变填充）
 * - 鼠标 hover 显示 tooltip + 数据点（用外层 div mousemove，不用 SVG hit detection，避免拦截 click）
 * - warn 模式红色配色
 *
 * 设计选择：SVG 整体 pointer-events: none，让外层 StatCard 的 onClick 能正常触发
 * 鼠标 hover 改由外层 div onMouseMove + position 算 closest point
 */
interface MiniChartProps {
  data: number[]
  warn?: boolean
  height?: number
  width?: number
}

export function MiniChart({ data, warn = false, height = 56, width = 200 }: MiniChartProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const max = Math.max(...data, 1)
  const padding = 4
  const w = width - padding * 2
  const h = height - padding * 2
  const step = data.length > 1 ? w / (data.length - 1) : w

  const points = data.map((v, i) => ({
    x: padding + i * step,
    y: padding + h - (v / max) * h,
    value: v,
  }))

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${padding + h} L ${points[0].x.toFixed(1)} ${padding + h} Z`

  const color = warn ? '#ef4444' : '#b8860b'
  const gradientId = `chart-grad-${warn ? 'warn' : 'normal'}-${data.length}`

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const xRel = (e.clientX - rect.left) / rect.width * width
    // 找 closest point by x
    let closest = 0
    let minDist = Infinity
    for (let i = 0; i < points.length; i++) {
      const d = Math.abs(points[i].x - xRel)
      if (d < minDist) { minDist = d; closest = i }
    }
    setHoverIdx(closest)
  }

  const handleMouseLeave = () => setHoverIdx(null)

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ position: 'relative', height, width: '100%', cursor: 'crosshair' }}
    >
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        style={{ display: 'block', pointerEvents: 'none' }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={warn ? 0.4 : 0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* 渐变填充 */}
        <path d={areaPath} fill={`url(#${gradientId})`} pointerEvents="none" />

        {/* 折线 */}
        <path d={linePath} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" opacity={0.85} pointerEvents="none" />

        {/* 所有数据点（小圆） */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={i === hoverIdx ? 3 : 1.5}
            fill={color}
            opacity={i === hoverIdx ? 1 : 0.5}
            pointerEvents="none"
          />
        ))}

        {/* hover 十字线 */}
        {hoverIdx !== null && (
          <line
            x1={points[hoverIdx].x}
            y1={0}
            x2={points[hoverIdx].x}
            y2={height}
            stroke={color}
            strokeWidth={1}
            strokeDasharray="2,2"
            opacity={0.4}
            pointerEvents="none"
          />
        )}
      </svg>

      {/* Tooltip */}
      {hoverIdx !== null && containerRef.current && (() => {
        const rect = containerRef.current.getBoundingClientRect()
        const xPct = points[hoverIdx].x / width
        const xPx = xPct * rect.width
        return (
          <div style={{
            position: 'absolute',
            left: xPx,
            top: Math.max(0, points[hoverIdx].y - 32),
            transform: 'translateX(-50%)',
            background: 'rgba(15, 22, 18, 0.95)',
            border: `1px solid ${color}50`,
            color: '#fff',
            padding: '4px 8px',
            borderRadius: 6,
            fontSize: 10,
            fontWeight: 700,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 2,
          }}>
            {points[hoverIdx].value}
          </div>
        )
      })()}
    </div>
  )
}
