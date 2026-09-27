/**
 * ChatLog — 果小蔬 AI 鲜蔬顾问对话记录持久化
 *
 * 2026-07-20 16:17 奕霖"换位思考"反馈：
 * - 老板视角看: AI 药师在听到什么？→ 之前完全没存，调完 API 就没了
 * - 价值: lighthouse case 关键 demo ("AI 真帮老板听到顾客要什么")
 *
 * 设计:
 * - 用 SQLite 手建表（prisma db push 会破现有数据）
 * - 只在 /api/chat/route.ts 末尾调用 saveChatLog
 * - 后台读取: /api/admin/ai-chat
 */

import { prisma } from './db'
import { randomUUID } from 'crypto'

export interface ChatLogPayload {
  phone?: string
  userName?: string
  userMessage: string
  aiReply: string
  tools?: string[] // 例如 ['create_order', 'search_products']
  isEmergency?: boolean
}

/**
 * 保存一条 AI 药师对话日志。
 * 失败不抛错（异步 fire-and-forget，避免影响主链路）。
 */
export async function saveChatLog(payload: ChatLogPayload): Promise<string | null> {
  try {
    const id = randomUUID()
    await prisma.$executeRawUnsafe(
      `INSERT INTO ChatLog (id, phone, userName, userMessage, aiReply, tools, isEmergency, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      payload.phone || null,
      payload.userName || null,
      payload.userMessage.slice(0, 1000),
      payload.aiReply.slice(0, 2000),
      JSON.stringify(payload.tools || []),
      payload.isEmergency ? 1 : 0,
      new Date().toISOString()
    )
    return id
  } catch (err: any) {
    console.error('[chat-log] saveChatLog failed:', err?.message || err)
    return null
  }
}

/**
 * 删除某用户的所有对话记录（GDPR 合规 / 用户主动注销用）
 */
export async function deleteChatLogsByPhone(phone: string): Promise<number> {
  try {
    const result = await prisma.$executeRawUnsafe(
      `DELETE FROM ChatLog WHERE phone = ?`,
      phone
    )
    return Number(result) || 0
  } catch {
    return 0
  }
}

/**
 * 后台读取接口的数据结构
 */
export interface AdminChatLogRow {
  id: string
  phone: string | null
  userName: string | null
  userMessage: string
  aiReply: string
  tools: string[]
  isEmergency: boolean
  createdAt: string
}
