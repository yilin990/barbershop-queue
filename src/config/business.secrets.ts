/**
 * 门店密钥材料（服务端专用）· 2026-10-28 加固
 *
 * 🔴 为什么从 business.config.ts 搬出来：
 *   business.config.ts 被一堆 'use client' 组件 import（ConfigProvider、merchant 页、chat 页…），
 *   Next 会把整个对象打进 .next/static 的浏览器包 —— 也就是说
 *   pinPepper + staffPinHashes + adminPinHashes 全网可下载。
 *   6 位 PIN 只有 100 万种组合，SHA-256 无 salt 无限流 → 离线几分钟就能爆破出明文 PIN。
 *   （这就是「明文 PIN 被打进前端包」的老问题，只是不用改成明文也一样能爆破：哈希本身就是靶子。）
 *
 * ✅ 现在：
 *   - 密钥材料只在本文件（服务端专用模块）里，且优先读环境变量。
 *   - 前端拿到的 business.config.ts 不再包含任何密钥材料。
 *   - 客户端要验 PIN → 调服务端接口（/api/admin/auth/staff-pin、/api/admin/auth/admin-pin）。
 *
 * ⚠️ 本文件不得被任何 'use client' 文件 import（import 一次就等于重新泄密）。
 *    校验服务端引用：grep -rn "business.secrets" src | grep -v "app/api" | grep -v "^src/lib"
 *
 * 轮换建议（待主控决定）：这批值已经在 git 历史里公开过，建议改成随机值并同步轮换 PIN。
 */

/** PIN 哈希用的 pepper（env 优先） */
export const PIN_PEPPER: string = (process.env.PIN_PEPPER || 'linghang-lh-2026-pin-v1').trim()

function parseHashes(raw: string | undefined, fallback: string[]): readonly string[] {
  if (!raw || !raw.trim()) return fallback
  const list = raw.split(',').map((s) => s.trim()).filter(Boolean)
  return list.length ? list : fallback
}

/** 店员 PIN 哈希（env: STAFF_PIN_HASHES，逗号分隔） */
export const STAFF_PIN_HASHES: readonly string[] = parseHashes(
  process.env.STAFF_PIN_HASHES,
  [
    'c18fe89c66cdc81e103e521d8046518b8bc2e23d3f2f00150a751fb19c085df6',
    '1c7993f3d93576e7ea9fb71d773eb67f1c20244bf9ab9aee44b5065155bb0818',
    'ae537866cfaf0a62785259627ce8bc893cccfe6c8e6985163562f6649aca8f3f',
    '3873c969155f03f92064aeac346318e2481c37e341fe7db421b844de2db4ee52',
  ],
)

/** 商户后台 PIN 哈希（env: ADMIN_PIN_HASHES，逗号分隔） */
export const ADMIN_PIN_HASHES: readonly string[] = parseHashes(
  process.env.ADMIN_PIN_HASHES,
  [
    '0378c370eba89e32f1983b048a95f1bc859b6312805a7e5e7733328d28050714',
    '2efd4c738f8e315bc4f44871d3574fd928d8c1089a62b49e4620950e8b2652cf',
    '79dac51451dc5cea76ff1306cd37abd8ad8f729e02a7d3bf5522b64885a419b7',
  ],
)
