import { NextRequest, NextResponse } from 'next/server'
import * as fs from 'fs/promises'
import * as path from 'path'
import { prisma } from '@/lib/db'
import { ADMIN_MERCHANT_ID } from '@/lib/admin-merchant'
import { verifyAdminRequest, unauthorized } from '@/lib/admin-jwt-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 90

/**
 * POST /api/admin/products/shelf-scan
 * form-data: file (image) - 一张照片（货架/陈列柜）
 * 返回 { items: [{ name, spec, manufacturer, category_hint, position, confidence }] }
 * 然后商家可以批量确认：新增/更新/跳过
 * 奕霖 2026-08-01 16:47 "能不能智能识别图片里的药品包装"
 */
export async function POST(request: NextRequest) {
  try {
    const auth = verifyAdminRequest(request)
    if (!auth.ok) return unauthorized(auth)

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ success: false, error: '请选择图片' }, { status: 400 })
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ success: false, error: '只支持图片文件' }, { status: 400 })
    }
    if (file.size > 12 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: '图片不能超过 12MB' }, { status: 400 })
    }

    // 保存到临时路径（不用永久存）
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const safeExt = ['png', 'jpg', 'jpeg', 'webp', 'heic'].includes(ext) ? ext : 'jpg'
    const filename = `shelf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${safeExt}`
    const tmpDir = path.join(process.cwd(), '.next', 'tmp-shelf')
    await fs.mkdir(tmpDir, { recursive: true })
    const absolutePath = path.join(tmpDir, filename)
    const buf = Buffer.from(await file.arrayBuffer())
    await fs.writeFile(absolutePath, buf)

    // 调 minimax vision 识别多个商品
    const prompt = `你是一个药品识别助手。请仔细扫描这张图片（货架/陈列柜/平铺图），识别图中所有的药品、保健品、医疗器械、消毒用品包装。

请按以下严格的 JSON 格式返回（不要 Markdown 代码块包裹，不要任何注释）：
{
  "items": [
    {
      "name": "药品名称（如'氨咖黄敏胶囊'，识别不准就根据可见文字推测）",
      "spec": "规格（如'12粒/盒'，看不到就写 null）",
      "manufacturer": "生产厂家（如'华润三九'，看不到就写 null）",
      "category_hint": "剂型分类（胶囊/片剂/颗粒/糖浆/膏药/喷剂/中药丸/注射剂/滴眼液/软膏/贴剂/保健食品/消毒用品/医疗器械/其他）",
      "position": "在图中的大致位置（如'左上角第1个'/'中间排右起第2'/'底部右1/3处'）",
      "confidence": 0.0 到 1.0 的数字
    }
  ],
  "summary": "识别总结（如'共识别到5件药品，其中4件为OTC，1件为保健品'）"
}

注意：
1. 只输出你能清晰看到的，不要编造
2. 看不清的字段就写 null
3. 不要重复同一件商品（如果同款药出现多盒，合并为一项，confidence 提高）
4. 如果图片模糊或没有药品，返回 { "items": [], "summary": "未识别到药品包装，请重新拍摄" }
5. 位置描述要简洁，便于人工核对`

    const { spawn } = await import('child_process')
    const mmxResult = await new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
      const proc = spawn(
        'mmx',
        ['vision', 'describe', '--image', absolutePath, '--prompt', prompt],
        { env: { ...process.env, HOME: '/Users/yilinzhao' } }
      )
      let stdout = ''
      let stderr = ''
      proc.stdout.on('data', (d) => { stdout += d.toString() })
      proc.stderr.on('data', (d) => { stderr += d.toString() })
      proc.on('close', (code) => resolve({ code: code ?? 0, stdout, stderr }))
      setTimeout(() => proc.kill('SIGKILL'), 60000)
    })

    // 清理临时文件
    fs.unlink(absolutePath).catch(() => {})

    if (mmxResult.code !== 0) {
      return NextResponse.json({
        success: false,
        error: `minimax vision 调用失败（exit ${mmxResult.code}）：${mmxResult.stderr.slice(0, 200)}`,
      }, { status: 502 })
    }

    let parsed: any
    try {
      parsed = JSON.parse(mmxResult.stdout)
    } catch {
      return NextResponse.json({
        success: false,
        error: 'minimax 返回非 JSON：' + mmxResult.stdout.slice(0, 200),
      }, { status: 502 })
    }

    const content: string = parsed.content || ''
    let info: any = null

    // 模式 1：直接 JSON
    try { info = JSON.parse(content) } catch {}
    // 模式 2：```json ... ```
    if (!info) {
      const m = content.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (m) try { info = JSON.parse(m[1].trim()) } catch {}
    }
    // 模式 3：花括号
    if (!info) {
      const m = content.match(/\{[\s\S]*\}/)
      if (m) try { info = JSON.parse(m[0]) } catch {}
    }

    if (!info || !Array.isArray(info.items)) {
      return NextResponse.json({
        success: false,
        error: 'minimax vision 返回内容无法解析',
        raw: content.slice(0, 500),
      }, { status: 502 })
    }

    // 对每个识别项查数据库，看是否已存在
    const enriched = await Promise.all(
      info.items.map(async (item: any) => {
        let existingProduct: any = null
        if (item.name && typeof item.name === 'string') {
          // 模糊匹配：name + (spec OR manufacturer)
          const nameMatch = String(item.name).trim()
          if (nameMatch.length >= 2) {
            const rows: any[] = await prisma.$queryRawUnsafe(
              `SELECT id, name, shortName, price, stock, manufacturer, image FROM Product
               WHERE status='active' AND (name LIKE ? OR shortName LIKE ?) AND Product.merchantId = ${ADMIN_MERCHANT_ID} LIMIT 3`,
              `%${nameMatch.slice(0, 12)}%`,
              `%${nameMatch.slice(0, 12)}%`
            )
            if (rows.length) existingProduct = rows[0]
          }
        }
        return {
          name: item.name || null,
          spec: item.spec || null,
          manufacturer: item.manufacturer || null,
          categoryHint: item.category_hint || null,
          position: item.position || null,
          confidence: Number(item.confidence ?? 0),
          existingProductId: existingProduct?.id || null,
          existingProductName: existingProduct?.name || null,
          existingImage: existingProduct?.image || null,
        }
      })
    )

    return NextResponse.json({
      success: true,
      items: enriched,
      summary: info.summary || `共识别到 ${enriched.length} 件商品`,
    })
  } catch (error: any) {
    console.error('[admin/products/shelf-scan]', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}