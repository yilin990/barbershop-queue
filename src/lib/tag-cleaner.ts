/**
 * 标签清洗工具
 * 解决 functionTags 数据脏问题：
 * - 去重（"造型"/"精剪造型"/"时令鲜果" → 只留 1 个）
 * - 去格式噪音（多余空格、引号、emoji 前缀重复）
 * - 剔除其他商品的标签（同品类 LLM 把所有商品名都列了）
 * - 限制显示 3-5 个核心标签
 */

/**
 * 归一化标签用于去重比较
 * - 全部小写
 * - 去掉前导 emoji
 * - 去掉尾部 "X 类别" 后缀（"山东土豆 造型" → "山东土豆"）
 */
function normalize(t: string): string {
  return t
    .toLowerCase()
    .replace(/^[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}]+/u, '')
    .replace(/\s+(造型|造型|粮油|生鲜|肉蛋|时令)$/u, '')
    .trim()
}

const EMOJI_RE = /^[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}]+/u

/**
 * 解析 functionTags 字符串为数组
 */
function parseTags(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.map((s: any) => String(s))
    return [String(parsed)]
  } catch {
    // fallback: 按常见分隔符切
    return raw.split(/[、,，/]/).map(s => s.trim()).filter(Boolean)
  }
}

/**
 * 清洗商品标签 - 返回 maxTags 个干净的核心标签
 * 
 * 策略：
 * 1. 解析 JSON 数组
 * 2. 去掉前导 emoji 后的纯空白 / 空标签
 * 3. 识别"本商品的标签" vs "其他商品的标签"：
 *    - 含本商品名称片段（去除 emoji 后）→ 保留
 *    - 含 emoji + 较长名称（其他商品名）→ 剔除
 * 4. 归一化去重（"染护套餐" vs "造型" → 只留 1 个）
 * 5. 优先品类标签（1个）+ 特色标签（2-3个）
 */
export function cleanProductTags(
  product: { name: string; categoryLabel?: string | null },
  maxTags = 4
): string[] {
  const rawTags = parseTags(product.functionTags as any)
  if (rawTags.length === 0) return []

  // 本商品名称片段（去掉 emoji 和空格）
  const myName = product.name || ''
  const myNameClean = myName.replace(EMOJI_RE, '').replace(/\s+/g, '').trim()
  // 商品名的前 2-3 个字（防止"阿克苏冰糖心苹果"匹配只含"苹果"的标签）
  const myNamePrefixes = [
    myNameClean.slice(0, 4),
    myNameClean.slice(0, 3),
    myNameClean.slice(0, 2),
  ].filter(p => p.length >= 2)

  // 第一步：清洗 + 判断是否本商品的标签
  const enriched = rawTags.map(t => {
    const clean = t.replace(/^["']|["']$/g, '').trim()
    const isMine = myNamePrefixes.some(prefix => 
      clean.replace(EMOJI_RE, '').includes(prefix)
    )
    return { raw: t, clean, isMine }
  })

  // 第二步：分类
  // A. 本商品的标签（保留，可去重）
  // B. 通用类目标签（"造型"/"精剪造型"/"时令鲜果"等）
  // C. 其他商品的标签（剔除）

  const myTags: string[] = [] // 本商品相关
  const genericTags: string[] = [] // 通用类目

  for (const e of enriched) {
    if (!e.clean) continue
    
    if (e.isMine) {
      myTags.push(e.clean)
    } else {
      // 通用标签 - 通常是短的类目词（≤6字，且包含常见类目词）
      if (e.clean.length <= 6 && /造型|造型|粮油|生鲜|时令|新鲜/.test(e.clean)) {
        genericTags.push(e.clean)
      }
      // 其他商品的标签：直接跳过
    }
  }

  // 第三步：去重（归一化比较）
  const seen = new Set<string>()
  const result: string[] = []

  function pushUnique(arr: string[]) {
    for (const t of arr) {
      const n = normalize(t)
      if (!n || seen.has(n)) continue
      seen.add(n)
      result.push(t)
    }
  }

  // 顺序：本商品标签（最重要）→ 通用类目
  pushUnique(myTags)
  pushUnique(genericTags)

  // 第四步：限制数量
  return result.slice(0, maxTags)
}
