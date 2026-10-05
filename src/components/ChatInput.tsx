'use client'

/**
 * ChatInput - 输入区组件 (v4.1 最终版)
 *
 * v4.1 修正（按奕霖 2026-06-29 14:16 反馈）：
 * - 布局统一 42px：所有按钮都是 42x42（麦克风也回到 42）
 * - 整体右对齐：输入框 flex 1 占满中间，按钮们紧贴右边
 * - **不自动发送**：识别完文字进 input 框，焦点到 input 让用户自己看、自己发
 *   (避免错别字直接发出去 - 奕霖的核心需求)
 * - 松手立即识别到文字：删 finalizing 延时，松手瞬间填到 input
 *
 * 顺序：[长输入框 flex:1] [▶ 42px] [🎤 42px] [🗑️ 36px]
 * 顺序右边对齐，按钮们紧贴右边
 */

import { useRef, useEffect } from 'react'
import VoiceInput from './VoiceInput'
import VoiceOverlay, { VoiceTooShortHint } from './VoiceOverlay'
import VoiceProcessingIndicator from './VoiceProcessingIndicator'
import QuickQuestions from './QuickQuestions'
import { useVoiceRecording } from '@/hooks/useVoiceRecording'
import { attachGlobalAudioUnlock, ensureHiddenAudio, unlockAudioForMobile } from '@/lib/speech'

interface ChatInputProps {
  input: string
  setInput: (v: string) => void
  loading: boolean
  handleSend: (text: string) => void
  handleClear: () => void
  messagesCount: number
  onInputFocus?: () => void
  onInputBlur?: () => void
}

const BTN = 48 // 统一按钮尺寸 48px

