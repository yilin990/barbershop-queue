import { NextRequest, NextResponse } from 'next/server'
import { getIdentityProfile, isValidPhone } from '@/lib/identity-core'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

/**
 * GET /api/identity/profile?phone=13800138000
 * GET /api/identity/profile?id=<identityId>
 *
 * ⭐ 这是「客户在我手里」的证明：
 *   无论这个人是从小程序、还是 PWA、还是未来的 App 进来的，
 *   查出来的都是同一个人 —— 同一份跨门店余额，同一串通道。
 *
 *   balances[] 跨门店（身份全局，余额按店分开）
 *   channels[]  他用过哪些入口（openid 只是通道）
 *   txns[]      最近 20 条储值/消费流水
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const phone = searchParams.get('phone')

    let identityId = id
    if (!identityId) {
      if (!isValidPhone(phone)) {
        return NextResponse.json(
          { success: false, error: '请提供 id，或格式正确的 phone' },
          { status: 400 }
        )
      }
      const found = await prisma.identity.findUnique({ where: { phone: phone.trim() } })
      if (!found) {
        return NextResponse.json({ success: false, error: '身份不存在' }, { status: 404 })
      }
      identityId = found.id
    }

    const profile = await getIdentityProfile(identityId)
    if (!profile) {
      return NextResponse.json({ success: false, error: '身份不存在' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: profile })
  } catch (err: any) {
    console.error('[identity/profile]', err)
    return NextResponse.json(
      { success: false, error: err?.message ?? '读取身份失败' },
      { status: 500 }
    )
  }
}
