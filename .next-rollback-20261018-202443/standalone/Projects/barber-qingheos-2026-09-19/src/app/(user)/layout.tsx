// ⭐ 奕霖 2026-10-04 00:17：真打通 SSR — BottomTabBar 移到 server layout
//
// 这是 (user) route group 的 server component。所有 (user)/* 页面会经过这个 layout，
// BottomTabBar 在这里渲染 → 整条 link 进 server component tree → 真 SSR 进 initial HTML

import BottomTabBar from '@/components/BottomTabBar'

export default function UserGroupLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      {children}
      <BottomTabBar />
    </>
  )
}