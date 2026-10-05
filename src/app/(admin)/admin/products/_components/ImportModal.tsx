// v0.8.68.1 - xlsx 表格导入弹窗
'use client'
import { useState } from 'react'
import { useToast } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { colors, fontSize, fontWeight, radius, spacing } from '@/lib/design-tokens'
import { Upload, FileSpreadsheet } from 'lucide-react'

interface Props {
  onClose: () => void
  onDone: () => void
}

export function ImportModal({ onClose, onDone }: Props) {
  const toast = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<any>(null)

  const submit = async () => {
    if (!file) return
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const r = await fetch('/api/admin/products/import', {
        method: 'POST',
        credentials: 'include',
        body: fd,
      })
      const d = await r.json()
      if (d.success) {
        setResult(d)
        toast.toast(`✅ 导入完成:新建 ${d.created} / 更新 ${d.updated}`, 'ok')
        setTimeout(onDone, 2000)
      } else {
        toast.toast(d.error || '失败', 'err')
      }
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
      title="📥 表格导入 (.xlsx)"
      footer={
        result ? (
          <Button variant="primary" onClick={onClose}>完成</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>取消</Button>
            <Button variant="primary" onClick={submit} loading={busy} disabled={!file}>
              开始导入
            </Button>
          </>
        )
      }
    >
      <div style={{ fontSize: fontSize.xs, color: colors.textSubtle, marginBottom: spacing[5] }}>
        从收银系统导出 xlsx → 上传 → 按 productCode 匹配已有商品 (更新价格/库存) 或新建
      </div>

      <label style={{
        display: 'block',
        padding: spacing[9],
        border: `2px dashed ${colors.purpleBorder}`,
        borderRadius: radius.xl,
        textAlign: 'center',
        cursor: 'pointer',
        background: colors.purpleBg,
      }}>
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          style={{ display: 'none' }}
        />
        {file ? (
          <div>
            <FileSpreadsheet size={40} color={colors.purple} />
            <div style={{ fontSize: fontSize.base, color: colors.purple, marginTop: spacing[3], fontWeight: fontWeight.semibold }}>
              {file.name}
            </div>
            <div style={{ fontSize: fontSize.xs, color: colors.textMuted }}>
              {(file.size / 1024).toFixed(1)} KB
            </div>
          </div>
        ) : (
          <div>
            <Upload size={40} color={colors.purple} />
            <div style={{ fontSize: fontSize.base, color: colors.textMuted, marginTop: spacing[3] }}>
              点击选择 xlsx 文件
            </div>
            <div style={{ fontSize: fontSize.xs, color: colors.textMuted }}>
              需含列:productCode / name / price / stock
            </div>
          </div>
        )}
      </label>

      {result && (
        <div style={{
          marginTop: spacing[5],
          padding: spacing[5],
          borderRadius: radius.lg,
          background: colors.primaryBgSubtle,
          border: `1px solid ${colors.primaryBorder}`,
        }}>
          <div style={{ fontSize: fontSize.sm, color: colors.primary, fontWeight: fontWeight.semibold, marginBottom: spacing[2] }}>
            ✅ 导入完成
          </div>
          <div style={{ fontSize: fontSize.xs, color: colors.textMuted, lineHeight: 1.8 }}>
            · 总数:{result.total}<br />
            · 新建:{result.created}<br />
            · 更新:{result.updated}<br />
            · 跳过:{result.skipped}
          </div>
        </div>
      )}
    </Modal>
  )
}
