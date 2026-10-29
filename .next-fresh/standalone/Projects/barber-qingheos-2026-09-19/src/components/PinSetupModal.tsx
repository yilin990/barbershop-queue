'use client'

/**
 * ⭐ 2026-09-20 14:26 奕霖立：PIN 设置 / 修改 PIN 弹窗
 *
 * 流程：
 *   Setup mode: step1 输入 PIN → step2 确认 PIN → step3 锁定时长 → 完成
 *   Change mode: step0 验证旧 PIN → step1 输入新 PIN → step2 确认新 PIN → step3 新锁定时长 → 完成
 */

import React, { useState, useEffect } from 'react'
import { PinKeypad, PinDots } from './PinKeypad'
import {
  savePin, changePin, verifyPin, clearErrors,
} from '@/lib/manager-auth'

interface PinSetupModalProps {
  t: any
  onClose: () => void
  /** true = 首次设置；false = 修改 PIN（需验证旧 PIN） */
  isFirstTime?: boolean
  onSuccess?: () => void
}

type Step = 'input' | 'confirm' | 'old'

export function PinSetupModal({ t, onClose, isFirstTime = false, onSuccess }: PinSetupModalProps) {
  const [step, setStep] = useState<Step>(isFirstTime ? 'input' : 'old')
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [oldPin, setOldPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function reset() {
    setPin(''); setConfirmPin(''); setOldPin(''); setError(''); setBusy(false)
    setStep(isFirstTime ? 'input' : 'old')
  }

  async function handleComplete(v: string) {
    setError('')
    if (step === 'old') {
      setBusy(true)
      const ok = await verifyPin(v)
      setBusy(false)
      if (!ok) {
        setError('旧 PIN 错误，请重试')
        setOldPin('')
        return
      }
      setOldPin(v)
      setStep('input')
    } else if (step === 'input') {
      setPin(v)
      setStep('confirm')
    } else if (step === 'confirm') {
      if (v !== pin) {
        setError('两次输入不一致，请重试')
        setConfirmPin('')
        return
      }
      // ⭐ 2026-10-01 19:39 奕霖拍板：不再选时长，直接保存（永久有效）
      finalizeSave()
    }
  }

  async function handleSubmit() {
    if (step === 'input' && pin.length === 4) {
      setStep('confirm')
      return
    }

  }

  // ⭐ 2026-10-01 19:39 奕霖拍板：保存 PIN，永久有效（无时长）
  async function finalizeSave() {
    setBusy(true)
    try {
      // 永久有效：lockDuration = Number.MAX_SAFE_INTEGER
      const PERMANENT = Number.MAX_SAFE_INTEGER
      if (isFirstTime) {
        await savePin(pin, PERMANENT)
      } else {
        const ok = await changePin(oldPin, pin, PERMANENT)
        if (!ok) {
          setError('修改失败，请重试')
          setBusy(false)
          reset()
          return
        }
      }
      clearErrors()
      onSuccess?.()
      onClose()
    } catch (e: any) {
      setError(e?.message || '保存失败')
    } finally {
      setBusy(false)
    }
  }

  const stepTitle = isFirstTime
    ? (step === 'input' ? '设置 PIN' : '确认 PIN')
    : (step === 'old' ? '验证旧 PIN' : step === 'input' ? '输入新 PIN' : '确认新 PIN')

  const currentValue = step === 'old' ? oldPin : step === 'input' ? pin : confirmPin
  const setCurrentValue = step === 'old' ? setOldPin : step === 'input' ? setPin : setConfirmPin

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
            🔑 {stepTitle}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none',
              fontSize: 22, color: t.textMuted, cursor: 'pointer',
            }}
          >×</button>
        </div>

        <>
            <p style={{
              fontSize: 12, color: t.textMuted,
              textAlign: 'center', margin: '0 0 14px',
            }}>
              {step === 'old' && '输入当前 4 位 PIN 验证身份'}
              {step === 'input' && '请输入新的 4 位数字 PIN'}
              {step === 'confirm' && '再次输入以确认'}
            </p>

            <PinDots length={4} value={currentValue} primary={t.primary} border={t.border} />

            <PinKeypad
              value={currentValue}
              onChange={setCurrentValue}
              onComplete={handleComplete}
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

        <p style={{
          marginTop: 14, fontSize: 11,
          color: t.textMuted, textAlign: 'center',
        }}>
          PIN 经过 SHA-256 哈希存储，不会明文保存
        </p>
      </div>
    </div>
  )
}