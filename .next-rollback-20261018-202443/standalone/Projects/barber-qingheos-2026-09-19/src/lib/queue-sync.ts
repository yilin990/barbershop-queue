/**
 * 下单 → 排队 同步模块 —— v1.1.54 · 2026-10-08 清禾
 *
 * 🔴 背景（试点阻断级 bug）：
 *   /api/orders 与 /api/queues 是两套独立系统，各写各的表。
 *   顾客在门店主页在线预约 → 走 /api/orders → 落到 m_grocery_001（果蔬店）
 *   店长排队页 → 走 /api/queues → 读 m_barber_001 的 BarberQueue
 *   结果：顾客预约成功，店长永远看不到。
 *
 * 这个模块负责在下单成功后，同步写一条 BarberQueue，
 * 让店长在同一个排队页看到「到店取号」+「在线预约」两类客人。
 *
 * 复用 queues/route.ts 的 orderNo 生成算法（A/B 前缀 + 3 位序号 + 冲突自增），
 * 保证在线预约和到店取号用同一套编号空间，不会撞号。
 */

import { getQueueDb } from './queue-db'

export interface EnqueueInput {
  merchantId: string
  /** 来源订单号，写进 note 便于对账 */
  orderNo?: string
  customerName: string
  customerPhone: string
  service?: string
  stylistName?: string
  /** 预约时间，如 '14:30' */
  scheduledAt?: string
  scheduledDate?: string
  note?: string
}

export interface EnqueueResult {
  queueId: string
  queueOrderNo: string
}

/**
 * 写一条排队记录。orderNo 冲突时自增重试，绝不丢单。
 *（与 queues/route.ts 同一套逻辑 —— v1.1.31 修过的 phantom success bug）
 */
export function enqueueFromOrder(input: EnqueueInput): EnqueueResult {
  const db = getQueueDb()
  try {
    const merchantId = input.merchantId.trim()
    const customerPhone = (input.customerPhone || '').trim()
    if (!merchantId) throw new Error('merchantId 必填')
    if (!customerPhone) throw new Error('customerPhone 必填')

    // 在线预约固定走 A 序列（预约），到店取号是 B 序列
    const prefix = 'A'
    let seq = Date.now() % 100000
    const exists = (no: string) =>
      !!db.prepare('SELECT 1 FROM BarberQueue WHERE orderNo = ? AND merchantId = ?').get(no, merchantId)

    let finalOrderNo = ''
    for (let i = 0; i < 500; i++) {
      const candidate = prefix + String(seq).padStart(3, '0')
      if (!exists(candidate)) { finalOrderNo = candidate; break }
      seq++
    }
    if (!finalOrderNo) {
      finalOrderNo = prefix + Date.now().toString(36).toUpperCase().slice(-6)
    }

    const id = 'q_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
    const service = input.service || '剪发'
    const stylistName = input.stylistName || '待分配'
    const scheduledAt = input.scheduledAt || ''
    const scheduledDate = input.scheduledDate || 'today'
    // 来源订单号写进 note，店长侧可反查
    const note = input.orderNo ? `在线预约 · 单号 ${input.orderNo}` : input.note || '在线预约'

    db.prepare(`
      INSERT INTO BarberQueue (
        id, merchantId, orderNo, type, customerName, customerPhone,
        service, stylistName, stylistCode, status, scheduledAt, scheduledDate,
        arrivedAt, startedAt, completedAt, note
      )
      VALUES (?, ?, ?, 'booking', ?, ?, ?, ?, NULL, 'reserved', ?, ?, NULL, NULL, NULL, ?)
    `).run(
      id, merchantId, finalOrderNo,
      input.customerName || '顾客', customerPhone,
      service, stylistName,
      scheduledAt, scheduledDate,
      note,
    )

    return { queueId: id, queueOrderNo: finalOrderNo }
  } finally {
    db.close()
  }
}
