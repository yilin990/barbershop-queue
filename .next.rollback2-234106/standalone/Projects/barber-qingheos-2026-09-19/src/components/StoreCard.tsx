'use client'

import { STORE_LOCATION } from '@/lib/geo'
import { buildAmapNavigationUrl } from '@/lib/amap'

const STORE_INFO = {
  name: '造型师助手（碧江店）',
  address: '贵州省铜仁市碧江区环北清水大道清水花园一栋1单元10-11号',
  phone: '13721566882',
  hours: '08:00 - 23:30',
  note: '全年无休 · 医保定点',
}

interface StoreCardProps {
  distance?: string
  userLng?: number
  userLat?: number
  compact?: boolean
}

export default function StoreCard({ distance, userLng, userLat, compact = false }: StoreCardProps) {
  const handleCall = () => {
    window.location.href = `tel:${STORE_INFO.phone}`
  }

  const handleNavigation = () => {
    const fromLng = userLng || 109.191
    const fromLat = userLat || 27.718
    const navUrl = buildAmapNavigationUrl(fromLng, fromLat, STORE_LOCATION.lng, STORE_LOCATION.lat, 'drive')
    window.location.href = navUrl
  }

  const handleWalkingNav = () => {
    const fromLng = userLng || 109.191
    const fromLat = userLat || 27.718
    const navUrl = buildAmapNavigationUrl(fromLng, fromLat, STORE_LOCATION.lng, STORE_LOCATION.lat, 'walk')
    window.location.href = navUrl
  }

  if (compact) {
    return (
      <div
        style={{
          background: 'rgba(184, 134, 11,0.08)',
          border: '1px solid rgba(184, 134, 11,0.15)',
          borderRadius: '12px',
          padding: '12px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#b8860b' }}>📍 {STORE_INFO.name}</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>{distance || ''}</div>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={handleCall}
              style={{
                background: 'rgba(184, 134, 11,0.15)',
                border: '1px solid rgba(184, 134, 11,0.25)',
                borderRadius: '8px',
                padding: '6px 10px',
                color: '#b8860b',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              📞 拨打
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, rgba(184, 134, 11,0.1) 0%, rgba(184, 134, 11,0.04) 100%)',
        border: '1px solid rgba(184, 134, 11,0.18)',
        borderRadius: '16px',
        padding: '16px',
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Store name + badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(184, 134, 11,0.25) 0%, rgba(184, 134, 11,0.1) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
            }}
          >
            🍵
          </div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>{STORE_INFO.name}</div>
            <div style={{ fontSize: '10px', color: 'rgba(184, 134, 11,0.5)', marginTop: '1px' }}>
              {STORE_INFO.note}
            </div>
          </div>
        </div>
        {distance && (
          <div
            style={{
              background: 'rgba(184, 134, 11,0.15)',
              borderRadius: '20px',
              padding: '4px 10px',
              fontSize: '13px',
              fontWeight: 600,
              color: '#b8860b',
            }}
          >
            📍 {distance}
          </div>
        )}
      </div>

      {/* Info rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
        {/* Address */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
          <span style={{ fontSize: '12px', color: 'rgba(184, 134, 11,0.5)', flexShrink: 0 }}>📍</span>
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>
            {STORE_INFO.address}
          </span>
        </div>
        {/* Phone */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: 'rgba(184, 134, 11,0.5)' }}>📞</span>
          <a
            href={`tel:${STORE_INFO.phone}`}
            style={{ fontSize: '13px', color: '#b8860b', textDecoration: 'none', fontWeight: 600 }}
          >
            {STORE_INFO.phone}
          </a>
        </div>
        {/* Hours */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: 'rgba(184, 134, 11,0.5)' }}>🕐</span>
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.65)' }}>
            营业时间：{STORE_INFO.hours}
          </span>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
        <button
          onClick={handleCall}
          style={{
            background: 'rgba(184, 134, 11,0.12)',
            border: '1px solid rgba(184, 134, 11,0.2)',
            borderRadius: '10px',
            padding: '10px 8px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          <span style={{ fontSize: '16px' }}>📞</span>
          <span style={{ fontSize: '10px', color: 'rgba(184, 134, 11,0.7)' }}>拨打电话</span>
        </button>

        <button
          onClick={handleWalkingNav}
          style={{
            background: 'rgba(184, 134, 11,0.12)',
            border: '1px solid rgba(184, 134, 11,0.2)',
            borderRadius: '10px',
            padding: '10px 8px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          <span style={{ fontSize: '16px' }}>🚶</span>
          <span style={{ fontSize: '10px', color: 'rgba(184, 134, 11,0.7)' }}>步行导航</span>
        </button>

        <button
          onClick={handleNavigation}
          style={{
            background: 'linear-gradient(135deg, rgba(184, 134, 11,0.2) 0%, rgba(184, 134, 11,0.1) 100%)',
            border: '1px solid rgba(184, 134, 11,0.3)',
            borderRadius: '10px',
            padding: '10px 8px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          <span style={{ fontSize: '16px' }}>🚗</span>
          <span style={{ fontSize: '10px', color: '#b8860b' }}>驾车导航</span>
        </button>
      </div>
    </div>
  )
}