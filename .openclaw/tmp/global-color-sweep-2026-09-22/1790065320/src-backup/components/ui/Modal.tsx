'use client'
import { colors, fontSize, fontWeight, radius, spacing, zIndex, animation } from '@/lib/design-tokens'
import type { CSSProperties, ReactNode } from 'react'
import { X } from 'lucide-react'
import { Button } from './Button'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  footer?: ReactNode
  width?: number
  /**
   * mobileMode: 'sheet' (底部抽屉) | 'center' (居中弹窗) | 'auto' (移动端 sheet, 桌面 center)
   */
  mobileMode?: 'sheet' | 'center' | 'auto'
}

/**
 * 统一 Modal / Sheet
 * - 移动端 (< 768): 底部抽屉从底部滑出
 * - 桌面端: 居中弹窗
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width = 480,
  mobileMode = 'auto',
}: ModalProps) {
  if (!open) return null

  return (
    <>
      {/* 移动端：底部抽屉 */}
      <div className="qinghe-modal-mobile" style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        zIndex: zIndex.modal,
      }} onClick={onClose}>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? 'modal-title' : undefined}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            bottom: 0, left: 0, right: 0,
            maxHeight: '90vh',
            background: colors.bgSecondary,
            border: `1px solid ${colors.primaryBorder}`,
            borderRadius: `${radius.xxxl} ${radius.xxxl} 0 0`,
            padding: spacing[7],
            color: colors.text,
            fontFamily: '-apple-system, "PingFang SC", sans-serif',
            animation: 'qinghe-slide-up 0.3s ease',
            overflowY: 'auto',
            boxShadow: '0 -8px 32px rgba(0,0,0,0.5)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: spacing[7] }}>
            <div style={{ width: 40, height: 4, background: colors.borderMuted, borderRadius: 2, margin: '0 auto 12px' }} />
          </div>
          <div style={{ marginTop: -16 }}>
            {title && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[7] }}>
                <h3 id="modal-title" style={{ margin: 0, fontSize: fontSize.xl, fontWeight: fontWeight.bold }}>{title}</h3>
                <button onClick={onClose} aria-label="关闭" style={{ background: 'transparent', border: 'none', color: colors.textSubtle, cursor: 'pointer', padding: 4 }}>
                  <X size={20} />
                </button>
              </div>
            )}
            {children}
            {footer && <div style={{ marginTop: spacing[7], display: 'flex', gap: spacing[3], justifyContent: 'flex-end' }}>{footer}</div>}
          </div>
        </div>
      </div>

      {/* 桌面端：居中弹窗 */}
      <div className="qinghe-modal-desktop" style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        zIndex: zIndex.modal, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: spacing[7],
      }} onClick={onClose}>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? 'modal-title-desktop' : undefined}
          onClick={(e) => e.stopPropagation()}
          style={{
            background: colors.bgSecondary,
            border: `1px solid ${colors.primaryBorder}`,
            borderRadius: radius.xxxl,
            padding: spacing[7],
            width: '100%', maxWidth: width, maxHeight: '85vh', overflowY: 'auto',
            color: colors.text, fontFamily: '-apple-system, "PingFang SC", sans-serif',
            animation: 'qinghe-fade-in 0.2s ease',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}
        >
          {title && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[7] }}>
              <h3 id="modal-title-desktop" style={{ margin: 0, fontSize: fontSize.xl, fontWeight: fontWeight.bold }}>{title}</h3>
              <button onClick={onClose} aria-label="关闭" style={{ background: 'transparent', border: 'none', color: colors.textSubtle, cursor: 'pointer', padding: 4 }}>
                <X size={20} />
              </button>
            </div>
          )}
          {children}
          {footer && <div style={{ marginTop: spacing[7], display: 'flex', gap: spacing[3], justifyContent: 'flex-end' }}>{footer}</div>}
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 767px) {
          .qinghe-modal-desktop { display: none !important; }
        }
        @media (min-width: 768px) {
          .qinghe-modal-mobile { display: none !important; }
        }
      `}</style>
    </>
  )
}

interface ConfirmProps {
  open: boolean
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * 确认弹窗
 */
export function ConfirmDialog({ open, title, description, confirmText = '确认', cancelText = '取消', danger, onConfirm, onCancel }: ConfirmProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>{cancelText}</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>{confirmText}</Button>
        </>
      }
    >
      {description && <div style={{ fontSize: fontSize.sm, color: colors.textMuted, lineHeight: 1.6 }}>{description}</div>}
    </Modal>
  )
}