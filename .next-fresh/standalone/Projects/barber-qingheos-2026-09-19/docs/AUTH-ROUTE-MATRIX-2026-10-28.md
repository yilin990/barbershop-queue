# API 路由鉴权现状表 · 2026-10-28

> 背景：主控在生产 `127.0.0.1:3070` 实测发现**匿名**（无 cookie、无 Authorization）可以：
> 读走全店排队记录（顾客手机号/姓名/结算金额）、按手机号跨商户枚举、读结算流水、
> 读会员卡余额与流水、读订单手机号与取货码；并且可以**匿名调用写接口**
> （结算扣款 = 免单通道、任意改排队状态、任意删记录、任意取消他人预约、冒用 userId 发评价、叫号骚扰）。
>
> 本表是本轮修复后的**全量路由（165 个）鉴权现状**。
> 标注含义见下方「保护等级」。

## 保护等级

| 等级 | 含义 | 判定依据 |
|---|---|---|
| **公开（设计如此）** | 前台商品/商户资料/天气/地理等公开信息，锁死等于把店关门 | 路由内不含任何顾客 PII，且不产生写副作用 |
| **本人** | 登录态里的手机号必须等于目标手机号 | `requireSelfPhone` / `requireSelfOrShop` |
| **门店侧** | 店员/店长/管理员，且只能碰自己业务线（`m_barber_*`）下的商户 | `requireShopSide` |
| **店长侧** | 店长/管理员（动钱、删数据） | `requireManagerSide` / `requireManager` |
| **后台侧** | `/api/admin*`：middleware 要求带管理 token，route 层再验一次 | `verifyAdminRequest` / `requireStaffOrAdmin` |
| **登录端点** | 登录/发码/换会话，公开但有防爆破 | 本文件 + 限流 |

## 一、本轮重点修复（barber 客户侧）

| 接口 | 改前 | 改后 | 依据 |
|---|---|---|---|
| `GET /api/queues?merchantId=` | 匿名 200，全店顾客 PII | **门店侧**（401/403） | 排队看板是门店经营数据 |
| `GET /api/queues?phone=` | 匿名 200，跨商户按手机号枚举 | **本人**（软会话/登录态手机号必须一致） | 顾客只能看自己的单 |
| `POST /api/queues` | 匿名（设计如此） | 匿名（**保持**） | 扫码预约/取号是店内主流程，不能锁 |
| `GET /api/queues/[id]` | 匿名 200 | **本人或门店侧** | 含手机号/取货码 |
| `PATCH /api/queues/[id]` 取消 | 只校验请求体里的手机号 → 知道手机号就能取消别人的单 | **本人**（登录态手机号必须一致）；店长取消走 `shopPin` 或店长会话 | 取消是破坏性操作 |
| `PATCH /api/queues/[id]` 状态推进 | 匿名 → 任意把别人的单改成"已完成" | **门店侧** | 店务动作 |
| `DELETE /api/queues/[id]` | 匿名 → 任意删记录 | **店长侧** | 破坏性操作 |
| `POST /api/queues/[id]/call` | 匿名 → 任意叫号（推顾客通知） | **门店侧** | 店务动作 + 骚扰面 |
| `GET /api/queues/activities` | 匿名 → 全店活动流（顾客姓名） | **门店侧** | 经营数据 |
| `GET /api/settlements` | 匿名 200，结算流水（含手机号/金额） | **门店侧** | 经营数据 + PII |
| `POST /api/settlements` | 匿名 → 直接扣别人会员卡余额（免单通道） | **店长侧** + IP 限流 | 资金写操作 |
| `GET /api/members` | 已有 requireManager | **店长侧** + 商户范围 | 资金数据 |
| `POST /api/members` | 已有 requireManager | **店长侧** + 商户范围 | 开卡 = 资金 |
| `GET /api/members/[phone]` | 匿名 → 余额 + 全流水（实测 8592B） | **本人或门店侧** | 顾客个人数据 |
| `POST /api/members/[phone]` | requireManager | **店长侧** + 商户范围 | 充值/扣款/调整/冻结 = 动钱 |
| `GET /api/orders` | 会员分支靠 JWT phone | **本人**（新增支持软会话） | 只能看自己的订单 |
| `GET /api/orders/[id]` | 匿名 → 手机号 + 取货码 | **本人或门店侧** | PII |
| `PATCH /api/orders/[id]` | 匿名 → 任意改状态（零售单连手机号都不校验） | 顾客状态要**本人**；门店状态要**门店侧** | 写操作 |
| `GET /api/comments` | 匿名 → 全站评价（且不传 merchantId 就是全站） | **门店侧** + 强制按门店过滤 | 经营数据 |
| `POST /api/comments` | userId 来自 body | 登录态 + 订单手机号校验 | 防冒用 |
| `GET /api/order-reviews` | 匿名 → 顾客昵称/头像 | **本人或门店侧** | PII |
| `POST /api/order-reviews` | 直接用 `body.userId`（任何人冒用） | 登录态 userId + 只能评价自己的已交付订单 | 防冒用 |
| `GET /api/customer/lookup` | 匿名 → 按手机号查该号在商户下的积分/消费/订单 | **本人** | 防枚举 |

