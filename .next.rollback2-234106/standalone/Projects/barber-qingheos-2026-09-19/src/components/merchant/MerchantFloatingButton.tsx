'use client'
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'

/**
 * 🥑 商户后台管理快捷入口 — 商品详情页
 *
 * ⭐ MEMORY §300 — 奕霖 2026-08-29 01:31 拍板：
 *   - 一个个改，先做 🥑
 *   - 界面要适配手机 (mobile-first)
 *   - 符合主题色（造型助手绿 #b8860b → #4a9d65）
 *   - 通道打通：🥑 点击 → 菜单 → /admin/* → AdminLayout 自然弹 PIN gate (1234)
 *
 * 真凶（v0.8.39 之前的 bug）：
 *   - 按钮 z-index: 999 被「五常大米 粮油」文字层拦截
 *   - 菜单 fixed top:60 + right:16 弹窗在卡片上层
 *
 * 修法：
 *   1. createPortal 到 document.body → 跳出任何 ancestor stacking context
 *   2. z-index: 99999 → 全局最高
 *   3. mobile-first：mobile 时 bottom sheet (底部上滑 70vh)，desktop 时 top-right dropdown
 *   4. 主题色统一：绿色渐变 + 暗玻璃背景
 */

export interface MerchantFloatingButtonProps {
  productId: string
  merchantId: string
}

