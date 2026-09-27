import path from 'path'
import { PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// ⭐ MEMORY §252 复发修法(2026-08-28 23:43): 不再硬编码 pharmacy 老 DB 路径
// 修法:process.cwd() 动态定位 + 兜底 prisma/dev.db
// 这样跨项目复制(SaaS 模板 → pharmacy/grocery/restaurant)都不会再有这问题
function resolveDbPath(): string {
  const envUrl = process.env.DATABASE_URL?.replace(/^file:/, '')
  if (envUrl && require('fs').existsSync(envUrl)) return envUrl
  // 优先 cwd/prisma/dev.db(标准 Prisma 约定),fallback 老路径防 dev cache
  const cwdPath = path.join(process.cwd(), 'prisma', 'dev.db')
  if (require('fs').existsSync(cwdPath)) return cwdPath
  return cwdPath  // 即使不存在也用这个,Prisma 会报明确错
}

function createPrismaClient(): PrismaClient {
  const dbPath = resolveDbPath()
  const adapter = new PrismaBetterSqlite3({ url: dbPath })
  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma