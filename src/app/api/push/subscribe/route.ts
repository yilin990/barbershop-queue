/**
 * /api/push/subscribe - 顾客开启到号提醒
 * POST   { phone, merchantId, subscription:{endpoint, keys:{p256dh,auth}} }  开启/更新
 * DELETE ?endpoint=...  关闭
 *
 * 按 (phone, merchantId) 绑定：授权一次，之后每张单子都能收到
 */

import { NextRequest, NextResponse } from 'next/server'
import { upsertSubscription, removeSubscription } from '@/lib/webpush-server'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phone, merchantId, subscription } = body || {}
    if (!phone || !merchantId || !subscription?.endpoint) {
      return NextResponse.json(
        { success: false, error: 'phone / merchantId / subscription.endpoint 必填' },
        { status: 400 }
      )
    }
    upsertSubscription({
      phone: String(phone).trim(),
      merchantId: String(merchantId).trim(),
      endpoint: subscription.endpoint,
      p256dh: subscription.keys?.p256dh || '',
      auth: subscription.keys?.auth || '',
      userAgent: request.headers.get('user-agent') || undefined,
    })
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json(
      { success: false, error: (e as Error).message },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const endpoint = searchParams.get('endpoint') || ''
    if (!endpoint) {
      return NextResponse.json({ success: false, error: 'endpoint 必填' }, { status: 400 })
    }
    return NextResponse.json({ success: removeSubscription(endpoint) })
  } catch (e) {
    return NextResponse.json(
      { success: false, error: (e as Error).message },
      { status: 500 }
    )
  }
}
