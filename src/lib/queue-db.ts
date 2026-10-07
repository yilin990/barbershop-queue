/**
 * 队列表（BarberQueue）DB 打开助手 —— v1.1.54 · 2026-10-08 清禾
 *
 * ⚠️ 路径必须与 src/app/api/queues/route.ts 保持一致，
 *    否则「下单写入」和「排队页读取」会落到两个不同的 db 文件。
 *
 * 背景：/api/queues v1.1.2 起改绝对路径，因为 standalone 进程的 cwd 是
 *       .next/standalone/.../，相对路径会指向错的 db 文件。
 *       这里复用同样策略：绝对路径优先，不存在才退回 cwd 相对路径。
 */

import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'

const ABS_DB_PATH =
  '/Users/yilinzhao/Projects/barber-qingheos-2026-09-19/prisma/dev.db'

export function getQueueDbPath(): string {
  if (fs.existsSync(ABS_DB_PATH)) return ABS_DB_PATH
  return path.join(process.cwd(), 'prisma', 'dev.db')
}

export function getQueueDb(): Database.Database {
  return new Database(getQueueDbPath())
}
