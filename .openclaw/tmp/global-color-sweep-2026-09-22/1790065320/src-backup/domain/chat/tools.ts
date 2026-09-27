// Chat tool detection - determine if user message needs weather/location/store tools

export interface ToolResult {
  tool: 'weather' | 'location' | 'store' | 'navigation'
  data: unknown
}

// Weather keywords
const WEATHER_KEYWORDS = [
  '天气', '气温', '温度', '下雨', '下雪', '晴天', '多云', '阴天',
  '热不热', '冷不冷', '会下雨吗', '要不要带伞', '紫外线',
  '今天热', '明天热', '这几天', '最近天气',
]

// Location/Store keywords
const LOCATION_KEYWORDS = [
  '哪里', '在哪', '地址', '门店', '位置', '离我', '距离',
  '怎么走', '导航', '走路', '开车', '过来', '附近',
  '你们店', '你们药房', '你们那', '你家',
]

// Navigation keywords
const NAV_KEYWORDS = [
  '带我去', '导航到', '给我导航', '怎么去', '路线',
]

export interface DetectedIntent {
  type: 'weather' | 'location' | 'store' | 'navigation' | 'none'
  query: string
  confidence: number // 0-1
}

// Detect if user message triggers any tool
export function detectToolIntent(message: string): DetectedIntent {
  const lower = message.toLowerCase()

  // Check navigation first (most specific)
  for (const kw of NAV_KEYWORDS) {
    if (lower.includes(kw)) {
      return { type: 'navigation', query: message, confidence: 0.9 }
    }
  }

  // Check weather
  for (const kw of WEATHER_KEYWORDS) {
    if (lower.includes(kw)) {
      return { type: 'weather', query: message, confidence: 0.85 }
    }
  }

  // Check location/store
  for (const kw of LOCATION_KEYWORDS) {
    if (lower.includes(kw)) {
      return { type: 'location', query: message, confidence: 0.8 }
    }
  }

  return { type: 'none', query: message, confidence: 0 }
}

// Check if message likely needs store info
export function needsStoreInfo(message: string): boolean {
  const lower = message.toLowerCase()
  const storeKeywords = ['你们', '店里', '门店', '药房', '在哪', '地址', '电话', '营业']
  return storeKeywords.some(kw => lower.includes(kw))
}

// Extract city from message (for weather)
export function extractCity(message: string): string | null {
  // Pattern: "XX天气" / "XX的温度"
  const patterns = [
    /(\S+?)天气/,
    /(\S+?)的温度/,
    /(\S+?)热不热/,
    /(\S+?)冷不冷/,
    /在(\S+?)天气/,
  ]

  for (const pattern of patterns) {
    const match = message.match(pattern)
    if (match && match[1]) {
      const city = match[1].trim()
      // Ignore generic words
      if (city.length >= 2 && !['今天', '明天', '后天', '这几天', '最近'].includes(city)) {
        return city
      }
    }
  }

  return null // default to 铜仁
}

// Format store info for chat
export function formatStoreInfo(): string {
  return `果蔬鲜生（附小）地址：贵州省铜仁市碧江区环北清水大道清水花园一栋1单元10-11号，电话：13721566882，营业时间：08:00 - 23:30。`
}

// Format distance reply for chat
export function formatDistanceReply(distanceKm: number, fromAddress?: string): string {
  const storeAddress = '铜仁市碧江区清水大道清水花园'
  if (distanceKm < 0.2) {
    return `离你很近！果蔬鲜生就在${storeAddress}，走路几分钟就到~`
  } else if (distanceKm < 1) {
    return `大概${Math.round(distanceKm * 1000)}米，步行${Math.round(distanceKm * 12)}分钟左右。果蔬鲜生在${storeAddress}。`
  } else {
    return `离你大约${distanceKm.toFixed(1)}公里，在${storeAddress}。过来大概需要${Math.round(distanceKm * 12)}分钟。`
  }
}