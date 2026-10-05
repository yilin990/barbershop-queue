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
  // ⭐ 2026-10-05 01:48 奕霖立：打通 barber 预约数据 — 订单卡牌需要和预约信息一致
  serviceName?: string      // 具体项目 e.g. "剪发" / "染发" / "烫发"
  stylistName?: string      // 具体理发师 e.g. "Lily 老师" / "Tony"
  scheduledDate?: string    // YYYY-MM-DD（从 'tomorrow' word 转过来的真日期）
  scheduledTime?: string    // HH:MM e.g. "11:00"
  // ⭐ 2026-10-05 02:33 奕霖立：区分预约 vs 商品 — 用 source 判断 OrderCard 布局
  // 'booking'/'ticket' → 预约卡牌（服务/理发师/时间，不显示 ¥ 和 件数）
  // 'normal'/'pos-store'/'flash_sale'/'group'/'activity' → 商品卡牌（¥/件数/取货码，不显示 服务/理发师）
  source?: 'normal' | 'pos-store' | 'flash_sale' | 'group' | 'activity' | 'booking' | 'ticket'
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