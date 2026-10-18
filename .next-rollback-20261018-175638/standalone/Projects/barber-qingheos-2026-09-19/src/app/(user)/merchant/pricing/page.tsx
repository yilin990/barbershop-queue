'use client'

/**
 * /merchant/pricing — 服务标准价管理（v1.1.42 · 2026-10-07 清禾）
 *
 * 为什么有这个：价格之前写死在 Service 表里，改一次要找我。
 * 店长自己就会调价（剪发 58 → 68），一天可能好几回，不能老等人。
 *
 * 改完立刻生效：结算面板读的就是这张表，
 * 所以店长在这里改完，下一单点「完成 ✓」自动带新价，不用手打。
 */

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

const MERCHANT_ID = 'm_barber_001'
const gold = '#b8860b'

interface Svc {
  id: string
  name: string
  price: number
  icon: string | null
  category: string
  duration: number
}

const CAT: Record<string, string> = {
  cut: '剪发造型', perm: '烫发染发', care: '护理保养', style: '形象设计', other: '其他',
}

export default function PricingPage() {
  const router = useRouter()
  const [svcs, setSvcs] = useState<Svc[]>([])
  const [edit, setEdit] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/services?merchantId=' + MERCHANT_ID, { cache: 'no-store' })
      const j = await r.json()
      const list: Svc[] = j.services || []
      setSvcs(list)
      const init: Record<string, string> = {}
      list.forEach(s => { init[s.id] = String(s.price) })
      setEdit(init)
    } catch {
      setMsg({ ok: false, text: '加载失败，检查网络' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function save(s: Svc) {
    const raw = (edit[s.id] ?? '').trim()
    const n = Number(raw)
    if (!Number.isFinite(n) || n < 0) {
      setMsg({ ok: false, text: s.name + '：价格得是个正常数字' })
      return
    }
    if (Math.round(n * 100) / 100 === s.price) {
      setMsg({ ok: false, text: s.name + '：价格没变' })
      return
    }
    setSaving(s.id)
    setMsg(null)
    try {
      const r = await fetch('/api/services', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: s.id, merchantId: MERCHANT_ID, price: n }),
      })
      const j = await r.json()
      if (!j.success) {
        setMsg({ ok: false, text: s.name + '：' + (j.error || '保存失败') })
        return
      }
      setSvcs(prev => prev.map(x =>
        x.id === s.id ? { ...x, price: j.service.price } : x))
      setEdit(prev => ({ ...prev, [s.id]: String(j.service.price) }))
      setMsg({ ok: true, text: s.name + ' 已改成 ¥' + Number(j.service.price).toFixed(2) + '，下一单就按新价' })
    } catch (e: any) {
      setMsg({ ok: false, text: '网络错误：' + (e?.message || '') })
    } finally {
      setSaving('')
    }
  }

  function resetAll() {
    const init: Record<string, string> = {}
    svcs.forEach(s => { init[s.id] = String(s.price) })
    setEdit(init)
    setMsg(null)
  }

  const dirty = svcs.some(s => Math.round(Number(edit[s.id]) * 100) / 100 !== s.price)

  const groups = svcs.reduce((acc: Record<string, Svc[]>, s) => {
    const k = s.category || 'other'
    ;(acc[k] = acc[k] || []).push(s)
    return acc
  }, {})

  return (
    <div style={{
      maxWidth: 560, margin: '0 auto', padding: '16px 14px 40px',
      fontFamily: 'system-ui, -apple-system, sans-serif', color: '#1f2937',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <button onClick={() => router.back()} style={{
          background: 'none', border: 'none', fontSize: 22, cursor: 'pointer',
          color: '#6b7280', padding: 0, lineHeight: 1,
        }}>‹</button>
        <div>
          <div style={{ fontSize: 19, fontWeight: 800 }}>服务标准价</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
            改完立刻生效，结算时自动带出，不用再手打
          </div>
        </div>
      </div>

      {msg && (
        <div style={{
          marginTop: 12, padding: '10px 12px', borderRadius: 10, fontSize: 13,
          fontWeight: 600,
          background: msg.ok ? '#ecfdf5' : '#fef2f2',
          color: msg.ok ? '#065f46' : '#991b1b',
          border: '1px solid ' + (msg.ok ? '#a7f3d0' : '#fecaca'),
        }}>{msg.text}</div>
      )}

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
          加载中…
        </div>
      ) : svcs.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
          这个商户还没有服务项目
        </div>
      ) : (
        Object.keys(groups).map(cat => (
          <div key={cat} style={{ marginTop: 20 }}>
            <div style={{
              fontSize: 12, fontWeight: 700, color: '#6b7280',
              padding: '0 2px', marginBottom: 8,
            }}>{CAT[cat] || cat}</div>
            <div style={{
              background: '#fff', border: '1px solid #e5e7eb',
              borderRadius: 14, overflow: 'hidden',
            }}>
              {groups[cat].map((s, i) => {
                const now = Math.round(Number(edit[s.id]) * 100) / 100
                const changed = now !== s.price
                return (
                  <div key={s.id} style={{
                    padding: '12px 14px',
                    borderBottom: i < groups[cat].length - 1 ? '1px solid #f3f4f6' : 'none',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 18 }}>{s.icon || '✂️'}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{s.name}</div>
                        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                          原价 ¥{Number(s.price).toFixed(2)} · {s.duration} 分钟
                        </div>
                      </div>
                      <div style={{ position: 'relative' }}>
                        <span style={{
                          position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                          fontSize: 13, color: '#9ca3af', pointerEvents: 'none',
                        }}>¥</span>
                        <input
                          value={edit[s.id] ?? ''}
                          onChange={(e) => setEdit(prev => ({
                            ...prev, [s.id]: e.target.value.replace(/[^\d.]/g, '').slice(0, 8),
                          }))}
                          inputMode="decimal"
                          style={{
                            width: 92, padding: '9px 10px 9px 22px',
                            borderRadius: 9, fontSize: 15, fontWeight: 700,
                            fontFamily: 'monospace',
                            border: changed ? '1.5px solid ' + gold : '1px solid #e5e7eb',
                            background: changed ? '#fffbf0' : '#fff',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>
                      <button
                        onClick={() => save(s)}
                        disabled={!changed || saving === s.id}
                        style={{
                          padding: '9px 13px', borderRadius: 9, border: 'none',
                          fontSize: 13, fontWeight: 700,
                          background: changed ? gold : '#e5e7eb',
                          color: changed ? '#fff' : '#9ca3af',
                          cursor: changed ? 'pointer' : 'not-allowed',
                          minWidth: 58,
                        }}>
                          {saving === s.id ? '保存中' : '保存'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))
      )}

      {dirty && (
        <button onClick={resetAll} style={{
          width: '100%', marginTop: 22, padding: '12px',
          background: 'none', border: '1px solid #e5e7eb', borderRadius: 11,
          fontSize: 13, color: '#6b7280', cursor: 'pointer',
        }}>放弃所有修改</button>
      )}
    </div>
  )
}