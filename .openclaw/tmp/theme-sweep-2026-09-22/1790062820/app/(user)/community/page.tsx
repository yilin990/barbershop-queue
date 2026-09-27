'use client'

import { useState, useEffect } from 'react'
import AppLayout from '@/components/AppLayout'
import CommentSection from '@/components/CommentSection'
import FeedbackButton from '@/components/FeedbackButton'
import StoryShare from '@/components/StoryShare'
import DiscussionTab from '@/components/DiscussionTab'
import { useUserStore } from '@/stores/userStore'

type CommunityTab = 'comments' | 'feedback' | 'stories' | 'discussion'

export default function CommunityPage() {
  const [activeTab, setActiveTab] = useState<CommunityTab>('comments')
  const { user, isLoggedIn, token } = useUserStore()
  const [myFeedbacks, setMyFeedbacks] = useState<any[]>([])
  const [loadingFeedbacks, setLoadingFeedbacks] = useState(false)

  // 加载我提过的反馈（feedback tab 打开时）
  useEffect(() => {
    if (activeTab !== 'feedback' || !isLoggedIn || !token) return
    setLoadingFeedbacks(true)
    fetch('/api/feedbacks', { headers: { authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => { if (data.success) setMyFeedbacks(data.feedbacks || []) })
      .catch(() => {})
      .finally(() => setLoadingFeedbacks(false))
  }, [activeTab, isLoggedIn, token])

  const tabs: { key: CommunityTab; label: string; icon: string }[] = [
    { key: 'comments', label: '评价', icon: '⭐' },
    { key: 'feedback', label: '反馈', icon: '📝' },
    { key: 'stories', label: '故事', icon: '📖' },
    { key: 'discussion', label: '讨论', icon: '💬' },
  ]

  return (
    <AppLayout title="社区">
      {/* Community Tab Switcher */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '8px',
          marginBottom: '20px',
          marginTop: '8px',
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '10px 8px',
              borderRadius: '14px',
              border: activeTab === tab.key
                ? '1px solid rgba(127, 220, 148, 0.4)'
                : '1px solid rgba(127, 220, 148, 0.1)',
              background: activeTab === tab.key
                ? 'linear-gradient(135deg, rgba(127, 220, 148, 0.18) 0%, rgba(127, 220, 148, 0.08) 100%)'
                : 'rgba(127, 220, 148, 0.04)',
              color: activeTab === tab.key ? '#fbbf24' : 'rgba(255, 255, 255, 0.45)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span style={{ fontSize: '20px' }}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Comments Tab */}
      {activeTab === 'comments' && (
        <div
          style={{
            background: 'linear-gradient(180deg, rgba(35, 74, 53, 0.6) 0%, rgba(26, 58, 42, 0.8) 100%)',
            borderRadius: '18px',
            padding: '22px',
            marginBottom: '16px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35)',
            border: '1px solid rgba(127, 220, 148, 0.1)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <CommentSection />
        </div>
      )}

      {/* Feedback Tab - 反馈中心 */}
      {activeTab === 'feedback' && (
        <div
          style={{
            background: 'linear-gradient(180deg, rgba(35, 74, 53, 0.6) 0%, rgba(26, 58, 42, 0.8) 100%)',
            borderRadius: '18px',
            padding: '22px',
            marginBottom: '16px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35)',
            border: '1px solid rgba(127, 220, 148, 0.1)',
            backdropFilter: 'blur(20px)',
          }}
        >
          {/* 顶部说明 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, padding: '0 4px' }}>
            <div style={{ width: 4, height: 20, background: 'linear-gradient(180deg, #fbbf24 0%, #5fcc6f 100%)', borderRadius: 2, boxShadow: '0 0 8px rgba(127, 220, 148, 0.4)' }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: '#fbbf24', letterSpacing: '2px' }}>反馈中心</span>
            <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(127, 220, 148, 0.3), transparent)' }} />
          </div>

          {/* 顶部提示 */}
          <div style={{
            background: 'rgba(127, 220, 148, 0.06)',
            border: '1px solid rgba(127, 220, 148, 0.15)',
            borderRadius: 10,
            padding: '10px 14px',
            marginBottom: 16,
            fontSize: 12,
            color: 'rgba(255, 255, 255, 0.65)',
            lineHeight: 1.6,
          }}>
            💡 在这里你能看自己提过的反馈，也能提交新反馈。<br />
            门店反馈（对商户内容）请到「故事」或「评价」里点 “举报”。
          </div>

          {/* 我提过的反馈 */}
          {isLoggedIn ? (
            <>
              <div style={{ fontSize: 12, color: 'rgba(127, 220, 148, 0.7)', marginBottom: 10, fontWeight: 600, letterSpacing: '0.5px' }}>
                📋 我提过的反馈 {myFeedbacks.length > 0 && <span style={{ opacity: 0.6 }}>({myFeedbacks.length})</span>}
              </div>
              {loadingFeedbacks ? (
                <div style={{ textAlign: 'center', padding: '30px 0', color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>加载中...</div>
              ) : myFeedbacks.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'rgba(255,255,255,0.4)', fontSize: 13, marginBottom: 16 }}>
                  还没有提过反馈
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  {myFeedbacks.slice(0, 5).map((f) => (
                    <div key={f.id} style={{
                      background: 'rgba(0, 0, 0, 0.25)',
                      border: '1px solid rgba(127, 220, 148, 0.1)',
                      borderRadius: 10,
                      padding: '10px 12px',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{
                          fontSize: 10, fontWeight: 600,
                          padding: '2px 8px', borderRadius: 6,
                          background: f.status === 'pending' ? 'rgba(127, 220, 148, 0.15)' : 'rgba(107, 114, 128, 0.2)',
                          color: f.status === 'pending' ? '#fbbf24' : '#9ca3af',
                        }}>{f.status === 'pending' ? '处理中' : '已回复'}</span>
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>{new Date(f.createdAt).toLocaleDateString('zh-CN')}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', lineHeight: 1.5, marginBottom: 2 }}>{f.content.slice(0, 60)}{f.content.length > 60 ? '...' : ''}</div>
                      <div style={{ fontSize: 10, color: 'rgba(127, 220, 148, 0.5)' }}>类型：{f.type}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '16px 0', color: 'rgba(255,255,255,0.4)', fontSize: 12, marginBottom: 12 }}>
              登录后查看你的反馈
            </div>
          )}

          {/* 分隔线 */}
          <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(127, 220, 148, 0.2), transparent)', margin: '20px 0 16px' }} />

          {/* 新建反馈按钮 */}
          <div style={{ fontSize: 12, color: 'rgba(127, 220, 148, 0.7)', marginBottom: 10, fontWeight: 600, letterSpacing: '0.5px' }}>
            ✍️ 提交新反馈
          </div>
          <FeedbackButton />
        </div>
      )}

      {/* Stories Tab */}
      {activeTab === 'stories' && (
        <div
          style={{
            background: 'linear-gradient(180deg, rgba(35, 74, 53, 0.6) 0%, rgba(26, 58, 42, 0.8) 100%)',
            borderRadius: '18px',
            padding: '22px',
            marginBottom: '16px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35)',
            border: '1px solid rgba(127, 220, 148, 0.1)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <StoryShare />
        </div>
      )}

      {/* Discussion Tab */}
      {activeTab === 'discussion' && (
        <div
          style={{
            background: 'linear-gradient(180deg, rgba(35, 74, 53, 0.6) 0%, rgba(26, 58, 42, 0.8) 100%)',
            borderRadius: '18px',
            padding: '22px',
            marginBottom: '16px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35)',
            border: '1px solid rgba(127, 220, 148, 0.1)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <DiscussionTab />
        </div>
      )}

      {/* Floating Feedback Button */}
      <div
        style={{
          position: 'sticky',
          bottom: '88px',
          display: 'flex',
          justifyContent: 'center',
          marginTop: '8px',
          zIndex: 10,
        }}
      >
        <FeedbackButton />
      </div>
    </AppLayout>
  )
}