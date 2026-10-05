import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { prisma } from '@/lib/db'
import { ADMIN_MERCHANT_ID } from '@/lib/admin-merchant'
import { verifyAdminRequest, unauthorized } from '@/lib/admin-jwt-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * 奕霖 2026-08-01 23:21 — 单图自动识别商品
 * 直接调 minimax HTTP API（绕开 mmx CLI shell env 问题）
 * 输入：multipart file → vision 提取名称 → SQL LIKE 匹配 Product.name/shortName
 */

interface MinimaxResponse {
  choices?: Array<{ message?: { content?: string }; finish_reason?: string }>
  base_resp?: { status_code: number; status_msg?: string }
}

async function callMinimaxVision(imageBase64: string, prompt: string): Promise<string> {
  // 直接读 mmx config 文件（不通过 CLI）
  const cfg = JSON.parse(readFileSync('/Users/yilinzhao/.mmx/config.json', 'utf-8'))
  const apiKey = cfg.api_key || cfg.apiKey
  const baseUrl = cfg.base_url || cfg.baseUrl || 'https://api.minimaxi.com'

  const resp = await fetch(`${baseUrl}/v1/text/chatcompletion_v2`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'MiniMax-Text-01',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:image/png;base64,${imageBase64}` } },
        ],
      }],
      max_tokens: 50,
      temperature: 0.05,
    }),
  })

  if (!resp.ok) {
    throw new Error(`minimax API HTTP ${resp.status}: ${(await resp.text()).slice(0, 200)}`)
  }
  const data: MinimaxResponse = await resp.json()
  if (data.base_resp?.status_code && data.base_resp.status_code !== 0) {
    throw new Error(`minimax API: ${data.base_resp.status_msg || 'unknown error'}`)
  }
  return data.choices?.[0]?.message?.content?.trim() || ''
}

export async function POST(request: NextRequest) {
  const auth = verifyAdminRequest(request)
  if (!auth.ok) return unauthorized(auth)

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ success: false, error: '请上传图片' }, { status: 400 })
    }
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ success: false, error: '只支持图片' }, { status: 400 })
    }
    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: '图片不能超过 8MB' }, { status: 400 })
    }

    const buf = Buffer.from(await file.arrayBuffer())
    const imageBase64 = buf.toString('base64')

    // 强 prompt：逼 AI 只输出商品名
    const prompt = '看图。请严格只回答这个商品的【具体名称】（中文药品名/食品名/日用品名等，2-8个字）。如果看不清具体名称，就只回答"无"。不要任何描述、标点、前缀、后缀。'

    let rawAnswer = ''
    try {
      rawAnswer = await callMinimaxVision(imageBase64, prompt)
    } catch (err: any) {
      return NextResponse.json({
        success: false,
        error: `minimax vision 调用失败: ${err.message}`,
        hint: '检查网络 / mmx config',
      }, { status: 500 })
    }

    if (!rawAnswer || rawAnswer === '无' || rawAnswer.length > 20) {
      return NextResponse.json({
        success: true,
        identifiedName: rawAnswer || '（未识别）',
        keyword: '',
        candidates: [],
        isDescriptive: true,
        message: `⚠️ minimax 给出描述性回答"${rawAnswer.slice(0, 50)}"，不是具体商品名`,
      })
    }

    // 提取核心关键词（去掉剂型后缀）
    const keyword = rawAnswer.replace(/[颗粒胶囊片剂口服液注射液水丸散冲溶液糖浆茶饮贴膏板]+$/, '').trim() || rawAnswer

    // SQL 匹配
    const candidates = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id, productCode, name, shortName, spec, price, stock, image, categoryLabel
       FROM Product
       WHERE merchantId = ? AND status = 'active'
         AND (name LIKE ? OR shortName LIKE ? OR name LIKE ? OR shortName LIKE ?)
       ORDER BY
         CASE
           WHEN name = ? THEN 1
           WHEN shortName = ? THEN 2
           WHEN name LIKE ? THEN 3
           WHEN shortName LIKE ? THEN 4
           ELSE 5
         END,
         stock DESC
       LIMIT 8`,
      `%${keyword}%`,
      `%${keyword}%`,
      `%${rawAnswer}%`,
      `%${rawAnswer}%`,
      rawAnswer,
      rawAnswer,
      `${keyword}%`,
      `${keyword}%`,
    )

    const scored = candidates.map(c => {
      let score = 0
      if (c.name === rawAnswer || c.shortName === rawAnswer) score = 100
      else if (c.name?.includes(rawAnswer) || c.shortName?.includes(rawAnswer)) score = 90
      else if (c.name?.includes(keyword) || c.shortName?.includes(keyword)) score = 70
      return { ...c, matchScore: score }
    })

    // 埋点
    await prisma.$executeRawUnsafe(
      `INSERT INTO AuditLog (id, actorType, actorId, action, target, description, createdAt)
       VALUES (?, 'admin', null, 'identify_by_image', ?, ?, CURRENT_TIMESTAMP)`,
      `al_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      file.name,
      `minimax vision 识别"${rawAnswer}", 找到 ${scored.length} 个候选`,
    )

    return NextResponse.json({
      success: true,
      identifiedName: rawAnswer,
      keyword,
      candidates: scored,
      totalCandidates: scored.length,
      message: scored.length > 0
        ? `✅ 识别为「${rawAnswer}」, 找到 ${scored.length} 个候选`
        : `⚠️ 识别为「${rawAnswer}」, 库里没匹配商品`,
    })
  } catch (error: any) {
    console.error('[identify-by-image]', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
