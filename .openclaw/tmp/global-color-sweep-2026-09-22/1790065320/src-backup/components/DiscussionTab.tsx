'use client'

import { toast } from '@/lib/ui-bus'
import { confirmDialog } from '@/lib/ui-bus'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUserStore } from '@/stores/userStore'

// 11 疾病分类
const CATEGORIES = [
 { key: 'all', name: '全部', icon: '📋', color: '#b8860b' },
 { key: 'cold', name: '感冒', icon: '🤧', color: '#60a5fa' },
 { key: 'stomach', name: '胃痛', icon: '😣', color: '#fb923c' },
 { key: 'headache', name: '头痛', icon: '🤕', color: '#f87171' },
 { key: 'cough', name: '咳嗽', icon: '😷', color: '#a78bfa' },
 { key: 'allergy', name: '过敏', icon: '🤧', color: '#b8860b' },
 { key: 'hypertension', name: '高血压', icon: '❤️', color: '#ef4444' },
 { key: 'diabetes', name: '糖尿病', icon: '🩸', color: '#ec4899' },
 { key: 'sleep', name: '失眠', icon: '😴', color: '#818cf8' },
 { key: 'child', name: '儿童', icon: '👶', color: '#34d399' },
 { key: 'chronic', name: '慢病', icon: '🍵', color: '#94a3b8' },
]

interface DiscussionPost {
 id: string
 category: string
 title: string
 excerpt: string
 author: string
 avatar: string
 time: string
 replies: number
 likes: number
 tags: string[]
 userId: string
}

