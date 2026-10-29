import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import ExcelJS from 'exceljs'
import { verifyAdminRequest, unauthorized } from '@/lib/admin-jwt-auth'

export const runtime = 'nodejs'

const MERCHANT_ID = 'm_grocery_001'

/**
 * GET /api/admin/points-log/export
 * 导出积分流水 Excel(单 sheet,可按 phone/type 过滤)
 *
 * Query:
 *   - phone?: 按手机号筛选
 *   - type?: 'earn'|'spend'|'refund'|'expire'
 *   - limit?: 默认 1000,最大 5000
 */
export async function GET(request: NextRequest) {
  const auth = verifyAdminRequest(request)
  if (!auth.ok) return unauthorized(auth)
  try {
    const { searchParams } = new URL(request.url)
    const phone = (searchParams.get('phone') || '').trim()
    const type = (searchParams.get('type') || '').trim()
    const limit = Math.min(parseInt(searchParams.get('limit') || '1000', 10), 5000)

    const where: string[] = []
    const params: any[] = []
    if (phone) { where.push('pl.phone = ?'); params.push(phone) }
    if (type && ['earn', 'spend', 'refund', 'expire'].includes(type)) { where.push('pl.type = ?'); params.push(type) }
    const whereSql = where.length ? `AND ${where.join(' AND ')}` : ''

    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT pl.id, pl.phone, pl.delta, pl.balance, pl.type, pl.reason, pl.createdAt,
              COALESCE(c.nickname, '') as customerNickname
       FROM PointsLog pl
       LEFT JOIN Customer c ON c.id = pl.customerId AND c.merchantId = pl.merchantId
       WHERE pl.merchantId = ? ${whereSql}
       ORDER BY pl.createdAt DESC
       LIMIT ${limit}`,
      MERCHANT_ID, ...params
    )

    const wb = new ExcelJS.Workbook()
    wb.creator = '清禾 OS'
    wb.created = new Date()
    const ws = wb.addWorksheet('积分流水', { views: [{ state: 'frozen', ySplit: 1 }] })
    ws.columns = [
      { header: '#', key: 'idx', width: 6 },
      { header: '时间', key: 'createdAt', width: 22 },
      { header: '手机号', key: 'phone', width: 16 },
      { header: '昵称', key: 'nickname', width: 18 },
      { header: '类型', key: 'type', width: 10 },
      { header: '变动 (分)', key: 'delta', width: 12 },
      { header: '余额 (分)', key: 'balance', width: 12 },
      { header: '原因', key: 'reason', width: 40 },
    ]
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7fdc94' } }
    ws.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' }

    let idx = 0
    for (const r of rows) {
      idx++
      ws.addRow({
        idx,
        createdAt: new Date(r.createdAt).toISOString().slice(0, 19).replace('T', ' '),
        phone: r.phone,
        nickname: r.customerNickname,
        type: r.type,
        delta: Number(r.delta) || 0,
        balance: Number(r.balance) || 0,
        reason: r.reason,
      })
    }
    // 变动分正绿负红
    ws.eachRow({ includeEmpty: false }, (row, n) => {
      if (n === 1) return
      const deltaCell = row.getCell('delta')
      const v = Number(deltaCell.value) || 0
      if (v > 0) deltaCell.font = { color: { argb: 'FF2d8a4f' }, bold: true }
      else if (v < 0) deltaCell.font = { color: { argb: 'FFc0392b' }, bold: true }
    })

    // 第二个 sheet: 汇总
    const summary = wb.addWorksheet('汇总')
    summary.columns = [{ header: '类型', key: 'type', width: 12 }, { header: '条数', key: 'cnt', width: 10 }, { header: '总分', key: 'sum', width: 10 }]
    summary.getRow(1).font = { bold: true }
    const buckets: Record<string, { cnt: number; sum: number }> = { earn: { cnt: 0, sum: 0 }, spend: { cnt: 0, sum: 0 }, refund: { cnt: 0, sum: 0 }, expire: { cnt: 0, sum: 0 } }
    for (const r of rows) {
      const t = r.type
      if (!buckets[t]) buckets[t] = { cnt: 0, sum: 0 }
      buckets[t].cnt++
      buckets[t].sum += Number(r.delta) || 0
    }
    for (const [t, v] of Object.entries(buckets)) {
      summary.addRow({ type: t, cnt: v.cnt, sum: v.sum })
    }

    const buf = await wb.xlsx.writeBuffer()
    const filename = `积分流水_${new Date().toISOString().slice(0, 10)}.xlsx`
    const asciiName = `points-log-${new Date().toISOString().slice(0, 10)}.xlsx`
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