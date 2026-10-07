import { NextRequest } from 'next/server'
import { appendFile } from 'fs/promises'
import { appendFileSync } from 'fs'

/**
 * /api/debug/client-error - 客户端错误上报（清禾 2026-10-08 00:25 临时诊断）
 *
 * 背景：iOS 模拟器复现「登录后白屏」，我的 error.tsx 捕获到了但只显示通用文案。
 * digest 为空 = 客户端渲染错误，error.message 是真实可用的。
 * 这里落一份到 /tmp/qinghe-logs/client-errors.log，我直接读，不用等奕霖截图。
 */
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  let payload: any = {}
  try {
    payload = await request.json()
  } catch {
    /* ignore */
  }
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    ua: request.headers.get('user-agent')?.slice(0, 120),
    url: request.headers.get('referer'),
    ...payload,
  })
  try {
    await appendFile('/tmp/qinghe-logs/client-errors.log', line + '\n')
  } catch {
    try {
      appendFileSync('/tmp/qinghe-logs/client-errors.log', line + '\n')
    } catch { /* ignore */ }
  }
  return Response.json({ success: true })
}
