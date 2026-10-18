/**
 * /api/admin/retail/pos/scan — 扫描枪扫描接口（2026-08-02 奕霖需求）
 *
 * POST: 接收 barcode/productCode 字符串，匹配商品后返回
 *   body: { barcode: '6901234567890' }
 *   返回: { success, product: {id, name, spec, price, memberPrice, stock} }
 *
 * 设计：
 *   - 支持 13 位 EAN-13 条码（标准药品条码）
 *   - 支持 8 位内短码（部分药品用店内编码）
 *   - 支持 productCode（拼音码 / 店内编码）
 *   - 优先匹配 barcode → productCode → name 拼音首字母
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { ADMIN_MERCHANT_ID } from '@/lib/admin-merchant'
import { verifyStaffCookie } from '@/lib/staff-auth'
import { errorResponse, successResponse, AuthError } from '@/lib/error'

export const runtime = 'nodejs'

const DEFAULT_MERCHANT_CODE = 'G0001'

export async function POST(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get('cookie') || ''
    const staffAuth = verifyStaffCookie(cookieHeader)
    if (!staffAuth.success) {
      throw new AuthError(staffAuth.error || '店员未登录')
    }

    const body = await request.json()
    const code = (body.barcode || body.productCode || '').toString().trim()
    if (!code) {
      throw new Error('barcode 不能为空')
    }

    const merchants = await prisma.$queryRaw<any[]>`
      SELECT id FROM Merchant WHERE code = ${DEFAULT_MERCHANT_CODE} LIMIT 1
    `
    if (merchants.length === 0) throw new Error('药房信息不存在')
    const merchantId = merchants[0].id

    // 优先匹配 barcode，然后 productCode，然后 shortName
    const products = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id, productCode, name, shortName, spec, price, memberPrice, stock, barcode, image
       FROM Product
       WHERE merchantId = ? AND status = 'active'
         AND (barcode = ? OR productCode = ? OR shortName = ?)
       LIMIT 1`,
      merchantId, code, code, code
    )

    if (products.length === 0) {
      // 模糊搜索（按拼音/简称）
      const fuzzy = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id, productCode, name, shortName, spec, price, memberPrice, stock, barcode, image
         FROM Product
         WHERE merchantId = ? AND status = 'active'
           AND (name LIKE ? OR shortName LIKE ? OR searchText LIKE ?)
         LIMIT 5`,
        merchantId, `%${code}%`, `%${code}%`, `%${code}%`
      )
      if (fuzzy.length === 0) {
        throw new Error(`没找到条码/编码 "${code}" 对应的商品`)
      }
      if (fuzzy.length === 1) {
        return successResponse({ product: fuzzy[0], fuzzyMatched: false })
      }
      return successResponse({
        candidates: fuzzy.map((p: any) => ({
          id: p.id, name: p.name, spec: p.spec, price: p.price,
          memberPrice: p.memberPrice, stock: p.stock, barcode: p.barcode,
          productCode: p.productCode,
        })),
        message: `多个商品匹配，请精确输入`,
      })
    }

    return successResponse({ product: products[0] })
  } catch (e) {
    return errorResponse(e)
  }
}