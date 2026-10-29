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
 *
 * 🔴 2026-10-28 鉴权加固（实测漏洞）：
 *   原来「用户取消」只校验 body.customerPhone —— 而手机号本身是匿名可读的
 *   （GET /api/queues?phone= 无鉴权），等于「知道手机号就能取消别人的单」。
 *   现在改成：**登录态里的 phone** 必须等于该单的 customerPhone；
 *   店员/店长/管理员不受此限。
 *   另外：状态推进（arrived/serving/completed）原来**完全没有鉴权**，
 *   任何人 PATCH 就能把别人的单改成「已完成」→ 现在要求门店侧身份。
 *   DELETE 原来零鉴权 → 现在要求店长/管理员。
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { errorResponse, successResponse } from '@/lib/error'
import { verifyAdminPin } from '@/lib/admin-pin'
import Database from 'better-sqlite3'
import path from 'path'
import { resolveDbPath } from '../../../../lib/db-path'
import {
  requireSelfPhone, requireShopSide, requireManagerSide, guardFail, resolveIdentity,
} from '@/lib/api-auth'

export const runtime = 'nodejs'

const DB_PATH = resolveDbPath() // ⭐ v1.1.3 改绝对路径（standalone cwd bug）

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
        // 用户取消：必须是**登录态里的那个手机号**，不能靠请求参数自证
        const guard = await requireSelfPhone(request, existing.customerPhone)
        if (!guard.ok) {
          db.close()
          return guardFail(guard)
        }
        // 兼容旧前端：body.customerPhone 传了但跟登录态不一致 → 403
        if (body.customerPhone && body.customerPhone !== existing.customerPhone) {
          db.close()
          return errorResponse(new Error('无权取消他人预约（手机号不匹配）'), 403)
        }
      } else if (cancelledBy === 'shop') {
        // 店长取消：两种凭证任一通过
        //   ① body.shopPin → 服务端比对哈希（原有行为，店长点两下输 PIN）
        //   ② 已登录的店长会话（zhilin-token 且 DB role=店长）
        const identity = await resolveIdentity(request)
        const isManager = !!identity && identity.isManagerSide
        if (!body.shopPin && !isManager) {
          db.close()
          return errorResponse(new Error('店长取消必须传 shopPin'), 400)
        }
        if (body.shopPin && !verifyAdminPin(body.shopPin)) {
          db.close()
          return errorResponse(new Error('店长 PIN 错误'), 403)
        }
        if (!body.shopPin) {
          const guard = await requireManagerSide(request, existing.merchantId)
          if (!guard.ok) {
            db.close()
            return guardFail(guard)
          }
        }
      }
    } else {
      // ⭐ 2026-10-28：非取消的状态推进（arrived/serving/completed/ stylist…）是**店务操作**
      //   原来零鉴权 → 任何人都能把别人的单改成「已完成」。
      //   → 要求门店侧身份（店员/店长/管理员），且只能碰自己业务线的商户。
      const guard = await requireShopSide(request, existing.merchantId)
      if (!guard.ok) {
        db.close()
        return guardFail(guard)
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

    // ⭐ 2026-10-28：删除是破坏性操作，原来**零鉴权**（任何人 DELETE 就能删掉一条排队记录）。
    //   → 要求店长/管理员 + 商户范围。
    const db = getDb()
    const existing = db.prepare('SELECT id, merchantId FROM BarberQueue WHERE id = ?').get(id) as any
    db.close()
    if (!existing) return errorResponse(new Error('订单不存在'), 404)

    const guard = await requireManagerSide(request, existing.merchantId)
    if (!guard.ok) return guardFail(guard)

    const db2 = getDb()
    db2.prepare('DELETE FROM BarberQueue WHERE id = ?').run(id)
    db2.close()
    return successResponse({ ok: true })
  } catch (e: any) {
    return errorResponse(e)
  }
}
