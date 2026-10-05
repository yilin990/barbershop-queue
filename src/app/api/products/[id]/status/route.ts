import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdminRequest, unauthorized } from '@/lib/admin-jwt-auth'

export const runtime = 'nodejs'


/**
 * PATCH /api/products/[id]/status
 * 上下架切换：body { status: 'active' | 'inactive' }
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = verifyAdminRequest(request)
    if (!auth.ok) return unauthorized(auth)

    const { id } = await params
    const body = await request.json()
    const status = body.status

    if (status !== 'active' && status !== 'inactive') {
      return NextResponse.json({ success: false, error: 'status 必须是 active 或 inactive' }, { status: 400 })
    }

    // 用 raw SQL 避免 prisma schema sync 问题
    const products = await prisma.$queryRaw<{ id: string; name: string; status: string }[]>`SELECT id, name, status FROM Product WHERE id = ${id} LIMIT 1`
    const product = products[0]
    if (!product) return NextResponse.json({ success: false, error: '商品不存在' }, { status: 404 })

    await prisma.$executeRaw`UPDATE Product SET status = ${status} WHERE id = ${id}`

    const action = status === 'active' ? '上架' : '下架'
    await prisma.$executeRaw`
      INSERT INTO AuditLog (id, actorType, actorId, action, target, description, createdAt)
      VALUES (${`al_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`}, 'admin', null, ${`product_${status}`}, ${id}, ${`商品「${product.name}」${action}`}, CURRENT_TIMESTAMP)
    `

    return NextResponse.json({ success: true, status, productName: product.name })
  } catch (error: any) {
    console.error('[products/status PATCH]', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}