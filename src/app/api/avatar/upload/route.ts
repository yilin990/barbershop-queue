import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE = 2 * 1024 * 1024  // 2MB

export async function POST(req: NextRequest) {
  // ⭐ 2026-08-26 00:15 修：formData 解析异常时返 400 而非 500
  let formData: FormData
  try {
    formData = await req.formData()
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: '需要 multipart/form-data 请求' },
      { status: 400 }
    )
  }

  const file = formData.get('avatar') as File | null
  const phone = formData.get('phone') as string | null

  if (!file) {
    return NextResponse.json({ success: false, error: '没收到文件' }, { status: 400 })
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ success: false, error: '只支持 JPEG/PNG/WebP' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ success: false, error: '文件超过 2MB' }, { status: 400 })
  }

  try {
    const ext = file.type.split('/')[1]
    const safePhone = phone?.replace(/\D/g, '') || 'unknown'
    const filename = `${safePhone}_${Date.now()}.${ext}`
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'avatars')
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }
    const filepath = path.join(uploadDir, filename)
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(filepath, buffer)

    const url = `/uploads/avatars/${filename}`
    return NextResponse.json({ success: true, url })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || '保存失败' }, { status: 500 })
  }
}
