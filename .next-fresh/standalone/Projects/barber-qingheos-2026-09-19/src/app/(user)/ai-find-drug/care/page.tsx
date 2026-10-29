'use client'

/**
 * 护肤养护独立专业页 · 段 232
 * 路由：/ai-find-drug/care
 */

import Link from 'next/link'
import AppLayout from '@/components/AppLayout'
import SkincareSection from '@/components/SkincareSection'

export default function CarePage() {
  return (
    <AppLayout title="护肤养护">
      <div style={{ padding: '8px 16px 180px' }}>
        {/* 顶部返回 + 标题 */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          marginBottom: 16,
        }}>
          <Link
            href="/ai-find-drug"
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '6px 12px',
              background: 'rgba(184, 134, 11, 0.1)',
              border: '1px solid rgba(184, 134, 11, 0.3)',
              borderRadius: 100,
              color: '#b8860b',
              textDecoration: 'none',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <span style={{ fontSize: 14 }}>←</span>
            <span>返回</span>
          </Link>
          <div style={{ flex: 1 }}>
            <h1 style={{
              fontSize: 18, fontWeight: 800, color: '#fff',
              margin: 0,
            }}>💆 护肤养护</h1>
            <p style={{
              fontSize: 11, color: 'rgba(255,255,255,0.5)',
              margin: 0, marginTop: 2,
            }}>专业养护建议 · 让造型更持久</p>
          </div>
        </div>

        {/* 护肤/养护 section */}
        <SkincareSection />
      </div>
    </AppLayout>
  )
}