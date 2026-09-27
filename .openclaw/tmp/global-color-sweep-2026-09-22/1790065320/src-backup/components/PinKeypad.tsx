'use client'

/**
 * ⭐ 2026-09-20 14:26 奕霖立：PIN 数字键盘（4 位专用）
 *
 * 设计：
 * - 大号 12 键 (1-9 + 0 + 删除 + 确认)
 * - 移动端友好
 * - 主题色暖米深棕金
 * - 不可输入非数字
 */

import React from 'react'

interface PinKeypadProps {
  length?: number
  value: string
  onChange: (v: string) => void
  onComplete?: (v: string) => void
  showSubmit?: boolean
  onSubmit?: () => void
  primary: string
  primaryDark: string
  text: string
  textMuted: string
  bgDeep: string
  border: string
}

export function PinKeypad({
  length = 4,
  value,
  onChange,
  onComplete,
  showSubmit = false,
  onSubmit,
  primary,
  primaryDark,
  text,
  textMuted,
  bgDeep,
  border,
}: PinKeypadProps) {
  function press(d: string) {
    if (d === '⌫') {
      onChange(value.slice(0, -1))
      return
    }
    if (value.length >= length) return
    const next = value + d
    onChange(next)
    if (next.length === length && onComplete) {
      // 延迟触发，让圆点动画先出现
      setTimeout(() => onComplete(next), 80)
    }
  }

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', showSubmit ? 'skip' : '⌫', '0', showSubmit ? '✓' : '✓']

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: 8,
      maxWidth: 280,
      margin: '0 auto',
    }}>
      {keys.map((k, i) => {
        if (k === 'skip') {
          return <div key={i} />
        }
        if (k === '⌫') {
          return (
            <button
              key={i}
              onClick={() => press('⌫')}
              style={{
                padding: '18px 0',
                background: 'transparent',
                color: textMuted,
                border: 'none',
                borderRadius: 12,
                fontSize: 22, fontWeight: 600,
                cursor: 'pointer',
              }}
            >⌫</button>
          )
        }
        if (k === '✓') {
          if (!showSubmit) {
            return (
              <button
                key={i}
                onClick={() => value.length === length && onSubmit?.()}
                disabled={value.length !== length}
                style={{
                  padding: '18px 0',
                  background: value.length === length ? primary : bgDeep,
                  color: value.length === length ? '#fff' : textMuted,
                  border: `1px solid ${value.length === length ? primary : border}`,
                  borderRadius: 12,
                  fontSize: 22, fontWeight: 700,
                  cursor: value.length === length ? 'pointer' : 'not-allowed',
                }}
              >✓</button>
            )
          }
          return (
            <button
              key={i}
              onClick={() => value.length === length && onSubmit?.()}
              disabled={value.length !== length}
              style={{
                padding: '18px 0',
                background: value.length === length ? primary : bgDeep,
                color: value.length === length ? '#fff' : textMuted,
                border: `1px solid ${value.length === length ? primary : border}`,
                borderRadius: 12,
                fontSize: 22, fontWeight: 700,
                cursor: value.length === length ? 'pointer' : 'not-allowed',
              }}
            >✓</button>
          )
        }
        return (
          <button
            key={i}
            onClick={() => press(k)}
            style={{
              padding: '18px 0',
              background: bgDeep,
              color: text,
              border: `1px solid ${border}`,
              borderRadius: 12,
              fontSize: 22, fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.1s',
            }}
          >{k}</button>
        )
      })}
    </div>
  )
}

/* ========== PIN dots indicator ========== */

export function PinDots({
  length = 4,
  value,
  primary,
  border,
}: { length?: number; value: string; primary: string; border: string }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'center', gap: 14,
      marginBottom: 18,
    }}>
      {Array.from({ length }).map((_, i) => (
        <div
          key={i}
          style={{
            width: 18, height: 18, borderRadius: '50%',
            background: i < value.length ? primary : 'transparent',
            border: `2px solid ${i < value.length ? primary : border}`,
            transition: 'all 0.15s',
          }}
        />
      ))}
    </div>
  )
}