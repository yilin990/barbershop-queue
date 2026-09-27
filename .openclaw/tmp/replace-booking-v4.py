#!/usr/bin/env python3
"""v4: 替换 BookingSection 为带状态机+店长控制台的实现"""
import sys

file_path = '/Users/yilinzhao/.openclaw/workspace/barber-qingheos-2026-09-19/src/app/(user)/merchant/page.tsx'

# ⭐ 订单类型 + mock 初始数据
NEW_BOOKING_SECTION = r'''// ==============================================
// 订单类型 + 状态机
// ==============================================
type OrderStatus = 'reserved' | 'arrived' | 'serving' | 'completed' | 'no_show'

interface Order {
  id: string
  customerName: string
  customerPhone: string      // 主键（不登录也能跟踪）
  service: '剪发' | '烫发' | '染发' | '护理'
  stylistName: string
  status: OrderStatus
  scheduledAt: string         // HH:MM
  scheduledDate: 'today' | 'tomorrow'
  arrivedAt?: string
  startedAt?: string
  completedAt?: string
  note?: string
}

const INITIAL_ORDERS: Order[] = [
  // serving - 正在服务
  { id: 'O001', customerName: '李先生', customerPhone: '138****1234', service: '烫发', stylistName: 'Tony', status: 'serving', scheduledAt: '14:00', scheduledDate: 'today', startedAt: '14:05' },
  // arrived - 已到店等待
  { id: 'O002', customerName: '王女士', customerPhone: '139****5678', service: '剪发', stylistName: 'Amy', status: 'arrived', scheduledAt: '14:30', scheduledDate: 'today', arrivedAt: '14:28' },
  { id: 'O008', customerName: '周先生', customerPhone: '139****6789', service: '剪发', stylistName: 'Lily', status: 'arrived', scheduledAt: '15:00', scheduledDate: 'today', arrivedAt: '14:50' },
  // reserved today - 今日预约
  { id: 'O003', customerName: '张先生', customerPhone: '138****9012', service: '染发', stylistName: 'Lily', status: 'reserved', scheduledAt: '15:00', scheduledDate: 'today' },
  { id: 'O004', customerName: '陈女士', customerPhone: '136****3456', service: '护理', stylistName: 'Tony', status: 'reserved', scheduledAt: '16:00', scheduledDate: 'today' },
  // reserved tomorrow - 明日下午 4 点（奕霖原话举例）
  { id: 'O005', customerName: '李先生', customerPhone: '138****1234', service: '烫发', stylistName: 'Tony', status: 'reserved', scheduledAt: '16:00', scheduledDate: 'tomorrow', note: '明天下午 4 点' },
  { id: 'O006', customerName: '赵女士', customerPhone: '137****7890', service: '剪发', stylistName: 'Lily', status: 'reserved', scheduledAt: '15:30', scheduledDate: 'tomorrow' },
  { id: 'O007', customerName: '孙先生', customerPhone: '135****2345', service: '染发', stylistName: 'Amy', status: 'reserved', scheduledAt: '17:00', scheduledDate: 'tomorrow' },
]

function maskPhone(p: string): string {
  return p.length >= 7 ? p.slice(0, 3) + '****' + p.slice(-4) : p
}

function statusLabel(s: OrderStatus): { text: string; bg: string; color: string } {
  switch (s) {
    case 'reserved': return { text: '已预约', bg: 'rgba(184, 134, 11, 0.15)', color: '#8b6508' }
    case 'arrived': return { text: '已到店', bg: 'rgba(45, 125, 50, 0.15)', color: '#2e7d32' }
    case 'serving': return { text: '正在服务', bg: 'rgba(184, 134, 11, 0.95)', color: '#fff' }
    case 'completed': return { text: '已完成', bg: 'rgba(139, 0, 0, 0.15)', color: '#8b0000' }
    case 'no_show': return { text: '未到店', bg: 'rgba(141, 110, 99, 0.2)', color: '#5d4037' }
  }
}

// ==============================================
// BookingSection v4（状态机 + 店长控制台）
// ==============================================
function BookingSection() {
  // 中国时间同步
  const [now, setNow] = useState(() => new Date())

  // 订单状态
  const [orders, setOrders] = useState<Order[]>(INITIAL_ORDERS)

  // 店长模式
  const [managerMode, setManagerMode] = useState(true)

  // 活动流
  const [activities, setActivities] = useState([
    { time: '14:32', text: '📅 李先生预约明天下午 4 点' },
    { time: '14:30', text: '✅ 王女士完成剪发' },
    { time: '14:28', text: '👋 王女士到店' },
  ])

  // 叫号推送 Toast
  const [toast, setToast] = useState('')

  // 弹窗
  const [modal, setModal] = useState<null | 'booking' | 'ticket' | 'agreement'>(null)
  const [bookingSuccess, setBookingSuccess] = useState('')
  const [ticketSuccess, setTicketSuccess] = useState('')

  // 时间同步
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const timeStr = now.toLocaleTimeString('zh-CN', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false, timeZone: 'Asia/Shanghai',
  })
  const dateStr = now.toLocaleDateString('notas', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    timeZone: 'Asia/Shanghai',
  })
  const weekdayStr = '星期' + ['日','一','二','三','四','五','六'][now.getDay()]

  // 状态切换 helper
  function transition(id: string, newStatus: OrderStatus, activityText: string) {
    setOrders(prev => prev.map(o => {
      if (o.id !== id) return o
      const updated = { ...o, status: newStatus }
      const nowTime = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Shanghai' })
      if (newStatus === 'arrived') updated.arrivedAt = nowTime
      if (newStatus === 'serving') updated.startedAt = nowTime
      if (newStatus === 'completed') updated.completedAt = nowTime
      return updated
    }))
    const t = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Shanghai' })
    setActivities(prev => [{ time: t, text: activityText }, ...prev].slice(0, 5))
  }

  function callCustomer(id: string) {
    const o = orders.find(x => x.id === id)
    if (!o) return
    setToast(`📢 叫号推送已发送 · ${o.customerName} (${o.customerPhone}) · 微信/短信`)
    setTimeout(() => setToast(''), 3500)
    const t = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Shanghai' })
    setActivities(prev => [{ time: t, text: `📢 叫号推送 · ${o.customerName}` }, ...prev].slice(0, 5))
  }

  // 计算 derived data
  const servingOrders = orders.filter(o => o.status === 'serving')
  const arrivedOrders = orders.filter(o => o.status === 'arrived').sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
  const reservedTodayOrders = orders.filter(o => o.status === 'reserved' && o.scheduledDate === 'today').sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
  const reservedTomorrowOrders = orders.filter(o => o.status === 'reserved' && o.scheduledDate === 'tomorrow').sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
  const activeOrders = orders.filter(o => o.status === 'serving' || o.status === 'arrived' || o.status === 'reserved')
  const currentServing = servingOrders[0]

  // 用户位置
  const userNumber = bookingSuccess || ticketSuccess
  const userPosition = userNumber ? arrivedOrders.length + servingOrders.length + 1 : 0
  const userEtaMin = userPosition > 0 ? userPosition * 15 : 0

  // 主题色
  const t = {
    bgDeep: '#faf6f0',
    bgCard: '#fffaf0',
    primary: '#b8860b',
    primaryDark: '#8b6508',
    primaryGlow: 'rgba(184, 134, 11, 0.12)',
    text: '#2c1810',
    textSecondary: '#5d4037',
    textMuted: '#8d6e63',
    border: 'rgba(184, 134, 11, 0.22)',
    accent: '#8b0000',
    success: '#2e7d32',
    successGlow: 'rgba(46, 125, 50, 0.15)',
    overlayBg: 'rgba(44, 24, 16, 0.6)',
    userGlow: 'linear-gradient(135deg, rgba(184, 134, 11, 0.95), rgba(139, 101, 8, 0.95))',
  }

  return (
    <section id="booking-section" style={{
      padding: '40px 16px 60px',
      background: t.bgDeep,
      borderTop: `1px solid ${t.border}`,
    }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* 标题区 + 中国时间同步 */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            display: 'inline-block', padding: '6px 16px',
            background: t.primaryGlow, borderRadius: 20,
            color: t.primary, fontSize: 13, fontWeight: 600,
            marginBottom: 12,
          }}>📅 预约 · 取号 · 实时排队</div>
          <h2 style={{ fontSize: 30, fontWeight: 800, color: t.text, marginBottom: 6 }}>
            线上一键预约 · 到店不排队
          </h2>
          <p style={{ fontSize: 14, color: t.textSecondary, marginBottom: 12 }}>
            选发型师 · 选时段 · 系统自动锁位 · 提前 5 分钟到店
          </p>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '8px 16px',
            background: t.bgCard, border: `1px solid ${t.border}`,
            borderRadius: 24,
            fontSize: 13, color: t.textSecondary,
          }}>
            <span style={{ fontSize: 16 }}>🕒</span>
            <span style={{ fontWeight: 600, color: t.text }}>{dateStr} {weekdayStr}</span>
            <span style={{
              color: t.primary, fontWeight: 700,
              fontFamily: 'monospace', fontSize: 16,
              minWidth: 70, textAlign: 'center',
            }}>
              {timeStr}
            </span>
            <span style={{ fontSize: 11, color: t.textMuted }}>· 中国时间</span>
          </div>
        </div>

        {/* 您的号码高亮卡片 */}
        {userNumber && (
          <div style={{
            marginBottom: 16,
            padding: '18px 22px',
            background: t.userGlow,
            borderRadius: 14,
            color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            boxShadow: '0 6px 24px rgba(184, 134, 11, 0.3)',
            flexWrap: 'wrap', gap: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 28 }}>🎫</span>
              <div>
                <div style={{ fontSize: 11, opacity: 0.9, letterSpacing: '0.05em' }}>
                  {bookingSuccess ? '您的预约号' : '您的排队号'}
                </div>
                <div style={{
                  fontSize: 28, fontWeight: 900, fontFamily: 'monospace',
                  letterSpacing: '0.08em', lineHeight: 1.1,
                }}>
                  {userNumber}
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, opacity: 0.9 }}>
                前面还有 <b style={{ fontSize: 16, fontFamily: 'monospace' }}>{userPosition - 1}</b> 位
              </div>
              <div style={{ fontSize: 12, opacity: 0.9 }}>
                预计等待 <b style={{ fontSize: 16, fontFamily: 'monospace' }}>{userEtaMin}</b> 分钟
              </div>
            </div>
            <button
              onClick={() => { setBookingSuccess(''); setTicketSuccess('') }}
              style={{
                background: 'rgba(255,255,255,0.22)',
                border: 'none', borderRadius: 8,
                padding: '6px 12px',
                color: '#fff', fontSize: 12,
                cursor: 'pointer',
              }}
            >
              ✕ 关闭
            </button>
          </div>
        )}

        {/* ⭐ 店长控制台（managerMode toggle） */}
        <div style={{ marginBottom: 16 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 10,
          }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: t.text, margin: 0 }}>
              🎛️ 店长控制台 {managerMode && <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 400, marginLeft: 8 }}>· 共 {activeOrders.length} 单进行中</span>}
            </h3>
            <button
              onClick={() => setManagerMode(m => !m)}
              style={{
                padding: '6px 14px',
                background: managerMode ? t.accent : t.primary,
                color: '#fff', border: 'none', borderRadius: 8,
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >
              {managerMode ? '✕ 关闭店长模式' : '🎛️ 开启店长模式'}
            </button>
          </div>

          {managerMode && (
            <div style={{
              background: t.bgCard,
              border: `2px solid ${t.primary}`,
              borderRadius: 12,
              padding: 14,
              boxShadow: '0 4px 16px rgba(184, 134, 11, 0.1)',
            }}>
              {activeOrders.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: t.textMuted, fontSize: 13 }}>
                  😊 当前没有进行中的订单
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {activeOrders.map(o => {
                    const badge = statusLabel(o.status)
                    return (
                      <div key={o.id} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 12px',
                        background: t.bgDeep,
                        border: `1px solid ${t.border}`,
                        borderRadius: 10,
                        flexWrap: 'wrap',
                      }}>
                        {/* 序号时间 */}
                        <div style={{
                          minWidth: 50, textAlign: 'center',
                          padding: '4px 8px', background: t.primaryGlow,
                          borderRadius: 6, fontFamily: 'monospace',
                          fontSize: 12, fontWeight: 700, color: t.primary,
                        }}>
                          {o.scheduledAt}
                        </div>
                        {/* 顾客信息 */}
                        <div style={{ flex: 1, minWidth: 180 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>
                            {o.customerName} <span style={{ color: t.textMuted, fontWeight: 400, fontSize: 12, marginLeft: 4 }}>{maskPhone(o.customerPhone)}</span>
                          </div>
                          <div style={{ fontSize: 11, color: t.textSecondary, marginTop: 2 }}>
                            {o.service} · {o.stylistName} 老师
                            {o.scheduledDate === 'tomorrow' && <span style={{ marginLeft: 6, color: t.primary, fontWeight: 600 }}>· 明天</span>}
                          </div>
                        </div>
                        {/* 状态徽章 */}
                        <span style={{
                          padding: '3px 8px',
                          background: badge.bg, color: badge.color,
                          borderRadius: 8, fontSize: 10, fontWeight: 600,
                          whiteSpace: 'nowrap',
                        }}>
                          {badge.text}
                        </span>
                        {/* 操作按钮 */}
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {o.status === 'reserved' && (
                            <>
                              <button onClick={() => transition(o.id, 'arrived', `✅ ${o.customerName} 到店确认`)} style={{
                                padding: '6px 10px', background: t.success,
                                color: '#fff', border: 'none', borderRadius: 6,
                                fontSize: 11, fontWeight: 600, cursor: 'pointer',
                              }}>确认到店</button>
                              <button onClick={() => callCustomer(o.id)} style={{
                                padding: '6px 10px', background: t.primaryGlow,
                                color: t.primaryDark, border: `1px solid ${t.primary}`,
                                borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                              }}>叫号推送</button>
                            </>
                          )}
                          {o.status === 'arrived' && (
                            <>
                              <button onClick={() => transition(o.id, 'serving', `💇 ${o.customerName} 开始理发`)} style={{
                                padding: '6px 10px', background: t.primary,
                                color: '#fff', border: 'none', borderRadius: 6,
                                fontSize: 11, fontWeight: 600, cursor: 'pointer',
                              }}>开始理发</button>
                              <button onClick={() => callCustomer(o.id)} style={{
                                padding: '6px 10px', background: t.primaryGlow,
                                color: t.primaryDark, border: `1px solid ${t.primary}`,
                                borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                              }}>叫号推送</button>
                            </>
                          )}
                          {o.status === 'serving' && (
                            <>
                              <button onClick={() => transition(o.id, 'completed', `🎉 ${o.customerName} 完成服务`)} style={{
                                padding: '6px 10px', background: t.success,
                                color: '#fff', border: 'none', borderRadius: 6,
                                fontSize: 11, fontWeight: 600, cursor: 'pointer',
                              }}>完成 ✓</button>
                              <button onClick={() => callCustomer(o.id)} style={{
                                padding: '6px 10px', background: t.primaryGlow,
                                color: t.primaryDark, border: `1px solid ${t.primary}`,
                                borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                              }}>叫号推送</button>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ⭐ 大面板：左序号（当前服务）+ 右活动流 + 右队列 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          background: t.bgCard,
          border: `1px solid ${t.border}`,
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: '0 4px 24px rgba(184, 134, 11, 0.08)',
          marginBottom: 20,
        }}>
          {/* 左：当前正在服务 */}
          <div style={{
            background: currentServing
              ? `linear-gradient(135deg, ${t.primary}, ${t.primaryDark})`
              : 'linear-gradient(135deg, #d4c5a0, #a89577)',
            color: '#fff',
            padding: '32px 20px',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 8,
          }}>
            {currentServing ? (
              <>
                <div style={{ fontSize: 11, opacity: 0.85, letterSpacing: '0.1em' }}>正在服务</div>
                <div style={{
                  fontSize: 52, fontWeight: 900, fontFamily: 'monospace',
                  letterSpacing: '0.05em', lineHeight: 1,
                }}>{currentServing.scheduledAt}</div>
                <div style={{ fontSize: 13, opacity: 0.95, fontWeight: 600 }}>
                  {currentServing.customerName} · {currentServing.stylistName}
                </div>
                <div style={{ fontSize: 12, opacity: 0.9 }}>
                  {currentServing.service}
                </div>
                <div style={{
                  marginTop: 4, padding: '4px 10px',
                  background: 'rgba(255,255,255,0.22)',
                  borderRadius: 12, fontSize: 11,
                }}>
                  开始于 {currentServing.startedAt}
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 11, opacity: 0.85, letterSpacing: '0.1em' }}>暂无服务</div>
                <div style={{ fontSize: 32, opacity: 0.7 }}>— —</div>
                <div style={{ fontSize: 13, opacity: 0.85 }}>店长可在控制台开始理发</div>
              </>
            )}
          </div>

          {/* 右：活动流 + 排队列表 */}
          <div style={{ padding: '20px 24px' }}>
            {/* 活动流 */}
            <div style={{
              padding: '12px 14px',
              background: t.primaryGlow,
              borderRadius: 10,
              marginBottom: 16,
            }}>
              <div style={{
                fontSize: 11, fontWeight: 700, color: t.primary,
                letterSpacing: '0.05em', marginBottom: 8,
              }}>🔥 刚刚发生的</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {activities.slice(0, 4).map((act, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: 10, alignItems: 'center',
                    fontSize: 12, color: t.text,
                  }}>
                    <span style={{
                      fontFamily: 'monospace', fontSize: 11,
                      color: t.textMuted, minWidth: 36,
                    }}>{act.time}</span>
                    <span style={{ flex: 1 }}>{act.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 排队列表（已到店等待 + 今日已预约） */}
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
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[...arrivedOrders, ...reservedTodayOrders].length === 0 ? (
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
                    }}>
                      <div style={{
                        minWidth: 50, textAlign: 'center',
                        padding: '5px 8px',
                        background: isArrived ? t.successGlow : t.primaryGlow,
                        borderRadius: 8,
                        fontFamily: 'monospace',
                        fontSize: 13, fontWeight: 700,
                        color: isArrived ? t.success : t.primary,
                      }}>
                        {item.scheduledAt}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 2 }}>
                          {item.customerName} <span style={{ color: t.textMuted, fontWeight: 400, fontSize: 12 }}>· {item.stylistName} 老师</span>
                        </div>
                        <div style={{ fontSize: 11, color: t.textSecondary }}>
                          {item.service} · {isArrived ? '已到店等待' : '已预约'}
                        </div>
                      </div>
                      <span style={{
                        padding: '3px 8px',
                        background: isArrived ? t.success : t.primary,
                        color: '#fff',
                        borderRadius: 12, fontSize: 10, fontWeight: 600,
                        whiteSpace: 'nowrap',
                      }}>
                        {isArrived ? `第 ${i + 1} 位` : `预约 ${item.scheduledAt}`}
                      </span>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* 按钮区 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 12, marginBottom: 16,
        }}>
          <ActionButton icon="📅" label="在线预约" onClick={() => setModal('booking')} t={t} />
          <ActionButton icon="🎫" label="现场取号" onClick={() => setModal('ticket')} t={t} />
          <ActionButton icon="📋" label="预约协议" onClick={() => setModal('agreement')} t={t} />
        </div>

        {/* 协议提示条 */}
        <div style={{
          padding: '12px 16px',
          background: t.bgCard,
          border: `1px solid ${t.border}`,
          borderRadius: 10,
          fontSize: 12, color: t.textSecondary,
          display: 'flex', alignItems: 'center', gap: 8,
          marginBottom: 12,
        }}>
          <span style={{ fontSize: 16 }}>🛡</span>
          <span>
            预约请提前 <b style={{ color: t.primary }}>5 分钟</b> 到店 · 晚到 <b style={{ color: t.accent }}>2 分钟</b> 系统自动取消 · 线上预约与线下排队互斥
          </span>
        </div>

        {/* 兜底 */}
        {!userNumber && bookingSuccess && (
          <div style={{
            padding: '14px 18px',
            background: 'rgba(46, 125, 50, 0.08)',
            border: '1px solid rgba(46, 125, 50, 0.3)',
            borderRadius: 10,
            fontSize: 14, color: t.success, fontWeight: 600,
            textAlign: 'center', marginBottom: 12,
          }}>
            ✅ 预约成功！预约号 <b style={{ fontSize: 18, fontFamily: 'monospace' }}>{bookingSuccess}</b>，请提前 5 分钟到店
          </div>
        )}
        {!userNumber && ticketSuccess && (
          <div style={{
            padding: '14px 18px',
            background: 'rgba(46, 125, 50, 0.08)',
            border: '1px solid rgba(46, 125, 50, 0.3)',
            borderRadius: 10,
            fontSize: 14, color: t.success, fontWeight: 600,
            textAlign: 'center', marginBottom: 12,
          }}>
            ✅ 取号成功！排队号 <b style={{ fontSize: 18, fontFamily: 'monospace' }}>{ticketSuccess}</b>
          </div>
        )}
      </div>

      {/* 弹窗 */}
      {modal === 'booking' && (
        <BookingModal t={t} onClose={() => setModal(null)}
          onSuccess={(no) => { setBookingSuccess(no); setModal(null) }} />
      )}
      {modal === 'ticket' && (
        <TicketModal t={t} onClose={() => setModal(null)}
          onSuccess={(no) => { setTicketSuccess(no); setModal(null) }} />
      )}
      {modal === 'agreement' && (
        <AgreementModal t={t} onClose={() => setModal(null)} />
      )}

      {/* 叫号推送 Toast */}
      {toast && (
        <div onClick={() => setToast('')} style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          padding: '12px 20px',
          background: 'linear-gradient(135deg, #b8860b, #8b6508)',
          color: '#fff', borderRadius: 10,
          boxShadow: '0 8px 32px rgba(184, 134, 11, 0.3)',
          fontSize: 14, fontWeight: 600,
          zIndex: 1100,
          cursor: 'pointer',
          maxWidth: '90vw', textAlign: 'center',
        }}>
          {toast}
          <div style={{ fontSize: 10, opacity: 0.85, marginTop: 4 }}>点击关闭</div>
        </div>
      )}
    </section>
  )
}
'''

# 读取文件
with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# 定位 v3 BookingSection 起点
actual_start = None
for i, line in enumerate(lines):
    if '⭐ 2026-09-20 02:00 奕霖 v3' in line:
        actual_start = i
        break

if actual_start is None:
    print("ERROR: Could not find BookingSection v3 comment")
    sys.exit(1)

# 找到 ActionButton 起点（BookingSection 结束位置）
actual_end = None
for i in range(actual_start + 1, len(lines)):
    if lines[i].startswith('function ActionButton'):
        actual_end = i
        break

if actual_end is None:
    print("ERROR: Could not find end of BookingSection")
    sys.exit(1)

print(f"Replacing lines {actual_start+1} to {actual_end} (0-based: {actual_start}-{actual_end-1})")
print(f"  - v3 BookingSection: {actual_end - actual_start} lines")
print(f"  - v4 new content: {len(NEW_BOOKING_SECTION.splitlines())} lines")

# 替换
new_lines = lines[:actual_start] + [NEW_BOOKING_SECTION + '\n\n'] + lines[actual_end:]

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print(f"OK: wrote {len(new_lines)} lines (was {len(lines)})")