'use client'

import { useState } from 'react'
import ChatWindow from './ChatWindow'

export default function PharmacistFloatButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Float button */}
      <button
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed',
          bottom: '88px',
          right: '20px',
          zIndex: 200,
          width: '52px',
          height: '52px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, rgba(127, 220, 148, 0.35) 0%, rgba(127, 220, 148, 0.18) 100%)',
          border: '1.5px solid rgba(127, 220, 148, 0.4)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4), 0 0 20px rgba(127,220,148,0.2)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '24px',
          transition: 'all 0.25s ease',
        }}
        onMouseEnter={e => {
          ;(e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.1)'
          ;(e.currentTarget as HTMLButtonElement).style.boxShadow =
            '0 6px 28px rgba(0,0,0,0.5), 0 0 30px rgba(127,220,148,0.35)'
        }}
        onMouseLeave={e => {
          ;(e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'
          ;(e.currentTarget as HTMLButtonElement).style.boxShadow =
            '0 4px 20px rgba(0,0,0,0.4), 0 0 20px rgba(127,220,148,0.2)'
        }}
      >
        🍵
      </button>

      {/* Modal overlay */}
      {open && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 300,
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'flex-end',
            padding: '0 16px 90px',
          }}
          onClick={e => {
            if (e.target === e.currentTarget) setOpen(false)
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '380px',
              height: '580px',
              background: 'linear-gradient(175deg, rgba(13,31,23,0.97) 0%, rgba(21,47,32,0.97) 100%)',
              borderRadius: '24px 24px 0 0',
              border: '1px solid rgba(127, 220, 148, 0.15)',
              borderBottom: 'none',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 -8px 40px rgba(0,0,0,0.5)',
              animation: 'floatUp0.3s ease-out forwards',
            }}
          >
            <style>{`
              @keyframes floatUp {
                from { opacity: 0; transform: translateY(30px); }
                to { opacity: 1; transform: translateY(0); }
              }
            `}</style>

            {/* Modal header */}
            <div
              style={{
                padding: '14px 16px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid rgba(127, 220, 148, 0.1)',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, rgba(127,220,148,0.3) 0%, rgba(127,220,148,0.1) 100%)',
                    border: '1px solid rgba(127,220,148,0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '15px',
                  }}
                >
                  🍵
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#fbbf24', letterSpacing: '1px' }}>
                    果小蔬
                  </div>
                  <div style={{ fontSize: '11px', color: 'rgba(127,220,148,0.6)' }}>
                    您的鲜生好邻居
                  </div>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'rgba(127,220,148,0.5)',
                  cursor: 'pointer',
                  fontSize: '18px',
                  padding: '4px 8px',
                }}
              >
                ✕
              </button>
            </div>

            {/* Chat area */}
            <div style={{ flex: 1, overflow: 'hidden', padding: '0 16px' }}>
              <ChatWindow onClose={() => setOpen(false)} floatMode />
            </div>
          </div>
        </div>
      )}
    </>
  )
}