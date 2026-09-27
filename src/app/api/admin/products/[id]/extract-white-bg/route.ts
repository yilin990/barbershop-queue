import { NextRequest, NextResponse } from 'next/server'
import * as fs from 'fs/promises'
import * as path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import { prisma } from '@/lib/db'
import { verifyAdminRequest, unauthorized } from '@/lib/admin-jwt-auth'
import { ADMIN_MERCHANT_ID } from '@/lib/admin-merchant'

const execAsync = promisify(exec)

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60  // rembg 处理大图可能需要 30s+

/**
 * 奕霖 2026-08-01 23:21 — 商品图白底提炼
 * 调用本地 rembg u2netp 模型（自托管，符合"去平台化"原则）
 * 输入：当前 Product.image 路径 → 输出：白底 PNG → 更新 Product.image
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = verifyAdminRequest(request)
  if (!auth.ok) return unauthorized(auth)

  const { id } = await params
  try {
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, name, image FROM Product WHERE id = ? AND merchantId = ?`,
      id, ADMIN_MERCHANT_ID
    )
    if (!rows.length) {
      return NextResponse.json({ success: false, error: '商品不存在' }, { status: 404 })
    }
    const product = rows[0]
    if (!product.image || !product.image.startsWith('/uploads/')) {
      return NextResponse.json({ success: false, error: '该商品暂无图片，先上传一张' }, { status: 400 })
    }

    const inputPath = path.join(process.cwd(), 'public', product.image)
    const filename = `bg_white_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.png`
    const outputRel = `/uploads/products/${id}/${filename}`
    const outputPath = path.join(process.cwd(), 'public', outputRel)

    // 调 Python 跑 rembg
    const pyBin = path.join(process.env.HOME || '/Users/yilinzhao', '.openclaw/venv/bin/python3')
    const { stdout } = await execAsync(`${pyBin} /tmp/qinghe_extract_bg.py "${inputPath}" "${outputPath}"`, {
      timeout: 60_000,
      maxBuffer: 5 * 1024 * 1024,
    })
    const result = JSON.parse(stdout)
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error || '去背景失败' }, { status: 500 })
    }

    // 备份原图（用户偏好可回退）
    const backupRel = product.image.replace(/(\.[^.]+)$/, '_orig$1')
    try {
      const origPath = path.join(process.cwd(), 'public', product.image)
      await fs.copyFile(origPath, path.join(process.cwd(), 'public', backupRel))
    } catch {}

    // 写库：白底图为当前图
    await prisma.$executeRawUnsafe(
      `UPDATE Product SET image = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
      outputRel,
      id
    )

    // 埋点
    await prisma.$executeRawUnsafe(
      `INSERT INTO AuditLog (id, actorType, actorId, action, target, description, createdAt)
       VALUES (?, 'admin', null, 'extract_white_bg', ?, ?, CURRENT_TIMESTAMP)`,
      `al_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      id,
      `白底提炼：${outputRel}（${result.input_size}B → ${result.output_size}B）`
    )

    return NextResponse.json({
      success: true,
      url: outputRel,
      backup: product.image,
      productName: product.name,
      inputSize: result.input_size,
      outputSize: result.output_size,
      width: result.width,
      height: result.height,
      message: `✅ ${product.name} 白底图已生成（${result.width}×${result.height}）`,
    })
  } catch (error: any) {
    console.error('[extract-white-bg]', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
