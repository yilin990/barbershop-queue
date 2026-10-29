/**
 * /api/admin/purchase-orders/[id] — 进货单详情 / 改状态 / 删除（新增）
 *
 * GET    /api/admin/purchase-orders/[id]                   详情
 * PATCH  /api/admin/purchase-orders/[id] {status}          状态机
 * DELETE /api/admin/purchase-orders/[id]                   只有 draft 可删
 *
 * 鉴权：admin-jwt-auth（Day 4 迁移 ✓）
 * 业务：domain/inventory/purchase.ts
 *
 * 注意：Next.js 15+ params 是 Promise，必须 await
 */

import { NextRequest } from 'next/server'
import { verifyAdminRequest, unauthorized } from '@/lib/admin-jwt-auth'
import { errorResponse, successResponse } from '@/lib/error'
import { validateBody, z , failResponse} from '@/lib/validate'
import {
  getPurchaseOrder,
  updatePurchaseOrderStatus,
  deletePurchaseOrder,
} from '@/domain/inventory/purchase'

export const runtime = 'nodejs'

const patchSchema = z.object({
  status: z.enum(['draft', 'confirmed', 'received', 'cancelled']),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = verifyAdminRequest(request)
  if (!auth.ok) return unauthorized(auth)

  const { id } = await params

  try {
    const data = await getPurchaseOrder(id)
    return successResponse(data)
  } catch (e) {
    return errorResponse(e)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = verifyAdminRequest(request)
  if (!auth.ok) return unauthorized(auth)

  const { id } = await params

  const v = await validateBody(request, patchSchema)
  if (!v.ok) return failResponse(v)

  try {
    const data = await updatePurchaseOrderStatus(id, v.data.status)
    return successResponse(data)
  } catch (e) {
    return errorResponse(e)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = verifyAdminRequest(request)
  if (!auth.ok) return unauthorized(auth)

  const { id } = await params

  try {
    const data = await deletePurchaseOrder(id)
    return successResponse(data)
  } catch (e) {
    return errorResponse(e)
  }
}
