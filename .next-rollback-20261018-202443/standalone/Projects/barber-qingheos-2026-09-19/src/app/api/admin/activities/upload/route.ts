import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { ADMIN_MERCHANT_ID } from '@/lib/admin-merchant'
import * as fs from 'fs/promises'
import * as path from 'path'
import { verifyAdminRequest, unauthorized } from '@/lib/admin-jwt-auth'

export const runtime = 'nodejs'


/**
 * POST /api/admin/activities/upload
 * form-data: file (image)
 * 返回 { url: '/uploads/activities/xxx.png' }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = verifyAdminRequest(request)
    if (!auth.ok) return unauthorized(auth)

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ success: false, error: '请选择文件' }, { status: 400 })

    // 验证是图片
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ success: false, error: '只支持图片文件' }, { status: 400 })
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: '图片不能超过 5MB' }, { status: 400 })
    }

    // 写入 public/uploads/activities/
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
    const safeExt = ['png', 'jpg', 'jpeg', 'webp'].includes(ext) ? ext : 'png'
    const filename = `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${safeExt}`
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'activities')

    await fs.mkdir(uploadDir, { recursive: true })
    const buf = Buffer.from(await file.arrayBuffer())
    await fs.writeFile(path.join(uploadDir, filename), buf)

    return NextResponse.json({
      success: true,
      url: `/uploads/activities/${filename}`,
      size: file.size,
      type: file.type,
    })
  } catch (error: any) {
    console.error('[admin/activities/upload]', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}