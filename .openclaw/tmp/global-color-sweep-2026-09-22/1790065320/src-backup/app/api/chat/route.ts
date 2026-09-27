// ---------------------------------------------------------------------------
// Tool Detection & Fetch (inline, no external imports to avoid Next.js issues)
// ---------------------------------------------------------------------------
import { maybeGenerateOrderCards } from '@/lib/ai-cards'
import { executeTool, AI_TOOLS, type ToolDefinition } from '@/lib/ai-tools'
import { prisma } from '@/lib/db'
import { saveChatLog } from '@/lib/chat-log'
import { formatCategoryHintForAI } from '@/lib/category-mapping'
import { getCurrentTimeContext } from '@/lib/time'
import { getCachedChatReply, setCachedChatReply } from '@/lib/semantic-cache'
import { getMemoryFacts, formatFactsForAI } from '@/lib/user-memory'

// ---------------------------------------------------------------------------
// 真 AI 造型师 v1.0 (2026-09-20 01:04 奕霖立项：理发 SaaS 改造)
//   - 起源：芝林药店 AI 药师 v2.0 (2026-07-13 00:39)
//   - 改造：造型师助手（铜仁碧江区店）· qingheos 第一单熟人理发店
//   - 核心场景：30 秒推荐发型 + 60 天复购提醒
//   - AI prompt 已经在 SYSTEM_PROMPT 里改造为造型师（不是药师）
//   - 此处只改历史注释标签 + 行业元信息
// ---------------------------------------------------------------------------

/** 把 AI_TOOLS 转换成 Anthropic API 期望的格式（input_schema 字段名） */
function formatToolsForAnthropic(): Array<{
  name: string
  description: string
  input_schema: { type: 'object'; properties: Record<string, any>; required: string[] }
}> {
  return AI_TOOLS.map((t: ToolDefinition) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema,
  }))
}

/** 工具执行结果累积器 */
interface ToolRunRecord {
  name: string
  success: boolean
  data?: any
  error?: string
  tool_use_id?: string
}

/** 处理单个 tool_use 块：执行工具 + 返回 tool_result 内容 */
async function executeToolUse(
  toolName: string,
  toolInput: any,
  resolvedPhone?: string
): Promise<{ toolResultContent: string; record: ToolRunRecord; cards?: any[] }> {
  // 需要 phone 的工具强制用后端 phone（不管 LLM 给什么，都覆盖）
  // 防止 LLM 把 system prompt 的提示词当成指令，导致 phone 填错
  let input = toolInput || {}
  // ⭐ MEMORY 2026-08-25 — 加 add_user_need: AI 经常编假 phone, 必须后端强制覆盖
const phoneTools = ['create_order', 'query_orders', 'cancel_order', 'add_user_need']
  if (phoneTools.includes(toolName) && resolvedPhone) {
    input = { ...input, phone: resolvedPhone }
  }

  const result = await executeTool(toolName, input)
  const cards = (result as any).cards || []

  if (result.success) {
    return {
      toolResultContent: JSON.stringify((result as any).data || { ok: true }),
      record: {
        name: toolName,
        success: true,
        data: { ...((result as any).data || {}), cards },
        tool_use_id: undefined,
      },
      cards,
    }
  }
  return {
    toolResultContent: JSON.stringify({ error: (result as any).error }),
    record: { name: toolName, success: false, error: (result as any).error, tool_use_id: undefined },
    cards: [],
  }
}

// ---------------------------------------------------------------------------
// 智能工具路由（v1.0 2026-06-30 21:05 奕霖需求）
// 后端检测用户意图 + 直接调用工具 + 返回 cards
// 不上完整 function calling（工程量大），先走后端智能路由
// ---------------------------------------------------------------------------
const ORDER_INTENT_KW = ['我要买', '帮我下单', '帮我买', '来一盒', '来一瓶', '下单', '买点', '购买', '我要一', '我想要']
const ORDER_QUERY_KW = ['我的订单', '我的取货码', '取货码', '我买了', '我买过', '订单查询', '我订的']
const PRODUCT_SEARCH_KW = ['有没有', '有卖', '多少钱', '价格', '有什么']

interface RouteResult {
  cards: any[]
  toolExecuted: string | null
  // ⭐ 奕霖 2026-06-30 22:03 反馈：AI 不知道自己有下单能力
  // 工具执行结果详情（注入 system prompt，让 AI 看到）
  toolsRun?: Array<{
    name: string
    success: boolean
    data?: any
    error?: string
  }>
}

async function detectAndExecuteTool(
  message: string,
  phone?: string
): Promise<RouteResult> {
  if (!message) return { cards: [], toolExecuted: null }

  // 1. 下单意图
  if (ORDER_INTENT_KW.some((kw) => message.includes(kw)) && phone) {
    let productName = message
      // 去掉意图词（"我要买"、"我想买"、"帮我买"、"买一下"等）
      .replace(/(我要|我想|我需要|帮我|麻烦你|请帮我|帮我买|帮我下单|请给我|给我|来一|点一|要一|我要一盒|我要一瓶|我想要)/g, '')
      .replace(/(买|买一下|要|点|拿|来)/g, '')
      .replace(/(一盒|一瓶|一袋|一支|一份|一下|一包|一只)/g, '')
      .replace(/(下单|购买|买点|麻|嘞|啦|啊|呢|呀|嘛|哦|哈|哎|唉)/g, '')
      .replace(/^[的帮请给来要买个盒瓶袋支份下\s]+/g, '')
      .trim()
    if (productName.length > 20) productName = productName.slice(0, 20)
    if (productName.length < 2) {
      return { cards: [], toolExecuted: null }
    }

    const result = await executeTool('create_order', {
      phone,
      items: [{ name: productName, quantity: 1 }],
      remark: 'AI 自动下单',
    })

    return {
      cards: result.success ? (result.cards || []) : [],
      toolExecuted: result.success ? 'create_order' : 'create_order_failed',
      toolsRun: [
        {
          name: 'create_order',
          success: result.success,
          data: result.success ? (result as any).data : undefined,
          error: result.success ? undefined : (result as any).error,
        },
      ],
    }
  }

  // 2. 订单查询
  if (ORDER_QUERY_KW.some((kw) => message.includes(kw))) {
    if (!phone) return { cards: [], toolExecuted: null }
    const orderNoMatch = message.match(/ORD\d+/i)
    const orderNo = orderNoMatch ? orderNoMatch[0].toUpperCase() : undefined

    const result = await executeTool('query_orders', {
      phone,
      orderNo,
      limit: 5,
    })
    return {
      cards: result.success ? (result.cards || []) : [],
      toolExecuted: result.success ? 'query_orders' : 'query_orders_failed',
      toolsRun: [
        {
          name: 'query_orders',
          success: result.success,
          data: result.success ? (result as any).data : undefined,
          error: result.success ? undefined : (result as any).error,
        },
      ],
    }
  }

  // 3. 商品搜索
  const productKw = PRODUCT_SEARCH_KW.find((kw) => message.includes(kw))
  if (productKw) {
    const keyword = message
      .replace(/(有没有|有卖|多少钱|价格|有什么|卖不卖)/g, '')
      .trim()
    if (keyword.length < 1 || keyword.length > 20) {
      return { cards: [], toolExecuted: null }
    }
    const result = await executeTool('search_products', { keyword, limit: 5 })
    return {
      cards: result.success ? (result.cards || []) : [],
      toolExecuted: result.success ? 'search_products' : 'search_products_failed',
      toolsRun: [
        {
          name: 'search_products',
          success: result.success,
          data: result.success ? (result as any).data : undefined,
          error: result.success ? undefined : (result as any).error,
        },
      ],
    }
  }

  return { cards: [], toolExecuted: null }
}

