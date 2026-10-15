/**
 * UI Bus · 轻量级全局 UI 事件总线
 * 提供 toast / confirm 两个方法，所有组件可全局调用
 * 替代浏览器原生 alert() / confirm()，统一 SaaS 主题
 */
import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'warn' | 'info'

export interface ToastItem {
  id: string
  type: ToastType
  message: string
  duration?: number  // ms, 0 = 不自动关
  createdAt: number
}

export interface ConfirmRequest {
  id: string
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  tone?: 'default' | 'danger'
  resolve: (ok: boolean) => void
}

interface UIBusState {
  toasts: ToastItem[]
  confirmReq: ConfirmRequest | null
  pushToast: (t: Omit<ToastItem, 'id' | 'createdAt'>) => string
  dismissToast: (id: string) => void
  requestConfirm: (req: Omit<ConfirmRequest, 'id' | 'resolve'>) => Promise<boolean>
  resolveConfirm: (ok: boolean) => void
}

let toastSeq = 0
let confirmSeq = 0

export const useUIBus = create<UIBusState>((set, get) => ({
  toasts: [],
  confirmReq: null,

  pushToast: (t) => {
    const id = `t_${Date.now()}_${++toastSeq}`
    const item: ToastItem = { ...t, id, createdAt: Date.now() }
    set((s) => ({ toasts: [...s.toasts, item] }))
    const dur = t.duration ?? (t.type === 'error' ? 4500 : 3000)
    if (dur > 0) {
      setTimeout(() => {
        if (get().toasts.some((x) => x.id === id)) {
          set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }))
        }
      }, dur)
    }
    return id
  },

  dismissToast: (id) => {
    set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }))
  },

  requestConfirm: (req) => {
    return new Promise<boolean>((resolve) => {
      const id = `c_${Date.now()}_${++confirmSeq}`
      set({ confirmReq: { ...req, id, resolve } })
    })
  },

  resolveConfirm: (ok) => {
    const req = get().confirmReq
    if (req) {
      req.resolve(ok)
      set({ confirmReq: null })
    }
  },
}))

// ============================================
// 便捷调用 · 不需要 hook 直接 import
// ============================================
export const toast = {
  success: (message: string, duration?: number) =>
    useUIBus.getState().pushToast({ type: 'success', message, duration }),
  error: (message: string, duration?: number) =>
    useUIBus.getState().pushToast({ type: 'error', message, duration }),
  warn: (message: string, duration?: number) =>
    useUIBus.getState().pushToast({ type: 'warn', message, duration }),
  info: (message: string, duration?: number) =>
    useUIBus.getState().pushToast({ type: 'info', message, duration }),
}

export const confirmDialog = (
  message: string,
  opts?: { title?: string; confirmText?: string; cancelText?: string; tone?: 'default' | 'danger' }
) => useUIBus.getState().requestConfirm({ message, ...opts })

// 用于"必须在事件循环同步路径"的地方，例如非 async 函数里
export const confirmDialogSync = (
  message: string,
  onResult: (ok: boolean) => void,
  opts?: { title?: string; confirmText?: string; cancelText?: string; tone?: 'default' | 'danger' }
) => {
  useUIBus.getState().requestConfirm({ message, ...opts }).then(onResult)
}