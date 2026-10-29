/**
 * 门店 PIN 哈希工具（客户端安全）
 *
 * 为什么需要它：
 * 明文 PIN 原本写在 business.config.ts，该文件被 'use client' 组件间接 import，
 * 导致 PIN 被打进 .next/static/ 的浏览器可下载文件里 —— 任何顾客查看网页源码即可读到。
 *
 * 本库提供**同步、无 IO、无 Node 依赖**的 SHA-256，
 * 让客户端可以「比对哈希」完成本地解锁，同时源码与构建产物里不再出现明文 PIN。
 *
 * 安全边界说明：
 * 客户端哈希只用于**本地解锁体验**，不是安全边界。
 * 真正的鉴权在服务端 src/lib/staff-credential.ts（scrypt + 数据库）。
 * 6 位 PIN 只有 100 万种组合，任何哈希都可被穷举 —— 这里的目标是「不出现明文」，
 * 真正的防线是服务端校验 + 限流锁定。
 */

/** 标准 SHA-256，纯 TypeScript 实现，同步，浏览器与 Node 均可用 */
export function sha256Hex(input: string): string {
  // 预处理：填充到 64 字节整数倍
  const bytes: number[] = []
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i)
    if (c < 0x80) bytes.push(c)
    else if (c < 0x800) bytes.push(0xc0 | (c >> 6), 0x80 | (c & 63))
    else if (c < 0xd800 || c >= 0xe000) bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63))
    else {
      i++
      const cp = 0x10000 + (((c & 0x3ff) << 10) | (input.charCodeAt(i) & 0x3ff))
      bytes.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63))
    }
  }
  const bitLen = bytes.length * 8
  bytes.push(0x80)
  while (bytes.length % 64 !== 56) bytes.push(0)
  const hi = Math.floor(bitLen / 0x100000000)
  bytes.push((hi >>> 24) & 255, (hi >>> 16) & 255, (hi >>> 8) & 255, hi & 255)
  bytes.push((bitLen >>> 24) & 255, (bitLen >>> 16) & 255, (bitLen >>> 8) & 255, bitLen & 255)

  const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]
  const K = [
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
  ]
  const w = new Array<number>(64)
  const rr = (x: number, n: number) => (x >>> n) | (x << (32 - n))

  for (let off = 0; off < bytes.length; off += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = (bytes[off + i * 4] << 24) | (bytes[off + i * 4 + 1] << 16) | (bytes[off + i * 4 + 2] << 8) | bytes[off + i * 4 + 3]
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rr(w[i - 15], 7) ^ rr(w[i - 15], 18) ^ (w[i - 15] >>> 3)
      const s1 = rr(w[i - 2], 17) ^ rr(w[i - 2], 19) ^ (w[i - 2] >>> 10)
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0
    }
    let [a, b, c, d, e, f, g, h] = H
    for (let i = 0; i < 64; i++) {
      const S1 = rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)
      const ch = (e & f) ^ (~e & g)
      const t1 = (h + S1 + ch + K[i] + w[i]) >>> 0
      const S0 = rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const t2 = (S0 + maj) >>> 0
      h = g; g = f; f = e
      e = (d + t1) >>> 0
      d = c; c = b; b = a
      a = (t1 + t2) >>> 0
    }
    H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0
    H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0
  }
  return H.map((x) => x.toString(16).padStart(8, '0')).join('')
}

/** 把明文 PIN 转成配置里存的哈希形式 */
export function hashPin(pin: string, pepper: string): string {
  return sha256Hex(`${pepper}::${pin.trim()}`)
}

/** 校验一个 PIN 是否命中任一哈希 */
export function verifyPinHashes(pin: string, hashes: readonly string[], pepper: string): boolean {
  if (typeof pin !== 'string' || pin.length === 0) return false
  if (!hashes || hashes.length === 0) return false
  const target = hashPin(pin, pepper)
  let matched = false
  for (const h of hashes) {
    if (typeof h !== 'string' || h.length !== target.length) continue
    let diff = 0
    for (let i = 0; i < target.length; i++) diff |= target.charCodeAt(i) ^ h.charCodeAt(i)
    if (diff === 0) matched = true
  }
  return matched
}