export default function DiscussionTab() {
 const router = useRouter()
 const { user, token } = useUserStore()
 const [activeCategory, setActiveCategory] = useState('all')
 const [searchQuery, setSearchQuery] = useState('')
 const [showAskAI, setShowAskAI] = useState(false)
 const [showNewPost, setShowNewPost] = useState(false)
 const [posts, setPosts] = useState<DiscussionPost[]>([])
 const [loading, setLoading] = useState(true)
 const [error, setError] = useState<string | null>(null)
 const [liking, setLiking] = useState<string | null>(null)

 // 加载讨论列表
 const fetchPosts = async () => {
  setLoading(true)
  setError(null)
  try {
   const params = new URLSearchParams()
   if (activeCategory !== 'all') params.set('category', activeCategory)
   if (searchQuery) params.set('search', searchQuery)
   params.set('limit', '50')

   const res = await fetch(`/api/discussions?${params.toString()}`)
   const data = await res.json()
   if (data.success) {
    setPosts(data.posts)
   } else {
    setError(data.error || '加载失败')
   }
  } catch (err: any) {
   setError(err.message || '网络错误')
  } finally {
   setLoading(false)
  }
 }

 useEffect(() => {
  fetchPosts()
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [activeCategory])

 // 搜索防抖
 useEffect(() => {
  const t = setTimeout(() => fetchPosts(), 400)
  return () => clearTimeout(t)
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [searchQuery])

 const getCurrentCategory = () => CATEGORIES.find(c => c.key === activeCategory) || CATEGORIES[0]

 const getCategoryColor = (key: string) => {
  const cat = CATEGORIES.find(c => c.key === key)
  return cat?.color || '#b8860b'
 }

 const handleLike = async (post: DiscussionPost) => {
  if (!token) {
   toast.info('请先登录')
   return
  }
  if (liking === post.id) return
  setLiking(post.id)
  // 乐观更新
  setPosts(prev => prev.map(p => p.id === post.id ? { ...p, likes: p.likes + 1 } : p))
  try {
   const res = await fetch(`/api/discussions/${post.id}/like`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ action: 'like' }),
   })
   const data = await res.json()
   if (data.success) {
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, likes: data.likes } : p))
   } else {
    // 回滚
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, likes: p.likes - 1 } : p))
    toast.error(data.error || '点赞失败')
   }
  } catch {
   setPosts(prev => prev.map(p => p.id === post.id ? { ...p, likes: p.likes - 1 } : p))
   toast.error('网络错误')
  } finally {
   setLiking(null)
  }
 }

 const handleDelete = async (postId: string) => {
  if (!await confirmDialog('确定要删除这个帖子吗？')) return
  try {
   const res = await fetch(`/api/discussions/${postId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` },
   })
   const data = await res.json()
   if (data.success) {
    setPosts(prev => prev.filter(p => p.id !== postId))
   } else {
    toast.error(data.error || '删除失败')
   }
  } catch {
   toast.error('网络错误')
  }
 }

 const handleAskAI = (prefillText: string) => {
  // 跳到 /pharmacist，把 prefill 通过 query 传过去
  router.push(`/pharmacist?prefill=${encodeURIComponent(prefillText)}`)
  setShowAskAI(false)
 }

 return (
 <div style={{ padding: '0 0 100px 0' }}>
 {/* 顶部搜索 */}
 <div style={{ marginBottom: '16px' }}>
 <input
 type="text"
 placeholder="🔍 搜索症状/帖子..."
 value={searchQuery}
 onChange={e => setSearchQuery(e.target.value)}
 style={{
 width: '100%',
 padding: '12px 16px',
 background: 'rgba(44, 24, 16,0.05)',
 border: '1px solid rgba(184,134,11,0.2)',
 borderRadius: '14px',
 color: '#2c1810',
 fontSize: '14px',
 outline: 'none',
 boxSizing: 'border-box',
 }}
 />
 </div>

 {/* 疾病分类导航 - 横向滚动 */}
 <div style={{
 display: 'flex',
 gap: '8px',
 overflowX: 'auto',
 paddingBottom: '12px',
 marginBottom: '16px',
 scrollbarWidth: 'none',
 WebkitOverflowScrolling: 'touch',
 }}>
 {CATEGORIES.map(cat => (
 <button
 key={cat.key}
 onClick={() => setActiveCategory(cat.key)}
 style={{
 padding: '8px 14px',
 borderRadius: '20px',
 border: activeCategory === cat.key
 ? `1px solid ${cat.color}`
 : '1px solid rgba(44, 24, 16,0.1)',
 background: activeCategory === cat.key
 ? `${cat.color}22`
 : 'rgba(44, 24, 16,0.03)',
 color: activeCategory === cat.key ? cat.color : 'rgba(44, 24, 16,0.6)',
 fontSize: '13px',
 fontWeight: 600,
 cursor: 'pointer',
 whiteSpace: 'nowrap',
 display: 'flex',
 alignItems: 'center',
 gap: '4px',
 flexShrink: 0,
 transition: 'all 0.2s',
 }}
 >
 <span>{cat.icon}</span>
 <span>{cat.name}</span>
 </button>
 ))}
 </div>

 {/* 当前分类提示 + AI 按钮 + 我要发帖 */}
 <div style={{
 background: `${getCurrentCategory().color}11`,
 border: `1px solid ${getCurrentCategory().color}33`,
 borderRadius: '16px',
 padding: '14px 16px',
 marginBottom: '16px',
 display: 'flex',
 alignItems: 'center',
 justifyContent: 'space-between',
 gap: '8px',
 }}>
 <div style={{ flex: 1, minWidth: 0 }}>
 <div style={{ color: getCurrentCategory().color, fontSize: '14px', fontWeight: 600 }}>
 {getCurrentCategory().icon} {getCurrentCategory().name} 讨论区
 </div>
 <div style={{ color: 'rgba(44, 24, 16,0.5)', fontSize: '11px', marginTop: '2px' }}>
 {loading ? '加载中...' : `${posts.length} 个帖子 · 果小蔬 AI 24h 在线`}
 </div>
 </div>
 <button
 onClick={() => setShowNewPost(true)}
 style={{
 padding: '8px 12px',
 background: 'rgba(44, 24, 16,0.1)',
 color: '#2c1810',
 border: '1px solid rgba(44, 24, 16,0.2)',
 borderRadius: '10px',
 fontSize: '12px',
 fontWeight: 600,
 cursor: 'pointer',
 flexShrink: 0,
 }}
 >✏️ 我要发帖</button>
 <button
 onClick={() => setShowAskAI(true)}
 style={{
 padding: '8px 12px',
 background: getCurrentCategory().color,
 color: '#000',
 border: 'none',
 borderRadius: '10px',
 fontSize: '12px',
 fontWeight: 600,
 cursor: 'pointer',
 flexShrink: 0,
 }}
 >🍵 问果小蔬</button>
 </div>

 {/* 帖子列表 */}
 <div>
 {loading ? (
 <div style={{ textAlign: 'center', padding: '40px 20px', color: 'rgba(44, 24, 16,0.4)' }}>
 <div style={{ fontSize: '32px', marginBottom: '12px' }}>⏳</div>
 <div>加载中...</div>
 </div>
 ) : error ? (
 <div style={{ textAlign: 'center', padding: '40px 20px', color: 'rgba(248,113,113,0.8)' }}>
 <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚠️</div>
 <div>{error}</div>
 <button onClick={fetchPosts} style={{ marginTop: '12px', padding: '6px 16px', background: 'rgba(44, 24, 16,0.1)', border: 'none', borderRadius: '8px', color: '#2c1810', cursor: 'pointer' }}>重试</button>
 </div>
 ) : posts.length === 0 ? (
 <div style={{
 textAlign: 'center',
 padding: '40px 20px',
 color: 'rgba(44, 24, 16,0.4)',
 }}>
 <div style={{ fontSize: '40px', marginBottom: '12px' }}>🤔</div>
 <div>暂无相关讨论</div>
 <div style={{ fontSize: '12px', marginTop: '8px' }}>试着发帖或问果小蔬</div>
 </div>
 ) : (
 posts.map(post => (
 <div
 key={post.id}
 style={{
 background: 'rgba(44, 24, 16,0.04)',
 border: '1px solid rgba(44, 24, 16,0.08)',
 borderRadius: '16px',
 padding: '14px 16px',
 marginBottom: '10px',
 transition: 'all 0.2s',
 }}
 >
 {/* 分类标签 */}
 <div style={{
 display: 'inline-block',
 padding: '2px 8px',
 background: `${getCategoryColor(post.category)}22`,
 color: getCategoryColor(post.category),
 borderRadius: '6px',
 fontSize: '10px',
 fontWeight: 600,
 marginBottom: '8px',
 }}>
 {CATEGORIES.find(c => c.key === post.category)?.name || post.category}
 </div>

 {/* 标题 */}
 <div style={{
 color: '#2c1810',
 fontSize: '15px',
 fontWeight: 600,
 marginBottom: '6px',
 lineHeight: 1.4,
 }}>
 {post.title}
 </div>

 {/* 摘要 */}
 <div style={{
 color: 'rgba(44, 24, 16,0.55)',
 fontSize: '13px',
 lineHeight: 1.5,
 marginBottom: '10px',
 display: '-webkit-box',
 WebkitLineClamp: 2,
 WebkitBoxOrient: 'vertical',
 overflow: 'hidden',
 }}>
 {post.excerpt}
 </div>

 {/* 标签 */}
 {post.tags && post.tags.length > 0 && (
 <div style={{
 display: 'flex',
 flexWrap: 'wrap',
 gap: '4px',
 marginBottom: '10px',
 }}>
 {post.tags.map(tag => (
 <span key={tag} style={{
 padding: '1px 8px',
 background: 'rgba(184,134,11,0.1)',
 color: 'rgba(184,134,11,0.7)',
 borderRadius: '6px',
 fontSize: '10px',
 }}>#{tag}</span>
 ))}
 </div>
 )}

 {/* 底部信息 */}
 <div style={{
 display: 'flex',
 alignItems: 'center',
 justifyContent: 'space-between',
 fontSize: '12px',
 color: 'rgba(44, 24, 16,0.4)',
 }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
 <span>{post.avatar}</span>
 <span>{post.author}</span>
 <span style={{ margin: '0 4px' }}>·</span>
 <span>{post.time}</span>
 </div>
 <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
 <span>💬 {post.replies}</span>
 <button
 onClick={(e) => { e.stopPropagation(); handleLike(post) }}
 disabled={liking === post.id}
 style={{
 background: 'transparent',
 border: 'none',
 color: 'rgba(248,113,113,0.8)',
 cursor: liking === post.id ? 'wait' : 'pointer',
 fontSize: '12px',
 padding: 0,
 display: 'flex',
 alignItems: 'center',
 gap: '4px',
 }}
 >❤️ {post.likes}</button>
 {/* 自己的帖可删除 */}
 {user?.id === post.userId && (
 <button
 onClick={(e) => { e.stopPropagation(); handleDelete(post.id) }}
 style={{
 background: 'transparent',
 border: 'none',
 color: 'rgba(248,113,113,0.5)',
 cursor: 'pointer',
 fontSize: '11px',
 padding: 0,
 }}
 >删除</button>
 )}
 </div>
 </div>
 </div>
 ))
 )}
 </div>

 {/* AI 问诊弹窗 */}
 {showAskAI && (
 <div
 onClick={() => setShowAskAI(false)}
 style={{
 position: 'fixed',
 top: 0, left: 0, right: 0, bottom: 0,
 background: 'rgba(0,0,0,0.7)',
 display: 'flex',
 alignItems: 'flex-end',
 zIndex: 200,
 }}
 >
 <div
 onClick={(e) => e.stopPropagation()}
 style={{
 background: '#faf6f0',
 borderTopLeftRadius: '24px',
 borderTopRightRadius: '24px',
 padding: '20px',
 width: '100%',
 maxHeight: '60vh',
 border: '1px solid rgba(184,134,11,0.2)',
 borderBottom: 'none',
 }}
 >
 <div style={{
 textAlign: 'center',
 marginBottom: '12px',
 color: getCurrentCategory().color,
 fontSize: '14px',
 fontWeight: 600,
 }}>
 {getCurrentCategory().icon} 问果小蔬关于「{getCurrentCategory().name}」的问题
 </div>
 <textarea
 placeholder={`例如: ${getCurrentCategory().name === '感冒' ? '我最近鼻塞流涕 3 天了，怎么办？' : getCurrentCategory().name + ' 有什么缓解方法？'}`}
 style={{
 width: '100%',
 minHeight: '100px',
 padding: '12px',
 background: 'rgba(44, 24, 16,0.05)',
 border: '1px solid rgba(184,134,11,0.2)',
 borderRadius: '12px',
 color: '#2c1810',
 fontSize: '14px',
 outline: 'none',
 boxSizing: 'border-box',
 resize: 'none',
 marginBottom: '12px',
 fontFamily: 'inherit',
 }}
 />
 <button
 onClick={(e) => {
 const ta = (e.currentTarget.previousElementSibling as HTMLTextAreaElement)
 handleAskAI(ta?.value || `我想咨询关于${getCurrentCategory().name}的问题`)
 }}
 style={{
 width: '100%',
 padding: '12px',
 background: getCurrentCategory().color,
 color: '#000',
 border: 'none',
 borderRadius: '12px',
 fontSize: '14px',
 fontWeight: 600,
 cursor: 'pointer',
 }}
 >🍵 跳转问果小蔬</button>
 </div>
 </div>
 )}

 {/* 我要发帖弹窗 */}
 {showNewPost && (
 <NewPostModal
 category={activeCategory}
 onClose={() => setShowNewPost(false)}
 onCreated={() => { setShowNewPost(false); fetchPosts() }}
 token={token}
 />
 )}
 </div>
 )
}

