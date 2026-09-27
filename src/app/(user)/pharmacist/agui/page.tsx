'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import AppLayout from '@/components/AppLayout'
import { BUSINESS_CONFIG } from '@/config/business.config'

/**
 * AG-UI 体验页 · 奕霖 2026-07-02 加入
 * 
 * 把 localhost:3500 的 AG-UI demo iframe 嵌到这里
 * - iframe src: http://localhost:3500
 * - 完整 AG-UI 协议：AI tool_use → React 组件渲染（商品卡片、取货码）
 * - 通过 message 通道转发内容（避免跨域）
 */

export default function AGUIExperiencePage() {
  const { name, assets } = BUSINESS_CONFIG
  const [demoLoaded, setDemoLoaded] = useState(false)
  const [demoError, setDemoError] = useState(false)
  
  // 检查 AG-UI demo 状态
  useEffect(() => {
    fetch('http://localhost:3500/', { mode: 'no-cors' })
      .then(() => setDemoLoaded(true))
      .catch(() => setDemoError(true))
  }, [])

  return (
    <AppLayout
      title="AG-UI 体验 · 造型助手卡片"
      fullHeight
      hideBottomTabBar
    >
      <div style={{padding: '8px 16px 16px', height: 'calc(100dvh - 140px)', display: 'flex', flexDirection: 'column'}}>
        {/* 横幅 banner */}
        <div style={{display: 'flex', justifyContent: 'center', marginBottom: '14px'}}>
          <img
            src={assets.banner}
            alt={name}
            style={{
              width: '100%',
              maxWidth: '420px',
              height: 'auto',
              borderRadius: '10px',
              filter: 'drop-shadow(0 2px 12px rgba(184, 134, 11,0.12))',
            }}
          />
        </div>

        {/* AG-UI 介绍卡片 */}
        <div
          style={{
            padding: '14px 16px',
            background: 'linear-gradient(135deg, rgba(184, 134, 11,0.1), rgba(184,134,11,0.08))',
            border: '1px solid rgba(184, 134, 11,0.3)',
            borderRadius: '14px',
            marginBottom: '14px',
          }}
        >
          <div style={{display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px'}}>
            <div
              style={{
                width: '32px',
                height: '32px',
                background: 'linear-gradient(135deg, #b8860b, #8b6508)',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
              }}
            >
              ✨
            </div>
            <div>
              <div style={{fontSize: '14px', fontWeight: 700, color: '#b8860b'}}>AG-UI 新一代体验</div>
              <div style={{fontSize: '11px', color: 'rgba(184, 134, 11,0.6)'}}>AI 直接生成可点击的界面组件</div>
            </div>
          </div>
          <p style={{fontSize: '12px', color: 'rgba(184, 134, 11,0.7)', lineHeight: 1.6, margin: 0}}>
            不再是纯文本对话 — AI 推荐果蔬时自动生成卡片,点"立即购买"立即生成取货码,到店凭码取货。
          </p>
        </div>

        {/* AG-UI iframe 嵌入 */}
        <div style={{flex: 1, position: 'relative', borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(184, 134, 11,0.2)', background: '#2c1810'}}>
          {!demoError && demoLoaded && (
            <iframe
              src="http://localhost:3500/"
              title="AG-UI Demo"
              style={{width: '100%', height: '100%', border: 'none'}}
              allow="clipboard-read; clipboard-write"
            />
          )}
          
          {demoError && (
            <div style={{padding: '40px 20px', textAlign: 'center'}}>
              <div style={{fontSize: '48px', marginBottom: '16px'}}>🌐</div>
              <h3 style={{fontSize: '16px', color: '#b8860b', marginBottom: '8px'}}>AG-UI demo 未启动</h3>
              <p style={{fontSize: '13px', color: 'rgba(184, 134, 11,0.6)', marginBottom: '20px'}}>需要本地服务在 localhost:3500 端口运行</p>
              <code style={{display: 'block', padding: '12px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', fontSize: '11px', color: '#b8860b', textAlign: 'left'}}>
                cd ~/.openclaw/workspace/.openclaw/tmp/agui-demo<br/>
                node server.js
              </code>
            </div>
          )}
        </div>

        {/* 跳转 /pharmacist 原版聊天 */}
        <div style={{padding: '14px', textAlign: 'center'}}>
          <Link
            href="/pharmacist"
            style={{
              fontSize: '12px',
              color: 'rgba(184, 134, 11,0.6)',
              textDecoration: 'none',
            }}
          >
            ← 返回原版 造型助手对话
          </Link>
        </div>
      </div>
    </AppLayout>
  )
}
