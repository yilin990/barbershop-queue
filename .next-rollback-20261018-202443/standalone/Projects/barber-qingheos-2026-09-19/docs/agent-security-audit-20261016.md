# barber 无鉴权接口核实报告 · 2026-10-16 16:20

方法：逐条读 route.ts 源码（imports + auth 相关行 + 方法体），不靠关键词猜。
样本：33 条 auth_verified=false 的能力，全部核实完毕。

## Tier 1 · 应加固（高危 + 无鉴权 + 有活调用方）

| endpoint | 风险 | 活调用方 |
|---|---|---|
| GET /api/merchant/stats | 门店营收/客流 | (user)/merchant/page.tsx |
| POST /api/merchant/update | 改门店信息 | (merchant)/merchant/panel/page.tsx |
| GET /api/customer/lookup | 顾客 PII | (user)/merchant/page.tsx |
| POST /api/groupbuy/create | 开团购（钱） | (user)/groupbuy/new/page.tsx |
| POST /api/coupons/transfer | 转券（钱） | (user)/coupon/page.tsx |
| POST /api/settlements | 结算（钱） | components/member/SettlementSheet.tsx |
| POST /api/queues/[id]/call | 叫号（叫错人） | components/BookingSection.tsx |
| PATCH /api/services | 改价（钱） | admin/services/page.tsx 等 4 处 |
| PUT/DELETE /api/services/[id] | 删服务 | 同上 |
| GET/POST /api/orders | 订单读写 | 16 个文件 |
| GET /api/orders/[id] | 订单详情 | 4 个文件 |
| POST/DELETE /api/profile/facts | 顾客档案 | lib/user-memory.ts |
| POST /api/stylists, PUT/DELETE /api/stylists/[id] | 改理发师 | 3 个文件 |
| GET /api/products/by-barcode/[code] | 库存 | admin/products/page.tsx |
| GET /api/push/stream | 推送流 | components/push/CallListener.tsx |

## Tier 2 · 有检查但不是身份鉴权

- PATCH /api/services —— 403「无权修改该商户的服务」是**多租户隔离**
  （svc.merchantId !== body.merchantId）。merchantId 不是秘密，前端里公开可见，
  所以它挡不住攻击者，只挡得住「拿 A 店 id 改 B 店服务」。
- PATCH /api/orders/[id] —— 有「手机号不匹配」403，但 **GET 完全没有保护**。

## Tier 3 · 合理公开，不动

/api/chat, /api/weather, /api/transcribe, /api/tts, /api/ai-search,
/api/auth/send-code, /api/auth/verify-code, /api/coupons/claim, /api/coupons/my,
/api/public/activities, /api/groupbuy/list,
GET /api/products, GET /api/merchant, GET /api/queues（顾客查位置）、POST /api/queues（顾客取号）,
/api/order-reviews, /api/push/subscribe

## 关键结论

**Tier 1 全部都有活前端调用方。**
→ 不能直接给它们挂 requireManager，会锁死线上流程。
→ 必须先逐个确认调用点是否已经带凭证：
   - 已带 cookie/token 的 → 直接加校验，零影响
   - 没带的 → 要先判断这是「顾客本来就该看」还是「不该给顾客看」，
     前者不能加登录要求，后者要连带改前端或改走会员身份校验。

## 备注

/api/merchant/update 是最刺眼的一个：整个 route.ts 一个 @/lib import 都没有。

<!-- project: github.com/yilin990/qinghe-workspace -->
