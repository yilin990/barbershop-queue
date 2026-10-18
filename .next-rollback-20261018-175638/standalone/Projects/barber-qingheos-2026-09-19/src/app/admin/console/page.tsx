'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface MerchantFull {
  id: string
  code: string
  name: string
  shortName: string | null
  logo: string | null
  phone: string | null
  address: string | null
  latitude: number | null
  longitude: number | null
  businessHours: string | null
  primaryColor: string | null
  accentColor: string | null
  pointsRate: number | null
  pointValue: number | null
  minPointsRedeem: number | null
  status: string
  createdAt: string
  updatedAt: string
}

interface Staff {
  id: string
  name: string
  role: string
  phone: string | null
  merchantId: string
}

type Tab = 'profile' | 'hours' | 'theme' | 'points'

export default function AdminConsolePage() {
  const router = useRouter()
  const [merchant, setMerchant] = useState<MerchantFull | null>(null)
  const [staff, setStaff] = useState<Staff | null>(null)
  const [tab, setTab] = useState<Tab>('profile')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [formData, setFormData] = useState<Partial<MerchantFull>>({})

  // 加载当前 staff + merchant
  useEffect(() => {
    fetch('/api/admin/auth/me')
      .then(r => r.json())
      .then(data => {
        if (!data.success) {
          router.replace('/admin/login?next=/admin/console')
          return
        }
        setStaff(data.staff)
      })
      .catch(() => router.replace('/admin/login?next=/admin/console'))
  }, [router])

  // 加载 merchant
  useEffect(() => {
    if (!staff) return
    fetch('/api/admin/merchant')
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setMerchant(data.merchant)
          setFormData(data.merchant)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [staff])

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 3000)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/merchant', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      const data = await res.json()
      if (data.success) {
        showToast('success', '✓ 保存成功')
        setMerchant({ ...merchant!, ...data.merchant })
      } else {
        showToast('error', data.error || '保存失败')
      }
    } catch (e: any) {
      showToast('error', '网络错误：' + (e?.message ?? 'unknown'))
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = async () => {
    await fetch('/api/admin/auth/logout', { method: 'POST' })
    router.replace('/admin/login')
  }

  const canEdit = staff?.role === 'owner' || staff?.role === 'manager'

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#2c1810', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div>加载中...</div>
      </div>
    )
  }

  if (!merchant) {
    return (
      <div style={{ minHeight: '100vh', background: '#2c1810', color: '#fff',
                    padding: 40 }}>
        <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center', paddingTop: 80 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🌿</div>
          <h2 style={{ color: '#C9A961', marginBottom: 8 }}>商户数据加载失败</h2>
          <p style={{ color: 'rgba(255,255,255,0.6)' }}>请刷新页面重试</p>
        </div>
      </div>
    )
  }

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'profile', label: '基本信息', icon: '🏪' },
    { id: 'hours', label: '营业时间', icon: '🕐' },
    { id: 'theme', label: '主题颜色', icon: '🎨' },
    { id: 'points', label: '积分规则', icon: '⭐' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#2c1810', color: '#fff',
                  fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{
        background: 'rgba(255,255,255,0.04)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        padding: '16px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 24 }}>🌿</span>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{merchant.name}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
              {staff?.name} · {staff?.role === 'owner' ? '店主' : staff?.role === 'manager' ? '经理' : '员工'} ·
              code: {merchant.code}
            </div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          style={{
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.2)',
            color: 'rgba(255,255,255,0.7)',
            padding: '8px 16px',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          登出
        </button>
      </div>

      {/* Tabs */}
      <div style={{
        background: 'rgba(255,255,255,0.02)',
        padding: '0 24px',
        display: 'flex',
        gap: 4,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              background: tab === t.id ? 'rgba(184, 134, 11, 0.1)' : 'transparent',
              border: 'none',
              borderBottom: tab === t.id ? '2px solid #b8860b' : '2px solid transparent',
              color: tab === t.id ? '#b8860b' : 'rgba(255,255,255,0.6)',
              padding: '14px 20px',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: tab === t.id ? 600 : 400,
              transition: 'all 0.2s',
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Main Content */}
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px' }}>
        {!canEdit && (
          <div style={{
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: 12,
            padding: '12px 16px',
            marginBottom: 24,
            color: '#b8860b',
            fontSize: 13,
          }}>
            ⚠️ 您是员工角色，只能查看，不能编辑。请联系店主/经理修改商户信息。
          </div>
        )}

        {/* Tab Content */}
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16,
          padding: 32,
        }}>
          {tab === 'profile' && (
            <ProfileTab formData={formData} setFormData={setFormData} canEdit={canEdit} />
          )}
          {tab === 'hours' && (
            <HoursTab formData={formData} setFormData={setFormData} canEdit={canEdit} />
          )}
          {tab === 'theme' && (
            <ThemeTab formData={formData} setFormData={setFormData} canEdit={canEdit} />
          )}
          {tab === 'points' && (
            <PointsTab formData={formData} setFormData={setFormData} canEdit={canEdit} />
          )}
        </div>

        {/* Save Button */}
        {canEdit && (
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              marginTop: 24,
              width: '100%',
              padding: '16px',
              background: saving
                ? 'rgba(184, 134, 11, 0.3)'
                : 'linear-gradient(135deg, #b8860b, #a88a45)',
              color: '#2c1810',
              border: 'none',
              borderRadius: 12,
              fontSize: 16,
              fontWeight: 700,
              cursor: saving ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {saving ? '保存中...' : '保存所有修改'}
          </button>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: 24,
          right: 24,
          background: toast.type === 'success' ? 'rgba(184, 134, 11, 0.95)' : 'rgba(239, 68, 68, 0.95)',
          color: '#2c1810',
          padding: '12px 20px',
          borderRadius: 12,
          fontSize: 14,
          fontWeight: 600,
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          zIndex: 100,
        }}>
          {toast.message}
        </div>
      )}
    </div>
  )
}

