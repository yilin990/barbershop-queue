'use client'

/**
 * useVoiceRecording - 录音 → 流式分块后端 STT (v6.2)
 *
 * v6.2 流式分块（奕霖 2026-07-31 18:43 "真实时"）：
 * - v6.9（奕霖 2026-07-31 23:14 反馈"语音识别好差，之前按住录音的很不错的"）：
 *   ⭐ 回到 v6.0 单段录音模式（不流式分块）：
 *   - chunkMs=0 → 单段录音（MediaRecorder.start() 不传 timeslice）
 *   - 录音停止后一次性 POST /api/transcribe（不走 /stream）
 *   - 接收完整 text → onFinalTranscript 一次性写入
 *   **为什么**：v6.2 流式分块 + 6 字切句 把一个句子切碎成 3-5 段，识别精度明显下降
 *   **保留**：v6.3 iOS Safari mimeType + v6.7 input 不污染 + v6.8 chunkMs=0 默认
 * - 每个 chunk 立即 POST /api/transcribe/stream (后端累积 + whisper 转录)
 * - 服务端返回 delta (本次新增文字) + cumulative (累计文字)
 * - 用户看到 "我今天..." → "+早上" → "+有点头疼" 实时增量显示
 *
 * 真实时延迟（公网 zhilin.qingheos.cn）：
 * - 用户说话 → 第 1 个 chunk 完整 = 2s
 * - chunk 1 POST + 转录 + 返回 = ~1s
 * - 用户看到第一个字 = ~3s (但仍比单段 5-8s 好很多)
 * - 后续每 2s 看到增量
 *
 * v6.0/v6.1 历史：单 chunk + 等录音结束才上传
 *   - 用户开始录音 → 录 5s 停止 → 3s 转录 → 看到结果 = 8s+
 *   - 体验：黑盒等待
 *
 * v6.2 体验：
 *   - 用户开始录音 → 2s 后看到 "我今天" → +2s 看到 "早上" → ... 渐进显示
 *   - 用户感知的"实时感" = 2s
 *
 * v5.x 历史（Web Speech API 时代，已废弃）：v5.0 tap-to-toggle / v5.4 async restart / 全部失败
 */

import { useState, useRef, useCallback, useEffect } from 'react'

export type VoiceState = 'idle' | 'recording' | 'streaming' | 'processing' | 'too-short'

export interface UseVoiceRecordingOptions {
  /** 实时文字回调（每个 chunk 回来都触发，包含累计文字） */
  onTranscript?: (text: string, isDelta: boolean) => void
  /** 最终文字回调（用户停止录音后） */
  onFinalTranscript?: (text: string) => void
  /** 错误回调 */
  onError?: (message: string) => void
  disabled?: boolean
  /**
   * v6.9: chunk 大小（ms）
   * - 默认 0 → 单段录音（推荐，召回 v6.0 体验）
   * - > 0 → 流式分块（v6.2 模式，过时）
   */
  chunkMs?: number
}

export interface VoiceRecording {
  state: VoiceState
  /** 实时显示文字（累积所有 chunks 的结果） */
  interimText: string
  error: string | null
  start: () => Promise<void>
  stop: () => Promise<void>
  handleMove: (e: React.TouchEvent | React.MouseEvent) => void
  isSupported: boolean
}

interface StreamChunk {
  blob: Blob
  index: number
}

