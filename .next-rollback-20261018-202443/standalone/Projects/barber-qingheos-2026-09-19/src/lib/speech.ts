'use client'

/**
 * speech.ts - 语音相关（v6.4）
 *
 * v6.4（奕霖 2026-07-31 20:28 反馈"发语音转文字后 AI 回复没声音，但再次发就有声音"）：
 * - 根因：iOS Safari autoplay 严格，但 unlockAudioForMobile 只在 VoiceInput onClick 时调
 *   - 第一次发语音前没点话筒（直接打字或首次语音失败）→ unlock 没触发
 *   - audio.play() 被 iOS Safari 静默拒绝 → 文字回复没声音
 *   - 第二次点话筒触发 unlock → 后续 audio.play() 全部能播
 * - 修复：play() 失败时主动调 unlockAudioForMobile() 重新解锁 + retry
 *   不再依赖外部 onClick 时机，每次失败都重试解锁
 *
 * v6.3（奕霖 2026-07-31 19:25 反馈手机端问题）：
 * - 加 unlockAudioForMobile() 导出函数
 * - 在 AudioContext + 0.1s silent buffer 走过 audio graph 解锁 iOS Safari
 *
 * v4.6（奕霖 2026-07-31 01:55 反馈话筒/喇叭冲突）：
 * - 加 pauseAudio/resumeAudio（保留队列，录音结束恢复播放）
 *
 * v4.4（奕霖 2026-07-29 19:14 反馈 iOS Safari autoplay 失败）：
 * - play() reject retry 1→2，给 unlock/audio context 更多时间
 *
 * v4.3（奕霖 2026-07-29）：iOS Safari autoplay 失败 retry 计数器
 *
 * v4.0（奕霖 2026-07-03）：并行 fetch + 按入队顺序播放（解决 TTS 慢）
 *
 * v3.0（2026-06-30）：加内存缓存
 *
 * v2.0（2026-06-30）：改走 AudioQueueManager，stopAllAudio 统一打断
 */

import { useEffect } from 'react'

// ---------------------------------------------------------------------------
// 音频队列管理器（全局单例，支持打断、保证顺序）
// ---------------------------------------------------------------------------
class AudioQueueManager {
  private queue: string[] = []
  private isPlaying = false
  private currentAudio: HTMLAudioElement | null = null
  private onQueueEmpty: (() => void) | null = null
  private onSpeakingChange: ((speaking: boolean) => void) | null = null
  private pendingFetches: Array<Promise<string>> = []
  private retryCount = 0

