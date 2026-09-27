'use client'

/**
 * useKeyboardHeight - 监听系统输入法弹起高度
 *
 * 使用 VisualViewport API（现代浏览器/iOS Safari 13+）
 * 监听 visualViewport 高度变化，自动计算输入法高度
 *
 * 用法:
 *   const keyboardHeight = useKeyboardHeight()
 *   <div style={{ paddingBottom: keyboardHeight }}>...</div>
 *
 * 原理:
 *   window.innerHeight = 全屏高度（含地址栏）
 *   window.visualViewport.height = 当前可见高度（不含输入法）
 *   差值 = 输入法高度
 *
 * v1.1 (2026-07-24) — 安卓兜底：
 * - 之前 keyboardHeight 可能 = 0（安卓老 WebView 不触发 vv.resize）
 * - 现在永远 fallback 56px（Android 系统导航栏 / 虚拟键 / 刘海 兜底）
 * - 触发键盘时再以 vv.height 计算真键盘高度
 */

import { useEffect, useState } from 'react'

// ⭐ 奕霖 2026-07-24 03:47 反馈：底部聊天框与底部距离较大，需要向下移一点，让 chat 内容利用起来。
// 修复：不再硬保底 56px (哪怕 keyboard 没起也加这 56px)。改回初始 0，
// 安卓安全区由调用方用 CSS env(safe-area-inset-bottom) 自行叠加，这里只负责真键盘高度。
const ANDROID_SAFE_AREA = 0 // ⭐ 2026-07-24 03:47：减为 0，让 chat 内容吃到更多垂直空间

export function useKeyboardHeight(): number {
  const [keyboardHeight, setKeyboardHeight] = useState(ANDROID_SAFE_AREA)

  useEffect(() => {
    if (typeof window === 'undefined') return

    let rafId: number | null = null

    const update = () => {
      // 取消上一次的 raf，避免抖动
      if (rafId !== null) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        // 当前可见高度 vs 窗口高度
        const vv = window.visualViewport
        if (!vv) {
          // 不支持 visualViewport（安卓老 WebView）= 永远 fallback
          setKeyboardHeight(ANDROID_SAFE_AREA)
          return
        }

        const fullHeight = window.innerHeight
        const visibleHeight = vv.height
        const diff = fullHeight - visibleHeight

        // 键盘高度 = max(diff, ANDROID_SAFE_AREA)
        // - 键盘弹起时 diff > 150 用 diff
        // - 键盘没弹时 diff < 50 用 ANDROID_SAFE_AREA（兜底）
        // - 中间区间 50-150 = 地址栏收缩等抖动 = 保持上次
        if (diff > 150) {
          setKeyboardHeight(diff)
        } else if (diff < 50) {
          setKeyboardHeight(ANDROID_SAFE_AREA)
        }
        // diff 50-150 区间不更新（避免地址栏收缩抖动）
      })
    }

    update()

    // 监听 vv.resize（键盘弹起 / 收起）
    const vv = window.visualViewport
    if (vv) {
      vv.addEventListener('resize', update)
      vv.addEventListener('scroll', update)
    }
    // 兜底：监听 window.resize（老 Android WebView 不触发 vv.resize 但可能触发 window.resize）
    window.addEventListener('resize', update)

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      if (vv) {
        vv.removeEventListener('resize', update)
        vv.removeEventListener('scroll', update)
      }
      window.removeEventListener('resize', update)
    }
  }, [])

  return keyboardHeight
}
