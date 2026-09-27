import { NextRequest, NextResponse } from 'next/server'
import * as fs from 'fs/promises'
import * as path from 'path'
import { verifyAdminRequest, unauthorized } from '@/lib/admin-jwt-auth'
import { ADMIN_MERCHANT_ID } from '@/lib/admin-merchant'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST /api/admin/products/[id]/identify-photo
 * body: { imagePath: '/uploads/products/p_xxx/p_xxx.jpg' }
 * 调 minimax vision 识别药盒 → 解析 JSON 返回
 * 奕霖 2026-08-01 16:01 "你规划去完成吧" — 自动化减少商家打字
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = verifyAdminRequest(request)
    if (!auth.ok) return unauthorized(auth)

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const imagePath = body.imagePath as string | undefined

    if (!imagePath) {
      return NextResponse.json({ success: false, error: 'imagePath 不能为空' }, { status: 400 })
    }
    if (!imagePath.startsWith('/uploads/')) {
      return NextResponse.json({ success: false, error: 'imagePath 必须以 /uploads/ 开头' }, { status: 400 })
    }

    // 物理路径校验
    const absolutePath = path.join(process.cwd(), 'public', imagePath)
    try {
      await fs.access(absolutePath)
    } catch {
      return NextResponse.json({ success: false, error: '图片文件不存在' }, { status: 404 })
    }

    // 调用 minimax vision 识别
    const prompt = `请识别这张图片是否为药品（或保健品/医疗器械/消毒用品）的包装盒/瓶身/铝箔板。

如果是，请提取以下信息，并以严格的 JSON 格式返回（不要包含 Markdown 代码块标记）：
{
  "is_drug": true,
  "name": "药品名称（如'氨咖黄敏胶囊'）",
  "spec": "规格（如'0.3g*24粒/盒'）",
  "manufacturer": "生产厂家全称",
  "approval_no": "国药准字批准文号（如'H52020241'，没有则返回 null）",
  "batch_no": "生产批号（如'20240301'，没有则返回 null）",
  "expiry": "有效期（如'2026-12'，没有则返回 null）",
  "category_hint": "剂型分类（如'胶囊/片剂/颗粒/糖浆/膏药/喷剂/中药丸/注射剂/滴眼液/软膏/贴剂/保健食品/消毒用品/医疗器械/其他'）",
  "confidence": 0.0 到 1.0 的数字（识别准确度）
}

如果不是药品包装（是其他物品、模糊、看不清），请返回：
{
  "is_drug": false,
  "reason": "为什么不是药品包装（一句话）",
  "confidence": 0.0 到 1.0
}

注意：
1. 不要编造，看不到的字段就填 null
2. 厂家名要保留'股份有限公司/有限责任公司/制药厂'等后缀
3. 批准文号只看国药准字/卫消证字/械注准这些
4. JSON 中不要任何注释、不要 Markdown 包裹`

    // 子进程调 minimax CLI
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
      setTimeout(() => proc.kill('SIGKILL'), 30000) // 30s 超时
    })

    if (mmxResult.code !== 0) {
      return NextResponse.json({
        success: false,
        error: `minimax vision 调用失败（exit ${mmxResult.code}）：${mmxResult.stderr.slice(0, 200)}`,
      }, { status: 502 })
    }

    // 解析 minimax 返回（stdout 是 JSON {content: "...", base_resp: {...}}）
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

    // 尝试从 content 中提取 JSON 块
    let info: any = null
    // 模式 1：直接就是 JSON
    try {
      info = JSON.parse(content)
    } catch {
      // 模式 2：```json ... ``` 代码块
      const m = content.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (m) {
        try {
          info = JSON.parse(m[1].trim())
        } catch {}
      }
      // 模式 3：花括号 {...}
      if (!info) {
        const m2 = content.match(/\{[\s\S]*\}/)
        if (m2) {
          try {
            info = JSON.parse(m2[0])
          } catch {}
        }
      }
    }

    if (!info) {
      return NextResponse.json({
        success: false,
        error: 'minimax vision 返回内容无法解析为 JSON',
        raw: content.slice(0, 500),
      }, { status: 502 })
    }

    // 标准化字段
    const result = {
      isDrug: Boolean(info.is_drug ?? info.isDrug),
      name: info.name || null,
      spec: info.spec || null,
      manufacturer: info.manufacturer || null,
      approvalNo: info.approval_no || null,
      batchNo: info.batch_no || null,
      expiry: info.expiry || null,
      categoryHint: info.category_hint || null,
      confidence: Number(info.confidence ?? 0),
      reason: info.reason || null,
    }

    return NextResponse.json({ success: true, info: result })
  } catch (error: any) {
    console.error('[admin/products/identify-photo]', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}