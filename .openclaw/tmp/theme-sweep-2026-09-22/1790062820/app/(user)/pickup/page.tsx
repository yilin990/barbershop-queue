'use client'

/**
 * /pickup - 取货码核销页（店员用）
 *
 * 流程：
 *   1. 店员输入 6 位取货码
 *   2. 调 /api/orders/pickup 验证
 *   3. 显示订单信息（商品名/金额/会员信息）
 *   4. 店员确认到店支付
 *   5. 点击"核销"完成
 *
 * 2026-06-30 by 清禾 — 合规闭环核心组件
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/AppLayout'
import StaffGate from '@/components/StaffGate'

const STAFF_NAME = '店员' // 后续接 auth

export default function PickupPage() {
  const router = useRouter()
  // ⭐ MEMORY §254 — 奕霖 8-22 19:36 拍板"🥑和其他三个都一样，需要解锁后才能用的功能"：
  // 🥑 跟核销表单一起放进 StaffGate，输 PIN 1234 后才能看到
  // 删掉 Portal 浮动（不再需要绕 AgreementGate — StaffGate 本身就在 AgreementGate 之上）
  return (
    <AppLayout title="核销中心" showHeader>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 16px' }}>
        <StaffGate>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              onClick={function() { router.push('/pickup/snapshots') }}
              title="每日图（查找商品 + 上传图片，自动压缩，3天自动删除）"
              style={{
                width: '38px', height: '30px', borderRadius: '8px',
                border: '1px solid rgba(127, 220, 148, 0.5)',
                background: 'linear-gradient(135deg, rgba(127, 220, 148, 0.18) 0%, rgba(74, 157, 101, 0.12) 100%)',
                color: '#a8e6b8', fontSize: '16px',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}
            >🥑</button>
          </div>
          <PickupPageInner />
        </StaffGate>
      </div>
    </AppLayout>
  )
}

function PickupPageInner() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [redeeming, setRedeeming] = useState(false)
  const [orderInfo, setOrderInfo] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [payMethod, setPayMethod] = useState<'cash' | 'wechat' | 'alipay' | 'card'>('cash')
  const [success, setSuccess] = useState(false)
const [printQueued, setPrintQueued] = useState(false)

  const handleQuery = async () => {
    if (!/^\d{6}$/.test(code)) {
      setError('请输入 6 位数字取货码')
      return
    }
    setLoading(true)
    setError(null)
    setOrderInfo(null)
    try {
      const res = await fetch(`/api/orders/pickup?code=${code}`)
      const json = await res.json()
      if (json.success) {
        setOrderInfo(json.order)
      } else {
        setError(json.error || '查询失败')
      }
    } catch (e: any) {
      setError(`网络错误：${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleRedeem = async () => {
    setRedeeming(true)
    try {
      const res = await fetch('/api/orders/pickup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          staffName: STAFF_NAME,
          payMethod,
          printReceipt: true,
        }),
      })
      const json = await res.json()
      if (json.success) {
        setSuccess(true)
        setPrintQueued(json.printReceipt === true)
        setOrderInfo((prev: any) => ({ ...prev, pickedUpAt: json.order.pickedUpAt, status: 'delivered' }))
      } else {
        setError(json.error || '核销失败')
      }
    } catch (e: any) {
      setError(`核销失败：${e.message}`)
    } finally {
      setRedeeming(false)
    }
  }

  const handleReset = () => {
    setCode('')
    setOrderInfo(null)
    setError(null)
    setSuccess(false)
    setPrintQueued(false)
  }

  return (
    <AppLayout title="取货核销" showHeader>

      <div style={{ padding: '16px', paddingBottom: '100px' }}>
        {/* 顶部标题 */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#ffffff' }}>
            📦 取货码核销
          </div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>
            店员输入顾客提供的 6 位取货码
          </div>
        </div>

        {/* 输入区 */}
        {!success && (
          <div style={{
            padding: '20px',
            borderRadius: '20px',
            background: 'rgba(127, 220, 148, 0.06)',
            border: '1px solid rgba(127, 220, 148, 0.2)',
            marginBottom: '20px',
          }}>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', marginBottom: '10px' }}>
              取货码（6 位数字）
            </div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                style={{
                  flex: 1,
                  padding: '14px 16px',
                  borderRadius: '14px',
                  border: '1px solid rgba(127, 220, 148, 0.3)',
                  background: 'rgba(0,0,0,0.3)',
                  color: '#fbbf24',
                  fontSize: '24px',
                  fontWeight: 700,
                  letterSpacing: '8px',
                  textAlign: 'center',
                  fontFamily: 'monospace',
                }}
              />
              <button
                onClick={handleQuery}
                disabled={loading || code.length !== 6}
                style={{
                  padding: '0 20px',
                  borderRadius: '14px',
                  border: 'none',
                  background: code.length === 6 ? '#fbbf24' : 'rgba(127, 220, 148, 0.3)',
                  color: code.length === 6 ? '#0a0f0d' : 'rgba(255,255,255,0.4)',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: code.length === 6 ? 'pointer' : 'not-allowed',
                }}
              >
                {loading ? '查询中' : '查询'}
              </button>
            </div>

            {error && (
              <div style={{
                padding: '10px 14px',
                borderRadius: '10px',
                background: 'rgba(255, 107, 107, 0.1)',
                border: '1px solid rgba(255, 107, 107, 0.3)',
                color: '#ff6b6b',
                fontSize: '13px',
              }}>
                ❌ {error}
              </div>
            )}
          </div>
        )}

        {/* 订单信息 */}
        {orderInfo && !success && (
          <div style={{
            padding: '20px',
            borderRadius: '20px',
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(127, 220, 148, 0.15)',
            marginBottom: '20px',
          }}>
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>
                订单号
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: '15px', color: '#ffffff', fontFamily: 'monospace' }}>
                  {orderInfo.orderNo}
                </div>
                {orderInfo.remark?.startsWith('[DEMO]') && (
                  <span style={{
                    padding: '2px 8px', borderRadius: 6,
                    background: 'linear-gradient(135deg, rgba(244,114,182,0.25), rgba(168,85,247,0.2))',
                    border: '1px solid rgba(244,114,182,0.4)',
                    color: '#fbcfe8', fontSize: 11, fontWeight: 700,
                  }}>🎭 演示</span>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>
                  顾客
                </div>
                <div style={{ fontSize: '15px', color: '#ffffff' }}>
                  {orderInfo.customerName}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>
                  实付金额
                </div>
                <div style={{ fontSize: '20px', color: '#fbbf24', fontWeight: 700 }}>
                  ¥{orderInfo.finalAmount.toFixed(2)}
                </div>
              </div>
            </div>

            {orderInfo.isExpired && (
              <div style={{
                padding: '10px 14px',
                borderRadius: '10px',
                background: 'rgba(255, 187, 0, 0.1)',
                border: '1px solid rgba(255, 187, 0, 0.3)',
                color: '#ffbb00',
                fontSize: '13px',
                marginBottom: '12px',
              }}>
                ⚠️ 取货码已过期，请让顾客重新下单
              </div>
            )}

            {orderInfo.isRedeemed && (
              <div style={{
                padding: '10px 14px',
                borderRadius: '10px',
                background: 'rgba(255, 107, 107, 0.1)',
                border: '1px solid rgba(255, 107, 107, 0.3)',
                color: '#ff6b6b',
                fontSize: '13px',
                marginBottom: '12px',
              }}>
                ❌ 取货码已使用，不能重复核销
              </div>
            )}

            {!orderInfo.isExpired && !orderInfo.isRedeemed && (
              <>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', marginBottom: '8px' }}>
                  到店支付方式
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
                  {[
                    { v: 'cash', l: '💵 现金' },
                    { v: 'wechat', l: '💚 微信' },
                    { v: 'alipay', l: '💙 支付宝' },
                    { v: 'card', l: '💳 银行卡' },
                  ].map((opt) => (
                    <button
                      key={opt.v}
                      onClick={() => setPayMethod(opt.v as any)}
                      style={{
                        padding: '10px',
                        borderRadius: '12px',
                        border: payMethod === opt.v
                          ? '1px solid #fbbf24'
                          : '1px solid rgba(127, 220, 148, 0.2)',
                        background: payMethod === opt.v
                          ? 'rgba(127, 220, 148, 0.15)'
                          : 'rgba(255, 255, 255, 0.03)',
                        color: '#ffffff',
                        fontSize: '13px',
                        cursor: 'pointer',
                      }}
                    >
                      {opt.l}
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleRedeem}
                  disabled={redeeming}
                  style={{
                    width: '100%',
                    padding: '14px',
                    borderRadius: '14px',
                    border: 'none',
                    background: '#fbbf24',
                    color: '#0a0f0d',
                    fontSize: '15px',
                    fontWeight: 700,
                    cursor: redeeming ? 'wait' : 'pointer',
                  }}
                >
                  {redeeming ? '核销中…' : '✅ 确认核销（完成订单）'}
                </button>
              </>
            )}
          </div>
        )}

        {/* 成功提示 */}
        {success && (
          <div style={{
            padding: '40px 20px',
            borderRadius: '20px',
            background: 'rgba(127, 220, 148, 0.08)',
            border: '1px solid rgba(127, 220, 148, 0.3)',
            textAlign: 'center',
            marginBottom: '20px',
          }}>
            <div style={{ fontSize: '60px', marginBottom: '16px' }}>✅</div>
            <div style={{ fontSize: '18px', color: '#fbbf24', fontWeight: 700, marginBottom: '8px' }}>
              核销成功
            </div>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', marginBottom: '8px' }}>
              订单已完成，顾客可凭支付凭证离店
            </div>
            {printQueued && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                marginTop: 8, marginBottom: 20,
                padding: '10px 18px', borderRadius: 12,
                background: 'rgba(127, 220, 148, 0.12)',
                border: '1px solid rgba(127, 220, 148, 0.25)',
              }}>
                <span style={{ fontSize: 18 }}>🖨</span>
                <span style={{ fontSize: 13, color: '#fbbf24', fontWeight: 600 }}>小票已发送到打印机</span>
              </div>
            )}
            <button
              onClick={handleReset}
              style={{
                padding: '10px 24px',
                borderRadius: '14px',
                border: '1px solid #fbbf24',
                background: 'transparent',
                color: '#fbbf24',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              核销下一个
            </button>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
