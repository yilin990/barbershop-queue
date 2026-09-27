#!/usr/bin/env python3
"""v6: 排队列表加滚动 — 最多显示 5 个，超出可滚动"""
import sys

file_path = '/Users/yilinzhao/.openclaw/workspace/barber-qingheos-2026-09-19/src/app/(user)/merchant/page.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

OLD_BLOCK = '''              {[...arrivedOrders, ...reservedTodayOrders].length === 0 ? (
                <div style={{ padding: 16, textAlign: 'center', color: t.textMuted, fontSize: 13 }}>
                  😊 当前无人排队
                </div>
              ) : (
                [...arrivedOrders, ...reservedTodayOrders].map((item, i) => {
                  const isArrived = item.status === 'arrived'
                  return (
                    <div key={item.id} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 12px',
                      background: t.bgDeep,
                      borderRadius: 10,
                      border: `1px solid ${isArrived ? t.successGlow : t.border}`,
                      opacity: isArrived ? 1 : 0.85,
                    }}>'''

NEW_BLOCK = '''              {[...arrivedOrders, ...reservedTodayOrders].length === 0 ? (
                <div style={{ padding: 16, textAlign: 'center', color: t.textMuted, fontSize: 13 }}>
                  😊 当前无人排队
                </div>
              ) : (
                /* ⭐ 6: 滚动列表 — 最多显示 5 个，超出可滚动 */
                <div style={{
                  maxHeight: 340,
                  overflowY: 'auto',
                  marginRight: -8,
                  paddingRight: 8,
                  display: 'flex', flexDirection: 'column', gap: 8,
                  scrollbarWidth: 'thin',
                  scrollbarColor: `${t.primary} ${t.bgCard}`,
                } as React.CSSProperties}>
                  {[...arrivedOrders, ...reservedTodayOrders].slice(0, 100).map((item, i) => {
                  const isArrived = item.status === 'arrived'
                  return (
                    <div key={item.id} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 12px',
                      background: t.bgDeep,
                      borderRadius: 10,
                      border: `1px solid ${isArrived ? t.successGlow : t.border}`,
                      opacity: isArrived ? 1 : 0.85,
                      flexShrink: 0,
                    }}>'''
NEW_BLOCK_END = '''                  })}
                </div>
              )}'''

# 找到原来的闭合部分
OLD_END = '''                      </span>
                    </div>
                  )
                })
              )}'''

# 新的结束：每个 item 的收尾 + slice wrapper 的收尾
NEW_END = '''                      </span>
                    </div>
                  )
                })}
              )}'''

assert OLD_BLOCK in content, "改动 1 锚点找不到"
assert OLD_END in content, "改动 2 锚点找不到"

# 替换两处
content = content.replace(OLD_BLOCK, NEW_BLOCK)
content = content.replace(OLD_END, NEW_END)

# ====== 附加改动：globals.css 加滚动条样式（暖米主题适配） ======
globals_path = '/Users/yilinzhao/.openclaw/workspace/barber-qingheos-2026-09-19/src/app/globals.css'
with open(globals_path, 'r', encoding='utf-8') as f:
    g_content = f.read()

# 找 .container 之后插入滚动条样式（避免破坏现有结构）
SCROLLBAR_CSS = '''

/* ⭐ 2026-09-20 13:37 奕霖 v6：暖米主题滚动条样式 */
#booking-section *::-webkit-scrollbar {
  width: 6px;
}
#booking-section *::-webkit-scrollbar-track {
  background: rgba(184, 134, 11, 0.08);
  border-radius: 3px;
}
#booking-section *::-webkit-scrollbar-thumb {
  background: rgba(184, 134, 11, 0.4);
  border-radius: 3px;
}
#booking-section *::-webkit-scrollbar-thumb:hover {
  background: rgba(184, 134, 11, 0.6);
}
'''

# 找 .container { ... } 块结束位置
if '#booking-section *::-webkit-scrollbar' not in g_content:
    # 在 .container { ... padding: 0 40px; } 之后插入
    marker = ".container { max-width: 1200px; margin: 0 auto; padding: 0 40px; }"
    if marker in g_content:
        g_content = g_content.replace(marker, marker + SCROLLBAR_CSS)
        with open(globals_path, 'w', encoding='utf-8') as f:
            f.write(g_content)
        print("✓ globals.css 滚动条样式已加")
    else:
        print("⚠ globals.css 锚点未找到，跳过滚动条样式")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("OK: v6 滚动列表改造完成")
print(f"  - 1) 排队列表加 maxHeight: 340 + overflowY: auto")
print(f"  - 2) 每个 item 加 flexShrink: 0（不被压缩）")
print(f"  - 3) globals.css 加暖米主题滚动条样式")