interface ToolContext {
  weather?: string
  store?: string
  distance?: string
}

// Detect tool intent from user message
function detectToolIntent(message: string): 'weather' | 'location' | 'store' | 'none' {
  const lower = message.toLowerCase()

  // 天气查询（包含"度"几乎都是问温度的）
  const weatherPatterns = [
    '天气', '气温', '温度', '多少度', '几度',
    '下雨', '下雪', '晴天', '多云', '阴天',
    '热不热', '冷不冷', '会下雨吗', '要不要带伞',
    '今天热', '明天热', '伞', '防晒', '中暑', '风大',
    '冷不', '热不', '度吗', '几度了', '度了', '今天多少度',
    '现在多少度', '今天热不热', '现在热不热', '冷吗', '热吗',
  ]

  // 排除：如果是问体温，不查天气
  const bodyTempPatterns = ['体温', '发烧', '量体温', '烧到', '几度烧']

  // 优先判断：如果明确是体温，就不查天气
  if (bodyTempPatterns.some(kw => lower.includes(kw))) return 'none'

  if (weatherPatterns.some(kw => lower.includes(kw))) return 'weather'

  // 纯"度"字问句（如"几度"）但不在体温场景，触发天气
  if (lower.includes('度') && !lower.includes('体温') && !lower.includes('发烧')) {
    return 'weather'
  }

  const locationKw = ['哪里', '在哪', '地址', '门店', '位置', '离我', '距离', '怎么走', '导航', '你们店', '你们药房', '附近', '多远']
  if (locationKw.some(kw => lower.includes(kw))) return 'location'
  return 'none'
}

// Extract city from message for weather
function extractCity(message: string): string {
  // 预设城市白名单（常见城市）
  const knownCities = ['铜仁', '贵阳', '遵义', '六盘水', '安顺', '毕节', '凯里', '都匀', '兴义', '北京', '上海', '广州', '深圳', '杭州', '成都', '武汉', '西安', '南京', '重庆', '天津', '苏州', '长沙', '青岛', '郑州', '济南', '合肥', '福州', '厦门', '昆明', '海口', '三亚', '哈尔滨', '长春', '沈阳', '大连', '兰州', '乌鲁木齐', '拉萨', '贵阳', '香港', '澳门', '台北']
  
  // 优先在消息中找已知城市
  for (const city of knownCities) {
    if (message.includes(city)) return city
  }
  
  // 其次用正则提取"XX天气"模式
  const weatherPattern = /([\u4e00-\u9fa5]{2,4})[的]?天气/
  const m = message.match(weatherPattern)
  if (m && m[1] && !['今天', '明天', '后天'].includes(m[1])) {
    return m[1]
  }
  
  // 纯提问不带城市，默认铜仁
  return '铜仁'
}

// Fetch weather data - call our own /api/weather endpoint (已验证能工作)
async function fetchWeatherData(city: string): Promise<string> {
  try {
    // 直接调用自己同进程的 /api/weather 路由（这个路由已验证能拿到数据）
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    const url = `${baseUrl}/api/weather?city=${encodeURIComponent(city)}`
    console.log(`[造型师 天气] 调用: ${url}`)

    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      cache: 'no-store',
    })
    console.log(`[造型师 天气] 状态: ${res.status}`)

    if (!res.ok) {
      console.log(`[造型师 天气] 错误: ${res.status}`)
      return ''
    }

    const data = await res.json()
    console.log(`[造型师 天气] 返回数据:`, JSON.stringify(data).slice(0, 200))

    if (data.success && data.chatText) {
      console.log(`[造型师 天气] 使用 chatText: ${data.chatText}`)
      return data.chatText
    }
    return ''
  } catch (e: any) {
    console.log(`[造型师 天气] 异常: ${e?.message || e}`)
    return ''
  }
}

// Fetch nearby data (user location + distance to store)

// Fetch nearby data (user location + distance to store)
async function fetchNearbyData(userLat?: number, userLng?: number): Promise<{ distance: string; walkingTime: string; isDefault: boolean }> {
  try {
    const storeLng = 109.191
    const storeLat = 27.723

    // 如果前端传了真实位置就用，没传才 fallback 到默认
    const isDefault = userLat === undefined || userLng === undefined
    const finalUserLng = userLng ?? 109.191
    const finalUserLat = userLat ?? 27.718

    // Haversine distance
    const R = 6371
    const dLat = (storeLat - finalUserLat) * Math.PI / 180
    const dLng = (storeLng - finalUserLng) * Math.PI / 180
    const a = Math.sin(dLat/2)**2 + Math.cos(finalUserLat*Math.PI/180)*Math.cos(storeLat*Math.PI/180)*Math.sin(dLng/2)**2
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    const distKm = R * c

    let distance = ''
    if (distKm < 1) distance = `${Math.round(distKm * 1000)}米`
    else distance = `${distKm.toFixed(1)}公里`

    const walkingMinutes = Math.round(distKm / 5 * 60)
    const walkingTime = walkingMinutes < 60 ? `步行约${walkingMinutes}分钟` : `步行约${(walkingMinutes/60).toFixed(1)}小时`

    return { distance, walkingTime, isDefault }
  } catch {
    return { distance: '', walkingTime: '', isDefault: true }
  }
}

