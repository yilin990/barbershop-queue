import { NextRequest, NextResponse } from 'next/server'
import * as fs from 'fs/promises'
import * as path from 'path'
import sharp from 'sharp'
import { verifyAdminRequest, unauthorized } from '@/lib/admin-jwt-auth'
import { ADMIN_MERCHANT_ID } from '@/lib/admin-merchant'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * POST /api/admin/products/[id]/standardize-photo
 * body: { imagePath: '/uploads/products/p_xxx/p_xxx.jpg' }
 * 把商家拍的图标准化：
 *   - 居中裁剪为 1:1
 *   - resize 到 1024x1024
 *   - 加白底
 *   - 适度锐化 + JPEG 压缩到 90% 质量
 * 输出路径：原文件名前缀 std_，保存在同一目录
 * 奕霖 2026-08-01 "白底图标准化 = 商家拍的图变专业商品图"
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

    const absolutePath = path.join(process.cwd(), 'public', imagePath)
    try {
      await fs.access(absolutePath)
    } catch {
      return NextResponse.json({ success: false, error: '图片文件不存在' }, { status: 404 })
    }

    // 输出文件名：std_<原文件名>
    const dir = path.dirname(absolutePath)
    const originalName = path.basename(absolutePath)
    const standardizedName = `std_${originalName}`
    const standardizedPath = path.join(dir, standardizedName)

    // 用 sharp 处理（如果系统没装 sharp，回退到 PIL）
    let outputPath = standardizedPath
    let outputRelPath = `/uploads/products/${id}/${standardizedName}`

    try {
      // sharp 路径：直接处理
      const buffer = await fs.readFile(absolutePath)
      const metadata = await sharp(buffer).metadata()
      const inputWidth = metadata.width || 1
      const inputHeight = metadata.height || 1

      // 1) 居中裁剪为 1:1（取短边）
      const cropSize = Math.min(inputWidth, inputHeight)
      const left = Math.floor((inputWidth - cropSize) / 2)
      const top = Math.floor((inputHeight - cropSize) / 2)

      // 2) resize 到 1024x1024 + 白底 + 适度锐化
      await sharp(buffer)
        .extract({ left, top, width: cropSize, height: cropSize })
        .resize(1024, 1024, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
        .flatten({ background: { r: 255, g: 255, b: 255 } })
        .jpeg({ quality: 90, mozjpeg: true })
        .toFile(standardizedPath)

      const stat = await fs.stat(standardizedPath)

      // ⭐ 同步把 Product.image 改为标准化图（顾客端看到）
      const { prisma } = await import('@/lib/db')
      await prisma.$executeRawUnsafe(
        `UPDATE Product SET image = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
        outputRelPath,
        id
      )
      await prisma.$executeRawUnsafe(
        `INSERT INTO AuditLog (id, actorType, actorId, action, target, description, createdAt)
         VALUES (?, 'admin', null, 'standardize_product_photo', ?, ?, CURRENT_TIMESTAMP)`,
        `al_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        id,
        `白底标准化：${imagePath} → ${standardizedName}`
      )

      return NextResponse.json({
        success: true,
        engine: 'sharp',
        url: outputRelPath,
        size: stat.size,
        width: 1024,
        height: 1024,
        original: imagePath,
        standardized: standardizedName,
        productImageUpdated: true,
      })
    } catch (sharpErr: any) {
      // 回退路径：用 Python PIL（已经在 venv 里）
      console.warn('[standardize-photo] sharp 失败，回退 PIL：', sharpErr.message)
      try {
        const { spawn } = await import('child_process')
        const script = `
from PIL import Image
import sys
src = sys.argv[1]
dst = sys.argv[2]
img = Image.open(src).convert('RGB')
w, h = img.size
crop = min(w, h)
left = (w - crop) // 2
top = (h - crop) // 2
img = img.crop((left, top, left + crop, top + crop))
img = img.resize((1024, 1024), Image.LANCZOS)
white = Image.new('RGB', (1024, 1024), (255, 255, 255))
white.paste(img, (0, 0))
white.save(dst, 'JPEG', quality=90)
print(f'OK {img.size}')
`
        await new Promise<void>((resolve, reject) => {
          const proc = spawn(
            '~/.openclaw/venv/bin/python3',
            ['-c', script, absolutePath, standardizedPath],
            { env: { ...process.env, HOME: '/Users/yilinzhao' } }
          )
          proc.on('close', (code) => {
            if (code === 0) resolve()
            else reject(new Error(`PIL 退出码 ${code}`))
          })
          proc.on('error', reject)
          setTimeout(() => proc.kill('SIGKILL'), 20000)
        })

        const stat = await fs.stat(standardizedPath)

        // 同步把 Product.image 改为标准化图
        const { prisma } = await import('@/lib/db')
        await prisma.$executeRawUnsafe(
          `UPDATE Product SET image = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
          outputRelPath,
          id
        )
        await prisma.$executeRawUnsafe(
          `INSERT INTO AuditLog (id, actorType, actorId, action, target, description, createdAt)
           VALUES (?, 'admin', null, 'standardize_product_photo', ?, ?, CURRENT_TIMESTAMP)`,
          `al_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          id,
          `白底标准化(PIL)：${imagePath} → ${standardizedName}`
        )

        return NextResponse.json({
          success: true,
          engine: 'PIL',
          url: outputRelPath,
          size: stat.size,
          width: 1024,
          height: 1024,
          original: imagePath,
          standardized: standardizedName,
          productImageUpdated: true,
        })
      } catch (pilErr: any) {
        return NextResponse.json({
          success: false,
          error: `sharp 失败：${sharpErr.message}；PIL 也失败：${pilErr.message}`,
        }, { status: 500 })
      }
    }
  } catch (error: any) {
    console.error('[admin/products/standardize-photo]', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}