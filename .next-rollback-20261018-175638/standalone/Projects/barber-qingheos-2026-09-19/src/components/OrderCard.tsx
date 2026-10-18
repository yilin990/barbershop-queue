'use client'

/**
 * OrderCard - 订单卡片（accordion 折叠模式）
 * - 2026-06-30 20:53 奕霖立：结构化卡片
 * - 2026-10-05 01:35 v1.1.10 升级：去墨绿残留 + 字体清晰
 * - 2026-10-05 01:48 v1.1.11 升级：数据打通（serviceName/stylistName/scheduledDate/scheduledTime）
 * - 2026-10-05 02:25 v1.1.16 升级：accordion 折叠 + 点击展开 + 编码栏
 *
 * 设计（v1.1.16）：
 * - 折叠态（默认）：orderNo 大字 + 状态徽章 + 服务/理发师/时间紧凑行 + 下拉指示
 * - 展开态（点击）：结构化信息块（标签 + 值）+ 取货码大区 + 金额行 + 3 个按钮
 * - 取消订单：红色横幅永远显示（折叠/展开都看得到原因）
 * - 点击空白卡片切换展开/折叠，按钮 body 行不触发切换
 */

import { useState } from 'react'
import { toast } from '@/lib/ui-bus'
import { confirmDialog } from '@/lib/ui-bus'
import { useRouter } from 'next/navigation'
import { useUserStore } from '@/stores/userStore'
import { OrderCardData } from '@/domain/chat/service'

interface OrderCardProps {
  data: OrderCardData
  onChanged?: () => void
}

// ⭐ v1.1.10 升级：深红家族（与 --accent: #8b0000 同色系），取消态灰化
const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'rgba(245, 158, 11, 0.18)', text: '#b45309' },
  paid: { bg: 'rgba(185, 28, 28, 0.12)', text: '#b91c1c' },
  preparing: { bg: 'rgba(185, 28, 28, 0.14)', text: '#b91c1c' },
  ready: { bg: 'rgba(185, 28, 28, 0.18)', text: '#b91c1c' },
  delivered: { bg: 'rgba(127, 29, 29, 0.1)', text: '#7f1d1d' },
  cancelled: { bg: 'rgba(107, 114, 128, 0.18)', text: '#4b5563' },
  refunded: { bg: 'rgba(107, 114, 128, 0.18)', text: '#4b5563' },
  completed: { bg: 'rgba(127, 29, 29, 0.12)', text: '#7f1d1d' },
}

