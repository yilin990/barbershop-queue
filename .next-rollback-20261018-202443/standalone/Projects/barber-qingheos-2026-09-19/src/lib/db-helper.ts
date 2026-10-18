import path from 'path'
import fs from 'fs'
import Database, { DBInstance } from 'better-sqlite3'

// ⭐ v1.1.13 奕霖修（2026-10-05 02:02）：之前硬写 pharmacy 路径，运行时 fallback 到 ./prisma/dev.db 才生效
// 改成 process.cwd() 动态定位 + 兜底老路径，防未来搬项目/部署时崩
// ⭐ 优先级：cwd/prisma/dev.db（dev/standalone 部署都正确）→ 兜底 pharmacy 老路径（兼容旧部署）→ 最后兜底 cwd/prisma/dev.db
function resolveDbPath(): string {
  const cwdPath = path.join(process.cwd(), 'prisma', 'dev.db')
  if (fs.existsSync(cwdPath)) return cwdPath
  // 兜底 1：pharmacy 老路径（兼容旧部署/老 docker 镜像）
  const legacyPath = '/Users/yilinzhao/.openclaw/workspace/projects/zhi_lin_pharmacy/official/prisma/dev.db'
  if (fs.existsSync(legacyPath)) return legacyPath
  // 兜底 2：最后兜底返回 cwd 路径（让 better-sqlite3 创建空 DB，不让服务崩）
  return cwdPath
}

const DB_PATH = resolveDbPath()

let _db: DBInstance | null = null

function getDb(): DBInstance {
  if (!_db) {
    _db = new Database(DB_PATH)
    _db.pragma('journal_mode = WAL')
    _db.pragma('foreign_keys = ON')
  }
  return _db
}

export function rawQuery<T = any>(sql: string, params: any[] = []): T[] {
  const db = getDb()
  return db.prepare(sql).all(...params) as T[]
}

export function rawQueryOne<T = any>(sql: string, params: any[] = []): T | null {
  const db = getDb()
  const result = db.prepare(sql).get(...params)
  return (result as T) || null
}

export function rawExecute(sql: string, params: any[] = []): { lastID: string; changes: number } {
  const db = getDb()
  const stmt = db.prepare(sql)
  const result = stmt.run(...params)
  return {
    lastID: String(result.lastInsertRowid),
    changes: result.changes,
  }
}

export function rawTransaction<T>(fn: () => T): T {
  const db = getDb()
  return db.transaction(fn)()
}

// ⭐ v1.1.13：暴露 DB_PATH 供调试用（生产环境可移除）
export const __DB_PATH_DEBUG__ = DB_PATH