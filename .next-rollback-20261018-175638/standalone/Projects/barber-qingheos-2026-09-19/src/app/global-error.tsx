'use client'

/**
 * 全局错误边界（root layout 级别兜底）
 * ⭐ 清禾 2026-10-07 23:45 新增
 *
 * 连 root layout 自己都炸的时候才触发 —— 这时候连 error.tsx 都救不了，
 * 所以必须自己渲染 html/body。
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="zh-CN">
      <body>
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
          <div style={{ fontSize: '48px' }}>🌾</div>
          <h1 style={{ fontSize: '20px', margin: '16px 0 8px' }}>整个页面崩了</h1>
          <p style={{ fontSize: '14px', opacity: 0.7, textAlign: 'center', maxWidth: '340px' }}>
            比刚才更严重一点，整个站的外壳都没了。点下面重试。
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: '24px',
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
        </div>
      </body>
    </html>
  )
}
