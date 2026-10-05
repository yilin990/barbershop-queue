import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { ADMIN_MERCHANT_ID } from '@/lib/admin-merchant'
import * as fs from 'fs/promises'
import * as path from 'path'
import { verifyAdminRequest, unauthorized } from '@/lib/admin-jwt-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/upload-orphan-photo
 * ⭐ 奕霖 2026-08-05 01:13 — 方案 C：AI 识别失败时不上传到商品，改存 /uploads/orphan/ + 写 OrphanPhoto 表
 * form-data: file (image)
 * body: { aiGuess?: string } — AI 识别的猜测名（用于后续手动选商品）
 * 返回: { success, id, url, filePath }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = verifyAdminRequest(request)
    if (!auth.ok) return unauthorized(auth)

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const aiGuess = (formData.get('aiGuess') as string) || null
    // ⭐ 奕霖 2026-08-05 02:00 — 方案 B：扩展字段支持「单商品重拍」场景
    const source = (formData.get('source') as string) || 'photo-batch'  // photo-batch / single-product-retake
    const reason = (formData.get('reason') as string) || null          // 糊了/角度不对/反光/其他
    const originalImageUrl = (formData.get('originalImageUrl') as string) || null  // 被标记的原图 URL
    const productName = (formData.get('productName') as string) || null  // 商品名（人工标记时填）

    if (!file) {
      return NextResponse.json({ success: false, error: '请选择图片' }, { status: 400 })
    }

    // 验证图片
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ success: false, error: '只支持图片文件' }, { status: 400 })
    }
    if (file.size > 12 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: '图片不能超过 12MB' }, { status: 400 })
    }

    // 生成 orphan id（时间戳 + 随机）
    const orphanId = `orphan_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
    const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg'
    const filename = `${orphanId}.${safeExt}`

    // 写盘到 public/uploads/orphan/
    const orphanDir = path.join(process.cwd(), 'public', 'uploads', 'orphan')
    await fs.mkdir(orphanDir, { recursive: true })
    const filePath = path.join(orphanDir, filename)
    const buffer = Buffer.from(await file.arrayBuffer())
    await fs.writeFile(filePath, buffer)

    const url = `/uploads/orphan/${filename}`

    // 写 DB
    // ⭐ 奕霖 2026-08-05 02:00 — INSERT 加 4 字段（source / reason / originalImageUrl / productName）
    await prisma.$executeRawUnsafe(
      `INSERT INTO OrphanPhoto (id, url, filePath, aiGuess, uploadedAt, status, merchantId, source, reason, originalImageUrl, productName)
       VALUES (?, ?, ?, ?, datetime('now'), 'pending', ?, ?, ?, ?)`,
      orphanId, url, url, aiGuess, source, reason, originalImageUrl, productName
    )

    return NextResponse.json({
      success: true,
      id: orphanId,
      url,
      filePath: url,
      aiGuess,
      message: `⚠️ 已保存为孤儿图（AI 未识别出匹配商品）：${filename}`,
    })
  } catch (error: any) {
    console.error('[upload-orphan-photo] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

/**
 * GET /api/admin/upload-orphan-photo
 * ⭐ 奕霖 2026-08-05 01:13 — 列出所有 orphan 图（管理后台查看）
 */
export async function GET(request: NextRequest) {
  try {
    const auth = verifyAdminRequest(request)
    if (!auth.ok) return unauthorized(auth)

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'pending'

    // ⭐ 奕霖 2026-08-05 02:00 — GET 返回新字段 + 支持 source 筛选
    const sourceFilter = searchParams.get('source')  // photo-batch / single-product-retake / null=全部
    let sql = `SELECT id, url, aiGuess, uploadedAt, status, linkedProductId, source, merchantId, reason, originalImageUrl, productName FROM OrphanPhoto WHERE status = ?`
    const params: any[] = [status]
    if (sourceFilter) {
      sql += ` AND source = ?`
      params.push(sourceFilter)
    }
    sql += ` ORDER BY uploadedAt DESC LIMIT 100`
    const photos: any[] = await prisma.$queryRawUnsafe(sql, ...params)

    return NextResponse.json({ success: true, photos })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/upload-orphan-photo?id=xxx
 * 删除孤儿图（数据库记录 + 文件）
 */
export async function DELETE(request: NextRequest) {
  try {
    const auth = verifyAdminRequest(request)
    if (!auth.ok) return unauthorized(auth)

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ success: false, error: '缺少 id' }, { status: 400 })
    }

    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT url FROM OrphanPhoto WHERE id = ?`,
      id
    )
    if (!rows.length) {
      return NextResponse.json({ success: false, error: '孤儿图不存在' }, { status: 404 })
    }

    // 删文件
    const filepath = path.join(process.cwd(), 'public', rows[0].url)
    try { await fs.unlink(filepath) } catch {}

    // 删 DB 记录
    await prisma.$executeRawUnsafe(`DELETE FROM OrphanPhoto WHERE id = ?`, id)

    return NextResponse.json({ success: true, message: '已删除孤儿图' })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

/**
 * PATCH /api/admin/upload-orphan-photo
 * 关联孤儿图到商品（手动选商品）
 * body: { id, productId, makePrimary: boolean }
 */
export async function PATCH(request: NextRequest) {
  try {
    const auth = verifyAdminRequest(request)
    if (!auth.ok) return unauthorized(auth)

    const body = await request.json()
    const { id, productId, makePrimary = true, reason } = body
    // ⭐ 奕霖 2026-08-05 02:00 — PATCH 支持单独更新 reason（标记重拍原因）

    if (!id) {
      return NextResponse.json({ success: false, error: '缺少 id' }, { status: 400 })
    }
    // ⭐ 奕霖 2026-08-05 02:00 — 单商品标记重拍场景：只传 reason + id，不传 productId
    if (!productId && reason !== undefined) {
      await prisma.$executeRawUnsafe(`UPDATE OrphanPhoto SET reason = ? WHERE id = ?`, reason, id)
      return NextResponse.json({ success: true, message: '✅ 已记录重拍原因' })
    }
    if (!productId) {
      return NextResponse.json({ success: false, error: '缺少 productId' }, { status: 400 })
    }

    // 验证孤儿图 + 商品存在
    const orphan: any[] = await prisma.$queryRawUnsafe(`SELECT url FROM OrphanPhoto WHERE id = ?`, id)
    if (!orphan.length) {
      return NextResponse.json({ success: false, error: '孤儿图不存在' }, { status: 404 })
    }
    const products: any[] = await prisma.$queryRawUnsafe(`SELECT id, image FROM Product WHERE id = ? AND merchantId = ?`, productId, ADMIN_MERCHANT_ID)
    if (!products.length) {
      return NextResponse.json({ success: false, error: '商品不存在' }, { status: 404 })
    }

    // 更新商品主图（如果 makePrimary=true）
    if (makePrimary) {
      await prisma.$executeRawUnsafe(`UPDATE Product SET image = ?, updatedAt = datetime('now') WHERE id = ? AND merchantId = ?`, orphan[0].url, productId, ADMIN_MERCHANT_ID)
    }

    // 标记孤儿图已关联
    await prisma.$executeRawUnsafe(
      `UPDATE OrphanPhoto SET status = 'linked', linkedProductId = ? WHERE id = ?`,
      productId, id
    )

    return NextResponse.json({
      success: true,
      message: makePrimary ? `✅ 已关联到商品主图` : `✅ 已记录关联（不替换主图）`,
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}