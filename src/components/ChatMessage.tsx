'use client'

import { Message, OrderCardData, ProductCardData, AppointmentCardData } from '@/domain/chat/service'
import VoiceOutput from './VoiceOutput'
import OrderCard from './OrderCard'
import { formatWeight } from '@/lib/format'

interface ChatMessageProps {
  message: Message
  // ⭐ 2026-08-25 16:06 奕霖：聊天时点 product 卡片可弹商品详情
  onProductCardClick?: (productId: string) => void
}

export default function ChatMessage({ message, onProductCardClick }: ChatMessageProps) {
  const isUser = message.role === 'user'

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isUser ? 'row-reverse' : 'row',
        gap: '10px',
        alignItems: 'flex-start',
        animation: 'msgSlideIn 0.3s ease-out forwards',
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: '34px',
          height: '34px',
          borderRadius: '10px',
          flexShrink: 0,
          background: isUser
            ? 'linear-gradient(135deg, #1a4d320%, #0d2818 100%)'
            : 'linear-gradient(135deg, rgba(184, 134, 11, 0.3) 0%, rgba(184, 134, 11, 0.1) 100%)',
          border: isUser
            ? '1px solid rgba(184, 134, 11, 0.2)'
            : '1px solid rgba(184, 134, 11, 0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '16px',
          boxShadow: isUser ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.2)',
        }}
      >
        {isUser ? '👤' : '🍵'}
      </div>

      {/* Content area */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '75%' }}>
        {/* Bubble */}
        <div
          style={{
            padding: '12px 16px',
            borderRadius: isUser
              ? '16px 16px 4px 16px'
              : '16px 16px 16px 4px',
            background: isUser
              ? 'linear-gradient(135deg, rgba(184, 134, 11, 0.22) 0%, rgba(184, 134, 11, 0.14) 100%)'
              // ⭐ 奕霖 2026-07-24 02:49：AI 气泡 rgba(13,31,23,0.88) 深色 vs body 撕裂 → 绿玻璃
              : 'linear-gradient(135deg, rgba(184, 134, 11, 0.12) 0%, rgba(184, 134, 11, 0.06) 100%)',
            color: isUser ? '#b5f0c0' : '#e8f5e9',
            fontSize: '14.5px',
            lineHeight: '1.7',
            boxShadow: isUser
              ? '0 2px 12px rgba(0, 0, 0, 0.25)'
              : '0 4px 16px rgba(0, 0, 0, 0.2)',
            border: isUser
              ? '1px solid rgba(184, 134, 11, 0.18)'
              : '1px solid rgba(184, 134, 11, 0.22)',
            backdropFilter: isUser ? 'none' : 'blur(12px)',
            WebkitBackdropFilter: isUser ? 'none' : 'blur(12px)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {message.content}
        </div>

        {/* ⭐ 奕霖 2026-06-30 20:53：AI 卡片渲染 */}
        {!isUser && message.cards && message.cards.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
            {message.cards.map((card, idx) => {
              if (card.type === 'order') {
                return <OrderCard key={idx} data={card as OrderCardData} />
              }
              // ⭐ 2026-08-25 16:06 奕霖：product 卡片可点弹商品详情
              if (card.type === 'product' && onProductCardClick) {
                const pc = card as ProductCardData
                return (
                  <button
                    key={idx}
                    onClick={() => onProductCardClick(pc.productId)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 14px',
                      borderRadius: '12px',
                      border: '1px solid rgba(184, 134, 11, 0.3)',
                      background: 'rgba(184, 134, 11, 0.08)',
                      color: '#e8f5e9',
                      fontSize: '13px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      width: '100%',
                      fontFamily: 'inherit',
                    }}
                    onMouseEnter={(e) => {
                      ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(184, 134, 11, 0.15)'
                    }}
                    onMouseLeave={(e) => {
                      ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(184, 134, 11, 0.08)'
                    }}
                  >
                    {
                        pc.image ? (
                          // ⭐ 2026-08-25 21:56 奕霖：聊天卡片显示真图，不再只看 emoji
                          <img
                            src={pc.image}
                            alt={pc.name || '商品图'}
                            style={{
                              width: '48px',
                              height: '48px',
                              borderRadius: '8px',
                              objectFit: 'cover',
                              flexShrink: 0,
                              background: 'rgba(255,255,255,0.05)',
                            }}
                            onError={(e) => {
                              // 加载失败时 fallback emoji
                              const target = e.currentTarget as HTMLImageElement
                              target.style.display = 'none'
                              const sib = target.nextElementSibling as HTMLElement | null
                              if (sib) sib.style.display = 'inline'
                            }}
                          />
                        ) : null
                      }
                      <span style={{ fontSize: '18px', display: pc.image ? 'none' : 'inline' }}>
                        {(pc.name || '').match(/[🍎🍌🍇🍓🍑🍊🍉🍐🍍🥑🍋🥭🍒🫐]/)?.[0] || '📦'}
                      </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: '#b8860b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {pc.name}
                      </div>
                      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginTop: '2px' }}>
                        <span style={{ fontWeight: 700, color: '#b8860b' }}>
                          ¥{(pc.memberPrice && pc.memberPrice < pc.price ? pc.memberPrice : pc.price).toFixed(2)}/{formatWeight(pc.weightGram || 500)}
                        </span>
                        {pc.memberPrice && pc.memberPrice < pc.price && (
                          <span style={{ textDecoration: 'line-through', marginLeft: 6, color: 'rgba(255,255,255,0.4)' }}>
                            ¥{pc.price.toFixed(2)}
                          </span>
                        )}
                        {pc.spec && <span style={{ marginLeft: 6, color: 'rgba(255,255,255,0.4)' }}>· {pc.spec}</span>}
                      </div>
                    </div>
                    <span style={{ fontSize: '11px', opacity: 0.6 }}>🔍 查看</span>
                  </button>
                )
              }
              // 其他卡片类型后续加
              return null
            })}
          </div>
        )}

        {/* Action buttons row (only for AI messages) */}
        {!isUser && message.content && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '4px' }}>
            <VoiceOutput text={message.content} size="small" />
            <button
              onClick={() => {
                if (navigator?.clipboard) {
                  navigator.clipboard.writeText(message.content).catch(() => {});
                }
              }}
              title="复制回答"
              style={{
                padding: '4px 8px',
                borderRadius: '8px',
                background: 'transparent',
                border: '1px solid rgba(184, 134, 11, 0.15)',
                color: 'rgba(184, 134, 11, 0.6)',
                fontSize: '11px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={e => {
                ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(184, 134, 11, 0.1)';
                ;(e.currentTarget as HTMLButtonElement).style.color = '#b8860b';
              }}
              onMouseLeave={e => {
                ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                ;(e.currentTarget as HTMLButtonElement).style.color = 'rgba(184, 134, 11, 0.6)';
              }}
            >
              <span>📋</span>
              <span>复制</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}