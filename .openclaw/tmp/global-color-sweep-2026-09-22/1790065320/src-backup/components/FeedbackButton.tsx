'use client'

import { useState } from 'react'
import { useUserStore } from '@/stores/userStore'
import { submitFeedback } from '@/domain/community/service'
import LoginModal from './LoginModal'

const FEEDBACK_TAGS = [
  { id: 'fruit', label: '选果建议', icon: '🍎' },
  { id: 'service', label: '服务态度', icon: '😊' },
  { id: 'environment', label: '环境卫生', icon: '🏥' },
  { id: 'price', label: '价格建议', icon: '💰' },
]

export default function FeedbackButton() {
  const [showModal, setShowModal] = useState(false)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [content, setContent] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const { isLoggedIn } = useUserStore()

  const toggleTag = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]
    )
  }

  const handleSubmit = () => {
    if (selectedTags.length === 0 || !content.trim()) return
    submitFeedback({
      type: selectedTags.join('、'),
      content: content.trim(),
      time: new Date().toLocaleString('zh-CN'),
    })
    setSubmitted(true)
    setSelectedTags([])
    setContent('')
    // Save to localStorage for "my feedbacks"
    const existing = JSON.parse(localStorage.getItem('zhilin-feedbacks') || '[]')
    existing.push({
      type: selectedTags.join('、'),
      content: content.trim(),
      time: new Date().toLocaleString('zh-CN'),
      status: 'pending',
    })
    localStorage.setItem('zhilin-feedbacks', JSON.stringify(existing))
    setTimeout(() => {
      setSubmitted(false)
      setShowModal(false)
    }, 2000)
  }

  return (
    <>
      <button
        onClick={() => {
          if (!isLoggedIn) {
            setShowModal(true)
          } else {
            setShowModal(true)
          }
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 20px',
          borderRadius: '14px',
          border: '1px solid rgba(184, 134, 11, 0.2)',
          background: 'linear-gradient(180deg, rgba(184, 134, 11, 0.1) 0%, rgba(184, 134, 11, 0.05) 100%)',
          color: '#b8860b',
          fontSize: '14px',
          fontWeight: 600,
          cursor: 'pointer',
          letterSpacing: '1px',
          transition: 'all 0.3s ease',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
          backdropFilter: 'blur(16px)',
        }}
      >
        <span style={{ fontSize: '18px' }}>📝</span> 意见反馈
      </button>

      <LoginModal isOpen={showModal && !isLoggedIn} onClose={() => setShowModal(false)} />

      {showModal && isLoggedIn && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowModal(false)
          }}
        >
          <div style={{
            width: '100%',
            maxWidth: '420px',
            background: 'linear-gradient(180deg, #1a3a2a 0%, #152b20 50%, #0d1f17 100%)',
            borderRadius: '24px 24px 0 0',
            padding: '0 0 40px',
            border: '1px solid rgba(184, 134, 11, 0.15)',
            borderBottom: 'none',
          }}>
            {/* Handle bar */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 0' }}>
              <div style={{ width: '36px', height: '4px', background: 'rgba(184, 134, 11, 0.3)', borderRadius: '2px' }} />
            </div>

            <div style={{ padding: '20px 24px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#fff' }}>📝 意见反馈</h2>
                <button
                  onClick={() => setShowModal(false)}
                  style={{
                    width: '32px', height: '32px', borderRadius: '50%',
                    background: 'rgba(184, 134, 11, 0.1)',
                    border: '1px solid rgba(184, 134, 11, 0.2)',
                    color: 'rgba(184, 134, 11, 0.8)',
                    fontSize: '16px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  ✕
                </button>
              </div>

              {submitted ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
                  <p style={{ color: '#b8860b', fontSize: '18px', fontWeight: 700, margin: '0 0 8px' }}>反馈已提交</p>
                  <p style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '13px', margin: 0 }}>感谢您的宝贵意见！</p>
                </div>
              ) : (
                <>
                  {/* Tags */}
                  <div style={{ marginBottom: '16px' }}>
                    <p style={{ fontSize: '13px', color: 'rgba(184, 134, 11, 0.7)', margin: '0 0 10px', letterSpacing: '0.5px' }}>
                      选择反馈类型（可多选）
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {FEEDBACK_TAGS.map((tag) => (
                        <button
                          key={tag.id}
                          onClick={() => toggleTag(tag.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 14px',
                            borderRadius: '20px',
                            border: selectedTags.includes(tag.id)
                              ? '1px solid rgba(184, 134, 11, 0.4)'
                              : '1px solid rgba(184, 134, 11, 0.15)',
                            background: selectedTags.includes(tag.id)
                              ? 'linear-gradient(135deg, rgba(184, 134, 11, 0.25) 0%, rgba(184, 134, 11, 0.1) 100%)'
                              : 'rgba(184, 134, 11, 0.05)',
                            color: selectedTags.includes(tag.id) ? '#b8860b' : 'rgba(255, 255, 255, 0.6)',
                            fontSize: '13px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                          }}
                        >
                          <span>{tag.icon}</span> {tag.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Text */}
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="请详细描述您的建议或问题..."
                    maxLength={500}
                    style={{
                      width: '100%',
                      minHeight: '120px',
                      padding: '14px',
                      borderRadius: '14px',
                      border: '1px solid rgba(184, 134, 11, 0.2)',
                      background: 'rgba(184, 134, 11, 0.06)',
                      color: '#fff',
                      fontSize: '14px',
                      lineHeight: 1.7,
                      resize: 'none',
                      outline: 'none',
                      boxSizing: 'border-box',
                      fontFamily: 'inherit',
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                    <span style={{ fontSize: '11px', color: 'rgba(184, 134, 11, 0.4)' }}>
                      {content.length}/500
                    </span>
                    <button
                      onClick={handleSubmit}
                      disabled={selectedTags.length === 0 || !content.trim()}
                      style={{
                        padding: '12px 28px',
                        borderRadius: '12px',
                        border: 'none',
                        background: selectedTags.length > 0 && content.trim()
                          ? 'linear-gradient(135deg, #b8860b 0%, #b8860b 100%)'
                          : 'rgba(184, 134, 11, 0.2)',
                        color: selectedTags.length > 0 && content.trim() ? '#0d1f17' : 'rgba(184, 134, 11, 0.4)',
                        fontSize: '14px',
                        fontWeight: 700,
                        cursor: selectedTags.length > 0 && content.trim() ? 'pointer' : 'not-allowed',
                        letterSpacing: '1px',
                        boxShadow: selectedTags.length > 0 && content.trim() ? '0 4px 16px rgba(184, 134, 11, 0.3)' : 'none',
                      }}
                    >
                      提交反馈
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}