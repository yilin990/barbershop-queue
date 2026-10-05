/**
 * /ai-find-drug/demo 加载骨架屏 · 段 234
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
            height: 18, width: '55%',
            background: 'rgba(255,255,255,0.1)',
            borderRadius: 4,
            marginBottom: 6,
            animation: 'pulse 1.5s ease-in-out infinite',
          }} />
          <div style={{
            height: 11, width: '45%',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: 4,
            animation: 'pulse 1.5s ease-in-out infinite',
          }} />
        </div>
      </div>

      <div style={{
        background: 'rgba(184, 134, 11, 0.05)',
        border: '1px dashed rgba(184, 134, 11, 0.3)',
        borderRadius: 12,
        padding: '20px 16px',
        textAlign: 'center',
        marginBottom: 10,
      }}>
        <div style={{
          width: 48, height: 48,
          background: 'rgba(184, 134, 11, 0.15)',
          borderRadius: 12,
          margin: '0 auto 10px',
          animation: 'pulse 1.5s ease-in-out infinite',
        }} />
        <div style={{
          height: 13, width: '60%',
          background: 'rgba(255,255,255,0.1)',
          borderRadius: 4,
          margin: '0 auto 6px',
          animation: 'pulse 1.5s ease-in-out infinite',
        }} />
        <div style={{
          height: 11, width: '80%',
          background: 'rgba(255,255,255,0.05)',
          borderRadius: 4,
          margin: '0 auto 14px',
          animation: 'pulse 1.5s ease-in-out infinite',
        }} />
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 8,
        }}>
          <div style={{
            aspectRatio: '3 / 4',
            background: 'rgba(184, 134, 11, 0.08)',
            borderRadius: 8,
            animation: 'pulse 1.5s ease-in-out infinite',
          }} />
          <div style={{
            aspectRatio: '3 / 4',
            background: 'rgba(184, 134, 11, 0.08)',
            borderRadius: 8,
            animation: 'pulse 1.5s ease-in-out infinite',
          }} />
        </div>
      </div>

      <div style={{
        background: 'rgba(184, 134, 11, 0.08)',
        borderRadius: 8,
        padding: '12px 14px',
        marginTop: 10,
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 6,
        }}>
          <div style={{
            height: 11, width: 80,
            background: 'rgba(184,134,11,0.15)',
            borderRadius: 4,
            animation: 'pulse 1.5s ease-in-out infinite',
          }} />
          <div style={{
            height: 11, width: 30,
            background: 'rgba(184,134,11,0.2)',
            borderRadius: 4,
            animation: 'pulse 1.5s ease-in-out infinite',
          }} />
        </div>
        <div style={{
          height: 6,
          background: 'rgba(184, 134, 11, 0.15)',
          borderRadius: 3,
          marginBottom: 6,
          overflow: 'hidden',
        }}>
          <div style={{
            width: '25%',
            height: '100%',
            background: 'linear-gradient(90deg, #b8860b, #8b6508)',
            borderRadius: 3,
          }} />
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