// ⭐ 奕霖 2026-10-04 00:24：ShoppingCartIcon server 化（真打通 /me 的 SSR）
//
// server component — ShoppingCartIcon 进 initial HTML，0 闪烁
// client parent (CartEntryCard) 传 count prop，RSC 重渲染自动跟新
// <a href="/cart"> 让 Next.js 自动 client-side navigation（无需 onClick）

import { ShoppingCartIcon } from '@/components/icons/BrandIcons'

export function MeCartLink({ count }: { count: number }) {
  return (
    <a
      href="/cart"
      style={{
        padding: '14px 16px',
        borderRadius: '14px',
        textAlign: 'left',
        background: 'linear-gradient(135deg, rgba(184, 134, 11, 0.12) 0%, rgba(184, 134, 11, 0.15) 100%)',
        border: '1px solid rgba(184, 134, 11, 0.3)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <div style={{ fontSize: '24px' }}>
        <ShoppingCartIcon
          size={24}
          style={{
            display: 'inline-block',
            verticalAlign: 'middle',
            color: '#b8801f',
            filter: 'drop-shadow(0 0 2px rgba(184, 134, 11, 0.3))',
          }}
        />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: '#b8860b', marginBottom: '2px' }}>
          我的购物车
        </div>
        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>
          {count > 0 ? `${count} 件商品` : '空空如也'}
        </div>
      </div>
      <div style={{ fontSize: '20px', color: 'rgba(255,255,255,0.3)' }}>→</div>
    </a>
  )
}