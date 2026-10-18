/**
 * member.ts - 会员卡核心业务层（v1.1.37 · 2026-10-07 清禾）
 *
 * 设计三条铁律：
 *
 * 1) 金额一律用「分」的整数（Int cents），绝不用 Float。
 *    Float 存钱迟早出 0.1 + 0.2 != 0.3 的账，药店那套 schema 满地 Float 是历史债。
 *
 * 2) 余额永远不能直接改。
 *    任何变动必须先写 MemberCardLog（谁、什么时候、改了多少、改前改后多少），
 *    再把 balanceCents 落到新值。余额和流水必须能对得上。
 *
 * 3) 等级由「累计实付」自动算，不手工指定。
 *    等级是结果不是输入 —— 店长不该能手动把客人升成钻石卡。
 *
 * 业务背景：理发店会员 = 储值卡 + 等级折扣。
 * 次卡（剪发10次）以后再说，v1 不做，避免搞复杂。
 */

import Database from 'better-sqlite3'
import { resolveDbPath } from './db-path'

// ⭐ v1.1.37 (2026-10-07 清禾)：绝对路径兜底 + 环境变量可覆盖。
// 绝对路径是因为 standalone 进程的 cwd 是 .next/standalone/...，相对路径会指向错的 db
// 文件（跟 /api/queues 同一个坑）。但绝对路径让 3071 暂存测试没法指向副本，
// 所以留 MEMBER_DB_PATH 出口：暂存验证时打副本，绝不碰生产库。
export const DB_PATH = resolveDbPath()

export function getDb() {
  return new Database(DB_PATH)
}

// ── 等级规则 ────────────────────────────────────────────────
export interface LevelRule {
  key: string
  label: string
  minRechargeCents: number
  discount: number   // 1 = 不打折，0.9 = 九折
}

export const LEVELS: LevelRule[] = [
  { key: 'normal',  label: '普通', minRechargeCents: 0,     discount: 1.0 },
  { key: 'silver',  label: '银卡', minRechargeCents: 50000, discount: 0.95 },
  { key: 'gold',    label: '金卡', minRechargeCents: 200000, discount: 0.9 },
  { key: 'diamond', label: '钻石', minRechargeCents: 500000, discount: 0.85 },
]

export function levelOf(rechargeCents: number): LevelRule {
  let hit = LEVELS[0]
  for (const l of LEVELS) if (rechargeCents >= l.minRechargeCents) hit = l
  return hit
}

// ── 工具 ────────────────────────────────────────────────────
export function yuanToCents(yuan: number): number {
  return Math.round(Number(yuan) * 100)
}
export function centsToYuan(cents: number): number {
  return Number((cents / 100).toFixed(2))
}

/** 手机号归一化：去掉空格 / 横线 / +86，保留 11 位数字 */
export function normalizePhone(raw: string): string {
  let p = String(raw || '').replace(/[\s-]/g, '')
  if (p.startsWith('+86')) p = p.slice(3)
  if (p.startsWith('86') && p.length === 13) p = p.slice(2)
  return p
}

export function assertMerchantId(merchantId: string) {
  const id = (merchantId || '').trim()
  if (!id) throw new Error('merchantId 必填')
  if (!/^m_[a-zA-Z0-9_]+$/.test(id)) throw new Error('merchantId 格式不对: ' + id)
  return id
}

export interface MemberCardRow {
  id: string
  merchantId: string
  phone: string
  nickname: string | null
  balanceCents: number
  bonusCents: number
  rechargeCents: number
  consumeCents: number
  visitCount: number
  level: string
  status: string
  createdAt: string
  updatedAt: string
}

// ── 查 ──────────────────────────────────────────────────────
export function listCards(db: Database.Database, merchantId: string) {
  const rows = db
    .prepare(
      'SELECT * FROM MemberCard WHERE merchantId = ? ORDER BY rechargeCents DESC, createdAt DESC'
    )
    .all(merchantId) as unknown as MemberCardRow[]
  return rows.map(decorate)
}

export function getCard(db: Database.Database, merchantId: string, phone: string) {
  const row = db
    .prepare('SELECT * FROM MemberCard WHERE merchantId = ? AND phone = ?')
    .get(merchantId, phone) as unknown as MemberCardRow | undefined
  return row ? decorate(row) : null
}

function decorate(r: MemberCardRow) {
  const lv = levelOf(r.rechargeCents)
  return {
    ...r,
    balanceYuan: centsToYuan(r.balanceCents),
    bonusYuan: centsToYuan(r.bonusCents),
    rechargeYuan: centsToYuan(r.rechargeCents),
    consumeYuan: centsToYuan(r.consumeCents),
    levelLabel: lv.label,
    discount: lv.discount,
    nextLevel: LEVELS.find((l) => l.minRechargeCents > r.rechargeCents) || null,
    toNextCents: (() => {
      const n = LEVELS.find((l) => l.minRechargeCents > r.rechargeCents)
      return n ? n.minRechargeCents - r.rechargeCents : 0
    })(),
  }
}

