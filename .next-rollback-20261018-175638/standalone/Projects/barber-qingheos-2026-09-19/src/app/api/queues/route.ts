/**
 * /api/queues - 队列订单 API（2026-10-02 奕霖拍板根治方案 + v1.1 双写 Order）
 *
 *   GET    /api/queues?merchantId=xxx          列表
 *   POST   /api/queues                          新增（v1.1：同时写入 Order 表 → /orders 能看到）
 *
 * 多租户：merchantId 强校验
 * 数据源：SQLite (dev.db) BarberQueue 表 + Order 表（双写，better-sqlite3 直接 INSERT 避开 Prisma 写库连接问题）
 *
 * ⭐ v1.1 (2026-10-04 18:48 奕霖"全做吧"双确认)：
 *   - POST 同时写 Order 表（pickupCode = 6 位数字，generatePickupCode 复用）
 *   - booking 路径也能在 /orders 页面看到
 *   - 不影响 BookingSection 现有 BarberQueue 流程
 *   - 用 better-sqlite3 直接 INSERT（Prisma.create() 写库连接跟 better-sqlite3 冲突，SQLite 不见记录）
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { errorResponse, successResponse } from '@/lib/error'
import { generatePickupCode } from '@/lib/pickup-code'
import Database from 'better-sqlite3'
import path from 'path'
import { resolveDbPath } from '../../../lib/db-path'

export const runtime = 'nodejs'

const DB_PATH = resolveDbPath() // ⭐ v1.1.2 改绝对路径（standalone 进程的 cwd 是 .next/standalone/.../，相对路径会指向错的 db 文件）

function getDb() {
  return new Database(DB_PATH)
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const merchantId = (searchParams.get('merchantId') || '').trim()
    const phone = (searchParams.get('phone') || '').trim()

    // ⭐ 2026-10-05 01:06 奕霖立：phone-only 查询（/orders 拉用户全部预约/取号）
    // 当只有 phone 不带 merchantId 时，查该手机号在所有商户的 barber 记录
    if (phone && !merchantId) {
      const db = getDb()
      const rows = db.prepare(`
        SELECT q.id, q.merchantId, q.orderNo, q.type, q.customerName, q.customerPhone,
        q.service, q.stylistName, q.stylistCode, q.status, q.scheduledAt, q.scheduledDate,
        q.arrivedAt, q.startedAt, q.completedAt, q.note, q.createdAt, q.updatedAt,
        s.id AS settlementId, s.listCents, s.discountRate, s.dueCents,
        s.payMethod, s.cardId AS settlementCardId, s.operator, s.createdAt AS settledAt
        FROM BarberQueue q
        LEFT JOIN Settlement s ON s.queueId = q.id
        WHERE q.customerPhone = ?
        ORDER BY q.createdAt DESC
        LIMIT 200
      `).all(phone)
      db.close()
      return successResponse({ queues: rows, total: rows.length })
    }

    if (!merchantId) return errorResponse(new Error('merchantId 必填'), 400)

    // ⭐ 验证商户存在（多租户隔离）
    const merchant = await prisma.merchant.findUnique({ where: { id: merchantId }, select: { id: true } })
    if (!merchant) return errorResponse(new Error('商户不存在'), 404)

    const db = getDb()
    // ⭐ 2026-10-05 01:06 奕霖立：phone 可选（与 merchantId 配合过滤）
    const rows = phone
      ? db.prepare(`
          SELECT q.id, q.merchantId, q.orderNo, q.type, q.customerName, q.customerPhone,
          q.service, q.stylistName, q.stylistCode, q.status, q.scheduledAt, q.scheduledDate,
          q.arrivedAt, q.startedAt, q.completedAt, q.note, q.createdAt, q.updatedAt,
          s.id AS settlementId, s.listCents, s.discountRate, s.dueCents,
          s.payMethod, s.cardId AS settlementCardId, s.operator, s.createdAt AS settledAt
          FROM BarberQueue q
          LEFT JOIN Settlement s ON s.queueId = q.id
          WHERE q.merchantId = ? AND q.customerPhone = ?
          ORDER BY q.createdAt DESC
          LIMIT 200
        `).all(merchantId, phone)
      : db.prepare(`
          SELECT q.id, q.merchantId, q.orderNo, q.type, q.customerName, q.customerPhone,
          q.service, q.stylistName, q.stylistCode, q.status, q.scheduledAt, q.scheduledDate,
          q.arrivedAt, q.startedAt, q.completedAt, q.note, q.createdAt, q.updatedAt,
          s.id AS settlementId, s.listCents, s.discountRate, s.dueCents,
          s.payMethod, s.cardId AS settlementCardId, s.operator, s.createdAt AS settledAt
          FROM BarberQueue q
          LEFT JOIN Settlement s ON s.queueId = q.id
          WHERE q.merchantId = ?
          ORDER BY q.createdAt DESC
          LIMIT 200
        `).all(merchantId)
    db.close()

    return successResponse({ queues: rows, total: rows.length })
  } catch (e: any) {
    return errorResponse(e)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const merchantId = (body.merchantId || '').trim()
    if (!merchantId) return errorResponse(new Error('merchantId 必填'), 400)

    const merchant = await prisma.merchant.findUnique({ where: { id: merchantId }, select: { id: true } })
    if (!merchant) return errorResponse(new Error('商户不存在'), 404)

    // ⭐ v1.1 改动：校验 customerPhone 必填（之前没强制，现在作为预约必填项）
    const customerPhone = (body.customerPhone || '').trim()
    if (!customerPhone || customerPhone.length < 11) {
      return errorResponse(new Error('请填写 11 位手机号'), 400)
    }

    const db = getDb()
    const id = 'q_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
    const orderType = body.type || 'booking'
    // v1.1.31 (2026-10-06 18:57 qinghe fix Bug 3): orderNo collision root-fix (walk-in ticket phantom success)
    //   OLD: client passes orderNo that already exists -> 409 reject.
    //     But frontend already did optimistic setOrders + showed success popup -> row never persisted.
    //     Then loadQueues() overwrote everything -> customer saw empty queue (this bug).
    //   ROOT CAUSE: client computed orderNo as (count of in-progress orders + 1), so an idle shop
    //     always recalculates B001/A001 -> collides with a used number -> 409 every single time.
    //   NEW: keep prefix, increment numeric part until unique. Never drop a ticket on collision.
    const _rawNo = String(body.orderNo || '').trim()
    const _prefix = /^[AB]/i.test(_rawNo) ? _rawNo.charAt(0).toUpperCase() : (orderType === 'ticket' ? 'B' : 'A')
    const _digitsOnly = _rawNo.replace(/[^0-9]/g, '')
    let _seq = _digitsOnly ? parseInt(_digitsOnly, 10) : (Date.now() % 100000)
    const _orderNoExists = (no: string) =>
      !!db.prepare('SELECT 1 FROM BarberQueue WHERE orderNo = ? AND merchantId = ?').get(no, merchantId)
    let finalOrderNo = ''
    for (let i = 0; i < 500; i++) {
      const candidate = _prefix + String(_seq).padStart(3, '0')
      if (!_orderNoExists(candidate)) { finalOrderNo = candidate; break }
      _seq++
    }
    if (!finalOrderNo) {
      finalOrderNo = _prefix + Date.now().toString(36).toUpperCase().slice(-6)
    }
    const customerName = body.customerName || ''
    const service = body.service || '剪发'
    const stylistName = body.stylistName || 'Will be assigned'
    const stylistCode = body.stylistCode || null
    const queueStatus = body.status || (orderType === 'booking' ? 'reserved' : 'arrived')
    const scheduledAt = body.scheduledAt || ''
    const scheduledDate = body.scheduledDate || 'today'
    // ⭐ v1.1.21 (2026-10-05 12:35 奕霖立)：补 arrivedAt/startedAt/completedAt/note 字段保存
    //   原 POST handler 不写这些字段，导致取号单 status=arrived 但 arrivedAt=null → 活动流显示成"预约"
    const arrivedAt = body.arrivedAt || null
    const startedAt = body.startedAt || null
    const completedAt = body.completedAt || null
    const note = body.note || null

    // 1. 写 BarberQueue 表（现有逻辑）
    db.prepare(`
      INSERT INTO BarberQueue (id, merchantId, orderNo, type, customerName, customerPhone,
                              service, stylistName, stylistCode, status, scheduledAt, scheduledDate,
                              arrivedAt, startedAt, completedAt, note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, merchantId, finalOrderNo, orderType, customerName, customerPhone,
      service, stylistName, stylistCode, queueStatus, scheduledAt, scheduledDate,
      arrivedAt, startedAt, completedAt, note
    )

    // ⭐ v1.1 改动 1：双写 Order 表（让 /orders 也能看到 barber 预约/取号）
    // 用 better-sqlite3 直接 INSERT（v1.1.1 修复 Prisma.create() 写库连接冲突问题）
    let orderId: string | null = null
    let pickupCode: string | null = null
    try {
      // 查 customer（用 Prisma 只读 OK）
      const customer = await prisma.customer.findFirst({
        where: { phone: customerPhone },
        select: { id: true },
      })

      // 生成 6 位取货码（generatePickupCode 用 Prisma 查重，可以接受）
      pickupCode = await generatePickupCode(merchant.code || merchantId)

      // 准备 Order 数据
      orderId = 'ord_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
      const remarkText = `理发店${orderType === 'booking' ? '预约' : '取号'}: ${service} - ${stylistName} ${scheduledDate} ${scheduledAt} [source=${orderType}]`

      // 用 better-sqlite3 直接 INSERT Order 表（避开 Prisma 写库连接冲突）
      try {
        db.prepare(`
          INSERT INTO "Order" (id, merchantId, customerId, orderNo, totalAmount, discountAmount,
                               pointsUsed, pointsValue, finalAmount, deliveryType, deliveryPhone,
                               pickupCode, status, source, remark, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, 0, 0, 0, 0, 0, 'pickup', ?, ?, 'pending', ?, ?, datetime('now'), datetime('now'))
        `).run(
          orderId, merchantId, customer?.id || null, finalOrderNo,
          customerPhone, pickupCode, orderType, remarkText
        )
      } catch (orderDupErr: any) {
        // pickupCode 或 orderNo 冲突 → fallback：去掉 pickupCode + 加 orderNo 后缀
        console.warn('[queues POST] Order 写入冲突，去掉 pickupCode + orderNo 后缀:', orderDupErr?.message)
        orderId = 'ord_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
        db.prepare(`
          INSERT INTO "Order" (id, merchantId, customerId, orderNo, totalAmount, discountAmount,
                               pointsUsed, pointsValue, finalAmount, deliveryType, deliveryPhone,
                               status, source, remark, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, 0, 0, 0, 0, 0, 'pickup', ?, 'pending', ?, ?, datetime('now'), datetime('now'))
        `).run(
          orderId, merchantId, customer?.id || null, finalOrderNo + '-Q',
          customerPhone, orderType, remarkText
        )
        pickupCode = null
      }
    } catch (orderErr: any) {
      // Order 双写失败不影响 BarberQueue 主流程
      console.warn('[queues POST] Order 双写失败:', orderErr?.message)
    }

    db.close()

    return successResponse({
      id,
      finalOrderNo,
      orderId,
      pickupCode,
      ...body,
    }, 201)
  } catch (e: any) {
    return errorResponse(e)
  }
}