  async enqueue(text: string): Promise<void> {
    if (!text.trim()) return
    const cleaned = text.trim().slice(0, 500)

    const cached = getCachedAudio(cleaned)
    if (cached) {
      this.queue.push(cached)
      if (!this.isPlaying) this.playNext()
      return
    }

    let voice = 'female-shaonv'
    let engine: 'minimax' | 'edge' = 'minimax'
    const speed = 1.2
    const pitch = 2
    if (typeof window !== 'undefined') {
      const sv = window.localStorage.getItem('zhilin_tts_voice')
      if (sv) voice = sv
    }
    const fetchPromise = (async () => {
      try {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: cleaned, voice, engine, speed, pitch, vol: 1.2 }),
        })
        if (!res.ok) {
          console.warn('[AudioQueue] TTS fetch failed:', res.status)
          return ''
        }
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        setCachedAudio(cleaned, url)
        return url
      } catch (err) {
        console.warn('[AudioQueue] enqueue error:', err)
        return ''
      }
    })()

    this.pendingFetches.push(fetchPromise)
    fetchPromise.then(async () => {
      while (this.pendingFetches[0] !== fetchPromise) {
        await new Promise(r => setTimeout(r, 5))
      }
      this.pendingFetches.shift()
      const url = await fetchPromise
      if (url) {
        this.queue.push(url)
        if (!this.isPlaying) this.playNext()
      }
    })
  }

  // 播放下一段
  private playNext(): void {
    if (this.paused) return
    if (this.queue.length === 0) {
      this.isPlaying = false
      this.onQueueEmpty?.()
      this.onSpeakingChange?.(false)
      return
    }

    this.isPlaying = true
    this.onSpeakingChange?.(true)

    const url = this.queue.shift()!
    this.currentAudio = new Audio(url)
    this.currentAudio.volume = 1.0

    this.currentAudio.onended = () => {
      URL.revokeObjectURL(url)
      this.currentAudio = null
      this.retryCount = 0
      setTimeout(() => this.playNext(), 80)
    }

    this.currentAudio.onerror = () => {
      URL.revokeObjectURL(url)
      this.currentAudio = null
      // ⭐ v6.4：onerror 时强制重新解锁（不依赖外部时机）
      forceUnlockAudio()
      if (this.retryCount < 2) {
        this.retryCount++
        console.warn('[AudioQueue] onerror, retrying... count=' + this.retryCount)
        setTimeout(() => this.playNext(), 300)
        return
      }
      this.retryCount = 0
      this.playNext()
    }

    // ⭐ v6.10：play() 前主动调 unlockAudioForMobile()（硬解锁）
    // 不依赖 v6.7 的 attachGlobalAudioUnlock — 保证首次点击就能播放
    unlockAudioForMobile()
    // ⭐ v6.4：play() 失败时强制重新解锁 iOS Safari autoplay
    this.currentAudio.play().catch((err) => {
      console.warn('[AudioQueue] play() rejected:', err?.message || err)
      forceUnlockAudio()  // 重置 _audioUnlocked flag + 重新走 audio graph
      // ⭐ v6.10：去掉 retry 链（之前 1-2s 延迟 累积），只重试 1 次且 delay 100ms
      if (this.retryCount < 1) {
        this.retryCount++
        setTimeout(() => this.playNext(), 100)
        return
      }
      this.retryCount = 0
      this.playNext()
    })
  }

  stop(): void {
    if (this.currentAudio) {
      this.currentAudio.pause()
      this.currentAudio.src = ''
      this.currentAudio = null
    }
    this.queue.forEach(url => URL.revokeObjectURL(url))
    this.queue = []
    this.pendingFetches = []
    this.isPlaying = false
    this.onSpeakingChange?.(false)
  }

  private paused = false
  private pausedUrl: string | null = null

  pause(): void {
    if (this.currentAudio && !this.paused) {
      this.pausedUrl = this.currentAudio.src
      this.currentAudio.pause()
    }
    this.paused = true
    this.isPlaying = false
    this.onSpeakingChange?.(false)
  }

  resume(): void {
    if (!this.paused) return
    this.paused = false
    const savedUrl = this.pausedUrl
    this.pausedUrl = null
    if (savedUrl && this.currentAudio) {
      this.currentAudio.play().catch(() => {})
      this.isPlaying = true
      this.onSpeakingChange?.(true)
    } else if (this.queue.length > 0 || this.pendingFetches.length > 0) {
      this.playNext()
    }
  }

  isPaused(): boolean {
    return this.paused
  }

  isSpeaking(): boolean {
    return this.isPlaying
  }

  isEmpty(): boolean {
    return this.queue.length === 0 && !this.isPlaying
  }

  setOnQueueEmpty(fn: () => void): void {
    this.onQueueEmpty = fn
  }

  setOnSpeakingChange(fn: (speaking: boolean) => void): void {
    this.onSpeakingChange = fn
  }
}

// 全局单例
const globalAudioQueue = new AudioQueueManager()

export function stopAllAudio(): void {
  globalAudioQueue.stop()
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel()
  }
}

export function pauseAudio(): void {
  globalAudioQueue.pause()
}

export function resumeAudio(): void {
  globalAudioQueue.resume()
}

export function isAudioPaused(): boolean {
  return globalAudioQueue.isPaused()
}

export function isAudioSpeaking(): boolean {
  return globalAudioQueue.isSpeaking()
}

export async function playTTSOnce(text: string): Promise<void> {
  return globalAudioQueue.enqueue(text)
}

// ⭐ ChatWindow 使用的旧 API（按句切分播放的别名）
export async function playStreamingTTS(text: string): Promise<void> {
  return globalAudioQueue.enqueue(text)
}

