'use client'
import { useState, useEffect, useCallback, ReactNode, createContext, useContext } from 'react'
import { colors, fontSize, fontWeight, radius, spacing, zIndex, animation } from '@/lib/design-tokens'
import { CheckCircle2, XCircle, Info, AlertTriangle } from 'lucide-react'

export type ToastType = 'ok' | 'err' | 'warn' | 'info'

interface ToastItem {
  id: number
  msg: string
  type: ToastType
  duration?: number
}

interface ToastCtx {
  toast: (msg: string, type?: ToastType, duration?: number) => void
}

const Ctx = createContext<ToastCtx>({ toast: () => {} })

export function useToast() {
  return useContext(Ctx)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const toast = useCallback((msg: string, type: ToastType = 'ok', duration = 2500) => {
    const id = Date.now() + Math.random()
    setItems((prev) => [...prev, { id, msg, type, duration }])
    setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id))
    }, duration)
  }, [])

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div
        aria-live="polite"
        style={{
          position: 'fixed',
          top: spacing[5],
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: zIndex.toast,
          display: 'flex',
          flexDirection: 'column',
          gap: spacing[2],
          pointerEvents: 'none',
        }}
      >
        {items.map((t) => (
          <ToastView key={t.id} item={t} />
        ))}
      </div>
    </Ctx.Provider>
  )
}

const typeMap: Record<ToastType, { bg: string; color: string; icon: ReactNode }> = {
  ok: { bg: colors.primaryBg, color: colors.primaryDeep, icon: <CheckCircle2 size={18} /> },
  err: { bg: colors.dangerBg, color: colors.danger, icon: <XCircle size={18} /> },
  warn: { bg: colors.amberBg, color: colors.amber, icon: <AlertTriangle size={18} /> },
  info: { bg: colors.purpleBg, color: colors.purple, icon: <Info size={18} /> },
}

function ToastView({ item }: { item: ToastItem }) {
  const v = typeMap[item.type]
  return (
    <div
      role="status"
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: `${spacing[3]} ${spacing[7]}`,
        borderRadius: radius.lg,
        background: v.bg,
        color: v.color,
        fontSize: fontSize.sm,
        fontWeight: fontWeight.semibold,
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        animation: 'qinghe-slide-down 0.3s ease',
        pointerEvents: 'auto',
        backdropFilter: 'blur(8px)',
        border: `1px solid ${v.color}33`,
      }}
    >
      {v.icon}
      <span>{item.msg}</span>
    </div>
  )
}