### 新增的「软会话」（保住匿名主流程的关键）

理发店是**扫码进店、无需登录**的场景：顾客报手机号就能取号/预约，这条链路必须保持匿名。
但「查自己的排队单」原来也零鉴权 → 变成按手机号跨商户枚举。

解法：预约/取号成功 → 服务端用返回的 `queueId` 校验手机号后签发 `zhilin-soft-token`（7 天，httpOnly）
→ 之后「查自己的单」必须带这个 token，且登录态手机号必须等于请求的手机号。
攻击者只知道手机号、拿不到 `queueId`（只有顾客自己和门店知道），枚举通道被堵死，正常流程不受影响。

| 新接口 | 用途 |
|---|---|
| `POST /api/auth/soft-session` | `{ phone, queueId }` → 签发绑定手机号的软会话 |
| `GET /api/auth/session` | 用 httpOnly cookie 换回登录态（前端刷新不掉登录） |
| `POST /api/auth/logout` | 服务端清 `zhilin-token` / `zhilin-user-id` / `zhilin-soft-token` |
| `POST /api/admin/auth/admin-pin` | 后台 PIN 登录（服务端校验 + 限流 + 签发 1h JWT 会话） |
| `POST /api/admin/auth/staff-pin` | 店员 PIN 登录（服务端校验 + 5 次锁 15 分钟 + 签发 1h JWT 会话） |

## 二、其它客户端安全改造（同一批）

| 项 | 改前 | 改后 |
|---|---|---|
| PIN 哈希存放 | `business.config.ts` 被 `'use client'` 组件 import → pepper + 哈希打进浏览器包，6 位 PIN 可离线爆破 | 移到服务端专用 `src/config/business.secrets.ts`（env 优先），前端配置不再含任何密钥 |
| 后台 PIN 校验 | 浏览器里比对哈希 | 服务端 `/api/admin/auth/admin-pin`（限流 5 次/15 分钟） |
| 店员 PIN 校验 | 浏览器里比对哈希 | 服务端 `/api/admin/auth/staff-pin` |
| 登录 token cookie | `zhilin-token` 明文可读（`httpOnly:false`） | `httpOnly` + `SameSite=Lax`，`Secure` 按请求协议自动判定（局域网 HTTP 直连不会丢 cookie） |
| 后台会话 cookie | `zhilin-admin-token=pin-<明文 PIN>` | JWT(role=admin, 1h)，明文 PIN 不再落 cookie |
| 店员会话 cookie | `zhilin-staff-session={"pin":"明文"}` | JWT(role=staff, 1h)，另发无密钥标记 `zhilin-staff-ok` 供 UI 判断 |
| 前端 sessionStorage | 保存了明文 PIN | 只保存时间戳 |
| JWT 密钥 | 源码写死兜底 `zhilin-pharmacy-secret-2026`（= 密钥公开，可自签 role=admin） | `JWT_SECRET` → `data/jwt.secret` → **都没有就报错**（fail-closed） |
| `requireStaffOrAdmin` | 任何有效 JWT（含普通顾客 token）都当 admin | 必须带 `admin/merchant/manager` role |

## 三、仍然开放的接口（**设计如此，不能锁**）

