/**
 * 会员卡业务逻辑验收（v1.1.37）
 * 跑法：MEMBER_DB_PATH=<db副本> node --experimental-strip-types xxx.ts
 * 全程打副本，绝不碰生产库。
 */
import { getDb, openCard, recharge, consume, adjust, setStatus, getCard, listLogs, summary, levelOf, yuanToCents, normalizePhone, LEVELS } from './member.ts'

const MID = 'm_barber_001'
const MID2 = 'm_barber_002'
const PH = '13800138000'

let pass = 0, fail = 0
function ok(name: string, cond: boolean, extra = '') {
  if (cond) { pass++; console.log('  ✓ ' + name) }
  else { fail++; console.log('  ✗ ' + name + (extra ? '   → ' + extra : '')) }
}
function section(t: string) { console.log('\n── ' + t + ' ──') }

const db = getDb()
db.exec('DELETE FROM MemberCardLog')
db.exec('DELETE FROM MemberCard')

section('1. 开卡')
const c = openCard(db, { merchantId: MID, phone: PH, nickname: '测试', operator: '店长' })
ok('开卡成功', !!c.id)
ok('初始余额 0', c.balanceCents === 0, 'got ' + c.balanceCents)
ok('初始等级 普通', c.level === 'normal')
ok('流水记了 1 条 open', listLogs(db, MID, PH).length === 1)

try { openCard(db, { merchantId: MID, phone: PH }); ok('重复开卡被拒', false) }
catch (e: any) { ok('重复开卡被拒', /已经是会员/.test(e.message), e.message) }

try { openCard(db, { merchantId: MID, phone: '123' }); ok('错手机号被拒', false) }
catch (e: any) { ok('错手机号被拒', /手机号格式/.test(e.message), e.message) }

section('2. 手机号归一化')
ok('+86 前缀', normalizePhone('+8613800138000') === '13800138000')
ok('带横线', normalizePhone('138-0013-8000') === '13800138000')
ok('带空格', normalizePhone('138 0013 8000') === '13800138000')

section('3. 充值 + 等级')
let card = recharge(db, { merchantId: MID, phone: PH, amountYuan: 500, bonusYuan: 50, operator: '店长' })
ok('充500送50 → 余额550', card.balanceCents === 55000, 'got ' + card.balanceCents)
ok('累计实付 500 → 银卡', card.level === 'silver', 'got ' + card.level)
ok('等级折扣 0.95', card.discount === 0.95)

card = recharge(db, { merchantId: MID, phone: PH, amountYuan: 1500, bonusYuan: 200 })
ok('再充1500送200 → 余额2250', card.balanceCents === 225000, 'got ' + card.balanceCents)
ok('累计实付 2000 → 金卡', card.level === 'gold', 'got ' + card.level)
ok('下一个等级是钻石', card.nextLevel?.key === 'diamond')
ok('还差 300 元升钻', card.toNextCents === 300000, 'got ' + card.toNextCents)

try { recharge(db, { merchantId: MID, phone: PH, amountYuan: 0 }); ok('充0被拒', false) }
catch (e: any) { ok('充0被拒', /必须大于/.test(e.message), e.message) }

try { recharge(db, { merchantId: MID, phone: '13700137000', amountYuan: 100 }); ok('没卡就充值被拒', false) }
catch (e: any) { ok('没卡就充值被拒', /先开卡/.test(e.message), e.message) }

section('4. 消费扣款')
card = consume(db, { merchantId: MID, phone: PH, amountYuan: 88, service: '剪发', orderNo: 'T001' })
ok('扣88 → 余额2162', card.balanceCents === 216200, 'got ' + card.balanceCents)
ok('到店次数 1', card.visitCount === 1)
ok('累计消费 88', card.consumeCents === 8800)

try { consume(db, { merchantId: MID, phone: PH, amountYuan: 99999 }); ok('透支被拒', false) }
catch (e: any) { ok('透支被拒', /余额不足/.test(e.message), e.message) }
ok('拒付后余额没变', getCard(db, MID, PH)!.balanceCents === 216200)

