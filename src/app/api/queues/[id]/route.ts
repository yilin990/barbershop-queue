/**
 * /api/queues/[id] - 单条队列订单 API（2026-10-02 奕霖拍板根治方案 + v1.1 取消）
 *
 *   PATCH  /api/queues/[id]                    更新状态（含取消：status=cancelled + cancelledBy + cancelReason）
 *   DELETE /api/queues/[id]                    删除
 *
 * ⭐ v1.1 (2026-10-04 18:48 奕霖"全做吧"双确认) · 改动 4:
 *   - PATCH 支持 cancelledBy ('user' | 'shop') + cancelReason 字段
 *   - 用户取消：body.customerPhone 必填，必须匹配 existing.customerPhone（防越权）
 *   - 店长取消：body.cancelledBy='shop' + body.shopPin 必填，必须通过 verifyAdminPin（防越权）
 *   - 双重安全：DB schema 已 ALTER TABLE 加 cancelledBy/cancelReason 列
 *   - 同时同步 Order 表（如有 orderId 关联）
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { errorResponse, successResponse } from '@/lib/error'
import { verifyAdminPin } from '@/lib/admin-auth'
import Database from 'better-sqlite3'
import path from 'path'

export const runtime = 'nodejs'

const DB_PATH = '/Users/yilinzhao/Projects/barber-qingheos-2026-09-19/prisma/dev.db' // ⭐ v1.1.3 改绝对路径（standalone cwd bug）

function getDb() {
  return new Database(DB_PATH)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const db = getDb()
    const existing = db.prepare('SELECT * FROM BarberQueue WHERE id = ?').get(id) as any
    if (!existing) {
      db.close()
      return errorResponse(new Error('订单不存在'), 404)
    }

    // ⭐ v1.1 改动 4：取消权限校验
    if (body.status === 'cancelled') {
      const cancelledBy = body.cancelledBy // 'user' | 'shop'
      if (!cancelledBy || !['user', 'shop'].includes(cancelledBy)) {
        db.close()
        return errorResponse(new Error('取消时必须指定 cancelledBy=user 或 shop'), 400)
      }

      if (cancelledBy === 'user') {
        // 用户取消：customerPhone 必填 + 必须匹配
        if (!body.customerPhone) {
          db.close()
          return errorResponse(new Error('用户取消必须传 customerPhone'), 400)
        }
        if (body.customerPhone !== existing.customerPhone) {
          db.close()
          return errorResponse(new Error('无权取消他人预约（手机号不匹配）'), 403)
        }
      } else if (cancelledBy === 'shop') {
        // 店长取消：shopPin 必填 + 必须通过 verifyAdminPin
        if (!body.shopPin) {
          db.close()
          return errorResponse(new Error('店长取消必须传 shopPin'), 400)
        }
        if (!verifyAdminPin(body.shopPin)) {
          db.close()
          return errorResponse(new Error('店长 PIN 错误'), 403)
        }
      }
    }

    // 构建 SET 子句
    const updates: string[] = []
    const values: any[] = []
    const allowed = ['status', 'startedAt', 'completedAt', 'arrivedAt', 'note', 'stylistCode', 'stylistName', 'cancelledBy', 'cancelReason']
    for (const field of allowed) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`)
        values.push(body[field])
      }
    }
    if (updates.length === 0) {
      db.close()
      return errorResponse(new Error('无可更新字段'), 400)
    }
    updates.push('updatedAt = CURRENT_TIMESTAMP')
    values.push(id)

    db.prepare(`UPDATE BarberQueue SET ${updates.join(', ')} WHERE id = ?`).run(...values)

    const updated = db.prepare('SELECT * FROM BarberQueue WHERE id = ?').get(id)
    db.close()

    // ⭐ v1.1 改动 4：同步 Order 表（如存在关联 orderId）
    // 用 orderNo 关联（orderNo 在 POST 时同步写入 Order 表）
    try {
      const orderRow = await prisma.order.findFirst({
        where: { orderNo: existing.orderNo },
        select: { id: true },
      })
      if (orderRow) {
        if (body.status === 'cancelled') {
          await prisma.order.update({
            where: { id: orderRow.id },
            data: {
              status: 'cancelled',
              remark: `[barber取消] ${body.cancelReason || ''} by ${body.cancelledBy || 'unknown'}`,
            },
          })
        } else if (body.status === 'arrived' || body.status === 'serving' || body.status === 'completed') {
          // 状态推进同步（可选，v1.1 简化版：仅同步 cancelled）
        }
      }
    } catch (orderSyncErr: any) {
      console.warn('[queues PATCH] Order 同步失败（不影响主流程）:', orderSyncErr?.message)
    }

    return successResponse({ queue: updated })
  } catch (e: any) {
    return errorResponse(e)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const db = getDb()
    db.prepare('DELETE FROM BarberQueue WHERE id = ?').run(id)
    db.close()
    return successResponse({ ok: true })
  } catch (e: any) {
    return errorResponse(e)
  }
}