| 接口 | 为什么必须匿名 |
|---|---|
| `POST /api/queues` | 扫码预约/取号是店内主流程，锁了整店没法用 |
| `GET /api/products`、`/api/products/[id]`、`/api/merchant`、`/api/services`、`/api/stylists` | 商品/门店/技师资料本来就是公开橱窗 |
| `/api/weather`、`/api/geocode`、`/api/ip-location`、`/api/push/vapid-public-key` | 公共能力，无 PII |
| `/api/auth/send-code`、`/api/auth/verify-code`、`/api/auth/quick-login`、`/api/auth/manager-pin` | 登录端点（自带限流/递增锁定） |
| `/api/admin/auth/*` | 登录端点，middleware 明确豁免 |

## 四、**同仓遗留**（不在本轮 barber 客户侧范围，建议下一轮单独处理）

以下接口仍在药房/零售域（`m_zhilin_001` / `m_grocery_001`），本轮未动，但同样是「写接口零鉴权」：

- `POST /api/coupons/claim`（任意手机号领券）、`POST /api/coupons/transfer`（任意转赠）、`GET /api/coupons/my?phone=`（按手机号读券）
- `POST /api/profile/facts`（按手机号写画像）、`POST /api/push/subscribe`（按手机号绑推送）
- `POST /api/merchant/update`（门店资料写）

建议：下一轮按同一套 `api-auth.ts` 语义补齐（写接口要门店侧/本人，读接口要本人），并单独评估对现有零售流程的影响。

## 五、全量路由（165 个）鉴权现状

> 「保护方式」列里的 `Bearer` = 路由内自己读 `Authorization` 头；`middleware` = 由 `src/middleware.ts`
> 统一拦截（`/api/admin*` 全前缀）；`限流` = `checkIpLimit`。

