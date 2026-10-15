/**
 * /api/groups/join - 加入拼团 API（Day 2 重构 + Day 6 validate 集成）
 *
 * thin shell 模式：
 *   1. validate.ts 校验入参（zod schema）
 *   2. 调 @/domain/groupbuy/service 业务
 *   3. error.ts 一行错误转换
 *   4. successResponse() 返回
 *
 * 这是「template 路线」的标准模式：所有新 route 都按这个写
 */

import { NextRequest } from 'next/server'
import { joinGroup, getGroupDetail } from '@/domain/groupbuy/service'
import { errorResponse, successResponse } from '@/lib/error'
import { validateBody, validateQuery, z , failResponse} from '@/lib/validate'

export const runtime = 'nodejs'

// ============== Schema 定义 ==============

const joinSchema = z.object({
  groupId: z.string().min(1).optional(),
  phone: z.string().regex(/^1[3-9]\d{9}$/, '手机号格式不正确'),
  nickname: z.string().max(20).optional(),
})

const detailSchema = z.object({
  groupId: z.string().min(1, 'groupId 不能为空'),
})

// ============== Handler ==============

export async function POST(request: NextRequest) {
  // 1. 校验入参
  const v = await validateBody(request, joinSchema)
  if (!v.ok) return failResponse(v)

  // 2. 调 domain
  try {
    const result = await joinGroup(v.data)
    return successResponse(result)
  } catch (e) {
    return errorResponse(e)
  }
}

export async function GET(request: NextRequest) {
  const v = validateQuery(request, detailSchema)
  if (!v.ok) return failResponse(v)

  try {
    const result = await getGroupDetail(v.data.groupId)
    return successResponse(result)
  } catch (e) {
    return errorResponse(e)
  }
}