section('5. 手工调整')
try { adjust(db, { merchantId: MID, phone: PH, deltaYuan: -100, reason: '' }); ok('没写原因被拒', false) }
catch (e: any) { ok('没写原因被拒', /必须写原因/.test(e.message), e.message) }
try { adjust(db, { merchantId: MID, phone: PH, deltaYuan: -99999, reason: '测试' }); ok('调成负数被拒', false) }
catch (e: any) { ok('调成负数被拒', /负数/.test(e.message), e.message) }
card = adjust(db, { merchantId: MID, phone: PH, deltaYuan: -100, reason: '上次多扣了', operator: '店长' })
ok('扣100 → 余额2062', card.balanceCents === 206200, 'got ' + card.balanceCents)
ok('等级不因调整降级(只按实付算)', card.level === 'gold')

section('6. 冻结 / 解冻')
setStatus(db, { merchantId: MID, phone: PH, status: 'frozen' })
try { recharge(db, { merchantId: MID, phone: PH, amountYuan: 100 }); ok('冻结卡充值被拒', false) }
catch (e: any) { ok('冻结卡充值被拒', /frozen/.test(e.message), e.message) }
try { consume(db, { merchantId: MID, phone: PH, amountYuan: 10 }); ok('冻结卡扣款被拒', false) }
catch (e: any) { ok('冻结卡扣款被拒', /frozen/.test(e.message), e.message) }
setStatus(db, { merchantId: MID, phone: PH, status: 'active' })
ok('解冻后能充值了', recharge(db, { merchantId: MID, phone: PH, amountYuan: 100 }).balanceCents > 0)

section('7. 多租户隔离')
ok('另一个商户看不到这张卡', getCard(db, MID2, PH) === null)
ok('另一商户新建同号码不冲突', !!openCard(db, { merchantId: MID2, phone: PH }).id)
ok('两个商户各有各的余额',
   getCard(db, MID, PH)!.balanceCents !== getCard(db, MID2, PH)!.balanceCents)

section('8. 等级边界')
ok('49999分 = 普通', levelOf(49999).key === 'normal')
ok('50000分 = 银卡', levelOf(50000).key === 'silver')
ok('199999分 = 银卡', levelOf(199999).key === 'silver')
ok('200000分 = 金卡', levelOf(200000).key === 'gold')
ok('500000分 = 钻石', levelOf(500000).key === 'diamond')
ok('1000000分 = 还是钻石', levelOf(1000000).key === 'diamond')

section('9. ⭐ 流水对账（最关键）')
const logs = listLogs(db, MID, PH, 500) as any[]
const sum = logs.reduce((a, l) => a + l.changeCents, 0)
const bal = getCard(db, MID, PH)!.balanceCents
ok('流水变动合计 == 当前余额', sum === bal, '流水合计=' + sum + '  余额=' + bal)
// open1 + recharge3 + consume1 + adjust1 + frozen1 + unfreeze1 = 8
ok('流水条数 = 8', logs.length === 8, 'got ' + logs.length)
const types = logs.map((l: any) => l.type).sort().join(',')
ok('流水类型齐全', types === 'adjust,consume,frozen,open,recharge,recharge,recharge,unfreeze', types)
const last = logs.find((l: any) => l.type === 'adjust')!
ok('adjust 流水记了原因', !!last.note, last.note)
ok('每条流水都有 balanceAfter',
   logs.every((l: any) => typeof l.balanceAfter === 'number'))

section('10. 总览')
const s = summary(db, MID)
ok('卡片数 1', s.cards === 1, 'got ' + s.cards)
ok('余额 = 卡里余额', s.balanceYuan === bal / 100, '汇总=' + s.balanceYuan)
ok('负债 = 未消费储值', s.liabilityYuan === bal / 100)

console.log('\n════════════════════════════')
console.log('  通过 ' + pass + '  失败 ' + fail)
console.log('════════════════════════════')
db.exec('DELETE FROM MemberCardLog')
db.exec('DELETE FROM MemberCard')
db.close()
process.exit(fail > 0 ? 1 : 0)
