'use client'

/**
 * ShareButton · 分享按钮（段 234 落地 · 2026-10-01 01:23）
 *
 * 功能：移动端调用 navigator.share()，桌面 fallback 复制链接到剪贴板
 * 设计：右上角浮动按钮 + 透明背景 + 大点击区
 */

import { useState } from 'react'

interface ShareButtonProps {
  title: string
  text: string
  url: string
}

export default function ShareButton({ title, text, url }: ShareButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleShare = async () => {
    // 移动端 / 现代浏览器：原生分享
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, text, url })
        return
      } catch (err) {
        // 用户取消或不支持，静默 fallback
      }
    }

    // Fallback：复制到剪贴板
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // 终极 fallback：提示用户手动复制
      const ta = document.createElement('textarea')
      ta.value = url
      document.body.appendChild(ta)
      ta.select()
      try {
        document.execCommand('copy')
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch {}
      document.body.removeChild(ta)
    }
  }

  return (
    <button
      onClick={handleShare}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '6px 12px',
        background: copied
          ? 'linear-gradient(135deg, rgba(76, 175, 80, 0.3), rgba(76, 175, 80, 0.1))'
          : 'rgba(184, 134, 11, 0.1)',
        border: '1px solid ' + (copied ? 'rgba(76, 175, 80, 0.5)' : 'rgba(184, 134, 11, 0.3)'),
        borderRadius: 100,
        color: copied ? '#4caf50' : '#b8860b',
        cursor: 'pointer',
        fontSize: 12,
        fontWeight: 600,
        fontFamily: 'inherit',
        transition: 'all 0.2s',
      }}
    >
      <span style={{ fontSize: 14 }}>{copied ? '✓' : '📤'}</span>
      <span>{copied ? '已复制' : '分享'}</span>
    </button>
  )
}