export default function MerchantFloatingButton({ productId, merchantId }: MerchantFloatingButtonProps) {
  const router = useRouter()
  const [showMenu, setShowMenu] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    setMounted(true)
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const goAdmin = (subpath: string) => {
    setShowMenu(false)
    if (subpath === 'edit') {
      router.push(`/admin/products?q=${encodeURIComponent(productId)}`)
    } else if (subpath === 'photo') {
      router.push(`/admin/products/${productId}/photo`)
    } else if (subpath === 'list') {
      router.push(`/admin/products`)
    }
  }

  return (
    <>
      {/* ⭐ MEMORY §300 — 按钮也用 Portal，z-index: 99999 */}
      {mounted && createPortal(
        <button
          onClick={() => setShowMenu(true)}
          title="店主/店员入口"
          aria-label="商户管理入口"
          style={{
            position: 'fixed',
            top: 12,
            right: 16,
            width: isMobile ? 44 : 40,
            height: isMobile ? 44 : 40,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #b8860b, #4a9d65)',
            border: 'none',
            fontSize: isMobile ? 22 : 20,
            cursor: 'pointer',
            zIndex: 99999,
            boxShadow: '0 4px 16px rgba(184, 134, 11, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'transform 0.18s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.08)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          onTouchStart={(e) => (e.currentTarget.style.transform = 'scale(0.94)')}
          onTouchEnd={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          🥑
        </button>,
        document.body
      )}

      {/* ⭐ MEMORY §300 — 菜单 Portal + mobile-first bottom sheet */}
      {mounted && showMenu && createPortal(
        <div
          onClick={() => setShowMenu(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 99998,
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: isMobile ? 'flex-end' : 'flex-start',
            justifyContent: isMobile ? 'center' : 'flex-end',
            paddingTop: isMobile ? 0 : 64,
            paddingRight: isMobile ? 0 : 16,
            animation: 'qinghe-menu-fadein 0.18s ease-out',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'rgba(15, 22, 18, 0.96)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(184, 134, 11, 0.25)',
              borderTop: isMobile ? '1px solid rgba(184, 134, 11, 0.4)' : undefined,
              borderRadius: isMobile ? '20px 20px 0 0' : 16,
              padding: isMobile ? '20px 16px calc(20px + env(safe-area-inset-bottom, 0px))' : 12,
              width: isMobile ? '100%' : 280,
              maxWidth: isMobile ? '100%' : 320,
              maxHeight: isMobile ? '70vh' : 'auto',
              boxShadow: isMobile
                ? '0 -16px 48px rgba(0, 0, 0, 0.6), 0 -1px 0 rgba(184, 134, 11, 0.2)'
                : '0 12px 36px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(184, 134, 11, 0.15)',
              animation: isMobile
                ? 'qinghe-bottom-sheet-slideup 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)'
                : 'qinghe-top-dropdown-fadein 0.18s ease-out',
              overflowY: 'auto',
            }}
          >
            {/* mobile drag handle 装饰 */}
            {isMobile && (
              <div style={{
                width: 40, height: 4, margin: '-10px auto 14px',
                background: 'rgba(184, 134, 11, 0.4)',
                borderRadius: 2,
              }} />
            )}

            {/* 头部说明 */}
            <div style={{
              fontSize: 11, color: 'rgba(255, 255, 255, 0.5)',
              marginBottom: 12, paddingBottom: 10,
              borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
              letterSpacing: 0.3,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <span style={{ fontSize: 14 }}>🔐</span>
              <span>商户后台入口</span>
              <span style={{
                marginLeft: 'auto',
                fontSize: 10,
                padding: '2px 8px',
                background: 'rgba(184, 134, 11, 0.15)',
                color: '#b8860b',
                borderRadius: 4,
                fontWeight: 600,
              }}>需 PIN</span>
            </div>

            {/* 当前商品 context */}
            <div style={{
              fontSize: 11, color: 'rgba(255, 255, 255, 0.4)',
              marginBottom: 10, paddingBottom: 10,
              borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
              display: 'flex', flexDirection: 'column', gap: 2,
            }}>
              <div style={{ color: 'rgba(255, 255, 255, 0.55)', fontSize: 10 }}>当前商品</div>
              <div style={{
                color: '#fff', fontSize: 13,
                fontFamily: 'SF Mono, Monaco, monospace',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }} title={productId}>{productId}</div>
            </div>

            {/* 菜单项 */}
            <MenuItem icon="✏️" label="编辑此商品" desc="改名称/价格/库存" onClick={() => goAdmin('edit')} isMobile={isMobile} />
            <MenuItem icon="📷" label="编辑商品主图" desc="拍照/选图/换图" onClick={() => goAdmin('photo')} isMobile={isMobile} />
            <MenuItem icon="📋" label="查看全部商品" desc="商品管理后台" onClick={() => goAdmin('list')} isMobile={isMobile} />

            {/* 底部提示 */}
            <div style={{
              marginTop: 10, paddingTop: 10,
              borderTop: '1px solid rgba(255, 255, 255, 0.04)',
              fontSize: 10, color: 'rgba(255, 255, 255, 0.35)',
              textAlign: 'center', lineHeight: 1.5,
            }}>
              点菜单项跳转到 AdminLayout<br />
              <span style={{ color: '#b8860b', fontWeight: 600 }}>统一输 PIN: 1234</span>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 全局动画 keyframes — 注入一次 */}
      {mounted && (
        <style>{`
          @keyframes qinghe-menu-fadein {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes qinghe-top-dropdown-fadein {
            from { opacity: 0; transform: translateY(-8px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes qinghe-bottom-sheet-slideup {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
          }
        `}</style>
      )}
    </>
  )
}

function MenuItem({ icon, label, desc, onClick, isMobile }: { icon: string; label: string; desc: string; onClick: () => void; isMobile: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        width: '100%', padding: isMobile ? '14px 12px' : '12px 14px',
        background: 'transparent', border: 'none',
        color: '#fff', fontSize: isMobile ? 14 : 13,
        textAlign: 'left', cursor: 'pointer',
        borderRadius: 10, marginBottom: 4,
        transition: 'background 0.15s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(184, 134, 11, 0.12)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      onTouchStart={(e) => (e.currentTarget.style.background = 'rgba(184, 134, 11, 0.18)')}
      onTouchEnd={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <span style={{
        fontSize: isMobile ? 20 : 18,
        width: isMobile ? 28 : 24,
        textAlign: 'center',
        flexShrink: 0,
      }}>{icon}</span>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontWeight: 600, color: '#fffaf0' }}>{label}</span>
        <span style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.45)' }}>{desc}</span>
      </div>
      <span style={{ color: 'rgba(184, 134, 11, 0.5)', fontSize: 16 }}>›</span>
    </button>
  )
}
