import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminRequest, unauthorized } from '@/lib/admin-jwt-auth'

export const runtime = 'nodejs'

/**
 * GET /api/admin/ads
 * 广告位列表
 * 0-1 阶段：schema 没 AdSlot 表，返回空数组。明天建表 + 真数据
 */
export async function GET(request: NextRequest) {
  const auth = verifyAdminRequest(request)
  // tsconfig 的 **/*.ts 把 .next* 里的 12 份副本也扫进来了，
  // AdminAuthResult 有多份声明导致收窄不稳，这里显式收窄避开
  if (!auth.ok) return unauthorized(auth as Extract<typeof auth, { ok: false }>)

  return NextResponse.json({
    success: true,
    ads: [],
    note: '广告位表还没建，0-1 阶段 3 个位置都空。明天建表 + 上传素材',
  })
}
