#!/bin/bash
# 用法: bash tools/sync-changelog.sh
# 作用: 从 git log 自动生成桌面 CHANGELOG.md + 同步项目内 VERSIONS.md
set -e

TARGET="/Users/yilinzhao/Desktop/zhi-lin-2026-08-14"
DESK="/Users/yilinzhao/Desktop"
CHANGELOG="$DESK/QINGHE_CHANGELOG.md"
VERSIONS_IN="$TARGET/VERSIONS.md"

cd "$TARGET"

# 1. 当前 HEAD
HEAD=$(git log --pretty=format:"%h %s" -1)
HEAD_TAG=$(git describe --tags --exact-match HEAD 2>/dev/null || echo "(未打 tag)")

# 2. 拉所有 tags
TAGS=$(git tag --sort=-creatordate)

# 3. 生成桌面 CHANGELOG.md
{
echo "# 🌿 清禾项目变更日志 · CHANGELOG"
echo ""
echo "> **自动生成**: \`tools/sync-changelog.sh\` · 最后同步: \`$(date '+%Y-%m-%d %H:%M:%S %Z')\`"
echo "> **项目**: 果蔬鲜生 / QingheOS · \`~/Desktop/zhi-lin-2026-08-14/\`"
echo ""
echo "## 🟢 当前版本"
echo ""
echo "| 项 | 值 |"
echo "|----|----|"
echo "| Commit | \`$HEAD\` |"
echo "| Tag | \`$HEAD_TAG\` |"
echo "| 时间 | $(git log -1 --format='%ad' --date=short) |"
echo ""
echo "## 📊 版本历史(按时间倒序)"
echo ""
echo "| 版本 | Commit | 日期 | 文件数 | 改动摘要 |"
echo "|------|--------|------|--------|----------|"
for tag in $TAGS; do
  COMMIT=$(git rev-list -n 1 "$tag")
  DATE=$(git log -1 --format='%ad' --date=short "$tag" 2>/dev/null)
  FILES=$(git ls-tree -r "$tag" 2>/dev/null | wc -l | tr -d ' ')
  MSG=$(git log -1 --format='%s' "$tag" 2>/dev/null | sed 's/^v[0-9.]*-[^:]*: //' | cut -c1-50)
  echo "| \`$tag\` | \`${COMMIT:0:7}\` | $DATE | $FILES | $MSG |"
done
echo ""
echo "## 📝 最近 10 次 commit 详情"
echo ""
git log --pretty=format:"### %h · %ad · %s%n%n%b%n---" --date=short -10 2>/dev/null
echo ""
echo ""
echo "## ⚠️ 已知缺口"
echo ""
echo "| 项 | 状态 | 备注 |"
echo "|----|------|------|"
echo "| /admin/snapshots | ❌ 404 | 8-18 创建,cart-debug 没源码,需手工重建 |"
echo "| 协议页面残留 | ⚠️ 待扫 | 大改造前残留(药房关键词) |"
echo "| qrcode 模块警告 | ⚠️ 非阻塞 | /merchant 加载 qrcode 有 warning |"
echo ""
echo "## 📋 怎么用"
echo ""
echo "1. **看当前做了啥**: 打开本文件(桌面最近的就是)"
echo "2. **回退到某个版本**: \`cd ~/Desktop/zhi-lin-2026-08-14 && git reset --hard <tag>\`"
echo "3. **看某个版本改了什么**: \`git show <tag>\`"
echo "4. **同步本文件**: \`bash ~/Desktop/zhi-lin-2026-08-14/tools/sync-changelog.sh\`"
echo "5. **每天检查一次**: 看「当前版本」有没有更新"
echo ""
echo "---"
echo ""
echo "🌿 维护人: 清禾 · 每改一次自动同步"
} > "$CHANGELOG"

echo "✅ 桌面 CHANGELOG.md 已生成: $(wc -l < "$CHANGELOG") 行"

# 4. 同步项目内 VERSIONS.md
{
echo "# 📌 项目版本号索引 · VERSIONS.md"
echo ""
echo "> **同步**: 桌面 \`QINGHE_CHANGELOG.md\` 是完整版(自动生成)"
echo ""
echo "## Tag 列表(按时间倒序)"
echo ""
echo "| 版本 | Commit | 日期 |"
echo "|------|--------|------|"
for tag in $(git tag --sort=-creatordate); do
  COMMIT=$(git rev-list -n 1 "$tag")
  DATE=$(git log -1 --format='%ad' --date=short "$tag" 2>/dev/null)
  echo "| \`$tag\` | \`${COMMIT:0:7}\` | $DATE |"
done
echo ""
echo "## 最近 commit"
echo ""
git log --oneline --decorate -10
echo ""
echo "## 怎么打新 tag"
echo ""
echo "1. 改代码 + 测试"
echo "2. \`git add -A && git commit -m \"v0.8.4-描述\"\`"
echo "3. \`git tag -a v0.8.4-描述 -m \"完整说明\"\`"
echo "4. \`bash tools/sync-changelog.sh\`"
} > "$VERSIONS_IN"

echo "✅ 项目 VERSIONS.md 已同步"
