/**
 * domain/inventory/purchase.ts
 *
 * 进货单（采购单）业务 — P0 库存管理
 *
 * 5 个入口：
 *   listPurchaseOrders({status, supplierId, search, page, pageSize})   列表+统计
 *   getPurchaseOrder(id)                                               详情
 *   createPurchaseOrder({supplierId, items, note?, expectedDate?})     创建草稿
 *   updatePurchaseOrderStatus(id, newStatus)                           状态机
 *     draft → confirmed → received（自动加库存 + 标记 receivedQty）
 *     draft/confirmed → cancelled（已收/取消不可再改）
 *   deletePurchaseOrder(id)                                            只有 draft 可删
 *
 * 与 restock 互不耦合：restock 算"哪些快断货了"，purchase 是"已经下单的进货单"
 *
 * 复用：跨商家（美发、超市、餐饮）"进货管理"模块
 */

import { prisma } from '@/lib/db'
import { ADMIN_MERCHANT_ID } from '@/lib/admin-merchant'
import { ValidationError, NotFoundError } from '@/lib/error'

// =============== 列表 + 统计 ===============

export interface ListPurchaseOrderParams {
  status?: string
  supplierId?: string
  search?: string
  page: number
  pageSize: number
}

export interface PurchaseOrderStats {
  total: number
  draft: number
  confirmed: number
  received: number
  cancelled: number
  totalCost: number
  totalAmount: number
  supplierStats: Record<string, { name: string; count: number; totalCost: number }>
}

