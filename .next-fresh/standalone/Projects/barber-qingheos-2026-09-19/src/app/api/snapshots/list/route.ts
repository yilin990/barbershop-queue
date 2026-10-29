import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const productId = searchParams.get('productId')
    const days = parseInt(searchParams.get('days') || '3')
    const merchantId = searchParams.get('merchantId') || 'm_grocery_001'

    // ⭐ MEMORY §290 fix: 之前 days=3 过滤把 8-24 之前的 mmx 图全过滤掉了
    // 现在用 days=30 兜底(3 天滚动清理是 cron /api/cleanup-snapshots 负责)
    const sinceUnix = Math.floor((Date.now() - 30 * 86400 * 1000) / 1000)

    let query = `SELECT id, productId, merchantId, photoUrl, shotAt, period, shotBy, note, createdAt
                 FROM PhotoSnapshot
                 WHERE merchantId = ? AND datetime(createdAt) >= datetime(?, 'unixepoch')`
    const params: any[] = [merchantId, sinceUnix]
    if (productId) {
      query += ` AND productId = ?`
      params.push(productId)
    }
    query += ` ORDER BY createdAt DESC LIMIT 100`

    const rows = await prisma.$queryRawUnsafe(query, ...params)
    return NextResponse.json({ success: true, snapshots: rows })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}
