'use client'
import { useState, useEffect, ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  verifyAdminPin,
  setAdminSession,
  isAdminAuthed,
  getAdminSessionRemainingMinutes,
  clearAdminSession,
} from '@/lib/admin-auth'
import { colors, fontSize, fontWeight, radius, spacing, breakpoint, animation, zIndex } from '@/lib/design-tokens'
import {
  
  LayoutDashboard,
   Package,
   ShoppingBag,
   Users,
   Store,
   LogOut,
   ChevronLeft,
   Bot,
   Menu,
   X,
   Scissors,
} from 'lucide-react'

interface AdminLayoutProps {
  children: ReactNode
  title: string
  active: string
}

// ⭐ 奕霖 2026-08-01 16:47 修复：
// - 底部 tab 只放 5 个高频主入口，剩余 9 个收纳到“更多”抽屉
// - 避免 13 tab 全部塞底部导致点不动 + 溢出
// ⭐ v0.8.68.2 - 后台精简为 5 模块(1 Dashboard + 4 业务)
// 之前 18 项 sidebar → 现在 5 项
// 合并:会员+用户+反馈 → /admin/customers
// 合并:活动+优惠券+拼团+积分+商户 → /admin/settings
const TABS = [
  { key: 'overview', label: '概览', href: '/admin', icon: LayoutDashboard },
  { key: 'orders', label: '订单', href: '/admin/orders', icon: ShoppingBag },
  { key: 'products', label: '商品', href: '/admin/products', icon: Package },
  { key: 'services', label: '服务', href: '/admin/services', icon: Scissors },
  { key: 'stylists', label: '理发师', href: '/admin/stylists', icon: UserCircle },
  { key: 'customers', label: '顾客', href: '/admin/customers', icon: Users },
  { key: 'settings', label: '设置', href: '/admin/settings', icon: Store },
]

/**
 * 后台统一布局 (v1.1 - 自带 PIN 验证)
 * - 顶部 sticky header + tab 栏
 * - 移动端 < 768: 底部 tab 栏
 * - 跟 AdminGate 一样的 PIN 验证 (代码内嵌, 不依赖原组件)
 */
