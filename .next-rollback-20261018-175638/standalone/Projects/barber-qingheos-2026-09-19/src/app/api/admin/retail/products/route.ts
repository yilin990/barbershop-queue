/**
 * /api/admin/retail/products — 库存管理（2026-08-02 清禾 Phase 1）
 *
 * GET: 列表 + 搜索 + 库存状态（低库存/正常/过期）
 *   query: ?q=keyword&stock=low|normal&page=1&pageSize=50
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { ADMIN_MERCHANT_ID } from '@/lib/admin-merchant'
import { verifyStaffCookie } from '@/lib/staff-auth'
import { errorResponse, successResponse, AuthError } from '@/lib/error'

export const runtime = 'nodejs'

const DEFAULT_MERCHANT_CODE = 'G0001'
const LOW_STOCK_THRESHOLD = 20 // 库存 < 20 标"低库存"

export async function GET(request: NextRequest) {
  try {
    // 验证店员
    const cookieHeader = request.headers.get('cookie') || ''
    const staffAuth = verifyStaffCookie(cookieHeader)
    if (!staffAuth.success) {
      throw new AuthError(staffAuth.error || '店员未登录')
    }

    const { searchParams } = new URL(request.url)
    const q = (searchParams.get('q') || '').trim()
    const stockFilter = (searchParams.get('stock') || '').trim()
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const pageSize = Math.min(100, Math.max(10, parseInt(searchParams.get('pageSize') || '50')))
    const offset = (page - 1) * pageSize

    // 拿 merchant
    const merchants = await prisma.$queryRaw<any[]>`
      SELECT id FROM Merchant WHERE code = ${DEFAULT_MERCHANT_CODE} LIMIT 1
    `
    if (merchants.length === 0) throw new Error('药房信息不存在')
    const merchantId = merchants[0].id

    // 用 merchantId 查商品（注意：INVENTORY 表实际是 Product，不分库存表）
    // 用 LIKE + 过滤 active
    const whereClauses = [
      `p.merchantId = ?`,
      `p.status = 'active'`,
    ]
    const params: any[] = [merchantId]
    if (q) {
      whereClauses.push(`(p.name LIKE ? OR p.shortName LIKE ? OR p.productCode LIKE ? OR p.barcode LIKE ?)`)
      params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`)
    }
    const whereSql = whereClauses.join(' AND ')

    // 总数
    const countResult = await prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*) AS c FROM Product p WHERE ${whereSql}`,
      ...params
    )
    const total = Number(countResult[0]?.c || 0)

    // 列表（⭐ 2026-08-02 拉 sales30d 用于差异化阈值）
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT p.id, p.productCode, p.name, p.shortName, p.spec, p.price, p.memberPrice,
              p.stock, p.sales30d, p.category, p.image, p.createdAt
       FROM Product p
       WHERE ${whereSql}
       ORDER BY p.sales30d DESC, p.name ASC
       LIMIT ? OFFSET ?`,
      ...params,
      pageSize,
      offset,
    )

    // 标 status + alert（⭐ 2026-08-02 修复：按销量差异化阈值）
    // 高销量商品（>= 50/30 天）需要 ≥ 100 件才安全
    // 中销量商品（>= 10）需要 ≥ 50 件
    // 低销量商品（< 10）保持 ≥ 20 件
    // 这样避免把 6728 件都标低库存（99% 假阳性）
    const items = rows.map((p: any) => {
      const stock = p.stock || 0
      const sales30d = p.sales30d || 0
      let threshold = 20
      if (sales30d >= 50) threshold = 100
      else if (sales30d >= 10) threshold = 50

      let stockStatus: 'low' | 'normal' | 'out' = 'normal'
      if (stock === 0) stockStatus = 'out'
      else if (stock < threshold) stockStatus = 'low'

      return {
        ...p,
        stock,
        threshold,
        stockStatus,
        isLowStock: stockStatus === 'low',
        isOutOfStock: stockStatus === 'out',
      }
    })

    // 应用 stock filter
    const filtered = stockFilter === 'low'
      ? items.filter((i: any) => i.isLowStock || i.isOutOfStock)
      : items

    return successResponse({
      items: filtered,
      total,
      page,
      pageSize,
      lowStockCount: items.filter((i: any) => i.isLowStock || i.isOutOfStock).length,
    })
  } catch (e) {
    return errorResponse(e)
  }
}