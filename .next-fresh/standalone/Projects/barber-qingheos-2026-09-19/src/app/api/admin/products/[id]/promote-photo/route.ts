import { NextRequest, NextResponse } from 'next/server'
import * as fs from 'fs/promises'
import * as path from 'path'
import sharp from 'sharp'
import { prisma } from '@/lib/db'
import { verifyAdminRequest, unauthorized } from '@/lib/admin-jwt-auth'
import { ADMIN_MERCHANT_ID } from '@/lib/admin-merchant'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * POST /api/admin/products/[id]/promote-photo
 * body: {
 *   baseImagePath: '/uploads/products/xxx/std_xxx.jpg',
 *   template: 'hot_deal' | 'new_arrival' | 'b2g1' | 'authentic',
 *   customText: { discountPrice?, originalPrice?, manufacturer?, tagline? }
 * }
 * 在原图上叠加 SVG 模板（限时特价/新品上市/买二送一/正品保障）
 * 输出 std_xxx_promo.jpg，自动更新 Product.image
 * 奕霖 2026-08-01 17:10 "能不能在基础上，编辑一下商品图的宣传"
 */

function escapeXml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildSvg(template: string, text: any): string {
  const safeText = {
    discountPrice: escapeXml(text?.discountPrice || '9.9'),
    originalPrice: escapeXml(text?.originalPrice || '19.9'),
    manufacturer: escapeXml(text?.manufacturer || '厂家直供'),
    tagline: escapeXml(text?.tagline || ''),
  }

  switch (template) {
    case 'hot_deal':
      return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
  <!-- 右上角斜角标"限时特价" -->
  <polygon points="824,0 1024,0 1024,200 824,120" fill="#dc2626" />
  <text x="950" y="60" font-family="-apple-system,PingFang SC,sans-serif" font-size="36" font-weight="bold" fill="white" text-anchor="middle">限时</text>
  <text x="950" y="110" font-family="-apple-system,PingFang SC,sans-serif" font-size="32" font-weight="bold" fill="#fef08a" text-anchor="middle">特价</text>
  <!-- 左下角黄色价签 -->
  <rect x="20" y="860" width="320" height="140" rx="14" fill="#b8860b" stroke="#dc2626" stroke-width="3"/>
  <text x="40" y="925" font-family="-apple-system,PingFang SC,sans-serif" font-size="56" font-weight="bold" fill="#dc2626">¥${safeText.discountPrice}</text>
  <text x="40" y="975" font-family="-apple-system,PingFang SC,sans-serif" font-size="24" fill="#7f1d1d">原价 ¥${safeText.originalPrice}</text>
</svg>`

    case 'new_arrival':
      return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
  <!-- 左上角圆形 NEW 徽章 -->
  <circle cx="120" cy="120" r="84" fill="#b8860b" stroke="#fff" stroke-width="6"/>
  <text x="120" y="110" font-family="Arial,sans-serif" font-size="44" font-weight="bold" fill="white" text-anchor="middle">NEW</text>
  <text x="120" y="148" font-family="-apple-system,PingFang SC,sans-serif" font-size="18" font-weight="bold" fill="white" text-anchor="middle">新到货</text>
  <!-- 底部"新到货"横幅 -->
  ${safeText.tagline ? `<text x="512" y="990" font-family="-apple-system,PingFang SC,sans-serif" font-size="28" fill="#15803d" text-anchor="middle">${safeText.tagline}</text>` : ''}
</svg>`

    case 'b2g1':
      return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
  <!-- 中央大红色圆形徽章 -->
  <circle cx="512" cy="420" r="200" fill="#dc2626" stroke="#fff" stroke-width="8"/>
  <text x="512" y="380" font-family="-apple-system,PingFang SC,sans-serif" font-size="90" font-weight="bold" fill="white" text-anchor="middle">买2</text>
  <line x1="380" y1="410" x2="644" y2="410" stroke="#fef08a" stroke-width="4"/>
  <text x="512" y="490" font-family="-apple-system,PingFang SC,sans-serif" font-size="90" font-weight="bold" fill="#fef08a" text-anchor="middle">送1</text>
  <!-- 右上角小标"限时" -->
  <rect x="824" y="60" width="140" height="64" rx="32" fill="#b8860b" stroke="#dc2626" stroke-width="3"/>
  <text x="894" y="105" font-family="-apple-system,PingFang SC,sans-serif" font-size="32" font-weight="bold" fill="#dc2626" text-anchor="middle">限时</text>
</svg>`

    case 'authentic':
      return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
  <!-- 右下角盾牌"100% 正品" -->
  <g transform="translate(800, 800)">
    <polygon points="0,0 200,0 200,140 100,220 0,140" fill="#1e40af" stroke="#fff" stroke-width="6"/>
    <text x="100" y="80" font-family="-apple-system,PingFang SC,sans-serif" font-size="36" font-weight="bold" fill="white" text-anchor="middle">100%</text>
    <text x="100" y="130" font-family="-apple-system,PingFang SC,sans-serif" font-size="40" font-weight="bold" fill="#fef08a" text-anchor="middle">正品</text>
  </g>
  <!-- 底部厂家名 -->
  <rect x="100" y="940" width="600" height="60" rx="8" fill="#1e40af" opacity="0.92"/>
  <text x="400" y="980" font-family="-apple-system,PingFang SC,sans-serif" font-size="28" font-weight="bold" fill="white" text-anchor="middle">${safeText.manufacturer}</text>
</svg>`

    default:
      throw new Error(`Unknown template: ${template}`)
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = verifyAdminRequest(request)
    if (!auth.ok) return unauthorized(auth)

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const baseImagePath = body.baseImagePath as string | undefined
    const template = body.template as string | undefined
    const customText = body.customText || {}

    if (!baseImagePath || !baseImagePath.startsWith('/uploads/')) {
      return NextResponse.json({ success: false, error: 'baseImagePath 必须以 /uploads/ 开头' }, { status: 400 })
    }
    if (!['hot_deal', 'new_arrival', 'b2g1', 'authentic'].includes(template || '')) {
      return NextResponse.json({ success: false, error: 'template 必须是 hot_deal / new_arrival / b2g1 / authentic' }, { status: 400 })
    }

    const absoluteBasePath = path.join(process.cwd(), 'public', baseImagePath)
    try {
      await fs.access(absoluteBasePath)
    } catch {
      return NextResponse.json({ success: false, error: '原图文件不存在' }, { status: 404 })
    }

    // 生成 SVG（template 已上面验证过，这里强制类型）
    const svgString = buildSvg(template as 'hot_deal' | 'new_arrival' | 'b2g1' | 'authentic', customText)
    const svgBuffer = Buffer.from(svgString, 'utf-8')

    // 输出路径：原文件名后缀 _promo.jpg
    const dir = path.dirname(absoluteBasePath)
    const originalName = path.basename(absoluteBasePath)
    const promotedName = originalName.replace(/\.jpe?g$/i, '') + '_promo.jpg'
    const promotedPath = path.join(dir, promotedName)
    const promotedRelPath = `/uploads/products/${id}/${promotedName}`

    // sharp 合成：原图 + SVG（叠加）
    const baseBuffer = await fs.readFile(absoluteBasePath)
    const composed = await sharp(baseBuffer)
      .composite([{
        input: svgBuffer,
        top: 0,
        left: 0,
      }])
      .jpeg({ quality: 92, mozjpeg: true })
      .toBuffer()

    await fs.writeFile(promotedPath, composed)
    const stat = await fs.stat(promotedPath)

    // 自动同步到 Product.image
    await prisma.$executeRawUnsafe(
      `UPDATE Product SET image = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
      promotedRelPath,
      id
    )

    // AuditLog 埋点
    await prisma.$executeRawUnsafe(
      `INSERT INTO AuditLog (id, actorType, actorId, action, target, description, createdAt)
       VALUES (?, 'admin', null, 'promote_product_photo', ?, ?, CURRENT_TIMESTAMP)`,
      `al_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      id,
      `商品图宣传：模板=${template}, 输出=${promotedName} (${stat.size} bytes)`
    )

    return NextResponse.json({
      success: true,
      url: promotedRelPath,
      size: stat.size,
      template,
      customText,
      productImageUpdated: true,
    })
  } catch (error: any) {
    console.error('[admin/products/promote-photo]', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}