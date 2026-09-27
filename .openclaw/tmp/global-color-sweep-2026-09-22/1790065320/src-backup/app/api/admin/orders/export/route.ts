import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { ADMIN_MERCHANT_ID } from '@/lib/admin-merchant'
import ExcelJS from 'exceljs'
import { verifyAdminRequest, unauthorized } from '@/lib/admin-jwt-auth'

export const runtime = 'nodejs'


const STATUS_LABEL: Record<string, string> = {
  pending: '待核销',
  paid: '已支付',
  preparing: '备货中',
  ready: '可取货',
  delivered: '已完成',
  cancelled: '已取消',
  refunded: '已退款',
}

/**
 * GET /api/admin/orders/export?from=YYYY-MM-DD&to=YYYY-MM-DD&status=...
 * 导出订单 Excel（多 sheet：全部 / 按状态 / 商品明细）
 */
export async function GET(request: NextRequest) {
  const auth = verifyAdminRequest(request)
  if (!auth.ok) return unauthorized(auth)

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from') // YYYY-MM-DD
  const to = searchParams.get('to')     // YYYY-MM-DD
  const statusFilter = searchParams.get('status') // pending|delivered|cancelled|null(全部)

  try {
    // 1. 订单主表
    const where: string[] = []
    if (from) where.push(`o.createdAt >= '${from} 00:00:00'`)
    if (to) where.push(`o.createdAt < '${to} 23:59:59'`)
    if (statusFilter && statusFilter !== 'all') where.push(`o.status = '${statusFilter}'`)
    where.push('o.merchantId = ?')
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

    const orders = await prisma.$queryRawUnsafe<any[]>(`
      SELECT o.id, o.orderNo, o.totalAmount, o.discountAmount, o.pointsValue, o.finalAmount,
             o.status, o.pickupCode, o.createdAt, o.paidAt, o.pickedUpAt,
             c.nickname AS customerName, c.phone AS customerPhone,
             (SELECT COUNT(*) FROM OrderItem oi WHERE oi.orderId = o.id) AS itemCount
      FROM "Order" o
      LEFT JOIN Customer c ON c.id = o.customerId
      ${whereSql}
      ORDER BY o.createdAt DESC
    `)

    // 2. 商品明细
    const orderIds = orders.map((o) => o.id)
    let items: any[] = []
    if (orderIds.length) {
      items = await prisma.$queryRawUnsafe<any[]>(`
        SELECT oi.orderId, oi.productName, oi.quantity, oi.price,
               (oi.quantity * oi.price) AS subtotal
        FROM OrderItem oi
        WHERE oi.orderId IN (${orderIds.map((id) => `'${id}'`).join(',')})
        ORDER BY oi.orderId, oi.id
      `)
    }

    // 3. 按状态分组（合并 completed + delivered 到 '已完成'）
    const byStatus: Record<string, any[]> = {}
    const normalizeStatus = (s: string) => (s === 'completed' || s === 'delivered' ? 'done' : s)
    orders.forEach((o) => {
      const k = normalizeStatus(o.status)
      if (!byStatus[k]) byStatus[k] = []
      byStatus[k].push(o)
    })

    // 4. 统计 KPI
    const totalRevenue = orders.reduce((s, o) => s + (Number(o.finalAmount) || 0), 0)
    const completedRevenue = orders
      .filter((o) => o.status === 'delivered' || o.status === 'completed')
      .reduce((s, o) => s + (Number(o.finalAmount) || 0), 0)
    const cancelledCount = orders.filter((o) => o.status === 'cancelled').length

    // ========== 构建 Excel ==========
    const wb = new ExcelJS.Workbook()
    wb.creator = '清禾 果蔬后台'
    wb.created = new Date()

    // Sheet 1: 概览
    const summary = wb.addWorksheet('概览')
    summary.columns = [
      { header: '指标', key: 'k', width: 30 },
      { header: '数值', key: 'v', width: 25 },
    ]
    summary.addRows([
      { k: '导出时间', v: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) },
      { k: '时间范围', v: from && to ? `${from} ~ ${to}` : (from || to || '全部') },
      { k: '状态筛选', v: statusFilter && statusFilter !== 'all' ? (STATUS_LABEL[statusFilter] || statusFilter) : '全部' },
      { k: '订单总数', v: orders.length },
      { k: '已完成订单数', v: orders.filter((o) => o.status === 'delivered' || o.status === 'completed').length },
      { k: '已取消订单数', v: cancelledCount },
      { k: '总营收（含未完成）', v: `¥${totalRevenue.toFixed(2)}` },
      { k: '已完成营收', v: `¥${completedRevenue.toFixed(2)}` },
    ])
    summary.getRow(1).font = { bold: true }
    summary.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7fdc94' } }

    // Sheet 2: 全部订单
    const allSheet = wb.addWorksheet('全部订单')
    allSheet.columns = [
      { header: '订单号', key: 'orderNo', width: 22 },
      { header: '状态', key: 'status', width: 10 },
      { header: '取货码', key: 'pickupCode', width: 10 },
      { header: '顾客', key: 'customerName', width: 16 },
      { header: '顾客手机', key: 'customerPhone', width: 14 },
      { header: '商品数', key: 'itemCount', width: 8 },
      { header: '订单总额', key: 'totalAmount', width: 12 },
      { header: '优惠', key: 'discountAmount', width: 10 },
      { header: '积分抵扣', key: 'pointsValue', width: 10 },
      { header: '实付金额', key: 'finalAmount', width: 12 },
      { header: '下单时间', key: 'createdAt', width: 18 },
      { header: '支付时间', key: 'paidAt', width: 18 },
      { header: '核销时间', key: 'pickedUpAt', width: 18 },
    ]
    orders.forEach((o) => {
      allSheet.addRow({
        orderNo: o.orderNo,
        status: STATUS_LABEL[o.status] || o.status,
        pickupCode: o.pickupCode || '',
        customerName: o.customerName || '匿名',
        customerPhone: o.customerPhone || '',
        itemCount: Number(o.itemCount || 0),
        totalAmount: Number(o.totalAmount || 0).toFixed(2),
        discountAmount: Number(o.discountAmount || 0).toFixed(2),
        pointsValue: Number(o.pointsValue || 0).toFixed(2),
        finalAmount: Number(o.finalAmount || 0).toFixed(2),
        createdAt: o.createdAt ? new Date(o.createdAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) : '',
        paidAt: o.paidAt ? new Date(o.paidAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) : '',
        pickedUpAt: o.pickedUpAt ? new Date(o.pickedUpAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) : '',
      })
    })
    allSheet.getRow(1).font = { bold: true }
    allSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7fdc94' } }

    // Sheet 3~N: 按状态
    const sheetNameMap: Record<string, string> = {
      done: '已完成',
      pending: '待核销',
      paid: '已支付',
      preparing: '备货中',
      ready: '可取货',
      delivered: '已完成',
      completed: '已完成',
      cancelled: '已取消',
      refunded: '已退款',
    }
    for (const [status, list] of Object.entries(byStatus)) {
      const sheetName = sheetNameMap[status] || STATUS_LABEL[status] || status
      const sheet = wb.addWorksheet(sheetName)
      sheet.columns = allSheet.columns
      list.forEach((o: any) => {
        sheet.addRow({
          orderNo: o.orderNo,
          status: STATUS_LABEL[o.status] || o.status,
          pickupCode: o.pickupCode || '',
          customerName: o.customerName || '匿名',
          customerPhone: o.customerPhone || '',
          itemCount: Number(o.itemCount || 0),
          totalAmount: Number(o.totalAmount || 0).toFixed(2),
          discountAmount: Number(o.discountAmount || 0).toFixed(2),
          pointsValue: Number(o.pointsValue || 0).toFixed(2),
          finalAmount: Number(o.finalAmount || 0).toFixed(2),
          createdAt: o.createdAt ? new Date(o.createdAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) : '',
          paidAt: o.paidAt ? new Date(o.paidAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) : '',
          pickedUpAt: o.pickedUpAt ? new Date(o.pickedUpAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) : '',
        })
      })
      sheet.getRow(1).font = { bold: true }
      sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7fdc94' } }
    }

    // Sheet 末尾: 商品明细
    if (items.length > 0) {
      const itemSheet = wb.addWorksheet('商品明细')
      itemSheet.columns = [
        { header: '订单号', key: 'orderId', width: 22 },
        { header: '商品名', key: 'productName', width: 32 },
        { header: '数量', key: 'quantity', width: 8 },
        { header: '单价', key: 'price', width: 10 },
        { header: '小计', key: 'subtotal', width: 10 },
      ]
      // 把订单号 join 上
      const orderNoMap: Record<string, string> = {}
      orders.forEach((o) => { orderNoMap[o.id] = o.orderNo })
      items.forEach((it) => {
        itemSheet.addRow({
          orderId: orderNoMap[it.orderId] || it.orderId,
          productName: it.productName || '',
          quantity: Number(it.quantity || 0),
          price: Number(it.price || 0).toFixed(2),
          subtotal: Number(it.subtotal || 0).toFixed(2),
        })
      })
      itemSheet.getRow(1).font = { bold: true }
      itemSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7fdc94' } }
    }

    // 输出
    const buf = await wb.xlsx.writeBuffer()
    const dateStr = new Date().toISOString().slice(0, 10)
    // ⭐ 2026-07-13 23:50 HTTP header 必须 ASCII，中文 filename 需要 RFC 5987 编码
    const asciiName = `orders_${dateStr}.xlsx`
    const utf8Name = `果蔬订单_${from || '全部'}_${to || '至今'}_${dateStr}.xlsx`
    const encodedUtf8 = encodeURIComponent(utf8Name)
    return new NextResponse(buf as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedUtf8}`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}