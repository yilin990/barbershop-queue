/**
 * 紧急关键词共享模块
 *
 * 为什么共享：之前 后端 (api/chat/route.ts) 与前端 (EmergencyAlert.tsx)
 * 各有一份独立的 EMERGENCY_KEYWORDS 列表（14 vs 30+ 词），不一致导致：
 *   - 用户说"持续高烧" → 前端飘红急救卡 + 后端 isEmergency=0
 *   - 老板后台看不到紧急对话 → 危机响应延迟
 *
 * 一次抽取，前后端统一 import。
 *
 * 名单覆盖（按人体系统分类）：
 *   心血管 / 呼吸 / 出血 / 意识 / 过敏 / 中毒 / 神经 / 急腹 / 创伤 / 其他
 */

export const EMERGENCY_KEYWORDS: readonly string[] = [
  // 心血管急症
  '胸痛',
  '胸口疼',
  '胸闷',
  '心绞痛',
  '心肌梗塞',
  '心梗',
  // 呼吸急症
  '呼吸困难',
  '喘不过气',
  '窒息',
  '严重气短',
  // 出血急症
  '咳血',
  '吐血',
  '大出血',
  '便血',
  // 意识障碍
  '晕倒',
  '昏迷',
  '失去意识',
  '抽搐',
  '癫痫发作',
  // 严重过敏
  '过敏性休克',
  '严重过敏',
  '喉头水肿',
  // 中毒
  '中毒',
  '药物过量',
  '服毒',
  // 神经急症
  '中风',
  '脑梗',
  '脑出血',
  '偏瘫',
  '言语不清',
  // 急腹症
  '剧烈腹痛',
  '急腹症',
  // 严重创伤
  '车祸',
  '严重外伤',
  '骨折',
  '头部外伤',
  // 其他急症
  '高烧不退',
  '持续高烧',
  '体温 40',
  '体温40',
  '41度',
  '自杀',
  '想死',
]

/**
 * 检测文本中是否包含紧急关键词
 * 返回首个命中的关键词，便于后续提示"您提到「xxx」"
 * 不区分大小写
 */
export function detectEmergencyKeyword(text: string | null | undefined): string | null {
  if (!text) return null
  const lower = text.toLowerCase()
  for (const kw of EMERGENCY_KEYWORDS) {
    if (lower.includes(kw.toLowerCase())) return kw
  }
  return null
}

/**
 * 紧急话术（统一前后端文案）
 * 用户 + AI 药师 + 急救卡 共用
 */
export const EMERGENCY_HEADLINES = {
  /** 顶部急救浮条标题 */
  bannerTitle: '症状可能严重，请立即就医！',
  /** AI 药师直接接管回复 */
  aiHeadline: '⚠️ 您描述的症状可能比较紧急，请立即就医！',
  /** 急救卡底部行动提示 */
  actionHint: '请立即拨打 120 或前往最近的医院急诊',
} as const