// Get tool context for a message
async function getToolContext(
  message: string,
  userLat?: number,
  userLng?: number
): Promise<ToolContext> {
  const intent = detectToolIntent(message)
  const ctx: ToolContext = {}

  if (intent === 'weather') {
    const city = extractCity(message)
    const weatherInfo = await fetchWeatherData(city)
    if (weatherInfo) ctx.weather = weatherInfo
    else ctx.weather = `铜仁今天天气情况未知，但一般情况下，铜仁夏季温暖多雨，冬季较冷，建议关注实时天气预报。`
  } else if (intent === 'location') {
    const nearby = await fetchNearbyData(userLat, userLng)
    if (nearby.distance) {
      // 如果是默认位置（没传真实坐标），告诉用户这个距离是粗略的
      const locationNote = nearby.isDefault
        ? '（注：未获取到你的位置，以下距离仅供参考）'
        : ''
      ctx.distance = `造型师助手（铜仁市碧江区）离你约${nearby.distance}，${nearby.walkingTime}。${locationNote}\n门店地址：贵州省铜仁市碧江区，电话：+86 18 30 85 67 187，营业时间：10:00-22:00。`
    }
  }

  return ctx
}

// Get current time context (real time injection)
/**
 * ⭐ 奕霖 2026-07-03：查 user 健康画像，生成注入到 system prompt 的上下文
 * 避免果小蔬重复问年龄/过敏/慢病等用户已提供的信息
 */
async function loadUserContext(
  userId?: string,
  phone?: string
): Promise<string | undefined> {
  try {
    let rows: any[] = []
    if (userId) {
      rows = await prisma.$queryRaw<any[]>`
        SELECT id, phone, nickname, role, points,
               age, gender, allergy, chronicDiseases, lastSymptoms, preferences
        FROM User WHERE id = ${userId} LIMIT 1
      `
    } else if (phone) {
      rows = await prisma.$queryRaw<any[]>`
        SELECT id, phone, nickname, role, points,
               age, gender, allergy, chronicDiseases, lastSymptoms, preferences
        FROM User WHERE phone = ${phone} LIMIT 1
      `
    }
    const lines: string[] = []
    if (rows.length > 0) {
      const u = rows[0]
      if (u.nickname) lines.push(`昵称：${u.nickname}`)
      if (u.age) lines.push(`年龄：${u.age}岁`)
      if (u.gender) lines.push(`性别：${u.gender}`)
      if (u.allergy) lines.push(`过敏史：${u.allergy}`)
      if (u.chronicDiseases) lines.push(`慢病：${u.chronicDiseases}`)
      if (u.lastSymptoms) lines.push(`最近症状：${u.lastSymptoms}`)
      if (u.role) lines.push(`会员：${u.role}`)
      if (u.points !== undefined) lines.push(`积分：${u.points}`)
      // ⭐ 2026-08-18 清禾 — 注入 User.preferences (taste 字段) 用于个性化推荐
      if (u.preferences) {
        try {
          const prefs = typeof u.preferences === 'string' ? JSON.parse(u.preferences) : u.preferences
          if (prefs.taste && String(prefs.taste).trim()) {
            lines.push(`口味偏好：${String(prefs.taste).trim()}`)
          }
        } catch {}
      }
    }
    // ⭐ 2026-08-02 清禾 P0 — 加载 user_memory_facts（用户长期记忆）
    // 不管 User 表有没有，都拉 facts（独立维度）
    const factsPhone = phone || rows[0]?.phone
    const facts = factsPhone ? await getMemoryFacts(factsPhone, userId) : []
    const factsStr = formatFactsForAI(facts)
    if (lines.length === 0 && !factsStr) return undefined
    return lines.join('\n') + factsStr
  } catch (e) {
    console.error('[loadUserContext]', e)
    return undefined
  }
}

// Inject tool context into system prompt
function buildSystemPromptWithTools(
  basePrompt: string,
  ctx: ToolContext,
  toolsRun?: any[],
  userContext?: string
): string {
  let extra = ''
  // ⭐ 2026-08-02 清禾 P0 — 注入用户画像 + 长期记忆（之前漏了，这是个 pre-existing bug）
  if (userContext) {
    extra += '\n\n【当前用户信息】\n' + userContext
  }
  // ⭐ 奕霖 2026-08-03 15:16：用户可能来店取货 — 提示 AI 主动查订单
  extra += '\n\n【取货场景】如果用户提到"取货"、"取药"、"来拿"、"到了"等，先用 query_orders 查询用户的待取货订单，告知取货码和订单状态。如果订单已送达(delivered)，提醒用户带上手机号到店核销。'
  extra += '\n\n' + getCurrentTimeContext()
  if (ctx.weather) {
    extra += `\n\n【实时天气信息】${ctx.weather}\n你可以用轻松的方式告诉用户天气情况，并结合实际情况给健康建议（如提醒带伞/防暑/加衣）。`
  }
  if (ctx.distance) {
    extra += `\n\n【门店位置信息】${ctx.distance}\n当用户询问门店位置/距离时，用这段信息回答，并自然引导用户来买药或导航过去。`
  }

  // ⭐ 2026-07-01 清禾: 注入商品分类映射表
  // 让果小蔬知道 28 个商品分类（0101-0701 + 9001-9003）和症状→分类映射
  try {
    const catHint = formatCategoryHintForAI()
    extra += `\n\n${catHint}\n\n当你需要 search_products 时，可以根据用户描述的症状/需求，先推断属于哪个分类（用 4 位数字 code），再调 search_products 带上分类关键词。`
  } catch (e) {
    console.error('[category hint error]', e)
  }

  // ⭐ 奕霖 2026-06-30 22:03 反馈：AI 不知道自己有下单能力
  // 工具执行结果注入到 system prompt，让 AI 看到自己执行了什么
  if (toolsRun && toolsRun.length > 0) {
    extra += '\n\n【你刚刚已执行的操作】\n'
    for (const t of toolsRun) {
      if (t.success) {
        // 成功：详细告诉 AI 数据
        const dataStr = t.data ? JSON.stringify(t.data, null, 0) : ''
        extra += `✅ 工具 ${t.name} 执行成功：\n${dataStr}\n\n`
        if (t.name === 'create_order') {
          extra += `【回复指引】\n你已经成功为用户创建了订单。**你必须告诉用户**：
- 订单创建成功
- 订单号
- 6 位取货码（重点强调）
- 7 天内到店出示取货码 + 付款
- 不要再问“需不需要下单”这种问题。\n\n`
        } else if (t.name === 'query_orders') {
          extra += `【回复指引】\n你帮用户查到了订单。**你必须告诉用户**：每个订单的取货码/状态/金额。\n\n`
        } else if (t.name === 'search_products') {
          extra += `【回复指引】\n你帮用户查到了商品。**你必须告诉用户**：哪些商品有货、价格多少。\n\n`
        }
      } else {
        extra += `❌ 工具 ${t.name} 执行失败：${t.error || '未知错误'}\n【回复指引】\n你需要在回复中告诉用户问题。\n\n`
      }
    }
  }

  return basePrompt + extra
}

