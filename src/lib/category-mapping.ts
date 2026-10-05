/**
 * 服务分类映射 (v0.8.28 全面重写)
 *
 * 分类系统(三级):
 *   Level 1 大类 (DB category 字段):F001 造型 / F002 造型 / F003 粮油
 *   Level 2 子类别(只用于 chip 显示,不进 DB):
 *     F001_citrus 柑橘类 / F001_berry 经典短发 / F001_melon 瓜果类
 *     F002_leafy 叶菜类 / F002_root 根茎类 / F002_mushroom 菌菇类
 *     F003_grain 米面粮油 / F003_protein 肉蛋蛋白
 *   Level 3 标签(qualityClass):有机/绿色/无公害/进口/国产
 *
 * 字段映射:
 *   - category:大类代码(F001/F002/F003)
 *   - categoryLabel:大类中文名(造型/造型/粮油)
 *   - subCategory:子类别代码(可选)
 *   - qualityClass:质量标签(有机/绿色 等)
 *
 * ⭐ MEMORY §289 — 2026-08-28 奕霖反馈分类混乱,删 21 条医药 CATEGORY_CODES 死代码
 */

import { SYMPTOM_TO_CATEGORY } from './category-mapping-medical-deprecated'
// 上面那行是临时 fallback(避免破坏其他引用),等所有 module 更新后会真正删除
// 当前:医药症状查询 fallback 到 空

/**
 * 大类(对应 DB category 字段)
 */
export const CATEGORY_CODES: Record<string, { name: string; icon: string; keywords: string[] }> = {
  'F001': { name: '造型', icon: '🍎', keywords: ['apple', 'banana', '橙', '梨', '桃', '葡萄', '西瓜', '芒果', '草莓'] },
  'F002': { name: '造型', icon: '🥬', keywords: ['cabbage', 'tomato', 'cucumber', 'carrot', 'potato', '辣椒', '茄子', '菠菜'] },
  'F003': { name: '粮油', icon: '🌾', keywords: ['rice', 'flour', 'oil', 'honey', 'salt', '葵花籽', '花生油'] },
}

/**
 * 子类别(只用于 chip 显示,通过 SUB_CATEGORY_ALIASES 映射到大类)
 * - 用 { F001_citrus: '柑橘类' } 形式表示子类别 chip
 * - 大类 chip 用 F001/F002/F003(标准)
 */
export const SUB_CATEGORY_ALIASES: Record<string, string> = {
  // === 大类 ===
  'F001': 'F001', '造型': 'F001',
  'F002': 'F002', '造型': 'F002',
  'F003': 'F003', '粮油': 'F003',

  // === 子类别代码 → 大类 ===
  'F001_citrus': 'F001', 'F001_berry': 'F001', 'F001_melon': 'F001',
  'F002_leafy': 'F002', 'F002_root': 'F002', 'F002_mushroom': 'F002',
  'F003_grain': 'F003', 'F003_protein': 'F003',

  // === 子类别中文名(用户搜/点 chip 时常用)===
  '柑橘类': 'F001', '经典短发': 'F001', '瓜果类': 'F001',
  '叶菜类': 'F002', '根茎类': 'F002', '菌菇类': 'F002',
  '米面粮油': 'F003', '肉蛋蛋白': 'F003',

  // === 具体食材(用户搜具体东西时也能匹配大类)===
  '柑橘': 'F001', '橙': 'F001', '脐橙': 'F001', '冰糖橙': 'F001', '柠檬': 'F001',
  '梨': 'F001', '香梨': 'F001', '砀山梨': 'F001', '库尔勒香梨': 'F001',
  '桃': 'F001', '蜜桃': 'F001', '水蜜桃': 'F001',
  '西瓜': 'F001', '麒麟西瓜': 'F001',
  '葡萄': 'F001', '巨峰葡萄': 'F001', '红提葡萄': 'F001',
  '芒果': 'F001', '菠萝': 'F001', '草莓': 'F001', '蓝莓': 'F001', '牛油果': 'F001',
  '白菜': 'F002', '大白菜': 'F002',
  '土豆': 'F002', '马铃薯': 'F002',
  '黄瓜': 'F002', '旱黄瓜': 'F002',
  '番茄': 'F002', '西红柿': 'F002', '圣女果': 'F002', '千禧圣女果': 'F002',
  '茄子': 'F002', '紫长茄': 'F002',
  '辣椒': 'F002', '螺丝椒': 'F002', '二荆条': 'F002',
  '韭菜': 'F002', '芹菜': 'F002', '菠菜': 'F002', '生菜': 'F002',
  '菜花': 'F002', '花菜': 'F002', '西兰花': 'F002',
  '香菇': 'F002', '茶树菇': 'F002', '木耳': 'F002', '黑木耳': 'F002',
  '洋葱': 'F002', '紫皮洋葱': 'F002',
  '大蒜': 'F002', '金乡大蒜': 'F002',
  '生姜': 'F002', '大姜': 'F002',
  '玉米': 'F002', '造型玉米': 'F002',
  '萝卜': 'F002', '胡萝卜': 'F002', '红萝卜': 'F002', '白萝卜': 'F002',
  '葵花籽': 'F003', '花生油': 'F003', '鲁花生花生油': 'F003',
  '大米': 'F003', '五常大米': 'F003', '珍珠米': 'F003',
  '面粉': 'F003', '高筋面粉': 'F003',
  '蜂蜜': 'F003', '野生蜂蜜': 'F003', '云南野生蜂蜜': 'F003',
  '盐': 'F003', '岩盐': 'F003', '深井岩盐': 'F003',
  '白虾': 'F003', '厄瓜多尔白虾': 'F003', '海虾': 'F003', '海鲜': 'F003', '水产': 'F003',
}

