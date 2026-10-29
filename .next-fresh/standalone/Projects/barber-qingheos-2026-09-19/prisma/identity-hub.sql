-- ============================================================
-- ⭐ 2026-10-15 02:18 奕霖拍板：客户身份中枢
-- 「入口可以借，身份必须自有」
-- 分界线不是前端用谁的，是【客户身份在谁手里】
--
-- 设计要点：
--   1. Identity.phone 是【全局唯一】—— 跨商户、跨平台都是同一个人
--      （老 Customer 表是 @@unique([merchantId, phone])，同一个人在两家店 = 两条记录，这是错的）
--   2. IdentityChannel 把 openid/unionid 降级成【通道】—— 换前端身份不动
--   3. MemberBalance / MemberTxn 存储值和流水 —— 这是「精准」的载体
--
-- ⚠️ 只增不改：不 ALTER、不 DROP、不动任何既有表和行
-- ⚠️ 全部 IF NOT EXISTS，可重复执行
-- ============================================================

-- 1) 身份中枢：手机号是主身份
CREATE TABLE IF NOT EXISTS Identity (
  id          TEXT PRIMARY KEY,
  phone       TEXT NOT NULL,
  nickname    TEXT,
  avatar      TEXT,
  status      TEXT NOT NULL DEFAULT 'active',
  note        TEXT,
  firstSeenAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  lastSeenAt  DATETIME DEFAULT CURRENT_TIMESTAMP,
  createdAt   DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt   DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS Identity_phone_key ON Identity(phone);
CREATE INDEX IF NOT EXISTS Identity_lastSeenAt_idx ON Identity(lastSeenAt);

-- 2) 通道绑定：openid/unionid 只是通道，不是身份
CREATE TABLE IF NOT EXISTS IdentityChannel (
  id          TEXT PRIMARY KEY,
  identityId  TEXT NOT NULL,
  channel     TEXT NOT NULL,
  externalId  TEXT NOT NULL,
  unionId     TEXT,
  nickname    TEXT,
  avatar      TEXT,
  rawProfile  TEXT,
  firstSeenAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  lastSeenAt  DATETIME DEFAULT CURRENT_TIMESTAMP,
  createdAt   DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS IdentityChannel_channel_external_key
  ON IdentityChannel(channel, externalId);
CREATE INDEX IF NOT EXISTS IdentityChannel_identityId_idx
  ON IdentityChannel(identityId);
CREATE INDEX IF NOT EXISTS IdentityChannel_unionId_idx
  ON IdentityChannel(unionId);

-- 3) 会员储值：身份是全局的，余额是分店的
CREATE TABLE IF NOT EXISTS MemberBalance (
  id            TEXT PRIMARY KEY,
  identityId    TEXT NOT NULL,
  merchantId    TEXT NOT NULL,
  balance       REAL NOT NULL DEFAULT 0,
  totalRecharge REAL NOT NULL DEFAULT 0,
  totalConsume  REAL NOT NULL DEFAULT 0,
  createdAt     DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt     DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS MemberBalance_identity_merchant_key
  ON MemberBalance(identityId, merchantId);
CREATE INDEX IF NOT EXISTS MemberBalance_merchantId_idx
  ON MemberBalance(merchantId);

-- 4) 储值/消费流水（不可变账本，只追加）
CREATE TABLE IF NOT EXISTS MemberTxn (
  id           TEXT PRIMARY KEY,
  identityId   TEXT NOT NULL,
  merchantId   TEXT NOT NULL,
  type         TEXT NOT NULL,
  amount       REAL NOT NULL,
  balanceAfter REAL NOT NULL,
  refType      TEXT,
  refId        TEXT,
  note         TEXT,
  operatorId   TEXT,
  createdAt    DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS MemberTxn_identity_created_key
  ON MemberTxn(identityId, createdAt);
CREATE INDEX IF NOT EXISTS MemberTxn_merchant_created_key
  ON MemberTxn(merchantId, createdAt);
