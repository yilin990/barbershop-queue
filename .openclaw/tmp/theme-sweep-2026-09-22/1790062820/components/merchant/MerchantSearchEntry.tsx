'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import MerchantPinDialog from '@/components/MerchantPinDialog'
import { useMerchantAuth } from '@/hooks/useMerchantAuth'

/**
 * 顶部入口 — /search 顶部
 *
 * ⭐ MEMORY 246 — 奕霖 2026-08-20 19:42 拍板：
 *   - 🥑 牛油果图标
 *   - 所有用户/访客都看得见
 *   - 点击 → 弹 PIN 弹窗
 *
 * 位置（奕霖强调要清楚）：/search 顶部 **左上角**（top: 12, left: 16）
 *   - 36×36 圆按钮（与详情页对称）
 *   - 未验证：浅绿底 + 实线边框 + 🥑
 *   - 已验证：绿色实心渐变 + 🥑
 */

export default function MerchantSearchEntry({ merchantId = 'm_grocery_001' }: { merchantId?: string }) {
  const router = useRouter()
  const auth = useMerchantAuth(merchantId)
  const [showPin, setShowPin] = useState(false)
  const [showEntry, setShowEntry] = useState(false)
  const [query, setQuery] = useState('')

  // ⭐ MEMORY 246 — 奕霖 19:42：删掉 isHydrated 和 isMerchant 检查
  // 所有用户立即看到 + 所有人能点（普通访客点了输不对密码就关掉）

  const handleOpen = () => {
    if (auth.isMerchant) {
      setShowEntry(true)
    } else {
      setShowPin(true)
    }
  }

  const handleClose = () => { setShowEntry(false); setQuery('') }

  const handleGo = () => {
    if (!query.trim()) return
    router.push(`/admin/products?q=${encodeURIComponent(query.trim())}`)
    setShowEntry(false)
  }

  return (
    <>
      <button
        onClick={handleOpen}
        title="店主/店员入口（所有人可见，点开输密码）"
        aria-label="商户管理入口"
        style={{
          position: 'fixed',
          top: 12,
          left: 16,
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: auth.isMerchant
            ? 'linear-gradient(135deg, #fbbf24, #4a9d65)'
            : 'rgba(127,220,148,0.15)',
          border: auth.isMerchant ? 'none' : '1px solid rgba(127,220,148,0.4)',
          fontSize: 20,
          cursor: 'pointer',
          zIndex: 998,
          boxShadow: auth.isMerchant
            ? '0 4px 14px rgba(127,220,148,0.5)'
            : '0 2px 6px rgba(0,0,0,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)'
        }}
      >
        🥑
      </button>

      {showEntry && (
        <div
          onClick={handleClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 9997,
            background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            paddingTop: 80,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'rgba(20, 25, 30, 0.98)',
              border: '1px solid rgba(127,220,148,0.4)',
              borderRadius: 16, padding: 20,
              width: '100%', maxWidth: 420,
              boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
              color: '#fff',
            }}
          >
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>🥑 商品管理入口</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>
                输入商品编号（4位）或商品名搜索后进入编辑
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleGo()}
                placeholder="0001 或 苹果"
                autoFocus
                style={{
                  flex: 1, padding: '12px 14px',
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid rgba(127,220,148,0.3)',
                  borderRadius: 10, color: '#fff', fontSize: 14,
                  outline: 'none', fontFamily: 'monospace',
                }}
              />
              <button
                onClick={handleGo}
                disabled={!query.trim()}
                style={{
                  padding: '12px 18px',
                  background: query.trim()
                    ? 'linear-gradient(135deg, #fbbf24, #4a9d65)'
                    : 'rgba(127,220,148,0.2)',
                  border: 'none', borderRadius: 10,
                  color: '#0a0f0d', fontSize: 13, fontWeight: 700,
                  cursor: query.trim() ? 'pointer' : 'not-allowed',
                  opacity: query.trim() ? 1 : 0.5,
                }}
              >
                跳转 →
              </button>
            </div>

            <div style={{
              marginTop: 16, paddingTop: 12,
              borderTop: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', justifyContent: 'space-between',
              fontSize: 11, color: 'rgba(255,255,255,0.4)',
            }}>
              <span>剩余 {(24 - Math.floor((Date.now() - (auth.verifiedAt || 0)) / 3600000))} 小时</span>
              <button
                onClick={() => { auth.logout(); handleClose() }}
                style={{ background: 'transparent', border: 'none', color: 'rgba(255,120,120,0.8)', cursor: 'pointer', fontSize: 11 }}
              >
                退出店主
              </button>
            </div>
          </div>
        </div>
      )}

      <MerchantPinDialog
        open={showPin}
        onClose={() => setShowPin(false)}
        onSuccess={() => setShowPin(false)}
        onVerify={auth.verify}
        title="🥑 店主/店员入口"
        hint="仅商户可访问，输入密码 1234 进入"
      />
    </>
  )
}
