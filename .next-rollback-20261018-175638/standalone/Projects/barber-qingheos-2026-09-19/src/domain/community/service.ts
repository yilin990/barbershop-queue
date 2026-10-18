// Comment utilities - mock data & actions

export interface Comment {
  id: string
  userId: string
  userName: string
  userAvatar: string
  rating: number        // 1-5 stars
  content: string
  time: string
  likes: number
  likedByMe: boolean
  replies: Reply[]
  isMyComment?: boolean
}

export interface Reply {
  id: string
  userId: string
  userName: string
  userAvatar: string
  content: string
  time: string
}

export interface Feedback {
  id: string
  type: string          // tag
  content: string
  time: string
  status: 'pending' | 'resolved'
}

// Mock comments data
export const MOCK_COMMENTS: Comment[] = [
  {
    id: 'c1',
    userId: 'u1',
    userName: '铜仁老街坊',
    userAvatar: '🏘️',
    rating: 5,
    content: '造型师助手是我从小就去的地方，价格公道，店员实在。特别是那位老爷子，每次买药都讲得清清楚楚，不让你多花冤枉钱。',
    time: '3天前',
    likes: 28,
    likedByMe: false,
    replies: [
      {
        id: 'r1',
        userId: 'u2',
        userName: '造型师助手',
        userAvatar: '🍵',
        content: '感谢您一直以来的信任与支持！老药房会继续努力～',
        time: '2天前',
      },
    ],
  },
  {
    id: 'c2',
    userId: 'u3',
    userName: '健康达人',
    userAvatar: '🌿',
    rating: 5,
    content: '晚上10点还能买到药，对于我们这种加班族真的太友好了！客服也很耐心，会认真回答用药问题。',
    time: '1周前',
    likes: 15,
    likedByMe: false,
    replies: [],
  },
  {
    id: 'c3',
    userId: 'u4',
    userName: '养生一族',
    userAvatar: '🍵',
    rating: 4,
    content: '中药饮片质量很好，煎煮方法店员都会详细说明。唯一希望是能开通线上买药，送药上门就更方便了～',
    time: '2周前',
    likes: 9,
    likedByMe: false,
    replies: [],
  },
]

// Mock feedbacks
export const MOCK_FEEDBACKS: Feedback[] = []

// In-memory store for demo (persisted via localStorage in components)
let nextCommentId = 100
let nextReplyId = 200
let nextFeedbackId = 300

export function addComment(comment: Omit<Comment, 'id'>): Comment {
  const newComment: Comment = { ...comment, id: `c${++nextCommentId}` }
  MOCK_COMMENTS.unshift(newComment)
  return newComment
}

export function toggleLike(commentId: string, userId: string): void {
  const comment = MOCK_COMMENTS.find((c) => c.id === commentId)
  if (!comment) return
  if (comment.likedByMe) {
    comment.likes = Math.max(0, comment.likes - 1)
    comment.likedByMe = false
  } else {
    comment.likes += 1
    comment.likedByMe = true
  }
}

export function addReply(commentId: string, reply: Omit<Reply, 'id'>): Reply {
  const comment = MOCK_COMMENTS.find((c) => c.id === commentId)
  const newReply: Reply = { ...reply, id: `r${++nextReplyId}` }
  if (comment) {
    comment.replies.push(newReply)
  }
  return newReply
}

export function submitFeedback(feedback: Omit<Feedback, 'id' | 'status'>): Feedback {
  const newFeedback: Feedback = { ...feedback, id: `f${++nextFeedbackId}`, status: 'pending' }
  MOCK_FEEDBACKS.push(newFeedback)
  return newFeedback
}

export function getMyComments(userId: string): Comment[] {
  return MOCK_COMMENTS.filter((c) => c.userId === userId || c.isMyComment)
}

export function getMyFeedbacks(): Feedback[] {
  const stored = localStorage.getItem('zhilin-feedbacks')
  if (stored) {
    try {
      return JSON.parse(stored)
    } catch {
      return []
    }
  }
  return MOCK_FEEDBACKS
}