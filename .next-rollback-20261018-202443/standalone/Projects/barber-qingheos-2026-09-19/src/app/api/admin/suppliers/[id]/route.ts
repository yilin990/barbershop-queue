import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { ADMIN_MERCHANT_ID } from '@/lib/admin-merchant'
import { verifyAdminRequest, unauthorized } from '@/lib/admin-jwt-auth'


// GET /api/admin/suppliers/[id] - 详情（含关联商品 + 采购单统计）
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyAdminRequest(req)
  if (!auth.ok) return unauthorized(auth)
  try {
    const { id } = await params
    const supplier = await prisma.supplier.findUnique({ where: { id } })
    if (!supplier) return NextResponse.json({ success: false, error: '供应商不存在' }, { status: 404 })

    const products = await prisma.product.findMany({
      where: { merchantId: ADMIN_MERCHANT_ID, supplierName: supplier.name },
      select: { id: true, name: true, shortName: true, productCode: true, price: true, costPrice: true, stock: true, status: true },
      orderBy: { name: 'asc' },
    })
    const orderCount = await prisma.purchaseOrder.count({ where: { supplierId: id } })

    return NextResponse.json({
      success: true,
      supplier,
      products,
      stats: { productCount: products.length, orderCount },
    })
  } catch (e: any) {
    console.error('[GET /api/admin/suppliers/[id]]', e)
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}

// PATCH /api/admin/suppliers/[id] - 编辑
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyAdminRequest(req)
  if (!auth.ok) return unauthorized(auth)
  try {
    const { id } = await params
    const body = await req.json()
    const data: any = { updatedAt: new Date() }

    if (body.name !== undefined) {
      const name = (body.name || '').trim()
      if (!name) return NextResponse.json({ success: false, error: 'name 不能为空' }, { status: 400 })
      data.name = name
    }
    if (body.contact !== undefined) data.contact = (body.contact || '').trim() || null
    if (body.phone !== undefined) data.phone = (body.phone || '').trim() || null
    if (body.address !== undefined) data.address = (body.address || '').trim() || null
    if (body.note !== undefined) data.note = (body.note || '').trim() || null
    if (body.status !== undefined) {
      if (!['active', 'inactive'].includes(body.status)) {
        return NextResponse.json({ success: false, error: 'status 必须是 active/inactive' }, { status: 400 })
      }
      data.status = body.status
    }

    const supplier = await prisma.supplier.update({ where: { id }, data })
    return NextResponse.json({ success: true, supplier })
  } catch (e: any) {
    console.error('[PATCH /api/admin/suppliers/[id]]', e)
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}

// DELETE /api/admin/suppliers/[id] - 删除（无关联采购单才允许）
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyAdminRequest(req)
  if (!auth.ok) return unauthorized(auth)
  try {
    const { id } = await params
    const orderCount = await prisma.purchaseOrder.count({ where: { supplierId: id } })
    if (orderCount > 0) {
      return NextResponse.json(
        { success: false, error: `该供应商有 ${orderCount} 个采购单，无法删除（建议改为 inactive）` },
        { status: 400 }
      )
    }
    await prisma.supplier.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('[DELETE /api/admin/suppliers/[id]]', e)
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}