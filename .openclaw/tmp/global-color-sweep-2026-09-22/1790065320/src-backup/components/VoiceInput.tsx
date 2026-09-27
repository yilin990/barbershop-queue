'use client'

/**
 * VoiceInput - tap-to-toggle 麦克风按钮 (v5.2)
 *
 * v5.2 重大改进（奕霖 2026-07-31 02:42 反馈："recognition 停了但录音还在继续 → 喇叭冲突"）：
 * - 旧 v5.1：只 handleClick 调 resumeAudio()
 *   问题：如果 recognition.onend 外部触发（浏览器 silence timeout 5-15s），state 变成 idle 但 resumeAudio 没调
 *   → mic 还以为在录音，喇叭不能播报
 * - 新 v5.2：useEffect 监听 isRecording 变化，无论谁触发的 false 都会调 resumeAudio()
 *   联动：recognition.onend → useVoiceRecording setState('idle') → isRecording=false → resumeAudio()
 *   优势：mic 状态完全绑到 recognition 状态，再不会有"识别停但 mic 还在录"
 *
 * v5.1 重大改进（奕霖 2026-07-31 01:55 反馈：话筒/喇叭冲突）：
 * - 旧 v5.0：voice.start() → stopAllAudio() 把 TTS 队列全清空
 *   问题：话筒录音时 AI 后续要播报的内容被清掉，录音结束喇叭不说话
 * - 新 v5.1：voice.start() → pauseAudio() 暂停 TTS 但保留队列
 *         voice.stop() → resumeAudio() 录音结束恢复播放
 *   优势：TTS 不丢失，录音时 mic 不录到 AI 声音，AI 后续播报继续
 *
 * v5.0 重大改进（奕霖 2026-07-31 01:23 反馈：hold-to-record 不稳）：
 * - 旧：按住说话（hold-to-record）+ 上滑取消
 *   问题：安卓"一直摁住他他会自己关"（系统误识别 touchend）+ 桌面鼠标偏移误关
 * - 新：tap-to-toggle（点一下开始，再点一下结束）
 *   优势：避免误关、长按疲劳、可视化更明确（pulse 动画）
 * - 自动超时：录音最多 60s 自动停止（避免无限录音）
 * - 视觉反馈：录音时红色 pulse 动画 + 切换 ⏹ 图标
 *
 * v4.5（2026-07-30 01:04）：document-level mouseup 兜底（已不适用 v5.0）
 * v4.4（2026-07-29 15:39）：按住说话前先停 TTS（v5.1 改为 pauseAudio）
 */

import { useEffect, useRef } from 'react'
import type { VoiceRecording } from '@/hooks/useVoiceRecording'
// ⭐ v5.1（2026-07-31 01:55 奕霖反馈话筒/喇叭冲突）：
// 录音时改成 pauseAudio/resumeAudio，不再 stopAllAudio
// 录音期间 TTS 暂停（避免 mic 录到 AI 声音），但队列保留
// 录音结束后自动 resume，TTS 继续从队列里播
// ⭐ v6.3（2026-07-31 19:25 奕霖反馈手机"发信息没声音"）：
// 加 unlockAudioForMobile 双保险 — iOS Safari autoplay unlock 最可靠
import { pauseAudio, resumeAudio, unlockAudioForMobile } from '@/lib/speech'

interface VoiceInputProps {
  voice: VoiceRecording
  disabled?: boolean
}

const BTN_SIZE = 48 // 与发送按钮统一 48px
const MAX_RECORDING_MS = 60_000 // v5.0：录音最长 60s 自动停止