export function useVoiceRecording(opts: UseVoiceRecordingOptions = {}): VoiceRecording {
  const {
    onTranscript,
    onFinalTranscript,
    onError,
    disabled,
    chunkMs = 0,  // v6.9: 默认 0 = 单段录音
  } = opts

  const [state, setState] = useState<VoiceState>('idle')
  const [interimText, setInterimText] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const streamIdRef = useRef<string | null>(null)
  const chunkIndexRef = useRef<number>(0)
  const startTimeRef = useRef<number>(0)
  const cancelledRef = useRef<boolean>(false)
  const busyRef = useRef<boolean>(false)
  const inflightRef = useRef<boolean>(false)
  const pendingStopRef = useRef<boolean>(false)
  const mimeTypeRef = useRef<string>('audio/webm')
  const accumulatedBlobRef = useRef<Blob | null>(null)  // v6.9 单段模式累积

  const isSupported = typeof window !== 'undefined'
    && !!navigator.mediaDevices?.getUserMedia
    && typeof window.MediaRecorder !== 'undefined'

  // 释放 mic + mediaRecorder
  const cleanup = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop() } catch {}
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    mediaRecorderRef.current = null
  }, [])

  useEffect(() => {
    return cleanup
  }, [cleanup])

  /**
   * v6.9：发送最终录音到转录服务
   * - chunkMs=0 (默认) → 单段模式（POST /api/transcribe）
   * - chunkMs>0 → 流式模式（POST /api/transcribe/stream）— v6.2 模式，不推荐
   */
  const sendFinal = useCallback(async (blob: Blob) => {
    setState('processing')
    const ext = mimeTypeRef.current.includes('mp4') ? 'mp4' : 'webm'
    const formData = new FormData()
    formData.append('audio', blob, `recording.${ext}`)

    try {
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()

      if (!res.ok || data.error) {
        throw new Error(data.error || `HTTP ${res.status}`)
      }

      const text = (data.text || '').trim()
      if (text) {
        onFinalTranscript?.(text)
      }
      setInterimText('')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[VoiceRecording v6.9] single-shot STT failed:', msg)
      setError(msg)
      onError?.(msg)
    } finally {
      setState('idle')
    }
  }, [onFinalTranscript, onError])

  /**
   * 保留 v6.2 流式分块逻辑（不以 chunkMs=0 走）
   * 仅为兼容旧代码，仅在 chunkMs>0 时才用
   */
  const sendChunk = useCallback(async (blob: Blob, index: number, isFinal: boolean) => {
    if (!streamIdRef.current) return
    const streamId = streamIdRef.current

    // 等上一个 chunk 完成 (简单互斥)
    while (inflightRef.current) {
      await new Promise(r => setTimeout(r, 50))
    }
    inflightRef.current = true

    try {
      const ext = mimeTypeRef.current.includes('mp4') ? 'mp4' : 'webm'
      const formData = new FormData()
      formData.append('audio', blob, `chunk_${index}.${ext}`)
      formData.append('stream_id', streamId)
      formData.append('chunk_index', String(index))
      formData.append('is_final', String(isFinal))

      const res = await fetch('/api/transcribe/stream', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()

      if (!res.ok || data.error) {
        throw new Error(data.error || `HTTP ${res.status}`)
      }

      const delta = data.delta || ''
      const cumulative = data.cumulative || ''

      // ⭐ v6.7（奕霖 2026-07-31 22:39 反馈"不说话自己会有字"）：
      // 删掉实时 setInterimText + onTranscript 实时写入 — 会让 input 实时被污染
      // 改为只在 isFinal（录音停止）时一次性 onFinalTranscript 写入 input
      if (isFinal) {
        // 最终结果触发 onFinalTranscript（用于写到 input）
        onFinalTranscript?.(cumulative || interimText)
        // isFinal 后清空 interimText — 录音结束不需要保留中间状态
        setInterimText('')
      } else if (cumulative) {
        // ⭐ v6.7 改为：只更新内部 interimText（不写到 input），仅给 VoiceOverlay 内部显示用
        // 这样 VoiceOverlay 实时有反馈，但 input 不会被污染
        setInterimText(cumulative)
      }
      // delta 不再触发 onTranscript — 避免实时写入 input
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[VoiceRecording v6.2] chunk ${index} error:`, msg)
      // 流式转录错误不中断 — 让用户继续录音
    } finally {
      inflightRef.current = false
    }
  }, [onTranscript, onFinalTranscript, interimText])

  const start = useCallback(async () => {
    if (disabled || busyRef.current) return
    if (!isSupported) {
      const msg = '您的浏览器不支持录音'
      setError(msg)
      onError?.(msg)
      return
    }

    cleanup()
    setError(null)
    setInterimText('')
    cancelledRef.current = false
    pendingStopRef.current = false
    chunkIndexRef.current = 0
    streamIdRef.current = null
    busyRef.current = true

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      })
      streamRef.current = stream

      // ⭐ v6.3（奕霖 2026-07-31 19:25 手机端优化）mimeType 优先级调整：
      // - iOS Safari 不支持 audio/webm（任何变种），只支持 audio/mp4 (iOS 14.1+)
      // - iOS Safari mp4 编码使用 AAC-LC，文件比 webm 更大 → 上传慢 30%+
      // - Chrome/Edge 优先 webm;codecs=opus（最小）
      // - 策略：检测 Safari UA 优先 mp4，其他浏览器优先 opus webm
      const isSafari = typeof navigator !== 'undefined'
        && /Safari/.test(navigator.userAgent)
        && !/Chrome|CriOS|FxiOS|EdgiOS/.test(navigator.userAgent)
      const candidates = isSafari
        ? ['audio/mp4;codecs=mp4a.40.2', 'audio/mp4']
        : ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
      const mimeType = candidates.find(t => MediaRecorder.isTypeSupported(t)) || ''
      mimeTypeRef.current = mimeType || 'audio/webm'

      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined
      )
      mediaRecorderRef.current = recorder

      // 第一个 ondataavailable 时创建 stream_id
      // ⭐ v6.9: chunkMs=0 (单段模式) → 不实时发送 chunk，攒到 stop 后一次性发送
      recorder.ondataavailable = async (e) => {
        if (e.data.size === 0) return

        // v6.9 单段模式（chunkMs=0）：只累积，不发送
        if (chunkMs === 0) {
          // 累积 chunk blob
          if (accumulatedBlobRef.current) {
            accumulatedBlobRef.current = new Blob(
              [accumulatedBlobRef.current, e.data],
              { type: mimeTypeRef.current }
            )
          } else {
            accumulatedBlobRef.current = e.data
          }
          return
        }

        // v6.2 流式模式（chunkMs>0）：逐 chunk POST
        // 第一个 chunk: 创建 stream_id
        if (!streamIdRef.current) {
          streamIdRef.current = `stream_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
        }

        const idx = chunkIndexRef.current++
        const isFinal = pendingStopRef.current && idx === chunkIndexRef.current - 1

        await sendChunk(e.data, idx, isFinal)
      }

      recorder.onstop = async () => {
        streamRef.current?.getTracks().forEach(track => track.stop())
        streamRef.current = null
        mediaRecorderRef.current = null

        // 用户取消
        if (cancelledRef.current) {
          busyRef.current = false
          setState('idle')
          setInterimText('')
          accumulatedBlobRef.current = null
          return
        }

        // v6.9 单段模式：stop 后一次性 POST /api/transcribe
        if (chunkMs === 0 && accumulatedBlobRef.current) {
          const finalBlob = accumulatedBlobRef.current
          accumulatedBlobRef.current = null
          await sendFinal(finalBlob)
          busyRef.current = false
          setState('idle')
          return
        }

        // v6.2 流式模式：等所有 inflight 请求完成
        while (inflightRef.current) {
          await new Promise(r => setTimeout(r, 50))
        }

        busyRef.current = false
        setState('idle')
      }

      // v6.9: chunkMs=0 → start() 不传 timeslice → 单段录音（stop 后一次性拿到 blob）
      //         chunkMs>0 → 保持 v6.2 流式（not recommended）
      if (chunkMs > 0) {
        recorder.start(chunkMs)
      } else {
        recorder.start()
      }
      startTimeRef.current = Date.now()
      setState('recording')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[VoiceRecording v6.2] start failed:', err)
      const friendly = /permission|not-allowed|denied/i.test(msg)
        ? '麦克风权限被拒绝，请在浏览器设置中允许'
        : `录音启动失败：${msg}`
      setError(friendly)
      busyRef.current = false
      setState('idle')
      onError?.(msg)
      cleanup()
    }
  }, [disabled, isSupported, cleanup, onTranscript, onError, sendChunk, sendFinal, chunkMs])

  const stop = useCallback(async () => {
    if (state !== 'recording') return
    if (!mediaRecorderRef.current) return

    pendingStopRef.current = true
    setState('processing')
    mediaRecorderRef.current.stop()
  }, [state])

  const handleMove = useCallback((_e: React.TouchEvent | React.MouseEvent) => {
    // v6.2 简化: 不用滑动取消（保持简单）
  }, [])

  return {
    state,
    interimText,
    error,
    start,
    stop,
    handleMove,
    isSupported,
  }
}
