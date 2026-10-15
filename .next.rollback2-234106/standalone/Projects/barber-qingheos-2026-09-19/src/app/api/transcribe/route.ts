import { NextRequest } from 'next/server'
import { spawn } from 'child_process'
import { writeFile, unlink, mkdir, readdir } from 'fs/promises'
import { existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { randomUUID } from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

interface WhisperSegment {
  start: number
  end: number
  text: string
}

const WHISPER_SERVICE_URL = process.env.WHISPER_SERVICE_URL || 'http://127.0.0.1:38102'
const WHISPER_SERVICE_TIMEOUT = parseInt(process.env.WHISPER_SERVICE_TIMEOUT || '8000', 10)

/**
 * POST /api/transcribe
 * - multipart/form-data: audio file (WebM/Opus from MediaRecorder)
 * - 返回: { text, segments, elapsedMs, source }
 *
 * v6.1 (2026-07-31 17:57): 优先调 localhost:38102 whisper_service (长驻进程),
 *                          失败 fallback 到 spawn whisper CLI
 * - v6.0: spawn CLI 每次加载 4.3s 模型 + 1.5s 处理 = ≥5.8s
 * - v6.1: whisper_service 加载一次，2s 音频 ~1.2s (5x 提速)
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now()

  try {
    const formData = await req.formData()
    const audioFile = formData.get('audio') as File | null

    if (!audioFile) {
      return Response.json(
        { error: 'No audio file provided (expected "audio" field)' },
        { status: 400 }
      )
    }

    if (audioFile.size > 30 * 1024 * 1024) {
      return Response.json(
        { error: `Audio too large: ${audioFile.size} bytes (max 30MB)` },
        { status: 413 }
      )
    }

    // 优先调 whisper_service (长驻)
    try {
      const buffer = Buffer.from(await audioFile.arrayBuffer())
      const result = await callWhisperService(buffer, 'zh')
      const elapsed = Date.now() - startTime
      console.log(`[transcribe] v6.1 service OK: ${audioFile.size}B → "${result.text?.slice(0, 50)}..." (${elapsed}ms)`)
      return Response.json({
        success: true,
        text: result.text,
        language: result.language,
        segments: result.segments,
        duration: result.duration,
        audioSize: audioFile.size,
        elapsedMs: elapsed,
        source: 'whisper_service',
      })
    } catch (svcErr) {
      console.warn('[transcribe] whisper_service failed, fallback to CLI:', svcErr instanceof Error ? svcErr.message : svcErr)
    }

    // Fallback: spawn whisper CLI (旧 v6.0 路径)
    const fallbackResult = await runWhisperCli(audioFile)
    const elapsed = Date.now() - startTime
    console.log(`[transcribe] v6.0 CLI fallback: ${audioFile.size}B → "${fallbackResult.text?.slice(0, 50)}..." (${elapsed}ms)`)
    return Response.json({
      success: true,
      text: fallbackResult.text,
      language: fallbackResult.language,
      segments: fallbackResult.segments,
      duration: fallbackResult.duration,
      audioSize: audioFile.size,
      elapsedMs: elapsed,
      source: 'cli_fallback',
    })
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    console.error('[transcribe] ERROR:', errorMsg)
    return Response.json(
      { success: false, error: errorMsg },
      { status: 500 }
    )
  }
}

/**
 * 调长驻 whisper_service (port 38102)
 * 接收 base64 音频 + 返回转录结果
 */
async function callWhisperService(
  audioBuffer: Buffer,
  language: string
): Promise<{ text: string; language: string; segments?: WhisperSegment[]; duration?: number }> {
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
      segments: data.segments,
      duration: undefined,
    }
  } catch (err) {
    clearTimeout(timeoutId)
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`whisper_service timeout ${WHISPER_SERVICE_TIMEOUT}ms`)
    }
    throw err
  }
}

/**
 * Fallback: spawn whisper CLI (旧 v6.0 路径)
 */
async function runWhisperCli(audioFile: File): Promise<{
  text: string
  language: string
  segments?: WhisperSegment[]
  duration?: number
}> {
  const id = randomUUID()
  const inputPath = join(tmpdir(), `zhilin_stt_${id}.webm`)
  const outputDir = join(tmpdir(), `zhilin_stt_${id}`)

  try {
    const buffer = Buffer.from(await audioFile.arrayBuffer())
    await writeFile(inputPath, buffer)
    await mkdir(outputDir, { recursive: true })

    const args = [
      inputPath,
      '--language', 'zh',
      '--model', 'small',
      '--output_format', 'json',
      '--output_dir', outputDir,
      '--fp16', 'False',
      '--beam_size', '1',
      '--verbose', 'False',
    ]

    const text = await runWhisper(args, 60000)
    const inputStem = inputPath.replace(/^.*\//, '').replace(/\.[^.]+$/, '')
    const jsonPath = join(outputDir, `${inputStem}.json`)
    let result: { text?: string; language?: string; segments?: WhisperSegment[]; duration?: number } = { text }

    if (existsSync(jsonPath)) {
      try {
        const jsonContent = await import('fs/promises').then(m => m.readFile(jsonPath, 'utf-8'))
        result = JSON.parse(jsonContent)
        result.text = (result.text || '').trim()
      } catch (parseErr) {
        console.warn('[transcribe] failed to parse whisper JSON:', parseErr)
      }
    }

    return {
      text: result.text || '',
      language: result.language || 'zh',
      segments: result.segments,
      duration: result.duration,
    }
  } finally {
    await unlink(inputPath).catch(() => {})
    try {
      const files = await readdir(outputDir)
      await Promise.all(files.map(f => unlink(join(outputDir, f)).catch(() => {})))
      await unlink(outputDir).catch(() => {})
    } catch {}
  }
}

function runWhisper(args: string[], timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('whisper', args)
    let stdout = ''
    let stderr = ''
    let killed = false

    const timeout = setTimeout(() => {
      killed = true
      proc.kill('SIGTERM')
      reject(new Error(`whisper timeout after ${timeoutMs}ms`))
    }, timeoutMs)

    proc.stdout.on('data', (data) => { stdout += data.toString() })
    proc.stderr.on('data', (data) => { stderr += data.toString() })

    proc.on('close', (code) => {
      clearTimeout(timeout)
      if (killed) return
      if (code === 0) resolve(stdout.trim())
      else reject(new Error(`whisper exited ${code}: ${stderr.slice(-500)}`))
    })

    proc.on('error', (err) => {
      clearTimeout(timeout)
      reject(new Error(`whisper spawn error: ${err.message}`))
    })
  })
}
