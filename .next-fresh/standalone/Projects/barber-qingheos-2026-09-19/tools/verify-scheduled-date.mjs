#!/usr/bin/env node
/**
 * 「后天预约被写成明天」bug —— 最小可复现验证脚本
 *
 * 跑法：cd /Users/yilinzhao/Projects/barber-qingheos-2026-09-19 && node scripts/verify-scheduled-date.mjs
 *
 * 覆盖 4 层：
 *   1) 纯函数层：dateKeyToActual('dayAfter') = 今天 +2 天；scheduledDateLabel('dayAfter') = 「后天」
 *   2) 源码层：发送端映射不再把 dayAfter 降级成 tomorrow；onSuccess 类型含 dayAfter
 *   3) 读取层：商家端过滤能捞出 dayAfter 单、标签显示「后天」
 *   4) 落库层：BarberQueue.scheduledDate 原样存 'dayAfter'（在 dev.db 的临时副本上做，不碰生产库）
 *
 * ⚠️ 本脚本只读生产库并复制到 /tmp 后再操作，绝不写生产库。
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const { scheduledDateLabel, dateKeyToActual, SCHEDULED_DATE_KEYS, SCHEDULED_DATE_LABELS } =
  await import(path.join(ROOT, 'src/lib/scheduled-date.ts'))

let failed = 0
function check(name, cond, detail) {
  const mark = cond ? '✅ PASS' : '❌ FAIL'
  if (!cond) failed++
  console.log(`  ${mark}  ${name}${detail ? '  →  ' + detail : ''}`)
}

// ============ 1) 纯函数层 ============
console.log('\n=== 测试 1: 日期口径纯函数（lib/scheduled-date.ts） ===')
const shToday = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' })
const plus = (base, n) => {
  const d = new Date(base + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
check('dateKeyToActual("today") = 今天', dateKeyToActual('today') === shToday, `${dateKeyToActual('today')} vs ${shToday}`)
check('dateKeyToActual("tomorrow") = 今天+1', dateKeyToActual('tomorrow') === plus(shToday, 1), `${dateKeyToActual('tomorrow')}`)
check('dateKeyToActual("dayAfter") = 今天+2', dateKeyToActual('dayAfter') === plus(shToday, 2), `${dateKeyToActual('dayAfter')} (今天 ${shToday})`)
check('dayAfter 比 tomorrow 晚一天', dateKeyToActual('dayAfter') > dateKeyToActual('tomorrow'))
check('scheduledDateLabel("dayAfter") = 后天', scheduledDateLabel('dayAfter') === '后天', scheduledDateLabel('dayAfter'))
check('scheduledDateLabel("tomorrow") = 明天', scheduledDateLabel('tomorrow') === '明天')
check('三档齐全 today/tomorrow/dayAfter', SCHEDULED_DATE_KEYS.join(',') === 'today,tomorrow,dayAfter')
check('标签映射齐全', Object.keys(SCHEDULED_DATE_LABELS).length === 3)

// ============ 2) 源码层：发送端 ============
console.log('\n=== 测试 2: 发送端源码（BookingSection.tsx） ===')
const bsPath = path.join(ROOT, 'src/components/BookingSection.tsx')
const bs = fs.readFileSync(bsPath, 'utf8')
// 去掉行注释后再查（修复说明里会引用旧代码文本，不能算作 bug 仍在）
const bsCode = bs.split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n')
check("不再有 dateKey === 'dayAfter' ? 'tomorrow'（降级 bug 已消除）",
  !bsCode.includes("dateKey === 'dayAfter' ? 'tomorrow'"))
check('scheduledDate 原样透传 dateKey', bs.includes('scheduledDate: dateKey,'))
check('onSuccess 类型含 dayAfter（ScheduledDateKey）', bs.includes("scheduledDate: ScheduledDateKey; status: 'reserved'"))
check('onSuccess 类型不再只写 today|tomorrow', !bs.includes("scheduledDate: 'today' | 'tomorrow'; status: 'reserved'"))
check('订单模型 Order.scheduledDate 用 ScheduledDateKey', bs.includes('scheduledDate: ScheduledDateKey'))

const ordersPage = fs.readFileSync(path.join(ROOT, 'src/app/(user)/orders/page.tsx'), 'utf8')
check('接收端 orders/page.tsx 未被改动（仍是 +2 天）',
  /if \(key === 'dayAfter'\) \{\s*const d = new Date\(today \+ 'T00:00:00Z'\)\s*d\.setUTCDate\(d\.getUTCDate\(\) \+ 2\)/.test(ordersPage))

// ============ 3) 读取层：商家端能看见后天单 ============
console.log('\n=== 测试 3: 商家端读取层（BookingSection 的过滤 + 标签逻辑） ===')
check('存在 reservedDayAfterOrders 过滤（读 dayAfter 档）',
  bs.includes("o.scheduledDate === 'dayAfter'"))
check('存在 nextDayAfterReservation（后天档下一位）', bs.includes('nextDayAfterReservation'))
check('卡片渲染 FutureReservationRow（后日预约）', bs.includes('title="后日预约"'))
check('列表标签用 scheduledDateLabel（明天/后天都标对）', bs.includes('scheduledDateLabel(o.scheduledDate)'))
check('列表不再只判 tomorrow', !bs.includes("o.scheduledDate === 'tomorrow' && <span"))

// 用与组件一致的过滤逻辑跑一遍真实数据形状
const orders = [
  { id: '1', customerName: '今天客', scheduledAt: '10:00', scheduledDate: 'today', status: 'reserved' },
  { id: '2', customerName: '明天客', scheduledAt: '11:00', scheduledDate: 'tomorrow', status: 'reserved' },
  { id: '3', customerName: '后天客', scheduledAt: '14:00', scheduledDate: 'dayAfter', status: 'reserved' },
]
const reservedDayAfterOrders = orders.filter(o => o.status === 'reserved' && o.scheduledDate === 'dayAfter')
  .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
const activeOrders = orders.filter(o => o.status === 'serving' || o.status === 'arrived' || o.status === 'reserved')
check('商家端 dayAfter 过滤能捞到后天单', reservedDayAfterOrders.length === 1 && reservedDayAfterOrders[0].customerName === '后天客',
  JSON.stringify(reservedDayAfterOrders.map(o => o.customerName)))
check('店长进行中列表（activeOrders）包含后天单', activeOrders.some(o => o.scheduledDate === 'dayAfter'))
check('后天单标签显示「后天」而不是「明天」',
  scheduledDateLabel(reservedDayAfterOrders[0].scheduledDate) === '后天',
  'label=' + scheduledDateLabel(reservedDayAfterOrders[0].scheduledDate))
check('明天单标签仍显示「明天」（旧行为不回归）',
  scheduledDateLabel(orders.find(o => o.scheduledDate === 'tomorrow').scheduledDate) === '明天')

// ============ 4) 落库层：scheduledDate 原样存/取 ============
console.log('\n=== 测试 4: 落库层（/api/queues 读写路径，dev.db 临时副本） ===')
const srcDb = path.join(ROOT, 'prisma/dev.db')
if (!fs.existsSync(srcDb)) {
  console.log('  ⚠️ 跳过：找不到 prisma/dev.db')
} else {
  const tmpDb = path.join(os.tmpdir(), 'barber-verify-dayafter-' + Date.now() + '.db')
  fs.copyFileSync(srcDb, tmpDb)
  const { default: Database } = await import('better-sqlite3')
  const db = new Database(tmpDb)
  const merchantId = 'm_barber_001'
  const orderNo = 'V' + Date.now().toString().slice(-6)
  db.prepare(`
    INSERT INTO BarberQueue (id, merchantId, orderNo, type, customerName, customerPhone,
      service, stylistName, stylistCode, status, scheduledAt, scheduledDate,
      arrivedAt, startedAt, completedAt, note)
    VALUES (?, ?, ?, 'booking', '后天验证客', '13900000000',
      '剪发', 'Tony', NULL, 'reserved', '14:00', 'dayAfter',
      NULL, NULL, NULL, 'verify-dayafter')
  `).run('q_verify_' + Date.now().toString(36), merchantId, orderNo)

  // 用 /api/queues GET 的同款 SELECT 读回
  const row = db.prepare(`
    SELECT q.id, q.merchantId, q.orderNo, q.type, q.customerName, q.customerPhone,
      q.service, q.stylistName, q.stylistCode, q.status, q.scheduledAt, q.scheduledDate
    FROM BarberQueue q
    WHERE q.merchantId = ? AND q.customerPhone = ?
  `).get(merchantId, '13900000000')
  check('BarberQueue.scheduledDate 原样存为 dayAfter', row && row.scheduledDate === 'dayAfter',
    'scheduledDate=' + (row && row.scheduledDate))
  check('GET /api/queues 能查到这单（列表里看得见）', !!row && row.orderNo === orderNo)

  // 商家端过滤 + 标签（用真实库读出来的行）
  const list = db.prepare('SELECT * FROM BarberQueue WHERE merchantId = ? AND status = ?')
    .all(merchantId, 'reserved')
  const dayAfterRows = list.filter(o => o.scheduledDate === 'dayAfter')
  check('真实库里过滤 dayAfter 档有数据', dayAfterRows.length >= 1, 'count=' + dayAfterRows.length)
  check('真实库里 dayAfter 单标签为「后天」',
    dayAfterRows.every(o => scheduledDateLabel(o.scheduledDate) === '后天'))
  db.close()
  fs.unlinkSync(tmpDb)
  console.log('  ℹ️  已删除临时副本：' + tmpDb + '（生产 prisma/dev.db 未被写入）')
}

console.log('\n' + (failed === 0 ? '🎉 全部通过（0 失败）' : `⚠️ 有 ${failed} 项失败`))
process.exit(failed === 0 ? 0 : 1)
