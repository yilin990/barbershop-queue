// chat/service.ts - API wrapper for 造型助手 AI chat

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3000'
const SESSION_KEY = 'zhilin_pharmacist_session'
const MSGS_KEY = 'zhilin_pharmacist_msgs'

// ---------------------------------------------------------------------------
// 卡片类型（奕霖 2026-06-30 20:53 需求：AI 不只说，要展示）
// ---------------------------------------------------------------------------
export type CardType = 'order' | 'product' | 'appointment'

export interface OrderCardData {
  type: 'order'
  orderId: string
  orderNo: string
  status: 'pending' | 'paid' | 'preparing' | 'ready' | 'delivered' | 'cancelled'
  statusLabel: string
  pickupCode?: string
  pickupExpiresAt?: string
  finalAmount: number
  itemCount: number
  itemSummary: string // e.g. "熚冒灵颗粒 × 1"
  createdAt: string
}

export interface ProductCardData {
  type: 'product'
  productId: string
  name: string
  spec?: string
  price: number
  memberPrice?: number
  image?: string
  available: boolean
}

export interface AppointmentCardData {
  type: 'appointment'
  appointmentId: string
  serviceName: string
  merchantName: string
  appointmentTime: string
  orderNo: string
}

export type Card = OrderCardData | ProductCardData | AppointmentCardData

export interface Message {
  role: 'user' | 'assistant'
  content: string
  time: number
  // ⭐ 奕霖 2026-06-30 20:53：AI 卡片系统
  cards?: Card[]
}

export interface SendResult {
  reply: string
  session_id: string
  // ⭐ 卡片数据
  cards?: Card[]
}

function getSessionId(): string {
  if (typeof window === 'undefined') return ''
  let sid = localStorage.getItem(SESSION_KEY)
  if (!sid) {
    sid = 'pharmacist_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
    localStorage.setItem(SESSION_KEY, sid)
  }
  return sid
}

export function getSavedMessages(): Message[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(MSGS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveMessages(msgs: Message[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(MSGS_KEY, JSON.stringify(msgs.slice(-100)))
}

export async function sendMessage(
  history: Message[],
  newText: string
): Promise<SendResult> {
  const sessionId = getSessionId()
  // 构造完整消息历史：包含所有历史消息 + 新消息
  const allMessages: Message[] = [
    ...history,
    { role: 'user', content: newText.trim(), time: Date.now() },
  ]
  // 转为后端期望的格式（只留 role + content）
  const messages = allMessages.map(m => ({ role: m.role, content: m.content }))

  // 读取本地缓存的用户位置（如果有）
  let userLat: number | undefined
  let userLng: number | undefined
  if (typeof window !== 'undefined') {
    const userLoc = localStorage.getItem('zhilin_user_location')
    if (userLoc) {
      try {
        const parsed = JSON.parse(userLoc)
        userLat = parsed.lat
        userLng = parsed.lng
      } catch {}
    }
  }

  const res = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, session_id: sessionId, userLat, userLng }),
  })
  if (!res.ok) throw new Error('Request failed: ' + res.status)
  const data = await res.json()
  return data as SendResult
}

// 缓存用户位置
export function saveUserLocation(lat: number, lng: number) {
  if (typeof window === 'undefined') return
  localStorage.setItem('zhilin_user_location', JSON.stringify({ lat, lng, savedAt: Date.now() }))
}

export function clearSession() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(SESSION_KEY)
  localStorage.removeItem(MSGS_KEY)
}