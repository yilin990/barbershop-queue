/**
 * GET /api/admin/ai-chat
 *
 * 商户后台 AI 药师对话历史
 * - 4 类汇总: 今日总数 / 紧急数 / 工具调用数 / 唯一顾客数
 * - 列表: 按时间倒序
 * - 筛选: phone, isEmergency, days
 *
 * 2026-07-20 16:17 奕霖"换位思考"反馈后落地
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { ADMIN_MERCHANT_ID } from '@/lib/admin-merchant'
import { verifyAdminRequest, unauthorized } from '@/lib/admin-jwt-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// 服务端 PIN 鉴权（与 /api/admin/products-list 一致）

export async function GET(request: NextRequest) {
  const auth = verifyAdminRequest(request)
  if (!auth.ok) return unauthorized(auth)

  const params = request.nextUrl.searchParams
  const limit = Math.min(Number(params.get('limit')) || 30, 200)
  const page = Math.max(Number(params.get('page')) || 1, 1)
  const offset = (page - 1) * limit
  const filterPhone = params.get('phone') || null
  const filterEmergency = params.get('emergency') === '1'
  const days = Math.min(Number(params.get('days')) || 7, 90)

  try {
    // 1. 汇总（4 类: 今日/紧急/工具/顾客）
    const sinceISO = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const windowISO = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    const summaryRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT
        SUM(CASE WHEN createdAt >= ? THEN 1 ELSE 0 END) AS today_count,
        SUM(CASE WHEN createdAt >= ? AND isEmergency = 1 THEN 1 ELSE 0 END) AS emergency_count,
        SUM(CASE WHEN createdAt >= ? AND tools != '[]' AND tools IS NOT NULL THEN 1 ELSE 0 END) AS tool_count,
        COUNT(DISTINCT CASE WHEN createdAt >= ? AND phone IS NOT NULL THEN phone END) AS unique_customers
       FROM ChatLog
       WHERE createdAt >= ? AND phone IN (SELECT phone FROM Customer WHERE merchantId = ?)`,
      sinceISO, sinceISO, sinceISO, sinceISO, windowISO, ADMIN_MERCHANT_ID
    )

    const summary = summaryRows[0] || {}
    const summaryData = {
      todayCount: Number(summary.today_count) || 0,
      emergencyCount: Number(summary.emergency_count) || 0,
      toolCount: Number(summary.tool_count) || 0,
      uniqueCustomers: Number(summary.unique_customers) || 0,
    }

    // 2. 列表
    const where: string[] = ['1=1']
    const args: any[] = []
    if (filterPhone) {
      where.push('phone = ?')
      args.push(filterPhone)
    }
    if (filterEmergency) {
      where.push('isEmergency = 1')
    }
    where.push(`createdAt >= ?`)
    args.push(windowISO)

    const whereClause = where.join(' AND ')
    const countRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*) AS total FROM ChatLog WHERE ${whereClause} AND phone IN (SELECT phone FROM Customer WHERE merchantId = ?)`,
      ...args, ADMIN_MERCHANT_ID
    )
    const total = Number(countRows[0]?.total) || 0

    const listArgs = [...args, ADMIN_MERCHANT_ID, limit, offset]
    // ⭐ P0 #3 方案 A（奕霖 2026-07-20 16:42）：紧急对话置顶
    // sort=newest（默认）：时间倒序
    // sort=emergency_first：isEmergency DESC, createdAt DESC
    const sortMode = params.get('sort') === 'emergency_first'
      ? 'ORDER BY isEmergency DESC, createdAt DESC'
      : 'ORDER BY createdAt DESC'
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id, phone, userName, userMessage, aiReply, tools, isEmergency, createdAt
       FROM ChatLog
       WHERE ${whereClause}
       AND phone IN (SELECT phone FROM Customer WHERE merchantId = ?)
       ${sortMode}
       LIMIT ? OFFSET ?`,
      ...args, ADMIN_MERCHANT_ID, limit, offset
    )

    const items = rows.map((r) => {
      let toolsArr: string[] = []
      try {
        toolsArr = JSON.parse(r.tools || '[]')
      } catch {
        toolsArr = []
      }
      return {
        id: r.id,
        phone: r.phone,
        userName: r.userName,
        userMessage: r.userMessage,
        aiReply: r.aiReply,
        tools: toolsArr,
        isEmergency: Boolean(r.isEmergency),
        createdAt: r.createdAt,
      }
    })

    return Response.json({
      success: true,
      summary: summaryData,
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    })
  } catch (err: any) {
    console.error('[ai-chat admin API] error:', err?.message || err)
    return Response.json({ success: false, error: '读取失败: ' + (err?.message || '未知错误') }, { status: 500 })
  }
}
