/**
 * /api/services/upload — 服务图上传（2026-10-01 清禾第一优先）
 *
 * 接收 multipart/form-data 或 base64，返回 { url }
 * 存储：public/uploads/services/{stamp}.{ext}
 *
 * 上传后用 url 调 PUT /api/services/[id] 写入 Service.image
 */

import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

export const runtime = 'nodejs'

const MAX_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif'])

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || ''

    let buffer: Buffer
    let ext: string

    if (contentType.includes('multipart/form-data')) {
      // multipart/form-data 方式
      const form = await req.formData()
      const file = form.get('file') as File | null
      if (!file) {
        return NextResponse.json({ success: false, error: '缺少 file 字段' }, { status: 400 })
      }
      const arrayBuffer = await file.arrayBuffer()
      buffer = Buffer.from(arrayBuffer)
      const fname = file.name || ''
      ext = fname.split('.').pop()?.toLowerCase() || file.type.split('/').pop() || 'jpg'
    } else {
      // base64 方式（与 snapshots/upload 一致）
      const body = await req.json()
      const photoBase64 = body.photoBase64 || ''
      const match = photoBase64.match(/^data:(image\/\w+);base64,(.+)$/)
      if (!match) {
        return NextResponse.json({ success: false, error: 'photoBase64 格式错误' }, { status: 400 })
      }
      ext = match[1].split('/')[1] || 'jpg'
      buffer = Buffer.from(match[2], 'base64')
    }

    if (!ALLOWED.has(ext)) {
      return NextResponse.json({ success: false, error: `不支持的图片格式: ${ext}` }, { status: 400 })
    }
    if (buffer.length > MAX_SIZE) {
      return NextResponse.json({ success: false, error: '图片超过 5MB' }, { status: 400 })
    }

    const stamp = Date.now()
    const rand = Math.random().toString(36).slice(2, 6)
    const filename = `srv_${stamp}_${rand}.${ext}`
    const dir = path.join(process.cwd(), 'public', 'uploads', 'services')
    await mkdir(dir, { recursive: true })
    await writeFile(path.join(dir, filename), buffer)

    const url = `/uploads/services/${filename}`
    return NextResponse.json({
      success: true,
      url,
      filename,
      size: buffer.length,
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}