export function AdminLayout({ children, title, active }: AdminLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [isMobile, setIsMobile] = useState(false)
  // ⭐ 奕霖 2026-09-07 20:40 "没有返回键":主导航 tab 不显示返回键;standalone pages (points/coupons/activities/groupbuys) 显示"← 设置"
  const isMainTab = pathname === '/admin'
    || pathname.startsWith('/admin/settings')
    || pathname.startsWith('/admin/orders')
    || pathname.startsWith('/admin/products')
    || pathname.startsWith('/admin/customers')
  const showBackToSettings = !isMobile && !isMainTab
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [remainingMin, setRemainingMin] = useState(0)
  
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < breakpoint.tablet)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    setAuthed(isAdminAuthed())
    setRemainingMin(getAdminSessionRemainingMinutes())
    const t = setInterval(() => setRemainingMin(getAdminSessionRemainingMinutes()), 60000)
    return () => clearInterval(t)
  }, [])

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!pin) return
    setSubmitting(true)
    setPinError(null)
    setTimeout(() => {
      if (verifyAdminPin(pin)) {
        setAdminSession(pin)
        setAuthed(true)
        setRemainingMin(60)
        setPin('')
      } else {
        setPinError('安全码错误，请联系老板/店长获取')
        setPin('')
      }
      setSubmitting(false)
    }, 300)
  }

  const handleLogout = () => {
    clearAdminSession()
    setAuthed(false)
    setRemainingMin(0)
  }

  // PIN 输入页
  if (authed === null || !authed) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #0a0f0d, #050807)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ width: '100%', maxWidth: 380, background: 'linear-gradient(180deg, rgba(167, 139, 250, 0.08) 0%, rgba(167, 139, 250, 0.02) 100%)', border: '1px solid rgba(167, 139, 250, 0.2)', borderRadius: 18, padding: '32px 24px', textAlign: 'center' }}>
          {authed === null ? (
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>验证中…</div>
          ) : (
            <>
              <div style={{ fontSize: 56, marginBottom: 16 }}>🛡️</div>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: '#fff', margin: '0 0 6px' }}>{title}</h1>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: '0 0 24px' }}>此功能仅供商户内部使用，请输入安全码进入</p>
              <form onSubmit={handleSubmit}>
                <input type="password" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} placeholder="••••" autoFocus disabled={submitting} style={{ width: '100%', padding: '16px', fontSize: 24, textAlign: 'center', letterSpacing: '8px', background: 'rgba(0, 0, 0, 0.3)', border: '1px solid rgba(167, 139, 250, 0.3)', borderRadius: 12, color: '#fff', outline: 'none', fontFamily: 'inherit', marginBottom: 12 }} />
                {pinError && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 12, padding: '8px 12px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: 8, border: '1px solid rgba(239, 68, 68, 0.2)' }}>{pinError}</div>}
                <button type="submit" disabled={submitting || pin.length < 4} style={{ width: '100%', padding: '14px', borderRadius: 12, border: 'none', background: submitting || pin.length < 4 ? 'rgba(167, 139, 250, 0.2)' : 'linear-gradient(135deg, #a78bfa, #7c3aed)', color: submitting || pin.length < 4 ? 'rgba(255,255,255,0.4)' : '#0a0f0d', fontSize: 15, fontWeight: 700, cursor: submitting || pin.length < 4 ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                  {submitting ? '验证中…' : '🔓 进入管理后台'}
                </button>
              </form>
              <div style={{ marginTop: 16, fontSize: 12, color: 'rgba(167, 139, 250, 0.7)', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => router.push('/me')}>
                ← 返回我的
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  // 已认证 - 主布局
  const activeTab = TABS.find((t) => t.key === active) || TABS[0]
  const Icon = activeTab.icon

  return (
    <div style={{
      minHeight: '100vh',
      background: colors.bgPage,
      color: colors.text,
      fontFamily: '-apple-system, "PingFang SC", sans-serif',
      // ⭐ 奕霖 2026-08-05 01:11 — 刘海屏适配：底部底部条 + iPhone 主屏指示器
      paddingBottom: isMobile ? `calc(80px + env(safe-area-inset-bottom, 0px))` : 0,
    }}>
      <header style={{
        background: 'linear-gradient(180deg, rgba(184, 134, 11,0.06) 0%, rgba(10,15,13,0.85) 70%)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        position: 'sticky',
        top: 0,
        zIndex: zIndex.sticky,
        borderBottom: `1px solid ${colors.border}`,
        // ⭐ 奕霖 2026-08-01 16:47：刘海屏/Dynamic Island 适配
        paddingTop: 'env(safe-area-inset-top, 0px)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: spacing[5],
          padding: isMobile ? `${spacing[3]} ${spacing[5]}` : `${spacing[5]} ${spacing[7]}`
        }}>
          {showBackToSettings && (
            <Link href="/admin/settings" aria-label="返回设置" style={{ padding: '6px 10px', borderRadius: radius.base, background: colors.primaryBgSubtle, color: colors.primary, fontSize: fontSize.xs, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <ChevronLeft size={14} />
              设置
            </Link>
          )}
          <h1 style={{ margin: 0, fontSize: isMobile ? fontSize.lg : fontSize.xxl, fontWeight: fontWeight.bold, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon size={20} color={colors.primary} />
            {title}
          </h1>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: spacing[5] }}>
            {!isMobile && (
              <span style={{ fontSize: fontSize.xs, color: 'rgba(167, 139, 250, 0.8)' }}>
                🛡️ 管理员 · 剩 {remainingMin} 分钟
              </span>
            )}
            <button onClick={handleLogout} aria-label="退出登录" style={{ padding: '8px 12px', borderRadius: radius.base, background: colors.bgHover, color: colors.textSubtle, border: 'none', fontSize: fontSize.xs, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, minHeight: 36 }}>
              <LogOut size={14} />
              {!isMobile && '退出'}
            </button>
          </div>
        </div>

        {!isMobile && (
          <nav aria-label="后台导航" style={{ display: 'flex', gap: spacing[1], padding: `0 ${spacing[7]} ${spacing[5]}`, overflowX: 'auto' }}>
            {TABS.map((t) => {
              const isActive = t.key === active
              const TabIcon = t.icon
              return (
                <Link key={t.key} href={t.href} aria-current={isActive ? 'page' : undefined} style={{ padding: '8px 14px', borderRadius: 10, fontSize: fontSize.sm, fontWeight: fontWeight.semibold, textDecoration: 'none', background: isActive ? 'linear-gradient(135deg, rgba(184, 134, 11,0.22), rgba(184, 134, 11,0.05))' : 'transparent', color: isActive ? '#b8860b' : colors.textSubtle, display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', transition: animation.fast, minHeight: 36, border: isActive ? '1px solid rgba(184, 134, 11,0.35)' : '1px solid transparent', boxShadow: isActive ? '0 2px 8px rgba(184, 134, 11,0.15)' : 'none' }}>
                  <TabIcon size={14} />
                  {t.label}
                </Link>
              )
            })}
          </nav>
        )}
      </header>

      <main style={{ padding: spacing[9], maxWidth: 1400, margin: '0 auto', position: 'relative' }}>
        {/* chips 滚动提示渐变遮罩（移动端） */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            right: 0,
            top: spacing[9],
            bottom: 0,
            width: 32,
            background: 'linear-gradient(to right, transparent, rgba(10, 15, 13, 0.9))',
            pointerEvents: 'none',
            zIndex: 5,
          }}
          className="qinghe-chips-fade"
        />
        {children}
      </main>

      {isMobile && (
        <nav aria-label="后台导航（移动端）" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: colors.bgPrimary, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderTop: `1px solid ${colors.border}`, display: 'flex', padding: `${spacing[2]} ${spacing[1]}`, paddingBottom: `max(${spacing[2]}px, env(safe-area-inset-bottom))`, zIndex: 100, touchAction: 'manipulation' }}>
          {TABS.map((t) => {
            const isActive = t.key === active
            const TabIcon = t.icon
            return (
              <Link
                key={t.key}
                href={t.href}
                onClick={(e) => {
                  // ⭐ 阻止默认点击事件，强制 router.push 确保响应
                  e.preventDefault()
                  router.push(t.href)
                }}
                aria-current={isActive ? 'page' : undefined}
                style={{
                  flex: 1,
                  minHeight: 56,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 2,
                  padding: '8px 4px',
                  fontSize: 10,
                  fontWeight: isActive ? fontWeight.bold : fontWeight.normal,
                  color: isActive ? colors.primary : colors.textSubtle,
                  textDecoration: 'none',
                  borderRadius: radius.md,
                  background: isActive ? colors.primaryBgSubtle : 'transparent',
                  transition: 'all 0.15s ease',
                  WebkitTapHighlightColor: 'transparent',
                  touchAction: 'manipulation',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <TabIcon size={20} />
                <span>{t.label}</span>
              </Link>
            )
          })}
        </nav>
      )}

      {/* ⭐ “更多”抽屉（底部 sheet） */}
      {false && (
        <>
          {/* 背景遮罩 */}
          <div
            onClick={() => void 0}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
              zIndex: 199,
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
            }}
          />
          {/* 抽屉 */}
          <div
            style={{
              position: 'fixed',
              bottom: 0, left: 0, right: 0,
              background: colors.bgPrimary,
              borderTopLeftRadius: 20, borderTopRightRadius: 20,
              padding: '20px 16px',
              paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
              zIndex: 200,
              boxShadow: '0 -8px 32px rgba(0,0,0,0.4)',
              animation: 'qinghe-slide-up 0.25s ease-out',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: colors.text, margin: 0 }}>
                更多功能
              </h3>
              <button
                onClick={() => void 0}
                aria-label="关闭"
                style={{
                  width: 32, height: 32, borderRadius: 16, border: 'none',
                  background: colors.bgHover, color: colors.textSubtle,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <X size={16} />
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {([]).map((t) => {
                const TabIcon = t.icon
                const isActive = t.key === active
                return (
                  <Link
                    key={t.key}
                    href={t.href}
                    onClick={(e) => {
                      e.preventDefault()
                      void 0
                      router.push(t.href)
                    }}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      justifyContent: 'center', gap: 6,
                      padding: '14px 8px',
                      minHeight: 76,
                      background: isActive ? colors.primaryBgLight : colors.bgHover,
                      border: isActive ? `1px solid ${colors.primaryBorder}` : `1px solid ${colors.border}`,
                      borderRadius: radius.md,
                      color: isActive ? colors.primary : colors.text,
                      textDecoration: 'none', fontSize: 12, fontWeight: 500,
                      WebkitTapHighlightColor: 'transparent',
                      touchAction: 'manipulation',
                      cursor: 'pointer',
                    }}
                  >
                    <TabIcon size={22} />
                    <span>{t.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        </>
      )}

      <style jsx>{`
        @keyframes qinghe-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        /* 分类 chips — 移动端横向滚动 */
        @media (max-width: 767px) {
          :global(.qinghe-cat-chips) {
            flex-wrap: nowrap !important;
            overflow-x: auto !important;
            overflow-y: hidden !important;
            padding-bottom: 4px;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: thin;
          }
          :global(.qinghe-cat-chips::-webkit-scrollbar) {
            height: 4px;
          }
          :global(.qinghe-cat-chips::-webkit-scrollbar-thumb) {
            background: rgba(255,255,255,0.1);
            border-radius: 2px;
          }
          /* chips 渐变遮罩只移动端显示 */
          .qinghe-chips-fade {
            display: block !important;
          }
        }
        @media (min-width: 768px) {
          .qinghe-chips-fade {
            display: none !important;
          }
          /* KPI 桌面端 4 列 */
          :global(.qinghe-kpi-grid) {
            grid-template-columns: repeat(4, 1fr) !important;
          }
        }
      `}</style>
    </div>
  )
}
