'use client'

import { useEffect } from 'react'

/**
 * 全站错误边界（route 级）
 * ⭐ 清禾 2026-10-07 23:45 新增 · 2026-10-08 00:25 升级为「自诊断版」
 *
 * 为什么要加：之前 src/app 下没有任何 error.tsx，
 * 任何一处 JS 崩 / 未定义变量 → 整页纯白，用户只看到"打不开"，
 * 没有任何提示、没有重试入口、日志里也看不出是哪一页崩的。
 *
 * ⭐ 升级原因：iOS 模拟器复现「登录后白屏」，但错误边界只显示通用文案，
 * 看不出真实原因。关键线索：digest 为空 = 客户端渲染错误，
 * 此时 error.message 是真实可用的（服务端错误才会被 Next.js 抹掉）。
 * 所以现在：① 显示真实报错 ② 自动上报到 /api/debug/client-error
 */

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    try {
      const payload = JSON.stringify({
        message: error.message,
        name: error.name,
        stack: (error.stack || '').slice(0, 800),
        path: typeof window !== 'undefined' ? window.location.pathname + window.location.search : '',
      })
      // sendBeacon 在页面卸载/重试时也能送达，比 fetch 可靠
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        navigator.sendBeacon('/api/debug/client-error', new Blob([payload], { type: 'application/json' }))
      } else {
        fetch('/api/debug/client-error', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
        }).catch(() => {})
      }
    } catch {
      /* 上报失败也不能再崩 */
    }
  }, [error])

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      background: '#faf6f0',
      color: '#3a2f25',
      fontFamily: 'system-ui, -apple-system, "PingFang SC", sans-serif',
    }}>
      <div style={{ fontSize: '48px', lineHeight: 1 }}>🌾</div>
      <h1 style={{ fontSize: '20px', margin: '16px 0 8px' }}>这个页面出了点问题</h1>
      <p style={{ fontSize: '14px', opacity: 0.7, margin: 0, textAlign: 'center', maxWidth: '360px' }}>
        不是你的手机或网络的问题，是这个页面自己崩了。
      </p>

      {/* ⭐ 真实报错：诊断完就撤掉这整块 */}
      {error.message && (
        <pre style={{
          marginTop: '16px',
          padding: '12px',
          maxWidth: '420px',
          width: '100%',
          background: 'rgba(184,134,11,0.08)',
          border: '1px solid rgba(184,134,11,0.25)',
          borderRadius: 8,
          fontSize: '11px',
          lineHeight: 1.5,
          color: '#8b6508',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          overflowX: 'auto',
        }}>
{error.name}: {error.message}
        </pre>
      )}

      <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
        <button
          onClick={reset}
          style={{
            padding: '10px 22px',
            borderRadius: '8px',
            border: 'none',
            background: '#b8860b',
            color: '#fff',
            fontSize: '15px',
            cursor: 'pointer',
          }}
        >
          重试
        </button>
        <a
          href="/merchant/queue"
          style={{
            padding: '10px 22px',
            borderRadius: '8px',
            border: '1px solid rgba(184,134,11,0.4)',
            background: '#fff',
            color: '#b8860b',
            fontSize: '15px',
            textDecoration: 'none',
          }}
        >
          回排队页
        </a>
      </div>
      {error.digest && (
        <p style={{ fontSize: '11px', opacity: 0.4, marginTop: '12px' }}>编号 {error.digest}</p>
      )}
    </div>
  )
}