// ── 写：所有入口都走事务，保证「流水 + 余额」原子 ──────────────
function writeLog(
  db: Database.Database,
  merchantId: string,
  cardId: string,
  p: {
    type: string
    amountCents?: number
    bonusCents?: number
    changeCents?: number
    balanceAfter: number
    service?: string | null
    orderNo?: string | null
    note?: string | null
    operator?: string | null
  }
) {
  db.prepare(
    `INSERT INTO MemberCardLog
     (id, merchantId, cardId, type, amountCents, bonusCents, changeCents,
      balanceAfter, service, orderNo, note, operator, createdAt)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))`
  ).run(
    'mcl_' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36),
    merchantId,
    cardId,
    p.type,
    p.amountCents ?? 0,
    p.bonusCents ?? 0,
    p.changeCents ?? 0,
    p.balanceAfter,
    p.service ?? null,
    p.orderNo ?? null,
    p.note ?? null,
    p.operator ?? null
  )
}

/** 开卡（已有卡则返回错误，不覆盖） */
export function openCard(
  db: Database.Database,
  p: { merchantId: string; phone: string; nickname?: string; operator?: string }
) {
  const merchantId = assertMerchantId(p.merchantId)
  const phone = normalizePhone(p.phone)
  if (!/^1\d{10}$/.test(phone)) throw new Error('手机号格式不对: ' + p.phone)

  const exist = db
    .prepare('SELECT id FROM MemberCard WHERE merchantId = ? AND phone = ?')
    .get(merchantId, phone)
  if (exist) throw new Error('这个手机号已经是会员了')

  const id = 'mc_' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36)

  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO MemberCard
       (id, merchantId, phone, nickname, balanceCents, bonusCents,
        rechargeCents, consumeCents, visitCount, level, status, createdAt, updatedAt)
       VALUES (?,?,?,?,0,0,0,0,0,'normal','active',datetime('now'),datetime('now'))`
    ).run(id, merchantId, phone, p.nickname || null)
    writeLog(db, merchantId, id, {
      type: 'open',
      balanceAfter: 0,
      note: '开卡',
      operator: p.operator || null,
    })
  })
  tx()
  return getCard(db, merchantId, phone)!
}

/** 充值：实付 amountYuan + 赠送 bonusYuan */
export function recharge(
  db: Database.Database,
  p: {
    merchantId: string
    phone: string
    amountYuan: number
    bonusYuan?: number
    note?: string
    operator?: string
  }
) {
  const merchantId = assertMerchantId(p.merchantId)
  const phone = normalizePhone(p.phone)
  const amountCents = yuanToCents(p.amountYuan)
  const bonusCents = yuanToCents(p.bonusYuan || 0)

  if (amountCents <= 0) throw new Error('充值金额必须大于 0')
  if (amountCents > 100000000) throw new Error('单笔充值不能超过 100 万元')

  const card = db
    .prepare('SELECT * FROM MemberCard WHERE merchantId = ? AND phone = ?')
    .get(merchantId, phone) as unknown as MemberCardRow | undefined
  if (!card) throw new Error('没有这张卡，先开卡')
  if (card.status !== 'active') throw new Error('卡已' + card.status + '，不能充值')

  const newBalance = card.balanceCents + amountCents + bonusCents
  const newRecharge = card.rechargeCents + amountCents
  const lv = levelOf(newRecharge)

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE MemberCard SET balanceCents = ?, bonusCents = bonusCents + ?,
       rechargeCents = ?, level = ?, updatedAt = datetime('now')
       WHERE id = ?`
    ).run(newBalance, bonusCents, newRecharge, lv.key, card.id)
    writeLog(db, merchantId, card.id, {
      type: 'recharge',
      amountCents,
      bonusCents,
      changeCents: amountCents + bonusCents,
      balanceAfter: newBalance,
      note: p.note || null,
      operator: p.operator || null,
    })
  })
  tx()
  return getCard(db, merchantId, phone)!
}

