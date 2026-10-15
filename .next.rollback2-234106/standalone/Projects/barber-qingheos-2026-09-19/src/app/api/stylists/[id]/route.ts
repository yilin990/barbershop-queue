/**
 * /api/stylists/[id] - 单个理发师
 *
 *   PUT    /api/stylists/[id]                更新
 *   DELETE /api/stylists/[id]?merchantId=xx 删除
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { errorResponse, successResponse } from '@/lib/error'

export const runtime = 'nodejs'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const merchantId = (body.merchantId || '').trim()
    if (!merchantId) return errorResponse(new Error('merchantId 必填'), 400)

    const existing = await prisma.merchantStaff.findFirst({ where: { id, merchantId } })
    if (!existing) return errorResponse(new Error('理发师不存在或无权访问'), 404)

    // ⭐ 2026-10-02 21:02 修：DB 现在已经有 code/avatar/bio/specialties/yearsOfExp/startPrice/active 列
    // 把所有 body 字段正确写入 + specialties 支持字符串和数组两种格式
    const updateData: any = {}
    if (body.name !== undefined) updateData.name = body.name?.trim() || existing.name
    if (body.phone !== undefined) updateData.phone = body.phone?.trim() || existing.phone
    if (body.code !== undefined) updateData.code = body.code?.trim() || null
    if (body.avatar !== undefined) updateData.avatar = body.avatar || null
    if (body.bio !== undefined) updateData.bio = body.bio || null
    if (body.specialties !== undefined) {
      updateData.specialties = typeof body.specialties === 'string'
        ? body.specialties
        : JSON.stringify(body.specialties || [])
    }
    if (body.yearsOfExp !== undefined) updateData.yearsOfExp = Number(body.yearsOfExp) || 0
    if (body.startPrice !== undefined) updateData.startPrice = Number(body.startPrice) || 0
    if (body.rating !== undefined) updateData.rating = Number(body.rating) || 5.0
    if (body.active !== undefined) updateData.active = !!body.active

    const updated = await prisma.merchantStaff.update({
      where: { id },
      data: updateData,
    })

    return successResponse({
      stylist: {
        id: updated.id,
        merchantId: updated.merchantId,
        name: updated.name,
        phone: updated.phone,
        avatar: updated.avatar,
        bio: updated.bio || '',
        specialties: updated.specialties
          ? (typeof updated.specialties === 'string' ? JSON.parse(updated.specialties) : updated.specialties)
          : [],
        yearsOfExp: updated.yearsOfExp,
        startPrice: updated.startPrice,
        rating: updated.rating,
        code: updated.code,
        active: updated.active,
      },
    })
  } catch (e: any) {
    return errorResponse(e)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const merchantId = (searchParams.get('merchantId') || '').trim()
    if (!merchantId) return errorResponse(new Error('merchantId 必填'), 400)

    const existing = await prisma.merchantStaff.findFirst({ where: { id, merchantId } })
    if (!existing) return errorResponse(new Error('理发师不存在或无权访问'), 404)

    await prisma.merchantStaff.delete({ where: { id } })
    return successResponse({ deleted: true, id })
  } catch (e: any) {
    return errorResponse(e)
  }
}
