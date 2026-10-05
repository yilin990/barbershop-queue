/**
 * /api/products - 商品列表（Day 2 重构 → thin shell）
 *
 * 业务全部在 @/domain/product/service
 *
 * 支持：搜索 + 多筛选 + 排序 + 分页 + 5min server cache
 */

import { NextRequest } from 'next/server'
import { listProducts } from '@/domain/product/service'
import { cacheHeaders, CACHE_TTL } from '@/lib/cache-headers'
import { errorResponse, successResponse } from '@/lib/error'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const result = await listProducts({
      merchantCode: searchParams.get('merchantCode') || undefined,
      q: searchParams.get('q') || '',
      category: searchParams.get('category') || '',
      qm: searchParams.get('qm') || '',
      functionTag: searchParams.get('functionTag') || '',
      inStock: searchParams.get('inStock') === '1',
      sort: (searchParams.get('sort') as any) || 'sales',
      page: parseInt(searchParams.get('page') || '1'),
      pageSize: parseInt(searchParams.get('pageSize') || '20'),
    })
    const headers = cacheHeaders(CACHE_TTL.LIST)
    return new Response(JSON.stringify({ success: true, ...result }), {
      status: 200,
      headers: { ...headers, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return errorResponse(e)
  }
}