/** 消费扣款：余额不足直接拒绝，不允许透支 */
export function consume(
  db: Database.Database,
  p: {
    merchantId: string
    phone: string
    amountYuan: number
    service?: string
    orderNo?: string
    operator?: string
  }
) {
  const merchantId = assertMerchantId(p.merchantId)
  const phone = normalizePhone(p.phone)
  const amountCents = yuanToCents(p.amountYuan)

  if (amountCents <= 0) throw new Error('扣款金额必须大于 0')

  const card = db
    .prepare('SELECT * FROM MemberCard WHERE merchantId = ? AND phone = ?')
    .get(merchantId, phone) as unknown as MemberCardRow | undefined
  if (!card) throw new Error('没有这张卡')
  if (card.status !== 'active') throw new Error('卡已' + card.status + '，不能扣款')
  if (card.balanceCents < amountCents)
    throw new Error(
      '余额不足：还剩 ¥' +
        centsToYuan(card.balanceCents) +
        '，这笔要 ¥' +
        centsToYuan(amountCents)
    )

  const newBalance = card.balanceCents - amountCents
  const newConsume = card.consumeCents + amountCents

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE MemberCard SET balanceCents = ?, consumeCents = ?,
       visitCount = visitCount + 1, updatedAt = datetime('now')
       WHERE id = ?`
    ).run(newBalance, newConsume, card.id)
    writeLog(db, merchantId, card.id, {
      type: 'consume',
      amountCents,
      changeCents: -amountCents,
      balanceAfter: newBalance,
      service: p.service || null,
      orderNo: p.orderNo || null,
      operator: p.operator || null,
    })
  })
  tx()
  return getCard(db, merchantId, phone)!
}

/** 手工调整：店长纠错用，必须写原因 */
export function adjust(
  db: Database.Database,
  p: {
    merchantId: string
    phone: string
    deltaYuan: number
    reason: string
    operator?: string
  }
) {
  const merchantId = assertMerchantId(p.merchantId)
  const phone = normalizePhone(p.phone)
  const delta = yuanToCents(p.deltaYuan)

  if (delta === 0) throw new Error('调整金额不能是 0')
  if (!p.reason || !p.reason.trim()) throw new Error('调整必须写原因')

  const card = db
    .prepare('SELECT * FROM MemberCard WHERE merchantId = ? AND phone = ?')
    .get(merchantId, phone) as unknown as MemberCardRow | undefined
  if (!card) throw new Error('没有这张卡')

  const newBalance = card.balanceCents + delta
  if (newBalance < 0) throw new Error('调整后余额会变成负数，不允许')

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE MemberCard SET balanceCents = ?, updatedAt = datetime('now') WHERE id = ?`
    ).run(newBalance, card.id)
    writeLog(db, merchantId, card.id, {
      type: 'adjust',
      amountCents: delta,
      changeCents: delta,
      balanceAfter: newBalance,
      note: p.reason.trim(),
      operator: p.operator || null,
    })
  })
  tx()
  return getCard(db, merchantId, phone)!
}

/** 冻结 / 解冻 / 注销 */
export function setStatus(
  db: Database.Database,
  p: { merchantId: string; phone: string; status: string; operator?: string }
) {
  const merchantId = assertMerchantId(p.merchantId)
  const phone = normalizePhone(p.phone)
  const ok = ['active', 'frozen', 'cancelled']
  if (!ok.includes(p.status)) throw new Error('状态只能是 ' + ok.join('/'))

  const card = db
    .prepare('SELECT * FROM MemberCard WHERE merchantId = ? AND phone = ?')
    .get(merchantId, phone) as unknown as MemberCardRow | undefined
  if (!card) throw new Error('没有这张卡')

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE MemberCard SET status = ?, updatedAt = datetime('now') WHERE id = ?`
    ).run(p.status, card.id)
    writeLog(db, merchantId, card.id, {
      type: p.status === 'active' ? 'unfreeze' : p.status,
      balanceAfter: card.balanceCents,
      note: '状态改为 ' + p.status,
      operator: p.operator || null,
    })
  })
  tx()
  return getCard(db, merchantId, phone)!
}

export function listLogs(
  db: Database.Database,
  merchantId: string,
  phone: string,
  limit = 50
) {
  return db
    .prepare(
      `SELECT l.* FROM MemberCardLog l
       JOIN MemberCard c ON c.id = l.cardId
       WHERE l.merchantId = ? AND c.phone = ?
       ORDER BY l.createdAt DESC, l.rowid DESC
       LIMIT ?`
    )
    .all(merchantId, normalizePhone(phone), limit)
}

/** 汇总：给店长看总览 */
export function summary(db: Database.Database, merchantId: string) {
  const r = db
    .prepare(
      `SELECT COUNT(*) cards,
              COALESCE(SUM(balanceCents),0) balance,
              COALESCE(SUM(rechargeCents),0) recharge,
              COALESCE(SUM(consumeCents),0) consume
       FROM MemberCard WHERE merchantId = ? AND status != 'cancelled'`
    )
    .get(merchantId) as any
  return {
    cards: r.cards,
    balanceYuan: centsToYuan(r.balance),
    rechargeYuan: centsToYuan(r.recharge),
    consumeYuan: centsToYuan(r.consume),
    /** 未消费负债：储值卡里的钱还没服务出去，这是店主的应付责任 */
    liabilityYuan: centsToYuan(r.balance),
  }
}
