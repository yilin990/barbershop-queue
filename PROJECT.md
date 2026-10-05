# 📘 芝林大药房 Demo 项目 · PROJECT.md

> **目的**：把项目核心信息固化下来，避免反复改 + 重复劳动 + 错乱修改
>
> **更新原则**：每次有结构性变更（路由/模块/角色调整）→ 更新本文档
>
> **维护人**：清禾 + 赵奕霖（赵奕霖确认 → 清禾改）

---

## 一、项目基本信息

| 字段 | 值 |
|------|---|
| **项目名** | 芝林大药房 Demo（zhilin-pharmacy-official） |
| **项目代号** | `zhilin-001` |
| **版本号** | **v0.7.0**（2026-06-21 确定） |
| **类型** | 多租户商户模板（基于芝林大药房·附小店） |
| **本地路径** | `~/.openclaw/workspace/projects/zhi_lin_pharmacy/official/` |
| **本地 URL** | `http://localhost:3000` |
| **生产端口** | 3000 |
| **数据库** | SQLite（Prisma） |

### 版本号规则

```
v{major}.{minor}.{patch}
- major: 架构/方向大改（破坏性）
- minor: 新增功能/页面
- patch: bug 修复/文案/样式调整
```

---

## 二、端口分配（避免混淆）

| 端口 | 项目 | 角色 |
|------|------|------|
| **3000** | zhi_lin_pharmacy/official | **芝林 Demo**（用户面向） |
| 3003 | Sui | 创作平台（与芝林独立） |
| 18789 | OpenClaw gateway | 平台主控 |

⚠️ **3000 (芝林) 和 3003 (Sui) 是两个完全独立的项目，不要混淆！**

> 历史: 2026-06-26 14:15 之前 PROJECT.md 误写 3005, 已修正为 3000 (与 PATHS.md/ARCHITECTURE.md 一致)。

---

## 三、路由架构（用户面向）

### 根路由

| 路由 | 文件 | 用途 | 状态 |
|------|------|------|------|
| `/` | `app/page.tsx` | 营销首页（Hero + 品牌故事 + 特性） | ✅ 跑通 |
| `/zhilin/` | `app/[merchantId]/page.tsx` | 多租户首页（动态） | ✅ 跑通 |
| `/merchant` | `app/merchant/page.tsx` | **商户展示页（用户面向）** | ✅ 展示页风格 |
| `/admin/merchant` | `app/admin/merchant/page.tsx` | **MerchantAdmin 后台** | ✅ 跑通 |
| `/community` | `app/community/page.tsx` | 社区（评价/反馈/故事/讨论 4 Tab） | ✅ 跑通 |
| `/map` | `app/map/page.tsx` | 地图（定位/导航/距离/天气） | ✅ 跑通 |
| `/stores` | `app/stores/page.tsx` | 多店选择（待开发列表） | ✅ 跑通 |
| `/chat` | `app/chat/page.tsx` | AI 药师对话 | ✅ 跑通 |
| `/pharmacist` | `app/pharmacist/page.tsx` | AI 药师主页 | ✅ 跑通 |
| `/orders` | `app/orders/page.tsx` | 订单列表 | ✅ 跑通 |
| `/me` | `app/me/page.tsx` | 我的（用户中心） | ✅ 跑通 |
| `/login` | `app/login/page.tsx` | 登录 | ✅ 跑通 |

### 子路由（保留兼容）

| 路由 | 用途 | 备注 |
|------|------|------|
| `/merchant/site/[id]` | 单店展示 | 已加品牌故事，备用 |
| `/merchant/preview` | 预览生成 | 历史功能 |
| `/merchant/panel` | 控制台 | 历史功能 |
| `/merchant/status` | 状态 | 历史功能 |

---

## 四、核心模块

### 1. 商户展示页（/merchant）⭐
- **核心文件**：`src/app/merchant/page.tsx`
- **数据源**：`src/config/business.config.ts`
- **UI 风格**：与 `/community` 一致（绿色主题 #7fdc94 + glassmorphism）
- **内容**：Logo + 商户名 + 营业状态 + 快捷操作 + 品牌故事 + 服务项目 + 联系方式

### 2. 品牌故事
- **配置位置**：`business.config.ts` → `brandStory` 字段
- **段落**：title / subtitle / 4 paragraphs / 4 highlights
- **图片素材**：`public/brand-story-*.png`（6 张，LLaVA 已标注内容）
  - 01: 卡通店内
  - 02: **药房店面 + 人物**（品牌故事 hero 配图）⭐
  - 03: 柜台 + 药品 + 植物（备选）
  - 04: 照片陈列（备选）
  - 05: 卡通货架（备选）
  - 06: 仓库（备选）

### 3. 多租户支持
- **路由**：`/[merchantId]`
- **配置加载**：`lib/tenant.ts` → `loadMerchantConfig()`
- **回退**：未匹配的 merchantId → 用默认芝林 config

### 4. AI 药师
- **路由**：`/chat`（对话）+ `/pharmacist`（主页）
- **API**：`/api/chat`（�
[... 5124 chars truncated for Gateway stability ...]
