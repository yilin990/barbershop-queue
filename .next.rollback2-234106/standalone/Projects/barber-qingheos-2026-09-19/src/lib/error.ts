/**
 * error.ts — Day 6 标准化错误层（奕霖 2026-07-25）
 *
 * 替代每个 route 重复写的 NextResponse.json({success:false,error:'xxx'}, {status:400})
 * 用法：
 *   throw new ValidationError('手机号格式错')
 *   return errorResponse(err)
 *
 * 设计：
 *   - 5 个具体错（Auth/Forbidden/NotFound/Validation/RateLimit）
 *   - 1 个通用 ApiError
 *   - errorResponse() 自动判 status + code
 *   - 5xx 自动 console.error（开发期可见）
 */
export class ApiError extends Error {
  status: number = 500
  code: string = 'INTERNAL_ERROR'

  constructor(message?: string) {
    super(message || '服务器错误')
    this.name = 'ApiError'
  }
}

export class ValidationError extends ApiError {
  constructor(message: string) {
    super(message)
    this.status = 400
    this.code = 'VALIDATION_ERROR'
    this.name = 'ValidationError'
  }
}

export class AuthError extends ApiError {
  constructor(message = '请先登录') {
    super(message)
    this.status = 401
    this.code = 'AUTH_REQUIRED'
    this.name = 'AuthError'
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = '权限不足') {
    super(message)
    this.status = 403
    this.code = 'FORBIDDEN'
    this.name = 'ForbiddenError'
  }
}

export class NotFoundError extends ApiError {
  constructor(message = '资源不存在') {
    super(message)
    this.status = 404
    this.code = 'NOT_FOUND'
    this.name = 'NotFoundError'
  }
}

export class ConflictError extends ApiError {
  constructor(message = '资源冲突') {
    super(message)
    this.status = 409
    this.code = 'CONFLICT'
    this.name = 'ConflictError'
  }
}

export class RateLimitError extends ApiError {
  constructor(message = '请求太频繁，请稍后再试') {
    super(message)
    this.status = 429
    this.code = 'RATE_LIMITED'
    this.name = 'RateLimitError'
  }
}

/**
 * 把任意 thrown value 转成标准 Response
 *
 * 用法：
 *   try { ... } catch (e) { return errorResponse(e) }
 *   或
 *   return errorResponse(err)
 */
export function errorResponse(err: unknown, fallbackStatus = 500): Response {
  if (err instanceof ApiError) {
    return Response.json(
      { success: false, error: err.message, code: err.code },
      { status: err.status }
    )
  }
  if (err && typeof err === 'object' && 'success' in err && (err as any).success === false) {
    // 已经是标准格式
    return Response.json(err, { status: fallbackStatus })
  }
  const msg = err instanceof Error ? err.message : (typeof err === 'string' ? err : '服务器错误')
  if (fallbackStatus >= 500) {
    console.error('[error]', err)
  }
  return Response.json(
    { success: false, error: msg, code: 'INTERNAL_ERROR' },
    { status: fallbackStatus }
  )
}

/**
 * 常用成功响应
 */
export function successResponse<T = unknown>(data: T, status = 200): Response {
  return Response.json({ success: true, ...(typeof data === 'object' && data !== null ? data : { data }) }, { status })
}