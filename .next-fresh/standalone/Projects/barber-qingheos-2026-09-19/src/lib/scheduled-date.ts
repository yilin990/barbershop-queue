/**
 * 预约日期（scheduledDate）三档口径 —— v1.1.65 清禾 2026-10-28
 *
 * 背景 bug：「后天」预约被写成「明天」
 *   - 发送端 BookingSection 的 dateKey→scheduledDate 映射把 'dayAfter' 降级成 'tomorrow'
 *   - onSuccess 类型签名只允许 'today' | 'tomorrow'，类型层面就把 dayAfter 排除了
 *   - 落库 BarberQueue.scheduledDate 后，商家端读取端也只认 today/tomorrow 两档 → 后天单看不见
 *
 * 本文件把三档口径集中到一处（纯函数，不碰数据库）：
 *   - ScheduledDateKey：合法三档
 *   - scheduledDateLabel()：档位 → 中文标签（商家端列表 / 顾客端卡片用）
 *   - dateKeyToActual()：档位 → 实际 YYYY-MM-DD（Asia/Shanghai）
 *
 * 注意：dateKeyToActual 与 src/app/(user)/orders/page.tsx 里的同名函数完全同口径
 *      （接收端逻辑是对的，不要改那边）。
 */

/** 预约日期三档 */
export type ScheduledDateKey = 'today' | 'tomorrow' | 'dayAfter'

/** 合法档位列表 */
export const SCHEDULED_DATE_KEYS: ScheduledDateKey[] = ['today', 'tomorrow', 'dayAfter']

/** 档位 → 中文标签 */
export const SCHEDULED_DATE_LABELS: Record<ScheduledDateKey, string> = {
  today: '今天',
  tomorrow: '明天',
  dayAfter: '后天',
}

/**
 * 档位 → 中文标签。未知/空值返回 ''（调用方自行决定要不要渲染）。
 * 例：scheduledDateLabel('dayAfter') === '后天'
 */
export function scheduledDateLabel(key?: string | null): string {
  if (!key) return ''
  return SCHEDULED_DATE_LABELS[key as ScheduledDateKey] || ''
}

/**
 * 档位 → 实际日期 YYYY-MM-DD（Asia/Shanghai 口径，不能用 toISOString 直接取，
 *      UTC 会比上海晚 8 小时，上海凌晨 0-8 点会算成昨天）。
 * 'tomorrow' → 今天 +1 天；'dayAfter' → 今天 +2 天；其它值（已是 YYYY-MM-DD）原样返回。
 */
export function dateKeyToActual(key?: string | null): string {
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' })
  if (key === 'today') return today
  if (key === 'tomorrow' || key === 'dayAfter') {
    const d = new Date(today + 'T00:00:00Z')
    d.setUTCDate(d.getUTCDate() + (key === 'tomorrow' ? 1 : 2))
    return d.toISOString().slice(0, 10)
  }
  return key || today
}
