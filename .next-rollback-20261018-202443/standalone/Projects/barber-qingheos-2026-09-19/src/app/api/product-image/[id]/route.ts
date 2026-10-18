import { NextRequest, NextResponse } from 'next/server'
import * as fs from 'fs/promises'
import * as path from 'path'
import { prisma } from '@/lib/db'
import { generateProductSvg } from '@/lib/product-image'

export const runtime = 'nodejs'

/**
 * GET /api/product-image/[id]
 * 奕霖 2026-08-01：商户上传真实图用上展示页
 * 优先级：1) Product.image（商户上传的真实图）→ 2) SVG 占位
 * 真实图直接读磁盘二进制返回（避免 302 重定向），fail 才 fallback SVG
 */

const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
}

function svgFallback(name: string, category: string, cacheSeconds: number) {
  const svg = generateProductSvg({ name, category })
  return new NextResponse(svg, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': `public, max-age=${cacheSeconds}`,
    },
  })
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT name, shortName, category, categoryLabel, dosage, image
       FROM Product
       WHERE id = ? OR productCode = ?
       LIMIT 1`,
      id, id
    )

    if (rows.length === 0) {
      // 商品不存在 → 默认占位（不 404，避免前端破图）
      return svgFallback('商品', 'DEFAULT', 3600)
    }

    const product = rows[0]
    const imagePath: string | null = product.image || null

    // 1) 商户已上传真实图 → 读磁盘二进制直接返回（避免重定向 +304 快）
    if (imagePath && imagePath.startsWith('/uploads/')) {
      try {
        const absPath = path.join(process.cwd(), 'public', imagePath)
        const stat = await fs.stat(absPath)
        if (stat.isFile()) {
          const buf = await fs.readFile(absPath)
          const ext = path.extname(imagePath).toLowerCase()
          const contentType = MIME_BY_EXT[ext] || 'image/jpeg'
          return new NextResponse(new Uint8Array(buf), {
            status: 200,
            headers: {
              'Content-Type': contentType,
              'Content-Length': String(stat.size),
              // 上传时文件名带时间戳，新图 = 新 URL = 浏览器自然重新拉取
              'Cache-Control': 'public, max-age=300, must-revalidate',
              'X-Image-Source': 'merchant-upload',
              'X-Image-Size': String(stat.size),
            },
          })
        }
      } catch (e: any) {
        // 文件丢了（被删了）/ 路径错 → fallback，不报错避免 500
        console.warn(`[product-image] ${imagePath} 读失败：${e.message}，fallback SVG`)
      }
    }

    // 2) 没图 / 图丢了 → SVG 占位（按分类色 + emoji + 商品名前 6 字）
    return svgFallback(product.name, product.category || 'DEFAULT', 86400)
  } catch (e: any) {
    console.error('[product-image API]', e)
    return svgFallback('商品', 'DEFAULT', 300)
  }
}
