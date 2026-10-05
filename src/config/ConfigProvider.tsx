'use client'

import React from 'react'
import { BUSINESS_CONFIG } from './business.config'

/**
 * ConfigProvider - 将 business.config.ts 中的 theme 注入到 CSS 变量
 *
 * 工作原理：
 * 1. 读取 BUSINESS_CONFIG.theme
 * 2. 渲染 <style> 标签，把 theme 颜色作为 CSS 变量注入到 :root
 * 3. 全局 CSS (var(--xxx)) 和组件内联样式都可用
 *
 * 换商户时：改 business.config.ts → 整个 app 主题色自动变
 */
export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const t = BUSINESS_CONFIG.theme
  return (
    <>
      <style>{`
        :root {
          --bg-deep: ${t.bgDeep};
          --bg-card: ${t.bgCard};
          --bg-card-hover: ${t.bgCardHover};
          --teal: ${t.teal};
          --teal-dark: ${t.tealDark};
          --teal-glow: ${t.tealGlow};
          --green: ${t.green};
          --text: ${t.text};
          --text-secondary: ${t.textSecondary};
          --text-muted: ${t.textMuted};
          --glass-border: ${t.glassBorder};
          --accent: ${t.accent};
        }
      `}</style>
      {children}
    </>
  )
}
