import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

// Logout is client-side only (JWT is stateless)
// This endpoint exists for potential future token blacklist / audit logging
export async function POST(request: NextRequest) {
  try {
    // In a stateless JWT setup, logout is handled client-side by removing the token.
    // If you need server-side token invalidation, implement a Redis blacklist here.
    return NextResponse.json({ success: true, message: '已退出登录' })
  } catch (error) {
    console.error('[logout] Error:', error)
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 })
  }
}