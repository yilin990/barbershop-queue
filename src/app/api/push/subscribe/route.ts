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
    // ⭐ 2026-10-07 清禾：手机号允许为空
    //   upsertSubscription 以 endpoint 为冲突键并 UPDATE phone，
    //   所以可以「先订阅、后补手机号」，客户端拿到登录/取号手机号后自动补登记。
    //   卡住「必须先登录才能订阅」正是之前 iPhone 订阅一直建不成的根因之一。
    if (!merchantId || !subscription?.endpoint) {
      return NextResponse.json(
        { success: false, error: 'merchantId / subscription.endpoint 必填' },
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