| 路由 | 方法 | 保护方式 |
|---|---|---|
| `/api/account/deactivate` | POST | Bearer |
| `/api/activity/track` | GET | 公开 |
| `/api/admin-v2/dashboard` | GET | verifyAdminRequest |
| `/api/admin/activities` | GET,POST | verifyAdminRequest |
| `/api/admin/activities/[id]` | DELETE,PATCH | verifyAdminRequest |
| `/api/admin/activities/compliance-check` | POST | verifyAdminRequest |
| `/api/admin/activities/quick-create` | GET,POST | verifyAdminRequest |
| `/api/admin/activities/upload` | POST | verifyAdminRequest |
| `/api/admin/ads` | GET | verifyAdminRequest |
| `/api/admin/ai-chat` | GET | verifyAdminRequest |
| `/api/admin/audit-list` | GET | verifyAdminRequest |
| `/api/admin/auth/admin-pin` | POST | verifyAdminRequest |
| `/api/admin/auth/logout` | POST | 公开 |
| `/api/admin/auth/me` | GET | 公开 |
| `/api/admin/auth/send-code` | POST | 公开 |
| `/api/admin/auth/staff-pin` | POST | 公开 |
| `/api/admin/auth/verify-code` | POST | 公开 |
| `/api/admin/categories` | GET | verifyAdminRequest |
| `/api/admin/coupons` | GET,POST | verifyAdminRequest |
| `/api/admin/coupons/[id]` | DELETE,PATCH | verifyAdminRequest |
| `/api/admin/coupons/batch` | POST | verifyAdminRequest |
| `/api/admin/coupons/export` | GET | verifyAdminRequest |
| `/api/admin/customers/[phone]/profile` | GET | verifyAdminRequest |
| `/api/admin/customers/export` | GET | verifyAdminRequest |
| `/api/admin/feedbacks-list` | GET | verifyAdminRequest |
| `/api/admin/feedbacks/[id]/reply` | POST | verifyAdminRequest |
| `/api/admin/groupbuys` | GET,POST | verifyAdminRequest |
| `/api/admin/groupbuys/[id]` | DELETE,PATCH | verifyAdminRequest |
| `/api/admin/groupbuys/export` | GET | verifyAdminRequest |
| `/api/admin/members` | GET | verifyAdminRequest |
| `/api/admin/members/[id]` | GET,PATCH | verifyAdminRequest |
| `/api/admin/members/[id]/profile` | GET | verifyAdminRequest |
| `/api/admin/merchant` | GET,PUT | 公开 |
| `/api/admin/merchant-list` | GET | verifyAdminRequest |
| `/api/admin/orders` | GET | verifyAdminRequest |
| `/api/admin/orders/[id]` | GET | verifyAdminRequest |
| `/api/admin/orders/export` | GET | verifyAdminRequest |
| `/api/admin/points-adjust` | POST | verifyAdminRequest |
| `/api/admin/points-config` | GET,POST | 公开 |
| `/api/admin/points-log` | GET | 公开 |
| `/api/admin/points-log/export` | GET | verifyAdminRequest |
| `/api/admin/points-products` | DELETE,GET,POST | 公开 |
| `/api/admin/points-products/[id]` | PATCH | verifyAdminRequest |
| `/api/admin/products` | POST | verifyAdminRequest |
| `/api/admin/products-list` | GET | verifyAdminRequest |
| `/api/admin/products/[id]` | GET,PATCH | verifyAdminRequest |
| `/api/admin/products/[id]/extract-white-bg` | POST | verifyAdminRequest |
| `/api/admin/products/[id]/identify-photo` | POST | verifyAdminRequest |
| `/api/admin/products/[id]/promote-photo` | POST | verifyAdminRequest |
| `/api/admin/products/[id]/standardize-photo` | POST | verifyAdminRequest |
| `/api/admin/products/[id]/upload-photo` | DELETE,GET,POST | verifyAdminRequest |
| `/api/admin/products/batch-category` | POST | verifyAdminRequest |
| `/api/admin/products/export` | GET | verifyAdminRequest |
| `/api/admin/products/identify-by-image` | POST | verifyAdminRequest |
| `/api/admin/products/import` | POST | verifyAdminRequest |
| `/api/admin/products/photo-batch/queue` | GET | verifyAdminRequest |
| `/api/admin/products/recognize-and-extract` | POST | verifyAdminRequest |
| `/api/admin/products/shelf-scan` | POST | verifyAdminRequest |
| `/api/admin/products/upload-image` | POST | verifyAdminRequest |
| `/api/admin/profitability` | GET | verifyAdminRequest |
| `/api/admin/profitability/[id]` | PATCH | verifyAdminRequest |
| `/api/admin/purchase-orders` | GET,POST | verifyAdminRequest |
| `/api/admin/purchase-orders/[id]` | DELETE,GET,PATCH | verifyAdminRequest |
| `/api/admin/restock-suggestions` | GET | verifyAdminRequest |
| `/api/admin/retail/coupons/user` | GET | verifyStaffCookie |
| `/api/admin/retail/customers` | GET,POST | verifyStaffCookie |
| `/api/admin/retail/dashboard` | GET | verifyStaffCookie |
| `/api/admin/retail/orders` | GET | verifyStaffCookie |
| `/api/admin/retail/orders/by-pickup-code` | GET | verifyStaffCookie |
| `/api/admin/retail/pos/checkout` | POST | verifyStaffCookie |
| `/api/admin/retail/pos/scan` | POST | verifyStaffCookie |
| `/api/admin/retail/products` | GET | verifyStaffCookie |
| `/api/admin/retail/stats` | GET | verifyStaffCookie |
| `/api/admin/suppliers` | GET,POST | verifyAdminRequest |
| `/api/admin/suppliers/[id]` | DELETE,GET,PATCH | verifyAdminRequest |
| `/api/admin/today` | GET | verifyAdminRequest |
| `/api/admin/upload-orphan-photo` | DELETE,GET,PATCH,POST | verifyAdminRequest |
| `/api/admin/users-list` | GET | verifyAdminRequest |
| `/api/admin/warn` | POST | verifyAdminRequest |
| `/api/agent-hub` | GET,POST | 公开 |
| `/api/agent/capabilities` | GET | 公开 |
| `/api/ai-search` | POST | 公开 |
| `/api/ai/activity-image` | POST | 公开 |
| `/api/auth/logout` | POST | 公开 |
| `/api/auth/manager-login` | POST | 公开 |
| `/api/auth/manager-pin` | POST | 公开 |
| `/api/auth/me` | GET | Bearer |
| `/api/auth/quick-login` | POST | 公开 |
| `/api/auth/send-code` | POST | 公开 |
| `/api/auth/session` | GET | 公开 |
| `/api/auth/soft-session` | POST | 公开 |
| `/api/auth/verify-code` | POST | 公开 |
| `/api/avatar/upload` | POST | 公开 |
| `/api/chat` | GET,POST | Bearer |
| `/api/comments` | GET,POST | 门店侧+Bearer |
| `/api/comments/[id]/like` | POST | Bearer |
| `/api/content-reports` | POST | Bearer |
| `/api/content-reports/[id]` | PATCH | verifyAdminRequest |
| `/api/coupons/claim` | GET,POST | 公开 |
| `/api/coupons/my` | GET | 公开 |
| `/api/coupons/transfer` | POST | 公开 |
| `/api/customer/lookup` | GET | 本人 |
| `/api/debug/client-error` | POST | 公开 |
| `/api/discussions` | GET,POST | Bearer |
| `/api/discussions/[id]` | DELETE,GET | Bearer |
| `/api/discussions/[id]/like` | POST | Bearer |
| `/api/feedbacks` | GET,POST | Bearer |
| `/api/feedbacks/[id]` | PATCH | verifyAdminRequest |
| `/api/geocode` | GET | 公开 |
| `/api/grocery-chat` | GET,POST | Bearer |
| `/api/groupbuy/create` | POST | 公开 |
| `/api/groupbuy/list` | GET | 公开 |
| `/api/groups/join` | GET,POST | 公开 |
| `/api/identity/claim` | POST | 限流 |
| `/api/identity/profile` | GET | 限流 |
| `/api/identity/resolve` | POST | 限流 |
| `/api/identity/txn` | POST | 限流 |
| `/api/ip-location` | GET | 公开 |
| `/api/me/points-history` | GET | Bearer |
| `/api/me/summary` | GET | Bearer |
| `/api/members` | GET,POST | 店长侧+requireManager |
| `/api/members/[phone]` | GET,POST | 本人+店长侧+requireManager |
| `/api/merchant` | GET,POST | 公开 |
| `/api/merchant/stats` | GET | 公开 |
| `/api/merchant/update` | GET,POST | 公开 |
| `/api/order-reviews` | GET,POST | 本人 |
| `/api/orders` | GET,POST | 店员/管理员+Bearer+限流 |
| `/api/orders/[id]` | GET,PATCH | 本人+门店侧 |
| `/api/orders/by-phone` | GET | verifyStaffCookie |
| `/api/orders/pickup` | GET,POST | verifyStaffCookie |
| `/api/points/redeem` | GET,POST | Bearer |
| `/api/product-image/[id]` | GET | 公开 |
| `/api/products` | GET | 公开 |
| `/api/products/[id]` | GET | 公开 |
| `/api/products/[id]/restock` | POST | verifyAdminRequest |
| `/api/products/[id]/status` | PATCH | verifyAdminRequest |
| `/api/products/by-barcode/[code]` | GET | 公开 |
| `/api/profile/facts` | DELETE,GET,POST | 公开 |
| `/api/public/activities` | GET | 公开 |
| `/api/push/debug` | GET | 公开 |
| `/api/push/stream` | GET | 公开 |
| `/api/push/subscribe` | DELETE,POST | 公开 |
| `/api/push/vapid-public-key` | GET | 公开 |
| `/api/queues` | GET,POST | 本人+门店侧+限流 |
| `/api/queues/[id]` | DELETE,PATCH | 本人+门店侧+店长侧+requireManager |
| `/api/queues/[id]/call` | POST | 门店侧 |
| `/api/queues/activities` | GET | 门店侧 |
| `/api/services` | GET,PATCH,POST | 店员/管理员 |
| `/api/services/[id]` | DELETE,GET,PUT | 店员/管理员 |
| `/api/services/upload` | POST | 公开 |
| `/api/settlements` | GET,POST | 门店侧+店长侧+requireManager+限流 |
| `/api/snapshots/list` | GET | 公开 |
| `/api/snapshots/upload` | POST | 公开 |
| `/api/stylists` | GET,POST | 店员/管理员 |
| `/api/stylists/[id]` | DELETE,PUT | 店员/管理员 |
| `/api/transcribe` | POST | 公开 |
| `/api/transcribe/stream` | POST | 公开 |
| `/api/tts` | GET,POST | 公开 |
| `/api/user/profile` | PATCH | Bearer |
| `/api/users/me` | GET | Bearer |
| `/api/users/me/basic` | PATCH | Bearer |
| `/api/users/me/preferences` | PATCH | Bearer |
| `/api/users/me/profile` | PATCH | Bearer |
| `/api/weather` | GET | 公开 |
| `/api/zhilin-chat` | GET,POST | Bearer |