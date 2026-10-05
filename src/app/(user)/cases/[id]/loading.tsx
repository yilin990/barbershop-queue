/**
 * /cases/[id] 加载骨架屏 · 段 234
 */

export default function Loading() {
  return (
    <div style={{
      padding: '8px 16px 180px',
      animation: 'fadeIn 0.3s ease-out',
    }}>
      {/* 顶部 action 区 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        marginBottom: 16,
      }}>
        <div style={{
          width: 70, height: 28,
          background: 'rgba(184, 134, 11, 0.1)',
          borderRadius: 100,
          animation: 'pulse 1.5s ease-in-out infinite',
        }} />
        <div style={{ flex: 1 }} />
        <div style={{
          width: 70, height: 28,
          background: 'rgba(184, 134, 11, 0.1)',
          borderRadius: 100,
          animation: 'pulse 1.5s ease-in-out infinite',
        }} />
      </div>

      {/* 大图占位 */}
      <div style={{
        aspectRatio: '4 / 5',
        maxHeight: 400,
        background: 'linear-gradient(135deg, #b8860b 0%, #2c1810 100%)',
        borderRadius: 20,
        marginBottom: 20,
        animation: 'pulse 1.5s ease-in-out infinite',
      }} />

      {/* 标题 */}
      <div style={{ marginBottom: 18 }}>
        <div style={{
          height: 11, width: '40%',
          background: 'rgba(184,134,11,0.15)',
          borderRadius: 4,
          marginBottom: 6,
          animation: 'pulse 1.5s ease-in-out infinite',
        }} />
        <div style={{
          height: 26, width: '80%',
          background: 'rgba(255,255,255,0.15)',
          borderRadius: 4,
          marginBottom: 6,
          animation: 'pulse 1.5s ease-in-out infinite',
        }} />
        <div style={{
          height: 14, width: '50%',
          background: 'rgba(255,255,255,0.08)',
          borderRadius: 4,
          animation: 'pulse 1.5s ease-in-out infinite',
        }} />
      </div>

      {/* 双卡 */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
        marginBottom: 20,
      }}>
        <div style={{
          height: 80,
          background: 'rgba(184, 134, 11, 0.1)',
          borderRadius: 14,
          animation: 'pulse 1.5s ease-in-out infinite',
        }} />
        <div style={{
          height: 80,
          background: 'rgba(255,255,255,0.05)',
          borderRadius: 14,
          animation: 'pulse 1.5s ease-in-out infinite',
        }} />
      </div>

      {/* 描述卡 */}
      <div style={{
        background: 'rgba(44, 24, 16, 0.4)',
        borderRadius: 16,
        padding: '18px',
        marginBottom: 16,
      }}>
        <div style={{
          height: 13, width: '20%',
          background: 'rgba(255,255,255,0.15)',
          borderRadius: 4,
          marginBottom: 10,
          animation: 'pulse 1.5s ease-in-out infinite',
        }} />
        <div style={{
          height: 11, width: '100%',
          background: 'rgba(255,255,255,0.08)',
          borderRadius: 4,
          marginBottom: 6,
          animation: 'pulse 1.5s ease-in-out infinite',
        }} />
        <div style={{
          height: 11, width: '90%',
          background: 'rgba(255,255,255,0.08)',
          borderRadius: 4,
          marginBottom: 6,
          animation: 'pulse 1.5s ease-in-out infinite',
        }} />
        <div style={{
          height: 11, width: '70%',
          background: 'rgba(255,255,255,0.08)',
          borderRadius: 4,
          animation: 'pulse 1.5s ease-in-out infinite',
        }} />
      </div>

      {/* vibe + face shape 双卡 */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
        marginBottom: 16,
      }}>
        <div style={{
          height: 100,
          background: 'rgba(184, 134, 11, 0.06)',
          borderRadius: 14,
          animation: 'pulse 1.5s ease-in-out infinite',
        }} />
        <div style={{
          height: 100,
          background: 'rgba(184, 134, 11, 0.06)',
          borderRadius: 14,
          animation: 'pulse 1.5s ease-in-out infinite',
        }} />
      </div>

      {/* 相关案例 */}
      <div style={{
        height: 13, width: '25%',
        background: 'rgba(255,255,255,0.15)',
        borderRadius: 4,
        marginBottom: 12,
        animation: 'pulse 1.5s ease-in-out infinite',
      }} />
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 8,
      }}>
        {[1,2,3].map(i => (
          <div key={i} style={{
            background: 'rgba(184, 134, 11, 0.05)',
            borderRadius: 12,
            overflow: 'hidden',
          }}>
            <div style={{
              aspectRatio: '1 / 1',
              background: 'linear-gradient(135deg, #b8860b 0%, #2c1810 100%)',
              animation: 'pulse 1.5s ease-in-out infinite',
            }} />
            <div style={{ padding: '8px 10px' }}>
              <div style={{
                height: 11, width: '80%',
                background: 'rgba(255,255,255,0.1)',
                borderRadius: 3,
                marginBottom: 4,
                animation: 'pulse 1.5s ease-in-out infinite',
              }} />
              <div style={{
                height: 10, width: '50%',
                background: 'rgba(184,134,11,0.15)',
                borderRadius: 3,
                animation: 'pulse 1.5s ease-in-out infinite',
              }} />
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  )
}