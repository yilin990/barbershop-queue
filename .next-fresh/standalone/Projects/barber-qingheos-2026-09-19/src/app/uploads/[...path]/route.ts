import { NextRequest, NextResponse } from 'next/server'
import * as fs from 'fs/promises'
import * as path from 'path'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /uploads/[...path]
 * 动态文件服务 — 从 public/uploads/ 读文件
 *
 * ⭐ 2026-09-06 — `next start` 在启动时缓存 public/ 目录,运行时新增的文件不重新扫描
 *   加这个 catch-all 路由,运行时新增的 uploads/ 文件能立即访问(不需重启服务)
 *
 * 安全:拒绝路径穿越('../')+ 只读 public/uploads/ 内的文件
 */

const MIME: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.json': 'application/json', '.txt': 'text/plain',
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params
  const relPath = segments.join('/')

  // 安全检查:路径穿越
  if (relPath.includes('..') || relPath.startsWith('/')) {
    return new NextResponse('Bad path', { status: 400 })
  }

  const absPath = path.join(process.cwd(), 'public', 'uploads', relPath)
  // 二次校验:解析后必须在 public/uploads/ 下
  const uploadsRoot = path.join(process.cwd(), 'public', 'uploads')
  if (!absPath.startsWith(uploadsRoot + path.sep) && absPath !== uploadsRoot) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  try {
    const buf = await fs.readFile(absPath)
    const ext = path.extname(absPath).toLowerCase()
    const mime = MIME[ext] || 'application/octet-stream'
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': mime,
        'Content-Length': String(buf.length),
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (e: any) {
    if (e.code === 'ENOENT') return new NextResponse('Not found', { status: 404 })
    return new NextResponse(`Error: ${e.message}`, { status: 500 })
  }
}
