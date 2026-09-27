#!/bin/bash
# 用法: bash tools/set-remote.sh [repo-name]
# 作用: 在 GitHub 创建私有仓库 + 配 origin + 推所有 tag

set -e

REPO_NAME="${1:-zhi-lin-fruit-$(date +%Y%m%d)}"
TARGET="/Users/yilinzhao/Desktop/zhi-lin-2026-08-14"
cd "$TARGET"

# 1. 拿 token(从 security keychain 或 prompt)
TOKEN=$(/usr/bin/security find-internet-password -s "github.com" -w 2>/dev/null || echo "")

if [ -z "$TOKEN" ]; then
  echo "⚠️ keychain 没有 GitHub token"
  echo "   请先: security add-internet-password -s github.com -w <TOKEN>"
  exit 1
fi

# 2. 创建私有 repo(忽略已存在)
RESPONSE=$(/usr/bin/curl -s -X POST \
  -H "Authorization: token $TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  -d "{\"name\":\"$REPO_NAME\",\"private\":true,\"auto_init\":false}" \
  "https://api.github.com/user/repos")

REPO_URL=$(echo "$RESPONSE" | /usr/bin/python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('clone_url','ERROR'))" 2>/dev/null)

if [[ "$REPO_URL" == "ERROR" || -z "$REPO_URL" ]]; then
  echo "⚠️ repo 创建失败(可能已存在),用 yilin990/$REPO_NAME 试试"
  REPO_URL="https://github.com/yilin990/$REPO_NAME.git"
fi

# 3. 配 remote
git remote remove origin 2>/dev/null || true
git remote add origin "https://x-access-token:$TOKEN@github.com/yilin990/$REPO_NAME.git"

# 4. Push 所有
echo "🚀 Push main + tags..."
git push -u origin main 2>&1 | /usr/bin/tail -3
git push origin --tags 2>&1 | /usr/bin/tail -3

echo ""
echo "✅ Remote 已配置: $REPO_URL"
echo "   之后每次 release.sh 自动 push"
