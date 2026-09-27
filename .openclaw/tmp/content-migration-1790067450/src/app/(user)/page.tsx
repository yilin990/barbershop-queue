'use client'

/**
 * 我的偏好编辑页 · 奕霖 2026-08-26
 *
 * 改动：
 * - 删掉"口味偏好"（用户不让填，写了也不准）
 * - 加"⭐ 我常买的"自动卡片：从订单历史算 Top 5，免用户手填
 * - 3 字段保留：性别 / 食物过敏 / 饮食习惯
 *
 * 目的：让 AI 从真实购买行为学习，而不是让用户自己说"我喜欢什么"。
 */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useUserStore } from '@/stores/userStore'
import FrequentItems from '@/components/FrequentItems'
import TasteChips from '@/components/TasteChips'

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
            color: '#0d1f17', fontSize: 14, fontWeight: 700,
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

      <div style={{ padding: '10px 16px 32px' }}>
        <div style={{
          background: 'rgba(184, 134, 11, 0.06)',
          border: '1px solid rgba(184, 134, 11, 0.15)',
          borderRadius: 14, padding: 16, marginBottom: 16, fontSize: 12.5,
          color: 'rgba(255,255,255,0.7)', lineHeight: 1.7,
        }}>
          💡 填写一次后，<span style={{ color: GREEN, fontWeight: 700 }}>果小蔬就不用再问这些了</span>。
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

          {/* ⭐ 2026-08-26 奕霖:口味跟过敏/慢病同一个滑动框 */}
          <Field label="口味偏好" hint="选一个，果小蔬下次按这个方向推荐">
            <TasteChips />
          </Field>

          {/* ⭐ 2026-08-26 奕霖:常买的也跟偏好一样进入滑动模块 */}
          <Field label="我常买的" hint="自动从订单历史算 Top 5">
            <FrequentItems phone={user?.phone} embedded />
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
            color: '#0d1f17', fontSize: 15, fontWeight: 700,
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
          }}>偏好已保存，果小蔬下次会按这些推荐 🌿</div>
        )}

        {/* ⭐ 2026-08-26 奕霖:常买的已整合进表单卡内 */}
        {/* 留空(原 FrequentItems 已移进表单里) */}
      </div>
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
    <div style={{ marginBottom: 18 }}>
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
