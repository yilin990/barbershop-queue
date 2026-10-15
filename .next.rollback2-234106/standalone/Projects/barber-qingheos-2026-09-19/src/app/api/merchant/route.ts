import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import { cacheHeaders, CACHE_TTL } from '@/lib/cache-headers'
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

export async function GET() {
  ensureDataDir()
  const data = fs.readFileSync(DATA_FILE, 'utf-8')
  const merchants = JSON.parse(data)
  return NextResponse.json(merchants, { headers: cacheHeaders(CACHE_TTL.STATIC) })
}

export async function POST(request: NextRequest) {
  try {
    ensureDataDir()
    const body = await request.json()
    
    const required = ['name', 'phone', 'category', 'address']
    for (const field of required) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `缺少必填字段: ${field}` },
          { status: 400 }
        )
      }
    }
    
    const data = fs.readFileSync(DATA_FILE, 'utf-8')
    const merchants = JSON.parse(data)
    
    const newMerchant = {
      id: `merchant_${Date.now()}`,
      ...body,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    
    merchants.push(newMerchant)
    fs.writeFileSync(DATA_FILE, JSON.stringify(merchants, null, 2))
    
    return NextResponse.json(newMerchant, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    )
  }
}
