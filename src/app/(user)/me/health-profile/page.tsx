'use client'

/**
 * 我的偏好编辑页 · 奕霖 2026-08-26
 *
 * 改动：
 * - 删掉"风格偏好"（用户不让填，写了也不准）
 * - 加"⭐ 我常买的"自动卡片：从订单历史算 Top 5，免用户手填
 * - 3 字段保留：性别 / 食物过敏 / 饮食习惯
 *
 * 目的：让 AI 从真实购买行为学习，而不是让用户自己说"我喜欢什么"。
 */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useUserStore } from '@/stores/userStore'

const GREEN = '#b8860b'
const GREEN_RGBA = '184, 134, 11'

export default function HealthProfilePage() {
  const { user } = useUserStore()
  const [gender, setGender] = useState<'男' | '女' | '其他' | ''>(
    (user?.profile?.gender as any) || ''
  )
  const [foodAllergy, setFoodAllergy] = useState<string>(user?.profile?.allergy || '')
  const [diet, setDiet] = useState<string>(user?.profile?.chronicDiseases || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setGender(((user?.profile?.gender as any) || ''))
    setFoodAllergy(user?.profile?.allergy || '')
    setDiet(user?.profile?.chronicDiseases || '')
  }, [user])

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    setError('')
    try {
      const { updateProfile } = useUserStore.getState()
      await updateProfile({
        gender: (gender || undefined) as any,
        allergy: foodAllergy || undefined,
        chronicDiseases: diet || undefined,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e: any) {
      setError(e?.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  if (!user) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0a0e0c', color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24, textAlign: 'center',
      }}>
        <div>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔐</div>
          <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.7)', marginBottom: 20 }}>
            请先登录后再编辑偏好
          </div>
          <Link href="/login" style={{
            display: 'inline-block', padding: '12px 24px',
            background: `linear-gradient(135deg, ${GREEN} 0%, #b8860b 100%)`,
            color: '#2c1810', fontSize: 14, fontWeight: 700,
            borderRadius: 12, textDecoration: 'none',
          }}>
            👉 去登录
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0e0c', color: '#fff', paddingBottom: 32 }}>
      <div style={{
        padding: '14px 16px',
        background: 'rgba(184, 134, 11, 0.06)',
        borderBottom: `1px solid rgba(${GREEN_RGBA}, 0.15)`,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <Link href="/me" style={{ color: GREEN, fontSize: 20, textDecoration: 'none' }}>←</Link>
        <div style={{ fontSize: 17, fontWeight: 700 }}>我的偏好</div>
      </div>

      <div style={{ padding: '8px 16px 32px' }}>
        <div style={{
          background: 'rgba(184, 134, 11, 0.06)',
          border: '1px solid rgba(184, 134, 11, 0.15)',
          borderRadius: 14, padding: 16, marginBottom: 16, fontSize: 12.5,
          color: 'rgba(255,255,255,0.7)', lineHeight: 1.7,
        }}>
          💡 填写一次后，<span style={{ color: GREEN, fontWeight: 700 }}>造型助手就不用再问这些了</span>。
          所有信息加密存储，仅用于个性化推荐。
        </div>

        <div style={{
          background: 'rgba(44, 24, 16, 0.3)',
          borderRadius: 16, padding: 18, marginBottom: 16,
          border: `1px solid rgba(${GREEN_RGBA}, 0.1)`,
        }}>
          <Field label="性别" hint="推荐更贴合你（女生更懂女生爱吃的）">
            <div style={{ display: 'flex', gap: 8 }}>
              {(['男', '女', '其他'] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGender(g)}
                  style={{
                    flex: 1, padding: '10px',
                    border: gender === g
                      ? `1.5px solid ${GREEN}`
                      : '1px solid rgba(184, 134, 11, 0.15)',
                    background: gender === g
                      ? 'rgba(184, 134, 11, 0.15)'
                      : 'rgba(184, 134, 11, 0.04)',
                    color: gender === g ? GREEN : 'rgba(255,255,255,0.6)',
                    borderRadius: 10, fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >{g}</button>
              ))}
            </div>
          </Field>

          <Field label="食物过敏" hint="对哪些食物过敏，逗号分隔">
            <textarea
              value={foodAllergy}
              onChange={(e) => setFoodAllergy(e.target.value)}
              placeholder="例如：芒果, 海鲜, 花生, 麸质"
              rows={2}
              style={{ ...inputStyle, resize: 'none' }}
            />
          </Field>

          <Field label="饮食习惯" hint="饮食偏好 / 禁忌，逗号分隔">
            <textarea
              value={diet}
              onChange={(e) => setDiet(e.target.value)}
              placeholder="例如：素食, 不吃辣, 清淡口味, 不吃生冷, 忌高糖"
              rows={2}
              style={{ ...inputStyle, resize: 'none' }}
            />
          </Field>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            width: '100%', padding: '14px',
            background: saving
              ? 'rgba(184, 134, 11, 0.3)'
              : 'linear-gradient(135deg, #b8860b 0%, #b8860b 100%)',
            color: '#2c1810', fontSize: 15, fontWeight: 700,
            border: 'none', borderRadius: 14, cursor: saving ? 'wait' : 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {saving ? '保存中...' : saved ? '✓ 已保存' : '保存'}
        </button>

        {error && (
          <div style={{
            marginTop: 12, padding: 12, borderRadius: 8,
            background: 'rgba(255, 107, 107, 0.12)',
            color: '#ff9a6b', fontSize: 13,
          }}>⚠️ {error}</div>
        )}

        {saved && (
          <div style={{
            marginTop: 12, textAlign: 'center',
            color: GREEN, fontSize: 13, fontWeight: 600,
          }}>偏好已保存，造型助手下次会按这些推荐 🌿</div>
        )}

        {/* ⭐ 我常买的 — 自动从订单历史算 Top 5 */}
        <FrequentItems phone={user?.phone} />
      </div>
    </div>
  )
}

function FrequentItems({ phone }: { phone?: string }) {
  const [items, setItems] = useState<Array<{
    productId: string; productName: string; productImage?: string;
    productSpec?: string; price: number; buyCount: number; totalQty: number;
    lastBoughtAt: string;
  }>>([])
  const [loading, setLoading] = useState(true)
  const [totalOrders, setTotalOrders] = useState(0)
  const [totalSpent, setTotalSpent] = useState(0)

  useEffect(() => {
    if (!phone) { setLoading(false); return }
    let cancelled = false
    setLoading(true)
    fetch(`/api/orders?phone=${phone}&limit=100`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        const orders: any[] = data?.orders || []
        // 聚合：按 productId 汇总 buyCount / totalQty / lastBoughtAt
        const map = new Map<string, any>()
        for (const o of orders) {
          // 只算成功的订单 (delivered/picked_up)，cancelled 不算
          if (o.status === 'cancelled') continue
          for (const it of (o.items || [])) {
            const ex = map.get(it.productId)
            const qty = Number(it.quantity || 0)
            const created = o.createdAt
            if (ex) {
              ex.buyCount += 1
              ex.totalQty += qty
              ex.totalSpent += Number(it.subtotal || it.price * qty || 0)
              if (new Date(created) > new Date(ex.lastBoughtAt)) ex.lastBoughtAt = created
            } else {
              map.set(it.productId, {
                productId: it.productId,
                productName: it.productName,
                productImage: it.productImage,
                productSpec: it.productSpec,
                price: Number(it.price || 0),
                buyCount: 1,
                totalQty: qty,
                totalSpent: Number(it.subtotal || it.price * qty || 0),
                lastBoughtAt: created,
              })
            }
          }
        }
        const list = Array.from(map.values())
          .sort((a, b) => b.buyCount - a.buyCount || b.totalSpent - a.totalSpent)
          .slice(0, 5)
        setItems(list)
        setTotalOrders(orders.filter((o) => o.status !== 'cancelled').length)
        setTotalSpent(orders
          .filter((o) => o.status !== 'cancelled')
          .reduce((sum, o) => sum + Number(o.finalAmount || o.totalAmount || 0), 0))
        setLoading(false)
      })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [phone])

  return (
    <div style={{
      marginTop: 24,
      background: 'linear-gradient(135deg, rgba(184, 134, 11,0.08), rgba(44,24,16,0.3))',
      borderRadius: 16, padding: 18,
      border: `1px solid rgba(${GREEN_RGBA}, 0.18)`,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 14,
      }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>
          ⭐ 我常买的
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
          自动从订单历史算
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '24px 0', color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
          正在回忆你买过什么…
        </div>
      )}

      {!loading && items.length === 0 && (
        <div style={{ textAlign: 'center', padding: '24px 0', color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🛒</div>
          还没有订单记录
          <div style={{ marginTop: 8, fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
            体验过一次后，造型助手会记住你的偏好
          </div>
          <Link href="/" style={{
            display: 'inline-block', marginTop: 14, padding: '8px 16px',
            background: 'rgba(184, 134, 11,0.15)',
            color: GREEN, fontSize: 13, fontWeight: 600,
            borderRadius: 10, textDecoration: 'none',
          }}>去逛逛造型 →</Link>
        </div>
      )}

      {!loading && items.length > 0 && (
        <>
          {/* 顶部统计 */}
          <div style={{
            display: 'flex', gap: 12, marginBottom: 14,
            padding: '10px 12px',
            background: 'rgba(0,0,0,0.25)', borderRadius: 10,
          }}>
            <Stat label="订单" value={String(totalOrders)} />
            <Stat label="种商品" value={String(items.length)} />
            <Stat label="总消费" value={`¥${totalSpent.toFixed(0)}`} />
          </div>

          {/* Top 5 商品 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map((it, idx) => (
              <Link
                key={it.productId}
                href={`/products/${it.productId}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 12px',
                  background: 'rgba(44,24,16,0.5)',
                  border: '1px solid rgba(184, 134, 11,0.12)',
                  borderRadius: 12, textDecoration: 'none',
                  color: '#fff',
                }}
              >
                <div style={{
                  fontSize: 13, fontWeight: 800, color: GREEN,
                  width: 22, textAlign: 'center',
                }}>{idx + 1}</div>
                {it.productImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.productImage} alt={it.productName}
                    style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{
                    width: 44, height: 44, borderRadius: 8,
                    background: 'rgba(184, 134, 11,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 22,
                  }}>🥬</div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 600,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{it.productName}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                    ¥{it.price.toFixed(2)}{it.productSpec ? ` · ${it.productSpec}` : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, color: GREEN, fontWeight: 700 }}>
                    ×{it.buyCount}
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>次</div>
                </div>
              </Link>
            ))}
          </div>

          <div style={{
            marginTop: 14, padding: '10px 12px',
            background: 'rgba(184, 134, 11,0.08)',
            borderRadius: 10, fontSize: 12, color: 'rgba(255,255,255,0.7)',
            lineHeight: 1.6,
          }}>
            🌿 <span style={{ color: GREEN, fontWeight: 700 }}>造型助手记住了</span> —
            下次聊天时会主动推荐你常买的，不用再说"我想做上次那个"
          </div>
        </>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: GREEN }}>{value}</div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{label}</div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px',
  background: 'rgba(44, 24, 16, 0.5)',
  border: '1px solid rgba(184, 134, 11, 0.2)',
  borderRadius: 10, color: '#fff', fontSize: 14,
  fontFamily: 'inherit', outline: 'none',
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{
        display: 'block', marginBottom: 6,
        fontSize: 12, fontWeight: 600, color: 'rgba(184, 134, 11,0.8)',
      }}>{label}</label>
      {children}
      {hint && (
        <div style={{ marginTop: 4, fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
          {hint}
        </div>
      )}
    </div>
  )
}
