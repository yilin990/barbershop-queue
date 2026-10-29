# 鉴权加固隔离环境验证输出 · 2026-10-28

> 隔离环境，**未碰生产 3070**。
> 改前 = HEAD `0c63253` 单独 build，端口 3172；改后 = 本分支 build，端口 3171；
> 两侧用同一份 `prisma/dev.db` 副本、同一套脚本 `/tmp/auth-verify.sh`、同一批测试数据（顾客 18308567187）。
> 列含义：`HTTP` 状态码 / 响应体字节数 / `leak:` 响应体里检出的 PII 关键字。

## 改前（HEAD 0c63253，3172）

```
=============== [before] http://127.0.0.1:3172 ===============
--- A. 匿名读（应全部拒绝） ---
A1 GET /api/queues?merchantId=m_barber_001                 HTTP 200    13643B  leak: phone name amount
A2 GET /api/queues?phone=18308567187                       HTTP 200     4718B  leak: phone name amount
A3 GET /api/settlements?merchantId=m_barber_001            HTTP 200     1270B  leak: phone name amount
A4 GET /api/members/18308567187?merchantId=m_barber_001    HTTP 200     8592B  leak: phone name balance
A5 GET /api/orders/q_muxl6as3rp7f                          HTTP 200      656B  leak: phone pickupCode
A6 GET /api/comments?merchantId=m_barber_001               HTTP 200       59B  leak: none
A7 GET /api/customer/lookup?phone=18308567187              HTTP 200     3017B  leak: phone
A8 GET /api/queues/activities?merchantId=m_barber_001      HTTP 200       42B  leak: none
--- B. 匿名写（应全部拒绝） ---
B1 POST /api/settlements (免单/扣款)                   HTTP 200      669B  leak: phone name balance
B2 PATCH /api/queues/q_muxl6as3rp7f (改状态)            HTTP 200      482B  leak: phone name
B3 PATCH /api/queues 取消(仅传手机号)               HTTP 200      484B  leak: phone name
B4 DELETE /api/queues/q_muxl6as3rp7f                       HTTP 200       26B  leak: none
B5 POST /api/order-reviews (冒用 userId)                 HTTP 500      201B  leak: none
B6 POST /api/queues/[id]/call (叫号骚扰)               HTTP 404       43B  leak: none
--- C. 顾客本人（预约后软会话） ---
C0 POST /api/auth/soft-session                             <!DOCTYPE html><html lang="zh-CN"><head><meta charSet="utf-8"/><meta name="viewp
C1 GET /api/queues?phone=18308567187 (本人)              HTTP 200     4152B  leak: phone name amount
C2 GET /api/queues?phone=13900001234 (他人)              HTTP 200       38B  leak: none
C3 GET /api/members/18308567187 (本人卡)                HTTP 200     8870B  leak: phone name balance
C4 GET /api/members/13900001234 (他人卡)                HTTP 404       38B  leak: none
--- D. 店员（PIN 215501） ---
D0 POST /api/admin/auth/staff-pin                          {"success":true,"message":"PIN 验证成功","expiresIn":3600}
D1 GET /api/queues?merchantId=m_barber_001                 HTTP 200    13077B  leak: phone name amount
D2 GET /api/settlements?merchantId=m_barber_001            HTTP 200     1607B  leak: phone name amount
D3 GET /api/queues?merchantId=m_zhilin_001 (跨商户)     HTTP 200       38B  leak: none
D4 POST /api/settlements (店员动钱)                    HTTP 200      669B  leak: phone name balance
D5 GET /api/members/18308567187?merchantId                 HTTP 200     9148B  leak: phone name balance
D6 GET /api/queues?phone=18308567187 (店员查顾客)     HTTP 200     4152B  leak: phone name amount
--- E. 管理员（PIN 964782） ---
E0 POST /api/admin/auth/admin-pin                          <!DOCTYPE html><html lang="zh-CN"><head><meta charSet="utf-8"/><meta name="viewp
E1 GET /api/queues?merchantId=m_barber_001                 HTTP 200    13077B  leak: phone name amount
E2 POST /api/settlements (管理员结算)                 HTTP 200       35B  leak: none
E3 GET /api/queues?merchantId=m_zhilin_001 (跨商户)     HTTP 200       38B  leak: none
E4 GET /api/comments?merchantId=m_barber_001               HTTP 200       59B  leak: none

```

## 改后（4ba000e，3171）

