'use client'
/**
 * AddToHomeScreen - iOS Safari 用户引导弹窗
 *
 * 背景：iOS Safari 不支持 beforeinstallprompt 事件
 *       用户必须手动"分享 → 添加到主屏幕"
 *       没引导 → 99% 用户不知道有这个功能
 *
 * 触发条件：
 * 1. 未安装（iOS：不显示 standalone,navigator.standalone）
 * 2. 访问了 3 次（避免跳出太早）
 * 3. 距离首次访问 7 天内
 * 4. 未被 dismiss 过 30 天
 */

import { useEffect, useState } from 'react'

const STORAGE_KEY_DISMISSED = 'zhilin-a2hs-dismissed'
const STORAGE_KEY_VISITS = 'zhilin-a2hs-visits'
const STORAGE_KEY_FIRST = 'zhilin-a2hs-first'

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !/CriOS|FxiOS/.test(navigator.userAgent)
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  // iOS Safari
  if ((navigator as any).standalone === true) return true
  // Android Chrome / 其他
  if (window.matchMedia('(display-mode: standalone)').matches) return true
  return false
}

export default function AddToHomeScreen() {
  const [show, setShow] = useState(false)
  const [platform, setPlatform] = useState<'ios' | 'android' | 'other'>('other')

  useEffect(() => {
    // 已经安装 → 不显示
    if (isStandalone()) return

    // 被 dismiss 过 30 天 → 不显示
    const dismissed = localStorage.getItem(STORAGE_KEY_DISMISSED)
    if (dismissed) {
      const dismissedAt = parseInt(dismissed, 10)
      if (Date.now() - dismissedAt < 30 * 24 * 60 * 60 * 1000) return
    }

    // 第一次访问 → 记录
    const first = localStorage.getItem(STORAGE_KEY_FIRST)
    if (!first) {
      localStorage.setItem(STORAGE_KEY_FIRST, Date.now().toString())
    }

    // 访问次数 +1
    const visits = parseInt(localStorage.getItem(STORAGE_KEY_VISITS) || '0', 10) + 1
    localStorage.setItem(STORAGE_KEY_VISITS, visits.toString())

    // 触发条件：3 次访问 + 7 天内
    if (visits < 3) return
    const firstAt = parseInt(first || Date.now().toString(), 10)
    if (Date.now() - firstAt > 7 * 24 * 60 * 60 * 1000) return

    // 判平台
    if (isIOS()) setPlatform('ios')
    else if (/Android/.test(navigator.userAgent)) setPlatform('android')
    else return

    // 延迟 2 秒弹出（不要打断首屏）
    const timer = setTimeout(() => setShow(true), 2000)
    return () => clearTimeout(timer)
  }, [])

  const handleDismiss = () => {
    setShow(false)
    localStorage.setItem(STORAGE_KEY_DISMISSED, Date.now().toString())
  }

  if (!show) return null

  return (
    <>
      {/* 背景遮罩 */}
      <div
        onClick={handleDismiss}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          zIndex: 99999,
          animation: 'a2hs-fadein 0.3s ease',
        }}
      />

      {/* 引导弹窗 */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 100000,
          background: 'linear-gradient(180deg, #1a2a23 0%, #0a0f0d 100%)',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          padding: '24px 24px calc(28px + env(safe-area-inset-bottom, 0px))',
          border: '1px solid rgba(127, 220, 148, 0.3)',
          boxShadow: '0 -16px 64px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(127, 220, 148, 0.08)',
          animation: 'a2hs-slideup 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
          maxWidth: 480,
          margin: '0 auto',
        }}
      >
        {/* 顶部装饰条 */}
        <div
          style={{
            width: 40,
            height: 4,
            borderRadius: 2,
            background: 'rgba(127, 220, 148, 0.5)',
            margin: '0 auto 20px',
          }}
        />

        {/* 图标 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: 'linear-gradient(135deg, #fbbf24 0%, #4a9d65 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 32,
              boxShadow: '0 8px 24px rgba(127, 220, 148, 0.4)',
            }}
          >
            🌿
          </div>
        </div>

        {/* 标题 */}
        <h2
          style={{
            color: '#fff',
            fontSize: 20,
            fontWeight: 700,
            textAlign: 'center',
            marginBottom: 8,
            letterSpacing: 0.5,
          }}
        >
          把果蔬鲜生装进桌面
        </h2>

        {/* 副标题 */}
        <p
          style={{
            color: 'rgba(255, 255, 255, 0.7)',
            fontSize: 14,
            textAlign: 'center',
            marginBottom: 20,
            lineHeight: 1.6,
          }}
        >
          一键下单、积分提醒、活动通知
          <br />
          像 App 一样方便
        </p>

        {/* iOS 步骤 */}
        {platform === 'ios' && (
          <div
            style={{
              background: 'rgba(127, 220, 148, 0.08)',
              border: '1px solid rgba(127, 220, 148, 0.2)',
              borderRadius: 12,
              padding: '14px 16px',
              marginBottom: 16,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: 10,
                color: '#fff',
                fontSize: 13,
              }}
            >
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: 'rgba(127, 220, 148, 0.3)',
                  color: '#fbbf24',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                1
              </div>
              <span>点击底部</span>
              <span
                style={{
                  background: 'rgba(127, 220, 148, 0.2)',
                  padding: '2px 8px',
                  borderRadius: 6,
                  fontSize: 18,
                }}
              >
                ⬆
              </span>
              <span>分享按钮</span>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: 10,
                color: '#fff',
                fontSize: 13,
              }}
            >
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: 'rgba(127, 220, 148, 0.3)',
                  color: '#fbbf24',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                2
              </div>
              <span>选择</span>
              <span
                style={{
                  background: 'rgba(127, 220, 148, 0.2)',
                  padding: '2px 8px',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                添加到主屏幕
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                color: '#fff',
                fontSize: 13,
              }}
            >
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: 'rgba(127, 220, 148, 0.3)',
                  color: '#fbbf24',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                3
              </div>
              <span>点击右上角</span>
              <span
                style={{
                  background: 'rgba(127, 220, 148, 0.2)',
                  padding: '2px 8px',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                添加
              </span>
            </div>
          </div>
        )}

        {/* Android 步骤 */}
        {platform === 'android' && (
          <div
            style={{
              background: 'rgba(127, 220, 148, 0.08)',
              border: '1px solid rgba(127, 220, 148, 0.2)',
              borderRadius: 12,
              padding: '14px 16px',
              marginBottom: 16,
              color: '#fff',
              fontSize: 13,
              textAlign: 'center',
            }}
          >
            浏览器菜单（右上角 ⋮）→<br />
            点击 <strong style={{ color: '#fbbf24' }}>「添加到主屏幕」</strong>
          </div>
        )}

        {/* 按钮 */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={handleDismiss}
            style={{
              flex: 1,
              padding: '12px 16px',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: 10,
              color: 'rgba(255, 255, 255, 0.7)',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            暂不
          </button>
          <button
            onClick={handleDismiss}
            style={{
              flex: 2,
              padding: '12px 16px',
              background: 'linear-gradient(135deg, #fbbf24 0%, #4a9d65 100%)',
              border: 'none',
              borderRadius: 10,
              color: '#0a0f0d',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(127, 220, 148, 0.3)',
            }}
          >
            我知道了
          </button>
        </div>
      </div>

      {/* 动画 keyframes */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes a2hs-fadein { from { opacity: 0; } to { opacity: 1; } }
        @keyframes a2hs-slideup { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}} />
    </>
  )
}
