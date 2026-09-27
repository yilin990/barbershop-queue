import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { ADMIN_MERCHANT_ID } from '@/lib/admin-merchant'
import ExcelJS from 'exceljs'
import { verifyAdminRequest, unauthorized } from '@/lib/admin-jwt-auth'

export const runtime = 'nodejs'

/**
 * GET /api/admin/coupons/export
 * 导出优惠券清单(2 sheet:全部 + 状态分布)
 *
 * Query:
 *   - status?: 'unused'|'used'|'expired'
 *   - type?: 'discount'|'new_user'|'flash_sale'|'shipping'
 */
export async function GET(request: NextRequest) {
  const auth = verifyAdminRequest(request)
  if (!auth.ok) return unauthorized(auth)
  try {
    const { searchParams } = new URL(request.url)
    const status = (searchParams.get('status') || '').trim()
    const type = (searchParams.get('type') || '').trim()

    const where: string[] = ['merchantId = ?']
    const params: any[] = [ADMIN_MERCHANT_ID]
    if (status && ['unused', 'used', 'expired'].includes(status)) { where.push('status = ?'); params.push(status) }
    if (type) { where.push('type = ?'); params.push(type) }
    const whereSql = `WHERE ${where.join(' AND ')}`

    const coupons = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id, code, name, type, value, minSpend, status, usedAt, expiresAt, createdAt
       FROM Coupon ${whereSql}
       ORDER BY createdAt DESC
       LIMIT 1000`,
      ...params
    )

    const wb = new ExcelJS.Workbook()
    wb.creator = '清禾 OS'
    wb.created = new Date()

    const ws1 = wb.addWorksheet('优惠券清单', { views: [{ state: 'frozen', ySplit: 1 }] })
    ws1.columns = [
      { header: '#', key: 'idx', width: 6 },
      { header: '券码', key: 'code', width: 18 },
      { header: '券名', key: 'name', width: 24 },
      { header: '类型', key: 'type', width: 10 },
      { header: '满 (¥)', key: 'minSpend', width: 10 },
      { header: '减 (¥)', key: 'value', width: 10 },
      { header: '状态', key: 'status', width: 10 },
      { header: '使用时间', key: 'usedAt', width: 20 },
      { header: '过期时间', key: 'expiresAt', width: 20 },
      { header: '创建时间', key: 'createdAt', width: 20 },
    ]
    ws1.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    ws1.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFfbbf24' } }
    let idx = 0
    for (const c of coupons) {
      idx++
      ws1.addRow({
        idx,
        code: c.code,
        name: c.name,
        type: c.type,
        minSpend: Number(c.minSpend) || 0,
        value: Number(c.value) || 0,
        status: c.status,
        usedAt: c.usedAt ? new Date(c.usedAt).toISOString().slice(0, 19).replace('T', ' ') : '',
        expiresAt: new Date(c.expiresAt).toISOString().slice(0, 19).replace('T', ' '),
        createdAt: new Date(c.createdAt).toISOString().slice(0, 19).replace('T', ' '),
      })
    }
    ws1.getColumn('minSpend').numFmt = '¥#,##0'
    ws1.getColumn('value').numFmt = '¥#,##0'

    const ws2 = wb.addWorksheet('状态分布')
    ws2.columns = [{ header: '状态', key: 's', width: 12 }, { header: '数量', key: 'cnt', width: 10 }, { header: '总额 (¥)', key: 'sum', width: 14 }]
    ws2.getRow(1).font = { bold: true }
    const buckets: Record<string, { cnt: number; sum: number }> = { unused: { cnt: 0, sum: 0 }, used: { cnt: 0, sum: 0 }, expired: { cnt: 0, sum: 0 } }
    for (const c of coupons) {
      if (!buckets[c.status]) buckets[c.status] = { cnt: 0, sum: 0 }
      buckets[c.status].cnt++
      buckets[c.status].sum += Number(c.value) || 0
    }
    for (const [s, v] of Object.entries(buckets)) {
      ws2.addRow({ s, cnt: v.cnt, sum: v.sum })
    }
    ws2.getColumn('sum').numFmt = '¥#,##0'

    const buf = await wb.xlsx.writeBuffer()
    const filename = `优惠券清单_${new Date().toISOString().slice(0, 10)}.xlsx`
    const asciiName = `coupons-${new Date().toISOString().slice(0, 10)}.xlsx`
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