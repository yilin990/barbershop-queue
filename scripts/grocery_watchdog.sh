#!/bin/bash
# grocery :3070 暴力守护 · 2026-09-13 01:19 飞书端清禾
# 思路：while true + 1 秒间隔 + curl 3070 探活 · 死了重启
# 类比 zhilin_watchdog.sh（3000 的旧守护）· 但走轻方案不依赖 launchd

set -e

PROJECT_DIR="/Users/yilinzhao/.openclaw/workspace/grocery-zhilin-2026-09-11"
LOG_FILE="/tmp/grocery-watchdog.log"
PORT=3070
HEALTH_URL="http://localhost:${PORT}/merchant"

cd "$PROJECT_DIR" || exit 1

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

log "=== grocery watchdog 启动 · port ${PORT} ==="

while true; do
  # 探活：curl /merchant 拿 HTTP 状态
  HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "$HEALTH_URL" || echo "000")

  if [ "$HTTP_CODE" != "200" ]; then
    log "❌ ${PORT} 不通 (HTTP ${HTTP_CODE}) · 重启"
    
    # 先杀残留（如果还在但僵死）
    pkill -f "next dev -p ${PORT}" 2>/dev/null || true
    sleep 1
    
    # 后台启 dev
    nohup npm run dev >> /tmp/grocery-${PORT}.log 2>&1 &
    NEW_PID=$!
    log "✅ 已启 dev · PID ${NEW_PID} · 等待端口就绪..."
    
    # 等到端口能访问才退出重启循环
    for i in $(seq 1 30); do
      sleep 1
      NEW_CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 "$HEALTH_URL" || echo "000")
      if [ "$NEW_CODE" = "200" ]; then
        log "🎉 ${PORT} 已恢复 (HTTP 200 · ${i}s)"
        break
      fi
    done
    
    if [ "$NEW_CODE" != "200" ]; then
      log "⚠️  30s 内未恢复 (HTTP ${NEW_CODE}) · 下轮再试"
    fi
  fi
  
  sleep 1
done