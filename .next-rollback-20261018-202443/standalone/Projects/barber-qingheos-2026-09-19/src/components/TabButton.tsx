'use client'

// ⭐ 奕霖 2026-10-04 00:10：BottomTabBar server 化的 client 内核
// 职责只有 3 件：读 pathname 判定 active → 加 className → onClick 导航
// children（图标 + 文字）是 server 渲染的 SVG/emoji，所以进 initial HTML ✅

import { usePathname, useRouter } from 'next/navigation'

export default function TabButton({
  path,
  children,
}: {
  path: string
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()

  const isActive =
    path === '/merchant'
      ? pathname === '/' || pathname === '/merchant'
      : pathname === path || pathname.startsWith(path + '/')

  return (
    <button
      type="button"
      onClick={() => router.push(path)}
      className={`tab-btn ${isActive ? 'tab-btn-active' : ''}`}
      aria-label={path}
    >
      {children}
    </button>
  )
}