// ============== NewPostModal 子组件 ==============
function NewPostModal({
 category,
 onClose,
 onCreated,
 token,
}: {
 category: string
 onClose: () => void
 onCreated: () => void
 token: string | null
}) {
 const [title, setTitle] = useState('')
 const [content, setContent] = useState('')
 const [tagsInput, setTagsInput] = useState('')
 const [submitting, setSubmitting] = useState(false)
 const [error, setError] = useState<string | null>(null)

 const handleSubmit = async () => {
  if (!token) {
   setError('请先登录')
   return
  }
  if (!title.trim() || !content.trim()) {
   setError('标题和内容不能为空')
   return
  }
  setSubmitting(true)
  setError(null)
  try {
   const tags = tagsInput
    .split(/[,，\s]+/)
    .map(t => t.trim().replace(/^#/, ''))
    .filter(Boolean)
    .slice(0, 6)
   const res = await fetch('/api/discussions', {
    method: 'POST',
    headers: {
     'Content-Type': 'application/json',
     'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
     category: category === 'all' ? 'cold' : category, // all 时给默认
     title: title.trim(),
     content: content.trim(),
     tags,
    }),
   })
   const data = await res.json()
   if (data.success) {
    onCreated()
   } else {
    setError(data.error || '发布失败')
   }
  } catch (e: any) {
   setError(e.message || '网络错误')
  } finally {
   setSubmitting(false)
  }
 }

 return (
 <div
 onClick={onClose}
 style={{
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  background: 'rgba(0,0,0,0.7)',
  display: 'flex', alignItems: 'flex-end',
  zIndex: 200,
 }}
 >
  <div
  onClick={(e) => e.stopPropagation()}
  style={{
   background: '#faf6f0',
   borderTopLeftRadius: '24px',
   borderTopRightRadius: '24px',
   padding: '20px',
   width: '100%',
   maxHeight: '85vh',
   overflowY: 'auto',
   border: '1px solid rgba(184,134,11,0.2)',
   borderBottom: 'none',
  }}
  >
  <div style={{ textAlign: 'center', marginBottom: '16px', color: '#b8860b', fontSize: '16px', fontWeight: 600 }}>
   ✏️ 发新帖
  </div>

  {error && (
   <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '8px', padding: '8px 12px', marginBottom: '12px', color: '#f87171', fontSize: '13px' }}>
   {error}
   </div>
  )}

  <div style={{ marginBottom: '12px' }}>
   <div style={{ color: 'rgba(44, 24, 16,0.6)', fontSize: '12px', marginBottom: '6px' }}>标题</div>
   <input
   type="text"
   value={title}
   onChange={e => setTitle(e.target.value)}
   placeholder="一句话描述你的问题..."
   maxLength={80}
   style={{
    width: '100%',
    padding: '12px',
    background: 'rgba(44, 24, 16,0.05)',
    border: '1px solid rgba(184,134,11,0.2)',
    borderRadius: '12px',
    color: '#2c1810',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
   }}
   />
   <div style={{ textAlign: 'right', color: 'rgba(44, 24, 16,0.3)', fontSize: '11px', marginTop: '4px' }}>
   {title.length}/80
   </div>
  </div>

  <div style={{ marginBottom: '12px' }}>
   <div style={{ color: 'rgba(44, 24, 16,0.6)', fontSize: '12px', marginBottom: '6px' }}>内容</div>
   <textarea
   value={content}
   onChange={e => setContent(e.target.value)}
   placeholder="详细描述你的症状、用药情况等..."
   maxLength={1000}
   style={{
    width: '100%',
    minHeight: '120px',
    padding: '12px',
    background: 'rgba(44, 24, 16,0.05)',
    border: '1px solid rgba(184,134,11,0.2)',
    borderRadius: '12px',
    color: '#2c1810',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
    resize: 'none',
    fontFamily: 'inherit',
   }}
   />
   <div style={{ textAlign: 'right', color: 'rgba(44, 24, 16,0.3)', fontSize: '11px', marginTop: '4px' }}>
   {content.length}/1000
   </div>
  </div>

  <div style={{ marginBottom: '16px' }}>
   <div style={{ color: 'rgba(44, 24, 16,0.6)', fontSize: '12px', marginBottom: '6px' }}>标签（逗号或空格分隔，最多 6 个）</div>
   <input
   type="text"
   value={tagsInput}
   onChange={e => setTagsInput(e.target.value)}
   placeholder="如: 鼻塞, 流涕, 受凉"
   style={{
    width: '100%',
    padding: '12px',
    background: 'rgba(44, 24, 16,0.05)',
    border: '1px solid rgba(184,134,11,0.2)',
    borderRadius: '12px',
    color: '#2c1810',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
   }}
   />
  </div>

  <button
   onClick={handleSubmit}
   disabled={submitting}
   style={{
   width: '100%',
   padding: '14px',
   background: submitting ? 'rgba(184,134,11,0.4)' : '#b8860b',
   color: '#000',
   border: 'none',
   borderRadius: '12px',
   fontSize: '15px',
   fontWeight: 600,
   cursor: submitting ? 'wait' : 'pointer',
   }}
  >{submitting ? '发布中...' : '发布'}</button>
  </div>
 </div>
 )
}
