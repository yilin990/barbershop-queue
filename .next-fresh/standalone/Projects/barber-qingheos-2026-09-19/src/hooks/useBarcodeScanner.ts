'use client'

import { useEffect, useRef } from 'react'

/**
 * ⭐ 奕霖 2026-08-01 22:52 — 扫描枪工作流
 *
 * 为什么不用相机了：iOS Safari 17+ getUserMedia 在 user gesture 链里调用限制，
 * 仓库/门店用场景 1 次 = 失败 2 次原则停止硬扛。改走扫描枪 = 纯键盘事件，
 * 100+ 次/分钟，完全绕开相机 + iOS 限制。
 *
 * 工作原理：
 * - 扫描枪 = USB/蓝牙键盘模式，扫码后快速输出字符串 + Enter/Tab
 * - 人手打字间隔 150-300ms；扫描枪间隔 < 50ms（业界公认）
 * - 检测到"快速输入 + Enter/Tab 结尾" → 触发 onScan(code)
 * - 输入框/文本域焦点时不触发（避免误捕）
 */

interface UseBarcodeScannerOptions {
  /** 扫到条码回调 */
  onScan: (code: string) => void
  /** 是否启用（false 时不监听） */
  enabled?: boolean
  /** 字符间隔阈值（ms），默认 50ms */
  charIntervalMs?: number
  /** 最短条码长度（默认 6 位） */
  minLength?: number
  /** 结束符，默认 ['Enter', 'Tab'] */
  terminators?: string[]
}

export function useBarcodeScanner({
  onScan,
  enabled = true,
  charIntervalMs = 50,
  minLength = 6,
  terminators = ['Enter', 'Tab'],
}: UseBarcodeScannerOptions) {
  const bufferRef = useRef<string>('')
  const lastKeyTimeRef = useRef<number>(0)
  const onScanRef = useRef(onScan)

  // 保持 ref 最新（避免 effect 依赖变化）
  useEffect(() => {
    onScanRef.current = onScan
  }, [onScan])

  useEffect(() => {
    if (!enabled) return

    const handler = (e: KeyboardEvent) => {
      // ⭐ 焦点在输入控件时不触发（用户在打字）
      const target = e.target as HTMLElement
      if (target) {
        const tag = target.tagName?.toUpperCase()
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
        if (target.isContentEditable) return
      }

      const now = Date.now()
      const elapsed = now - lastKeyTimeRef.current
      const isFastInput = elapsed < charIntervalMs || lastKeyTimeRef.current === 0
      lastKeyTimeRef.current = now

      // 结束符 → 提交 buffer
      if (terminators.includes(e.key)) {
        const code = bufferRef.current.trim()
        if (code.length >= minLength && isFastInput) {
          e.preventDefault()
          onScanRef.current(code)
        }
        bufferRef.current = ''
        return
      }

      // 普通字符 → 加入 buffer
      if (e.key.length === 1) {
        // 第一次或快速输入才累积
        if (isFastInput) {
          bufferRef.current += e.key
        } else {
          // 慢速输入 → 重置（人手打字）
          bufferRef.current = e.key
        }
      }
    }

    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [enabled, charIntervalMs, minLength, terminators])
}