export default function VoiceInput({ voice, disabled }: VoiceInputProps) {
  const isRecording = voice.state === 'recording'

  /**
   * ⭐ v5.1：tap-to-toggle 核心（修复话筒/喇叭冲突）
   * - 第 1 次点击：开始录音 + 暂停 TTS（保留队列）
   * - 第 2 次点击：结束录音 + 恢复 TTS 继续播放
   * 不再 stopAllAudio（之前会把 AI 后续要播的 TTS 全清空）
   */
  const handleClick = () => {
    if (disabled || !voice.isSupported) return
    if (isRecording) {
      voice.stop()
      // ⭐ v5.1：录音结束，恢复 TTS 继续播放（从暂停处）
      resumeAudio()
    } else {
      // ⭐ v6.3：双保险 — 点话筒是肯定 user gesture，这里再调一次 unlock
      // 避免某些 WebView / iOS Safari 版本 textarea / div click 不被认作 gesture
      unlockAudioForMobile()
      voice.start()
      // ⭐ v5.1：录音开始，暂停 TTS（不 mic 录到 AI 声音），但保留队列
      pauseAudio()
    }
  }

  /**
   * ⭐ v5.0：超时保护
   * 用户忘了点结束 → 60s 后自动停止（避免无限录音耗电 + 隐私）
   */
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  useEffect(() => {
    if (isRecording) {
      timeoutRef.current = setTimeout(() => {
        voice.stop()
      }, MAX_RECORDING_MS)
    } else if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [isRecording, voice])

  /**
   * ⭐ v5.2（奕霖 2026-07-31 02:42 反馈 "recognition 停了但录音还在继续 → 喇叭冲突"）：
   * 监听 isRecording 变化（true→false），无论是谁触发的都自动 resumeAudio()
   * 这样 recognition.onend 外部触发时也能恢复 TTS 播放
   * - 用户主动 tap → handleClick 调 stop() → isRecording false → 这里再调一次 resumeAudio（幂等）
   * - 浏览器 silence timeout → useVoiceRecording onEnd → state='idle' → isRecording false → 这里调 resumeAudio
   * - 60s 超时 → voice.stop() → isRecording false → 这里调 resumeAudio
   */
  useEffect(() => {
    if (!isRecording) {
      resumeAudio()
    }
  }, [isRecording])

  return (
    <>
      {/* ⭐ v5.0：录音中红色 pulse 动画 */}
      <style>{`
        @keyframes voice-recording-pulse {
          0%, 100% {
            box-shadow: 0 0 12px rgba(255, 80, 80, 0.5);
            transform: scale(1.05);
          }
          50% {
            box-shadow: 0 0 22px rgba(255, 80, 80, 0.85);
            transform: scale(1.08);
          }
        }
      `}</style>

      <button
        disabled={disabled || !voice.isSupported}
        title={
          !voice.isSupported
            ? '浏览器不支持语音'
            : isRecording
              ? '点击结束录音'
              : '点击开始录音'
        }
        onClick={handleClick}
        // ⭐ v5.0：不再需要 touchstart/touchend/mousedown/mouseup
        // tap-to-toggle 一个 onClick 搞定所有平台（桌面 + 移动）
        style={{
          width: BTN_SIZE,
          height: BTN_SIZE,
          borderRadius: 12,
          background: isRecording
            ? 'linear-gradient(135deg, rgba(255, 80, 80, 0.4) 0%, rgba(255, 80, 80, 0.2) 100%)'
            : 'rgba(13, 31, 23, 0.6)',
          border: isRecording
            ? '1.5px solid rgba(255, 80, 80, 0.6)'
            : '1.5px solid rgba(184, 134, 11, 0.2)',
          color: isRecording
            ? '#ff8888'
            : 'rgba(184, 134, 11, 0.85)',
          cursor: disabled || !voice.isSupported ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: isRecording ? 20 : 18,
          transition: 'background 0.15s ease, border-color 0.15s ease, color 0.15s ease',
          flexShrink: 0,
          opacity: disabled ? 0.5 : 1,
          userSelect: 'none',
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none',
          WebkitTapHighlightColor: 'transparent',
          // ⭐ v5.0：tap-to-toggle 优化
          touchAction: 'manipulation',
          animation: isRecording
            ? 'voice-recording-pulse 1.4s ease-in-out infinite'
            : 'none',
        }}
      >
        {/* ⭐ v5.0：录音中显示 ⏹ 停止图标，闲置显示 🎤 */}
        {isRecording ? '⏹' : '🎤'}
      </button>
    </>
  )
}
