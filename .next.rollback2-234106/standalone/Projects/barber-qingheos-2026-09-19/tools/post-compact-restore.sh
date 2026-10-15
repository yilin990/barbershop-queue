#!/bin/bash
# 用法: bash tools/post-compact-restore.sh [tag-name]
# 作用: 列出所有 backup tag,选一个恢复到 HEAD

TARGET="/Users/yilinzhao/Desktop/zhi-lin-2026-08-14"
cd "$TARGET"

if [ -n "$1" ]; then
  TAG="$1"
else
  echo "📋 可用的 backup tags:"
  git tag --list "backup-*" | /usr/bin/tail -10
  echo ""
  echo "用法: bash tools/post-compact-restore.sh <tag-name>"
  exit 0
fi

if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "🔄 恢复到 $TAG"
  git reset --hard "$TAG"
  echo "✅ 已恢复"
  bash tools/sync-changelog.sh
else
  echo "❌ Tag $TAG 不存在"
  exit 1
fi
