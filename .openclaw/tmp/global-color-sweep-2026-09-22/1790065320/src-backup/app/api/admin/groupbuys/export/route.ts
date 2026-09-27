import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { ADMIN_MERCHANT_ID } from '@/lib/admin-merchant'
import ExcelJS from 'exceljs'
import { verifyAdminRequest, unauthorized } from '@/lib/admin-jwt-auth'

export const runtime = 'nodejs'

/**
 * GET /api/admin/groupbuys/export
 * 导出拼团清单 + 成员名单(2 sheet)
 *
 * Query:
 *   - status?: 'active'|'success'|'expired'|'closed'
 */
export async function GET(request: NextRequest) {
  const auth = verifyAdminRequest(request)
  if (!auth.ok) return unauthorized(auth)
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || ''

    const groups = await prisma.$queryRawUnsafe<any[]>(
      status
        ? `SELECT * FROM GroupBuy WHERE merchantId = ? AND status = ? ORDER BY createdAt DESC`
        : `SELECT * FROM GroupBuy WHERE merchantId = ? ORDER BY createdAt DESC`,
      ADMIN_MERCHANT_ID, ...(status ? [status] : [])
    )

    // 真实成员数
    let memberCounts: Record<string, number> = {}
    if (groups.length > 0) {
      const ids = groups.map((g) => g.id)
      const placeholders = ids.map(() => '?').join(',')
      // ⭐ GroupMember 表无 merchantId 列(只有 groupId 外键),改纯 groupId 查询
      const counts = await prisma.$queryRawUnsafe<any[]>(
        `SELECT groupId, COUNT(*) AS cnt FROM GroupMember WHERE groupId IN (${placeholders}) GROUP BY groupId`,
        ...ids
      )
      for (const r of counts) memberCounts[r.groupId] = Number(r.cnt)
    }

    // 所有团的成员(用于第二个 sheet)
    let members: any[] = []
    if (groups.length > 0) {
      const ids = groups.map((g) => g.id)
      const placeholders = ids.map(() => '?').join(',')
      members = await prisma.$queryRawUnsafe<any[]>(
        `SELECT groupId, phone, nickname, joinedAt FROM GroupMember WHERE groupId IN (${placeholders}) ORDER BY joinedAt`,
        ...ids
      )
    }

    const wb = new ExcelJS.Workbook()
    wb.creator = '清禾 OS'
    wb.created = new Date()

    // Sheet 1: 拼团清单
    const ws1 = wb.addWorksheet('拼团清单', { views: [{ state: 'frozen', ySplit: 1 }] })
    ws1.columns = [
      { header: '#', key: 'idx', width: 6 },
      { header: '团 ID', key: 'id', width: 22 },
      { header: '商品名', key: 'productName', width: 24 },
      { header: '规格', key: 'productSpec', width: 14 },
      { header: '原价 (¥)', key: 'originalPrice', width: 12 },
      { header: '团价 (¥)', key: 'groupPrice', width: 12 },
      { header: '成团人数', key: 'requiredPeople', width: 10 },
      { header: '当前人数', key: 'currentPeople', width: 10 },
      { header: '真实成员', key: 'actualMemberCount', width: 10 },
      { header: '状态', key: 'status', width: 10 },
      { header: '到期时间', key: 'expiresAt', width: 20 },
      { header: '开团时间', key: 'createdAt', width: 20 },
    ]
    ws1.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    ws1.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFa855f7' } }
    let idx = 0
    for (const g of groups) {
      idx++
      ws1.addRow({
        idx,
        id: g.id,
        productName: g.productName,
        productSpec: g.productSpec || '',
        originalPrice: Number(g.originalPrice) || 0,
        groupPrice: Number(g.groupPrice) || 0,
        requiredPeople: Number(g.requiredPeople),
        currentPeople: Number(g.currentPeople),
        actualMemberCount: memberCounts[g.id] ?? 0,
        status: g.status,
        expiresAt: new Date(g.expiresAt).toISOString().slice(0, 19).replace('T', ' '),
        createdAt: new Date(g.createdAt).toISOString().slice(0, 19).replace('T', ' '),
      })
    }
    ws1.getColumn('originalPrice').numFmt = '¥#,##0.00'
    ws1.getColumn('groupPrice').numFmt = '¥#,##0.00'

    // Sheet 2: 成员名单
    const ws2 = wb.addWorksheet('成员名单', { views: [{ state: 'frozen', ySplit: 1 }] })
    ws2.columns = [
      { header: '#', key: 'idx', width: 6 },
      { header: '团 ID', key: 'groupId', width: 22 },
      { header: '商品名', key: 'productName', width: 24 },
      { header: '手机号', key: 'phone', width: 16 },
      { header: '昵称', key: 'nickname', width: 18 },
      { header: '加入时间', key: 'joinedAt', width: 22 },
    ]
    ws2.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    ws2.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFa855f7' } }
    const groupNameMap: Record<string, string> = {}
    for (const g of groups) groupNameMap[g.id] = g.productName
    let idx2 = 0
    for (const m of members) {
      idx2++
      ws2.addRow({
        idx: idx2,
        groupId: m.groupId,
        productName: groupNameMap[m.groupId] || '',
        phone: m.phone,
        nickname: m.nickname || '',
        joinedAt: new Date(m.joinedAt).toISOString().slice(0, 19).replace('T', ' '),
      })
    }

    const buf = await wb.xlsx.writeBuffer()
    const filename = `拼团记录_${new Date().toISOString().slice(0, 10)}.xlsx`
    const asciiName = `groupbuys-${new Date().toISOString().slice(0, 10)}.xlsx`
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