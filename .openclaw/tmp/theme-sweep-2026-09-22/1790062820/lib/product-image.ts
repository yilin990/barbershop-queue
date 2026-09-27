/**
 * 商品占位图生成器 — 0-1 阶段 SVG 程序化方案
 *
 * 设计原则:
 * - 按 categoryLabel / categoryCode 分组配色（同一类目色相近）
 * - 中心放 emoji
 * - 下方写商品名首 6 字
 * - 256x256 正方形，1:1 aspect，能直接配 css object-fit
 *
 * 奕霖 2026-09-06 升级：医药商城 → 果蔬鲜生
 * PALETTE 0701-0709 全部覆盖鲜生类目，FALLBACK 也从 💊 改 🥬
 */

interface ProductForSvg {
  name: string
  shortName?: string | null
  category?: string | null
  categoryLabel?: string | null
  dosage?: string | null
}

// 分类 → { 背景色, 主色, 软色, emoji }
const PALETTE: Record<string, { bg: string, main: string, soft: string, emoji: string }> = {
  // 0701-0709: 果蔬店主分类（奕霖 2026-09-06 升级）
  '0701': { bg: '#e8f5e9', main: '#2e7d32', soft: 'rgba(46,125,50,0.08)', emoji: '🍎' },   // 时令水果
  '0702': { bg: '#fff3e0', main: '#e65100', soft: 'rgba(230,81,0,0.08)', emoji: '🥬' },   // 新鲜蔬菜
  '0703': { bg: '#fffde7', main: '#f9a825', soft: 'rgba(249,168,37,0.08)', emoji: '🌽' }, // 米面粮油
  '0704': { bg: '#fce4ec', main: '#c2185b', soft: 'rgba(194,24,91,0.08)', emoji: '🥩' },  // 肉禽蛋品
  '0705': { bg: '#e0f7fa', main: '#00838f', soft: 'rgba(0,131,143,0.08)', emoji: '🐟' },  // 海鲜水产
  '0706': { bg: '#f3e5f5', main: '#6a1b9a', soft: 'rgba(106,27,154,0.08)', emoji: '🧀' },  // 奶制品
  '0707': { bg: '#efebe9', main: '#5d4037', soft: 'rgba(93,64,55,0.08)', emoji: '🍵' },   // 茶饮零食
  '0708': { bg: '#fff8e1', main: '#f57c00', soft: 'rgba(245,124,0,0.08)', emoji: '🥜' },  // 坚果干货
  '0709': { bg: '#e0f2f1', main: '#00695c', soft: 'rgba(0,105,92,0.08)', emoji: '🌿' },   // 调味品

  // 0101-0119: 医药商城 fallback（保留兼容）
  '0101': { bg: '#fdecea', main: '#c62828', soft: 'rgba(198,40,40,0.08)',  emoji: '❤️' },
  '0102': { bg: '#e8f5e9', main: '#2e7d32', soft: 'rgba(46,125,50,0.08)', emoji: '💚' },
  '0103': { bg: '#e3f2fd', main: '#1565c0', soft: 'rgba(21,101,192,0.08)',emoji: '🫁' },
  '0104': { bg: '#e8eaf6', main: '#283593', soft: 'rgba(40,53,147,0.08)', emoji: '🛡️' },
  '0105': { bg: '#e0f7fa', main: '#00838f', soft: 'rgba(0,131,143,0.08)', emoji: '🌿' },
  '0106': { bg: '#fce4ec', main: '#ad1457', soft: 'rgba(173,20,87,0.08)', emoji: '🌸' },
  '0107': { bg: '#fff8e1', main: '#f57c00', soft: 'rgba(245,124,0,0.08)', emoji: '🧒' },
  '0108': { bg: '#f3e5f5', main: '#6a1b9a', soft: 'rgba(106,27,154,0.08)',emoji: '🦴' },
  '0109': { bg: '#fff3e0', main: '#e65100', soft: 'rgba(230,81,0,0.08)', emoji: '🍯' },
  '0110': { bg: '#fce4ec', main: '#c2185b', soft: 'rgba(194,24,91,0.08)', emoji: '🧴' },
  '0111': { bg: '#efebe9', main: '#5d4037', soft: 'rgba(93,64,55,0.08)', emoji: '🌱' },
  '0112': { bg: '#e0f2f1', main: '#00695c', soft: 'rgba(0,105,92,0.08)', emoji: '💊' },
  '0113': { bg: '#ffebee', main: '#b71c1c', soft: 'rgba(183,28,28,0.08)', emoji: '🩹' },
  '0114': { bg: '#ffe0b2', main: '#e65100', soft: 'rgba(230,81,0,0.08)', emoji: '🗣️' },
  '0115': { bg: '#e1f5fe', main: '#0277bd', soft: 'rgba(2,119,189,0.08)', emoji: '👁️' },
  '0116': { bg: '#e3f2fd', main: '#1976d2', soft: 'rgba(25,118,210,0.08)',emoji: '🧼' },
  '0117': { bg: '#fffde7', main: '#f9a825', soft: 'rgba(249,168,37,0.08)', emoji: '🦴' },
  '0118': { bg: '#f1f8e9', main: '#558b2f', soft: 'rgba(85,139,47,0.08)', emoji: '🥬' },
  '0119': { bg: '#eceff1', main: '#455a64', soft: 'rgba(69,90,100,0.08)', emoji: '🧴' },

  // 0201-0601: 其他编码 → 鲜生默认
  '0201': { bg: '#e8f5e9', main: '#2e7d32', soft: 'rgba(46,125,50,0.08)', emoji: '🍎' },
  '0301': { bg: '#fff3e0', main: '#e65100', soft: 'rgba(230,81,0,0.08)', emoji: '🥬' },
  '0501': { bg: '#e0f7fa', main: '#00838f', soft: 'rgba(0,131,143,0.08)', emoji: '🐟' },
  '0502': { bg: '#e0f7fa', main: '#00838f', soft: 'rgba(0,131,143,0.08)', emoji: '🐟' },
  '0601': { bg: '#fffde7', main: '#f9a825', soft: 'rgba(249,168,37,0.08)', emoji: '🌽' },
}

