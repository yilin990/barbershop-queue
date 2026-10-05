import { NextRequest } from 'next/server'
import { randomUUID } from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

const WHISPER_SERVICE_URL = process.env.WHISPER_SERVICE_URL || 'http://127.0.0.1:38102'
const WHISPER_SERVICE_TIMEOUT = parseInt(process.env.WHISPER_SERVICE_TIMEOUT || '8000', 10)
const SESSION_TTL_MS = 30_000

// ⭐ v6.3（奕霖 2026-07-31 19:25 手机端"识别卡"反馈）：
// Sliding window: 保留最近 N chunks，丢弃更早的
// - 之前累积所有 chunks → 用户录音 30s = 30 chunks × 2s = 60s wav
//   whisper 转录 60s wav ~3-4s/次 → 越录越卡
// - 修复：保留最近 8 chunks (16s wav) → 转录 16s wav 恒定 ~0.8s/次
// - 8 chunks ≈ 16s，覆盖 1-2 句中文（足够 incremental 转录）
const MAX_CHUNKS_WINDOW = 8

interface StreamSession {
  chunks: Buffer[]
  lastText: string
  lastChunkAt: number
  finalReceived: boolean
  // 累计已经丢弃了多少 chunks（用于日志 + 调试）
  droppedChunks: number
}

const sessions = new Map<string, StreamSession>()

setInterval(() => {
  const now = Date.now()
  for (const [id, sess] of sessions.entries()) {
    if (now - sess.lastChunkAt > SESSION_TTL_MS && !sess.finalReceived) {
      sessions.delete(id)
      console.log(`[stream] cleaned expired session ${id}`)
    }
  }
}, 10_000)

/**
 * POST /api/transcribe/stream
 * 流式分块转录 — 用户边录边传，每 2s 切一段立即返回 partial text
 *
 * FormData 字段:
 *   - audio: 当前 2s webm chunk (从 MediaRecorder ondataavailable 拿到)
 *   - stream_id: session id（首次自动生成）
 *   - chunk_index: 0, 1, 2, ...
 *   - is_final: 'true' 表示用户停止录音
 *
 * 返回 JSON:
 *   {
 *     stream_id: string,
 *     chunk_index: number,
 *     delta: string,
 *     cumulative: string,
 *     elapsedMs: number,
 *     is_final: boolean,
 *   }
 *
 * v6.2 (2026-07-31 18:43): 流式分块 — 边录边传
 * v6.3 (2026-07-31 19:25): Sliding window — 保留最近 8 chunks，避免累积越长越卡
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now()

  try {
    const formData = await req.formData()
    const audioFile = formData.get('audio') as File | null
    let streamId = (formData.get('stream_id') as string | null) || randomUUID()
    const chunkIndex = parseInt((formData.get('chunk_index') as string | null) || '0', 10)
    const isFinal = (formData.get('is_final') as string | null) === 'true'

    if (!audioFile) {
      return Response.json({ error: 'No audio file provided' }, { status: 400 })
    }
    if (audioFile.size > 5 * 1024 * 1024) {
      return Response.json({ error: `Chunk too large: ${audioFile.size} bytes (max 5MB)` }, { status: 413 })
    }

    function getOrCreateSession(id: string): StreamSession {
      let s = sessions.get(id)
      if (!s) {
        s = {
          chunks: [],
          lastText: '',
          lastChunkAt: Date.now(),
          finalReceived: false,
          droppedChunks: 0,
        }
        sessions.set(id, s)
      }
      return s
    }

    const session: StreamSession = getOrCreateSession(streamId)
    session.lastChunkAt = Date.now()

    const chunkBuffer = Buffer.from(await audioFile.arrayBuffer())
    session.chunks.push(chunkBuffer)

    // ⭐ v6.3 sliding window: 保留最近 MAX_CHUNKS_WINDOW chunks
    while (session.chunks.length > MAX_CHUNKS_WINDOW) {
      session.chunks.shift()
      session.droppedChunks++
    }

    let cumulative = ''
    let elapsedMs = 0
    try {
      const allAudio = Buffer.concat(session.chunks)
      const result = await callWhisperService(allAudio, 'zh')
      cumulative = result.text
      elapsedMs = result.elapsedMs
    } catch (svcErr) {
      console.warn('[stream] whisper_service error:', svcErr instanceof Error ? svcErr.message : svcErr)
    }

    const delta = computeDelta(session.lastText, cumulative)
    session.lastText = cumulative

    if (isFinal) {
      session.finalReceived = true
      setTimeout(() => sessions.delete(streamId), 60_000)
    }

    const totalElapsed = Date.now() - startTime
    console.log(
      `[stream] ${streamId.slice(0, 8)} chunk=${chunkIndex} final=${isFinal} ` +
      `window=${session.chunks.length}/${MAX_CHUNKS_WINDOW} dropped=${session.droppedChunks} ` +
      `+${delta.length}ch → "${delta.slice(0, 30)}" (${elapsedMs}ms / ${totalElapsed}ms)`
    )

    return Response.json({
      stream_id: streamId,
      chunk_index: chunkIndex,
      delta,
      cumulative,
      elapsedMs,
      is_final: isFinal,
    })
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    console.error('[stream] ERROR:', errorMsg)
    return Response.json({ success: false, error: errorMsg }, { status: 500 })
  }
}

function computeDelta(prev: string, curr: string): string {
  if (!prev) return curr.trim()
  if (!curr) return ''

  let prefixLen = 0
  const minLen = Math.min(prev.length, curr.length)
  while (prefixLen < minLen && prev[prefixLen] === curr[prefixLen]) {
    prefixLen++
  }

  let suffixLen = 0
  const maxSuffix = Math.min(prev.length - prefixLen, curr.length - prefixLen)
  while (
    suffixLen < maxSuffix &&
    prev[prev.length - 1 - suffixLen] === curr[curr.length - 1 - suffixLen]
  ) {
    suffixLen++
  }

  const newText = curr.slice(prefixLen, curr.length - suffixLen)
  return newText.trim()
}

async function callWhisperService(audioBuffer: Buffer, language: string): Promise<{
  text: string
  language: string
  elapsedMs: number
}> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), WHISPER_SERVICE_TIMEOUT)

  try {
    const audioB64 = audioBuffer.toString('base64')
    const resp = await fetch(`${WHISPER_SERVICE_URL}/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audio: audioB64, language }),
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!resp.ok) {
      throw new Error(`whisper_service HTTP ${resp.status}`)
    }
    const data = await resp.json()
    if (!data.success) {
      throw new Error(`whisper_service error: ${data.error || 'unknown'}`)
    }
    return {
      text: (data.text || '').trim(),
      language: data.language || language,
      elapsedMs: data.elapsedMs || 0,
    }
  } catch (err) {
    clearTimeout(timeoutId)
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`whisper_service timeout ${WHISPER_SERVICE_TIMEOUT}ms`)
    }
    throw err
  }
}