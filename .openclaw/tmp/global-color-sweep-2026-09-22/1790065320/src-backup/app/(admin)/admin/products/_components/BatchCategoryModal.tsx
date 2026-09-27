// v0.8.68.1 - 批量改分类弹窗
'use client'
import { useState } from 'react'
import { useToast } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { colors, fontSize, fontWeight, radius, spacing } from '@/lib/design-tokens'
import type { Category } from './types'

interface Props {
  count: number
  categories: Category[]
  onClose: () => void
  onDone: (label: string) => void
  ids: string[]
}

export function BatchCategoryModal({ count, categories, onClose, onDone, ids }: Props) {
  const toast = useToast()
  const [cat, setCat] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!cat.trim()) { toast.toast('请输入或选择分类', 'err'); return }
    setBusy(true)
    try {
      const r = await fetch('/api/admin/products/batch-category', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, category: cat.trim(), categoryLabel: cat.trim() }),
      })
      const d = await r.json()
      if (d.success) onDone(cat.trim())
      else toast.toast(d.error || '失败', 'err')
    } catch (e: any) {
      toast.toast(e.message, 'err')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={`批量改分类 (${count} 件)`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button variant="primary" onClick={submit} loading={busy}>确认改 {count} 件</Button>
        </>
      }
    >
      <div style={{ marginBottom: spacing[5] }}>
        <div style={{ fontSize: fontSize.xs, color: colors.textSubtle, marginBottom: 6 }}>
          现有分类 (点击选择)
        </div>
        <div style={{ display: 'flex', gap: spacing[2], flexWrap: 'wrap', maxHeight: 140, overflow: 'auto', padding: 4 }}>
          {categories.map((c) => (
            <button
              key={c.label}
              onClick={() => setCat(c.label)}
              aria-pressed={cat === c.label}
              style={{
                padding: '6px 12px',
                borderRadius: radius.lg,
                fontSize: fontSize.xs,
                cursor: 'pointer',
                fontFamily: 'inherit',
                background: cat === c.label ? colors.primaryBgLight : colors.bgHover,
                color: cat === c.label ? colors.primary : colors.textMuted,
                border: `1px solid ${cat === c.label ? colors.primaryBorder : colors.borderMuted}`,
                minHeight: 32,
              }}
            >
              {c.label} ({c.count})
            </button>
          ))}
        </div>
      </div>
      <label style={{ display: 'block', fontSize: fontSize.xs, color: colors.textSubtle, marginBottom: 4 }}>
        或输入新分类
      </label>
      <input
        value={cat}
        onChange={(e) => setCat(e.target.value)}
        placeholder="例:心脑血管保健"
        style={{
          width: '100%',
          minHeight: 44,
          padding: '10px 14px',
          borderRadius: radius.lg,
          background: colors.bgInput,
          border: `1px solid ${colors.borderMuted}`,
          color: colors.text,
          fontSize: fontSize.md,
          fontFamily: 'inherit',
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
    </Modal>
  )
}