// ===== Tab Components =====

function ProfileTab({ formData, setFormData, canEdit }: any) {
  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 24, color: '#C9A961' }}>
        商家基本信息
      </h2>
      <Field label="商家全称" required>
        <input
          type="text"
          value={formData.name || ''}
          disabled={!canEdit}
          onChange={e => setFormData({ ...formData, name: e.target.value })}
          style={inputStyle(!canEdit)}
        />
      </Field>
      <Field label="商家简称">
        <input
          type="text"
          value={formData.shortName || ''}
          disabled={!canEdit}
          onChange={e => setFormData({ ...formData, shortName: e.target.value })}
          style={inputStyle(!canEdit)}
        />
      </Field>
      <Field label="联系电话">
        <input
          type="tel"
          value={formData.phone || ''}
          disabled={!canEdit}
          onChange={e => setFormData({ ...formData, phone: e.target.value })}
          style={inputStyle(!canEdit)}
        />
      </Field>
      <Field label="详细地址">
        <input
          type="text"
          value={formData.address || ''}
          disabled={!canEdit}
          onChange={e => setFormData({ ...formData, address: e.target.value })}
          style={inputStyle(!canEdit)}
        />
      </Field>
      <Field label="Logo URL">
        <input
          type="text"
          value={formData.logo || ''}
          disabled={!canEdit}
          onChange={e => setFormData({ ...formData, logo: e.target.value })}
          placeholder="https://..."
          style={inputStyle(!canEdit)}
        />
      </Field>
    </div>
  )
}

function HoursTab({ formData, setFormData, canEdit }: any) {
  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 24, color: '#C9A961' }}>
        营业时间
      </h2>
      <Field label="营业时间">
        <input
          type="text"
          value={formData.businessHours || ''}
          disabled={!canEdit}
          onChange={e => setFormData({ ...formData, businessHours: e.target.value })}
          placeholder="08:00-22:00"
          style={inputStyle(!canEdit)}
        />
      </Field>
      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 4 }}>
        格式：HH:MM-HH:MM（如 09:00-21:00）；下一步支持多时间段
      </p>
    </div>
  )
}

