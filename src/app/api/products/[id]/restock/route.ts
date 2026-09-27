import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdminRequest, unauthorized } from '@/lib/admin-jwt-auth'

export const runtime = 'nodejs'


/**
 * POST /api/products/[id]/restock
 * 管理员补货：stock += quantity
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = verifyAdminRequest(request)
    if (!auth.ok) return unauthorized(auth)

    const { id } = await params
    const body = await request.json()
    const qty = Number(body.quantity || 10)

    if (qty <= 0) return NextResponse.json({ success: false, error: '补货数量必须 > 0' }, { status: 400 })

    // 用 raw SQL 避免 prisma schema sync 问题
    const products = await prisma.$queryRaw<{ id: string; name: string; stock: number }[]>`SELECT id, name, stock FROM Product WHERE id = ${id} LIMIT 1`
    const product = products[0]
    if (!product) return NextResponse.json({ success: false, error: '商品不存在' }, { status: 404 })

    const newStock = (product.stock || 0) + qty
    await prisma.$executeRaw`UPDATE Product SET stock = ${newStock} WHERE id = ${id}`

    await prisma.$executeRaw`
      INSERT INTO AuditLog (id, actorType, actorId, action, target, description, createdAt)
      VALUES (${`al_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`}, 'admin', null, 'restock', ${id}, ${`商品「${product.name}」补货 ${qty} 件（${product.stock} → ${newStock}）`}, CURRENT_TIMESTAMP)
    `

    return NextResponse.json({ success: true, newStock, productName: product.name })
  } catch (error: any) {
    console.error('[products/restock POST]', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
