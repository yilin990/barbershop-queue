import path from 'path'

/**
 * SQLite 路径统一解析 —— v1.1.64 清禾 2026-10-08
 *
 * 为什么需要这个文件：
 * 项目里有 7 处在写死绝对路径 '/Users/yilinzhao/Projects/barber-qingheos-2026-09-19/prisma/dev.db'。
 * 坏处有两层：
 *   1. 复制代码去开新店，新店读写的是老店的库 —— 关店了还能被写
 *   2. 换机器/换用户home 目录，直接启动失败
 *
 * 但不能简单改成 process.cwd()：
 * standalone 产物的 cwd 是 .next/standalone/<原项目路径>/，
 * 相对路径会指到构建时拷进去的 db 副本，而不是运行时该读写的那个
 * （v1.1.2 / v1.1.3 踩过，当时才改的绝对路径）。
 *
 * 所以这里做两件事：
 *   1. 环境变量优先（MEMBER_DB_PATH），暂存/多实例各自指自己的库
 *   2. cwd 落在 .next/standalone 里时，先剥掉这段前缀拿到真实项目根
 *   这样 next start（cwd=项目根）和 standalone 都能解析到同一个库。
 */

/** 从 cwd 反推真实项目根目录 */
export function projectRoot(): string {
  const cwd = process.cwd()
  const marker = path.join('.next', 'standalone')
  const i = cwd.indexOf(marker)
  if (i !== -1) return cwd.slice(0, i)
  return cwd
}

/**
 * 解析 SQLite 库路径。
 * 优先级：MEMBER_DB_PATH > <项目根>/prisma/dev.db > <cwd>/prisma/dev.db
 */
export function resolveDbPath(): string {
  if (process.env.MEMBER_DB_PATH) return process.env.MEMBER_DB_PATH
  return path.join(projectRoot(), 'prisma', 'dev.db')
}
