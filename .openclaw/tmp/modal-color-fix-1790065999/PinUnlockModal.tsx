'use client'

/**
 * ⭐ 2026-09-20 14:26 奕霖立：PIN 解锁弹窗（开启店长模式时）
 *
 * 流程：
 *   - 输入 4 位 PIN → 自动验证
 *   - 错误提示 + 倒计时
 *   - 5 次错误锁 1 分钟
 */

import React, { useState } from 'react'
import { PinKeypad, PinDots } from './PinKeypad'
import {
  verifyPin, recordError, clearErrors, isErrorLocked,
  getErrorLockRemainingMs, setLastAuthTime,
} from '@/lib/manager-auth'

interface PinUnlockModalProps {
  t: any
  onClose: () => void
  onSuccess: () => void
}

export function PinUnlockModal({ t, onClose, onSuccess }: PinUnlockModalProps) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [lockedMs, setLockedMs] = useState(getErrorLockRemainingMs())
  const [_, force] = useState(0)

  // 每秒刷新倒计时
  React.useEffect(() => {
    if (lockedMs <= 0) return
    const timer = setInterval(() => {
      const remain = getErrorLockRemainingMs()
      setLockedMs(remain)
      if (remain <= 0) {
        clearErrors()
        force(x => x + 1)
      }
    }, 1000)
    return () => clearInterval(timer)
  }, [lockedMs > 0])

  async function tryUnlock(v: string) {
    if (busy) return
    if (isErrorLocked()) {
      const remain = getErrorLockRemainingMs()
      setLockedMs(remain)
      return
    }
    setBusy(true)
    setError('')
    const ok = await verifyPin(v)
    if (ok) {
      clearErrors()
      setLastAuthTime()
      onSuccess()
      onClose()
      return
    }
    // 失败处理
    const state = recordError()
    setPin('')
    if (state.lockedUntil) {
      setLockedMs(ERROR_LOCK_MS)
      setError('错误次数过多，已锁定 1 分钟')
    } else {
      setError(`PIN 错误，还剩 ${5 - state.count} 次机会`)
    }
    setBusy(false)
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(44, 24, 16, 0.65)',
        zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#faf6f0',
          borderRadius: 16,
          padding: 24,
          maxWidth: 380, width: '100%',
          boxShadow: '0 12px 48px rgba(44, 24, 16, 0.35)',
        }}
      >
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', marginBottom: 18,
        }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: t.text, margin: 0 }}>
            🔒 解锁店长模式
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none',
              fontSize: 22, color: t.textMuted, cursor: 'pointer',
            }}
          >×</button>
        </div>

        {lockedMs > 0 ? (
          <div style={{
            padding: '40px 20px', textAlign: 'center',
            background: '#fef2f2', borderRadius: 12,
            border: '1px solid #fecaca',
          }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>🔒</div>
            <div style={{ fontSize: 14, color: '#991b1b', fontWeight: 600, marginBottom: 4 }}>
              已锁定
            </div>
            <div style={{ fontSize: 13, color: '#991b1b' }}>
              还需等待 {Math.ceil(lockedMs / 1000)} 秒
            </div>
          </div>
        ) : (
          <>
            <p style={{
              fontSize: 12, color: t.textMuted,
              textAlign: 'center', margin: '0 0 14px',
            }}>
              输入 4 位 PIN 解锁
            </p>

            <PinDots length={4} value={pin} primary={t.primary} border={t.border} />

            <PinKeypad
              value={pin}
              onChange={setPin}
              onComplete={tryUnlock}
              primary={t.primary}
              primaryDark={t.primaryDark}
              text={t.text}
              textMuted={t.textMuted}
              bgDeep={t.bgDeep}
              border={t.border}
            />

            {error && (
              <div style={{
                marginTop: 14, padding: 10,
                background: '#fef2f2', color: '#991b1b',
                border: '1px solid #fecaca',
                borderRadius: 8, fontSize: 13, textAlign: 'center',
              }}>{error}</div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

const ERROR_LOCK_MS = 60 * 1000