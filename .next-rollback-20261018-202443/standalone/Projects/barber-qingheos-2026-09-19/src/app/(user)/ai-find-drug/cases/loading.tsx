/**
 * /ai-find-drug/cases 加载骨架屏 · 段 234
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
            height: 18, width: '60%',
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

      <div style={{
        background: 'rgba(184, 134, 11, 0.05)',
        border: '1px solid rgba(184, 134, 11, 0.15)',
        borderRadius: 16,
        padding: '18px 16px',
        marginBottom: 16,
      }}>
        <div style={{
          height: 14, width: '30%',
          background: 'rgba(184, 134, 11, 0.15)',
          borderRadius: 4,
          marginBottom: 14,
          animation: 'pulse 1.5s ease-in-out infinite',
        }} />
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 6,
          marginBottom: 14,
        }}>
          {[1,2,3,4].map(i => (
            <div key={i} style={{
              height: 26, width: 60 + i * 10,
              background: 'rgba(184, 134, 11, 0.1)',
              borderRadius: 100,
              animation: 'pulse 1.5s ease-in-out infinite',
            }} />
          ))}
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 10,
        }}>
          {[1,2,3,4].map(i => (
            <div key={i} style={{
              aspectRatio: '1 / 1.2',
              background: 'linear-gradient(135deg, rgba(184,134,11,0.15), rgba(44,24,16,0.5))',
              borderRadius: 14,
              animation: 'pulse 1.5s ease-in-out infinite',
            }} />
          ))}
        </div>
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