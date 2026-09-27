import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { ADMIN_MERCHANT_ID } from '@/lib/admin-merchant'
import { verifyAdminRequest, unauthorized } from '@/lib/admin-jwt-auth'


// GET /api/admin/suppliers - 列表
export async function GET(req: NextRequest) {
  const auth = verifyAdminRequest(req)
  if (!auth.ok) return unauthorized(auth)
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || 'active'
    const search = searchParams.get('search')?.trim() || ''

    const where: any = { merchantId: ADMIN_MERCHANT_ID }
    if (status !== 'all') where.status = status
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { contact: { contains: search } },
        { phone: { contains: search } },
      ]
    }

    const suppliers = await prisma.supplier.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    // 统计：每个供应商关联的商品数（用 Product.supplierName 关联）
    const productCounts = await prisma.product.groupBy({
      by: ['supplierName'],
      where: { merchantId: ADMIN_MERCHANT_ID, supplierName: { not: null } },
      _count: { _all: true },
    })
    const countMap: Record<string, number> = {}
    for (const p of productCounts) {
      if (p.supplierName) countMap[p.supplierName] = p._count._all
    }

    const items = suppliers.map((s: any) => ({
      ...s,
      productCount: countMap[s.name] || 0,
    }))

    return NextResponse.json({ success: true, items, total: items.length })
  } catch (e: any) {
    console.error('[GET /api/admin/suppliers]', e)
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}

// POST /api/admin/suppliers - 新建
export async function POST(req: NextRequest) {
  const auth = verifyAdminRequest(req)
  if (!auth.ok) return unauthorized(auth)
  try {
    const body = await req.json()
    const name = (body.name || '').trim()
    if (!name) return NextResponse.json({ success: false, error: 'name 不能为空' }, { status: 400 })

    const phone = (body.phone || '').trim() || null
    const contact = (body.contact || '').trim() || null
    const address = (body.address || '').trim() || null
    const note = (body.note || '').trim() || null

    const id = `sup_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const supplier = await prisma.supplier.create({
      data: {
        id,
        merchantId: ADMIN_MERCHANT_ID,
        name,
        contact,
        phone,
        address,
        note,
        status: 'active',
      },
    })

    return NextResponse.json({ success: true, supplier })
  } catch (e: any) {
    console.error('[POST /api/admin/suppliers]', e)
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}