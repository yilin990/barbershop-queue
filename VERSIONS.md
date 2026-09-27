# 📌 项目版本号索引 · VERSIONS.md

> **同步**: 桌面 `QINGHE_CHANGELOG.md` 是完整版(自动生成)

## Tag 列表(按时间倒序)

| 版本 | Commit | 日期 |
|------|--------|------|
| `v0.8.8-mcp-setup-and-ssh-keys` | `182c8b5` | 2026-08-28 |
| `v0.8.7-github-remote-backup` | `54b8a11` | 2026-08-28 |
| `v0.8.6-db-auto-backup` | `f1b5043` | 2026-08-28 |
| `backup-20260828-015915-test-backup-flow` | `362a86d` | 2026-08-28 |
| `v0.8.5-测试-release-流程自动化` | `6eabaa9` | 2026-08-28 |
| `v0.8.4-changelog-automation` | `7071a00` | 2026-08-28 |
| `v0.8.3-clean-baseline-final2` | `68d4731` | 2026-08-28 |
| `v0.8.2-clean-baseline-final` | `a351953` | 2026-08-28 |
| `v0.8.1-clean-source-baseline` | `c73c427` | 2026-08-28 |
| `v0.8.0-cart-debug-recovery` | `fb7e19f` | 2026-08-28 |

## 最近 commit

182c8b5 (HEAD -> main, tag: v0.8.8-mcp-setup-and-ssh-keys, origin/main) v0.8.8-mcp-setup-and-ssh-keys: 添加 SSH 公钥备份 + DB 备份目录
54b8a11 (tag: v0.8.7-github-remote-backup) v0.8.7-github-remote-backup: 配置 SSH 远程备份 + token 安全存储
f1b5043 (tag: v0.8.6-db-auto-backup) v0.8.6-db-auto-backup: 加 tools/backup-db.sh(Sui 模式)
362a86d (tag: backup-20260828-015915-test-backup-flow) backup-20260828-015915-test-backup-flow: 自动 pre-compact 备份(未指定改动说明)
6eabaa9 (tag: v0.8.5-测试-release-流程自动化) v0.8.5-测试-release-流程自动化: 测试 release 流程自动化
7071a00 (tag: v0.8.4-changelog-automation) v0.8.4-changelog-automation: 加 tools/sync-changelog.sh 自动同步桌面 CHANGELOG
68d4731 (tag: v0.8.3-clean-baseline-final2) v0.8.3-clean-baseline-final2: 排除 .bak-* __tests__ .openclaw 等非源码
a351953 (tag: v0.8.2-clean-baseline-final) v0.8.2-clean-baseline-final: 排除根目录测试 .py 脚本 + dev.db
c73c427 (tag: v0.8.1-clean-source-baseline) v0.8.1-clean-source-baseline: 排除 wiki/scripts/tests/
fb7e19f (tag: v0.8.0-cart-debug-recovery) v0.8.0-cart-debug-recovery: 从 cart-debug (8-25 20:53) 恢复 18 个核心文件

## 怎么打新 tag

1. 改代码 + 测试
2. `git add -A && git commit -m "v0.8.4-描述"`
3. `git tag -a v0.8.4-描述 -m "完整说明"`
4. `bash tools/sync-changelog.sh`
