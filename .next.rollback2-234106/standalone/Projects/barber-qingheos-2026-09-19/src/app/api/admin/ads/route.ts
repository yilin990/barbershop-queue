import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

/**
 * GET /api/admin/ads
 * 广告位列表
 * 0-1 阶段：schema 没 AdSlot 表，返回空数组。明天建表 + 真数据
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    ads: [],
    note: '广告位表还没建，0-1 阶段 3 个位置都空。明天建表 + 上传素材',
  })
}
