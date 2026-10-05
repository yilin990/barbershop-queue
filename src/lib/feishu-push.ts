/**
 * feishu-push.ts — 飞书消息推送封装（2026-08-02 清禾 P0）
 *
 * 3 个核心推送场景（奕霖"会员生态"粘性催化剂）：
 *   1. 券剩 3 天过期提醒 → 引导用户回店
 *   2. 积分入账通知 → 让用户感知余额
 *   3. 订单状态变化 → 待取货/已完成
 *
 * 设计：
 *   - 异步发送（fire-and-forget），不阻塞主流程
 *   - 失败重试 3 次（指数退避）
 *   - 失败时仅 console.error（不抛错，不影响订单流程）
 *   - 收件人：通过 phone 查 Customer → 获取飞书 open_id
 */

import { prisma } from './db'

interface PushResult {
  success: boolean
  error?: string
  retryCount: number
}

/**
 * 通过 phone 查 Customer 获取飞书 user open_id
 * 注：当前 schema 没有飞书 open_id 字段，userStore 也不存
 * 暂时用 phone 自身做标记（实际生产需要扩展）
 */
async function getUserOpenId(phone: string): Promise<string | null> {
  try {
    // TODO: 这里将来要查飞书 open_id 映射
    // 暂时用 phone hash 做标记（生产环境替换为真实飞书 user_id）
    const user = await prisma.$queryRawUnsafe<any[]>(
      `SELECT phone FROM Customer WHERE phone = ? LIMIT 1`,
      phone
    )
    return user.length > 0 ? `phone:${phone}` : null
  } catch {
    return null
  }
}

/**
 * 核心发送函数：调用飞书发送消息
 * 使用 OpenClaw 内置的 message 工具发送（无需 webhook 配置）
 */
async function sendFeishu(
  openId: string,
  title: string,
  content: string,
  retryCount = 0
): Promise<PushResult> {
  const MAX_RETRY = 3
  try {
    // 在 Next.js 中不能直接用 OpenClaw message 工具（需要 gateway）
    // 这里改用 HTTP 触发 webhook（已配置的飞书机器人 webhook URL）
    // 暂时降级：写入数据库推送信道，由 cron 批量发送
    await prisma.$executeRawUnsafe(
      `INSERT INTO PushQueue (id, type, target, title, content, status, createdAt)
       VALUES (?, ?, ?, ?, ?, 'pending', datetime('now'))`,
      `pq_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      'feishu',
      openId,
      title,
      content
    )
    return { success: true, retryCount }
  } catch (err: any) {
    console.error(`[feishu-push] send failed (retry ${retryCount}):`, err?.message)
    if (retryCount < MAX_RETRY) {
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, retryCount)))
      return sendFeishu(openId, title, content, retryCount + 1)
    }
    return { success: false, error: err?.message, retryCount }
  }
}

/**
 * 场景 1：券剩 N 天过期提醒
 */
export async function pushCouponExpiring(
  phone: string,
  couponName: string,
  couponValue: number,
  minSpend: number,
  daysLeft: number
): Promise<PushResult | null> {
  const openId = await getUserOpenId(phone)
  if (!openId) return null

  const title = `🎟️ 您的「${couponName}」券还剩 ${daysLeft} 天过期`
  const content = daysLeft <= 3
    ? `⚠️ 即将过期！满 ¥${minSpend} 减 ¥${couponValue}，点击立享优惠 → https://zhilin.qingheos.cn/me/coupons`
    : `您的「${couponName}」还剩 ${daysLeft} 天过期，及时使用哦～`

  return sendFeishu(openId, title, content)
}

/**
 * 场景 2：积分入账通知
 */
export async function pushPointsEarned(
  phone: string,
  earned: number,
  newBalance: number,
  orderNo: string,
  finalAmount: number
): Promise<PushResult | null> {
  const openId = await getUserOpenId(phone)
  if (!openId) return null

  const title = `💰 您在造型师助手消费 ¥${finalAmount.toFixed(2)}`
  const content = `获得 +${earned} 积分，余额 ${newBalance} 分。下次可抵 ¥${(newBalance * 0.02).toFixed(2)}（50 分 = ¥1）→ https://zhilin.qingheos.cn/me`

  return sendFeishu(openId, title, content)
}

/**
 * 场景 3：订单状态变化通知
 */
export async function pushOrderStatus(
  phone: string,
  orderNo: string,
  status: string,
  pickupCode?: string
): Promise<PushResult | null> {
  const openId = await getUserOpenId(phone)
  if (!openId) return null

  const STATUS_LABEL: Record<string, { label: string; icon: string; tip: string }> = {
    pending: { label: '待付款', icon: '⏳', tip: '请尽快支付' },
    paid: { label: '已付款', icon: '✅', tip: '商家即将备货' },
    preparing: { label: '备货中', icon: '📦', tip: '商家正在备货' },
    ready: { label: '待取货', icon: '🏪', tip: `商品已到店！出示取货码 ${pickupCode || 'XXX'} 取货` },
    delivered: { label: '已完成', icon: '✅', tip: '订单完成，欢迎再来' },
    cancelled: { label: '已取消', icon: '❌', tip: '订单已取消' },
  }
  const s = STATUS_LABEL[status]
  if (!s) return null

  const title = `${s.icon} 订单 ${orderNo} ${s.label}`
  const content = `${s.tip} → https://zhilin.qingheos.cn/orders`

  return sendFeishu(openId, title, content)
}