// ⭐ ChatWindow 使用的旧 API（单条消息完整播放，兼容旧传参 (msg, onStart, onEnd)）
export async function playMessageAudio(
  arg1: any,
  onStart?: () => void,
  onEnd?: () => void
): Promise<void> {
  // 兼容两两种调用：playMessageAudio(text) 或 playMessageAudio(msg, onStart, onEnd)
  let text = ''
  if (typeof arg1 === 'string') {
    text = arg1
  } else if (arg1 && typeof arg1 === 'object') {
    text = arg1.content || arg1.text || ''
  }
  onStart?.()
  await globalAudioQueue.enqueue(text)
  onEnd?.()
}

export async function playTTSAndWait(text: string): Promise<void> {
  return new Promise((resolve) => {
    globalAudioQueue.setOnQueueEmpty(() => resolve())
    globalAudioQueue.enqueue(text)
  })
}


// ---------------------------------------------------------------------------
// ⭐ v6.5 (2026-09-18 奕霖提速 A2): 客户端 prefetch hook
// ---------------------------------------------------------------------------
let _prefetchInFlight = new Set<string>()

export async function prefetchTTS(text: string): Promise<void> {
  if (!text || typeof window === 'undefined') return
  const cleaned = text.trim().slice(0, 500)
  if (!cleaned) return
  if (getCachedAudio(cleaned)) return
  if (_prefetchInFlight.has(cleaned)) return
  _prefetchInFlight.add(cleaned)

  let voice = 'female-shaonv'
  let engine: 'minimax' | 'edge' = 'minimax'
  try {
    const sv = window.localStorage.getItem('zhilin_tts_voice')
    if (sv) voice = sv
  } catch {}

  try {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: cleaned, voice, engine, speed: 1.2, pitch: 2, vol: 1.2 }),
    })
    if (!res.ok) { _prefetchInFlight.delete(cleaned); return }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    setCachedAudio(cleaned, url)
  } catch {
  } finally {
    _prefetchInFlight.delete(cleaned)
  }
}

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// ⭐ v6.4 iOS Safari Audio Unlock
// ---------------------------------------------------------------------------
let _audioUnlocked = false

/**
 * 公开 API：VoiceInput onClick 调（保证 user gesture 内调）
 */
export function unlockAudioForMobile(): void {
  if (_audioUnlocked) return
  doUnlock()
}

/**
 * ⭐ v6.4 内部强制解锁（无视 _audioUnlocked flag）：
 * AudioQueueManager 在 audio.play() 失败时调，强制重新解锁
 * 因为 iOS Safari 偶发的 unlock 失效场景下，需要 retry 路径
 */
function forceUnlockAudio(): void {
  _audioUnlocked = false
  doUnlock()
}

function doUnlock(): void {
  if (typeof window === 'undefined') return
  try {
    // ⭐ v6.6 iOS Safari 17+ 关键：在 user gesture 里实际 play() 预热的 audio 元素
    // iOS Safari 17+ 改变了 unlock 判定 — 必须有真实 play() 才会解除 autoplay 限制
    if (_hiddenAudio) {
      try {
        _hiddenAudio.currentTime = 0
        const playPromise = _hiddenAudio.play()
        if (playPromise && typeof playPromise.then === 'function') {
          playPromise.then(() => {
            // iOS Safari: 播放成功 = 已解锁
            _hiddenAudio?.pause()
          }).catch(() => {
            // play() 被拒绝 — 说明还没真正 user gesture
          })
        }
      } catch (e) {
        // 静默失败
      }
    }

    // Web Audio API 走 silent buffer（作为 fallback）
    const AnyAudioContext = (window as any).AudioContext || (window as any).webkitAudioContext
    if (AnyAudioContext) {
      const ctx = new AnyAudioContext()
      if (ctx.state === 'suspended') ctx.resume().catch(() => {})
      const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.1), ctx.sampleRate)
      const src = ctx.createBufferSource()
      src.buffer = buf
      src.connect(ctx.destination)
      src.start(0)
    }
    _audioUnlocked = true
  } catch (e) {
    // 静默失败
  }
}

// ⭐ v6.7：预热 hidden audio 元素 + iOS Safari 17+ 实际 play() 验证
// iOS Safari 17+ 变化：只走 Web Audio API silent buffer 不够了
// 必须有 user gesture 里 pre-warmed audio element 实际 play() 才会解锁
// ⭐ v6.7 关键：audio 元素必须 append 到 DOM，iOS 才认它是 user gesture 关联对象
let _hiddenAudio: HTMLAudioElement | null = null
// 1 个采样点 (16-bit PCM mono 8kHz) 的静音 WAV，43 字节
const SILENT_WAV_DATA_URL = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='

