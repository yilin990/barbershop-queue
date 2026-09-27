import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { ADMIN_MERCHANT_ID } from '@/lib/admin-merchant'
import { verifyAdminRequest, unauthorized } from '@/lib/admin-jwt-auth'
import ExcelJS from 'exceljs'

export const runtime = 'nodejs'

/**
 * GET /api/admin/products/export
 * 导出商品 Excel（v3.0 · 奕霖 2026-09-06 反馈"表格没能导出"）
 * query: ?tier=all|critical_0|critical_5|warning|normal&category=&q=&status=active
 * 返回 xlsx 文件流
 */
export async function GET(request: NextRequest) {
  const auth = verifyAdminRequest(request)
  if (!auth.ok) return unauthorized(auth)

  try {
    const { searchParams } = new URL(request.url)
    const tier = searchParams.get('tier') || 'all'
    const category = searchParams.get('category') || ''
    const q = searchParams.get('q') || ''
    const status = searchParams.get('status') || ''

    // 复用 products-list 的过滤逻辑
    const conds: string[] = [`p.merchantId = ?`, `p.status != 'deleted'`]
    const params: any[] = [ADMIN_MERCHANT_ID]

    if (q) {
      conds.push(`(p.name LIKE ? OR p.shortName LIKE ? OR p.productCode LIKE ?)`)
      const like = `%${q}%`
      params.push(like, like, like)
    }
    if (tier === 'critical_0') conds.push(`p.stock = 0`)
    else if (tier === 'critical_5') conds.push(`p.stock > 0 AND p.stock < 5`)
    else if (tier === 'warning') conds.push(`p.stock >= 5 AND p.stock < 20`)
    else if (tier === 'normal') conds.push(`p.stock >= 20`)
    if (category) {
      conds.push(`(p.category = ? OR p.categoryLabel = ?)`)
      params.push(category, category)
    }
    if (status && ['active', 'inactive', 'draft'].includes(status)) {
      conds.push(`p.status = ?`)
      params.push(status)
    }

    const where = `WHERE ${conds.join(' AND ')}`
    const products = await prisma.$queryRawUnsafe<any[]>(`
      SELECT p.id, p.productCode, p.name, p.shortName, p.spec, p.manufacturer, p.barcode,
             p.category, p.categoryLabel, p.unit, p.weightGram,
             p.price, p.totalAmount, p.memberPrice, p.costPrice, p.points,
             p.stock, p.status, p.image,
             p.sales30d, p.sales30_60d, p.sales60_90d,
             p.createdAt, p.updatedAt
      FROM Product p
      ${where}
      ORDER BY p.stock ASC, p.name ASC
    `, ...params)

    // 构建 Excel
    const wb = new ExcelJS.Workbook()
    wb.creator = '果蔬后台 v3.0'
    wb.created = new Date()

    // Sheet 1: 商品总览
    const sheet = wb.addWorksheet('商品总览', {
      views: [{ state: 'frozen', ySplit: 1 }],
    })
    sheet.columns = [
      { header: '编码', key: 'productCode', width: 18 },
      { header: '商品全称', key: 'name', width: 32 },
      { header: '简称', key: 'shortName', width: 18 },
      { header: '规格', key: 'spec', width: 16 },
      { header: '厂家', key: 'manufacturer', width: 20 },
      { header: '条码', key: 'barcode', width: 16 },
      { header: '分类', key: 'categoryLabel', width: 12 },
      { header: '单位', key: 'unit', width: 8 },
      { header: '售价(¥)', key: 'price', width: 10 },
      { header: '会员价(¥)', key: 'memberPrice', width: 10 },
      { header: '进货价(¥)', key: 'costPrice', width: 10 },
      { header: '库存', key: 'stock', width: 8 },
      { header: '30天销量', key: 'sales30d', width: 10 },
      { header: '状态', key: 'status', width: 8 },
      { header: '商品图', key: 'image', width: 30 },
    ]
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A3A1F' } }

    const STATUS_LABEL: Record<string, string> = { active: '上架', inactive: '下架', draft: '草稿' }
    products.forEach((p) => {
      sheet.addRow({
        productCode: p.productCode,
        name: p.name,
        shortName: p.shortName || '',
        spec: p.spec || '',
        manufacturer: p.manufacturer || '',
        barcode: p.barcode || '',
        categoryLabel: p.categoryLabel || p.category || '',
        unit: p.unit || '',
        price: p.price,
        memberPrice: p.memberPrice ?? '',
        costPrice: p.costPrice ?? '',
        stock: p.stock,
        sales30d: p.sales30d ?? 0,
        status: STATUS_LABEL[p.status] || p.status,
        image: p.image || '',
      })
    })

    // Sheet 2: 库存分布
    const tierSheet = wb.addWorksheet('库存分布', { views: [{ state: 'frozen', ySplit: 1 }] })
    const tiers = [
      { name: 'critical_0', label: '紧急·0库存', range: 'stock = 0' },
      { name: 'critical_5', label: '紧急·<5', range: 'stock > 0 AND stock < 5' },
      { name: 'warning', label: '警告·<20', range: 'stock >= 5 AND stock < 20' },
      { name: 'normal', label: '正常·≥20', range: 'stock >= 20' },
    ]
    tierSheet.columns = [
      { header: '档位', key: 'label', width: 16 },
      { header: 'SQL 条件', key: 'range', width: 30 },
      { header: '商品数', key: 'count', width: 10 },
    ]
    tierSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    tierSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A3A1F' } }
    for (const t of tiers) {
      const row: any[] = await prisma.$queryRawUnsafe<{ c: number }[]>(
        `SELECT COUNT(*) AS c FROM Product p ${where} AND p.${t.range}`,
        ...params
      )
      tierSheet.addRow({ label: t.label, range: t.range, count: Number(row[0]?.c || 0) })
    }

    // 输出
    const buf = await wb.xlsx.writeBuffer()
    const today = new Date().toISOString().slice(0, 10)
    const filename = `果蔬商品_${today}.xlsx`

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="products-${today}.xlsx"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e: any) {
    console.error('[admin/products/export]', e)
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}
