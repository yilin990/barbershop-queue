import Database, { DBInstance } from 'better-sqlite3'

const DB_PATH = '/Users/yilinzhao/.openclaw/workspace/projects/zhi_lin_pharmacy/official/prisma/dev.db'

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