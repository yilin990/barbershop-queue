import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'prisma/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dbPath = path.resolve(__dirname, 'prisma/dev.db')

export default defineConfig({
  schema: path.join(__dirname, 'prisma', 'schema.prisma'),

  // migrate: Prisma 7 用 migrations 路径或 schema 配置；adapter 移除避免 build error
  migrations: {
    path: path.join(__dirname, 'prisma', 'migrations'),
  },

  datasource: {
    url: `file:${dbPath}`,
  },
})