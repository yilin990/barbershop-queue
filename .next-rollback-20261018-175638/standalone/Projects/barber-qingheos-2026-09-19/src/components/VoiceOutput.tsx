'use client'

import { useState, useEffect } from 'react'
import { playMessageAudio, stopAllAudio, emitVoiceStopAll } from '@/lib/speech'

interface VoiceOutputProps {
  text: string
  size?: 'small' | 'medium'
}

export default function VoiceOutput({ text, size = 'medium' }: VoiceOutputProps) {
  const [playing, setPlaying] = useState(false)

  // ⭐ 监听全局 voice-stop 事件，同步重置所有 VoiceOutput 的 state
  useEffect(() => {
    const handler = () => setPlaying(false)
    window.addEventListener('qinghe-voice-stop-all', handler)
    return () => window.removeEventListener('qinghe-voice-stop-all', handler)
  }, [])

  const handlePlay = async () => {
    if (playing) {
      // ⭐ 奕霖 2026-06-30 19:11 反馈喇叭不能暂停
      // 修复：调用 emitVoiceStopAll 同时停掉流式自动播报
      emitVoiceStopAll()
      setPlaying(false)
      return
    }

    // ⭐ 先停掉所有声音（包括流式自动播报）
    emitVoiceStopAll()

    setPlaying(true)
    await playMessageAudio(
      { role: 'assistant', content: text, time: Date.now() } as any,
      () => setPlaying(true),
      () => {
        setPlaying(false)
      }
    )
  }

  const iconSize = size === 'small' ? '12px' : '14px'
  const buttonSize = size === 'small' ? '24px' : '28px'

  return (
    <button
      onClick={handlePlay}
      title={playing ? '停止播放' : '点击播放语音'}
      style={{
        width: buttonSize,
        height: buttonSize,
        borderRadius: '8px',
        background: playing
          ? 'linear-gradient(135deg, rgba(184, 134, 11, 0.3) 0%, rgba(184, 134, 11, 0.15) 100%)'
          : 'transparent',
        border: playing
          ? '1px solid rgba(184, 134, 11, 0.3)'
          : '1px solid rgba(184, 134, 11, 0.15)',
        color: playing ? '#b8860b' : 'rgba(184, 134, 11, 0.5)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: iconSize,
        transition: 'all 0.2s ease',
        flexShrink: 0,
      }}
    >
      {playing ? '🔊' : '🔈'}
    </button>
  )
}