/**
 * /api/services — 商户造型服务管理（2026-10-01 清禾方案 A）
 *
 * 核心：每个商户的数据完全独立 · merchantId 强校验
 *
 *   GET    /api/services?merchantId=xxx    →  列表
 *   POST   /api/services                    →  创建（body 含 merchantId）
 *
 * 安全：
 *  - 所有查询必须带 merchantId · 防止跨租户数据泄露
 *  - 创建时验证 merchantId 在 Merchant 表存在
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { errorResponse, successResponse } from '@/lib/error'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const merchantId = (searchParams.get('merchantId') || '').trim()
    const category = (searchParams.get('category') || '').trim()
    const status = (searchParams.get('status') || '').trim()
    const includeInactive = searchParams.get('includeInactive') === '1'

    if (!merchantId) {
      return errorResponse(new Error('merchantId 必填 · 多租户隔离'), 400)
    }

    // ⭐ 强校验：merchant 必须存在
    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { id: true, name: true },
    })
    if (!merchant) {
      return errorResponse(new Error('商户不存在'), 404)
    }

    // ⭐ 多租户隔离：所有查询都带 merchantId
    const where: any = { merchantId }
    if (category) where.category = category
    if (!includeInactive) where.status = 'active'
    else if (status) where.status = status

    const services = await prisma.service.findMany({
      where,
      orderBy: [{ category: 'asc' }, { serviceCode: 'asc' }],
    })

    return successResponse({
      services,
      merchant: { id: merchant.id, name: merchant.name },
      total: services.length,
    })
  } catch (e: any) {
    return errorResponse(e)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const merchantId = (body.merchantId || '').trim()
    const serviceCode = (body.serviceCode || '').trim()
    const name = (body.name || '').trim()
    const category = (body.category || '').trim()

    // 必填校验
    if (!merchantId) return errorResponse(new Error('merchantId 必填'), 400)
    if (!serviceCode) return errorResponse(new Error('serviceCode 必填'), 400)
    if (!name) return errorResponse(new Error('name 必填'), 400)
    if (!category) return errorResponse(new Error('category 必填'), 400)

    // ⭐ 校验 merchant 存在
    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { id: true },
    })
    if (!merchant) return errorResponse(new Error('商户不存在'), 404)

    // ⭐ 商户内 serviceCode 唯一（DB unique 索引会兜底）
    const existing = await prisma.service.findUnique({
      where: { merchantId_serviceCode: { merchantId, serviceCode } },
    })
    if (existing) {
      return errorResponse(new Error(`服务编码 ${serviceCode} 已存在`), 409)
    }

    const service = await prisma.service.create({
      data: {
        merchantId,
        serviceCode,
        name,
        shortName: (body.shortName || '').trim() || null,
        category,
        icon: (body.icon || '').trim() || null,
        image: (body.image || '').trim() || null,
        description: (body.description || '').trim() || null,
        price: Number(body.price) || 0,
        duration: parseInt(body.duration) || 60,
        status: body.status || 'active',
      },
    })

    return successResponse({ service, created: true }, 201)
  } catch (e: any) {
    // Prisma 唯一约束冲突
    if (e.code === 'P2002') {
      return errorResponse(new Error('商户内 serviceCode 必须唯一'), 409)
    }
    return errorResponse(e)
  }
}
// v1.1.42 PATCH：店长改服务标准价
//   为什么要这个：价格之前写死在 Service 表里，改一次要找我。
//   店长自己会调价（剪发 58 → 68），这种事一天可能好几回，不能老等人。
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const id = (body.id || '').trim()
    const merchantId = (body.merchantId || '').trim()
    const price = Number(body.price)

    if (!id) return errorResponse(new Error('id 必填'), 400)
    if (!merchantId) return errorResponse(new Error('merchantId 必填'), 400)
    if (!Number.isFinite(price) || price < 0 || price > 99999) {
      return errorResponse(new Error('价格必须是 0 ~ 99999 之间的数字'), 400)
    }

    const svc = await prisma.service.findUnique({ where: { id } })
    if (!svc) return errorResponse(new Error('服务不存在'), 404)
    // 多租户隔离：不能改别家商户的服务
    if (svc.merchantId !== merchantId) {
      return errorResponse(new Error('无权修改该商户的服务'), 403)
    }

    // 保留 2 位，避免浮点误差往下累积
    const rounded = Math.round(price * 100) / 100
    const updated = await prisma.service.update({
      where: { id },
      data: { price: rounded },
    })

    return successResponse({ service: updated, updated: true })
  } catch (e: any) {
    return errorResponse(e)
  }
}