export default function ChatInput({
  input,
  setInput,
  loading,
  handleSend,
  handleClear,
  messagesCount,
  onInputFocus,
  onInputBlur,
}: ChatInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  // 同步 input 当前值供 voice hook 读取（避免 stale closure）
  const inputValueRef = useRef(input)

  // ⭐ v6.5（奕霖 2026-07-31 20:41 反馈 v6.4 没生效）：
  // 在 mount 时 attach 全局一次解锁监听 — 第一次用户 tap 任意位置
  // （点 textarea / 点按钮 / 点 QuickQuestions / 任何地方）都触发 unlockAudioForMobile()
  // 这样 iOS Safari autoplay 不会因为"用户没点话筒"而保持锁定
  //
  // ⭐ v6.6（奕霖 2026-07-31 20:51 反馈 v6.5 也没生效）：
  // iOS Safari 17+ 必须预热 hidden audio 元素 + 实际 play() 才会解锁
  // 不能只靠 Web Audio API silent buffer
  useEffect(() => {
    ensureHiddenAudio()  // v6.6: 预热 hidden audio
    attachGlobalAudioUnlock()
  }, [])

  // 录音 hook：v6.2 流式分块 → 实时增量 + 最终文字
  const voice = useVoiceRecording({
    onTranscript: (delta, isDelta) => {
      // 实时增量：每个 chunk 回来立刻追加到 input（让用户看到实时识别）
      if (isDelta && delta) {
        const newValue = (inputValueRef.current + delta).trimStart()
        inputValueRef.current = newValue
        setInput(newValue)
        // 自动 focus 到 input，让用户能编辑
        setTimeout(() => inputRef.current?.focus(), 50)
      }
    },
    onFinalTranscript: (text) => {
      // 最终结果：用完整 cumulative 替换（确保一致性）
      if (text) {
        inputValueRef.current = text
        setInput(text)
      }
    },
    disabled: loading,
  })

  // 同步 input prop 变化到 ref（用户手动输入时）
  // v6.2 注意：onChange 也需要同步，让 ref 跟着 props 走
  // 不然用户开始录音后手动打字，ref 会是旧的
  // 改: 在 onChange 里同步

  const isVoiceActive = voice.state === 'recording' || voice.state === 'streaming'

  return (
    <>
      {/* 录音中按钮上方小气泡 */}
      <VoiceOverlay voice={voice} />
      <VoiceTooShortHint visible={voice.state === 'too-short'} />
      {/* ⭐ v6.0 + 奕霖 2026-07-31 15:10 反馈：识别中倒计时 (本地 whisper 5-10s) */}
      <VoiceProcessingIndicator visible={voice.state === 'processing'} />

      {/* Quick questions */}
      {messagesCount <= 2 && !loading && (
        <div style={{ marginBottom: '12px', padding: '0 4px' }}>
          <QuickQuestions onSelect={handleSend} />
        </div>
      )}

      {/* 输入区域 - 右对齐布局 */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
          padding: '10px 12px',
          position: 'relative',
          width: '100%',
        }}
      >
        {/* 1. 输入框（textarea，可随字数扩大） */}
        <textarea
          ref={inputRef as any}
          value={input}
          onChange={e => {
            setInput(e.target.value)
            inputValueRef.current = e.target.value
            // ⭐ 自动调整高度（不随字数扩大）
            const ta = e.target as HTMLTextAreaElement
            ta.style.height = 'auto'
            const nextH = Math.min(ta.scrollHeight, 120) // 最多 5 行高
            ta.style.height = nextH + 'px'
          }}
          onFocus={e => {
            ;(e.target as HTMLTextAreaElement).style.borderColor = 'rgba(184, 134, 11, 0.35)'
            onInputFocus?.()
          }}
          onBlur={e => {
            ;(e.target as HTMLTextAreaElement).style.borderColor = 'rgba(184, 134, 11, 0.15)'
            onInputBlur?.()
          }}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend(input)
            }
          }}
          placeholder="想问什么发型？"
          disabled={loading || isVoiceActive}
          readOnly={isVoiceActive}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="send"
          rows={1}
          style={{
            flex: 1, // 占满中间所有剩余空间
            minWidth: 80,
            minHeight: BTN, // 初始与按钮同高
            maxHeight: 120, // 最多 5 行（24*5）
            // ⭐ 奕霖 2026-07-24 03:25：小屏紧凑 (iPhone 13 mini 375 宽)
            padding: '11px 12px',
            borderRadius: 12,
            background: isVoiceActive
              ? 'rgba(184, 134, 11, 0.05)'
              : '#ffffff', // ⭐ 2026-09-30 奕霖: 墨绿换白，浅米底 + 深色文字
            border: `1px solid ${
              isVoiceActive ? 'rgba(184, 134, 11, 0.4)' : 'rgba(184, 134, 11, 0.4)'
            }`,
            fontSize: '15.5px', // iOS 推荐 16px，小屏略减
            fontFamily: 'inherit',
            lineHeight: '19px',
            color: '#1a1a1a', // ⭐ 2026-09-30 奕霖: 白色背景配深色文字，对比度清晰（深绿换白）
            outline: 'none',
            transition: 'border-color 0.2s ease, background 0.2s ease',
            WebkitAppearance: 'none',
            userSelect: isVoiceActive ? 'none' : 'auto',
            WebkitUserSelect: isVoiceActive ? 'none' : 'auto',
            boxSizing: 'border-box',
            resize: 'none', // 隐藏拖拽
            overflowY: 'auto', // 超长时内部滚动
          }}
        />

        {/* 2. 发送按钮（42px） */}
        <button
          onClick={() => {
            // ⭐ v6.10（奕霖 2026-07-31 23:37 反馈"第一次点喇叭延迟 3-4s"）：
            // 发送按钮点下时同步调 unlockAudioForMobile()。
            // 即使用户从安装开始一直只打字没点话筒，这里也是 user gesture，
            // 主动 hard-unlock iOS Safari hidden audio，避免 AI 回复后音频话没有声音。
            unlockAudioForMobile()
            handleSend(input)
          }}
          disabled={loading || !input.trim() || isVoiceActive}
          aria-label="发送消息"
          style={{
            width: BTN,
            height: BTN,
            borderRadius: 12,
            background: input.trim() && !isVoiceActive
              ? 'linear-gradient(135deg, rgba(184, 134, 11, 0.35) 0%, rgba(184, 134, 11, 0.2) 100%)'
              : 'rgba(184, 134, 11, 0.08)',
            border: input.trim() && !isVoiceActive
              ? '1px solid rgba(184, 134, 11, 0.3)'
              : '1px solid rgba(184, 134, 11, 0.1)',
            color: input.trim() && !isVoiceActive ? '#b8860b' : 'rgba(93, 64, 55, 0.5)',
            cursor: input.trim() && !isVoiceActive ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            transition: 'all 0.2s ease',
            boxShadow: input.trim() && !isVoiceActive ? '0 4px 12px rgba(0,0,0,0.2)' : 'none',
            flexShrink: 0,
          }}
        >
          ▶
        </button>

        {/* 3. 麦克风按钮（42px） */}
        <div style={{ position: 'relative' }}>
          <VoiceInput voice={voice} disabled={loading} />
        </div>

        {/* 4. 清空按钮（消息数 > 1 时显示 36px） */}
        {messagesCount > 1 && (
          <button
            onClick={handleClear}
            aria-label="清空对话"
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: 'transparent',
              border: '1px solid rgba(184, 134, 11, 0.1)',
              color: 'rgba(93, 64, 55, 0.6)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              flexShrink: 0,
            }}
            title="清空对话"
          >
            🗑️
          </button>
        )}
      </div>
    </>
  )
}