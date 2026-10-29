'use client'

/**
 * useBodyScrollLock - 锁定 body 滚动（防止输入法弹起时页面跟着滚）
 *
 * 当某个 input 聚焦时调用 lock()，blur 时调用 unlock()
 * 这是 WeChat / 各种聊天 App 的标准做法
 *
 * 原理:
 *   锁定 body position=fixed，让页面无法滚动
 *   仅聊天消息区（ChatList）可独立滚动
 *   输入法弹起时，ChatList 自动调整高度适应剩余空间
 */

import { useEffect } from 'react'

let lockCount = 0
let originalStyles: {
  position: string
  top: string
  width: string
  overflow: string
} | null = null
let scrollY = 0

export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (active && lockCount === 0) {
      // 保存当前滚动位置和样式
      scrollY = window.scrollY
      originalStyles = {
        position: document.body.style.position,
        top: document.body.style.top,
        width: document.body.style.width,
        overflow: document.body.style.overflow,
      }
      // 锁定
      document.body.style.position = 'fixed'
      document.body.style.top = `-${scrollY}px`
      document.body.style.width = '100%'
      document.body.style.overflow = 'hidden'
      lockCount++
    } else if (!active && lockCount > 0) {
      lockCount--
      if (lockCount === 0 && originalStyles) {
        // 恢复
        document.body.style.position = originalStyles.position
        document.body.style.top = originalStyles.top
        document.body.style.width = originalStyles.width
        document.body.style.overflow = originalStyles.overflow
        originalStyles = null
        window.scrollTo(0, scrollY)
      }
    }

    return () => {
      // 组件卸载时强制解锁
      if (active && lockCount > 0) {
        lockCount--
        if (lockCount === 0 && originalStyles) {
          document.body.style.position = originalStyles.position
          document.body.style.top = originalStyles.top
          document.body.style.width = originalStyles.width
          document.body.style.overflow = originalStyles.overflow
          originalStyles = null
          window.scrollTo(0, scrollY)
        }
      }
    }
  }, [active])
}