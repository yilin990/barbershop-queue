'use client'

/**
 * /orders/[id]/review - 订单评价页 (2026-06-30 21:49 奕霖需求)
 *
 * 流程：
 *   1. 用户在订单详情点"去评价"
 *   2. 进入 /orders/[id]/review
 *   3. 选 1-5 星 + 写文字（可选）
 *   4. 提交 → POST /api/order-reviews
 *   5. 跳转回订单详情
 */

import { toast } from '@/lib/ui-bus'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import AppLayout from '@/components/AppLayout'
import { useUserStore } from '@/stores/userStore'

export default function OrderReviewPage() {
  const params = useParams()
  const router = useRouter()
  const { user, isLoggedIn } = useUserStore()
  const orderId = params.id as string

  const [rating, setRating] = useState(5)
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [hoverRating, setHoverRating] = useState(0)
  const [tags, setTags] = useState<string[]>([])
  const [tagOptions] = useState([
    '手艺精湛', '回复及时', '态度好', '推荐准',
    '价格透明', '服务齐全', '门店干净', '取号快',
  ])

  const toggleTag = (tag: string) => {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  const handleSubmit = async () => {
    if (!user?.id) {
      toast.info('请先登录')
      return
    }
    if (rating < 1) {
      toast.info('请选择评分')
      return
    }
    setSubmitting(true)
    try {
      // 拼接内容：标签 + 文字
      const fullContent = [
        tags.length > 0 ? tags.map((t) => `#${t}`).join(' ') : '',
        content,
      ].filter(Boolean).join('\n')

      const res = await fetch('/api/order-reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          userId: user.id,
          rating,
          content: fullContent,
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('🎉 评价成功，谢谢反馈！')
        router.push(`/orders/${orderId}`)
      } else {
        toast.error('评价失败：' + (data.error || '未知错误'))
      }
    } catch (e: any) {
      toast.error('评价失败：' + e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AppLayout title="订单评价" showHeader>
      <div style={{ padding: '16px', paddingBottom: '100px' }}>
        {/* 头部引导 */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ fontSize: '48px', marginBottom: '8px' }}>⭐</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>
            服务怎么样？
          </div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>
            你的反馈帮我们做得更好
          </div>
        </div>

        {/* 评分 */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.04)',
          borderRadius: '16px',
          padding: '20px',
          border: '1px solid rgba(184, 134, 11, 0.15)',
          marginBottom: '16px',
          textAlign: 'center',
        }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '12px' }}>
            {[1, 2, 3, 4, 5].map((star) => {
              const active = star <= (hoverRating || rating)
              return (
                <button
                  key={star}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(star)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    fontSize: '40px',
                    cursor: 'pointer',
                    color: active ? '#b8860b' : 'rgba(255,255,255,0.2)',
                    transition: 'all 0.2s ease',
                    transform: active ? 'scale(1.1)' : 'scale(1)',
                    padding: 0,
                  }}
                >
                  ★
                </button>
              )
            })}
          </div>
          <div style={{ fontSize: '14px', color: '#b8860b', fontWeight: 600 }}>
            {['非常差', '差', '一般', '满意', '非常满意'][rating - 1]}
          </div>
        </div>

        {/* 标签快捷选择 */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.04)',
          borderRadius: '16px',
          padding: '16px',
          border: '1px solid rgba(184, 134, 11, 0.15)',
          marginBottom: '16px',
        }}>
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', marginBottom: '12px' }}>
            哪些地方让你满意？（可多选）
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {tagOptions.map((tag) => {
              const active = tags.includes(tag)
              return (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '16px',
                    border: active
                      ? '1px solid rgba(184, 134, 11, 0.5)'
                      : '1px solid rgba(184, 134, 11, 0.15)',
                    background: active ? 'rgba(184, 134, 11, 0.2)' : 'transparent',
                    color: active ? '#b8860b' : 'rgba(255,255,255,0.6)',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  {tag}
                </button>
              )
            })}
          </div>
        </div>

        {/* 文字评价 */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.04)',
          borderRadius: '16px',
          padding: '16px',
          border: '1px solid rgba(184, 134, 11, 0.15)',
          marginBottom: '16px',
        }}>
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', marginBottom: '8px' }}>
            想说什么？（选填）
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value.slice(0, 500))}
            placeholder="说说你对这次服务的感受…"
            rows={5}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '8px',
              background: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid rgba(184, 134, 11, 0.15)',
              color: '#fff',
              fontSize: '14px',
              resize: 'vertical',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <div style={{ textAlign: 'right', fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
            {content.length} / 500
          </div>
        </div>

        {/* 提交按钮 */}
        <button
          onClick={handleSubmit}
          disabled={submitting}
          style={{
            width: '100%',
            padding: '16px',
            borderRadius: '14px',
            border: 'none',
            background: submitting
              ? 'rgba(184, 134, 11, 0.3)'
              : 'linear-gradient(135deg, #b8860b 0%, #6bc97f 100%)',
            color: '#2c1810',
            fontSize: '16px',
            fontWeight: 700,
            cursor: submitting ? 'wait' : 'pointer',
            boxShadow: '0 4px 16px rgba(184, 134, 11, 0.3)',
          }}
        >
          {submitting ? '提交中…' : '提交评价'}
        </button>
      </div>
    </AppLayout>
  )
}
