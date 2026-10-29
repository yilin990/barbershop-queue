/**
 * /ai-find-drug/care 加载骨架屏 · 段 234
 */

export default function Loading() {
  return (
    <div style={{
      padding: '8px 16px 180px',
      animation: 'fadeIn 0.3s ease-out',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        marginBottom: 16,
      }}>
        <div style={{
          width: 64, height: 28,
          background: 'rgba(184, 134, 11, 0.1)',
          borderRadius: 100,
          animation: 'pulse 1.5s ease-in-out infinite',
        }} />
        <div style={{ flex: 1 }}>
          <div style={{
            height: 18, width: '50%',
            background: 'rgba(255,255,255,0.1)',
            borderRadius: 4,
            marginBottom: 6,
            animation: 'pulse 1.5s ease-in-out infinite',
          }} />
          <div style={{
            height: 11, width: '40%',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: 4,
            animation: 'pulse 1.5s ease-in-out infinite',
          }} />
        </div>
      </div>

      {[1, 2, 3].map(i => (
        <div key={i} style={{
          background: 'rgba(44, 24, 16, 0.3)',
          border: '1px solid rgba(184, 134, 11, 0.15)',
          borderRadius: 12,
          marginBottom: 10,
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '14px 14px',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{
              width: 36, height: 36,
              background: 'linear-gradient(135deg, rgba(184,134,11,0.25), rgba(184,134,11,0.08))',
              borderRadius: 8,
              animation: 'pulse 1.5s ease-in-out infinite',
            }} />
            <div style={{ flex: 1 }}>
              <div style={{
                height: 13, width: '40%',
                background: 'rgba(255,255,255,0.1)',
                borderRadius: 4,
                marginBottom: 6,
                animation: 'pulse 1.5s ease-in-out infinite',
              }} />
              <div style={{
                height: 10, width: '25%',
                background: 'rgba(184,134,11,0.15)',
                borderRadius: 4,
                animation: 'pulse 1.5s ease-in-out infinite',
              }} />
            </div>
          </div>
        </div>
      ))}

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