function ThemeTab({ formData, setFormData, canEdit }: any) {
  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 24, color: '#C9A961' }}>
        主题颜色
      </h2>
      <Field label="主色 (背景)">
        <ColorPicker
          value={formData.primaryColor || '#0A2818'}
          disabled={!canEdit}
          onChange={(v: string) => setFormData({ ...formData, primaryColor: v })}
        />
      </Field>
      <Field label="点缀色 (按钮/边框)">
        <ColorPicker
          value={formData.accentColor || '#C9A961'}
          disabled={!canEdit}
          onChange={(v: string) => setFormData({ ...formData, accentColor: v })}
        />
      </Field>
      <div style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12,
        padding: 20,
        marginTop: 16,
      }}>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>
          预览
        </div>
        <div style={{
          background: formData.primaryColor,
          border: `2px solid ${formData.accentColor}`,
          borderRadius: 12,
          padding: 16,
          color: formData.primaryColor === '#FFFFFF' || formData.primaryColor?.toLowerCase() === '#fff'
            ? '#000' : '#fff',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 14, marginBottom: 4 }}>{formData.name || '商家名称'}</div>
          <button style={{
            background: formData.accentColor,
            color: formData.primaryColor,
            border: 'none',
            padding: '6px 16px',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
          }}>
            主按钮
          </button>
        </div>
      </div>
    </div>
  )
}

function PointsTab({ formData, setFormData, canEdit }: any) {
  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 24, color: '#C9A961' }}>
        积分规则
      </h2>
      <Field label="积分获取比例 (元:积分)">
        <input
          type="number"
          step="0.01"
          value={formData.pointsRate ?? 0}
          disabled={!canEdit}
          onChange={e => setFormData({ ...formData, pointsRate: parseFloat(e.target.value) || 0 })}
          style={inputStyle(!canEdit)}
        />
      </Field>
      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 4 }}>
        每消费 1 元获得的积分（默认 0.05 = 5 积分）
      </p>
      <Field label="积分价值 (积分:元)">
        <input
          type="number"
          step="0.01"
          value={formData.pointValue ?? 0}
          disabled={!canEdit}
          onChange={e => setFormData({ ...formData, pointValue: parseFloat(e.target.value) || 0 })}
          style={inputStyle(!canEdit)}
        />
      </Field>
      <Field label="最低兑换积分">
        <input
          type="number"
          value={formData.minPointsRedeem ?? 0}
          disabled={!canEdit}
          onChange={e => setFormData({ ...formData, minPointsRedeem: parseInt(e.target.value) || 0 })}
          style={inputStyle(!canEdit)}
        />
      </Field>
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: any }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{
        display: 'block',
        color: 'rgba(255,255,255,0.7)',
        fontSize: 13,
        marginBottom: 6,
        fontWeight: 500,
      }}>
        {label}
        {required && <span style={{ color: '#f87171', marginLeft: 4 }}>*</span>}
      </label>
      {children}
    </div>
  )
}

function ColorPicker({ value, disabled, onChange }: any) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <input
        type="color"
        value={value}
        disabled={disabled}
        onChange={e => onChange(e.target.value)}
        style={{
          width: 48,
          height: 48,
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: 8,
          cursor: disabled ? 'not-allowed' : 'pointer',
          background: 'transparent',
        }}
      />
      <input
        type="text"
        value={value}
        disabled={disabled}
        onChange={e => onChange(e.target.value)}
        style={inputStyle(disabled, true)}
      />
    </div>
  )
}

function inputStyle(disabled: boolean, grow = false): React.CSSProperties {
  return {
    width: grow ? '100%' : '100%',
    padding: '12px 14px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    color: '#fff',
    fontSize: 14,
    outline: 'none',
    opacity: disabled ? 0.6 : 1,
    cursor: disabled ? 'not-allowed' : 'text',
    boxSizing: 'border-box',
  }
}
