# 2026-08-08 测试数据清理 + 商品修正

## 测试数据清理
- Order 含 TEST/E2E 备注：清理（保留 0）
- Coupon code 含 TEST/E2E：清理（保留 0）
- GroupBuy status=cancelled > 7天：清理（保留 0）
- OrderItem 孤儿：清理（保留 0）
- PointsLog amount NULL + phone NULL：清理

## 商品数据修正
- stock=0 但 status=active（1931 件）→ status=inactive
- price<=0 但 status=active（23 件）→ status=inactive
- 1 件无分类（p_00003_in_001 孕妇营养素）→ category='营养补充'
- 773 件 active 无图 → 按 CATEGORY_CODES 映射 emoji 占位

## 副作用
- User.lastLoginAt NULL → 用 createdAt 兜底
- 商品 API 现在 100% 有图（之前 25% 无图影响体验）
- 商品 API 现在 100% 有库存
- 商品 API 现在 100% 价格合法
