import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdminRequest, unauthorized } from '@/lib/admin-jwt-auth'
import { ADMIN_MERCHANT_ID } from '@/lib/admin-merchant'

export const runtime = 'nodejs'

/**
 * POST /api/admin/warn
 * 管理员警告商户
 * 埋点：audit_log action='warn_merchant'
 * 鉴权：复用 /admin PIN 守卫（仅在已登录态可调用）
 */
export async function POST(request: NextRequest) {
  // 2026-10-16 清禾加固：原来只查 cookie 非空，伪造值即可越权写 AuditLog
  const auth = verifyAdminRequest(request)
  // tsconfig 的 **/*.ts 把 .next* 里的 12 份副本也扫进来了，
  // AdminAuthResult 有多份声明导致收窄不稳，这里显式收窄避开
  if (!auth.ok) return unauthorized(auth as Extract<typeof auth, { ok: false }>)

  try {
    const body = await request.json()
    const { merchantId, reason } = body

    if (!merchantId || !reason) {
      return NextResponse.json({ success: false, error: '参数缺失' }, { status: 400 })
    }

    // 埋点
    await prisma.$executeRaw`
      INSERT INTO AuditLog (id, merchantId, actorType, actorId, action, target, description, createdAt)
      VALUES (${`al_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`}, ${merchantId}, 'admin', null, 'warn_merchant', ${merchantId}, ${`警告商户「${merchantId}」：${reason}`}, CURRENT_TIMESTAMP)
    `

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[admin/warn POST]', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