```
=============== [after] http://127.0.0.1:3171 ===============
--- A. 匿名读（应全部拒绝） ---
A1 GET /api/queues?merchantId=m_barber_001                 HTTP 401       70B  leak: none
A2 GET /api/queues?phone=18308567187                       HTTP 401       52B  leak: none
A3 GET /api/settlements?merchantId=m_barber_001            HTTP 401       70B  leak: none
A4 GET /api/members/18308567187?merchantId=m_barber_001    HTTP 401       47B  leak: none
A5 GET /api/orders/q_muxl6as3rp7f                          HTTP 401       52B  leak: none
A6 GET /api/comments?merchantId=m_barber_001               HTTP 401       70B  leak: none
A7 GET /api/customer/lookup?phone=18308567187              HTTP 401       52B  leak: none
A8 GET /api/queues/activities?merchantId=m_barber_001      HTTP 401       70B  leak: none
--- B. 匿名写（应全部拒绝） ---
B1 POST /api/settlements (免单/扣款)                   HTTP 401       61B  leak: none
B2 PATCH /api/queues/q_muxl6as3rp7f (改状态)            HTTP 401       70B  leak: none
B3 PATCH /api/queues 取消(仅传手机号)               HTTP 401       52B  leak: none
B4 DELETE /api/queues/q_muxl6as3rp7f                       HTTP 401       61B  leak: none
B5 POST /api/order-reviews (冒用 userId)                 HTTP 401       52B  leak: none
B6 POST /api/queues/[id]/call (叫号骚扰)               HTTP 401       70B  leak: none
--- C. 顾客本人（预约后软会话） ---
C0 POST /api/auth/soft-session                             {"success":true,"token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJzb2
C1 GET /api/queues?phone=18308567187 (本人)              HTTP 200     4718B  leak: phone name amount
C2 GET /api/queues?phone=13900001234 (他人)              HTTP 403       55B  leak: none
C3 GET /api/members/18308567187 (本人卡)                HTTP 200     8592B  leak: phone name balance
C4 GET /api/members/13900001234 (他人卡)                HTTP 403       50B  leak: none
--- D. 店员（PIN 215501） ---
D0 POST /api/admin/auth/staff-pin                          {"success":true,"message":"PIN 验证成功","expiresIn":3600}
D1 GET /api/queues?merchantId=m_barber_001                 HTTP 200    13643B  leak: phone name amount
D2 GET /api/settlements?merchantId=m_barber_001            HTTP 200     1270B  leak: phone name amount
D3 GET /api/queues?merchantId=m_zhilin_001 (跨商户)     HTTP 403       58B  leak: none
D4 POST /api/settlements (店员动钱)                    HTTP 403       46B  leak: none
D5 GET /api/members/18308567187?merchantId                 HTTP 200     8592B  leak: phone name balance
D6 GET /api/queues?phone=18308567187 (店员查顾客)     HTTP 200     4718B  leak: phone name amount
--- E. 管理员（PIN 964782） ---
E0 POST /api/admin/auth/admin-pin                          {"success":true,"expiresIn":3600}
E1 GET /api/queues?merchantId=m_barber_001                 HTTP 200    13643B  leak: phone name amount
E2 POST /api/settlements (管理员结算)                 HTTP 200       35B  leak: none
E3 GET /api/queues?merchantId=m_zhilin_001 (跨商户)     HTTP 200       38B  leak: none
E4 GET /api/comments?merchantId=m_barber_001               HTTP 200       59B  leak: none

```

## 匿名预约主流程复测（改后）

```
--- POST /api/queues (匿名预约，必须仍然可用) @ http://127.0.0.1:3171 ---
{"success":true,"id":"q_mvrx0979hjm5","finalOrderNo":"B88533","orderId":"ord_mvrx097cuzw0","pickupCode":"528808","merchantId":"m_barber_001","customerName":"验证顾客","customerPhone":"13700001111","service":"剪发","stylistName":"自动分配","type":"ticket","scheduledAt":"2026-10-28T10:00:00"}

queueId=q_mvrx0979hjm5
--- 软会话换 token ---
{"success":true,"token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJzb2Z0XzEzNzAwMDAxMTExIiwicGhvbmUiOiIxMzcwMD
--- 本人查自己的排队 ---
HTTP 200     1184
--- 查别人的排队 ---
HTTP 403       55
--- 取消自己的单 ---
HTTP 200
{"success":true,"queue":{"id":"q_mvrx0979hjm5","merchantId":"m_barber_001","orderNo":"B88533","type":"ticket","customerName":"验证顾客","customerPhone":"137
```
