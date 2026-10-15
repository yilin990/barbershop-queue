import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import * as fs from 'fs/promises'
import * as path from 'path'
import { verifyAdminRequest, unauthorized } from '@/lib/admin-jwt-auth'
import { ADMIN_MERCHANT_ID } from '@/lib/admin-merchant'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/products/[id]/upload-photo
 * form-data: file (image) - 商家手机拍照或相册选图
 * 流程：保存图片到 public/uploads/products/{id}/ + 写入 Product.image 字段
 * 奕霖 2026-08-01 "开始干吧" — "商家自己拍 = 数据归商家 = 去美团化的核心"
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = verifyAdminRequest(request)
    if (!auth.ok) return unauthorized(auth)

    const { id } = await params

    // 确认商品存在
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, name, image FROM Product WHERE id = ? AND merchantId = ?`,
      id, ADMIN_MERCHANT_ID
    )
    if (!rows.length) {
      return NextResponse.json({ success: false, error: '商品不存在' }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ success: false, error: '请选择图片' }, { status: 400 })
    }

    // 验证：必须是图片 + 大小限制 8MB（拍图原图通常 3-5MB）
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ success: false, error: '只支持图片文件' }, { status: 400 })
    }
    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: '图片不能超过 8MB' }, { status: 400 })
    }

    // 保存到 public/uploads/products/{productId}/
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const safeExt = ['png', 'jpg', 'jpeg', 'webp', 'heic'].includes(ext) ? ext : 'jpg'
    const filename = `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${safeExt}`
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'products', id)

    await fs.mkdir(uploadDir, { recursive: true })
    const buf = Buffer.from(await file.arrayBuffer())
    const filepath = path.join(uploadDir, filename)
    await fs.writeFile(filepath, buf)

    // 公共 URL（前端直接引用）
    const url = `/uploads/products/${id}/${filename}`

    // 写库：Product.image = url
    await prisma.$executeRawUnsafe(
      `UPDATE Product SET image = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
      url,
      id
    )

    // 埋点
    await prisma.$executeRawUnsafe(
      `INSERT INTO AuditLog (id, actorType, actorId, action, target, description, createdAt)
       VALUES (?, 'admin', null, 'upload_product_photo', ?, ?, CURRENT_TIMESTAMP)`,
      `al_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      id,
      `上传商品图：${url}（${file.size} bytes）`
    )

    return NextResponse.json({
      success: true,
      url,
      size: file.size,
      type: file.type,
      productName: rows[0].name,
    })
  } catch (error: any) {
    console.error('[admin/products/upload-photo]', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

/**
 * GET /api/admin/products/[id]/upload-photo
 * 返回当前商品的图片 + 历史图片列表（可选）
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = verifyAdminRequest(request)
    if (!auth.ok) return unauthorized(auth)

    const { id } = await params
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, name, image FROM Product WHERE id = ?`,
      id
    )
    if (!rows.length) {
      return NextResponse.json({ success: false, error: '商品不存在' }, { status: 404 })
    }

    // 列历史图片
    const dir = path.join(process.cwd(), 'public', 'uploads', 'products', id)
    let history: string[] = []
    try {
      const files = await fs.readdir(dir)
      history = files
        .filter((f) => /\.(png|jpg|jpeg|webp)$/i.test(f))
        .map((f) => `/uploads/products/${id}/${f}`)
        .sort()
        .reverse()
    } catch {}

    return NextResponse.json({
      success: true,
      product: { id: rows[0].id, name: rows[0].name, image: rows[0].image },
      history,
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
/**
 * DELETE /api/admin/products/[id]/upload-photo?file=<filename>
 * 奕霖 2026-08-02 01:57 反馈"历史记录图片能不能删掉" → 加删除能力
 *
 * 安全检查（5 重）：
 *   1. admin 鉴权
 *   2. file 参数只能传 basename（防路径穿越 ../）
 *   3. 扩展名白名单（png/jpg/jpeg/webp）
 *   4. 文件必须在商品 uploads/{id}/ 目录下
 *   5. 不能删除当前 Product.image（主图保护）
 *
 * 操作流程：
 *   1. 校验 file 参数
 *   2. 查商品 + 当前主图
 *   3. 检查 file ≠ 当前主图
 *   4. 检查文件存在
 *   5. fs.unlink 删文件
 *   6. AuditLog 埋点
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = verifyAdminRequest(request)
  if (!auth.ok) return unauthorized(auth)

  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const fileParam = searchParams.get('file') || ''

    // 安全 1：参数非空
    if (!fileParam) {
      return NextResponse.json({ success: false, error: '缺少 file 参数' }, { status: 400 })
    }

    // 安全 2：basename 校验（防 ../ 路径穿越）
    const basename = path.basename(fileParam)
    if (basename !== fileParam || basename.includes('..') || basename.startsWith('.')) {
      return NextResponse.json({ success: false, error: '非法文件名（含路径分隔符或 ..）' }, { status: 400 })
    }

    // 安全 3：扩展名白名单
    if (!/\.(png|jpg|jpeg|webp)$/i.test(basename)) {
      return NextResponse.json({ success: false, error: '只支持 png/jpg/jpeg/webp' }, { status: 400 })
    }

    // 查商品 + 当前主图
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, name, image FROM Product WHERE id = ?`,
      id
    )
    if (!rows.length) {
      return NextResponse.json({ success: false, error: '商品不存在' }, { status: 404 })
    }
    const product = rows[0]

    // 安全 5：不能删当前 Product.image（主图保护）
    if (product.image && product.image.endsWith('/' + basename)) {
      return NextResponse.json({ success: false, error: '不能删除当前主图（先换主图再删）' }, { status: 400 })
    }

    // 安全 4：路径校验（必须在商品目录下）
    const productDir = path.join(process.cwd(), 'public', 'uploads', 'products', id)
    const resolvedDir = path.resolve(productDir)
    const targetPath = path.resolve(path.join(productDir, basename))
    if (!targetPath.startsWith(resolvedDir + path.sep)) {
      return NextResponse.json({ success: false, error: '路径校验失败（不在商品目录下）' }, { status: 400 })
    }

    // 检查文件存在
    try {
      await fs.access(targetPath)
    } catch {
      return NextResponse.json({ success: false, error: '文件不存在' }, { status: 404 })
    }

    // 删文件
    await fs.unlink(targetPath)

    // 埋点
    await prisma.$executeRawUnsafe(
      `INSERT INTO AuditLog (id, actorType, actorId, action, target, description, createdAt)
       VALUES (?, 'admin', null, 'delete_history_image', ?, ?, CURRENT_TIMESTAMP)`,
      `al_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      id,
      `删除历史图：${basename}`
    )

    return NextResponse.json({
      success: true,
      deleted: basename,
      message: `✅ 已删除 ${basename}`,
    })
  } catch (error: any) {
    console.error('[admin/products/upload-photo DELETE]', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
