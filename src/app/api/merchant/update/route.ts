/**
 * /api/merchant/update - 更新商户信息
 *
 * 2026-07-04 00:50 奕霖需求：
 *   - 商户后台表单保存一直 console.log（没真存到 DB）
 *   - 根因：前端调 /api/merchant/update，但端点不存在 → 404
 *   - 修法：补这个端点 + 真写文件
 *
 * 存储：data/merchants.json（0-1 阶段简单用，后续接 Prisma）
 */

import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const DATA_FILE = path.join(process.cwd(), 'data', 'merchants.json')

function ensureDataDir() {
  const dir = path.dirname(DATA_FILE)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2))
  }
}

interface Merchant {
  id: string
  name: string
  category: string
  phone: string
  address: string
  desc?: string
  services?: string
  style?: string
  status?: string
  createdAt?: string
  updatedAt?: string
  [key: string]: any
}

/** POST /api/merchant/update - 更新商户 */
export async function POST(request: NextRequest) {
  try {
    ensureDataDir()
    const body = await request.json() as Partial<Merchant>

    if (!body.id) {
      return NextResponse.json(
        { success: false, error: '缺少商户 id' },
        { status: 400 }
      )
    }

    // 读现有数据
    const data = fs.readFileSync(DATA_FILE, 'utf-8')
    const merchants: Merchant[] = JSON.parse(data)

    // 找目标商户
    const idx = merchants.findIndex((m) => m.id === body.id)
    if (idx === -1) {
      return NextResponse.json(
        { success: false, error: `找不到 id=${body.id} 的商户` },
        { status: 404 }
      )
    }

    // ⭐ 真存：合并更新（不覆盖 id / createdAt）
    const { id, createdAt, ...updates } = body
    const updated: Merchant = {
      ...merchants[idx],
      ...updates,
      id: merchants[idx].id, // 强制保留
      createdAt: merchants[idx].createdAt, // 强制保留
      updatedAt: new Date().toISOString(),
    }

    merchants[idx] = updated
    fs.writeFileSync(DATA_FILE, JSON.stringify(merchants, null, 2))

    console.log('[merchant/update] saved:', updated.id, updated.name)

    return NextResponse.json({
      success: true,
      merchant: updated,
    })
  } catch (error: any) {
    console.error('[merchant/update] error:', error?.message)
    return NextResponse.json(
      { success: false, error: '服务器错误', detail: error?.message },
      { status: 500 }
    )
  }
}

/** GET /api/merchant/update?id=xxx - 查单个商户（调试用） */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ success: false, error: '缺少 id' }, { status: 400 })
    }
    ensureDataDir()
    const data = fs.readFileSync(DATA_FILE, 'utf-8')
    const merchants: Merchant[] = JSON.parse(data)
    const m = merchants.find((x) => x.id === id)
    if (!m) {
      return NextResponse.json({ success: false, error: '未找到' }, { status: 404 })
    }
    return NextResponse.json({ success: true, merchant: m })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 })
  }
}
