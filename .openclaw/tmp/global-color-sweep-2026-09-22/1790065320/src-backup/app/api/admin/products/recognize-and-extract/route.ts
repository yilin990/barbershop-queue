import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { readFileSync } from "fs"
import { mkdir, writeFile, unlink } from "fs/promises"
import { existsSync } from 'fs'
import * as path from 'path'
import { prisma } from '@/lib/db'
import { ADMIN_MERCHANT_ID } from '@/lib/admin-merchant'
import { verifyAdminRequest, unauthorized } from '@/lib/admin-jwt-auth'

const execAsync = promisify(exec)

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// 10 张图串行：minimax 2.36s × 10 = 23.6s + 白底 0.2s × 10 = 2s ≈ 26s
// 并发=5：识别 4.7s + 白底 0.4s ≈ 5s  （提升 5x）
// 单张大图（base64 上传）：识别 2-3s + 白底 0.2s ≈ 3s
export const maxDuration = 120

/**
 * 奕霖 2026-08-02 01:49 拍板：
 *   ① 合并识别 + 白底 + 匹配为一条 API（用户体验：从"传图→识别→选商品→点白底"变成"传图→完成"）
 *   ② 并发处理多张图（10 张串行 26s → 并发 5 张 ~5s）
 *   ③ 跳过 LLaVA 本地（minimax 云端已买，用满配额）
 *
 * 输入：multipart 'files' (1+ 张图)
 * 输出：[{identifiedName, productId, productName, whiteBgUrl, backup, inputSize, outputSize, width, height, durationMs, success, error}]
 */

interface MinimaxResponse {
  choices?: Array<{ message?: { content?: string } }>
  base_resp?: { status_code: number; status_msg?: string }
}

async function callMinimaxVision(imageBase64: string): Promise<string> {
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
          {
            type: 'text',
            text: '看图。请严格只回答这个商品的【具体名称】（中文药品名/食品名/日用品名等，2-8个字）。如果看不清具体名称，就只回答"无"。不要任何描述、标点、前缀、后缀。',
          },
          { type: 'image_url', image_url: { url: `data:image/png;base64,${imageBase64}` } },
        ],
      }],
      max_tokens: 50,
      temperature: 0.05,
    }),
  })

  if (!resp.ok) throw new Error(`minimax HTTP ${resp.status}`)
  const data: MinimaxResponse = await resp.json()
  if (data.base_resp?.status_code && data.base_resp.status_code !== 0) {
    throw new Error(data.base_resp.status_msg || 'minimax 错误')
  }
  return data.choices?.[0]?.message?.content?.trim() || ''
}

async function extractWhiteBg(inputPath: string, outputPath: string): Promise<{ width: number; height: number; inputSize: number; outputSize: number }> {
  const pyBin = path.join(process.env.HOME || '/Users/yilinzhao', '.openclaw/venv/bin/python3')
  const { stdout } = await execAsync(
    `${pyBin} /tmp/qinghe_extract_bg.py "${inputPath}" "${outputPath}"`,
    { timeout: 60_000, maxBuffer: 5 * 1024 * 1024 }
  )
  const result = JSON.parse(stdout)
  if (!result.ok) throw new Error(result.error || 'rembg 失败')
  return {
    width: result.width,
    height: result.height,
    inputSize: result.input_size,
    outputSize: result.output_size,
  }
}

/**
 * 处理单张图：识别 → 匹配 → 白底 → 写库
 */
