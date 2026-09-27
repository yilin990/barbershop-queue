'use client'

import { useState } from 'react'
import { useUserStore } from '@/stores/userStore'
import LoginModal from './LoginModal'

const STORY_TEMPLATES = [
  {
    id: 'visit',
    icon: '🏥',
    title: '我在果蔬鲜生挑选',
    placeholder: '分享你在果蔬鲜生的挑选经历...',
  },
  {
    id: 'service',
    icon: '😊',
    title: '果蔬鲜生的服务',
    placeholder: '聊聊果蔬鲜生的服务让你印象深刻的地方...',
  },
  {
    id: 'memory',
    icon: '💭',
    title: '我和果蔬鲜生的故事',
    placeholder: '讲讲你或家人与果蔬鲜生的故事...',
  },
]

const MOCK_STORIES = [
  {
    id: 's1',
    userName: '铜仁老街坊',
    userAvatar: '🏘️',
    content: '记得小时候奶奶带我去果蔬鲜生挑水果，老板娘总会塞给我两个山楂，说是奖励乖孩子。现在我也有孩子了，还是习惯去果蔬鲜生。',
    time: '2周前',
    likes: 42,
  },
  {
    id: 's2',
    userName: '健康达人',
    userAvatar: '🌿',
    content: '果蔬鲜生的蔬菜真的新鲜，比超市的有机多了。有一次买青菜，店员还特意告诉我怎么辨别当天的货，这种实在劲儿，现在真的少见。',
    time: '1个月前',
    likes: 38,
  },
]

