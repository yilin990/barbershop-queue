/**
 * 业务配置 - 商户模板的唯一数据源
 *
 * ⚠️ 关键文件：所有商户特定信息都集中在这里
 *
 * 新商户接入清单：
 * 1. 复制本文件，填入新商户信息
 * 2. 修改 id, name, type
 * 3. 调整 theme 配色
 * 4. 更新 contact 信息
 * 5. 替换 assets 资产
 * 6. 完事
 *
 * 不在 config 中的内容（不抽）：
 * - 营销文案（每个商户不同）
 * - 视频 URL
 * - 热点资讯 mock data
 * - 具体商品/服务列表
 */

export const BUSINESS_CONFIG = {
  // 业务身份
  id: 'barber-001',
  type: 'salon' as const,  // pharmacy | salon | restaurant | clinic | retail

  // 显示信息
  name: '造型师助手（铜仁市碧江区店）',  // 不带分店后缀（奕霖 2026-07-02 确认）
  shortName: '造型师助手',
  slogan: '您的专属造型顾问',
  description: 'AI赋能 · 去中心化 · 美在身边。造型师助手，铜仁人自己的发型顾问，记住每位客人的脸型与发型史。',

  // 品牌故事（面向用户展示）
  brandStory: {
    title: '造型师助手',
    subtitle: '您身边的美发顾问',
    paragraphs: [
        '造型师助手是一家扎根铜仁市碧江区的智能发型顾问。无论您是上班族、宝妈、学生党、还是准备约会，我们都能根据您的脸型、发质、肤色，给出最适合您的发型建议。',
        '"近一点，再近一点" 是我们的服务承诺。每位客人都享受专属造型师 1v1 咨询，从脸型分析到染发配色，全程陪伴。踩雷少了，满意多了。',
        '造型师 AI 10:00-22:00 在线陪伴：不知道剪什么？问造型师。担心染发色适不适合？问造型师。想换个新发型又怕踩雷？问造型师。',
      ],
    highlights: [
      { icon: '💇', label: '脸型推荐' },
      { icon: '🎨', label: '染发配色' },
      { icon: '📅', label: '预约提醒' },
      { icon: '🤖', label: '造型师 24h' },
    ],
  },

  // 联系方式
  contact: {
    phone: '+86 18 30 85 67 187',
    // ⭐ v13.0：修正实际地址（之前“干群路与清水大道”是错的）
    // 实际地址：贵州省铜仁市碧江区锦江南路304号（健尔佳造型师助手锦江店）
    // 奕霖可以用高德地图拾取器验证坐标 https://lbs.amap.com/console/show/picker
    address: '贵州省铜仁市碧江区', // TODO: 理发店真实地址（待奕霖填）
    coords: [109.200269, 27.732818] as [number, number],
    hours: '10:00-22:00',
  },
  
  // 主题色（通过 ConfigProvider 注入 CSS 变量）
  // ⭐ 2026-09-20 01:42 奕霖拍板：全局白色改暖米深棕沙龙配色
  theme: {
    bgDeep: '#faf6f0',                                  // 暖米背景
    bgCard: '#fffaf0',                                  // 浅米卡片
    bgCardHover: '#f5ead3',                             // 悬停深米
    teal: '#b8860b',                                    // 主色：金棕
    tealDark: '#8b6508',                                // 主色深
    tealGlow: 'rgba(184, 134, 11, 0.12)',               // 主色辉光
    green: '##b8860b',                                   // 成功绿
    greenDark: '#1b5e20',                               // 成功深
    text: '#2c1810',                                    // 主文字深棕
    textSecondary: '#5d4037',                           // 次文字
    textMuted: '#8d6e63',                               // 弱文字
    glassBorder: 'rgba(184, 134, 11, 0.22)',            // 边框
    accent: '#8b0000',                                  // 强调暗红
  },
  
  // 资产
  assets: {
    logo: '/merchant-logo.jpg',           // 方 logo（图标用）· 弈霖 2026-07-02 提供
    banner: '/zhilin-banner-logo.jpg',    // 长横幅 banner（hero 用）· 含“造型师助手”四字
    qrcode: '/merchant-qr.png',
    favicon: '/favicon.ico',
  },

  // 店员 PIN 码（0-1 阶段：商户老板给员工分配）
  // 2026-07-04 00:38 奕霖需求：核销页只给"几个商户的工作人员"用
  // 后续可升级为 DB 存 staff 表 + 密码哈希
  staffPins: ['1234', '5678', '9012', '2468'],

  // 商户后台安全码（奕霖 2026-07-08 22:27 需求）
  // 不跟店员 PIN 混：店员管"做"（核销），老板管"管"（反馈处置 + 数据）
  // 安全码只有老板/店长知道，不写在任何公开文档
  adminPins: ['8888', '6666', '1314'],
} as const

// 类型导出
export type BusinessType = typeof BUSINESS_CONFIG.type
export type BusinessConfig = typeof BUSINESS_CONFIG
