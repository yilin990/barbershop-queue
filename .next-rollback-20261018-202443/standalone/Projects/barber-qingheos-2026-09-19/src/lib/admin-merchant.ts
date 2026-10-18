// v0.8.69 - 后台管理 merchantId 隔离
// 现在只有 1 个活跃商户(m_grocery_001),所有 admin API 必须按此 merchantId 过滤
// 未来多商户时,改成从 session/cookie 取当前 merchantId
export const ADMIN_MERCHANT_ID = 'm_grocery_001'

// 兼容旧数据:返回历史 m_zhilin_001 数据的查询(用于对比/迁移)
export const HISTORICAL_MERCHANT_ID = 'm_zhilin_001'
