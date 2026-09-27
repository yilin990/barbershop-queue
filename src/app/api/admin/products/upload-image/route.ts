import { NextRequest, NextResponse } from 'next/server'
import * as fs from 'fs/promises'
import * as path from 'path'
import { verifyAdminRequest, unauthorized } from '@/lib/admin-jwt-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/products/upload-image
 * ⭐ 2026-09-06 奕霖反馈 — 商品图要文件上传,不用 URL 链接
 *
 * form-data: file (image)
 * 返回: { success, url: '/uploads/products/xxx.png', size, type }
 *
 * 用于:
 *  - CreateModal 新建商品时上传图片
 *  - EditModal 编辑现有商品时更换图片
 *  - PATCH /api/admin/products/[id] 的 image 字段就是这个 URL
 */
export async function POST(request: NextRequest) {
  const auth = verifyAdminRequest(request)
  if (!auth.ok) return unauthorized(auth)
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ success: false, error: '请选择图片文件' }, { status: 400 })

    // 验证:必须是图片
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ success: false, error: `只支持图片文件,收到 ${file.type || '未知类型'}` }, { status: 400 })
    }
    // 大小限制 8MB
    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: `图片不能超过 8MB(收到 ${(file.size / 1024 / 1024).toFixed(2)}MB)` }, { status: 400 })
    }
    if (file.size === 0) {
      return NextResponse.json({ success: false, error: '文件为空' }, { status: 400 })
    }

    // 写入 public/uploads/products/
    const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '')
    const safeExt = ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext) ? ext : 'png'
    const filename = `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${safeExt}`
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'products')

    await fs.mkdir(uploadDir, { recursive: true })
    const buf = Buffer.from(await file.arrayBuffer())
    await fs.writeFile(path.join(uploadDir, filename), buf)

    const url = `/uploads/products/${filename}`
    return NextResponse.json({
      success: true,
      url,
      filename,
      size: file.size,
      type: file.type,
    })
  } catch (e: any) {
    console.error('[admin/products/upload-image]', e)
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}
