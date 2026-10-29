'use client'
import { useEffect, useState } from 'react'

/**
 * 店主身份 hook（PIN 验证 + 持久化）
 *
 * ⭐ MEMORY 246 — 奕霖 2026-08-20 17:42 拍板：
 *   商品详情页 + 顶部入口 = 商品管理后台快捷通道
 *   需要店主 PIN
 *
 * Cookie: `zhilin-merchant-pin-verified` = "<verifiedAt timestamp>"
 * 有效期：24h（客户端）
 *
 * ⭐ 2026-10-28 加固：
 *   旧版在浏览器里比对 PIN 哈希（pepper + staffPinHashes 来自 business.config.ts），
 *   而那个配置文件被一堆 'use client' 组件 import → 哈希+pepper 被打进前端包，
 *   6 位 PIN 可离线爆破（100 万组合，几分钟跑完）。
 *   现在：浏览器只负责提交 PIN，**判定在服务端**（/api/admin/auth/staff-pin，
 *   服务端比对 scrypt 哈希 + 限流 5 次锁 15 分钟），通过后服务端下发会话 cookie。
 */

const COOKIE_KEY = 'zhilin-merchant-pin-verified'
const COOKIE_MAX_AGE = 24 * 60 * 60 // 24h

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
  return match ? decodeURIComponent(match[2]) : null
}

function writeCookie(name: string, value: string, maxAgeSec: number) {
  if (typeof document === 'undefined') return
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSec}; SameSite=Lax`
}

function clearCookie(name: string) {
  if (typeof document === 'undefined') return
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`
}

export interface MerchantAuthState {
  isMerchant: boolean
  verifiedAt: number | null
  merchantId: string | null
  verify: (pin: string) => Promise<boolean>
  logout: () => void
}

export function useMerchantAuth(merchantId: string): MerchantAuthState {
  const [verifiedAt, setVerifiedAt] = useState<number | null>(null)
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    const c = readCookie(COOKIE_KEY)
    if (c) {
      const parsed = parseInt(c, 10)
      if (!isNaN(parsed) && Date.now() - parsed < COOKIE_MAX_AGE * 1000) {
        setVerifiedAt(parsed)
      } else {
        clearCookie(COOKIE_KEY)
      }
    }
    setIsHydrated(true)
  }, [])

  /** ⭐ 服务端校验 PIN（原来在浏览器里比对哈希 = 密钥泄露） */
  const verify = async (pin: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/admin/auth/staff-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ pin }),
      })
      const j = await res.json()
      if (j && j.success) {
        const now = Date.now()
        writeCookie(COOKIE_KEY, String(now), COOKIE_MAX_AGE)
        setVerifiedAt(now)
        return true
      }
    } catch {
      return false
    }
    return false
  }

  const logout = () => {
    clearCookie(COOKIE_KEY)
    setVerifiedAt(null)
  }

  return {
    isMerchant: isHydrated && verifiedAt !== null,
    verifiedAt,
    merchantId: verifiedAt !== null ? merchantId : null,
    verify,
    logout,
  }
}
