-- ====================================================================
-- 芝林大药房 - 一劳永逸基础表（2026-06-25 23:55 by 清禾）
-- 一次性建表脚本，幂等（用 IF NOT EXISTS）
-- 不用 Prisma schema，直接 raw SQL 走起
-- ====================================================================

-- 1. Merchant（商户）
CREATE TABLE IF NOT EXISTS Merchant (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  shortName TEXT,
  logo TEXT,
  phone TEXT,
  address TEXT,
  latitude REAL,
  longitude REAL,
  businessHours TEXT DEFAULT '08:00-21:00',
  primaryColor TEXT DEFAULT '#0A2818',
  accentColor TEXT DEFAULT '#C9A961',
  pointsRate REAL DEFAULT 0.05,
  pointValue REAL DEFAULT 0.01,
  minPointsRedeem INTEGER DEFAULT 100,
  status TEXT DEFAULT 'active',
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Product（商品）
CREATE TABLE IF NOT EXISTS Product (
  id TEXT PRIMARY KEY,
  merchantId TEXT NOT NULL,
  productCode TEXT NOT NULL,
  name TEXT NOT NULL,
  shortName TEXT,
  spec TEXT,
  manufacturer TEXT,
  barcode TEXT,
  approvalNo TEXT,
  totalAmount REAL,
  price REAL NOT NULL,
  memberPrice REAL,
  points INTEGER DEFAULT 0,
  medicalCode TEXT,
  category TEXT,
  stock INTEGER DEFAULT 0,
  image TEXT,
  description TEXT,
  status TEXT DEFAULT 'active',
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Customer（顾客 - 按 phone 关联 User）
CREATE TABLE IF NOT EXISTS Customer (
  id TEXT PRIMARY KEY,
  merchantId TEXT NOT NULL,
  phone TEXT,
  nickname TEXT,
  avatar TEXT,
  totalSpent REAL DEFAULT 0,
  totalOrders INTEGER DEFAULT 0,
  points INTEGER DEFAULT 0,
  tags TEXT DEFAULT '[]',
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  lastOrderAt DATETIME,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_merchant_phone ON Customer(merchantId, phone);

-- 4. Order
CREATE TABLE IF NOT EXISTS "Order" (
  id TEXT PRIMARY KEY,
  merchantId TEXT NOT NULL,
  customerId TEXT,
  orderNo TEXT UNIQUE NOT NULL,
  totalAmount REAL NOT NULL,
  discountAmount REAL DEFAULT 0,
  pointsUsed INTEGER DEFAULT 0,
  pointsValue REAL DEFAULT 0,
  finalAmount REAL NOT NULL,
  deliveryType TEXT DEFAULT 'pickup',
  deliveryAddress TEXT,
  deliveryPhone TEXT,
  status TEXT DEFAULT 'pending',
  paidAt DATETIME,
  completedAt DATETIME,
  remark TEXT,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_order_merchant_status ON "Order"(merchantId, status);
CREATE INDEX IF NOT EXISTS idx_order_customer ON "Order"(customerId);

-- 5. OrderItem
CREATE TABLE IF NOT EXISTS OrderItem (
  id TEXT PRIMARY KEY,
  orderId TEXT NOT NULL,
  productId TEXT,
  productName TEXT NOT NULL,
  productSpec TEXT,
  productUnit TEXT,
  productImage TEXT,
  price REAL NOT NULL,
  quantity INTEGER NOT NULL,
  subtotal REAL NOT NULL,
  FOREIGN KEY (orderId) REFERENCES "Order"(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_orderitem_order ON OrderItem(orderId);

-- 6. Activity（活动）
CREATE TABLE IF NOT EXISTS Activity (
  id TEXT PRIMARY KEY,
  merchantId TEXT NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  coverImage TEXT,
  description TEXT,
  type TEXT DEFAULT 'promotion',
  rules TEXT DEFAULT '{}',
  productIds TEXT DEFAULT '[]',
  startAt DATETIME NOT NULL,
  endAt DATETIME NOT NULL,
  status TEXT DEFAULT 'draft',
  views INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_activity_merchant_status ON Activity(merchantId, status);

-- 7. Coupon（优惠券）
CREATE TABLE IF NOT EXISTS Coupon (
  id TEXT PRIMARY KEY,
  merchantId TEXT NOT NULL,
  userId TEXT,
  phone TEXT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'discount',
  value REAL NOT NULL,
  minSpend REAL DEFAULT 0,
  status TEXT DEFAULT 'unused',
  usedAt DATETIME,
  expiresAt DATETIME NOT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_coupon_user_status ON Coupon(phone, status);
CREATE INDEX IF NOT EXISTS idx_coupon_merchant ON Coupon(merchantId);

-- 8. GroupBuy（拼团）
CREATE TABLE IF NOT EXISTS GroupBuy (
  id TEXT PRIMARY KEY,
  merchantId TEXT NOT NULL,
  activityId TEXT,
  productId TEXT,
  productName TEXT NOT NULL,
  productSpec TEXT,
  originalPrice REAL NOT NULL,
  groupPrice REAL NOT NULL,
  requiredPeople INTEGER DEFAULT 3,
  currentPeople INTEGER DEFAULT 1,
  status TEXT DEFAULT 'active',
  expiresAt DATETIME NOT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 9. GroupMember（拼团成员）
CREATE TABLE IF NOT EXISTS GroupMember (
  id TEXT PRIMARY KEY,
  groupId TEXT NOT NULL,
  userId TEXT,
  phone TEXT,
  nickname TEXT,
  joinedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (groupId) REFERENCES GroupBuy(id) ON DELETE CASCADE
);

-- 10. PointsLog（积分流水 - 一劳永逸基础）
CREATE TABLE IF NOT EXISTS PointsLog (
  id TEXT PRIMARY KEY,
  merchantId TEXT NOT NULL,
  userId TEXT,
  phone TEXT,
  delta INTEGER NOT NULL,
  balance INTEGER NOT NULL,
  type TEXT NOT NULL,
  refType TEXT,
  refId TEXT,
  description TEXT,
  expiresAt DATETIME,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pointslog_user ON PointsLog(phone, createdAt);

-- ====================================================================
-- Seed 数据：芝林大药房（附小店）
-- ====================================================================
INSERT OR IGNORE INTO Merchant (id, code, name, shortName, phone, address, latitude, longitude, businessHours, status)
VALUES (
  'm_zhilin_001',
  '0005',
  '芝林大药房',
  '附小店',
  '+86 18 30 85 67 187',
  '铜仁市碧江区干群路与清水大道交汇处东北50米',
  27.732818,
  109.200269,
  '08:00-22:00',
  'active'
);

-- Seed 活动：圣诞特惠
INSERT OR IGNORE INTO Activity (id, merchantId, title, subtitle, description, type, rules, startAt, endAt, status)
VALUES (
  'a_christmas_2026',
  'm_zhilin_001',
  '🎄 圣诞特惠',
  '全场满 200 减 50',
  '圣诞节限时活动，12.24-12.26 三天',
  'promotion',
  '{"满100减10":true,"满200减25":true,"满500减80":true}',
  '2026-12-24 00:00:00',
  '2026-12-26 23:59:59',
  'published'
);

-- Seed 拼团：维 C 泡腾片
INSERT OR IGNORE INTO GroupBuy (id, merchantId, activityId, productName, originalPrice, groupPrice, requiredPeople, currentPeople, expiresAt, status)
VALUES (
  'gb_vc_2026',
  'm_zhilin_001',
  'a_christmas_2026',
  '维 C 泡腾片 20 片',
  58,
  29.9,
  3,
  1,
  '2026-12-30 23:59:59',
  'active'
);

-- Seed 商品（示例 4 个）
INSERT OR IGNORE INTO Product (id, merchantId, productCode, name, spec, price, memberPrice, points, stock, image, status)
VALUES
  ('p_mas_50', 'm_zhilin_001', 'P001', '医用外科口罩', '50 片/盒', 39, 35, 100, 200, '😷', 'active'),
  ('p_ganmao_999', 'm_zhilin_001', 'P002', '999 感冒灵颗粒', '10g×9 袋', 18, 16, 50, 150, '💊', 'active'),
  ('p_vc_20', 'm_zhilin_001', 'P003', '维 C 泡腾片', '20 片/管', 35, 30, 200, 80, '🍊', 'active'),
  ('p_therm', 'm_zhilin_001', 'P004', '电子体温计', '软头精准', 78, 70, 500, 30, '🌡️', 'active');

-- Seed 测试用户
INSERT OR IGNORE INTO User (id, phone, nickname, avatar, role, points)
VALUES
  ('u_test_1', '13800138000', '测试用户', '🌿', '普通', 0),
  ('u_test_2', '13900139000', '老顾客', '🌿', '金卡', 2350);

SELECT 'Migration complete: ' || (
  SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_%'
) || ' tables created.' AS status;