async function processOne(
  file: File,
  tmpDir: string,
  index: number
): Promise<{
  success: boolean
  fileName: string
  identifiedName?: string
  keyword?: string
  productId?: string
  productName?: string
  whiteBgUrl?: string
  backup?: string
  width?: number
  height?: number
  inputSize?: number
  outputSize?: number
  durationMs: number
  error?: string
  candidates?: any[]
}> {
  const t0 = Date.now()

  // 1. 临时保存
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const safeExt = ['png', 'jpg', 'jpeg', 'webp', 'heic'].includes(ext) ? ext : 'jpg'
  const tmpInput = path.join(tmpDir, `in_${index}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${safeExt}`)
  const buf = Buffer.from(await file.arrayBuffer())
  await writeFile(tmpInput, buf)

  try {
    // 2. minimax 视觉识别
    const imageBase64 = buf.toString('base64')
    let identifiedName = ''
    try {
      identifiedName = await callMinimaxVision(imageBase64)
    } catch (err: any) {
      return {
        success: false,
        fileName: file.name,
        durationMs: Date.now() - t0,
        error: `minimax 识别失败：${err.message}`,
      }
    }

    // 3. 拿不准就答"无"，不算失败，但没匹配也不能写库
    if (!identifiedName || identifiedName === '无' || identifiedName.length > 20) {
      return {
        success: false,
        fileName: file.name,
        identifiedName,
        durationMs: Date.now() - t0,
        error: `AI 未能识别商品名（"${identifiedName.slice(0, 30)}"）`,
      }
    }

    // 4. SQL 关键词匹配
    const keyword = identifiedName.replace(/[颗粒胶囊片剂口服液注射液水丸散冲溶液糖浆茶饮贴膏板]+$/, '').trim() || identifiedName
    const candidates = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id, productCode, name, shortName, image
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
       LIMIT 3`,
      `%${keyword}%`,
      `%${keyword}%`,
      `%${identifiedName}%`,
      `%${identifiedName}%`,
      identifiedName,
      identifiedName,
      `${keyword}%`,
      `${keyword}%`,
    )

    if (candidates.length === 0) {
      return {
        success: false,
        fileName: file.name,
        identifiedName,
        keyword,
        candidates: [],
        durationMs: Date.now() - t0,
        error: `AI 识别为"${identifiedName}"，库内无匹配商品`,
      }
    }

    const product = candidates[0]
    const productId = product.id as string

    // 5. 白底提炼
    const wbExt = 'png'
    const wbFilename = `wb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${wbExt}`
    const wbDir = path.join(process.cwd(), 'public', 'uploads', 'products', productId)
    if (!existsSync(wbDir)) await mkdir(wbDir, { recursive: true })
    const wbRelative = `/uploads/products/${productId}/${wbFilename}`
    const wbAbsolute = path.join(wbDir, wbFilename)

    let whiteResult: { width: number; height: number; inputSize: number; outputSize: number }
    try {
      whiteResult = await extractWhiteBg(tmpInput, wbAbsolute)
    } catch (err: any) {
      return {
        success: false,
        fileName: file.name,
        identifiedName,
        keyword,
        productId,
        productName: product.name,
        durationMs: Date.now() - t0,
        error: `白底提炼失败：${err.message}`,
      }
    }

    // 6. 备份原图 + 写库
    const backupRel = `/uploads/products/${productId}/orig_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${safeExt}`
    const backupAbs = path.join(wbDir, path.basename(backupRel))
    try {
      // 备份的是原图（tmpInput），不是白底图
      const { copyFile } = await import('fs/promises')
      await copyFile(tmpInput, backupAbs)
    } catch {}

    await prisma.$executeRawUnsafe(
      `UPDATE Product SET image = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
      wbRelative,
      productId
    )

    // 7. 埋点
    await prisma.$executeRawUnsafe(
      `INSERT INTO AuditLog (id, actorType, actorId, action, target, description, createdAt)
       VALUES (?, 'admin', null, 'recognize_and_extract', ?, ?, CURRENT_TIMESTAMP)`,
      `al_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      productId,
      `识别"${identifiedName}" → 匹配"${product.name}" → 白底 ${whiteResult.width}×${whiteResult.height}`,
    )

    return {
      success: true,
      fileName: file.name,
      identifiedName,
      keyword,
      productId,
      productName: product.name,
      whiteBgUrl: wbRelative,
      backup: backupRel,
      width: whiteResult.width,
      height: whiteResult.height,
      inputSize: whiteResult.inputSize,
      outputSize: whiteResult.outputSize,
      candidates: candidates.map((c) => ({ id: c.id, name: c.name, shortName: c.shortName })),
      durationMs: Date.now() - t0,
    }
  } catch (err: any) {
    return {
      success: false,
      fileName: file.name,
      durationMs: Date.now() - t0,
      error: `未知错误：${err.message}`,
    }
  } finally {
    // 清理临时输入文件
    try { await unlink(tmpInput) } catch {}
  }
}

export async function POST(request: NextRequest) {
  const auth = verifyAdminRequest(request)
  if (!auth.ok) return unauthorized(auth)

  try {
    const formData = await request.formData()
    const files = formData.getAll('files').filter((f): f is File => f instanceof File)

    if (files.length === 0) {
      return NextResponse.json({ success: false, error: '请至少上传 1 张图（files: File[]）' }, { status: 400 })
    }

    // 校验单张大小
    for (const f of files) {
      if (f.size > 8 * 1024 * 1024) {
        return NextResponse.json({ success: false, error: `图 ${f.name} 超过 8MB` }, { status: 400 })
      }
      if (!f.type.startsWith('image/')) {
        return NextResponse.json({ success: false, error: `${f.name} 不是图片` }, { status: 400 })
      }
    }

    const tmpDir = '/tmp/qinghe_recog_extract'
    await mkdir(tmpDir, { recursive: true })

    // 并发处理（concurrency=5，minimax 限速安全值）
    const t0 = Date.now()
    const CONCURRENCY = 5
    const results: any[] = []
    for (let i = 0; i < files.length; i += CONCURRENCY) {
      const batch = files.slice(i, i + CONCURRENCY)
      const batchResults = await Promise.allSettled(
        batch.map((f, idx) => processOne(f, tmpDir, i + idx))
      )
      for (const r of batchResults) {
        results.push(r.status === 'fulfilled' ? r.value : {
          success: false,
          error: String((r as any).reason),
          durationMs: 0,
        })
      }
    }

    const totalMs = Date.now() - t0
    const successCount = results.filter((r) => r.success).length
    const failCount = results.length - successCount

    return NextResponse.json({
      success: true,
      totalCount: results.length,
      successCount,
      failCount,
      totalDurationMs: totalMs,
      avgDurationMs: Math.round(totalMs / results.length),
      concurrency: CONCURRENCY,
      results,
      message: failCount === 0
        ? `✅ 全部 ${results.length} 张识别+白底+匹配完成（${(totalMs/1000).toFixed(1)}s）`
        : `⚠️ ${successCount} 成功 / ${failCount} 失败（${(totalMs/1000).toFixed(1)}s）`,
    })
  } catch (error: any) {
    console.error('[recognize-and-extract]', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
