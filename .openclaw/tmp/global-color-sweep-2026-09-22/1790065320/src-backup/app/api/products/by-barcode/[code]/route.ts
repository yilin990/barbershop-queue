import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

/**
 * GET /api/products/by-barcode/[code]
 * 奕霖 2026-08-01 22:52 — 扫描枪工作流：扫条码 → 查商品 ID
 * 返回 { success, product: {id, name, shortName, barcode, price, stock, image} } 或 404
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params
  const trimmed = code?.trim()
  if (!trimmed) {
    return NextResponse.json({ success: false, error: '条码为空' }, { status: 400 })
  }

  try {
    // SQLite 模糊匹配（部分扫码枪会多输出前缀/后缀字符）
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id, productCode, name, shortName, barcode, price, stock, status, image
       FROM Product
       WHERE merchantId = 'm_grocery_001'
         AND (barcode = ? OR barcode LIKE ?)
       LIMIT 5`,
      trimmed,
      `%${trimmed}%`
    )

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: `未找到条码 ${trimmed} 对应的商品` },
        { status: 404 }
      )
    }

    // 精确匹配优先
    const exact = rows.find((r) => r.barcode === trimmed)
    const product = exact || rows[0]

    return NextResponse.json({
      success: true,
      product: {
        id: product.id,
        productCode: product.productCode,
        name: product.name,
        shortName: product.shortName,
        barcode: product.barcode,
        price: product.price,
        stock: product.stock,
        status: product.status,
        hasImage: !!(product.image && product.image.startsWith('/uploads/')),
      },
      matchType: exact ? 'exact' : 'fuzzy',
      candidates: rows.length,
    })
  } catch (e: any) {
    console.error('[by-barcode]', e)
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}