export function ensureHiddenAudio(): void {
  if (typeof window === 'undefined') return
  if (_hiddenAudio && _hiddenAudio.isConnected) return
  try {
    const audio = new Audio()
    audio.src = SILENT_WAV_DATA_URL
    audio.preload = 'auto'
    audio.volume = 0.001  // 真的不可听见（不是 0，否则 iOS Safari 17+ 可能跳过）
    audio.style.display = 'none'
    audio.setAttribute('aria-hidden', 'true')
    audio.id = 'zhilin-audio-unlock'
    // ⭐ v6.7 关键：append 到 DOM。iOS Safari 17+ 只认 in-DOM 的 audio 元素作为 user gesture 关联
    document.body.appendChild(audio)
    _hiddenAudio = audio
  } catch (e) {
    // 静默失败 — fallback 只走 Web Audio API
  }
}

// ⭐ v6.5：attachOnce 全局监听 — 第一次用户 tap 任意位置都触发 unlock
// iOS Safari 的 unlock 必须是 user gesture 内的同步操作
// 单独靠 VoiceInput 的 onClick 太迟（用户第一次打字聊天根本没点话筒）
let _globalUnlockAttached = false

export function attachGlobalAudioUnlock(): void {
  if (_audioUnlocked || _globalUnlockAttached) return
  if (typeof window === 'undefined') return
  _globalUnlockAttached = true
  ensureHiddenAudio()

  const unlockOnce = (e: Event) => {
    if (_audioUnlocked) return
    try {
      // ⭐ v6.7 关键：在 user gesture 内同步调用 audio.play() — 不能 setTimeout
      // iOS Safari 17+ 是 immediate event-driven 判定
      if (_hiddenAudio && _hiddenAudio.isConnected) {
        try {
          _hiddenAudio.currentTime = 0
          const p = _hiddenAudio.play()
          if (p && p.then) {
            p.then(() => {
              _hiddenAudio?.pause()
              _hiddenAudio!.currentTime = 0
            }).catch(() => {})
          }
        } catch {}
      }
      // Web Audio API 走 silent buffer 同时解 AudioContext
      const AnyAudioContext = (window as any).AudioContext || (window as any).webkitAudioContext
      if (AnyAudioContext) {
        try {
          const ctx = new AnyAudioContext()
          if (ctx.state === 'suspended') ctx.resume().catch(() => {})
          const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.1), ctx.sampleRate)
          const src = ctx.createBufferSource()
          src.buffer = buf
          src.connect(ctx.destination)
          src.start(0)
        } catch {}
      }
      _audioUnlocked = true
    } catch (err) {
      // 静默失败
    }
    // 永久解绑 — 只触发一次
    window.removeEventListener('pointerdown', unlockOnce, true)
    window.removeEventListener('touchstart', unlockOnce, true)
    window.removeEventListener('click', unlockOnce, true)
    window.removeEventListener('keydown', unlockOnce, true)
  }

  // ⭐ v6.7 同时监听多种 gesture（capture phase + 主动派发）
  // pointerdown 是 iOS Safari 17+ 最可靠的 user gesture 信号
  window.addEventListener('pointerdown', unlockOnce, true)
  window.addEventListener('touchstart', unlockOnce, true)
  window.addEventListener('click', unlockOnce, true)
  window.addEventListener('keydown', unlockOnce, true)
}

// ---------------------------------------------------------------------------
// 简单内存缓存（按 text hash）— 重复文字不重复调 TTS
// ---------------------------------------------------------------------------
const AUDIO_CACHE_SIZE = 30
const audioCache = new Map<string, string>()

function getCachedAudio(text: string): string | null {
  return audioCache.get(text) || null
}

function setCachedAudio(text: string, url: string): void {
  if (audioCache.size >= AUDIO_CACHE_SIZE) {
    // LRU 简化：删第一个
    const firstKey = audioCache.keys().next().value
    if (firstKey) {
      const oldUrl = audioCache.get(firstKey)
      if (oldUrl) URL.revokeObjectURL(oldUrl)
      audioCache.delete(firstKey)
    }
  }
  audioCache.set(text, url)
}

