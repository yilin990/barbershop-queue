'use client'

/**
 * ChatWindow - 芝小果 AI 对话窗口 (编排层)
 *
 * Day 3.2 重构 (v1.8.1-chatwindow-split):
 * - 从 18KB 上帝组件 → 7KB 编排层
 * - 拆出 3 个子组件:
 *   - ChatStatusBar (1.4KB) - 状态栏
 *   - ChatList (5.7KB) - 消息列表 + 流式 + loading
 *   - ChatInput (4.1KB) - 输入 + 语音 + 快捷问题
 *
 * 职责:
 * - state 管理 (messages/input/loading/speaking/statusText/currentStreamingText)
 * - 流式请求 (handleSend: fetch SSE + 解析 + 累积)
 * - 语音播放 (TTS)
 * - 子组件编排
 *
 * 不依赖具体 UI 渲染 → 业务核心, 0 UI 关心
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import ChatMessage from './ChatMessage'
import StopButton from './StopButton'
import VoiceIndicator from './VoiceIndicator'
import ChatStatusBar from './ChatStatusBar'
import ChatList from './ChatList'
import ChatInput from './ChatInput'
import { Message, getSavedMessages, saveMessages, clearSession } from '@/domain/chat/service'
import { playStreamingTTS, prefetchTTS, stopAllAudio, setStreamingCallbacks } from '@/lib/speech'
import { useUserStore } from '@/stores/userStore'
import { useKeyboardHeight } from '@/hooks/useKeyboardHeight'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
import EmergencyAlert from './EmergencyAlert'

interface ChatWindowProps {
  onClose?: () => void
  floatMode?: boolean
  autoPlayVoice?: boolean
  onAutoPlayVoiceChange?: (enabled: boolean) => void
  // ⭐ 奕霖 2026-07-06 12:42：问诊对象（subject）和切换回调，page.tsx 可控
  subject?: Subject
  onSubjectChange?: (s: Subject) => void
  // ⭐ 奕霖 2026-07-15 01:30：visible 控制是否显示（不卸载，避免丢 messages）
  visible?: boolean
}

// ⭐ 奕霖 2026-08-12 00:25：选购对象（self=本人 / family=家人 / other=其他人）
export type Subject = 'self' | 'family' | 'other'
export const SUBJECT_KEY = 'zhixia…ject'
export const SUBJECT_LABELS: Array<[Subject, string]> = [
  ['self', '👤 本人'],
  ['family', '👵 家人'],
  ['other', '🧑 其他'],
]
export function welcomeTextBySubject(s: Subject): string {
  if (s === 'self') return '您今天想买点什么？🍎'
  if (s === 'family') return '好的~给家人挑点 🍎\n\n请问是给哪位家人？多大岁数？有没有忌口或过敏？'
  return '好的~给其他人挑点 🍎\n\n请问是给谁？多大岁数？有没有忌口或过敏？'
}

// ⭐ 奕霖 2026-07-20 22:45：名字 hook — 应用《小狗狗钱》第 1 章 insight
// 「名字 = 命运，叫出来的才是你的」 — 用户给自己起个名，AI 营养师从此用它称呼
export const NAME_KEY = 'zhilin_user_display_name'
export function buildWelcome(name: string | null): Message {
  const greet = name ? `你好「${name}」` : '您好'
  return {
    role: 'assistant',
    content:
      `${greet}，我是芝小果，果蔬鲜生的AI果蔬顾问 🍎\n\n很高兴为您服务！有任何选购、存储、食用问题都可以问我~ 果蔬鲜生在铜仁有多家门店，每天清晨五点半新鲜到货。\n\n常见咨询：今日推荐、存储方法、时令果蔬、忌口搭配—— 都可以先聊，再决定要不要来店。\n\n⚠️ 注意：我只提供一般性建议，不替代专业营养师或医生。如有食物过敏或健康问题，请咨询专业人士。`,
    time: Date.now(),
  }
}

export default function ChatWindow({
  onClose,
  floatMode = false,
  autoPlayVoice = false,
  onAutoPlayVoiceChange,
  subject: subjectProp,
  onSubjectChange,
  visible = true,
}: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [statusText, setStatusText] = useState('')
  // ⭐ 奕霖 2026-07-06：问诊对象（外部可控则优选 props，否则内部 state）
  const [internalSubject, setInternalSubject] = useState<Subject>(() => {
    if (typeof window === 'undefined') return 'self'
    return ((window.localStorage.getItem(SUBJECT_KEY) as Subject) || 'self')
  })
  const subject = subjectProp ?? internalSubject
  // ⭐ 奕霖 2026-07-20 22:45：displayName hook（localStorage，不动 schema）
  const [displayName, setDisplayName] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    try {
      return window.localStorage.getItem(NAME_KEY) || null
    } catch {
      return null
    }
  })
  function saveDisplayName(name: string) {
    const v = name.trim()
    if (!v) return
    setDisplayName(v)
    if (typeof window !== 'undefined') window.localStorage.setItem(NAME_KEY, v)
    setMessages([buildWelcome(v)])
  }
  function clearDisplayName() {
    setDisplayName(null)
    if (typeof window !== 'undefined') window.localStorage.removeItem(NAME_KEY)
    setMessages([buildWelcome(null)])
  }
  function switchSubject(s: Subject) {
    if (s === subject) return
    if (subjectProp !== undefined && onSubjectChange) {
      // 外部控制：仅通知，避免双源 state 不一致
      onSubjectChange(s)
      return
    }
    setInternalSubject(s)
    if (typeof window !== 'undefined') window.localStorage.setItem(SUBJECT_KEY, s)
    // 清空对话
    setMessages([{
      role: 'assistant',
      content: welcomeTextBySubject(s),
      time: Date.now(),
    }])
  }
  // ⭐ 奕霖 2026-07-06 12:42：外部 props 控制 subject 时，同步清空对话
  const prevSubjectRef = useRef(subject)
  useEffect(() => {
    if (subjectProp === undefined) {
      prevSubjectRef.current = subject
      return
    }
    if (prevSubjectRef.current !== subjectProp) {
      prevSubjectRef.current = subjectProp
      setMessages([{
        role: 'assistant',
        content: welcomeTextBySubject(subjectProp),
        time: Date.now(),
      }])
    }
  }, [subjectProp, subject])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [currentStreamingText, setCurrentStreamingText] = useState('')
  const [inputFocused, setInputFocused] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const messagesRef = useRef(messages)
  const autoPlayVoiceRef = useRef(autoPlayVoice)
  const ttsBufferRef = useRef<string>('') // TTS 未发送的文本缓存（按句切分）

  // 检测系统输入法高度（手机弹起输入法时）
  const keyboardHeight = useKeyboardHeight()
  // 输入框聚焦时锁定 body 滚动，防止页面跳动
  useBodyScrollLock(inputFocused)

  // 当输入法弹起/隐藏时，自动滚到消息底部
  useEffect(() => {
    // 等一帧让 ChatList 完成高度调整
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    })
  }, [keyboardHeight])

  // 点击屏幕空白处：输入框失焦 + 如果正在播报则停止
  const handleContainerClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    // 跳过交互元素
    if (target.closest('button, input, textarea, a, [role="button"]')) return
    // 如果正在说话，点空白处停止
    if (speaking) {
      stopSpeaking()
      return
    }
    // 输入框失焦
    if (inputFocused && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
  }

  // 同步 refs
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    autoPlayVoiceRef.current = autoPlayVoice
  }, [autoPlayVoice])

  // 初始化：加载历史
  useEffect(() => {
    const saved = getSavedMessages()
    if (saved.length > 0) {
      setMessages(saved)
    } else {
      setMessages([buildWelcome(displayName)])
    }
  }, [])

  // 持久化历史
  useEffect(() => {
    if (messages.length > 0) {
      saveMessages(messages)
    }
  }, [messages])

  // TTS 流式回调
  useEffect(() => {
    setStreamingCallbacks({
      onStart: () => setSpeaking(true),
      onEnd: () => setSpeaking(false),
      onSentence: (sentence: string) => {
        setStatusText('正在念...')
      },
      onComplete: () => {
        setStatusText('')
      },
    })
  }, [])

  // ⭐ 奕霖 2026-07-15 02:00：监听喇叭点击——只停 TTS，不 abort 生成流
  // 需求：点喇叭仅关闭当前语音，让用户选播下一段；生成内容继续输入到聊天框
  // 只有明确点 StopButton 或输入新消息才中断流
  useEffect(() => {
    const handler = () => {
      stopAllAudio()  // 停 TTS
      // ❌ 不要 abort 流——生成继续
      // abortControllerRef.current?.abort()
      setSpeaking(false)
      // 流文本继续累积（不清空 currentStreamingText）
    }
    window.addEventListener('qinghe-voice-stop-all', handler)
    return () => window.removeEventListener('qinghe-voice-stop-all', handler)
  }, [])

  const stopSpeaking = useCallback(() => {
    stopAllAudio()
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setLoading(false)
    setStatusText('')
    setCurrentStreamingText('')
    setSpeaking(false)
  }, [])

  // 流式发送消息
  async function handleSend(text: string) {
    if (!text.trim() || loading) return
    setErrorMsg(null) // 每次发送清掉旧错误

    stopSpeaking()

    const userMsg: Message = { role: 'user', content: text.trim(), time: Date.now() }
    const newHistory = [...messagesRef.current, userMsg]
    setMessages(newHistory)
    setInput('')
    setLoading(true)
    setStatusText('芝小果正在思考...')
    setCurrentStreamingText('')
    ttsBufferRef.current = '' // 重置 TTS 缓存

    const currentMsgId = Date.now()

    try {
      const controller = new AbortController()
      abortControllerRef.current = controller

      const response = await fetch('/api/chat?stream=true', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        // ⭐ 奕霖 2026-06-30 20:53：传 userId + phone（订单意图检测需要）
        body: JSON.stringify({
          messages: newHistory,
          userId: useUserStore.getState().user?.id,
          phone: useUserStore.getState().user?.phone,
          subject,  // ⭐ 奕霖 2026-07-06：本次问诊对象
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let buffer = ''
      let fullText = ''
      // ⭐ 奕霖 2026-06-30 20:53：收集 SSE 中的 cards
      let collectedCards: any[] = []
      // ⭐ 奕霖 2026-07-15 00:30：收集 SSE 中的 tools（用于取消订单后更新老卡片状态）
      let collectedTools: string[] = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data:')) continue

          try {
            const data = JSON.parse(trimmed.slice(5))

            // ⭐ 奕霖 2026-06-30 20:53：处理 cards 块
            if (data.type === 'cards' && Array.isArray(data.data)) {
              collectedCards = data.data
              continue
            }

            // ⭐ 奕霖 2026-07-15 00:30：处理 tool 块（取消订单后更新老卡片状态）
            if (data.type === 'tool' && typeof data.name === 'string') {
              collectedTools.push(data.name)
              continue
            }

            if (data.type === 'text') {
              const chunk = data.chunk || ''
              fullText += chunk
              ttsBufferRef.current += chunk

              // 只更新 currentStreamingText，不动 messages
              // 这样 ChatList 只渲染一个 streaming 区块，不跳动
              setCurrentStreamingText(fullText)
              setStatusText('正在念...')

              if (autoPlayVoiceRef.current) {
                // ⭐ 奕霖 2026-07-15 01:30：加快语音播报——逢句号 / 问号 / 感叹号 / 换行 / 逗号 / 间隔符 都发送一段
                // 同时超过 10 字也发送（避免短句无标点 导致末尾不播报）
                const sentenceMatch = ttsBufferRef.current.match(/^([\s\S]*?[。！？!?\n，,、:；])/)
                if (sentenceMatch) {
                  const sentence = sentenceMatch[1].trim()
                  ttsBufferRef.current = ttsBufferRef.current.slice(sentenceMatch[0].length)
                  if (sentence.length >= 2) {
                    // ⭐ v6.5 A2 (2026-09-18 奕霖提速): 句子到达即 prefetch, 客户端 cache 命中 <50ms
                    prefetchTTS(sentence).catch(() => {})
                    playStreamingTTS(sentence)
                  }
                } else if (ttsBufferRef.current.length >= 6) {
                  // ⭐ v6.8（奕霖 2026-07-31 23:04 反馈"语音播报跳过前面的"）：
                  // 3 字 → 6 字阈值。3 字太短导致一个句子被切成 5 段播放，购物体验上会被用户
                  // 理解为"跳过了前面"。6 字阈值可以连续说出完整短语（如"你好我是AI"），
                  // 配合【遇到句号/问号/感叹号优先切句】的逻辑，提升完整可理解度。
                  const head = ttsBufferRef.current.slice(0, 6)
                  ttsBufferRef.current = ttsBufferRef.current.slice(6)
                  prefetchTTS(head).catch(() => {})
                  playStreamingTTS(head)
                }
              }
            } else if (data.type === 'done') {
              break
            }
          } catch {
            // ignore JSON parse errors on partial lines
          }
        }
      }

      // 流结束：才把完整内容加到 messages
      if (fullText || collectedCards.length > 0) {
        setMessages(prev => {
          const next = [
            ...prev,
            {
              role: 'assistant' as const,
              content: fullText,
              time: currentMsgId,
              cards: collectedCards.length > 0 ? collectedCards : undefined,
            },
          ]

          // ⭐ 奕霖 2026-07-15 00:30：取消订单后更新老卡片状态
          // 找到同 orderNo 的老消息，把 cards 状态变为 cancelled
          if (collectedTools.includes('cancel_order') && collectedCards.length > 0) {
            const cancelledOrderNo = collectedCards[0]?.orderNo
            if (cancelledOrderNo) {
              return next.map((m) => {
                if (m.role !== 'assistant' || !m.cards) return m
                const updatedCards = m.cards.map((c: any) => {
                  if (c.type === 'order' && c.orderNo === cancelledOrderNo && c.status !== 'cancelled') {
                    return { ...c, status: 'cancelled', statusLabel: '已取消', cancelled: true }
                  }
                  return c
                })
                return { ...m, cards: updatedCards }
              })
            }
          }
          return next
        })
      }

      // 发送流剩余的 buffer（可能未遇到句号）
      if (ttsBufferRef.current.trim()) {
        playStreamingTTS(ttsBufferRef.current)
        ttsBufferRef.current = ''
      }

      // 完成
      setLoading(false)
      setStatusText('')
      setCurrentStreamingText('')
    } catch (e) {
      console.error('Stream error:', e)
      setLoading(false)
      setErrorMsg(e instanceof Error ? e.message : '网络异常，请稍后再试')
      setStatusText('')
      setCurrentStreamingText('')
      ttsBufferRef.current = ''
    }
  }

  function handleVoiceTranscript(text: string) {
    setInput(text)
  }

  function handleClear() {
    stopSpeaking()
    setMessages([buildWelcome(displayName)])
    clearSession()
  }

  return (
    <div
      onClick={handleContainerClick}
      style={{
        display: visible ? 'flex' : 'none',
        flexDirection: 'column',
        flex: 1,           // ⭐ 占满父级剩余高度（修复 chat 空间闲置）
        minHeight: 0,      // ⭐ flex 子项塌缩修复
        height: '100%',    // ⭐ 奕霖 2026-07-24 02:36: 强制高度 = parent (Chrome row flex 默认 stretch 不尊重 parent height,需 height:100%)
        overflow: 'hidden', // ⭐ 奕霖 2026-07-24 02:36: 不加这个父级被内容撑高, ChatInput 被推下视口（实测 807 > parent 538, 撑爆 47px）
        background: 'transparent',
        // 顶部/底部安全区（刘海屏）
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        position: 'relative',
      }}
    >
      {/* 全局动画样式 (status bar / messages / loading 都用) */}
      <style>{`
        @keyframes msgSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.4; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1); }
        }
        .typing-dot {
          animation: pulse 1.4s ease-in-out infinite;
        }
        .typing-dot:nth-child(2) { animation-delay: 0.2s; }
        .typing-dot:nth-child(3) { animation-delay: 0.4s; }
        @keyframes floatIn {
          from { opacity: 0; transform: scale(0.9) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .chat-window { animation: floatIn 0.3s ease-out forwards; }
      `}</style>

      {/* 状态栏 */}
      <ChatStatusBar statusText={statusText} speaking={speaking} loading={loading} />

      {/* ⭐ 奕霖 2026-07-06 13:37 / 2026-07-18 v2.1：紧急症状浮条
           v2.1：不再监听实时 input（会抢视觉焦点），
           改为监听「最后一条已发出的 user message」
           ⭐ v6.9 回退（奕霖 2026-07-31 23:29 反馈）：
           取消 lastAssistantMessage 监听——AI 解释时也会用到紧急关键词
           （如"呼吸困难可能是..."），导致用户分不清是 AI 说的还是用户自己说的状态。
           现在只检测用户消息。
        */}
      <EmergencyAlert
        lastUserMessage={
          messages.length > 0 ? [...messages].reverse().find(m => m.role === 'user')?.content : ''
        }
        onEmergencyDetected={(kw, src) => {
          // 紧急关键词命中：控制台告警 + 后续可加后端审计
          console.warn(`[紧急症状检测] keyword=${kw} source=${src}`)
          if (typeof window !== 'undefined') {
            try {
              // ⭐ 简单审计：紧急命中时记一条本地日志（后续接后端 audit API）
              const logs = JSON.parse(window.localStorage.getItem('zhilin-emergency-logs') || '[]')
              logs.push({ keyword: kw, source: src, time: Date.now() })
              window.localStorage.setItem('zhilin-emergency-logs', JSON.stringify(logs.slice(-50)))
            } catch {}
          }
        }}
      />

      {/* ⭐ 奕霖 2026-07-06 02:08：消息区域 flex:1 + minHeight:0，让 ChatList 能正确滚动，输入框不被上推 */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <ChatList
          messages={messages}
          currentStreamingText={currentStreamingText}
          speaking={speaking}
          loading={loading}
          bottomRef={bottomRef}
        />
      </div>

      {/* 输入区域 - 浮在输入法上面，避免“突兀的分隔” */}
      <div
        style={{
          flexShrink: 0,
          // 输入法弹起时，在 ChatInput 底部额外添加高度，让输入框浮上去
          // 2026-07-24: 安卓兜底 —— keyboardHeight 现在永远 ≥ 56（useKeyboardHeight.ts 处理）
          paddingBottom: keyboardHeight,
          // background 必须延伸到 paddingBottom 区域，否则会出现“分裂感”
          // ⭐ 奕霖 2026-07-24 02:49：#0f172a 深色 vs body 撕裂 → 绿玻璃，跟主色家族一致（高质量）
          // ⭐ 段72（2026-09-19 00:52）修复：原 sky blue rgba(56,189,248) 与 grocery 主题不符
          //    grocery 主题是青绿系（--teal #b8860b / --green #b8860b），应与 zhilin 同款用 #b8860b 亮绿
          background: 'linear-gradient(180deg, rgba(184, 134, 11, 0.14) 0%, rgba(184, 134, 11, 0.08) 100%)',
          backdropFilter: 'blur(20px) saturate(1.2)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.2)',
          borderTop: '1px solid rgba(184, 134, 11, 0.25)',
          // 2026-07-24: 确保 wrapper 自己可见（不被其它 fixed/absolute 元素遮）
          // zIndex 95 必须 ≥ FloatingCart (90)，否则 🛒 浮窗会盖在 ChatInput 发送按钮上
          position: 'relative',
          zIndex: 95,
          transition: 'padding-bottom 0.25s ease',
        }}
      >
        <ChatInput
          input={input}
          setInput={setInput}
          loading={loading}
          handleSend={handleSend}
          handleClear={handleClear}
          messagesCount={messages.length}
          onInputFocus={() => setInputFocused(true)}
          onInputBlur={() => setInputFocused(false)}
        />
      </div>

      {/* 打断按钮 */}
      <StopButton visible={speaking || (loading && !!currentStreamingText)} onStop={stopSpeaking} />

      {/* ⭐ 奕霖 2026-07-03：顶部明显的"停止"按钮（跳出右下角浮动） */}
      {(speaking || (loading && !!currentStreamingText)) && (
        <button
          onClick={stopSpeaking}
          title="点击停止说话 / 打断 AI"
          style={{
            position: 'fixed',
            top: 'calc(70px + env(safe-area-inset-top, 0px) + 8px)',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1001,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '7px 14px',
            borderRadius: 20,
            background: 'rgba(255, 80, 80, 0.92)',
            border: '1px solid rgba(255, 255, 255, 0.25)',
            color: '#fff',
            fontSize: 12, fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(255, 60, 60, 0.5)',
            fontFamily: 'inherit',
            animation: 'stopBarIn 0.2s ease-out forwards',
          }}
        >
          <span style={{ fontSize: 14 }}>⏹</span>
          <span>点我停止</span>
        </button>
      )}
      <style>{`@keyframes stopBarIn { from { opacity: 0; transform: translateX(-50%) translateY(-10px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }`}</style>

      {/* 大号说话光圈（仅最后一条消息是AI时显示） */}
      {speaking && messages.length > 0 && messages[messages.length - 1]?.role === 'assistant' && (
        <VoiceIndicator speaking={speaking} text={currentStreamingText || messages[messages.length - 1]?.content} size="large" />
      )}
    </div>
  )
}

