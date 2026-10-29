// ⭐ 奕霖 2026-10-04 00:10：BottomTabBar server 化
// 不再 'use client' — 所有 tab 静态结构（图标 + 文字）走 SSR
// 唯一的 client 内核 TabButton 处理 active 判定 + 导航

import { AutoAwesomeIcon, StyleIcon } from '@/components/icons/BrandIcons'
import TabButton from './TabButton'

const TABS = [
  { key: 'merchant',    label: '商户',   iconType: 'emoji' as const, emoji: '🏠', path: '/merchant' },
  { key: 'community',   label: '故事',   iconType: 'emoji' as const, emoji: '✨', path: '/community' },
  { key: 'ai-find-drug',label: '造型 AI', iconType: 'svg' as const,   svg: 'auto-awesome' as const, path: '/ai-find-drug' },
  { key: 'pharmacist',  label: '风格库', iconType: 'svg' as const,   svg: 'style' as const, path: '/pharmacist' },
  { key: 'orders',      label: '订单',   iconType: 'emoji' as const, emoji: '📋', path: '/orders' },
  { key: 'me',          label: '我的',   iconType: 'emoji' as const, emoji: '✂️', path: '/me' },
]

function TabIcon({ type, svg, emoji }: { type: 'svg' | 'emoji'; svg?: 'auto-awesome' | 'style'; emoji?: string }) {
  if (type === 'svg' && svg === 'auto-awesome') return <AutoAwesomeIcon size={22} className="tab-svg" />
  if (type === 'svg' && svg === 'style') return <StyleIcon size={22} className="tab-svg" />
  return <span className="tab-emoji">{emoji}</span>
}

export default function BottomTabBar() {
  return (
    <>
      {/* ⭐ 奕霖 2026-10-04 00:10：tab-specific CSS（active 态靠 .tab-btn-active 切换，hydration 后客户块接管） */}
      <style>{`
        .tab-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 3px;
          padding: 6px clamp(2px, 1vw, 6px);
          border-radius: 16px;
          border: none;
          background: transparent;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: none;
          font-family: inherit;
        }
        .tab-btn-active {
          background: linear-gradient(135deg, rgba(184, 134, 11, 0.18) 0%, rgba(184, 134, 11, 0.08) 100%);
          box-shadow: inset 0 1px 0 rgba(184, 134, 11, 0.15), 0 2px 8px rgba(184, 134, 11, 0.18);
        }
        .tab-icon-wrap {
          font-size: clamp(18px, 5vw, 22px);
          transition: all 0.2s ease;
          color: #5d4037;
          line-height: 1;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .tab-btn-active .tab-icon-wrap {
          transform: scale(1.1);
          color: #b8860b;
          filter: drop-shadow(0 2px 8px rgba(184, 134, 11, 0.5));
        }
        .tab-svg {
          transition: all 0.2s ease;
        }
        .tab-emoji {
          font-size: 1em;
        }
        .tab-label {
          font-size: 10px;
          font-weight: 500;
          color: #5d4037;
          letter-spacing: 0.3px;
          transition: all 0.2s ease;
          text-shadow: none;
        }
        .tab-btn-active .tab-label {
          font-weight: 700;
          color: #b8860b;
          letter-spacing: 0.5px;
          text-shadow: 0 0 12px rgba(184, 134, 11, 0.4);
        }
        .tab-dot {
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: transparent;
          margin-top: 1px;
          transition: all 0.2s ease;
        }
        .tab-btn-active .tab-dot {
          background: #b8860b;
          box-shadow: 0 0 6px rgba(184, 134, 11, 0.8);
        }
      `}</style>
      {/* Tab spacer - prevents content from being hidden behind tab bar */}
      <div
        style={{
          height: 'calc(72px + env(safe-area-inset-bottom, 0px))',
          fontSize: 'clamp(9px, 2.5vw, 11px)',
        }}
      />

      {/* Fixed Bottom Tab Bar */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          background: 'linear-gradient(180deg, rgba(250, 246, 240, 0.92) 0%, rgba(255, 250, 240, 0.98) 100%)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderTop: '1px solid rgba(184, 134, 11, 0.28)',
          borderTopLeftRadius: '24px',
          borderTopRightRadius: '24px',
          boxShadow: '0 -8px 32px rgba(44, 24, 16, 0.12), inset 0 1px 0 rgba(184, 134, 11, 0.08)',
          paddingBottom: 'env(safe-area-inset-bottom, 12px)',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(6, 1fr)',
            maxWidth: '480px',
            margin: '0 auto',
            padding: '8px 8px 12px',
            gap: '1px',
          }}
        >
          {TABS.map((tab) => (
            <TabButton key={tab.key} path={tab.path}>
              <div className="tab-icon-wrap">
                <TabIcon type={tab.iconType} svg={tab.svg} emoji={tab.emoji} />
              </div>
              <span className="tab-label">{tab.label}</span>
              <span className="tab-dot" />
            </TabButton>
          ))}
        </div>
      </div>
    </>
  )
}