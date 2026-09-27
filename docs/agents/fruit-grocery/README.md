# 果小蔬 · 独立 Agent

## 是什么
独立 AI 顾问,铜仁果蔬鲜生的果蔬搭配师。

## 文件结构
```
agents/fruit-grocery/
├── SOUL.md     # 灵魂(果小蔬人格底色)
├── MEMORY.md   # 记忆(独立记忆库,与清禾分离)
└── README.md   # 本文件
```

## API 端点
- `/api/grocery-chat` — 果小蔬专属 AI 接口
- 系统 prompt 路径:`../workspace/agents/fruit-grocery/SOUL.md` 派生

## 前端入口
- `/pharmacist` — 果小蔬主页面(用户在奕霖约定的命名)
- ChatWindow 接 `chatEndpoint="/api/grocery-chat"` prop

## 与清禾的关系
兄弟 agent,不是分身。
清禾主 agent 管系统层,果小蔬管果蔬专业领域。

## 与芝小药的关系
另一个独立 AI 顾问(药房领域)。
芝小药 agent ID = `zhixiaoyao`(见 IDENTITY.md L41)。
芝小药 API 端点 = `/api/zhilin-chat`(已物理独立)。
芝小药目录未来 = `agents/pharmacy-zhilin/`。
