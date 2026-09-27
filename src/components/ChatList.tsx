'use client'

/**
 * ChatList - 消息列表组件
 *
 * 从 ChatWindow 提取 (Day 3.2, v1.8.1-chatwindow-split)
 *
 * 职责:
 * - 渲染历史消息 (ChatMessage)
 * - 实时流式文字 (typing 效果)
 * - 加载指示器 (3 个跳点)
 * - 自动滚动到底部
 *
 * Props:
 * - messages: 消息历史
 * - currentStreamingText: 当前正在流的文字
 * - speaking: 是否正在说话 (TTS)
 * - loading: 是否在等响应
 * - bottomRef: 自动滚动 ref
 */

import { useRef, useEffect } from 'react'
import ChatMessage from './ChatMessage'
import VoiceIndicator from './VoiceIndicator'
import type { Message } from '@/domain/chat/service'

interface ChatListProps {
  messages: Message[]
  currentStreamingText: string
  speaking: boolean
  loading: boolean
  bottomRef: React.RefObject<HTMLDivElement | null>
  // ⭐ 2026-08-30 奕霖：AI product 卡片点击 → 弹商品详情(ProductQuickView)
  onProductCardClick?: (productId: string) => void
}

export default function ChatList({
  messages,
  currentStreamingText,
  speaking,
  loading,
  bottomRef,
  onProductCardClick,
}: ChatListProps) {
  // 自动滚动到底部
  const internalBottomRef = useRef<HTMLDivElement | null>(null)
  const scrollRef = bottomRef || internalBottomRef

  // ⭐ 奕霖 2026-07-16 01:18：streaming 不滚动。只在消息数组变化（新消息）时滚到底
  // 原因：streaming 每次文字更新都滚，导致看不到前面/上面写过的字
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages])
  // 注意：去掉 currentStreamingText 依赖。streaming 期间用户手向上滚动看历史不被干扰。

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0, // 关键：flex 子项滚动必须设 0，否则 flex:1 不会缩
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        padding: '16px 0',
        scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(184, 134, 11,0.2) transparent',
      }}
    >
      {messages.map((msg, i) => (
        <div key={i} style={{ position: 'relative' }}>
          <ChatMessage message={msg} onProductCardClick={onProductCardClick} />
          {/* 正在说话指示器（仅最后一条AI消息） */}
          {i === messages.length - 1 && !msg.role && (
            <div style={{ position: 'absolute', top: '2px', right: '-4px' }}>
              <VoiceIndicator speaking={speaking && messages[messages.length - 1]?.role === 'assistant'} size="small" />
            </div>
          )}
        </div>
      ))}

      {/* 实时流式文字（打字效果） */}
      {currentStreamingText && messages.length > 0 && messages[messages.length - 1]?.role === 'assistant' && (
        <div
          style={{
            display: 'flex',
            gap: '10px',
            alignItems: 'flex-start',
            animation: 'msgSlideIn 0.2s ease-out forwards',
          }}
        >
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(184, 134, 11,0.3) 0%, rgba(184, 134, 11,0.1) 100%)',
              border: '1px solid rgba(184, 134, 11, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            }}
          >
            🍵
          </div>
          <div
            style={{
              padding: '12px 16px',
              // ⭐ 奕霖 2026-07-24 02:49：rgba(13,31,23,0.88) 深墨绿 vs body 撕裂 → 绿玻璃 + backdrop blur
              background: 'linear-gradient(135deg, rgba(184, 134, 11, 0.12) 0%, rgba(184, 134, 11, 0.06) 100%)',
              borderRadius: '16px 16px 16px 4px',
              border: '1px solid rgba(184, 134, 11, 0.22)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
              fontSize: '14.5px',
              lineHeight: '1.7',
              color: '#e8f5e9',
              maxWidth: '75%',
            }}
          >
            {/* 光标 */}
            {currentStreamingText}
            <span
              style={{
                display: 'inline-block',
                width: '2px',
                height: '16px',
                background: '#b8860b',
                marginLeft: '2px',
                verticalAlign: 'middle',
                animation: 'blink 0.8s ease-in-out infinite',
              }}
            />
            <style>{`@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }`}</style>
          </div>
          {/* 说话光圈 */}
          <div style={{ position: 'relative' }}>
            <VoiceIndicator speaking={speaking} size="small" />
          </div>
        </div>
      )}

      {/* 加载指示器（还没收到消息时） */}
      {loading && !currentStreamingText && (
        <div
          style={{
            display: 'flex',
            gap: '10px',
            alignItems: 'center',
            animation: 'msgSlideIn 0.3s ease-out forwards',
          }}
        >
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(184, 134, 11,0.3) 0%, rgba(184, 134, 11,0.1) 100%)',
              border: '1px solid rgba(184, 134, 11, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            }}
          >
            🍵
          </div>
          <div
            style={{
              // ⭐ 奕霖 2026-07-24 03:47：12 → 9px，造型助手 AI 气泡更紧凑（聊天内容向下利用空间）
              padding: '9px 14px',
              background: 'rgba(13, 31, 23, 0.88)',
              borderRadius: '16px 16px 16px 4px',
              border: '1px solid rgba(184, 134, 11, 0.1)',
              display: 'flex',
              gap: '5px',
              alignItems: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            }}
          >
            {[0, 1, 2].map(d => (
              <span
                key={d}
                className="typing-dot"
                style={{
                  width: '7px',
                  height: '7px',
                  background: '#b8860b',
                  borderRadius: '50%',
                  display: 'inline-block',
                  boxShadow: '0 0 6px rgba(184, 134, 11,0.6)',
                }}
              />
            ))}
          </div>
        </div>
      )}
      <div ref={scrollRef} />
    </div>
  )
}