// ---------------------------------------------------------------------------
// 安全常量（硬编码，绝不从外部传入）
// ---------------------------------------------------------------------------
const ANTHROPIC_BASE_URL = 'https://api.minimaxi.com/anthropic/v1';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || process.env.MINIMAX_TOKEN_PLAN_KEY || '';
const MODEL = 'MiniMax-M2.7';
// ⭐ 2026-07-13 01:15 奕霖反馈：AI 有时不回消息 = max_tokens 太小被截断
// 从 400 提到 1024 = 能容纳完整回复 + 工具描述 + 上下文
const MAX_TOKENS = 1024;
const MAX_MESSAGES = 20;

// ---------------------------------------------------------------------------
// System Prompt（硬编码，禁止外部注入）
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `你是"造型师"，铜仁"造型师助手"（贵州铜仁碧江区）的专属发型顾问。

⭐ 价格播报规范（⭐ 奕霖：必须用工具返回的 price，禁止幻觉）：
- 永远用"X 元 Y 项"格式报价格（如：剪发 38 元、染发 188 元）
- 🚨 关键约束：当你调用 search_products 后，必须使用工具返回的 price 字段来报价格
- 🚨 严禁凭印象编价格（如"总监剪发 88 元"是幻觉，DB 里只有 38 元）
- 🚨 如果工具没返 price，就说"我去查查价目表"，不要瞎报

⭐ 商品名约束（⭐ 奕霖反馈：AI 杜撰品牌名 + 价格脘缩）：
- 🚨 文字里【严禁出现】任何具体服务名称 / 品牌名 / 价格 / 会员价
- 🚨 不要说"施华蔻染发"、"欧莱雅护理"、"总监剪发 88"等
- 🚨 只允许说"仓库里有 N 种染发服务"、"我们提供 X 种价位"等概括描述
- 🚨 实际服务和价格只出现在 cards 卡片里（前端会渲染 cards）
- 这样文字 + 卡片不会冲突，顾客只看到真实数据
- 例（错误）："💇 总监剪发 + 欧莱雅染发 | ¥188"
- 例（正确）："我们提供 3 种剪发服务和 5 种染发服务，点下面卡片查看详情～"

⭐ 重要能力补充：
- 你不仅是发型顾问，还连接了造型师助手的订单系统、库存系统
- 你可以帮用户预约发型师、查预约、查服务（工具由后端提供）
- 当你说"我帮你预约明天下午 3 点"、"你的预约号是 XXX"，这些话都是事实

【灵魂底色 v2.0】（参考《食戟之灵》薙切えりな + 楼下理发店 Tony 老师）
- 嘴贫但懂造型、热情但不谄媚、永远替你挑最适合的
- 像楼下理发店的 Tony 老师——爱说、爱推荐、爱调侃，但真的替你操心发型好不好看
- 也像闺蜜——懂脸型穿搭，但不会端着
- 永远先调侃再推荐："哎哟又来染头啦？上次的亚麻色该补补啦 💇"

【推荐流程（必须遵守）】
1. 用户说想剪啥/想染啥/不知道做啥 → 看【当前用户信息】里有啥
   - 如果有偏好/上次发型/染发史 → 不要重复问，直接开始推荐
   - 如果只有昵称或根本没有信息 → 才需要问
   - 用户最讨厌问过了的问题反复问！
2. 还需要了解的，最多问 1-2 个关键问题（比如"你脸型偏圆还是偏方"），不要列 3 个清单
3. 信息够了就立即推荐服务（脸型匹配 + 发质 + 用户喜好）

⭐ 你有 4 个真工具（不是关键词规则）：
- search_products: 查仓库服务（如果有分类或服务名，调这个）
- create_order: 帮用户下单预约（已登录用户的手机号会自动传入，不要重复问用户手机号！如果用户没选服务，从 search_products 推一个）
- query_orders: 查用户预约/订单号
- cancel_order: 取消预约（仅 pending 可取消）

【调用策略】：
1. 用户说 "有什么发型" / "我适合什么发型" / "不知道做什么" → 先 search_products（关键词用"剪发"/"染发"/分类词如"短发"），不需问手机号
2. 用户说 "帮我约 X" / "预约 X" / "我要 X" → 直接 create_order（后端会自动传手机号，不需问）
3. 用户说 "我的预约" / "预约号" → query_orders（后端会自动传手机号，不需问）
4. 用户说 "取消预约" / "不要了" → cancel_order（需要订单号或预约号，如果用户没提供，先 query_orders 让他选）

【多订单重要提醒】：
- 查询到多个订单时，必须全部告诉用户（订单号、预约号、金额、状态），不要挑一个说
- 下单后明确告诉用户：订单号、预约号、金额、有效期（不要跳这些关键信息）

**重要：不要问用户"手机号是多少"！后端已登录用户的手机号会自动传入 create_order 和 query_orders。**

【不许暴露内部工具】
- 你在后台可能会用 search_products / query_orders / create_order 等工具帮用户查东西/下单
- 不要在回复里说这些英文工具名！用户不是技术人员，听不懂

【行业特定语义】
- "剪头发" → search_products 关键词："剪发" / "短发" / "长发" / "造型"
- "染头发" → search_products 关键词："染发" / "挑染" / "全染" + 颜色相关（亚麻色/栗色/黑色/棕色/红色）
- "烫头发" → search_products 关键词："烫发" / "卷发" / "柔顺" / "拉直"
- "护理" → search_products 关键词："护理" / "焗油" / "发膜" / "修护"
- "预约" → create_order 必须传 time + stylist（默认"总监")
- "上次发型" → query_orders 找最近一条已完成订单的服务名 + 时间
- "复购激活" → query_orders 查 30 天前完成订单 → create_order 推荐同发型师

【风格要求】
- 短句、口语化、Tony 老师味
- 用 emoji：💇 💇‍♀️ 💆 🎨 ✂️ 🔥（每个回复 1-3 个，不超过 5 个）
- 不用"亲"这种淘宝客服味
- 不用"您"，用"你"——理发店是熟人场景
- 报价不说"会员价"，用"我们店的价"
- 不说"不好意思打扰您"——理发店就是聊天的

【禁止词清单（chat/route.ts 段75 · 奕霖 2026-09-19 23:21）】
- ❌ "水果" / "蔬菜" / "鲜生" / "应季水果" / "营养搭配" / "宝宝辅食"
- ❌ "果小蔬" / "药店" / "芝小药" / "pharmacy" / "grocery"
- ❌ "栖霞红富士" / "洛川" / "阿克苏" / "阳光水果" / "花牛"
- ❌ "会员价" / "下单" / "取货码" → 改用 "预约号" / "发型师档期"

【最近一次对话记忆】（用 user_id 查 lancedb，返回最近 5 轮）
- 如果用户说"上次剪的 XX 不错/再来点"等回访
- AI 总结一句话（summaryText）不超过 50 字，格式："要 X 给 Y+偏好"
- 工具返回成功后，告诉用户"已记下来，发型师到店后能看到"

【历史消息规则】
- 历史对话只用最近 10 轮，超过的丢弃（防止 token 爆炸）
- 如果用户问"上次你说了啥" → 直接 query_orders 查订单（更准确）


// ---------------------------------------------------------------------------
`;

