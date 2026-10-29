/**
 * /ai-find-drug/products 加载骨架屏 · 段 234
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
            height: 11, width: '35%',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: 4,
            animation: 'pulse 1.5s ease-in-out infinite',
          }} />
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 8,
      }}>
        {[1,2,3,4,5,6].map(i => (
          <div key={i} style={{
            background: 'rgba(184, 134, 11, 0.05)',
            border: '1px solid rgba(184, 134, 11, 0.15)',
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
                height: 9, width: '40%',
                background: 'rgba(184,134,11,0.15)',
                borderRadius: 3,
                marginBottom: 4,
                animation: 'pulse 1.5s ease-in-out infinite',
              }} />
              <div style={{
                height: 12, width: '50%',
                background: 'rgba(184,134,11,0.25)',
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