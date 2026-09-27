#!/bin/bash
# 用法: bash tools/backup-db.sh
# 作用: 每天 cron 自动 sqlite3 .backup + 7 天轮转
# 模式: 参照 Sui 项目 OpenClaw cron(从 ~/.openclaw/workspace/Sui/backups/ 学到的)

set -e

TARGET="/Users/yilinzhao/Desktop/zhi-lin-2026-08-14"
BACKUP_DIR="$TARGET/backups"
DB="$TARGET/prisma/dev.db"
TIMESTAMP=$(date +%Y-%m-%d)
KEEP_DAYS=7

mkdir -p "$BACKUP_DIR"

if [ ! -f "$DB" ]; then
  echo "❌ 数据库文件不存在: $DB"
  exit 1
fi

# 1. sqlite3 安全备份(不会锁库)
BACKUP_FILE="$BACKUP_DIR/zhi-lin-db-$TIMESTAMP.db"
sqlite3 "$DB" ".backup '$BACKUP_FILE'" 2>/dev/null

if [ -f "$BACKUP_FILE" ]; then
  SIZE=$(du -k "$BACKUP_FILE" | cut -f1)
  echo "✅ 备份文件: $(basename $BACKUP_FILE) ($SIZE KB)"
else
  echo "❌ 备份失败"
  exit 1
fi

# 2. 清理 N 天前
DELETED=$(find "$BACKUP_DIR" -name "zhi-lin-db-*.db" -mtime +$KEEP_DAYS -delete -print | wc -l | tr -d ' ')
echo "🗑️ 旧备份清理: $DELETED 个(保留 $KEEP_DAYS 天)"

# 3. 列当前所有备份
echo "📋 当前备份:"
ls -la "$BACKUP_DIR"/zhi-lin-db-*.db 2>/dev/null | awk '{print "  " $9 " (" $5 " bytes)"}'
