import { NextResponse } from 'next/server'
import { getVapidPublicKey } from '@/lib/webpush-server'

export const runtime = 'nodejs'

/** GET /api/push/vapid-public-key - 前端订阅时需要公钥 */
export async function GET() {
  try {
    return NextResponse.json({ success: true, publicKey: getVapidPublicKey() })
  } catch (e) {
    return NextResponse.json(
      { success: false, error: (e as Error).message },
      { status: 500 }
    )
  }
}
