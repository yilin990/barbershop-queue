'use client'

/**
 * OrderCard - 订单卡片（2026-06-30 20:53 奕霖需求）
 *
 * 设计：
 * - 不是长字符串，是结构化卡片
 * - 关键信息一眼可见：取货码/金额/状态
 * - 按钮可点：查看详情/复制取货码/取消订单
 * - 点击卡片跳订单详情页
 */

import { toast } from '@/lib/ui-bus'
import { confirmDialog } from '@/lib/ui-bus'
import { useRouter } from 'next/navigation'
import { useUserStore } from '@/stores/userStore'
import { OrderCardData } from '@/domain/chat/service'

interface OrderCardProps {
  data: OrderCardData
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'rgba(255, 187, 0, 0.15)', text: '#ffbb00' },
  paid: { bg: 'rgba(184, 134, 11, 0.15)', text: '#b8860b' },
  preparing: { bg: 'rgba(184, 134, 11, 0.15)', text: '#b8860b' },
  ready: { bg: 'rgba(184, 134, 11, 0.2)', text: '#b8860b' },
  delivered: { bg: 'rgba(184, 134, 11, 0.1)', text: 'rgba(184, 134, 11, 0.7)' },
  cancelled: { bg: 'rgba(255, 107, 107, 0.15)', text: '#ff6b6b' },
  refunded: { bg: 'rgba(255, 107, 107, 0.15)', text: '#ff6b6b' },
  completed: { bg: 'rgba(184, 134, 11, 0.1)', text: 'rgba(184, 134, 11, 0.7)' },
}

