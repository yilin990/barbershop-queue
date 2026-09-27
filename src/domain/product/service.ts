/**
 * 商品 domain — 抽离商品搜索/列表/详情业务（2026-07-25 by 清禾）
 *
 * 包含：
 *   - listProducts    商品列表（多筛选 + 分页 + 缓存 + 排序）
 *
 * 复用：所有商品密集型（药房/超市/便利）都走这个
 * 注意：商品 CRUD 是商家后台的（admin/*），不在这里
 */

import { prisma } from '@/lib/db'
import { serverCache } from '@/lib/server-cache'
import { NotFoundError } from '@/lib/error'

// ============== Type 定义 ==============

export interface ListProductsInput {
  merchantCode?: string
  q?: string          // 搜索关键词（商品名/简称/厂家/批准文号/规格）
  category?: string   // 分类编码
  qm?: string         // 质量管理分类（OTC/处方药/医疗器械...）
  functionTag?: string // 功能主治标签
  inStock?: boolean   // 是否只看有库存
  sort?: 'price-asc' | 'price-desc' | 'sales' | 'newest' | 'name'
  page?: number
  pageSize?: number
}

export interface ProductItem {
  id: string
  name: string
  shortName: string
  spec: string | null
  manufacturer: string | null
  barcode: string | null
  approvalNo: string | null
  price: number
  memberPrice: number
  stock: number
  category: string | null
  categoryLabel: string | null
  dosage: string | null
  unit: string | null
  qualityClass: string | null
  functionTags: string | null
  sales30d: number
  sales30_60d: number
  sales60_90d: number
  image: string | null
  medicalCode: string | null
}