export async function listPurchaseOrders(p: ListPurchaseOrderParams) {
  const where: any = {}
  if (p.status && p.status !== 'all') where.status = p.status
  if (p.supplierId) where.supplierId = p.supplierId

  // 4 个并行查询：count + 分组 + 总和 + 当前页数据
  const [total, allStatuses, supplierCounts, aggSum, orders] = await Promise.all([
    prisma.purchaseOrder.count({ where }),
    prisma.purchaseOrder.groupBy({ by: ['status'], where, _count: { _all: true } }),
    prisma.purchaseOrder.groupBy({
      by: ['supplierId'],
      where,
      _count: { _all: true },
      _sum: { totalCost: true },
    }),
    // ⭐ 关键修复：用 aggregate 而非当前 page 累加
    prisma.purchaseOrder.aggregate({
      where,
      _sum: { totalCost: true, totalAmount: true },
    }),
    prisma.purchaseOrder.findMany({
      where,
      include: {
        items: {
          include: {
            product: {
              select: { id: true, name: true, shortName: true, spec: true, stock: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (p.page - 1) * p.pageSize,
      take: p.pageSize,
    }),
  ])

  // 关联 supplier（仅取本页用到的）
  const supplierIds = [...new Set(orders.map((o) => o.supplierId))]
  const suppliers = supplierIds.length
    ? await prisma.supplier.findMany({
        where: { id: { in: supplierIds } },
        select: { id: true, name: true, contact: true, phone: true },
      })
    : []
  const supplierMap = new Map(suppliers.map((s) => [s.id, s]))

  // 统计 supplier 维度需要的所有供应商名（不只是本页的）
  const allSupplierIds = [...new Set(supplierCounts.map((sc) => sc.supplierId))]
  const allSuppliers = allSupplierIds.length
    ? await prisma.supplier.findMany({
        where: { id: { in: allSupplierIds } },
        select: { id: true, name: true },
      })
    : []
  const allSupplierMap = new Map(allSuppliers.map((s) => [s.id, s]))

  const stats: PurchaseOrderStats = {
    total,
    draft: 0,
    confirmed: 0,
    received: 0,
    cancelled: 0,
    totalCost: aggSum._sum.totalCost || 0,
    totalAmount: aggSum._sum.totalAmount || 0,
    supplierStats: {},
  }
  allStatuses.forEach((s) => {
    if (s.status in stats) (stats as any)[s.status] = s._count._all
  })
  supplierCounts.forEach((sc) => {
    const supplier = allSupplierMap.get(sc.supplierId)
    stats.supplierStats[sc.supplierId] = {
      name: supplier?.name || '未知供应商',
      count: sc._count._all,
      totalCost: sc._sum.totalCost || 0,
    }
  })

  // 搜索过滤（client-side like，SQLite 不支持 contains）
  let filteredOrders = orders
  if (p.search) {
    const s = p.search.toLowerCase()
    filteredOrders = orders.filter((o) => {
      const supplier = supplierMap.get(o.supplierId)
      return (
        o.orderNo.toLowerCase().includes(s) ||
        (o.note && o.note.toLowerCase().includes(s)) ||
        (supplier && supplier.name.toLowerCase().includes(s))
      )
    })
  }

  return {
    items: filteredOrders.map((o) => ({
      ...o,
      supplier: supplierMap.get(o.supplierId) || null,
      itemCount: o.items.length,
      totalQty: o.items.reduce((sum, it) => sum + it.quantity, 0),
    })),
    total,
    page: p.page,
    pageSize: p.pageSize,
    stats,
  }
}

// =============== 详情 ===============

export async function getPurchaseOrder(id: string) {
  const order = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          product: {
            select: { id: true, name: true, shortName: true, spec: true, stock: true, costPrice: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  })
  if (!order) throw new NotFoundError(`采购单 ${id} 不存在`)

  const supplier = await prisma.supplier.findUnique({
    where: { id: order.supplierId },
    select: { id: true, name: true, contact: true, phone: true, address: true },
  })
  return { ...order, supplier }
}

// =============== 创建 ===============

export interface CreatePurchaseOrderInput {
  supplierId: string
  items: Array<{ productId: string; quantity: number; costPrice: number }>
  note?: string
  expectedDate?: string
}

export async function createPurchaseOrder(input: CreatePurchaseOrderInput) {
  if (!input.supplierId) throw new ValidationError('supplierId 必填')
  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new ValidationError('items 不能为空')
  }
  if (input.items.length > 100) throw new ValidationError('单次最多 100 个商品')

  const supplier = await prisma.supplier.findUnique({ where: { id: input.supplierId } })
  if (!supplier) throw new ValidationError('供应商不存在')
  if (supplier.status !== 'active') {
    throw new ValidationError('供应商已停用，无法创建采购单')
  }

  const validatedItems: Array<{
    productId: string
    quantity: number
    costPrice: number
    subtotal: number
  }> = []
  let totalAmount = 0
  let totalCost = 0

  for (const item of input.items) {
    if (!item.productId || typeof item.productId !== 'string') {
      throw new ValidationError('每个 item 必须有 productId')
    }
    const qty = parseInt(String(item.quantity))
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new ValidationError(`商品 ${item.productId} 数量必须 > 0`)
    }
    const cost = parseFloat(String(item.costPrice))
    if (!Number.isFinite(cost) || cost < 0) {
      throw new ValidationError(`商品 ${item.productId} 进价必须 ≥ 0`)
    }

    const product = await prisma.product.findUnique({ where: { id: item.productId } })
    if (!product) throw new ValidationError(`商品 ${item.productId} 不存在`)

    const subtotal = qty * cost
    validatedItems.push({ productId: item.productId, quantity: qty, costPrice: cost, subtotal })
    totalAmount += product.price * qty
    totalCost += subtotal
  }

  // 生成单号：PO + yyyymmdd + hhmmss + 4位随机
  const now = new Date()
  const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
  const hms = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`
  const rand = Math.random().toString(36).substring(2, 6)
  const orderNo = `PO${ymd}${hms}${rand}`
  const id = `po_${Date.now()}_${rand}`

  return prisma.$transaction(async (tx) => {
    const order = await tx.purchaseOrder.create({
      data: {
        id,
        merchantId: ADMIN_MERCHANT_ID,
        supplierId: input.supplierId,
        orderNo,
        status: 'draft',
        totalAmount,
        totalCost,
        expectedDate: input.expectedDate || null,
        note: input.note || null,
        items: {
          create: validatedItems.map((item) => ({
            id: `poi_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
            productId: item.productId,
            quantity: item.quantity,
            costPrice: item.costPrice,
            subtotal: item.subtotal,
            receivedQty: 0,
          })),
        },
      },
      include: { items: true },
    })

    await tx.auditLog.create({
      data: {
        id: `al_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        action: 'create_purchase_order',
        actorType: 'admin',
        description: '创建采购单',
        merchantId: ADMIN_MERCHANT_ID,
        meta: JSON.stringify({
          orderId: id,
          orderNo,
          supplierId: input.supplierId,
          supplierName: supplier.name,
          itemCount: validatedItems.length,
          totalCost,
          totalAmount,
        }),
      },
    })

    return order
  })
}

// =============== 状态机 ===============

/**
 * 状态机：
 *   draft     → confirmed | cancelled
 *   confirmed → received | cancelled
 *   received  → 终态
 *   cancelled → 终态
 *
 * received 时自动：所有 item.receivedQty = item.quantity，Product.stock += quantity
 */
export async function updatePurchaseOrderStatus(id: string, newStatus: string) {
  if (!['draft', 'confirmed', 'received', 'cancelled'].includes(newStatus)) {
    throw new ValidationError('status 必须是 draft/confirmed/received/cancelled')
  }

  const order = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: { items: true },
  })
  if (!order) throw new NotFoundError(`采购单 ${id} 不存在`)

  const allowed: Record<string, string[]> = {
    draft: ['confirmed', 'cancelled'],
    confirmed: ['received', 'cancelled'],
    received: [],
    cancelled: [],
  }
  if (!allowed[order.status].includes(newStatus)) {
    throw new ValidationError(
      `采购单状态 ${order.status} 不能转为 ${newStatus}（允许：${allowed[order.status].join('/') || '无'}）`
    )
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.purchaseOrder.update({
      where: { id },
      data: {
        status: newStatus,
        receivedDate: newStatus === 'received' ? new Date().toISOString() : order.receivedDate,
      },
      include: { items: true },
    })

    // 收货时自动加库存 + 标记 receivedQty
    if (newStatus === 'received') {
      for (const item of order.items) {
        await tx.purchaseOrderItem.update({
          where: { id: item.id },
          data: { receivedQty: item.quantity },
        })
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        })
      }
    }

    await tx.auditLog.create({
      data: {
        id: `al_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        action: `update_po_status_${newStatus}`,
        actorType: 'admin',
        description: `采购单 ${order.orderNo} 状态变为 ${newStatus}`,
        merchantId: ADMIN_MERCHANT_ID,
        meta: JSON.stringify({
          orderId: id,
          orderNo: order.orderNo,
          fromStatus: order.status,
          toStatus: newStatus,
          itemCount: order.items.length,
          totalQty: order.items.reduce((acc, i) => acc + i.quantity, 0),
        }),
      },
    })

    return updated
  })
}

// =============== 删除 ===============

export async function deletePurchaseOrder(id: string) {
  const order = await prisma.purchaseOrder.findUnique({ where: { id } })
  if (!order) throw new NotFoundError(`采购单 ${id} 不存在`)
  if (order.status !== 'draft') {
    throw new ValidationError(`只有草稿状态可以删除，当前状态 ${order.status}`)
  }

  await prisma.$transaction(async (tx) => {
    // 先删 items（CASCADE 会处理，但显式删更好）
    await tx.purchaseOrderItem.deleteMany({ where: { orderId: id } })
    await tx.purchaseOrder.delete({ where: { id } })
    await tx.auditLog.create({
      data: {
        id: `al_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        action: 'delete_purchase_order',
        actorType: 'admin',
        description: `删除采购单 ${order.orderNo}`,
        merchantId: ADMIN_MERCHANT_ID,
        meta: JSON.stringify({ orderId: id, orderNo: order.orderNo }),
      },
    })
  })

  return { deleted: true, id, orderNo: order.orderNo }
}
