'use client'
import { useState, useEffect, useRef } from 'react'
import { ScanBarcode, X, Camera, Zap } from 'lucide-react'
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser'
import { colors, radius, spacing, fontSize, fontWeight, zIndex } from '@/lib/design-tokens'

interface BarcodeScannerProps {
  onDetected: (code: string) => void
  /** 关闭 */
  onClose: () => void
}

/**
 * 条码扫描组件
 * - 优先用 BarcodeDetector API (Chrome/Edge)
 * - 降级用手动输入 (所有浏览器)
 * - 优先 EAN-13 / EAN-8 / Code-128 / QR
 */
export function BarcodeScanner({ onDetected, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)
  // ⭐ 奕霖 2026-08-01 22:13 反馈："扫码用不了摄像头"
  // - iOS Safari 不支持原生 BarcodeDetector → 改用 @zxing/browser polyfill
  // - iOS Safari 17+ 相机调用必须在 user gesture 里 → 显式"开启摄像头"按钮触发
  const [mode, setMode] = useState<'native' | 'zxing' | 'none' | null>(null)
  const [cameraStarted, setCameraStarted] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const [torchOn, setTorchOn] = useState(false)
  const startCameraRef = useRef<(() => void) | null>(null)

  const startCamera = () => {
    setCameraStarted(true)
    // ⭐ 必须在用户手势内调（iOS Safari 17+ 强制）
    startCameraRef.current?.()
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    const hasNative = 'BarcodeDetector' in window
    let cleanup = () => {}
    let started = false

    // ⭐ 不在 effect 里启动相机，等用户点按钮（iOS Safari 17+ user gesture 要求）
    const tryStart = () => {
      if (started) return
      started = true
      _doStart()
    }

    function _doStart() {
    if (hasNative) {
      // ========== Chrome/Edge 原生 BarcodeDetector 路径（快）==========
      setMode('native')
      let stream: MediaStream | null = null
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let detector: any = null
      let interval: any = null

      ;(async () => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          detector = new (window as any).BarcodeDetector({
            formats: ['ean_13', 'ean_8', 'code_128', 'qr_code', 'code_39'],
          })

          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' },
            audio: false,
          })

          if (videoRef.current) {
            videoRef.current.srcObject = stream
            await videoRef.current.play()
          }

          interval = setInterval(async () => {
            if (!videoRef.current || !detector) return
            try {
              const barcodes = await detector.detect(videoRef.current)
              if (barcodes.length > 0) {
                const code = barcodes[0].rawValue
                if (code) {
                  onDetected(code)
                  cleanup()
                }
              }
            } catch {
              // 单次失败不报错，继续扫
            }
          }, 500)
        } catch (e: any) {
          setError(`摄像头无法启动：${e?.message || '未知错误'}`)
          setMode('none')
        }
      })()

      cleanup = () => {
        if (interval) clearInterval(interval)
        if (stream) stream.getTracks().forEach((t) => t.stop())
      }
    } else {
      // ========== iOS Safari / Firefox / 其他 → @zxing/browser polyfill ==========
      setMode('zxing')
      let controls: IScannerControls | null = null

      ;(async () => {
        try {
          const reader = new BrowserMultiFormatReader()
          if (videoRef.current) {
            controls = await reader.decodeFromVideoDevice(
              undefined,  // 默认摄像头（iPhone 后置）
              videoRef.current,
              (result, err, c) => {
                if (result) {
                  onDetected(result.getText())
                  c.stop()
                  cleanup()
                }
                // err 是常见 ZXing 噪音（NotFoundException = 帧里没找到），忽略
              }
            )
          }
        } catch (e: any) {
          setError(`摄像头无法启动：${e?.message || '未知错误'}（请检查相机权限）`)
          setMode('none')
        }
      })()

      cleanup = () => {
        if (controls) {
          try { controls.stop() } catch {}
        }
      }
    }
    }

    // 注册到 ref，等用户点"开启摄像头"按钮
    startCameraRef.current = tryStart

    // 组件卸载时如果还没启动就不需要 cleanup
    return () => {
      startCameraRef.current = null
      cleanup()
    }
  }, [onDetected])

  const submitManual = () => {
    if (manualCode.trim()) {
      onDetected(manualCode.trim())
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.85)',
        zIndex: zIndex.modal,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing[5],
      }}
    >
      <div
        style={{
          background: colors.bgPrimary,
          borderRadius: radius.xxl,
          padding: spacing[7],
          width: '100%',
          maxWidth: 480,
          border: `1px solid ${colors.border}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[5] }}>
          <h3 style={{ margin: 0, fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text, display: 'flex', alignItems: 'center', gap: 8 }}>
            <ScanBarcode size={20} color={colors.primary} />
            扫描商品条码
          </h3>
          <button
            onClick={onClose}
            aria-label="关闭扫描"
            style={{ background: 'transparent', border: 'none', color: colors.textSubtle, cursor: 'pointer', padding: 8 }}
          >
            <X size={20} />
          </button>
        </div>

        {!cameraStarted && mode && mode !== 'none' && (
          <div style={{
            aspectRatio: '4/3',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.6)',
            borderRadius: radius.lg,
            marginBottom: spacing[5],
            border: `1px dashed ${colors.primary}`,
            gap: spacing[3],
          }}>
            <Camera size={48} color={colors.primary} />
            <button
              type="button"
              onClick={startCamera}
              style={{
                minHeight: 48,
                padding: `${spacing[3]} ${spacing[6]}`,
                background: colors.primary,
                color: colors.bgPrimary,
                border: 'none',
                borderRadius: radius.base,
                fontSize: fontSize.base,
                fontWeight: fontWeight.bold,
                cursor: 'pointer',
              }}
            >
              📷 开启摄像头扫描
            </button>
            <div style={{ fontSize: fontSize.xs, color: colors.textSubtle, textAlign: 'center', lineHeight: 1.6 }}>
              iPhone 需要点上面按钮授权摄像头权限<br/>（Android Chrome 自动弹权限框）
            </div>
          </div>
        )}

        {cameraStarted && mode && mode !== 'none' && (
          <div
            style={{
              position: 'relative',
              background: '#000',
              borderRadius: radius.lg,
              overflow: 'hidden',
              marginBottom: spacing[5],
              aspectRatio: '4/3',
            }}
          >
            <video
              ref={videoRef}
              playsInline
              muted
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            {/* 扫描框 */}
            <div
              style={{
                position: 'absolute',
                top: '20%',
                left: '15%',
                right: '15%',
                bottom: '20%',
                border: `3px solid ${colors.primary}`,
                borderRadius: radius.base,
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.4)',
                pointerEvents: 'none',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: 0,
                right: 0,
                height: 2,
                background: colors.primary,
                animation: 'scanLine 2s linear infinite',
              }}
            />
            {torchOn && (
              <div style={{ position: 'absolute', top: 8, right: 8, color: '#facc15', display: 'flex', alignItems: 'center', gap: 4, fontSize: fontSize.xs }}>
                <Zap size={14} /> 手电筒已开
              </div>
            )}
          </div>
        )}

        {error && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: radius.base,
              padding: spacing[4],
              marginBottom: spacing[5],
              color: '#ef4444',
              fontSize: fontSize.sm,
            }}
          >
            {error}
          </div>
        )}

        {/* 手动输入兜底 */}
        <div>
          <label style={{ display: 'block', fontSize: fontSize.sm, color: colors.textSubtle, marginBottom: spacing[2] }}>
            {mode && mode !== 'none' ? '或手动输入条码：' : '请输入条码：'}
          </label>
          <div style={{ display: 'flex', gap: spacing[2] }}>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitManual()}
              placeholder="例：6901028001234"
              autoFocus={mode === 'none'}
              style={{
                flex: 1,
                minHeight: 44,
                padding: spacing[4],
                fontSize: fontSize.base,
                fontFamily: 'monospace',
                background: colors.bgInput,
                border: `1px solid ${colors.border}`,
                borderRadius: radius.base,
                color: colors.text,
                outline: 'none',
              }}
            />
            <button
              onClick={submitManual}
              disabled={!manualCode.trim()}
              style={{
                minHeight: 44,
                padding: `${spacing[2]} ${spacing[5]}`,
                background: manualCode.trim() ? colors.primary : colors.bgHover,
                color: manualCode.trim() ? colors.bgPrimary : colors.textFaint,
                border: 'none',
                borderRadius: radius.base,
                fontSize: fontSize.sm,
                fontWeight: fontWeight.semibold,
                cursor: manualCode.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              查询
            </button>
          </div>
        </div>

        <div style={{ marginTop: spacing[5], fontSize: fontSize.xs, color: colors.textFaint, textAlign: 'center' }}>
          📷 将条码对准扫描框，自动识别 · 或手动输入 13 位数字条码
        </div>
      </div>

      <style>{`
        @keyframes scanLine {
          0% { transform: translateY(-100%); opacity: 1; }
          50% { opacity: 1; }
          100% { transform: translateY(100%); opacity: 1; }
        }
      `}</style>
    </div>
  )
}