export default function StoryShare() {
  const [showLogin, setShowLogin] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState(0)
  const [storyText, setStoryText] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [reportingStory, setReportingStory] = useState<{ id: string; userName: string; content: string } | null>(null)
  const [reportToast, setReportToast] = useState('')
  const { isLoggedIn } = useUserStore()

  const handleShare = () => {
    if (!isLoggedIn) {
      setShowLogin(true)
      return
    }
    setShowForm(true)
  }

  const handleSubmit = () => {
    if (!storyText.trim()) return
    setSubmitted(true)
    setStoryText('')
    setTimeout(() => {
      setSubmitted(false)
      setShowForm(false)
    }, 2500)
  }

  return (
    <div>
      <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} />
      <StoryReportModal
        story={reportingStory}
        onClose={() => setReportingStory(null)}
        onSubmit={async (data) => {
          // 0-1 阶段：本地 mock，明天接 /api/content-reports + 飞书推奕霖
          console.log('[故事举报]', data)
          setReportToast('举报已提交，感谢您的反馈')
          setTimeout(() => setReportToast(''), 2500)
          return true
        }}
      />
      {reportToast && (
        <div style={{
          position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(127, 220, 148, 0.15)',
          border: '1px solid rgba(127, 220, 148, 0.4)',
          color: '#fbbf24',
          padding: '10px 20px', borderRadius: 24,
          fontSize: 13, fontWeight: 600, zIndex: 2000,
          backdropFilter: 'blur(8px)',
        }}>
          ✓ {reportToast}
        </div>
      )}

      {/* Section header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '18px',
        padding: '0 4px',
      }}>
        <div style={{
          width: '4px',
          height: '20px',
          background: 'linear-gradient(180deg, #fbbf24 0%, #5fcc6f 100%)',
          borderRadius: '2px',
          boxShadow: '0 0 8px rgba(127, 220, 148, 0.4)',
        }} />
        <span style={{ fontSize: '14px', fontWeight: 700, color: '#fbbf24', letterSpacing: '2px' }}>
          我在果蔬鲜生...
        </span>
        <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, rgba(127, 220, 148, 0.3), transparent)' }} />
      </div>

      {/* Story entry button */}
      {!showForm && (
        <button
          onClick={handleShare}
          style={{
            width: '100%',
            padding: '18px',
            borderRadius: '16px',
            border: '1px dashed rgba(127, 220, 148, 0.3)',
            background: 'linear-gradient(180deg, rgba(127, 220, 148, 0.06) 0%, rgba(127, 220, 148, 0.02) 100%)',
            color: 'rgba(127, 220, 148, 0.7)',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.3s ease',
            marginBottom: '16px',
            letterSpacing: '1px',
          }}
        >
          <span style={{ fontSize: '20px' }}>✍️</span> 分享你在果蔬鲜生的故事
        </button>
      )}

      {/* Story form */}
      {showForm && (
        <div style={{
          background: 'linear-gradient(180deg, rgba(35, 74, 53, 0.6) 0%, rgba(26, 58, 42, 0.8) 100%)',
          borderRadius: '18px',
          padding: '20px',
          marginBottom: '16px',
          border: '1px solid rgba(127, 220, 148, 0.15)',
        }}>
          {submitted ? (
            <div style={{ textAlign: 'center', padding: '30px 0' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>💚</div>
              <p style={{ color: '#fbbf24', fontSize: '16px', fontWeight: 700, margin: '0 0 6px' }}>故事已收录</p>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', margin: 0 }}>感谢你的分享</p>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#fff' }}>✍️ 分享你的故事</h3>
                <button
                  onClick={() => {
                    setShowForm(false)
                    setStoryText('')
                    setSelectedTemplate(0)
                  }}
                  style={{
                    width: '32px', height: '32px', borderRadius: '50%',
                    background: 'rgba(127, 220, 148, 0.1)',
                    border: '1px solid rgba(127, 220, 148, 0.2)',
                    color: 'rgba(127, 220, 148, 0.8)',
                    fontSize: '14px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'inherit',
                  }}
                  aria-label="关闭"
                >
                  ✕
                </button>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
                {STORY_TEMPLATES.map((t, i) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTemplate(i)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '7px 12px',
                      borderRadius: '20px',
                      border: selectedTemplate === i
                        ? '1px solid rgba(127, 220, 148, 0.4)'
                        : '1px solid rgba(127, 220, 148, 0.12)',
                      background: selectedTemplate === i
                        ? 'linear-gradient(135deg, rgba(127, 220, 148, 0.2) 0%, rgba(127, 220, 148, 0.08) 100%)'
                        : 'rgba(127, 220, 148, 0.04)',
                      color: selectedTemplate === i ? '#fbbf24' : 'rgba(255,255,255,0.5)',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    <span>{t.icon}</span> {t.title}
                  </button>
                ))}
              </div>
              <textarea
                value={storyText}
                onChange={(e) => setStoryText(e.target.value)}
                placeholder={STORY_TEMPLATES[selectedTemplate].placeholder}
                maxLength={300}
                style={{
                  width: '100%',
                  minHeight: '100px',
                  padding: '12px',
                  borderRadius: '12px',
                  border: '1px solid rgba(127, 220, 148, 0.2)',
                  background: 'rgba(127, 220, 148, 0.06)',
                  color: '#fff',
                  fontSize: '14px',
                  lineHeight: 1.8,
                  resize: 'none',
                  outline: 'none',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                <button
                  onClick={() => setShowForm(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'rgba(127, 220, 148, 0.5)',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  取消
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!storyText.trim()}
                  style={{
                    padding: '10px 24px',
                    borderRadius: '12px',
                    border: 'none',
                    background: storyText.trim()
                      ? 'linear-gradient(135deg, #fbbf24 0%, #5fcc6f 100%)'
                      : 'rgba(127, 220, 148, 0.2)',
                    color: storyText.trim() ? '#0d1f17' : 'rgba(127, 220, 148, 0.4)',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: storyText.trim() ? 'pointer' : 'not-allowed',
                    letterSpacing: '1px',
                  }}
                >
                  分享故事
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Story cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {MOCK_STORIES.map((story) => (
          <div
            key={story.id}
            style={{
              background: 'linear-gradient(180deg, rgba(35, 74, 53, 0.5) 0%, rgba(26, 58, 42, 0.7) 100%)',
              borderRadius: '16px',
              padding: '16px',
              border: '1px solid rgba(127, 220, 148, 0.1)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(127, 220, 148, 0.2) 0%, rgba(127, 220, 148, 0.08) 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px',
                border: '1px solid rgba(127, 220, 148, 0.15)',
              }}>
                {story.userAvatar}
              </div>
              <div>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>{story.userName}</span>
                <span style={{ fontSize: '11px', color: 'rgba(127, 220, 148, 0.4)', marginLeft: '8px' }}>{story.time}</span>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.8, color: 'rgba(255,255,255,0.8)' }}>
              {story.content}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'rgba(127, 220, 148, 0.5)', fontSize: '12px' }}>
                ❤️ {story.likes}人共鸣
              </div>
              <button
                onClick={() => {
                  const user = useUserStore.getState().user
                  if (!user) {
                    setShowLogin(true)
                    return
                  }
                  setReportingStory({ id: story.id, userName: story.userName, content: story.content })
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'rgba(255, 255, 255, 0.3)',
                  fontSize: 11,
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: 6,
                  fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}
                aria-label="举报这篇故事"
              >
                🚩 举报
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
/** 故事举报弹窗
 * 0-1 阶段：本地 mock（console.log），明天接 /api/content-reports + 飞书推奕霖
 * 设计参考 FeedbackButton 的紫色调
 */
const REPORT_CATEGORIES = [
  { key: '违规内容', label: '违规内容', color: '#ef4444' },
  { key: '虚假宣传', label: '虚假宣传', color: '#f59e0b' },
  { key: '隐私泄露', label: '隐私泄露', color: '#a78bfa' },
  { key: '其他', label: '其他', color: '#6b7280' },
] as const

function StoryReportModal({
  story,
  onClose,
  onSubmit,
}: {
  story: { id: string; userName: string; content: string } | null
  onClose: () => void
  onSubmit: (data: { storyId: string; category: string; description: string }) => Promise<boolean>
}) {
  const [category, setCategory] = useState<string>('违规内容')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!story) return null

  const handleSubmit = async () => {
    if (!description.trim()) return
    setSubmitting(true)
    const ok = await onSubmit({ storyId: story.id, category, description: description.trim() })
    setSubmitting(false)
    if (ok) {
      setDescription('')
      onClose()
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        zIndex: 1500,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 420,
          background: 'linear-gradient(180deg, #1a3a2a 0%, #152b20 50%, #0d1f17 100%)',
          borderRadius: '24px 24px 0 0',
          padding: '0 0 32px',
          border: '1px solid rgba(127, 220, 148, 0.15)',
          borderBottom: 'none',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 0' }}>
          <div style={{ width: '36px', height: '4px', background: 'rgba(127, 220, 148, 0.3)', borderRadius: '2px' }} />
        </div>

        <div style={{ padding: '20px 24px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#fff' }}>🚩 举报故事</h2>
            <button
              onClick={onClose}
              style={{
                width: '32px', height: '32px', borderRadius: '50%',
                background: 'rgba(127, 220, 148, 0.1)',
                border: '1px solid rgba(127, 220, 148, 0.2)',
                color: 'rgba(127, 220, 148, 0.8)',
                fontSize: '16px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'inherit',
              }}
            >
              ✕
            </button>
          </div>

          {/* 故事预览 */}
          <div style={{
            background: 'rgba(127, 220, 148, 0.04)',
            border: '1px solid rgba(127, 220, 148, 0.1)',
            borderRadius: 12,
            padding: '12px 14px',
            marginBottom: 16,
            fontSize: 12,
            color: 'rgba(255, 255, 255, 0.6)',
            lineHeight: 1.6,
          }}>
            <div style={{ fontSize: 11, color: 'rgba(127, 220, 148, 0.6)', marginBottom: 6 }}>
              {story.userName} 的故事
            </div>
            {story.content.slice(0, 80)}{story.content.length > 80 ? '...' : ''}
          </div>

          {/* 分类选择 */}
          <div style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 12, color: 'rgba(127, 220, 148, 0.7)', margin: '0 0 8px' }}>举报类型</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {REPORT_CATEGORIES.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setCategory(c.key)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 16,
                    border: category === c.key ? `1px solid ${c.color}80` : '1px solid rgba(127, 220, 148, 0.15)',
                    background: category === c.key ? `${c.color}25` : 'rgba(127, 220, 148, 0.05)',
                    color: category === c.key ? c.color : 'rgba(255, 255, 255, 0.6)',
                    fontSize: 12,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* 描述 */}
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 12, color: 'rgba(127, 220, 148, 0.7)', margin: '0 0 8px' }}>详细说明（必填）</p>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="请描述这个故事哪里违规、虚假或让你不舒服..."
              maxLength={500}
              rows={4}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 10,
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(127, 220, 148, 0.2)',
                color: '#fff',
                fontSize: 13,
                resize: 'none',
                outline: 'none',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.3)', textAlign: 'right', marginTop: 4 }}>
              {description.length}/500
            </div>
          </div>

          {/* 提示 */}
          <div style={{
            background: 'rgba(167, 139, 250, 0.08)',
            border: '1px solid rgba(167, 139, 250, 0.2)',
            borderRadius: 10,
            padding: '10px 12px',
            marginBottom: 16,
            fontSize: 11,
            color: 'rgba(255, 255, 255, 0.6)',
            lineHeight: 1.6,
          }}>
            💡 举报会送到奕霖处审核，我们会保护你的隐私。
          </div>

          {/* 按钮 */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onClose}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: 12,
                border: '1px solid rgba(127, 220, 148, 0.2)',
                background: 'transparent',
                color: 'rgba(255, 255, 255, 0.6)',
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              取消
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || !description.trim()}
              style={{
                flex: 2,
                padding: '12px',
                borderRadius: 12,
                border: 'none',
                background: submitting || !description.trim()
                  ? 'rgba(127, 220, 148, 0.2)'
                  : 'linear-gradient(135deg, #fbbf24 0%, #5fcc6f 100%)',
                color: submitting || !description.trim() ? 'rgba(255, 255, 255, 0.4)' : '#0d1f17',
                fontSize: 14,
                fontWeight: 700,
                cursor: submitting || !description.trim() ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {submitting ? '提交中...' : '提交举报'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
