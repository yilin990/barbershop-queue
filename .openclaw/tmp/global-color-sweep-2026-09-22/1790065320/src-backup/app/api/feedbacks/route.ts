import { NextRequest, NextResponse } from 'next/server'
import { extractToken, verifyToken } from '@/lib/jwt'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

// GET /api/feedbacks - list feedbacks (auth required, own only)
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = extractToken(authHeader)
    if (!token) {
      return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 })
    }
    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ success: false, error: '登录已过期' }, { status: 401 })
    }

    const feedbacks = await prisma.feedback.findMany({
      where: { userId: payload.userId },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      success: true,
      feedbacks: feedbacks.map((f) => ({ ...f, createdAt: f.createdAt.toISOString() })),
    })
  } catch (error) {
    console.error('[feedbacks GET] Error:', error)
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 })
  }
}

// POST /api/feedbacks - submit feedback (auth required)
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = extractToken(authHeader)
    if (!token) {
      return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 })
    }
    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ success: false, error: '登录已过期' }, { status: 401 })
    }

    const body = await request.json()
    const { type, content } = body

    const validTypes = ['suggestion', 'complaint', 'praise', 'other']
    if (!validTypes.includes(type)) {
      return NextResponse.json({ success: false, error: '反馈类型无效' }, { status: 400 })
    }
    if (!content?.trim()) {
      return NextResponse.json({ success: false, error: '反馈内容不能为空' }, { status: 400 })
    }

    const feedback = await prisma.feedback.create({
      data: {
        userId: payload.userId,
        type,
        content: content.trim().slice(0, 2000),
        status: 'pending',
      },
    })

    // 埋点 audit_log（2026-07-09 清禾）
    try {
      const typeLabel = ({ suggestion: '功能建议', complaint: '投诉', praise: '表扬', other: '其他' } as Record<string, string>)[type as string] || type
      await prisma.$executeRaw`
        INSERT INTO AuditLog (id, actorType, actorId, action, target, description, createdAt)
        VALUES (${`al_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`}, 'customer', ${payload.userId}, 'feedback', ${feedback.id}, ${`新反馈（${typeLabel}）：${content.trim().slice(0, 50)}`}, CURRENT_TIMESTAMP)
      `
    } catch (e) {
      console.warn('[audit] feedback log failed:', (e as any).message)
    }

    return NextResponse.json({
      success: true,
      feedback: { ...feedback, createdAt: feedback.createdAt.toISOString() },
    })
  } catch (error) {
    console.error('[feedbacks POST] Error:', error)
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 })
  }
}