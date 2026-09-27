#!/usr/bin/env python3
"""v5: 增强排队列表 — 突出显示总人数 + 用户位置 + 等待时间"""
import sys

file_path = '/Users/yilinzhao/.openclaw/workspace/barber-qingheos-2026-09-19/src/app/(user)/merchant/page.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# ====== 改动 1：改进 userPosition 计算（包含 reserved today） ======
OLD_CALC = '''  // 用户位置
  const userNumber = bookingSuccess || ticketSuccess
  const userPosition = userNumber ? arrivedOrders.length + servingOrders.length + 1 : 0
  const userEtaMin = userPosition > 0 ? userPosition * 15 : 0'''
NEW_CALC = '''  // 用户位置（前面还有 N 位）
  const userNumber = bookingSuccess || ticketSuccess
  const totalInQueue = arrivedOrders.length + reservedTodayOrders.length
  // 现场取号排在 arrived 末尾，预约用户按 scheduledAt 插入相应位置
  const userPositionAhead = userNumber ? (ticketSuccess ? arrivedOrders.length : 0) : 0
  const userEtaMin = userPositionAhead > 0 ? userPositionAhead * 15 : 0'''
assert OLD_CALC in content, "改动 1 锚点找不到"
content = content.replace(OLD_CALC, NEW_CALC)

# ====== 改动 2：增强"您的号码"卡（加"您排第 N 位"） ======
OLD_CARD = '''                前面还有 <b style={{ fontSize: 16, fontFamily: 'monospace' }}>{userPosition - 1}</b> 位
              </div>
              <div style={{ fontSize: 12, opacity: 0.9 }}>
                预计等待 <b style={{ fontSize: 16, fontFamily: 'monospace' }}>{userEtaMin}</b> 分钟
              </div>'''
NEW_CARD = '''                前面还有 <b style={{ fontSize: 20, fontFamily: 'monospace' }}>{userPositionAhead}</b> 位
              </div>
              <div style={{ fontSize: 12, opacity: 0.9 }}>
                预计等待 <b style={{ fontSize: 16, fontFamily: 'monospace' }}>{userEtaMin}</b> 分钟
              </div>'''
assert OLD_CARD in content, "改动 2 锚点找不到"
content = content.replace(OLD_CARD, NEW_CARD)

# ====== 改动 3：排队列表头部 — 突出显示总人数 ======
OLD_HEADER = '''            {/* 排队列表（已到店等待 + 今日已预约） */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: 12,
            }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: t.text, margin: 0 }}>
                🚶 实时排队
              </h3>
              <span style={{ fontSize: 11, color: t.textMuted }}>
                {arrivedOrders.length} 已到 + {reservedTodayOrders.length} 已预约
              </span>
            </div>'''
NEW_HEADER = '''            {/* 排队列表（已到店等待 + 今日已预约） */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: 12,
              paddingBottom: 10,
              borderBottom: `1px solid ${t.border}`,
            }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: t.text, margin: 0 }}>
                🚶 实时排队
              </h3>
              <div style={{
                display: 'flex', alignItems: 'baseline', gap: 4,
              }}>
                <span style={{
                  fontSize: 28, fontWeight: 800, color: t.primary,
                  fontFamily: 'monospace', lineHeight: 1,
                }}>
                  {totalInQueue}
                </span>
                <span style={{ fontSize: 12, color: t.textSecondary }}>人在排队</span>
              </div>
            </div>'''
assert OLD_HEADER in content, "改动 3 锚点找不到"
content = content.replace(OLD_HEADER, NEW_HEADER)

# ====== 改动 4：每个排队项右侧加更明显的"第 N 位"徽章 ======
OLD_BADGE = '''                      <span style={{
                        padding: '3px 8px',
                        background: isArrived ? t.success : t.primary,
                        color: '#fff',
                        borderRadius: 12, fontSize: 10, fontWeight: 600,
                        whiteSpace: 'nowrap',
                      }}>
                        {isArrived ? `第 ${i + 1} 位` : `预约 ${item.scheduledAt}`}
                      </span>'''
NEW_BADGE = '''                      <div style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        padding: '4px 8px',
                        background: isArrived ? t.success : t.primary,
                        color: '#fff',
                        borderRadius: 10,
                        minWidth: 56,
                      }}>
                        <span style={{
                          fontFamily: 'monospace',
                          fontSize: 16, fontWeight: 800, lineHeight: 1,
                        }}>
                          {i + 1}
                        </span>
                        <span style={{ fontSize: 9, fontWeight: 600, opacity: 0.95, marginTop: 2 }}>
                          {isArrived ? '排队位' : '预约'}
                        </span>
                      </div>'''
assert OLD_BADGE in content, "改动 4 锚点找不到"
content = content.replace(OLD_BADGE, NEW_BADGE)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("OK: 4 个改动全部完成")
print(f"  - 1) userPosition 计算 → 区分 ticket/booking 场景")
print(f"  - 2) 您的号码卡片 → 突出显示'前面还有 X 位'")
print(f"  - 3) 排队列表头部 → 大号显示总人数")
print(f"  - 4) 排队项徽章 → 升级为大号数字徽章")