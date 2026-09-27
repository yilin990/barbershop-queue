/**
 * /api/admin/purchase-orders — 进货单列表 + 创建（Day 1/5 重构 → thin shell）
 *
 * GET  /api/admin/purchase-orders?status=&supplierId=&search=&page=&pageSize=
 * POST /api/admin/purchase-orders  body: {supplierId, items, note?, expectedDate?}
 *
 * 鉴权：admin-jwt-auth（Day 4 迁移 ✓）
 * 业务：domain/inventory/purchase.ts
 */

import { NextRequest } from 'next/server'
import { verifyAdminRequest, unauthorized } from '@/lib/admin-jwt-auth'
import { errorResponse, successResponse } from '@/lib/error'
import { validateBody, validateQuery, z , failResponse} from '@/lib/validate'
import {
  listPurchaseOrders,
  createPurchaseOrder,
} from '@/domain/inventory/purchase'

export const runtime = 'nodejs'

const querySchema = z.object({
  status: z.string().optional(),
  supplierId: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
})

const bodySchema = z.object({
  supplierId: z.string().min(1, 'supplierId 必填'),
  items: z
    .array(
      z.object({
        productId: z.string().min(1, 'productId 必填'),
        quantity: z.number().int().positive('数量必须 > 0'),
        costPrice: z.number().min(0, '进价不能为负'),
      })
    )
    .min(1, 'items 不能为空')
    .max(100, '单次最多 100 个商品'),
  note: z.string().optional(),
  expectedDate: z.string().optional(),
})

export async function GET(request: NextRequest) {
  const auth = verifyAdminRequest(request)
  if (!auth.ok) return unauthorized(auth)

  const v = validateQuery(request, querySchema)
  if (!v.ok) return failResponse(v)

  try {
    const data = await listPurchaseOrders(v.data)
    return successResponse(data)
  } catch (e) {
    return errorResponse(e)
  }
}

export async function POST(request: NextRequest) {
  const auth = verifyAdminRequest(request)
  if (!auth.ok) return unauthorized(auth)

  const v = await validateBody(request, bodySchema)
  if (!v.ok) return failResponse(v)

  try {
    const order = await createPurchaseOrder(v.data)
    return successResponse({ order })
  } catch (e) {
    return errorResponse(e)
  }
}
