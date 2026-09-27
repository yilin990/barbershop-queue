// TTS API v4.0 - 果小蔬音 (2026-07-28 15:42 奕霖反馈)
// 设计原则：路由只负责 proxy + 缓存，不管 Python 进程存活（monitor 守护）
// - 默认 voice=female-chengshu + speed=1.2 + pitch=-2 (成熟药店阿姨感)
// - 透传 voice/engine/speed/pitch 参数
// - 缓存 key 含全部 4 维 (不同声音/速度/音调 独立缓存)
// - 调 Python → 15s 超时
// - Python 挂了 → 503

import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

const PYTHON_PORT = 38101
const TTS_CACHE = new Map<string, Buffer>()
const MAX_CACHE_SIZE = 200
const FETCH_TIMEOUT_MS = 15000
const ALLOWED_ENGINES = new Set(['minimax', 'edge'])
const ALLOWED_VOICES = new Set([
  'female-shaonv', 'female-yujie', 'female-tianmei', 'female-chengshu',
  'male-qn-qingse', 'male-qn-jingying',
  'zh-CN-XiaoxiaoNeural', 'zh-CN-YunxiNeural', 'zh-CN-YunjianNeural',
])
// ⭐ v4.1 (2026-07-28 16:13) 奕霖反馈 (16:11):
// - chengshu (pitch -2) 听起来妩媚气短, 换 shaonv 少女豆包姐姐风
// - pitch +2 让声音明亮开朗, 不气短不妩媚
const DEFAULT_VOICE = 'female-shaonv'
const DEFAULT_SPEED = 1.2
const DEFAULT_PITCH = 2

function cacheGet(key: string): Buffer | undefined {
  return TTS_CACHE.get(key)
}

function cacheSet(key: string, buf: Buffer) {
  if (TTS_CACHE.size >= MAX_CACHE_SIZE) {
    const firstKey = TTS_CACHE.keys().next().value
    if (firstKey) TTS_CACHE.delete(firstKey)
  }
  TTS_CACHE.set(key, buf)
}

// 清洗文本：markdown + emoji + url + 取货码逐位拆
function cleanText(text: string): string {
  return text
    // 取货码逐位拆（防止 TTS 读成"九十二万二千三百一十六"）
    .replace(
      /(取货码[是为]?[　\s]*[：:]?[　\s]*)(\d{4,8})(?!\d)/g,
      (_, prefix, digits) => prefix + digits.split('').join(' ')
    )
    .replace(/[#{}\[\]<>|*_~`>]+/g, ' ')
    .replace(/https?:\/\/\S+/g, '链接')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function POST(req: NextRequest) {
  const start = Date.now()
  try {
    const body = await req.json()
    const { text } = body
    const voice: string = typeof body.voice === 'string' && ALLOWED_VOICES.has(body.voice)
      ? body.voice : DEFAULT_VOICE
    const engine: 'minimax' | 'edge' = typeof body.engine === 'string' && ALLOWED_ENGINES.has(body.engine as string)
      ? body.engine as 'minimax' | 'edge' : 'minimax'
    const speed = typeof body.speed === 'number' && body.speed >= 0.5 && body.speed <= 2.0
      ? body.speed : DEFAULT_SPEED
    const pitch = typeof body.pitch === 'number' && body.pitch >= -12 && body.pitch <= 12
      ? Math.round(body.pitch) : DEFAULT_PITCH
    // ⭐ v4.5（2026-07-29 19:21）奕霖调高音量：转发给 minimax 底层（服务端放大，绕开 audio.volume ≤ 1.0 限制）
    const vol = typeof body.vol === 'number' && body.vol >= 0.5 && body.vol <= 2.0
      ? body.vol : 1.2  // 默认 1.2 比 1.0 响一档
    if (!text || !text.trim()) {
      return NextResponse.json({ error: 'empty' }, { status: 400 })
    }

    const cleaned = cleanText(text).slice(0, 1000)
    if (!cleaned) {
      return NextResponse.json({ error: 'empty after clean' }, { status: 400 })
    }

    // 1. 缓存命中 (key 含 voice+engine+speed+pitch+vol, 5 维独立缓存)
    const cacheKey = `${engine}|${voice}|${speed}|${pitch}|${vol}|${cleaned}`
    const cached = cacheGet(cacheKey)
    if (cached) {
      return new NextResponse(new Uint8Array(cached), {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': cached.length.toString(),
          'X-TTS-Cache': 'HIT',
          'X-TTS-Engine': engine,
          'X-TTS-Voice': voice,
          'X-TTS-Speed': String(speed),
          'X-TTS-Pitch': String(pitch),
          'X-TTS-Time': `${Date.now() - start}ms`,
          'Cache-Control': 'public, max-age=3600',
        },
      })
    }

    // 2. 调 Python TTS service（monitor 负责保活，路由不负责 spawn）
    try {
      const res = await fetch(`http://127.0.0.1:${PYTHON_PORT}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleaned, voice, engine, speed, pitch, vol }),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      })

      if (!res.ok) {
        console.error(`[TTS] Python returned ${res.status}`)
        return NextResponse.json(
          { error: 'tts_python_error', status: res.status },
          { status: 502 }
        )
      }

      const arr = new Uint8Array(await res.arrayBuffer())
      const buf = Buffer.from(arr)

      cacheSet(cacheKey, buf)

      return new NextResponse(new Uint8Array(buf), {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': buf.length.toString(),
          'X-TTS-Cache': 'MISS',
          'X-TTS-Engine': engine,
          'X-TTS-Voice': voice,
          'X-TTS-Speed': String(speed),
          'X-TTS-Pitch': String(pitch),
          'X-TTS-Time': `${Date.now() - start}ms`,
          'Cache-Control': 'public, max-age=3600',
        },
      })
    } catch (e) {
      const msg = (e as Error).message
      console.error(`[TTS] Python fetch failed: ${msg}`)
      return NextResponse.json(
        { error: 'tts_unavailable', detail: msg, engine, voice, speed, pitch },
        { status: 503 }
      )
    }
  } catch (error) {
    console.error('[TTS API] Error:', error)
    return NextResponse.json({ error: 'tts_failed' }, { status: 500 })
  }
}

// 健康检查（供 monitor 用，不消耗配额）
export async function GET() {
  try {
    const res = await fetch(`http://127.0.0.1:${PYTHON_PORT}/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'health' }),
      signal: AbortSignal.timeout(3000),
    })
    if (res.ok || res.status === 200) {
      return NextResponse.json({ status: 'healthy', pythonPort: PYTHON_PORT })
    }
    return NextResponse.json(
      { status: 'degraded', pythonStatus: res.status },
      { status: 503 }
    )
  } catch (e) {
    return NextResponse.json(
      { status: 'down', error: (e as Error).message },
      { status: 503 }
    )
  }
}