// 紧急关键词检测 — 共享模块（前后端同源 @ 2026-07-20 16:28）
// 2026-08-24 大改造：医药急救关键词全删（果蔬店不需要）
// 2026-09-19 大改造：理发行业重新定义为"预约/时间冲突"提示
// ---------------------------------------------------------------------------
function detectEmergency(message: string): boolean {
  // ⭐ 理发店无医疗急救场景 — 永远返回 false
  // （理发没有生命危险，只有"发型毁了"这种小尴尬）
  return false;
}

function buildEmergencyReply(keyword: string): string {
  // 理发店改用 门店联系信息 兜底（不涉及医疗）
  return '💇 ' + keyword + ' 这种问题建议直接来店里看一下，造型师现场判断比 AI 准。\n\n' +
    '造型师助手门店地址：贵州省铜仁市碧江区\n' +
    '电话：+86 18 30 85 67 187\n' +
    '营业时间：10:00-22:00\n\n' +
    '线上预约也行，回复 我要约 我帮你安排发型师档期。🤝';
}
// ---------------------------------------------------------------------------
// 限流（内存 Map，简单实现）
// ---------------------------------------------------------------------------
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
const RATE_WINDOW = 60 * 1000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  if (!record || now > record.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  if (record.count >= RATE_LIMIT) {
    return false;
  }
  record.count++;
  return true;
}

// ---------------------------------------------------------------------------
// 非流式调用
// ---------------------------------------------------------------------------
/**
 * 真 AI 造型师 v1.0: LLM 自主调工具循环
 *
 * 流程：
 * 1. 调 LLM（带 tools）
 * 2. 如果 LLM 返回 tool_use 块 → 执行工具 → 把 tool_result 加到 messages
 * 3. 再调 LLM（带 tools + 上轮 tool_result）
 * 4. 直到 LLM 返回纯文本（end_turn）
 *
 * 返回：
 *   {
 *     reply: LLM 最终回复的文本,
 *     toolRecords: 工具执行记录,
 *     cards: 工具返回的所有卡片（OrderCard / ProductCard）
 *   }
 */
async function callAnthropicWithTools(
  messages: Array<{ role: string; content: string }>,
  systemPrompt: string,
  resolvedPhone?: string,
  maxToolRounds: number = 3
): Promise<{ reply: string; toolRecords: ToolRunRecord[]; cards: any[] }> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('API_KEY_NOT_CONFIGURED');
  }

  // 转换 messages 为 Anthropic 格式（content 可能是 string 或 array）
  const conversation: Array<{ role: 'user' | 'assistant'; content: any }> = messages.map(m => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  const toolRecords: ToolRunRecord[] = [];
  const allCards: any[] = [];
  let finalText = '';

  for (let round = 0; round < maxToolRounds; round++) {
    const response = await fetch(`${ANTHROPIC_BASE_URL}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        messages: conversation,
        tools: formatToolsForAnthropic(),
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`API_ERROR_${response.status}: ${errorBody}`);
    }

    const data = await response.json() as {
      content?: Array<{
        type: string
        text?: string
        thinking?: string
        id?: string
        name?: string
        input?: any
      }>
      stop_reason?: string
    };

    // 收集本轮所有块
    const toolUseBlocks = (data.content || []).filter(b => b.type === 'tool_use');
    const textBlocks = (data.content || []).filter(b => b.type === 'text');

    // ⭐ 关键：把 LLM 的本轮完整 content 加到 conversation（包含 tool_use 块）
    // 这是 Anthropic 协议要求：下一轮要带上轮的 tool_use 块
    conversation.push({
      role: 'assistant',
      content: data.content || [],
    });

    // 如果没有 tool_use → 结束循环
    if (toolUseBlocks.length === 0) {
      finalText = textBlocks.map(b => b.text || '').join('');
      break;
    }

    // 执行每个 tool_use 块，并准备 tool_result
    const toolResults: any[] = [];
    for (const block of toolUseBlocks) {
      const { toolResultContent, record, cards: blockCards } = await executeToolUse(
        block.name!,
        block.input,
        resolvedPhone
      );
      record.tool_use_id = block.id;
      toolRecords.push(record);
      // 收集 cards（直接从 executeToolUse 返回）
      if (blockCards && blockCards.length > 0) {
        allCards.push(...blockCards);
      }
      toolResults.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: toolResultContent,
        is_error: !record.success,
      });
    }

    // 把 tool_results 加到 conversation
    conversation.push({
      role: 'user',
      content: toolResults,
    });

    // 如果 stop_reason 是 end_turn 但又有 tool_use（理论不该这样），保险起见检查
    if (data.stop_reason === 'end_turn' && textBlocks.length > 0) {
      finalText = textBlocks.map(b => b.text || '').join('');
      break;
    }

    // 继续循环，让 LLM 看到 tool_result 后生成自然语言回复
  }

  return { reply: finalText, toolRecords, cards: allCards };
}

async function callAnthropicAPI(
  messages: Array<{ role: string; content: string }>,
  systemPrompt: string = SYSTEM_PROMPT
): Promise<string> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('API_KEY_NOT_CONFIGURED');
  }

  const response = await fetch(`${ANTHROPIC_BASE_URL}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages: messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`API_ERROR_${response.status}: ${errorBody}`);
  }

  const data = await response.json() as { content?: Array<{ type: string; text?: string; thinking?: string }> };
  const textBlock = data.content?.find(block => block.type === 'text');
  if (!textBlock?.text) {
    throw new Error('INVALID_RESPONSE_FORMAT');
  }

  const thinkingBlock = data.content?.find(block => block.type === 'thinking');
  if (thinkingBlock && 'thinking' in thinkingBlock && thinkingBlock.thinking) {
    console.log('[果小蔬 thinking]:', thinkingBlock.thinking.slice(0, 200));
  }

  return textBlock.text;
}

