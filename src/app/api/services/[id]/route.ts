/**
 * /api/services/[id] — 单个服务的更新/删除（2026-10-01 清禾方案 A）
 *
 *   GET    /api/services/[id]            →  详情（含 merchant 隔离校验）
 *   PUT    /api/services/[id]            →  更新
 *   DELETE /api/services/[id]            →  删除
 *
 * 安全：
 *  - 所有 mutation 必须先校验 service.merchantId 与目标一致
 *  - 禁止跨租户操作
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { errorResponse, successResponse } from '@/lib/error'

export const runtime = 'nodejs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const merchantId = (searchParams.get('merchantId') || '').trim()

    if (!merchantId) return errorResponse(new Error('merchantId 必填'), 400)

    // ⭐ 多租户隔离：where 同时含 id + merchantId
    const service = await prisma.service.findFirst({
      where: { id, merchantId },
    })
    if (!service) return errorResponse(new Error('服务不存在或无权访问'), 404)

    return successResponse({ service })
  } catch (e: any) {
    return errorResponse(e)
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const merchantId = (body.merchantId || '').trim()

    if (!merchantId) return errorResponse(new Error('merchantId 必填'), 400)

    // ⭐ 强校验：服务存在 + merchantId 匹配（防越权）
    const existing = await prisma.service.findFirst({
      where: { id, merchantId },
    })
    if (!existing) return errorResponse(new Error('服务不存在或无权访问'), 404)

    const updateData: any = {}
    if (body.name !== undefined) updateData.name = String(body.name).trim()
    if (body.shortName !== undefined) updateData.shortName = String(body.shortName).trim() || null
    if (body.category !== undefined) updateData.category = String(body.category).trim()
    if (body.icon !== undefined) updateData.icon = String(body.icon).trim() || null
    if (body.image !== undefined) updateData.image = String(body.image).trim() || null
    if (body.description !== undefined) updateData.description = String(body.description).trim() || null
    if (body.price !== undefined) updateData.price = Number(body.price) || 0
    if (body.duration !== undefined) updateData.duration = parseInt(body.duration) || 60
    if (body.status !== undefined) updateData.status = body.status

    // serviceCode 单独走迁移校验
    if (body.serviceCode !== undefined && body.serviceCode !== existing.serviceCode) {
      const newCode = String(body.serviceCode).trim()
      if (!newCode) return errorResponse(new Error('serviceCode 不能为空'), 400)
      const dup = await prisma.service.findUnique({
        where: { merchantId_serviceCode: { merchantId, serviceCode: newCode } },
      })
      if (dup && dup.id !== id) return errorResponse(new Error(`服务编码 ${newCode} 已存在`), 409)
      updateData.serviceCode = newCode
    }

    const service = await prisma.service.update({
      where: { id },
      data: updateData,
    })

    return successResponse({ service, updatedFields: Object.keys(updateData).length })
  } catch (e: any) {
    if (e.code === 'P2002') {
      return errorResponse(new Error('商户内 serviceCode 必须唯一'), 409)
    }
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

    // ⭐ 多租户隔离
    const existing = await prisma.service.findFirst({
      where: { id, merchantId },
    })
    if (!existing) return errorResponse(new Error('服务不存在或无权访问'), 404)

    await prisma.service.delete({ where: { id } })
    return successResponse({ deleted: true, id })
  } catch (e: any) {
    return errorResponse(e)
  }
}