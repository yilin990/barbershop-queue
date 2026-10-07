'use client'

/**
 * 全站错误边界（route 级）
 * ⭐ 清禾 2026-10-07 23:45 新增
 *
 * 为什么要加：之前 src/app 下没有任何 error.tsx，
 * 任何一处 JS 崩 / 未定义变量 → 整页纯白，用户只看到"打不开"，
 * 没有任何提示、没有重试入口、日志里也看不出是哪一页崩的。
 *
 * 现在：崩了也能看懂、能一键重试、能把出错页显示给用户。
 */

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
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
        不是你的手机或网络的问题，是这个页面自己崩了。点下面重试一下。
      </p>
      {error.digest && (
        <p style={{ fontSize: '11px', opacity: 0.4, marginTop: '12px' }}>编号 {error.digest}</p>
      )}
      <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
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
    </div>
  )
}