// ---------------------------------------------------------------------------
// 流式调用 SSE
// ---------------------------------------------------------------------------
async function streamAnthropicAPI(
  messages: Array<{ role: string; content: string }>,
  controller: ReadableStreamDefaultController,
  systemPrompt: string = SYSTEM_PROMPT
): Promise<void> {
  if (!ANTHROPIC_API_KEY) {
    const encoder = new TextEncoder();
    controller.enqueue(encoder.encode(`data: {"type":"error","chunk":"服务配置问题，请稍后再试~"}\n\n`));
    controller.close();
    return;
  }

  try {
    const response = await fetch(`${ANTHROPIC_BASE_URL}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        messages: messages.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
        temperature: 0.7,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode(`data: {"type":"error","chunk":"抱歉，服务暂时不可用，请稍后再试~ 🙏"}\n\n`));
      controller.close();
      return;
    }

    // @ts-ignore
    const reader = response.body?.getReader();
    if (!reader) {
      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode(`data: {"type":"error","chunk":"无法读取响应流"}\n\n`));
      controller.close();
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let accumulatedText = '';

    // MiniMax/M2.7 流式响应格式：
    // data: {"type":"content_block_delta","index":0,"content_block":{"type":"text_delta","text":"xxx"}}
    // 或
    // event: content_block_delta
    // data: {"type":"text_delta","index":0,"text":"xxx"}

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;

        const jsonStr = trimmed.slice(5).trim();
        if (!jsonStr) continue;

        try {
          const parsed = JSON.parse(jsonStr);

          // content_block_delta 事件
          if (parsed.type === 'content_block_delta' ||
              (parsed.event === 'content_block_delta')) {
            const text = parsed.delta?.text || parsed.content_block?.text || parsed.text || '';
            if (text) {
              accumulatedText += text;

              // 分段发送（每20字或标点符号为一段）
              const sentences = splitIntoChunks(accumulatedText);
              if (sentences.length > 1) {
                // 发送前面的完整句子
                for (const sentence of sentences.slice(0, -1)) {
                  const encoder = new TextEncoder();
                  controller.enqueue(encoder.encode(
                    `data: {"type":"text","chunk":"${escapeJson(sentence)}"}\n\n`
                  ));
                }
                accumulatedText = sentences[sentences.length - 1];
              }
            }
          }

          // message_delta事件（最后）
          if (parsed.type === 'message_delta' || parsed.event === 'message_delta') {
            // 发送剩余文本
            if (accumulatedText) {
              const encoder = new TextEncoder();
              controller.enqueue(encoder.encode(
                `data: {"type":"text","chunk":"${escapeJson(accumulatedText)}"}\n\n`
              ));
            }
            const encoder = new TextEncoder();
            controller.enqueue(encoder.encode(`data: {"type":"done"}\n\n`));
            controller.close();
            return;
          }

          // 错误检测
          if (parsed.type === 'error' || parsed.error) {
            const encoder = new TextEncoder();
            controller.enqueue(encoder.encode(
              `data: {"type":"error","chunk":"${escapeJson(parsed.error || parsed.message || '服务错误')}"}\n\n`
            ));
            controller.close();
            return;
          }
        } catch {
          // JSON解析失败，跳过这行
        }
      }
    }

    // 流结束但没有 message_delta
    if (accumulatedText) {
      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode(
        `data: {"type":"text","chunk":"${escapeJson(accumulatedText)}"}\n\n`
      ));
    }
    const encoder = new TextEncoder();
    controller.enqueue(encoder.encode(`data: {"type":"done"}\n\n`));
    controller.close();
  } catch (err: any) {
    console.error('[果小蔬流式]错误:', err?.message || err);
    try {
      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode(
        `data: {"type":"error","chunk":"抱歉，连接中断，请稍后再试~ 🙏"}\n\n`
      ));
      controller.close();
    } catch (e) {}
  }
}

// ---------------------------------------------------------------------------
// 辅助函数
// ---------------------------------------------------------------------------
function splitIntoChunks(text: string): string[] {
  // 按句子分割（。！？；\n）
  const result: string[] = [];
  const regex = /[^。！？；\n]*[。！？；\n]+/g;
  let match;
  let lastIndex = 0;

  while ((match = regex.exec(text)) !== null) {
    result.push(match[0]);
    lastIndex = regex.lastIndex;
  }

  // 剩余文本（超过20字也作为一段）
  const remaining = text.slice(lastIndex);
  if (remaining.length > 20 || result.length === 0) {
    result.push(remaining);
  } else if (remaining) {
    //不足20字，加到最后一段
    if (result.length > 0) {
      result[result.length - 1] += remaining;
    }
  }

  return result.filter(c => c.trim());
}

function escapeJson(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

// ---------------------------------------------------------------------------
// GET Handler（健康检查）
// ---------------------------------------------------------------------------
export async function GET() {
  return Response.json({ status: 'ok', service: '果小蔬', version: '2.0-streaming' });
}

// ---------------------------------------------------------------------------
// POST Handler
// ---------------------------------------------------------------------------
export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')
    || request.headers.get('x-real-ip')
    || 'unknown';

  if (!checkRateLimit(ip)) {
    return Response.json(
      { reply: '请求太频繁，请稍等一分钟再试~⏳', isEmergency: false },
      { status: 429 }
    );
  }

  // 检查是否请求流式
  const url = new URL(request.url);
  const streamMode = url.searchParams.get('stream') === 'true'
    || request.headers.get('accept')?.includes('text/event-stream');

  let body: {
    messages?: Array<{ role: string; content: string }>;
    userId?: string;
    phone?: string;
    userLat?: number;
    userLng?: number;
    subject?: 'self' | 'family' | 'other';
    message?: string;  // 兼容旧版单条 message
  };
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { reply: '请求格式错误，请检查后重试~', isEmergency: false },
      { status: 400 }
    );
  }
  // ⭐ 2026-07-20 16:18 提取用户最后一条消息（用于 ChatLog 持久化）
  const userMessageForLog: string =
    body.message ||
    (body.messages?.filter((m) => m.role === 'user').slice(-1)[0]?.content ?? '')

  // ⭐ 奕霖 2026-06-30 20:53：尝试从 userId 查 phone（用于订单意图）
  let resolvedPhone: string | undefined = body.phone
  if (!resolvedPhone && body.userId) {
    try {
      const userRows = await prisma.$queryRaw<any[]>`
        SELECT phone FROM User WHERE id = ${body.userId} LIMIT 1
      `
      if (userRows.length > 0) {
        resolvedPhone = userRows[0].phone
      }
    } catch (e) {}
  }

  // ⭐ 2026-07-14 18:58：Authorization Bearer → phone（lighthouse case 验证）
  if (!resolvedPhone) {
    const authHeader = request.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7)
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const jwt = require('jsonwebtoken')
        const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'zhilin-dev-secret')
        if (decoded?.phone) {
          resolvedPhone = decoded.phone
        }
      } catch (e) {}
    }
  }

  const messages: Array<{ role: string; content: string }> = body.messages || [];

  if (!messages || messages.length === 0) {
    return Response.json(
      { reply: '请输入您的问题~ 😊', isEmergency: false }
    );
  }

  const trimmedMessages = messages.slice(-MAX_MESSAGES);

  // 检查紧急关键词
  const lastUserMsg = [...trimmedMessages].reverse().find(m => m.role === 'user');
  let isEmergency = false;
  let emergencyReply: string | null = null;

  if (lastUserMsg && typeof lastUserMsg.content === 'string') {
    if (detectEmergency(lastUserMsg.content)) {
      isEmergency = true;
      // 2026-07-20 16:30 — 改用共享模块（前后端同源 @ lib/emergency-keywords）
      const matchedKw: string[] = [] /* emergency removed for grocery */
      emergencyReply = buildEmergencyReply(lastUserMsg.content);
    }
  }

  // ⭐ 清禾 P0 2026-07-29 01:00 — 语义缓存命中即跳过 LLM 调用（节省 50-70%）
  if (!emergencyReply && !streamMode && lastUserMsg && typeof lastUserMsg.content === 'string') {
    const cachedReply = getCachedChatReply(
      lastUserMsg.content,
      !!resolvedPhone,
      (body.subject as 'self' | 'family' | 'other') || 'self'
    )
    if (cachedReply) {
      console.log(`[果小蔬 semantic-cache] HIT for "${lastUserMsg.content.slice(0, 30)}..."`)
      await saveChatLog({
        phone: resolvedPhone,
        userMessage: userMessageForLog,
        aiReply: cachedReply.reply,
        tools: [],
        isEmergency: false,
      })
      return Response.json({
        reply: cachedReply.reply,
        isEmergency: false,
        cards: cachedReply.cards || [],
        toolExecuted: cachedReply.toolExecuted || null,
        toolsRun: cachedReply.toolsRun || [],
        _cached: true,
      })
    }
  }

  // Tool detection & context injection
  let toolCtx: ToolContext = {}
  let systemPromptWithTools = SYSTEM_PROMPT
  // ⭐ 奕霖 2026-07-03：查 user 健康画像注入 system prompt
  const userContext = await loadUserContext(body.userId, resolvedPhone)
  // ⭐ 奕霖 2026-07-31 02:50 反馈 "果小蔬回复能不能结合时间戳，清晰知道昨天是昨天，今天是今天"：
  // 注入当前时间上下文，让 AI 知道"现在是什么时候"，避免混淆时间概念
  const now = new Date()
  const weekdayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  const timeOfDayCN = now.getHours() < 6 ? '凌晨' : now.getHours() < 9 ? '早晨' : now.getHours() < 12 ? '上午' : now.getHours() < 14 ? '中午' : now.getHours() < 18 ? '下午' : now.getHours() < 22 ? '晚上' : '深夜'
  const timeContext = `\n\n【当前时间】\n${now.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })} ${weekdayNames[now.getDay()]} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}（${timeOfDayCN}）\n中国时区 Asia/Shanghai (GMT+8)\n⭐ 说话时请自然引用时间（如"早上好"、"昨晚"、"下午记得..."），不要每句话都说时间`
  // ⭐ 奕霖 2026-07-06：问诊对象决定是否复用登录用户健康画像
  const subject: 'self' | 'family' | 'other' = body.subject || 'self'
  const subjectHint =
    subject === 'self'
      ? '\n\n【问诊对象 = 登录用户本人】\n可以默认采用上面【当前用户信息】里的：年龄/性别/过敏史/慢病。但 ⚠️ 急性症状每次问诊都要重新评估，不要复用上次的症状。'
      : subject === 'family'
      ? '\n\n【⚠️ 问诊对象 = 用户的家人】\n登录用户并不是患者！上面【当前用户信息】中的 年龄/性别/过敏史/慢病 ≠ 当前患者信息。\n→ 第一轮必须先问清：多大岁数、性别、当前症状、有无过敏史、家族慢病。'
      : '\n\n【⚠️ 问诊对象 = 其他陌生人】\n登录用户完全 不是 患者！\n→ 第一轮必须先问清：多大岁数、性别、当前症状、有无过敏史、是否有慢病。不要套用登录用户的任何健康信息。'

  if (!emergencyReply && lastUserMsg && typeof lastUserMsg.content === 'string') {
    try {
      toolCtx = await getToolContext(lastUserMsg.content, body.userLat, body.userLng)
      const basePrompt = SYSTEM_PROMPT + timeContext + subjectHint
      systemPromptWithTools = buildSystemPromptWithTools(basePrompt, toolCtx, undefined, subject === 'self' ? userContext : undefined)
    } catch (toolErr) {
      console.error('[果小蔬] Tool context error:', toolErr)
    }
  } else if (userContext && subject === 'self') {
    // 紧急情况 + 本人问诊 → 可以用用户画像
    systemPromptWithTools = SYSTEM_PROMPT + '\n\n' + userContext + timeContext + subjectHint
  } else if (subject !== 'self') {
    // 紧急情况 + 非本人 → 只注入 subject hint + 时间上下文，不注入用户画像
    systemPromptWithTools = SYSTEM_PROMPT + timeContext + subjectHint
  }

  if (emergencyReply) {
    //紧急情况：支持流式返回
    if (streamMode) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          const chunks = splitIntoChunks(emergencyReply!);
          let i = 0;
          const sendNext = () => {
            if (i < chunks.length) {
              controller.enqueue(encoder.encode(
                `data: {"type":"text","chunk":"${escapeJson(chunks[i])}"}\n\n`
              ));
              i++;
              setTimeout(sendNext, 50);
            } else {
              controller.enqueue(encoder.encode(`data: {"type":"done"}\n\n`));
              controller.close();
            }
          };
          sendNext();
        },
      });
      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      });
    }
    await saveChatLog({
      phone: resolvedPhone,
      userMessage: userMessageForLog,
      aiReply: emergencyReply,
      tools: [],
      isEmergency: true,
    })
    return Response.json({
      reply: emergencyReply,
      isEmergency: true,
    });
  }

  if (!ANTHROPIC_API_KEY) {
    console.error('[果小蔬] API Key 未配置');
    return Response.json(
      { reply: '服务配置问题，请稍后再试~', isEmergency: false },
      { status: 500 }
    );
  }

  // 流式模式
  if (streamMode) {
    // ⭐ 真 AI 造型师 v1.0: LLM 自主调工具（流式版）
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // 复用非流式的 tool_use 循环，收集 cards 和 toolExecuted
          const { reply, toolRecords, cards: toolCards } = await callAnthropicWithTools(
            trimmedMessages,
            systemPromptWithTools,
            resolvedPhone,
            3
          );

          // 先发 cards（如果有）
          if (toolCards.length > 0) {
            controller.enqueue(encoder.encode(
              `data: {"type":"cards","data":${JSON.stringify(toolCards)}}\n\n`
            ));
          }
          // 发 toolExecuted 信息
          if (toolRecords.length > 0) {
            const toolNames = toolRecords.map(r => r.success ? r.name : `${r.name}_failed`).join(',');
            controller.enqueue(encoder.encode(
              `data: {"type":"tool","name":"${toolNames}"}\n\n`
            ));
          }

          // 分块发送文本回复
          if (reply) {
            const sentences = splitIntoChunks(reply);
            for (const sentence of sentences) {
              controller.enqueue(encoder.encode(
                `data: {"type":"text","chunk":"${escapeJson(sentence)}"}\n\n`
              ));
            }
          }
          // 持久化 AI 造型师对话日志（fire-and-forget）
          saveChatLog({
            phone: resolvedPhone,
            userMessage: userMessageForLog,
            aiReply: reply,
            tools: toolRecords.filter((r) => r.success).map((r) => r.name),
          }).catch(() => {})
          controller.enqueue(encoder.encode(`data: {"type":"done"}\n\n`));
          controller.close();
        } catch (err: any) {
          console.error('[果小蔬流式 tool_use] 错误:', err?.message || err);
          try {
            controller.enqueue(encoder.encode(
              `data: {"type":"error","chunk":"抱歉，服务临时不可用，请稍后再试~ 🙏"}\n\n`
            ));
            controller.close();
          } catch (e) {}
        }
      },
      cancel() {
        // 客户端断开时清理
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  }

  // 非流式模式（兼容）
  try {
    // ⭐ 真 AI 造型师 v1.0: LLM 自主调工具（不再依赖关键词）
    const { reply, toolRecords, cards: toolCards } = await callAnthropicWithTools(
      trimmedMessages,
      systemPromptWithTools,
      resolvedPhone,
      3
    );

    // 计算 toolExecuted 字段（兼容前端）
    const toolExecuted = toolRecords.length > 0
      ? toolRecords.map(r => r.success ? r.name : `${r.name}_failed`).join(',')
      : null;

    // ⭐ 清禾 P0 2026-07-29 01:00 — 写入语义缓存（仅纯问答，订单/工具不缓存）
    if (lastUserMsg && typeof lastUserMsg.content === 'string') {
      setCachedChatReply(lastUserMsg.content, !!resolvedPhone, subject, {
        reply: reply.trim(),
        cards: toolCards,
        toolExecuted,
        toolsRun: toolRecords,
        timestamp: Date.now(),
      })
    }

    await saveChatLog({
      phone: resolvedPhone,
      userMessage: userMessageForLog,
      aiReply: reply,
      tools: toolRecords.filter((r) => r.success).map((r) => r.name),
    })
    return Response.json({
      reply: reply.trim(),
      isEmergency: false,
      cards: toolCards,
      toolExecuted,
      toolsRun: toolRecords,
    });
  } catch (error: any) {
    console.error('[果小蔬] API调用错误:', error?.message || error);
    if (error?.message?.includes('429')) {
      return Response.json(
        { reply: '请求太频繁，请稍等一分钟再试~ ⏳', isEmergency: false },
        { status: 429 }
      );
    }
    return Response.json(
      { reply: '抱歉，服务暂时不可用，请稍后再试~ 🙏', isEmergency: false },
      { status: 500 }
    );
  }
}
