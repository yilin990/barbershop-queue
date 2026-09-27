/**
 * Day 6 验证脚本 — 直接跑 error.ts + validate.ts
 * 跑法：cd official && npx tsx __tests__/day6-validate.test.ts
 */
import { validateValue, validateQuery, z, Schemas } from '../src/lib/validate'
import { ValidationError, AuthError, NotFoundError, ConflictError, errorResponse } from '../src/lib/error'

async function run() {
  console.log('=== 测试 1: validateValue 正例（phone + smsCode） ===')
  const schema1 = z.object({
    phone: Schemas.phone(),
    code: Schemas.smsCode(),
  })
  const ok = validateValue({ phone: '13800138000', code: '123456' }, schema1)
  console.log('  ok:', ok.ok, ok.ok ? `data=${JSON.stringify(ok.data)}` : `!ok ${JSON.stringify(ok.response)}`)

  console.log('\n=== 测试 2: validateValue 反例（手机号错 + 验证码 2 位） ===')
  const bad = validateValue({ phone: 'abc', code: '12' }, schema1)
  if (!bad.ok) {
    const body = await bad.response.json()
    console.log('  status:', bad.response.status)
    console.log('  error:', body.error)
    console.log('  code:', body.code)
  }

  console.log('\n=== 测试 3: errorResponse(ValidationError) ===')
  const e1 = errorResponse(new ValidationError('手机号格式不对'))
  const e1body = await e1.json()
  console.log('  status:', e1.status, '| code:', e1body.code, '| error:', e1body.error)

  console.log('\n=== 测试 4: errorResponse(AuthError) ===')
  const e2 = errorResponse(new AuthError())
  const e2body = await e2.json()
  console.log('  status:', e2.status, '| code:', e2body.code, '| error:', e2body.error)

  console.log('\n=== 测试 5: errorResponse(NotFoundError) ===')
  const e3 = errorResponse(new NotFoundError('订单 123 不存在'))
  const e3body = await e3.json()
  console.log('  status:', e3.status, '| code:', e3body.code, '| error:', e3body.error)

  console.log('\n=== 测试 6: errorResponse(ConflictError) ===')
  const e4 = errorResponse(new ConflictError('该手机号已注册'))
  const e4body = await e4.json()
  console.log('  status:', e4.status, '| code:', e4body.code, '| error:', e4body.error)

  console.log('\n=== 测试 7: errorResponse(unknown Error) ===')
  const e5 = errorResponse(new Error('数据库连接失败'))
  const e5body = await e5.json()
  console.log('  status:', e5.status, '| code:', e5body.code, '| error:', e5body.error)

  console.log('\n=== 测试 8: validateQuery 正例（pagination） ===')
  const req = new Request('http://x/api/test?page=2&limit=50', { method: 'GET' })
  const q = validateQuery(req as any, Schemas.pagination())
  console.log('  ok:', q.ok, q.ok ? `data=${JSON.stringify(q.data)}` : '!ok')

  console.log('\n=== 测试 9: validateQuery 反例（page=-1, limit=999） ===')
  const req2 = new Request('http://x/api/test?page=-1&limit=999', { method: 'GET' })
  const q2 = validateQuery(req2 as any, Schemas.pagination())
  if (!q2.ok) {
    const body = await q2.response.json()
    console.log('  status:', q2.response.status, '| error:', body.error)
  }

  console.log('\n=== 测试 10: 嵌套 zod schema（GroupBuy 创建） ===')
  const groupBuySchema = z.object({
    productId: Schemas.productId(),
    requiredPeople: z.number().int().min(2).max(20),
    durationDays: z.number().int().min(1).max(30),
    maxStock: z.number().int().positive().optional(),
  })
  const g1 = validateValue({
    productId: 'p_001',
    requiredPeople: 3,
    durationDays: 7,
    maxStock: 100,
  }, groupBuySchema)
  console.log('  正例:', g1.ok ? `✅ data=${JSON.stringify(g1.ok ? g1.data : null)}` : '❌')

  const g2 = validateValue({
    productId: '',
    requiredPeople: 100,  // 超过 max 20
    durationDays: 0,      // 低于 min 1
  }, groupBuySchema)
  if (!g2.ok) {
    const body = await g2.response.json()
    console.log('  反例: status=' + g2.response.status + ', issues=' + body.issues.length + ' 条')
  }
}

run().catch(e => { console.error('TEST ERROR:', e); process.exit(1) })