// 分类标签 → 编码
const LABEL_TO_CODE: Record<string, string> = {
  // 果蔬店优先
  '时令水果': '0701',
  '热带水果': '0701',
  '浆果类': '0701',
  '柑橘类': '0701',
  '新鲜蔬菜': '0702',
  '叶菜类': '0702',
  '根茎类': '0702',
  '瓜果类': '0702',
  '米面粮油': '0703',
  '粮油副食': '0703',
  '肉禽蛋品': '0704',
  '禽蛋类': '0704',
  '海鲜水产': '0705',
  '海鲜': '0705',
  '奶制品': '0706',
  '乳制品': '0706',
  '茶饮零食': '0707',
  '坚果干货': '0708',
  '调味品': '0709',
  '香料': '0709',

  // 医药 fallback
  '感冒咳嗽': '0105',
  '儿科感冒咳嗽': '0107',
  '皮肤外用': '0110',
  '风湿骨痛': '0108',
  '日用品': '0119',
  '抗感染消炎': '0104',
  '医疗器械': '0501',
  '食品营养': '0601',
  '清热解毒': '0104',
  '心血管降压': '0101',
  '消毒用品': '0116',
  '消化肝胆': '0118',
  '补肾滋补': '0109',
  '五官眼科': '0115',
  '咽喉口腔': '0114',
  '补钙营养': '0117',
  '胃肠道': '0118',
  '妇科用药': '0106',
  '痔疮肛肠': '0113',
  '糖尿病用药': '0101',
  '中药饮片-根茎': '0111',
}

const FALLBACK = { bg: '#e8f5e9', main: '#2e7d32', soft: 'rgba(46,125,50,0.08)', emoji: '🥬' }

function pickColor(category?: string | null, categoryLabel?: string | null) {
  if (category && PALETTE[category]) return PALETTE[category]
  if (categoryLabel && LABEL_TO_CODE[categoryLabel]) {
    return PALETTE[LABEL_TO_CODE[categoryLabel]] || FALLBACK
  }
  return FALLBACK
}

function shortName(p: ProductForSvg): string {
  // 1) 优先 shortName，2) name 去 emoji/括号取前 6 字
  const raw = (p.shortName || p.name || '').trim()
  // 去括号内容：厄瓜多尔白虾(1.8kg) → 厄瓜多尔白虾
  const noParen = raw.replace(/[\(（][^\)）]*[\)）]/g, '').trim()
  // 去前缀 emoji（奕霖 2026-09-06 修复：商品名前污染的 🍤 🥬 等等）
  const noEmoji = noParen.replace(/[\u{1F300}-\u{1FAFF}\u{1F000}-\u{1F9FF}\u{2600}-\u{27BF}]/gu, '').trim()
  return Array.from(noEmoji).slice(0, 6).join('') || '鲜生好物'
}

export function generateProductSvg(p: ProductForSvg): string {
  const color = pickColor(p.category, p.categoryLabel)
  const name = shortName(p)

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${color.bg}" stop-opacity="1"/>
      <stop offset="100%" stop-color="${color.bg}" stop-opacity="0.55"/>
    </linearGradient>
    <radialGradient id="r" cx="35%" cy="30%" r="65%">
      <stop offset="0%" stop-color="${color.main}" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="${color.main}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="256" height="256" rx="24" fill="url(#g)"/>
  <rect width="256" height="256" rx="24" fill="url(#r)"/>
  <text x="128" y="135" font-size="98" text-anchor="middle" dominant-baseline="middle">${color.emoji}</text>
  <rect x="0" y="180" width="256" height="76" rx="0" fill="${color.main}" fill-opacity="0.08"/>
  <text x="128" y="220" font-size="22" font-weight="600" text-anchor="middle" fill="${color.main}" font-family="system-ui, -apple-system, 'PingFang SC', sans-serif" letter-spacing="1">${escape(name)}</text>
</svg>`
}

function escape(s: string) {
  return s
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
}
