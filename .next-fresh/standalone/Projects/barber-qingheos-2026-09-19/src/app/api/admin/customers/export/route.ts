import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { ADMIN_MERCHANT_ID } from '@/lib/admin-merchant'
import ExcelJS from 'exceljs'
import { verifyAdminRequest, unauthorized } from '@/lib/admin-jwt-auth'

export const runtime = 'nodejs'

/**
 * GET /api/admin/customers/export
 * 导出顾客名单 Excel(单 sheet)
 *
 * Query:
 *   - level?: 'VIP'|'金卡'|'银卡'|'普通'|'all'
 */
export async function GET(request: NextRequest) {
  const auth = verifyAdminRequest(request)
  if (!auth.ok) return unauthorized(auth)
  try {
    const { searchParams } = new URL(request.url)
    const level = searchParams.get('level') || 'all'

    const customers = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id, phone, nickname, totalSpent, totalOrders, points, status, createdAt
       FROM Customer
       WHERE merchantId = ?
       ORDER BY totalSpent DESC
       LIMIT 1000`,
      ADMIN_MERCHANT_ID
    )

    const wb = new ExcelJS.Workbook()
    wb.creator = '清禾 OS'
    wb.created = new Date()
    const ws = wb.addWorksheet('顾客名单', {
      views: [{ state: 'frozen', ySplit: 1 }],
    })
    ws.columns = [
      { header: '#', key: 'idx', width: 6 },
      { header: '手机号', key: 'phone', width: 16 },
      { header: '昵称', key: 'nickname', width: 18 },
      { header: '累计消费 (¥)', key: 'totalSpent', width: 14 },
      { header: '订单数', key: 'totalOrders', width: 10 },
      { header: '积分', key: 'points', width: 10 },
      { header: '等级', key: 'level', width: 10 },
      { header: '状态', key: 'status', width: 10 },
      { header: '注册时间', key: 'createdAt', width: 22 },
    ]
    // header bold
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7fdc94' } }
    ws.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' }

    let kept = 0
    for (const c of customers) {
      const totalSpent = Number(c.totalSpent) || 0
      const totalOrders = Number(c.totalOrders) || 0
      const points = Number(c.points) || 0
      let lv: string = '普通'
      if (totalSpent >= 2000) lv = 'VIP'
      else if (totalSpent >= 500) lv = '金卡'
      else if (totalSpent >= 200) lv = '银卡'
      if (level !== 'all' && lv !== level) continue
      kept++
      ws.addRow({
        idx: kept,
        phone: c.phone,
        nickname: c.nickname || '',
        totalSpent,
        totalOrders,
        points,
        level: lv,
        status: c.status || 'active',
        createdAt: new Date(c.createdAt).toISOString().slice(0, 19).replace('T', ' '),
      })
    }
    // number format
    ws.getColumn('totalSpent').numFmt = '¥#,##0.00'

    const buf = await wb.xlsx.writeBuffer()
    const filename = `顾客名单_${new Date().toISOString().slice(0, 10)}.xlsx`
    const asciiName = `customers-${new Date().toISOString().slice(0, 10)}.xlsx`
    return new Response(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Content-Length': String((buf as ArrayBuffer).byteLength),
      },
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}