export default function OrderCard({ data }: OrderCardProps) {
  const router = useRouter()
  const statusColor = STATUS_COLORS[data.status] || STATUS_COLORS.pending
  const isCancelled = data.status === 'cancelled'
  const isClosed = isCancelled || (data.status as string) === 'refunded'

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

  // ⭐ 2026-07-13 01:15：加取消订单按钮（仅 pending 状态）
  const handleCancel = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!await confirmDialog(`确定取消订单 ${data.orderNo}？\n取消后库存会退回。`)) return
    try {
      // ⭐ 通过 chat API 调 cancel_order 工具（保持同一 session 的认证）
      const user = useUserStore?.getState?.()?.user
      const resp = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: `取消订单 ${data.orderNo}` }],
          userId: user?.id,
          phone: user?.phone,
        }),
      })
      const json = await resp.json()
      if (json.toolExecuted?.includes?.('cancel_order')) {
        toast.info('✅ 订单已取消')
        router.refresh()
      } else {
        toast.error('❌ 取消失败：' + (json.reply || '未知错误'))
      }
    } catch (err: any) {
      toast.info('❌ 取消出错：' + (err?.message || err))
    }
  }

  return (
    <div
      onClick={handleViewDetail}
      style={{
        marginTop: '10px',
        padding: '12px 14px',
        borderRadius: '14px',
        background: isClosed
          ? 'linear-gradient(135deg, rgba(255, 107, 107, 0.12) 0%, rgba(255, 107, 107, 0.04) 100%)'
          : 'linear-gradient(135deg, rgba(184, 134, 11, 0.08) 0%, rgba(184, 134, 11, 0.03) 100%)',
        border: isClosed
          ? '1.5px solid rgba(255, 107, 107, 0.4)'
          : '1px solid rgba(184, 134, 11, 0.25)',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        // ⭐ 奕霖 2026-07-24 03:36：订单卡撑爆页面 → 限制最大高 + 内部滚
        maxWidth: '320px',
        // 小屏适配 iPhone 13 mini 375 宽 → 收窄一点
        maxHeight: 'min(160px, 30vh)',
        overflowY: 'auto',
        position: 'relative',
        opacity: isClosed ? 0.85 : 1,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = isClosed
          ? 'rgba(255, 107, 107, 0.7)'
          : 'rgba(184, 134, 11, 0.5)'
        ;(e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)'
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = isClosed
          ? 'rgba(255, 107, 107, 0.4)'
          : 'rgba(184, 134, 11, 0.25)'
        ;(e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'
      }}
    >
      {/* ⭐ 奕霖 2026-07-15 01:30：取消订单后顶部红色横条提示 */}
      {isCancelled && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          padding: '6px 10px', marginBottom: '10px',
          background: 'linear-gradient(90deg, rgba(255, 107, 107, 0.2) 0%, rgba(255, 107, 107, 0.3) 50%, rgba(255, 107, 107, 0.2) 100%)',
          border: '1px solid rgba(255, 107, 107, 0.4)',
          borderRadius: '8px',
          fontSize: '12px', fontWeight: 700,
          color: '#ff6b6b',
          letterSpacing: '0.5px',
        }}>
          <span style={{ fontSize: '14px' }}>❌</span>
          <span>订单已取消 · 库存已退回 · 取货码作废</span>
        </div>
      )}
      {/* 头部：订单号 + 状态 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '10px',
      }}>
        <div style={{
          fontSize: '11px',
          color: 'rgba(184, 134, 11, 0.6)',
          fontFamily: 'monospace',
        }}>
          📦 {data.orderNo}
        </div>
        <div style={{
          padding: '3px 10px',
          borderRadius: '12px',
          fontSize: '11px',
          fontWeight: 600,
          background: statusColor.bg,
          color: statusColor.text,
        }}>
          {data.statusLabel}
        </div>
      </div>

      {/* 商品摘要 */}
      <div style={{
        fontSize: '13px',
        color: '#e8f5e9',
        marginBottom: '10px',
        lineHeight: 1.5,
      }}>
        {data.itemSummary}
      </div>

      {/* 取货码（重点展示）— 取消后隐藏 */}
      {data.pickupCode && !isClosed && (
        <div style={{
          padding: '10px 12px',
          borderRadius: '10px',
          background: 'rgba(0, 0, 0, 0.3)',
          marginBottom: '10px',
          textAlign: 'center',
        }}>
          <div style={{
            fontSize: '10px',
            color: 'rgba(184, 134, 11, 0.6)',
            marginBottom: '4px',
            letterSpacing: '1px',
          }}>
            取货码
          </div>
          <div style={{
            fontSize: '22px',
            fontWeight: 700,
            color: '#b8860b',
            letterSpacing: '6px',
            fontFamily: 'monospace',
          }}>
            {data.pickupCode}
          </div>
        </div>
      )}

      {/* 金额 + 数量 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '12px',
        color: 'rgba(255, 255, 255, 0.6)',
        marginBottom: '10px',
      }}>
        <div>
          实付：<span style={{ color: '#b8860b', fontWeight: 700, fontSize: '15px' }}>
            ¥{data.finalAmount.toFixed(2)}
          </span>
        </div>
        <div>
          {data.itemCount} 件
        </div>
      </div>

      {/* 操作按钮 */}
      <div style={{
        display: 'flex',
        gap: '6px',
        flexWrap: 'wrap',
      }}>
        <button
          onClick={handleViewDetail}
          style={{
            flex: 1,
            minWidth: '80px',
            padding: '8px 12px',
            borderRadius: '10px',
            border: 'none',
            background: 'rgba(184, 134, 11, 0.2)',
            color: '#b8860b',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          查看详情
        </button>
        {data.pickupCode && (
          <button
            onClick={handleCopyCode}
            style={{
              flex: 1,
              minWidth: '80px',
              padding: '8px 12px',
              borderRadius: '10px',
              border: '1px solid rgba(184, 134, 11, 0.3)',
              background: 'transparent',
              color: 'rgba(184, 134, 11, 0.85)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            📋 复制取货码
          </button>
        )}
        {/* ⭐ 2026-07-13 01:15：取消订单按钮（仅 pending 状态） */}
        {data.status === 'pending' && data.orderNo && (
          <button
            onClick={handleCancel}
            style={{
              flex: 1,
              minWidth: '80px',
              padding: '8px 12px',
              borderRadius: '10px',
              border: '1px solid rgba(255, 107, 107, 0.3)',
              background: 'transparent',
              color: 'rgba(255, 107, 107, 0.85)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            ❌ 取消订单
          </button>
        )}
      </div>

      {/* 底部提示 */}
      {data.pickupCode && data.pickupExpiresAt && data.status === 'pending' && (
        <div style={{
          fontSize: '10px',
          color: 'rgba(255, 187, 0, 0.7)',
          marginTop: '8px',
          textAlign: 'center',
        }}>
          ⚠️ 到店出示取货码核销
        </div>
      )}
    </div>
  )
}