export default function OrderCard({ data, onChanged }: OrderCardProps) {
  const router = useRouter()
  const statusColor = STATUS_COLORS[data.status] || STATUS_COLORS.pending
  const isCancelled = data.status === 'cancelled'
  const isClosed = isCancelled || (data.status as string) === 'refunded'

  // ⭐ v1.1.16 奕霖立：accordion 展开状态（默认折叠）
  const [expanded, setExpanded] = useState(false)

  const handleCopyCode = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (data.pickupCode && navigator?.clipboard) {
      navigator.clipboard.writeText(data.pickupCode).then(() => {
        toast.info(`取货码已复制：${data.pickupCode}`)
      }).catch(() => {
        toast.error('复制失败')
      })
    }
  }

  const handleViewDetail = (e: React.MouseEvent) => {
    e.stopPropagation()
    router.push(`/orders/${data.orderId}`)
  }

  // v1.1.33 (2026-10-06 19:48 qinghe fix Bug 6): cancel through the real API, not the chat tool.
  //   OLD: POST /api/chat with "取消订单 {no}", then trusted json.toolExecuted.
  //     The chat agent knows nothing about BarberQueue-backed booking/ticket rows, so it could
  //     report the tool as executed (success toast) while neither table changed.
  //     router.refresh() cannot help either: it re-renders server components, but this list is
  //     fetched client-side in a useEffect keyed on phone.
  //   NEW: same endpoint the detail page uses. It resolves the BarberQueue id for booking/ticket
  //     cards, verifies the phone on barber rows, and syncs both tables.
  const [cancelling, setCancelling] = useState(false)
  const handleCancel = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (cancelling) return
    if (!await confirmDialog(`确定取消订单 ${data.orderNo}？\n取消后库存会退回。`)) return
    const user = useUserStore?.getState?.()?.user
    try {
      setCancelling(true)
      const resp = await fetch(`/api/orders/${data.orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'cancelled',
          ...(isBookingType && user?.phone ? { customerPhone: user.phone } : {}),
        }),
      })
      const json = await resp.json()
      if (json.success) {
        toast.info(`✅ 订单 ${data.orderNo} 已取消`)
        onChanged?.()
      } else {
        toast.error('❌ 取消失败：' + (json.error || '未知错误'))
      }
    } catch (err: any) {
      toast.error('❌ 取消出错：' + (err?.message || err))
    } finally {
      setCancelling(false)
    }
  }

  // ⭐ v1.1.16：点击卡片空白区切换展开/折叠
  const handleCardClick = (e: React.MouseEvent) => {
    // 如果点的是按钮或按钮内部，不触发折叠切换
    if ((e.target as HTMLElement).closest('button')) return
    setExpanded(!expanded)
  }

  // ⭐ v1.1.17 奕霖立：预约 vs 商品判断 — 预约/取号 → 显示预约信息，商品 → 显示商品信息
  const isBookingType = data.source === 'booking' || data.source === 'ticket'

  // 摘要（折叠态显示）— 按 source 分两套
  const compactSummary = (() => {
    if (isBookingType) {
      // 预约：服务 · 理发师 · 时间
      const parts: string[] = []
      if (data.serviceName) parts.push(data.serviceName)
      if (data.stylistName) parts.push(data.stylistName)
      if (data.scheduledDate && data.scheduledTime) parts.push(`${data.scheduledDate} ${data.scheduledTime}`)
      else if (data.scheduledDate) parts.push(data.scheduledDate)
      if (parts.length === 0) return data.itemSummary || '—'
      return parts.join(' · ')
    } else {
      // 商品：itemSummary + pickupCode 提示
      return data.itemSummary || '—'
    }
  })()

  return (
    <div
      onClick={handleCardClick}
      style={{
        marginTop: '10px',
        padding: '14px 18px',
        borderRadius: '16px',
        background: isClosed
          ? 'linear-gradient(135deg, rgba(107, 114, 128, 0.08) 0%, rgba(107, 114, 128, 0.02) 100%)'
          : 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.78) 100%)',
        border: isClosed
          ? '1.5px solid rgba(107, 114, 128, 0.3)'
          : '1px solid rgba(185, 28, 28, 0.15)',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        maxWidth: '100%',
        position: 'relative',
        opacity: isClosed ? 0.85 : 1,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        boxShadow: isClosed
          ? '0 2px 8px rgba(107, 114, 128, 0.08)'
          : expanded
          ? '0 6px 20px rgba(185, 28, 28, 0.1), 0 2px 4px rgba(44, 24, 16, 0.06)'
          : '0 2px 12px rgba(185, 28, 28, 0.06), 0 1px 3px rgba(44, 24, 16, 0.04)',
      }}
    >
      {/* ⭐ 奕霖 2026-07-15 01:30：取消订单后顶部红色横条提示（折叠/展开都显示） */}
      {isCancelled && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          padding: '7px 12px', marginBottom: '12px',
          background: 'linear-gradient(90deg, rgba(220, 38, 38, 0.1) 0%, rgba(220, 38, 38, 0.18) 50%, rgba(220, 38, 38, 0.1) 100%)',
          border: '1px solid rgba(220, 38, 38, 0.35)',
          borderRadius: '10px',
          fontSize: '13px', fontWeight: 700,
          color: '#dc2626',
          letterSpacing: '0.5px',
        }}>
          <span style={{ fontSize: '15px' }}>❌</span>
          <span>订单已取消 · 库存已退回 · 取货码作废</span>
        </div>
      )}

      {/* ⭐ v1.1.16 折叠态头部：orderNo + 状态 + 展开指示 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '10px',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          flex: 1, minWidth: 0,
        }}>
          <span style={{
            fontSize: '17px', fontWeight: 800,
            color: '#2c1810',
            fontFamily: 'monospace',
            letterSpacing: '0.5px',
          }}>
            📦 {data.orderNo}
          </span>
          {data.pickupCode && !isClosed && !isBookingType && (
            <span style={{
              padding: '3px 10px',
              borderRadius: 8,
              background: 'rgba(185, 28, 28, 0.1)',
              border: '1px solid rgba(185, 28, 28, 0.25)',
              fontSize: '12px', fontWeight: 700,
              color: '#b91c1c',
              fontFamily: 'monospace',
              letterSpacing: '1px',
            }}>
              编码 {data.pickupCode}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {/* v1.1.45 奕霖立：预约卡金额提到头部 —— 折叠态也要一眼看见 */}
          {isBookingType && data.finalAmount > 0 && (
            <span style={{
              padding: '3px 10px',
              borderRadius: 8,
              background: 'rgba(185, 28, 28, 0.08)',
              border: '1px solid rgba(185, 28, 28, 0.25)',
              fontSize: '15px', fontWeight: 800,
              color: '#b91c1c',
              whiteSpace: 'nowrap',
            }}>
              ¥{data.finalAmount.toFixed(2)}
            </span>
          )}
          <div style={{
            padding: '4px 12px',
            borderRadius: '12px',
            fontSize: '12px',
            fontWeight: 700,
            background: statusColor.bg,
            color: statusColor.text,
            letterSpacing: '0.5px',
          }}>
            {data.statusLabel}
          </div>
          {/* ⭐ v1.1.16 折叠指示器 */}
          <div style={{
            fontSize: 14, fontWeight: 700,
            color: 'rgba(44, 24, 16, 0.55)',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.25s ease',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 20, height: 20,
          }}>
            ▼
          </div>
        </div>
      </div>

      {/* ⭐ v1.1.16 折叠态摘要：服务 · 理发师 · 时间（一行紧凑） */}
      <div style={{
        fontSize: '13px',
        color: 'rgba(44, 24, 16, 0.75)',
        fontWeight: 500,
        lineHeight: 1.5,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {compactSummary}
      </div>

      {/* ⭐ v1.1.16 展开态详情（点击卡片切换） */}
      {expanded && (
        <>
          {/* ⭐ v1.1.17 奕霖立：按 source 分两套 — 预约只看预约信息，商品只看商品信息 */}
          {!isBookingType && data.itemSummary && data.itemSummary !== compactSummary && (
            <div style={{
              fontSize: '14px',
              color: '#2c1810',
              marginTop: '12px',
              marginBottom: '12px',
              padding: '10px 12px',
              background: 'rgba(254, 242, 242, 0.4)',
              borderRadius: 10,
              lineHeight: 1.6,
              fontWeight: 500,
            }}>
              {data.itemSummary}
            </div>
          )}

          {/* 预约专用：结构化信息块（service + stylist + 真日期）— 只在预约/取号类型显示 */}
          {isBookingType && (data.serviceName || data.stylistName || data.scheduledDate) && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              padding: '12px 14px',
              marginBottom: '12px',
              background: 'linear-gradient(135deg, rgba(254, 242, 242, 0.5) 0%, rgba(254, 242, 242, 0.3) 100%)',
              border: '1px solid rgba(185, 28, 28, 0.15)',
              borderRadius: '12px',
            }}>
              {data.serviceName && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{
                    fontSize: 13, color: 'rgba(44, 24, 16, 0.65)',
                    fontWeight: 600, minWidth: 64,
                  }}>📋 服务项目</span>
                  <span style={{
                    fontSize: 15, color: '#2c1810',
                    fontWeight: 700,
                  }}>{data.serviceName}</span>
                </div>
              )}
              {data.stylistName && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{
                    fontSize: 13, color: 'rgba(44, 24, 16, 0.65)',
                    fontWeight: 600, minWidth: 64,
                  }}>💇 理发师</span>
                  <span style={{
                    fontSize: 15, color: '#b91c1c',
                    fontWeight: 700,
                  }}>{data.stylistName}</span>
                </div>
              )}
              {data.scheduledDate && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{
                    fontSize: 13, color: 'rgba(44, 24, 16, 0.65)',
                    fontWeight: 600, minWidth: 64,
                  }}>📅 预约时间</span>
                  <span style={{
                    fontSize: 15, color: '#2c1810',
                    fontWeight: 700,
                    fontFamily: 'monospace',
                  }}>
                    {data.scheduledDate}
                    {data.scheduledTime && (
                      <span style={{ marginLeft: 8, color: '#b91c1c' }}>
                        {data.scheduledTime}
                      </span>
                    )}
                  </span>
                </div>
              )}
              {/* v1.1.44 真实消费金额（来自 Settlement） */}
              {data.finalAmount > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, color: 'rgba(44, 24, 16, 0.65)', fontWeight: 600, minWidth: 64 }}>💰 实付</span>
                  <span style={{ fontSize: 20, color: '#b91c1c', fontWeight: 800 }}>
                    ¥{data.finalAmount.toFixed(2)}
                  </span>
                  {data.listAmount != null && data.listAmount > data.finalAmount && (
                    <span style={{ fontSize: 12, color: 'rgba(44,24,16,.5)', fontWeight: 600, textDecoration: 'line-through' }}>
                      ¥{data.listAmount.toFixed(2)}
                    </span>
                  )}
                  {data.discountRate != null && data.discountRate < 1 && (
                    <span style={{ fontSize: 12, color: '#b45309', fontWeight: 700, background: 'rgba(245,158,11,.15)', padding: '2px 8px', borderRadius: 6 }}>
                      {(data.discountRate * 10).toFixed(1).replace(/\.0$/, '')} 折
                    </span>
                  )}
                </div>
              )}
              {data.payMethod && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 13, color: 'rgba(44, 24, 16, 0.65)', fontWeight: 600, minWidth: 64 }}>💳 支付</span>
                  <span style={{ fontSize: 14, color: '#2c1810', fontWeight: 700 }}>
                    {({ card: '会员卡余额', wechat: '微信', cash: '现金', alipay: '支付宝' } as Record<string, string>)[data.payMethod] || data.payMethod}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* 商品专用：取货码（重点展示）— 只在商品类型显示 */}
          {!isBookingType && data.pickupCode && !isClosed && (
            <div style={{
              padding: '12px 14px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(254, 226, 226, 0.6) 0%, rgba(254, 226, 226, 0.4) 100%)',
              border: '1px solid rgba(185, 28, 28, 0.2)',
              marginBottom: '12px',
              textAlign: 'center',
            }}>
              <div style={{
                fontSize: '11px',
                color: 'rgba(44, 24, 16, 0.65)',
                marginBottom: '4px',
                letterSpacing: '2px',
                fontWeight: 600,
              }}>
                取 货 码
              </div>
              <div style={{
                fontSize: '26px',
                fontWeight: 800,
                color: '#b91c1c',
                letterSpacing: '8px',
                fontFamily: 'monospace',
              }}>
                {data.pickupCode}
              </div>
            </div>
          )}

          {/* 商品专用：金额 + 数量 — 只在商品类型显示（预约没有 ¥ 概念） */}
          {!isBookingType && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '13px',
              color: 'rgba(44, 24, 16, 0.75)',
              marginBottom: '12px',
              fontWeight: 500,
            }}>
              <div>
                实付：<span style={{ color: '#b91c1c', fontWeight: 800, fontSize: '18px', marginLeft: 2 }}>
                  ¥{data.finalAmount.toFixed(2)}
                </span>
              </div>
              <div>
                {data.itemCount} 件
              </div>
            </div>
          )}

          {/* 操作按钮 */}
          <div style={{
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap',
          }}>
            <button
              onClick={handleViewDetail}
              style={{
                flex: 1,
                minWidth: '80px',
                padding: '9px 12px',
                borderRadius: '10px',
                border: 'none',
                background: 'rgba(185, 28, 28, 0.12)',
                color: '#b91c1c',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              查看详情
            </button>
            {data.pickupCode && !isBookingType && (
              <button
                onClick={handleCopyCode}
                style={{
                  flex: 1,
                  minWidth: '80px',
                  padding: '9px 12px',
                  borderRadius: '10px',
                  border: '1px solid rgba(185, 28, 28, 0.35)',
                  background: 'transparent',
                  color: '#b91c1c',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                📋 复制取货码
              </button>
            )}
            {data.status === 'pending' && data.orderNo && (
              <button
                onClick={handleCancel}
                style={{
                  flex: 1,
                  minWidth: '80px',
                  padding: '9px 12px',
                  borderRadius: '10px',
                  border: '1px solid rgba(220, 38, 38, 0.4)',
                  background: 'transparent',
                  color: '#dc2626',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                ❌ 取消订单
              </button>
            )}
          </div>

          {/* 底部提示 — 商品专用（预约没有取货码，到店口头说就行） */}
          {!isBookingType && data.pickupCode && data.pickupExpiresAt && data.status === 'pending' && (
            <div style={{
              fontSize: '12px',
              color: '#b45309',
              marginTop: '10px',
              textAlign: 'center',
              fontWeight: 600,
            }}>
              ⚠️ 到店出示取货码核销
            </div>
          )}
        </>
      )}
    </div>
  )
}