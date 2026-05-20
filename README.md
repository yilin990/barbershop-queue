# 🏪 Barbershop Queue Pro - 智能排队与会员管理系统

>扫码实时排队 + 会员营销数据看板，专注美发/餐饮等服务业

[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-18-blue)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3-cyan)](https://tailwindcss.com/)

## 一句话

让顾客扫码排队、让商户管好会员、数据自己会说话。

## 核心功能

### 🧑‍💼 顾客端（手机扫码即用）
- **扫码取号** — 无需下载APP，微信扫码即可排队
- **实时排队看板** — 随时查看前面还有多少人、预计等待时间
- **会员识别** — 手机号自动识别会员等级，享受折扣
- **到号提醒** — 不需要站在门口等

### 🏪 商户端（管理后台）
- **一键叫号** — 点一下按钮，下一位顾客收到通知
- **服务计时** — 记录每位顾客的服务开始/完成时间
- **会员管理** — 新增/编辑会员，设置等级折扣
- **实时数据看板** — 今日客流、营收、热门服务一目了然
- **历史记录** — 任意时间段的营业数据查询

### 💳 会员等级体系

| 等级 | 折扣 | 积分倍率 | 专属权益 |
|------|------|----------|----------|
| 普通 | 无 | 1x | 基础服务 |
| 银卡 | 5% | 1.5x | 优先排队 |
| 金卡 | 10% | 2x | 优先+生日礼 |
| VIP | 15% | 3x | 专属通道 |

## 技术架构

```
Frontend: Next.js 14 + React 18 + TypeScript + TailwindCSS
State: Zustand (本地状态管理)
QRCode: qrcode.react (扫码入口)
PWA: Service Worker + Manifest (可安装到手机桌面)
Storage: LocalStorage (本地持久化，数据可导出)
部署: Vercel / 任意 Node.js 主机
```

## 快速开始

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 生产构建
npm run build

# 启动生产服务
npm start
```

访问 `http://localhost:3000` 打开顾客端，`http://localhost:3000/admin` 打开商户后台。

## 扫码演示

商户后台有专属二维码，顾客用微信扫描即可进入排队页面。

```
演示数据已内置：
- 5位模拟顾客（含VIP/金卡/银卡）
- 6个服务项目（洗吹/剪发/染发/烫发/剃须/全套）
- 今日模拟营收 ¥1560
```

## 商业路径

### 阶段一：本地演示
直接在本机启动，插上电脑演示给商户看效果。

### 阶段二：云端部署
- 购买云服务器（1核2G，约50元/月）
- 部署项目，配置域名
- 商户获得独立管理后台

### 收费建议
- SaaS月租：200-500元/月
- 买断+代运维：2000-5000元/永久

## License

MIT — Created by [赵奕霖](https://github.com/yilin990)

---

*专注解决排队痛点，让商户省心、顾客省时* 🏪
