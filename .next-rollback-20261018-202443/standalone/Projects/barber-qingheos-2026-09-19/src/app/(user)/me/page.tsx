// ⭐ 奕霖 2026-10-04 00:34：/me 鉴权改造 — server shell
//
// 角色：
// 1. 读 zhilin-token cookie（next/headers）
// 2. fetch /api/users/me 拿登录用户
// 3. 已登录 → 把 server 渲染的 <MeCartLink count={0} /> 当 children 传给 client
// 4. 未登录 → 不传 children（client 内部自己显示未登录 UI）
//
// 这让 ShoppingCartIcon 进 initial HTML ✅
// count 文本是 frozen "空空如也"（localStorage 服务端读不到，初始就是 0）

import { cookies } from 'next/headers'
import MePageClient from './MePageClient'
import { MeCartLink } from '@/components/MeCartLink'

export const dynamic = 'force-dynamic'

async function fetchUser(token: string) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `http://127.0.0.1:${process.env.PORT || 3070}`
  try {
    const res = await fetch(`${baseUrl}/api/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    const json = await res.json()
    if (json.success && json.user) return json.user as any
  } catch {}
  return null
}

export default async function MePage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('zhilin-token')?.value

  let initialUser = null
  if (token) {
    initialUser = await fetchUser(token)
  }

  return (
    <MePageClient
      initialUser={initialUser}
      initialToken={token}
    >
      {/* SSR'd cart icon（总是渲染 — 未登录也显示入口，count=0 空空如也）
          之前是 {initialUser ? <MeCartLink count={0} /> : null} — 未登录时 children: null → cart SVG 不进 SSR HTML
          改成总是渲染后，SSR HTML 里永远有 shopping-cart path ✓ */}
      <MeCartLink count={0} />
    </MePageClient>
  )
}