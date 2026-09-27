#!/bin/bash
# 用法: bash tools/release.sh "<改动摘要>"
# 作用: 改完代码 → 自动 commit + 自动 tag + 推 GitHub + 同步桌面 CHANGELOG

set -e

TARGET="/Users/yilinzhao/Desktop/zhi-lin-2026-08-14"
cd "$TARGET"

# 自动从 keychain 拿 token(失败时 fallback 到 .env-keys)
TOKEN=$(/usr/bin/security find-internet-password -s "github-zhi-lin" -w 2>/dev/null || \
  cat "$TARGET/.env-keys/github.env" 2>/dev/null | /usr/bin/grep GITHUB_TOKEN | /usr/bin/cut -d= -f2)

if [ -z "$TOKEN" ]; then
  echo "❌ 没有 GitHub token(去 keychain 或 .env-keys/github.env 找)"
  exit 1
fi

# 算下一个版本号
TODAY_TAG=$(git tag --list "v0.8.*" | sort -V | /usr/bin/tail -1)
TODAY_NUM=${TODAY_TAG##*.}
NEW_NUM=$((TODAY_NUM + 1))
DESC="${1:-未命名改动}"
SLUG=$(echo "$DESC" | tr ' ' '-' | cut -c1-50 | tr '[:upper:]' '[:lower:]')
NEW_TAG="v0.8.${NEW_NUM}-${SLUG}"

echo "📦 即将发布: $NEW_TAG"

# 检查改动
if [ -z "$(git status --porcelain)" ]; then
  echo "⚠️ 没改动,只同步桌面 CHANGELOG"
  bash tools/sync-changelog.sh
  exit 0
fi

# Commit + Tag
git add -A
git commit -m "$NEW_TAG: $DESC"
COMMIT=$(git log -1 --pretty=format:"%h")
git tag -a "$NEW_TAG" -m "$DESC"

# Push(用 SSH,如果 SSH key 已加,token 是备用)
/usr/bin/ssh -T -o StrictHostKeyChecking=accept-new git@github.com 2>&1 | /usr/bin/grep -q "successfully authenticated"
if [ $? -eq 0 ]; then
  echo "🚀 用 SSH push..."
  git push origin main 2>&1 | /usr/bin/tail -3
  git push origin --tags 2>&1 | /usr/bin/tail -3
else
  echo "🚀 SSH 不通,用 HTTPS + token push..."
  git remote set-url origin "https://x-access-token:***}@github.com/yilin990/zhi-lin-fruit-store-20260828.git"
  git push origin main 2>&1 | /usr/bin/tail -3
  git push origin --tags 2>&1 | /usr/bin/tail -3
  # 切回 SSH(下次用 SSH)
  git remote set-url origin "git@github.com:yilin990/zhi-lin-fruit-store-20260828.git"
fi

# 同步桌面
bash tools/sync-changelog.sh

echo ""
echo "✅ $NEW_TAG 已发布并推到 GitHub"
echo "   https://github.com/yilin990/zhi-lin-fruit-store-20260828"
