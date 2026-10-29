import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { ADMIN_MERCHANT_ID } from '@/lib/admin-merchant'
import * as XLSX from 'xlsx'
import { verifyAdminRequest, unauthorized } from '@/lib/admin-jwt-auth'

export const runtime = 'nodejs'


function pick(row: any, keys: string[]) {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && row[k] !== '') return row[k]
  }
  return null
}

function num(v: any): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(String(v).replace(/[^\d.\-]/g, ''))
  return Number.isFinite(n) ? n : null
}

function str(v: any, max = 500): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).trim().slice(0, max)
  return s === '' || s === '-' ? null : s
}

/**
 * POST /api/admin/products/import
 * form-data: file (.xlsx)
 * 列识别 (中英文皆可):
 *   - productCode: 商品编码 / productCode
 *   - name: 商品名称 / name
 *   - shortName: 简称 / shortName
 *   - spec: 规格 / spec
 *   - price: 售价 / price
 *   - stock: 库存 / stock
 *   - category: 分类 / category
 *   - categoryLabel: 分类标签 / categoryLabel
 *   - manufacturer: 厂家 / manufacturer
 * 按 productCode 匹配，匹配到 update，未匹配到 create
 */
export async function POST(request: NextRequest) {
  try {
    const auth = verifyAdminRequest(request)
    if (!auth.ok) return unauthorized(auth)

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ success: false, error: '请上传文件' }, { status: 400 })

    const buf = Buffer.from(await file.arrayBuffer())
    const wb = XLSX.read(buf, { type: 'buffer' })
    const sheet = wb.Sheets[wb.SheetNames[0]]
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' })

    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: '空文件 / 无数据行' }, { status: 400 })
    }

    const merchantRows: any[] = await prisma.$queryRaw`SELECT id FROM Merchant LIMIT 1`
    const merchantId = merchantRows[0]?.id || ADMIN_MERCHANT_ID

    let created = 0, updated = 0, skipped = 0
    const errors: string[] = []

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      const productCode = str(pick(r, ['商品编码', 'productCode', '编码', 'code']), 50)
      const name = str(pick(r, ['商品名称', 'name', '名称']), 200)

      if (!productCode && !name) { skipped++; continue }

      const price = num(pick(r, ['售价', 'price', '零售价', '销售价']))
      const stock = num(pick(r, ['库存', 'stock', '数量']))
      const category = str(pick(r, ['分类', 'category']), 50)
      const categoryLabel = str(pick(r, ['分类标签', 'categoryLabel']), 50)
      const shortName = str(pick(r, ['简称', 'shortName']), 100)
      const spec = str(pick(r, ['规格', 'spec']), 100)
      const manufacturer = str(pick(r, ['厂家', 'manufacturer']), 100)

      try {
        if (productCode) {
          // 找现有
          const existing: any[] = await prisma.$queryRaw`SELECT id, stock FROM Product WHERE productCode = ${productCode} AND Product.merchantId = ${ADMIN_MERCHANT_ID} LIMIT 1`
          if (existing.length > 0) {
            const ex = existing[0]
            // update
            await prisma.$executeRawUnsafe(
              `UPDATE Product SET
                name = COALESCE(?, name),
                shortName = COALESCE(?, shortName),
                spec = COALESCE(?, spec),
                price = COALESCE(?, price),
                stock = COALESCE(?, stock),
                category = COALESCE(?, category),
                categoryLabel = COALESCE(?, categoryLabel),
                manufacturer = COALESCE(?, manufacturer),
                updatedAt = CURRENT_TIMESTAMP
               WHERE id = ?`,
              name, shortName, spec, price, stock, category, categoryLabel, manufacturer, ex.id
            )
            updated++
            continue
          }
        }
        // create new
        const newId = `p_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
        await prisma.$executeRawUnsafe(
          `INSERT INTO Product (id, merchantId, productCode, name, shortName, spec, price, stock, category, categoryLabel, manufacturer, status, createdAt, updatedAt)
           VALUES (?,?,?,?,?,?,?,?,?,?,?, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          newId, merchantId, productCode || newId, name || '(未命名)', shortName, spec, price ?? 0, stock ?? 0, category, categoryLabel, manufacturer
        )
        created++
      } catch (err: any) {
        errors.push(`第 ${i + 2} 行: ${err.message}`)
        skipped++
      }
    }

    // 写 audit
    await prisma.$executeRaw`
      INSERT INTO AuditLog (id, actorType, actorId, action, target, description, createdAt)
      VALUES (${`al_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`}, 'admin', null, 'import_products', ${file.name}, ${`导入 ${file.name}: 新建 ${created} / 更新 ${updated} / 跳过 ${skipped}`}, CURRENT_TIMESTAMP)
    `

    return NextResponse.json({
      success: true,
      total: rows.length,
      created,
      updated,
      skipped,
      errors: errors.slice(0, 5),
    })
  } catch (error: any) {
    console.error('[admin/products/import]', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}