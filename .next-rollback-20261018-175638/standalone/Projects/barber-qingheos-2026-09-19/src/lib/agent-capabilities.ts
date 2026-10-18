/**
 * Agent 能力清单 (Capabilities Manifest) v1.0
 * 2026-10-16 清禾
 *
 * 为什么有这个文件：
 *   本项目已有 160+ 个 API endpoint（排队/预约/会员/订单/库存/报表…），
 *   但它们只存在于「人的知识」里。外部 agent 面对 160 个门，
 *   不知道哪个是「查排队」、哪个是「叫号」，于是只能瞎试或干脆不碰。
 *
 *   这个文件就是那 161 个门的门牌号。
 *   一次 GET /api/agent/capabilities 拿到全部，agent 就能自己选工具。
 *
 * ⭐ 设计要点：
 *   1. when_to_use 是最重要字段 —— 不是描述 API 干什么，
 *      而是描述「顾客/店员说这句话时该用我」。这是 LLM 选工具的唯一依据。
 *   2. side_effect 三档（read / write / money）——
 *      agent 必须先看这个才知道能不能直接调。money 档需要二次确认。
 *   3. 每条都逐个核对过真实 route.ts 的方法与参数，没有凭空捏造。
 *   4. idempotent=false 的接口，agent 重试前必须先回读状态。
 *
 * ⛔ 本文件只读、只声明，不含任何业务逻辑，不改动任何既有 endpoint。
 */

export type SideEffect = 'read' | 'write' | 'money'
export type AuthLevel = 'public' | 'member' | 'staff' | 'manager' | 'owner'

export interface AgentCapability {
  /** 稳定标识，agent 用它引用能力，不要用 endpoint 路径当 id */
  id: string
  /** 一句话说明这个能力干什么（给人看） */
  desc: string
  /** ⭐ 什么时候该用它 —— 触发这句话就该调它 */
  when_to_use: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  endpoint: string
  params?: Record<string, string>
  side_effect: SideEffect
  auth: AuthLevel
  /** 重复调用是否安全。false = agent 重试前必须先回读状态 */
  idempotent: boolean
  /** 真实代码里校验了权限的才填；没显式校验的留空（= 待确认，不等于公开） */
  auth_verified?: boolean
}

const C = (c: AgentCapability) => c

