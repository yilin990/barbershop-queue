/**
 * GET /api/agent/capabilities
 * 2026-10-16 清禾
 *
 * 目的：给外部 agent 一张「门牌号」。
 *   agent 一次 GET 拿到全部能力，就知道自己能干什么、该不该干。
 *
 * ⭐ 设计取舍：
 *   - 默认返回精简索引（id/desc/method/endpoint/side_effect/when_to_use），
 *     体积小，agent 塞进上下文不心疼。
 *   - ?full=1 返回全部字段（含 params / auth / idempotent）。
 *   - ?effect=read|write|money 过滤 —— agent 可先问「我只能做读操作吗」。
 *
 * ⛔ 本接口只读、公开、无副作用：它只是把一个静态清单吐出来。
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  AGENT_CAPABILITIES,
  CAPABILITY_VERSION,
  CAPABILITY_GENERATED_AT,
  type SideEffect,
} from '@/lib/agent-capabilities'

export const runtime = 'nodejs'
// ⭐ 2026-10-16 17:00 清禾修：原来写 force-static，Next 直接吐静态响应，
//   query 参数根本不进 handler —— ?effect= 过滤完全失效（线上实调发现）。
//   这个接口要读 searchParams，必须 force-dynamic。
export const dynamic = 'force-dynamic'

const EFFECTS: SideEffect[] = ['read', 'write', 'money']

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams
  const full = p.get('full') === '1' || p.get('full') === 'true'
  const effect = p.get('effect') as SideEffect | null

  if (effect && !EFFECTS.includes(effect)) {
    return NextResponse.json(
      {
        success: false,
        error: `effect 只能是 ${EFFECTS.join(' | ')}`,
      },
      { status: 400 },
    )
  }

  let list = AGENT_CAPABILITIES
  if (effect) list = list.filter((c) => c.side_effect === effect)

  const capabilities = full
    ? list
    : list.map(({ id, desc, when_to_use, method, endpoint, side_effect, auth }) => ({
        id, desc, when_to_use, method, endpoint, side_effect, auth,
      }))

  const counts = {
    total: AGENT_CAPABILITIES.length,
    read: AGENT_CAPABILITIES.filter((c) => c.side_effect === 'read').length,
    write: AGENT_CAPABILITIES.filter((c) => c.side_effect === 'write').length,
    money: AGENT_CAPABILITIES.filter((c) => c.side_effect === 'money').length,
    returned: capabilities.length,
  }

  return NextResponse.json({
    success: true,
    manifest: 'qinghe.agent.capabilities',
    version: CAPABILITY_VERSION,
    generated_at: CAPABILITY_GENERATED_AT,
    counts,
    // ⭐ 使用说明：给 agent 读的第一段话
    usage: {
      pick_by: 'when_to_use',
      before_write: 'side_effect 为 write/money 时先向人确认',
      idempotency: 'idempotent=false 的接口重试前必须先回读状态',
      auth_note:
        'auth 是【应有的权限等级】；auth_verified=false 表示真实代码里尚未显式校验，属待加固项',
    },
    capabilities,
  })
}
