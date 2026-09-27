'use client'

/**
 * /merchant/queue - 实时排队独立页面
 * ⭐ 2026-09-20 17:46 奕霖拍板：完全复用 BookingSection（merchant 页面同一个组件）
 *
 * 设计：
 * - 顶部返回首页（router.back / push /merchant）
 * - 嵌入完整的 BookingSection（含 920 行原代码 + 全部功能）
 * - 100% 功能一致：店长模式 / PIN / 活动流 / 叫号推送 / 5 个 modal / 状态机
 */

import { useRouter } from 'next/navigation'
import AppLayout from '@/components/AppLayout'
import BookingSection from '@/components/BookingSection'

export default function QueuePage() {
  const router = useRouter()

  return (
    <AppLayout>
      {/* 顶部返回 bar（用 inline style 不污染 BookingSection） */}
      <div style={{
        background: 'linear-gradient(180deg, #faf6f0 0%, #fffaf0 100%)',
        borderBottom: '1px solid rgba(184, 134, 11, 0.22)',
        padding: '10px 16px',
        display: 'flex', alignItems: 'center', gap: 12,
        position: 'sticky', top: 0, zIndex: 10,
        backdropFilter: 'blur(8px)',
      }}>
        <button
          onClick={() => router.push('/merchant')}
          style={{
            background: 'rgba(184, 134, 11, 0.12)',
            border: 'none', borderRadius: '50%',
            width: 36, height: 36,
            color: '#b8860b', fontSize: 18, fontWeight: 700,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#2c1810' }}>
            🚶 实时排队
          </div>
          <div style={{ fontSize: 11, color: '#8d6e63', marginTop: 1 }}>
            完整功能 · 店长模式 · 4 大入口
          </div>
        </div>
      </div>
      {/* BookingSection 完整复用 */}
      {/* ⭐ 2026-09-20 22:26 奕霖拍板：浏览器自己滚动就行，不要额外的页面级滚动
          保留浏览器自带滚动 + 卡片内 180px 限高（段104） */}
      <div style={{ padding: '0 16px 24px' }}>
        <BookingSection />
      </div>
    </AppLayout>
  )
}