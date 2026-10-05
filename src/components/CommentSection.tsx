'use client'

import { useState, useRef } from 'react'
import { useUserStore, type User } from '@/stores/userStore'
import {
  type Comment,
  type Reply,
  MOCK_COMMENTS,
  addComment,
  addReply,
  toggleLike,
} from '@/domain/community/service'
import LoginModal from './LoginModal'

export default function CommentSection() {
  const [comments, setComments] = useState<Comment[]>(MOCK_COMMENTS)
  const [showLogin, setShowLogin] = useState(false)
  const [rating, setRating] = useState(5)
  const [commentText, setCommentText] = useState('')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const { user, isLoggedIn } = useUserStore()

  const handleSubmitComment = () => {
    if (!isLoggedIn || !user) {
      setShowLogin(true)
      return
    }
    if (!commentText.trim()) return
    const newComment = addComment({
      userId: user.id,
      userName: user.nickname,
      userAvatar: user.avatar,
      rating,
      content: commentText.trim(),
      time: '刚刚',
      likes: 0,
      likedByMe: false,
      replies: [],
      isMyComment: true,
    })
    setComments([newComment, ...comments])
    setCommentText('')
    setRating(5)
  }

  const handleToggleLike = (commentId: string) => {
    if (!isLoggedIn || !user) {
      setShowLogin(true)
      return
    }
    toggleLike(commentId, user.id)
    setComments([...comments])
  }

  const handleSubmitReply = (commentId: string) => {
    if (!isLoggedIn || !user) {
      setShowLogin(true)
      return
    }
    if (!replyText.trim()) return
    addReply(commentId, {
      userId: user.id,
      userName: user.nickname,
      userAvatar: user.avatar,
      content: replyText.trim(),
      time: '刚刚',
    })
    setComments([...comments])
    setReplyingTo(null)
    setReplyText('')
  }

  const avgRating = comments.length
    ? (comments.reduce((s, c) => s + c.rating, 0) / comments.length).toFixed(1)
    : '5.0'

  return (
    <div>
      <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} />

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
          background: 'linear-gradient(180deg, #b8860b 0%, #b8860b 100%)',
          borderRadius: '2px',
          boxShadow: '0 0 8px rgba(184, 134, 11, 0.4)',
        }} />
        <span style={{ fontSize: '14px', fontWeight: 700, color: '#b8860b', letterSpacing: '2px' }}>
          社区评价
        </span>
        <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, rgba(184, 134, 11, 0.3), transparent)' }} />
        <span style={{ fontSize: '13px', color: 'rgba(184, 134, 11, 0.7)', fontWeight: 600 }}>
          ⭐ {avgRating}
        </span>
      </div>

      {/* Comment input */}
      <div style={{
        background: 'linear-gradient(180deg, 0.95) 0%, rgba(255, 250, 240, 1) 100%)',
        borderRadius: '18px',
        padding: '18px',
        marginBottom: '16px',
        border: '1px solid rgba(184, 134, 11, 0.1)',
        backdropFilter: 'blur(20px)',
      }}>
        {/* Star rating */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => setRating(star)}
              style={{
                fontSize: '24px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                filter: star <= rating ? 'drop-shadow(0 0 4px rgba(184, 134, 11, 0.6))' : 'grayscale(1)',
                transition: 'all 0.2s ease',
              }}
            >
              {star <= rating ? '⭐' : '☆'}
            </button>
          ))}
          <span style={{ color: 'rgba(184, 134, 11, 0.6)', fontSize: '12px', alignSelf: 'center', marginLeft: '6px' }}>
            {rating === 5 ? '非常满意' : rating === 4 ? '满意' : rating === 3 ? '一般' : rating === 2 ? '不满意' : '很差'}
          </span>
        </div>

        <textarea
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder={isLoggedIn ? '分享您在造型师助手的体验...' : '登录后可发表评论'}
          readOnly={!isLoggedIn}
          onClick={() => {
            if (!isLoggedIn) setShowLogin(true)
          }}
          style={{
            width: '100%',
            minHeight: '80px',
            padding: '12px',
            borderRadius: '12px',
            border: '1px solid rgba(184, 134, 11, 0.15)',
            background: 'rgba(184, 134, 11, 0.06)',
            color: '#2c1810',
            fontSize: '14px',
            lineHeight: 1.7,
            resize: 'none',
            outline: 'none',
            boxSizing: 'border-box',
            fontFamily: 'inherit',
            cursor: isLoggedIn ? 'text' : 'pointer',
          }}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
          <button
            onClick={handleSubmitComment}
            disabled={!commentText.trim()}
            style={{
              padding: '10px 24px',
              borderRadius: '12px',
              border: 'none',
              background: commentText.trim()
                ? 'linear-gradient(135deg, #b8860b 0%, #b8860b 100%)'
                : 'rgba(184, 134, 11, 0.2)',
              color: commentText.trim() ? '#faf6f0' : 'rgba(184, 134, 11, 0.4)',
              fontSize: '13px',
              fontWeight: 700,
              cursor: commentText.trim() ? 'pointer' : 'not-allowed',
              letterSpacing: '1px',
              boxShadow: commentText.trim() ? '0 4px 16px rgba(184, 134, 11, 0.3)' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            发布评论
          </button>
        </div>
      </div>

      {/* Comment list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {comments.map((comment) => (
          <CommentCard
            key={comment.id}
            comment={comment}
            currentUser={user}
            onLike={() => handleToggleLike(comment.id)}
            onReply={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
            isReplying={replyingTo === comment.id}
            replyText={replyText}
            setReplyText={setReplyText}
            onSubmitReply={() => handleSubmitReply(comment.id)}
            onLoginRequired={() => setShowLogin(true)}
          />
        ))}
      </div>
    </div>
  )
}

function CommentCard({
  comment,
  currentUser,
  onLike,
  onReply,
  isReplying,
  replyText,
  setReplyText,
  onSubmitReply,
  onLoginRequired,
}: {
  comment: Comment
  currentUser: User | null
  onLike: () => void
  onReply: () => void
  isReplying: boolean
  replyText: string
  setReplyText: (v: string) => void
  onSubmitReply: () => void
  onLoginRequired: () => void
}) {
  return (
    <div style={{
      background: 'linear-gradient(180deg, 0.95) 0%, rgba(255, 250, 240, 1) 100%)',
      borderRadius: '16px',
      padding: '16px',
      border: '1px solid rgba(184, 134, 11, 0.1)',
      backdropFilter: 'blur(20px)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, rgba(184, 134, 11, 0.2) 0%, rgba(184, 134, 11, 0.08) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '18px',
          border: '1px solid rgba(184, 134, 11, 0.2)',
        }}>
          {comment.userAvatar}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#2c1810' }}>{comment.userName}</span>
            {comment.isMyComment && (
              <span style={{
                fontSize: '10px',
                padding: '2px 6px',
                borderRadius: '6px',
                background: 'rgba(184, 134, 11, 0.15)',
                color: '#b8860b',
                border: '1px solid rgba(184, 134, 11, 0.2)',
              }}>
                我的
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
            <span style={{ fontSize: '12px', color: '#b8860b' }}>{'⭐'.repeat(comment.rating)}</span>
            <span style={{ fontSize: '11px', color: 'rgba(184, 134, 11, 0.5)' }}>{comment.time}</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <p style={{
        margin: 0,
        fontSize: '14px',
        lineHeight: 1.8,
        color: 'rgba(44, 24, 16, 0.8)',
      }}>
        {comment.content}
      </p>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '16px', marginTop: '12px', alignItems: 'center' }}>
        <button
          onClick={onLike}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            background: 'none',
            border: 'none',
            color: comment.likedByMe ? '#ff6b8a' : 'rgba(184, 134, 11, 0.5)',
            fontSize: '13px',
            cursor: 'pointer',
            transition: 'color 0.2s ease',
          }}
        >
          {comment.likedByMe ? '❤️' : '🤍'} {comment.likes}
        </button>
        <button
          onClick={onReply}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            background: 'none',
            border: 'none',
            color: 'rgba(184, 134, 11, 0.5)',
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          💬 回复 {comment.replies.length > 0 && `(${comment.replies.length})`}
        </button>
      </div>

      {/* Replies */}
      {comment.replies.length > 0 && (
        <div style={{
          marginTop: '12px',
          paddingLeft: '16px',
          borderLeft: '2px solid rgba(184, 134, 11, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}>
          {comment.replies.map((reply) => (
            <div key={reply.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '14px' }}>{reply.userAvatar}</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#b8860b' }}>{reply.userName}</span>
                <span style={{ fontSize: '11px', color: 'rgba(184, 134, 11, 0.4)' }}>{reply.time}</span>
              </div>
              <p style={{ margin: '4px 0 0 28px', fontSize: '13px', lineHeight: 1.7, color: 'rgba(44, 24, 16, 0.75)' }}>
                {reply.content}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Reply input */}
      {isReplying && (
        <div style={{ marginTop: '12px', display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="写下你的回复..."
            style={{
              flex: 1,
              minHeight: '60px',
              padding: '10px 12px',
              borderRadius: '10px',
              border: '1px solid rgba(184, 134, 11, 0.2)',
              background: 'rgba(184, 134, 11, 0.06)',
              color: '#2c1810',
              fontSize: '13px',
              resize: 'none',
              outline: 'none',
              boxSizing: 'border-box',
              fontFamily: 'inherit',
            }}
          />
          <button
            onClick={onSubmitReply}
            disabled={!replyText.trim()}
            style={{
              padding: '10px 16px',
              borderRadius: '10px',
              border: 'none',
              background: replyText.trim() ? 'linear-gradient(135deg, #b8860b 0%, #b8860b 100%)' : 'rgba(184, 134, 11, 0.2)',
              color: replyText.trim() ? '#faf6f0' : 'rgba(184, 134, 11, 0.4)',
              fontSize: '12px',
              fontWeight: 700,
              cursor: replyText.trim() ? 'pointer' : 'not-allowed',
              whiteSpace: 'nowrap',
            }}
          >
            发送
          </button>
        </div>
      )}
    </div>
  )
}