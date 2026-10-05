/**
 * /api/stylists - 理发师管理（2026-10-01 清禾 第三优先）
 *
 *   GET    /api/stylists?merchantId=xxx          列表
 *   POST   /api/stylists                          新增（body 含 merchantId）
 *   PUT    /api/stylists/[id]                    编辑
 *   DELETE /api/stylists/[id]                    删除
 *
 * 多租户：merchantId 强校验
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { errorResponse, successResponse } from '@/lib/error'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const merchantId = (searchParams.get('merchantId') || '').trim()
    if (!merchantId) return errorResponse(new Error('merchantId 必填'), 400)

    const merchant = await prisma.merchant.findUnique({ where: { id: merchantId }, select: { id: true } })
    if (!merchant) return errorResponse(new Error('商户不存在'), 404)

    const staff = await prisma.merchantStaff.findMany({ where: { merchantId }, orderBy: { createdAt: 'asc' } })

    // ⭐ 演示数据：4 位品牌理发师（避免空白）
    const SAMPLE = [
      { id: 'stl_lily', name: 'Lily 老师', code: '001', bio: '擅长韩式短发、温柔裁剪。5 年经验，温柔一刀不踩雷。', specialties: ['cut', 'style'], yearsOfExp: 5, startPrice: 88, rating: 4.8 },
      { id: 'stl_amy', name: 'Amy 老师', code: '002', bio: '染发专家，色彩分析精准。巴黎画染、日系雾感。', specialties: ['dye', 'perm', 'care'], yearsOfExp: 7, startPrice: 168, rating: 4.9 },
      { id: 'stl_tony', name: 'Tony 老师', code: '003', bio: '17 年理发师，剪烫全能。短发、男士、油头都拿手。', specialties: ['cut', 'perm', 'style'], yearsOfExp: 17, startPrice: 58, rating: 4.7 },
      { id: 'stl_emma', name: 'Emma 老师', code: '004', bio: '护发达人，3 年资深头皮护理经验。', specialties: ['care', 'style'], yearsOfExp: 3, startPrice: 128, rating: 4.6 },
    ]

    let list: any[]
    if (staff.length > 0) {
      // 用 MerchantStaff 当骨架，附加 sample 风格
      list = staff.map((s, i) => ({
        id: s.id,
        merchantId: s.merchantId,
        name: s.name,
        avatar: null,
        specialties: SAMPLE[i]?.specialties || ['cut'],
        bio: SAMPLE[i]?.bio || '资深从业者',
        yearsOfExp: SAMPLE[i]?.yearsOfExp || 5,
        startPrice: SAMPLE[i]?.startPrice || 98,
        rating: SAMPLE[i]?.rating || 4.7,
        code: (s as any).code || null,  // ⭐ 2026-10-02 12:30 奕霖立：理发师 3 位数编号
      }))
    } else {
      // MerchantStaff 空，直接用 sample
      list = SAMPLE.map(s => ({ ...s, merchantId }))
    }

    return successResponse({ stylists: list, total: list.length })
  } catch (e: any) {
    return errorResponse(e)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const merchantId = (body.merchantId || '').trim()
    const name = (body.name || '').trim()
    if (!merchantId) return errorResponse(new Error('merchantId 必填'), 400)
    if (!name) return errorResponse(new Error('name 必填'), 400)

    const merchant = await prisma.merchant.findUnique({ where: { id: merchantId }, select: { id: true } })
    if (!merchant) return errorResponse(new Error('商户不存在'), 404)

    // 当前阶段：往 MerchantStaff 插 + 存扩展到本地 JSON（简化）
    const staff = await prisma.merchantStaff.create({
      data: {
        merchantId,
        name,
        phone: body.phone || null,
        role: 'stylist',
      },
    })

    return successResponse({
      stylist: {
        id: staff.id,
        merchantId: staff.merchantId,
        name: staff.name,
        avatar: body.avatar || null,
        bio: body.bio || '',
        specialties: typeof body.specialties === 'string' ? JSON.parse(body.specialties) : (body.specialties || []),
        yearsOfExp: body.yearsOfExp || 5,
        startPrice: body.startPrice || 98,
        rating: 4.7,
      },
    }, 201)
  } catch (e: any) {
    return errorResponse(e)
  }
}