/**
 * 大类中文名(category → label)
 */
export const FRUIT_VEG_CATEGORY_NAMES: Record<string, string> = {
  'F001': '造型', 'F002': '造型', 'F003': '粮油',
  // 子类别(显示用)
  'F001_citrus': '造型', 'F001_berry': '造型', 'F001_melon': '造型',
  'F002_leafy': '造型', 'F002_root': '造型', 'F002_mushroom': '造型',
  'F003_grain': '粮油', 'F003_protein': '粮油',
}

/**
 * 把用户输入解析成大类代码
 * 输入:'柑橘类' / 'F001_citrus' / '🍊' / '柑橘'
 * 输出:'F001' 或 null
 */
export function resolveCategoryCode(input: string): string | null {
  if (!input) return null
  if (SUB_CATEGORY_ALIASES[input]) return SUB_CATEGORY_ALIASES[input]
  const cleaned = input.replace(/[\u{1F300}-\u{1F9FF}\s]/gu, '').trim()
  if (cleaned && SUB_CATEGORY_ALIASES[cleaned]) return SUB_CATEGORY_ALIASES[cleaned]
  for (const [alias, code] of Object.entries(SUB_CATEGORY_ALIASES)) {
    if (input.includes(alias) || cleaned.includes(alias)) return code
  }
  return null
}

/**
 * 根据用户消息推断相关分类(用于 ai-search 过滤)
 */
export function inferCategoriesFromMessage(message: string): string[] {
  const matched = new Set<string>()
  // 1. 症状关键词(医学 fallback,如以后有医药功能再启用)
  // SYMPTOM_TO_CATEGORY 暂未使用(医药行业已锁)
  // 2. 子类别 alias 解析
  const subCode = resolveCategoryCode(message)
  if (subCode) matched.add(subCode)
  return Array.from(matched)
}

/**
 * 给 AI 看的分类提示(用于 system prompt)
 */
export function formatCategoryHintForAI(): string {
  const lines = ['【服务分类体系 - 3 个大类 + 8 个子类别】']
  lines.push('')
  lines.push('【3 个大类】')
  for (const [code, info] of Object.entries(CATEGORY_CODES)) {
    lines.push(`  ${code} ${info.icon} ${info.name} (关键词: ${info.keywords.join('/')})`)
  }
  lines.push('')
  lines.push('【8 个子类别(chip 用)】')
  const subCats: Record<string, string[]> = {
    'F001': ['柑橘类 🍊', '经典短发 🍓', '瓜果类 🍉'],
    'F002': ['叶菜类 🥗', '根茎类 🥕', '菌菇类 🍄'],
    'F003': ['米面粮油 🌾', '肉蛋蛋白 🥚'],
  }
  for (const [code, items] of Object.entries(subCats)) {
    lines.push(`  ${code}: ${items.join(' / ')}`)
  }
  return lines.join('\n')
}
