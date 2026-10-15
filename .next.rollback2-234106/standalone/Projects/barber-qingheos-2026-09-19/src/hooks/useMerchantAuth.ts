'use client'
import { useEffect, useState } from 'react'
import { verifyPinHashes } from '@/lib/pin-hash'
import { BUSINESS_CONFIG } from '@/config/business.config'

/**
 * 店主身份 hook（PIN 验证 + 持久化）
 *
 * ⭐ MEMORY 246 — 奕霖 2026-08-20 17:42 拍板：
 *   商品详情页 + 顶部入口 = 商品管理后台快捷通道
 *   PIN 1234 = 店主（MerchantStaff mock: m_zhilin_001/奕霖/owner）
 *
 * Cookie: `zhilin-merchant-pin-verified` = "<verifiedAt timestamp>"
 * 有效期：24h（客户端）
 */

const COOKIE_KEY = 'zhilin-merchant-pin-verified'
const COOKIE_MAX_AGE = 24 * 60 * 60 // 24h

// ⭐ MEMORY 246 — 默认 PIN（MerchantStaff mock owner PIN）
// ⭐ 2026-10-12：改为比对哈希，源码与前端产物不再出现明文 PIN
const PIN_PEPPER: string = (BUSINESS_CONFIG as any).pinPepper || ''
const H: readonly string[] = (BUSINESS_CONFIG as any).staffPinHashes || []
const PIN_HASH_BY_MERCHANT: Record<string, readonly string[]> = {
  m_zhilin_001: H,
  m_grocery_001: H,
  '*': H,
}

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
  verify: (pin: string) => boolean
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

  const verify = (pin: string): boolean => {
    const validHashes = PIN_HASH_BY_MERCHANT[merchantId] || PIN_HASH_BY_MERCHANT['*']
    if (verifyPinHashes(pin, validHashes, PIN_PEPPER)) {
      const now = Date.now()
      writeCookie(COOKIE_KEY, String(now), COOKIE_MAX_AGE)
      setVerifiedAt(now)
      return true
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
