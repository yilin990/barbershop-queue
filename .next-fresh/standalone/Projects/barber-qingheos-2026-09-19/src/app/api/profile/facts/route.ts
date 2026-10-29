/**
 * /api/profile/facts — 用户长期记忆事实 CRUD（2026-08-02 清禾 P0）
 *
 * POST: 让 AI 或用户主动记录一条记忆
 *   body: { phone: string, fact: string, category?, confidence?, source?, expiresAt?, userId? }
 *
 * GET: 拉取某用户的活跃记忆
 *   query: ?phone=xxx&userId=yyy（userId 可选）
 *
 * DELETE: 软删除一条记忆
 *   query: ?id=xxx
 */

import { NextResponse } from 'next/server'
import {
  saveMemoryFact,
  getMemoryFacts,
  deleteMemoryFact,
  type FactCategory,
} from '@/lib/user-memory'

const VALID_CATEGORIES: FactCategory[] = ['health', 'family', 'preference', 'history', 'other']

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { phone, userId, fact, category, confidence, source, expiresAt } = body || {}

    if (!phone || typeof phone !== 'string') {
      return NextResponse.json(
        { success: false, error: 'phone 必填' },
        { status: 400 }
      )
    }
    if (!fact || typeof fact !== 'string' || fact.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'fact 必填且不能为空' },
        { status: 400 }
      )
    }

    let cat: FactCategory = 'other'
    if (category && VALID_CATEGORIES.includes(category)) {
      cat = category
    }

    const id = await saveMemoryFact({
      phone,
      userId,
      fact: fact.trim(),
      category: cat,
      confidence: typeof confidence === 'number' ? Math.max(0, Math.min(1, confidence)) : 0.8,
      source: source || 'manual',
      expiresAt,
    })

    return NextResponse.json({
      success: true,
      id,
      message: '记忆已保存，下次对话 AI 会记得',
    })
  } catch (err: any) {
    console.error('[profile/facts POST] error:', err?.message || err)
    return NextResponse.json(
      { success: false, error: err?.message || '保存失败' },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const phone = searchParams.get('phone')
    const userId = searchParams.get('userId') || undefined

    if (!phone) {
      return NextResponse.json(
        { success: false, error: 'phone 必填' },
        { status: 400 }
      )
    }

    const facts = await getMemoryFacts(phone, userId)
    return NextResponse.json({
      success: true,
      count: facts.length,
      facts,
    })
  } catch (err: any) {
    console.error('[profile/facts GET] error:', err?.message || err)
    return NextResponse.json(
      { success: false, error: err?.message || '查询失败' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'id 必填' },
        { status: 400 }
      )
    }
    const ok = await deleteMemoryFact(id)
    return NextResponse.json({
      success: ok,
      message: ok ? '记忆已删除' : '记忆不存在或已删除',
    })
  } catch (err: any) {
    console.error('[profile/facts DELETE] error:', err?.message || err)
    return NextResponse.json(
      { success: false, error: err?.message || '删除失败' },
      { status: 500 }
    )
  }
}