#!/bin/bash
# 用法: bash tools/pre-compact-backup.sh "[原因]"
# 作用: 上下文压缩前自动备份当前状态
#   - tag 当前状态(无论有没有未 commit 的改动)
#   - push 到 remote(如果配了)
#   - 在 .openclaw/tmp 留一份 zip 快照(双重保险)
#   - 更新桌面 CHANGELOG

set -e

TARGET="/Users/yilinzhao/Desktop/zhi-lin-2026-08-14"
REASON="${1:-pre-compact}"
TIMESTAMP=$(date '+%Y%m%d-%H%M%S')
SNAP_DIR="/Users/yilinzhao/.openclaw/tmp/zhi-lin-snapshots"
BACKUP_TAG="backup-${TIMESTAMP}-${REASON}"
cd "$TARGET"

echo "📦 压缩前备份: $BACKUP_TAG"

# 1. 先把所有改动 commit(不阻断)— 即使有未 commit
if [ -n "$(git status --porcelain)" ]; then
  git add -A
  git commit -m "$BACKUP_TAG: 自动 pre-compact 备份(未指定改动说明)"
fi

# 2. Tag 当前状态
git tag -a "$BACKUP_TAG" -m "pre-compact 自动备份 @ $(date '+%Y-%m-%d %H:%M:%S')
原因: $REASON"

# 3. Push(如果有 remote)
if git remote get-url origin > /dev/null 2>&1; then
  git push origin main --tags || echo "⚠️ Push 失败(本地 tag 已打)"
fi

# 4. zip 快照到 .openclaw/tmp(双重保险)
mkdir -p "$SNAP_DIR"
ZIP_PATH="$SNAP_DIR/zhi-lin-${TIMESTAMP}-${REASON}.zip"
cd "$TARGET/.."
zip -rq "$ZIP_PATH" "zhi-lin-2026-08-14" \
  -x "zhi-lin-2026-08-14/node_modules/*" \
  -x "zhi-lin-2026-08-14/.next/*" \
  -x "zhi-lin-2026-08-14/dev.db" \
  -x "zhi-lin-2026-08-14/.bak-*/*" 2>/dev/null || \
  /usr/bin/python3 -c "import shutil;shutil.make_archive('$SNAP_DIR/zhi-lin-${TIMESTAMP}-${REASON}','zip','$TARGET/..','zhi-lin-2026-08-14')"

cd "$TARGET"

# 5. 更新桌面 CHANGELOG(把这个 backup tag 也写进去)
bash tools/sync-changelog.sh

echo ""
echo "✅ 备份完成"
echo "   Git tag: $BACKUP_TAG"
echo "   本地 zip: $ZIP_PATH"
echo "   桌面 CHANGELOG 已同步"