// ---------------------------------------------------------------------------
// Web Speech API（语音输入，已废弃但保留兼容）
// ---------------------------------------------------------------------------
export function isSpeechRecognitionSupported(): boolean {
  return typeof window !== 'undefined' && (
    'SpeechRecognition' in window || 'webkitSpeechRecognition' in window
  )
}

export function createSpeechRecognition(): SpeechRecognition | null {
  if (typeof window === 'undefined') return null
  const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  if (!SpeechRecognitionClass) return null
  return new SpeechRecognitionClass() as SpeechRecognition
}

export function onSpeechResult(
  callback: (result: { transcript: string; isFinal: boolean }) => void,
  onError: (err: any) => void,
  onEnd?: () => void
): () => void {
  const SpeechRecognitionClass = (typeof window !== 'undefined')
    ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
    : null
  if (!SpeechRecognitionClass) {
    onError(new Error('Speech recognition not supported'))
    return () => {}
  }

  const recognition = new SpeechRecognitionClass()
  recognition.continuous = true
  recognition.interimResults = true
  recognition.lang = 'zh-CN'

  let lastTranscript = ''
  let silenceTimer: ReturnType<typeof setTimeout> | null = null

  const clearSilenceTimer = () => {
    if (silenceTimer) {
      clearTimeout(silenceTimer)
      silenceTimer = null
    }
  }

  recognition.onresult = (event: any) => {
    clearSilenceTimer()
    let interim = ''
    let final = ''
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const r = event.results[i]
      if (r.isFinal) final += r[0].transcript
      else interim += r[0].transcript
    }
    if (final) lastTranscript += final
    else if (interim) lastTranscript = interim
    callback({ transcript: lastTranscript || interim, isFinal: !!final })
  }

  recognition.onerror = (event: any) => {
    if (event.error === 'no-speech') {
      return
    }
    onError(event.error || event)
  }

  recognition.onend = () => {
    clearSilenceTimer()
    if (lastTranscript) {
      callback({ transcript: lastTranscript, isFinal: true })
    }
    onEnd?.()
  }

  try {
    recognition.start()
  } catch (e) {
    onError(e)
  }

  return () => {
    clearSilenceTimer()
    try { recognition.stop() } catch {}
  }
}

export function cleanTextForTTS(text: string): string {
  if (!text) return ''
  return text
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
    .replace(/[*#_~`]/g, '')
    .replace(/\n+/g, '。')
    .replace(/\s+/g, ' ')
    .trim()
}

export function isWebSpeechMode(): boolean {
  return false
}

export function setUseWebSpeechMode(v: boolean): void {
}

export function listZhVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return []
  return window.speechSynthesis.getVoices().filter(v => v.lang.startsWith('zh'))
}

export function setPreferredVoice(name: string | null): void {
  if (typeof window === 'undefined') return
  if (name) window.localStorage.setItem('zhilin_tts_voice', name)
  else window.localStorage.removeItem('zhilin_tts_voice')
}

// ---------------------------------------------------------------------------
// SSE 流式 TTS 回调（用于按句切分播放）
// ---------------------------------------------------------------------------
export interface StreamingTTSCallbacks {
  onStart?: () => void
  onEnd?: () => void
  onComplete?: () => void
  onSentence?: (sentence: string) => void
  onFlush?: (text: string) => void
  onError?: (err: any) => void
}

let streamingCallbacks: StreamingTTSCallbacks = {}

export function setStreamingCallbacks(callbacks: StreamingTTSCallbacks): void {
  streamingCallbacks = callbacks
}

// Hook: SSE 流式聊天完成后调
export function useFlushStreamingTTS(onFlush?: (text: string) => void) {
  useEffect(() => {
    if (onFlush) {
      streamingCallbacks.onFlush = onFlush
    }
  }, [onFlush])
}

export const VOICE_STOP_ALL_EVENT = 'qinghe-voice-stop-all'

export function emitVoiceStopAll(): void {
  stopAllAudio()
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(VOICE_STOP_ALL_EVENT))
  }
}