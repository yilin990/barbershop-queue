import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { productId, photoBase64, period, note, shotBy, merchantId } = body

    if (!productId || !photoBase64) {
      return NextResponse.json({ success: false, error: '缺少 productId 或 photoBase64' }, { status: 400 })
    }
    const match = photoBase64.match(/^data:(image\/\w+);base64,(.+)$/)
    if (!match) {
      return NextResponse.json({ success: false, error: 'photoBase64 格式错误' }, { status: 400 })
    }
    const ext = match[1].split('/')[1] || 'jpg'
    const buffer = Buffer.from(match[2], 'base64')
    if (buffer.length > 5 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: '图片超过 5MB' }, { status: 400 })
    }

    const stamp = Date.now()
    const filename = `snap_${stamp}.${ext}`
    const dir = path.join(process.cwd(), 'public', 'uploads', 'snapshots')
    await mkdir(dir, { recursive: true })
    await writeFile(path.join(dir, filename), buffer)
    const photoUrl = `/uploads/snapshots/${filename}`

    const id = `ps_${stamp}_${Math.random().toString(36).slice(2, 8)}`
    const merchant = merchantId || 'm_grocery_001'
    const shotByVal = shotBy || 'merchant-staff'
    const noteVal = note || null

    await prisma.$executeRawUnsafe(
      `INSERT INTO PhotoSnapshot (id, productId, merchantId, photoUrl, shotAt, period, shotBy, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      id, productId, merchant, photoUrl, new Date().toISOString(), period || 'morning', shotByVal, noteVal
    )

    return NextResponse.json({
      success: true,
      snapshot: { id, productId, merchantId: merchant, photoUrl, shotAt: new Date().toISOString(), period: period || 'morning', note }
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}
