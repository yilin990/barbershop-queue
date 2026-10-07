// ⭐ v1.1.47 奕霖立：服务分类映射（订单页 + 我的卡页共用同一套规则）
//
// 为什么要这个模块：
//   BarberQueue.service 存的是简称（「剪发」「烫发」）
//   Service.name        存的是全名（「基础剪发」「冷烫」）
//   两者 JOIN 不上 —— 所以订单分类只能靠关键词映射，不能走 SQL JOIN。
//   好在简称取值很干净（剪发/烫发/造型/染发），映射无歧义。
//
// ⚠️ 两页各写一套分类规则必然漂移（改了订单忘了改卡页），所以收敛到这里。

export type ServiceCategory = 'cut' | 'dye' | 'perm' | 'care' | 'style'

export const SERVICE_CATEGORY_META: Record<ServiceCategory, { label: string; icon: string }> = {
  cut:   { label: '理发', icon: '✂️' },
  dye:   { label: '染发', icon: '🎨' },
  perm:  { label: '烫发', icon: '🔥' },
  care:  { label: '护发', icon: '💧' },
  style: { label: '造型', icon: '💫' },
}

// 顺序敏感：先匹配到的赢。
//   「烫」必须排在「剪」前面 ——「冷烫」既含「烫」又不该落到剪发
//   「护理」排在「剪」前面 ——「基础护理」不该被当成剪发
const RULES: Array<{ key: ServiceCategory; words: string[] }> = [
  { key: 'perm',  words: ['烫'] },
  { key: 'dye',   words: ['染'] },
  { key: 'care',  words: ['护理', '养发', '修护'] },
  { key: 'style', words: ['造型'] },
  { key: 'cut',   words: ['剪', '洗'] },
]

/** 服务名 → 分类。认不出来返回 null（调用方决定归到「其他」还是不过滤） */
export function resolveServiceCategory(name?: string | null): ServiceCategory | null {
  if (!name) return null
  const s = String(name)
  for (const r of RULES) {
    for (const w of r.words) {
      if (s.indexOf(w) >= 0) return r.key
    }
  }
  return null
}

/** 分类 → 展示文案（认不出来的分类回落到「其他」，不吞掉数据） */
export function serviceCategoryLabel(cat?: string | null): string {
  if (!cat) return '其他'
  const m = SERVICE_CATEGORY_META[cat as ServiceCategory]
  return m ? m.label : '其他'
}

export function serviceCategoryIcon(cat?: string | null): string {
  if (!cat) return '📦'
  const m = SERVICE_CATEGORY_META[cat as ServiceCategory]
  return m ? m.icon : '📦'
}