export interface ListProductsResult {
  products: ProductItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// ============== 列表查询 ==============

/**
 * 商品列表查询（多筛选 + 分页 + 缓存）
 *
 * Query:
 *   - merchantCode: 商户编码（默认 0005）
 *   - q: 搜索关键词
 *   - category: 分类编码
 *   - qm: 质量管理分类
 *   - functionTag: 功能主治标签
 *   - inStock: 是否只看有库存
 *   - sort: 排序方式
 *   - page/pageSize: 分页
 *
 * 安全：
 *   - 用户输入 q/category/qm/functionTag 全 escape（防 SQL 注入）
 *   - 5 分钟 serverCache 包裹（同 query 直接命中 <1ms）
 */
export async function listProducts(input: ListProductsInput): Promise<ListProductsResult> {
  const {
    merchantCode = 'G0001',  // ⭐ MEMORY §283 — 奕霖锁果蔬行业,默认 G0001(果蔬鲜生)
    q = '',
    category = '',
    qm = '',
    functionTag = '',
    inStock = false,
    sort = 'sales',
    page = 1,
    pageSize = 20,
  } = input

  // 1. 找 merchant
  const merchants = await prisma.$queryRaw<any[]>`
    SELECT id FROM Merchant WHERE code = ${merchantCode} LIMIT 1
  `
  if (merchants.length === 0) {
    throw new NotFoundError('商户不存在')
  }
  const merchantId = merchants[0].id

  // 2. 构造查询条件（raw SQL 拼接，所有用户输入都 escape）
  //    ⭐ MEMORY 183 — 芝林 SaaS 试运行 v2.0：处方药整条移出线上体系
  //    国药准字 H 开头 = 处方药（Rx），OTC/中药/保健品的批准文号是 Z/S/B/F 等
  let where = `p.merchantId = '${merchantId}' AND p.status = 'active'`
  where += ` AND (p.approvalNo IS NULL OR p.approvalNo NOT LIKE '国药准字H%')`

  if (q) {
    const safeQ = q.replace(/['"%_]/g, '')
    where += ` AND (p.name LIKE '%${safeQ}%' OR p.shortName LIKE '%${safeQ}%' OR p.manufacturer LIKE '%${safeQ}%' OR p.approvalNo LIKE '%${safeQ}%' OR p.spec LIKE '%${safeQ}%')`
  }
  if (category) {
    // ⭐ MEMORY §286 — 2026-08-28 奕霖反馈:柑橘类等 /products chip 子类别名查不到
    // 修法:用 SUB_CATEGORY_ALIASES 把柑橘类→F001,再走三段匹配
    const { SUB_CATEGORY_ALIASES, FRUIT_VEG_CATEGORY_NAMES } = await import('@/lib/category-mapping')
    const resolved = SUB_CATEGORY_ALIASES[category] || category
    const safe = resolved.replace(/['"%_\\]/g, '')
    const labelCN = FRUIT_VEG_CATEGORY_NAMES[resolved] || ''
    if (safe) {
      where += ` AND (p.category = '${safe}' OR p.categoryLabel = '${safe}'`
      if (labelCN) where += ` OR p.categoryLabel = '${labelCN}'`
      where += `)`
    }
  }
  if (qm) {
    const safeQM = qm.replace(/'/g, '')
    where += ` AND p.qualityClass = '${safeQM}'`
  }
  if (functionTag) {
    const safeFT = functionTag.replace(/'/g, '')
    where += ` AND p.functionTags LIKE '%${safeFT}%'`
  }
  if (inStock) {
    where += ` AND p.stock > 0`
  }

  // 3. 排序
  let orderBy = 'p.sales30d DESC, p.name ASC'
  if (sort === 'price-asc') orderBy = 'p.price ASC'
  else if (sort === 'price-desc') orderBy = 'p.price DESC'
  else if (sort === 'newest') orderBy = "datetime(p.createdAt) DESC, p.name ASC"
  else if (sort === 'name') orderBy = 'p.name ASC'

  // 4. serverCache 包裹（5min TTL）
  const cacheKey = `products:${merchantCode}|${q}|${category}|${qm}|${functionTag}|${inStock ? 1 : 0}|${sort}|${page}|${pageSize}`
  return serverCache(cacheKey, 300, async () => {
    // 4a. 总数
    const countResult = await prisma.$queryRawUnsafe<any[]>(
      `SELECT CAST(COUNT(*) AS INTEGER) as total FROM Product p WHERE ${where}`
    )
    const total = countResult[0]?.total || 0

    // 4b. 分页
    const safePage = Math.max(1, page)
    const safePageSize = Math.min(50, Math.max(1, pageSize))
    const offset = (safePage - 1) * safePageSize
    const products = await prisma.$queryRawUnsafe<any[]>(
      `SELECT
        p.id, p.name, p.shortName, p.spec, p.manufacturer, p.barcode, p.approvalNo,
        CAST(p.price AS REAL) as price, CAST(p.memberPrice AS REAL) as memberPrice, CAST(p.stock AS INTEGER) as stock,
        p.category, p.categoryLabel, p.dosage, p.unit,
        p.qualityClass, p.functionTags, CAST(p.sales30d AS INTEGER) as sales30d, CAST(p.sales30_60d AS INTEGER) as sales30_60d, CAST(p.sales60_90d AS INTEGER) as sales60_90d,
        p.image, p.medicalCode, p.costPrice
      FROM Product p
      WHERE ${where}
      ORDER BY ${orderBy}
      LIMIT ${safePageSize} OFFSET ${offset}`
    )

    return {
      products: products.map((p: any) => ({
        id: String(p.id),
        name: String(p.name || ''),
        shortName: String(p.shortName || p.name || ''),
        spec: p.spec ? String(p.spec) : null,
        manufacturer: p.manufacturer ? String(p.manufacturer) : null,
        barcode: p.barcode ? String(p.barcode) : null,
        approvalNo: p.approvalNo ? String(p.approvalNo) : null,
        price: Number(p.price) || 0,
        memberPrice: Number(p.memberPrice) || 0,
        stock: Number(p.stock) || 0,
        category: p.category ? String(p.category) : null,
        categoryLabel: p.categoryLabel ? String(p.categoryLabel) : null,
        dosage: p.dosage ? String(p.dosage) : null,
        unit: p.unit ? String(p.unit) : null,
        qualityClass: p.qualityClass ? String(p.qualityClass) : null,
        functionTags: p.functionTags ? String(p.functionTags) : null,
        sales30d: Number(p.sales30d) || 0,
        sales30_60d: Number(p.sales30_60d) || 0,
        sales60_90d: Number(p.sales60_90d) || 0,
        image: p.image ? String(p.image) : null,
        medicalCode: p.medicalCode ? String(p.medicalCode) : null,
      })),
      total: Number(total),
      page: safePage,
      pageSize: safePageSize,
      totalPages: Math.ceil(Number(total) / safePageSize),
    }
  })
}