/**
 * 时间工具（统一 Asia/Shanghai）
 * 2026-07-15 奕霖要求：SaaS 所有时间必须用北京时间（UTC+8）
 */

const TZ = 'Asia/Shanghai'

/**
 * 获取当前北京时间
 */
export function nowShanghai(): Date {
  // 系统时区必须是 Asia/Shanghai（Node 启动时检查）
  if (Intl.DateTimeFormat().resolvedOptions().timeZone !== TZ) {
    console.warn(`[time] Node 时区是 ${Intl.DateTimeFormat().resolvedOptions().timeZone}，不是 ${TZ}`)
  }
  return new Date()
}

/**
 * 格式化为北京时间字符串（ISO 8601 + +08:00）
 */
export function shanghaiISO(d: Date | string | number = nowShanghai()): string {
  const date = typeof d === 'string' || typeof d === 'number' ? new Date(d) : d
  // toLocaleString 在 Asia/Shanghai 时区
  const offset = '+08:00'
  const pad = (n: number, len = 2) => n.toString().padStart(len, '0')
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}${offset}`
  )
}

/**
 * 友好显示（如 "今天 14:30" / "昨天 09:15" / "2026-07-14 16:21"）
 */
export function shanghaiFriendly(d: Date | string | number = nowShanghai()): string {
  const date = typeof d === 'string' || typeof d === 'number' ? new Date(d) : d
  const now = nowShanghai()
  const sameDay = date.toDateString() === now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday = date.toDateString() === yesterday.toDateString()

  const pad = (n: number) => n.toString().padStart(2, '0')
  const hm = `${pad(date.getHours())}:${pad(date.getMinutes())}`

  if (sameDay) return `今天 ${hm}`
  if (isYesterday) return `昨天 ${hm}`
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${hm}`
}

/**
 * 当前时间上下文（注入 AI 系统 prompt）
 */
export function getCurrentTimeContext(): string {
  const now = nowShanghai()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const day = now.getDate()
  const hour = now.getHours()
  const minute = now.getMinutes()
  const weekday = ['日', '一', '二', '三', '四', '五', '六'][now.getDay()]

  let timeOfDay = '上午'
  if (hour >= 11 && hour < 14) timeOfDay = '中午'
  else if (hour >= 14 && hour < 18) timeOfDay = '下午'
  else if (hour >= 18 && hour < 22) timeOfDay = '晚上'
  else if (hour >= 22 || hour < 6) timeOfDay = '深夜'

  return `【【【实时时间（重要）】】】
当前北京时间（UTC+8）：${year}年${month}月${day}日 星期${weekday} ${timeOfDay} ${hour}:${minute.toString().padStart(2, '0')}

⚠️ 重要规则：
- 用户问"几点了" / "今天几号" / "星期几" / "上午还是下午"，**必须用上面这个北京时间回答**
- **绝对不要瞎编时间、日期、星期**
- **不要因为是下午/晚上就说"晚安"**（用户没说告别，你不要主动结束）
- 如果用户说"晚安"或"再见"，才说晚安
- 回答时间时标注"北京时间"，避免用户困惑
`
}