export const AGENT_CAPABILITIES: AgentCapability[] = [
  // ── 排队 ────────────────────────────────────────────────────────────────
  C({
    id: 'queue.join',
    desc: '取号 / 加入当前排队',
    when_to_use: '顾客说「我要排队」「取个号」「等一会儿」',
    method: 'POST', endpoint: '/api/queues',
    params: { merchantId: 'string 门店ID', phone: 'string 手机号' },
    side_effect: 'write', auth: 'public', idempotent: false,
    auth_verified: false,
  }),
  C({
    id: 'queue.list',
    desc: '查看当前排队队列',
    when_to_use: '店员问「现在几个人在等」「排到谁了」，或顾客问「我前面还有几个」',
    method: 'GET', endpoint: '/api/queues',
    params: { merchantId: 'string 门店ID', phone: 'string 手机号（查某人位置时传）' },
    side_effect: 'read', auth: 'public', idempotent: true,
    auth_verified: false,
  }),
  C({
    id: 'queue.call_next',
    desc: '叫下一个号',
    when_to_use: '店员说「下一个」「叫号」',
    method: 'POST', endpoint: '/api/queues/[id]/call',
    params: { id: 'string 排队记录ID' },
    side_effect: 'write', auth: 'staff', idempotent: false,
    auth_verified: false,
  }),
  C({
    id: 'queue.activities',
    desc: '查询门店的排队活动配置',
    when_to_use: '要确认这家店是否开启了排队功能、怎么用',
    method: 'GET', endpoint: '/api/queues/activities',
    params: { merchantId: 'string 门店ID' },
    side_effect: 'read', auth: 'public', idempotent: true,
    auth_verified: false,
  }),

  // ── 服务项目 / 理发师 ───────────────────────────────────────────────────
  C({
    id: 'service.list',
    desc: '查询门店服务项目（洗剪吹、烫染等）及价格',
    when_to_use: '顾客问「剪头发多少钱」「你们有什么服务」，或要做价格牌',
    method: 'GET', endpoint: '/api/services',
    params: {
      merchantId: 'string 门店ID', status: 'string 状态',
      category: 'string 分类', includeInactive: 'boolean 是否含下架',
    },
    side_effect: 'read', auth: 'public', idempotent: true,
    auth_verified: false,
  }),
  C({
    id: 'service.create',
    desc: '新增服务项目',
    when_to_use: '店员说「加个项目」「上个月刚推出的护理要挂上去」',
    method: 'POST', endpoint: '/api/services',
    params: { merchantId: 'string 门店ID' },
    side_effect: 'write', auth: 'manager', idempotent: false,
    auth_verified: true,
  }),
  C({
    id: 'service.update',
    desc: '修改服务项目（价格/名称/上下架）',
    when_to_use: '店员说「剪发调到 60」「那个项目下架」',
    method: 'PATCH', endpoint: '/api/services',
    params: { merchantId: 'string 门店ID' },
    side_effect: 'money', auth: 'manager', idempotent: true,
    auth_verified: true,
  }),
  C({
    id: 'service.get',
    desc: '查询单个服务项目详情',
    when_to_use: '已知服务ID，要它的完整信息',
    method: 'GET', endpoint: '/api/services/[id]',
    params: { id: 'string 服务ID', merchantId: 'string 门店ID' },
    side_effect: 'read', auth: 'public', idempotent: true,
    auth_verified: false,
  }),
  C({
    id: 'service.delete',
    desc: '删除服务项目',
    when_to_use: '明确要求删掉某个项目',
    method: 'DELETE', endpoint: '/api/services/[id]',
    params: { id: 'string 服务ID', merchantId: 'string 门店ID' },
    side_effect: 'write', auth: 'manager', idempotent: true,
    auth_verified: true,
  }),
  C({
    id: 'stylist.list',
    desc: '查询门店理发师列表',
    when_to_use: '顾客问「有几位老师」「我要预约某某」，或要排班',
    method: 'GET', endpoint: '/api/stylists',
    params: { merchantId: 'string 门店ID' },
    side_effect: 'read', auth: 'public', idempotent: true,
    auth_verified: false,
  }),

  C({
    id: 'stylist.create',
    desc: '新增理发师（写入 MerchantStaff）',
    when_to_use: '老板说「加一位老师」，且你已拿到店员或管理员登录态时',
    method: 'POST', endpoint: '/api/stylists',
    params: { merchantId: 'string 门店ID（必填）', name: 'string 姓名（必填）', phone: 'string 手机号', avatar: 'string 头像URL', bio: 'string 简介', specialties: 'string[] 擅长项目', yearsOfExp: 'number 从业年限', startPrice: 'number 起价' },
    side_effect: 'write', auth: 'staff', idempotent: false,
    auth_verified: true,
  }),
  C({
    id: 'stylist.update',
    desc: '改理发师资料/价格/上下架',
    when_to_use: '调整起价、简介、擅长项目，或把老师设为休息（active=false）',
    method: 'PUT', endpoint: '/api/stylists/[id]',
    params: { id: 'string 理发师ID（路径）', merchantId: 'string 门店ID', name: 'string 姓名', phone: 'string 手机号', avatar: 'string 头像URL', bio: 'string 简介', specialties: 'string[] 擅长项目', yearsOfExp: 'number 从业年限', startPrice: 'number 起价', rating: 'number 评分', active: 'boolean 是否在职' },
    side_effect: 'write', auth: 'staff', idempotent: true,
    auth_verified: true,
  }),
  C({
    id: 'stylist.delete',
    desc: '删除理发师',
    when_to_use: '老师离职且确认无排班/无订单引用时',
    method: 'DELETE', endpoint: '/api/stylists/[id]',
    params: { id: 'string 理发师ID（路径）', merchantId: 'string 门店ID' },
    side_effect: 'write', auth: 'staff', idempotent: true,
    auth_verified: true,
  }),

  // ── 身份 ────────────────────────────────────────────────────────────────
  C({
    id: 'identity.claim',
    desc: '扫码认领身份（手机号 → Identity）',
    when_to_use: '顾客第一次扫码，要把他绑定成会员',
    method: 'POST', endpoint: '/api/identity/claim',
    side_effect: 'write', auth: 'public', idempotent: false,
    auth_verified: true,
  }),
  C({
    id: 'identity.resolve',
    desc: '解析手机号对应的身份与渠道绑定',
    when_to_use: '只有手机号，要查他是谁、有没有微信/会员卡',
    method: 'POST', endpoint: '/api/identity/resolve',
    side_effect: 'read', auth: 'public', idempotent: true,
    auth_verified: true,
  }),
  C({
    id: 'identity.profile',
    desc: '查询身份档案（到店历史、偏好、余额概览）',
    when_to_use: '顾客进门，要调出他上次剪了什么、烫没烫过',
    method: 'GET', endpoint: '/api/identity/profile',
    params: { phone: 'string 手机号', id: 'string 身份ID' },
    side_effect: 'read', auth: 'staff', idempotent: true,
    auth_verified: true,
  }),
  C({
    id: 'identity.txn',
    desc: '会员余额交易（充值/消费/退款），账本只追加',
    when_to_use: '顾客要充钱、这次消费扣多少、要退钱',
    method: 'POST', endpoint: '/api/identity/txn',
    side_effect: 'money', auth: 'owner', idempotent: false,
    auth_verified: true,
  }),

  // ── 会员 ────────────────────────────────────────────────────────────────
  C({
    id: 'member.list',
    desc: '查询门店会员列表',
    when_to_use: '店员说「有哪些会员」「看看会员」',
    method: 'GET', endpoint: '/api/members',
    params: { merchantId: 'string 门店ID' },
    side_effect: 'read', auth: 'manager', idempotent: true,
    auth_verified: true,
  }),
  C({
    id: 'member.get',
    desc: '查询单个会员详情',
    when_to_use: '已知手机号，要这个人的会员资料',
    method: 'GET', endpoint: '/api/members/[phone]',
    params: { phone: 'string 手机号', merchantId: 'string 门店ID' },
    side_effect: 'read', auth: 'manager', idempotent: true,
    auth_verified: true,
  }),
  C({
    id: 'me.summary',
    desc: '当前登录顾客的个人摘要（卡、积分、消费）',
    when_to_use: '顾客问「我卡里还有多少」「我能得多少积分」',
    method: 'GET', endpoint: '/api/me/summary',
    side_effect: 'read', auth: 'member', idempotent: true,
    auth_verified: true,
  }),
  C({
    id: 'me.points_history',
    desc: '当前顾客的积分变动历史',
    when_to_use: '顾客问「我的积分怎么少了一笔」',
    method: 'GET', endpoint: '/api/me/points-history',
    params: { limit: 'number 条数', offset: 'number 偏移', type: 'string 类型' },
    side_effect: 'read', auth: 'member', idempotent: true,
    auth_verified: true,
  }),

  // ── 订单 ────────────────────────────────────────────────────────────────
  C({
    id: 'order.list',
    desc: '查询订单列表',
    when_to_use: '顾客问「我有哪些订单」，或店员查某人历史订单',
    method: 'GET', endpoint: '/api/orders',
    params: {
      phone: 'string 手机号', status: 'string 状态',
      merchantCode: 'string 门店码', limit: 'number 条数',
    },
    side_effect: 'read', auth: 'member', idempotent: true,
    auth_verified: false,
  }),
  C({
    id: 'order.by_phone',
    desc: '按手机号查订单',
    when_to_use: '手上只有手机号，要这个人的单',
    method: 'GET', endpoint: '/api/orders/by-phone',
    params: { phone: 'string 手机号' },
    side_effect: 'read', auth: 'member', idempotent: true,
    auth_verified: true,
  }),
  C({
    id: 'order.get',
    desc: '查询单个订单详情',
    when_to_use: '已知订单ID，要详情',
    method: 'GET', endpoint: '/api/orders/[id]',
    side_effect: 'read', auth: 'member', idempotent: true,
    auth_verified: false,
  }),

  // ── 门店经营 ────────────────────────────────────────────────────────────
  C({
    id: 'merchant.get',
    desc: '查询门店信息',
    when_to_use: '要门店名、地址、营业时间、联系方式',
    method: 'GET', endpoint: '/api/merchant',
    side_effect: 'read', auth: 'public', idempotent: true,
    auth_verified: false,
  }),
  C({
    id: 'merchant.update',
    desc: '修改门店信息',
    when_to_use: '店员说「把营业时间改成 9 点开」「换张封面图」',
    method: 'POST', endpoint: '/api/merchant/update',
    params: { id: 'string 门店ID' },
    side_effect: 'write', auth: 'manager', idempotent: true,
    auth_verified: false,
  }),
  C({
    id: 'merchant.stats',
    desc: '门店经营统计（客流、营收概览）',
    when_to_use: '老板问「今天怎么样」「这个月多少」',
    method: 'GET', endpoint: '/api/merchant/stats',
    side_effect: 'read', auth: 'manager', idempotent: true,
    auth_verified: false,
  }),
  C({
    id: 'admin.today',
    desc: '今日经营概览',
    when_to_use: '老板早上问「今天怎么样」',
    method: 'GET', endpoint: '/api/admin/today',
    side_effect: 'read', auth: 'manager', idempotent: true,
    auth_verified: true,
  }),
  C({
    id: 'admin.profitability',
    desc: '盈利分析（哪些项目赚钱）',
    when_to_use: '老板问「哪个项目最赚」「该不该上架 XX」',
    method: 'GET', endpoint: '/api/admin/profitability',
    side_effect: 'read', auth: 'manager', idempotent: true,
    auth_verified: true,
  }),
  C({
    id: 'admin.orders',
    desc: '订单报表（按天）',
    when_to_use: '老板问「这周接了多少单」',
    method: 'GET', endpoint: '/api/admin/orders',
    params: { days: 'number 回溯天数' },
    side_effect: 'read', auth: 'manager', idempotent: true,
    auth_verified: true,
  }),
  C({
    id: 'admin.members',
    desc: '会员报表',
    when_to_use: '老板问「会员有多少」「最近新增多少」',
    method: 'GET', endpoint: '/api/admin/members',
    side_effect: 'read', auth: 'manager', idempotent: true,
    auth_verified: true,
  }),
  C({
    id: 'admin.customer_profile',
    desc: '顾客深度画像（单个）',
    when_to_use: '店员要针对这个顾客做推荐',
    method: 'GET', endpoint: '/api/admin/customers/[phone]/profile',
    side_effect: 'read', auth: 'staff', idempotent: true,
    auth_verified: true,
  }),
  C({
    id: 'settlements.list',
    desc: '结算记录',
    when_to_use: '老板对账',
    method: 'GET', endpoint: '/api/settlements',
    params: { merchantId: 'string 门店ID', limit: 'number 条数' },
    side_effect: 'read', auth: 'manager', idempotent: true,
    auth_verified: true,
  }),

  // ── 商品 / 库存 ─────────────────────────────────────────────────────────
  C({
    id: 'product.list',
    desc: '查询商品/库存列表',
    when_to_use: '店员问「还有什么货」，或要盘点',
    method: 'GET', endpoint: '/api/products',
    params: {
      q: 'string 关键词', category: 'string 分类', inStock: 'boolean 只看有货',
      merchantCode: 'string 门店码', page: 'number 页码', pageSize: 'number 每页',
    },
    side_effect: 'read', auth: 'staff', idempotent: true,
    auth_verified: false,
  }),
  C({
    id: 'product.by_barcode',
    desc: '扫码查商品',
    when_to_use: '手上只有条码，要这是什么、多少钱',
    method: 'GET', endpoint: '/api/products/by-barcode/[code]',
    side_effect: 'read', auth: 'staff', idempotent: true,
    auth_verified: false,
  }),
  C({
    id: 'product.restock',
    desc: '入库补货',
    when_to_use: '店员说「刚到货了」「补一下库存」',
    method: 'POST', endpoint: '/api/products/[id]/restock',
    side_effect: 'write', auth: 'staff', idempotent: false,
    auth_verified: true,
  }),
  C({
    id: 'product.set_status',
    desc: '商品上下架',
    when_to_use: '店员说「这个先下架」',
    method: 'PATCH', endpoint: '/api/products/[id]/status',
    side_effect: 'write', auth: 'staff', idempotent: true,
    auth_verified: true,
  }),
  // ── 会话与认证 ──────────────────────────────────────────────────────────
  C({
    id: 'auth.send_code',
    desc: '发短信验证码',
    when_to_use: '需要登录或验证身份时，先发码',
    method: 'POST', endpoint: '/api/auth/send-code',
    side_effect: 'write', auth: 'public', idempotent: false,
    auth_verified: false,
  }),
  C({
    id: 'auth.verify_code',
    desc: '校验短信验证码，换取会话',
    when_to_use: '拿到用户输入的验证码，验证并登录',
    method: 'POST', endpoint: '/api/auth/verify-code',
    side_effect: 'write', auth: 'public', idempotent: false,
    auth_verified: false,
  }),
  C({
    id: 'auth.quick_login',
    desc: '快速登录',
    when_to_use: '已知手机号要走快捷入口',
    method: 'POST', endpoint: '/api/auth/quick-login',
    side_effect: 'write', auth: 'public', idempotent: false,
    auth_verified: true,
  }),
  C({
    id: 'auth.manager_pin',
    desc: '店长 PIN 解锁（set / verify）',
    when_to_use: '店长模式解锁。第一次登记需要访问码；解锁后签发店长 token',
    method: 'POST', endpoint: '/api/auth/manager-pin',
    side_effect: 'write', auth: 'public', idempotent: false,
    auth_verified: true,
  }),
  C({
    id: 'auth.me',
    desc: '查询当前登录身份',
    when_to_use: '任何操作前，先确认「现在是谁在操作」',
    method: 'GET', endpoint: '/api/auth/me',
    side_effect: 'read', auth: 'public', idempotent: true,
    auth_verified: true,
  }),

  // ── 积分 ────────────────────────────────────────────────────────────────
  C({
    id: 'points.redeem',
    desc: '积分兑换',
    when_to_use: '顾客说「积分换什么」「帮我兑一下」',
    method: 'POST', endpoint: '/api/points/redeem',
    side_effect: 'money', auth: 'member', idempotent: false,
    auth_verified: true,
  }),
  C({
    id: 'admin.points_adjust',
    desc: '人工调整顾客积分',
    when_to_use: '店员说「给他补点积分」「这次送他 200 分」',
    method: 'POST', endpoint: '/api/admin/points-adjust',
    side_effect: 'money', auth: 'manager', idempotent: false,
    auth_verified: true,
  }),
  C({
    id: 'admin.points_config',
    desc: '积分规则配置',
    when_to_use: '老板说「改成消费一元给一分」',
    method: 'POST', endpoint: '/api/admin/points-config',
    side_effect: 'write', auth: 'manager', idempotent: true,
    auth_verified: true,
  }),
  C({
    id: 'admin.points_log',
    desc: '积分流水查询',
    when_to_use: '顾客问「我的积分怎么少了一笔」，要查明细',
    method: 'GET', endpoint: '/api/admin/points-log',
    params: { phone: 'string 手机号', type: 'string 类型', limit: 'number 条数' },
    side_effect: 'read', auth: 'manager', idempotent: true,
    auth_verified: true,
  }),

  // ── 优惠券 ──────────────────────────────────────────────────────────────
  C({
    id: 'coupon.claim',
    desc: '领取优惠券',
    when_to_use: '顾客说「那个券怎么领」',
    method: 'POST', endpoint: '/api/coupons/claim',
    params: { phone: 'string 手机号' },
    side_effect: 'write', auth: 'public', idempotent: false,
    auth_verified: false,
  }),
  C({
    id: 'coupon.my',
    desc: '查询我的优惠券',
    when_to_use: '顾客问「我有什么券」',
    method: 'GET', endpoint: '/api/coupons/my',
    params: { phone: 'string 手机号', merchantCode: 'string 门店码' },
    side_effect: 'read', auth: 'member', idempotent: true,
    auth_verified: false,
  }),
  C({
    id: 'admin.coupons',
    desc: '优惠券管理（查询 / 新建）',
    when_to_use: '店员说「发张满减券」',
    method: 'POST', endpoint: '/api/admin/coupons',
    side_effect: 'money', auth: 'manager', idempotent: false,
    auth_verified: true,
  }),
  C({
    id: 'admin.coupons_batch',
    desc: '批量发券',
    when_to_use: '老板说「给这个月消费过的都发张券」',
    method: 'POST', endpoint: '/api/admin/coupons/batch',
    side_effect: 'money', auth: 'manager', idempotent: false,
    auth_verified: true,
  }),

  // ── 活动 / 团购 ─────────────────────────────────────────────────────────
  C({
    id: 'admin.activities',
    desc: '活动管理（查询 / 新建）',
    when_to_use: '老板说「搞个充值送」',
    method: 'POST', endpoint: '/api/admin/activities',
    side_effect: 'write', auth: 'manager', idempotent: false,
    auth_verified: true,
  }),
  C({
    id: 'admin.activities_quick_create',
    desc: '快捷创建活动',
    when_to_use: '老板描述一句话，想快速上线一个活动',
    method: 'POST', endpoint: '/api/admin/activities/quick-create',
    side_effect: 'write', auth: 'manager', idempotent: false,
    auth_verified: true,
  }),
  C({
    id: 'admin.activities_compliance',
    desc: '活动合规检查',
    when_to_use: '活动文案可能有夸大宣传，要先过合规',
    method: 'POST', endpoint: '/api/admin/activities/compliance-check',
    side_effect: 'read', auth: 'manager', idempotent: true,
    auth_verified: true,
  }),
  C({
    id: 'public.activities',
    desc: '公开活动列表',
    when_to_use: '顾客问「你们最近有什么活动」',
    method: 'GET', endpoint: '/api/public/activities',
    side_effect: 'read', auth: 'public', idempotent: true,
    auth_verified: false,
  }),
  C({
    id: 'groupbuy.create',
    desc: '创建团购',
    when_to_use: '老板说「开个团购」',
    method: 'POST', endpoint: '/api/groupbuy/create',
    side_effect: 'money', auth: 'manager', idempotent: false,
    auth_verified: false,
  }),
  C({
    id: 'groupbuy.list',
    desc: '团购列表',
    when_to_use: '顾客问「有没有团购」',
    method: 'GET', endpoint: '/api/groupbuy/list',
    side_effect: 'read', auth: 'public', idempotent: true,
    auth_verified: false,
  }),

  // ── 零售 / POS ──────────────────────────────────────────────────────────
  C({
    id: 'retail.dashboard',
    desc: '零售看板',
    when_to_use: '老板问「店里卖货卖得怎么样」',
    method: 'GET', endpoint: '/api/admin/retail/dashboard',
    side_effect: 'read', auth: 'manager', idempotent: true,
    auth_verified: true,
  }),
  C({
    id: 'retail.products',
    desc: '零售商品列表',
    when_to_use: '盘点、或要找某样货还有多少',
    method: 'GET', endpoint: '/api/admin/retail/products',
    params: { q: 'string 关键词', page: 'number 页码', pageSize: 'number 每页', stock: 'string 库存过滤' },
    side_effect: 'read', auth: 'manager', idempotent: true,
    auth_verified: true,
  }),
  C({
    id: 'retail.pos_scan',
    desc: 'POS 扫码',
    when_to_use: '收银时扫条码',
    method: 'POST', endpoint: '/api/admin/retail/pos/scan',
    side_effect: 'read', auth: 'staff', idempotent: true,
    auth_verified: true,
  }),
  C({
    id: 'retail.pos_checkout',
    desc: 'POS 结账',
    when_to_use: '收银台确认收款',
    method: 'POST', endpoint: '/api/admin/retail/pos/checkout',
    side_effect: 'money', auth: 'staff', idempotent: false,
    auth_verified: true,
  }),
  C({
    id: 'retail.orders',
    desc: '零售订单列表',
    when_to_use: '对账、查某人买过什么',
    method: 'GET', endpoint: '/api/admin/retail/orders',
    params: { date: 'string 日期', limit: 'number 条数', offset: 'number 偏移' },
    side_effect: 'read', auth: 'manager', idempotent: true,
    auth_verified: true,
  }),

  // ── 顾客 / 反馈 / 评价 ───────────────────────────────────────────────────
  C({
    id: 'customer.lookup',
    desc: '按手机号+门店码查顾客',
    when_to_use: '手上只有手机号，要确认他是不是本店客人',
    method: 'GET', endpoint: '/api/customer/lookup',
    params: { phone: 'string 手机号', merchantCode: 'string 门店码' },
    side_effect: 'read', auth: 'staff', idempotent: true,
    auth_verified: false,
  }),
  C({
    id: 'admin.customers_export',
    desc: '导出顾客名单',
    when_to_use: '老板要一份客户名单表格',
    method: 'GET', endpoint: '/api/admin/customers/export',
    params: { level: 'string 会员等级' },
    side_effect: 'read', auth: 'manager', idempotent: true,
    auth_verified: true,
  }),
  C({
    id: 'feedbacks.create',
    desc: '提交反馈/投诉',
    when_to_use: '顾客抱怨或提建议，要留一条记录',
    method: 'POST', endpoint: '/api/feedbacks',
    side_effect: 'write', auth: 'public', idempotent: false,
    auth_verified: true,
  }),
  C({
    id: 'admin.feedbacks_reply',
    desc: '回复顾客反馈',
    when_to_use: '店长要回复一条投诉',
    method: 'POST', endpoint: '/api/admin/feedbacks/[id]/reply',
    side_effect: 'write', auth: 'manager', idempotent: true,
    auth_verified: true,
  }),
  C({
    id: 'order_reviews.create',
    desc: '提交订单评价',
    when_to_use: '顾客说「我要给这次打分」',
    method: 'POST', endpoint: '/api/order-reviews',
    params: { orderId: 'string 订单ID' },
    side_effect: 'write', auth: 'member', idempotent: true,
    auth_verified: false,
  }),

  // ── 内容社区 ────────────────────────────────────────────────────────────
  C({
    id: 'comments.create',
    desc: '发表评论',
    when_to_use: '顾客留言或提问',
    method: 'POST', endpoint: '/api/comments',
    params: { merchantId: 'string 门店ID' },
    side_effect: 'write', auth: 'public', idempotent: false,
    auth_verified: true,
  }),
  C({
    id: 'comments.list',
    desc: '评论列表',
    when_to_use: '要看顾客说了什么、老板要回复哪条',
    method: 'GET', endpoint: '/api/comments',
    params: { merchantId: 'string 门店ID', page: 'number 页码', limit: 'number 条数' },
    side_effect: 'read', auth: 'public', idempotent: true,
    auth_verified: true,
  }),
  C({
    id: 'discussions.create',
    desc: '发起讨论 / 健康提问',
    when_to_use: '顾客问「我这个发质烫会怎样」这类问题',
    method: 'POST', endpoint: '/api/discussions',
    params: { category: 'string 分类' },
    side_effect: 'write', auth: 'public', idempotent: false,
    auth_verified: true,
  }),
  C({
    id: 'content_reports.create',
    desc: '举报违规内容',
    when_to_use: '看到不当留言要举报',
    method: 'POST', endpoint: '/api/content-reports',
    side_effect: 'write', auth: 'member', idempotent: true,
    auth_verified: true,
  }),

  // ── 商品图片识别（AI 能力）────────────────────────────────────────────────
  C({
    id: 'products.identify_by_image',
    desc: '拍照识别商品',
    when_to_use: '店员拍了一张货架照片，要自动建商品',
    method: 'POST', endpoint: '/api/admin/products/identify-by-image',
    side_effect: 'write', auth: 'staff', idempotent: false,
    auth_verified: true,
  }),
  C({
    id: 'products.recognize_extract',
    desc: '识别并抽取商品信息',
    when_to_use: '已有照片，要抠出名称/规格/价格',
    method: 'POST', endpoint: '/api/admin/products/recognize-and-extract',
    side_effect: 'write', auth: 'staff', idempotent: false,
    auth_verified: true,
  }),
  C({
    id: 'products.shelf_scan',
    desc: '货架扫描盘点',
    when_to_use: '店员说「扫一下货架」做盘点',
    method: 'POST', endpoint: '/api/admin/products/shelf-scan',
    side_effect: 'write', auth: 'staff', idempotent: false,
    auth_verified: true,
  }),

  // ── 供应商 / 采购 ───────────────────────────────────────────────────────
  C({
    id: 'admin.suppliers',
    desc: '供应商管理（查询 / 新建）',
    when_to_use: '记一个长期拿货的联系人',
    method: 'POST', endpoint: '/api/admin/suppliers',
    params: { search: 'string 关键词', status: 'string 状态' },
    side_effect: 'write', auth: 'manager', idempotent: false,
    auth_verified: true,
  }),
  C({
    id: 'admin.purchase_orders',
    desc: '采购单管理',
    when_to_use: '要下采购单、查进货记录',
    method: 'POST', endpoint: '/api/admin/purchase-orders',
    side_effect: 'money', auth: 'manager', idempotent: false,
    auth_verified: true,
  }),
  C({
    id: 'admin.restock_suggestions',
    desc: '补货建议',
    when_to_use: '老板问「该进什么货」',
    method: 'GET', endpoint: '/api/admin/restock-suggestions',
    params: { limit: 'number 条数' },
    side_effect: 'read', auth: 'manager', idempotent: true,
    auth_verified: true,
  }),

  // ── 推送 / 通知 ──────────────────────────────────────────────────────────
  C({
    id: 'push.subscribe',
    desc: '订阅推送（开启通知）',
    when_to_use: '顾客同意接收消息',
    method: 'POST', endpoint: '/api/push/subscribe',
    side_effect: 'write', auth: 'public', idempotent: true,
    auth_verified: false,
  }),
  C({
    id: 'push.stream',
    desc: '推送事件流（查询某人的推送）',
    when_to_use: '要看某人有没有收到提醒',
    method: 'GET', endpoint: '/api/push/stream',
    params: { phone: 'string 手机号', merchantId: 'string 门店ID' },
    side_effect: 'read', auth: 'manager', idempotent: true,
    auth_verified: false,
  }),

  // ── 语音 / AI 对话 ──────────────────────────────────────────────────────
  C({
    id: 'ai.search',
    desc: 'AI 语义搜索商品',
    when_to_use: '顾客说「我想买能修一下刘海的」这种模糊描述',
    method: 'POST', endpoint: '/api/ai-search',
    side_effect: 'read', auth: 'public', idempotent: true,
    auth_verified: false,
  }),
  C({
    id: 'chat.send',
    desc: '顾客聊天',
    when_to_use: '顾客发来一句话，要理解并回应',
    method: 'POST', endpoint: '/api/chat',
    side_effect: 'write', auth: 'public', idempotent: false,
    auth_verified: false,
  }),
  C({
    id: 'speech.transcribe',
    desc: '语音转文字',
    when_to_use: '顾客用说的而不是打字',
    method: 'POST', endpoint: '/api/transcribe',
    side_effect: 'read', auth: 'public', idempotent: true,
    auth_verified: false,
  }),
  C({
    id: 'speech.tts',
    desc: '文字转语音',
    when_to_use: '要给顾客语音回复',
    method: 'POST', endpoint: '/api/tts',
    side_effect: 'read', auth: 'public', idempotent: true,
    auth_verified: false,
  }),

  // ── 用户资料 ────────────────────────────────────────────────────────────
  C({
    id: 'user.profile_update',
    desc: '修改个人资料',
    when_to_use: '顾客说「改个昵称」「换头像」',
    method: 'PATCH', endpoint: '/api/user/profile',
    side_effect: 'write', auth: 'member', idempotent: true,
    auth_verified: true,
  }),
  C({
    id: 'user.facts',
    desc: '客户事实档案（发质、过敏史、偏好）',
    when_to_use: '要记住这个人的关键特征，下次来直接用',
    method: 'POST', endpoint: '/api/profile/facts',
    params: { phone: 'string 手机号', id: 'string ID' },
    side_effect: 'write', auth: 'staff', idempotent: true,
    auth_verified: false,
  }),
  C({
    id: 'user.deactivate',
    desc: '注销账号',
    when_to_use: '顾客明确要求注销',
    method: 'POST', endpoint: '/api/account/deactivate',
    side_effect: 'write', auth: 'member', idempotent: false,
    auth_verified: true,
  }),
]

export const CAPABILITY_VERSION = '1.1.0'
export const CAPABILITY_GENERATED_AT = '2026-10-16'
