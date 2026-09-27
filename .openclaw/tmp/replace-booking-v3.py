#!/usr/bin/env python3
"""替换 merchant/page.tsx 的 BookingSection 函数为 v3 版本（实时轮换+活动流+您的号码+移动端）"""
import sys

file_path = '/Users/yilinzhao/.openclaw/workspace/barber-qingheos-2026-09-19/src/app/(user)/merchant/page.tsx'

NEW_BOOKING_SECTION = '''// ⭐ 2026-09-20 02:00 奕霖 v3：实时面板（实时轮换 + 您的号码 + 活动流 + 移动端）
function BookingSection() {
  // 中国时间同步（每秒刷新）
  const [now, setNow] = useState(() => new Date())

  // 实时队列（8 秒轮换：A008 完成 → A009 上位 → 新增 A012 加入队尾）
  const [queue, setQueue] = useState([
    { no: 'A008', name: '李先生', status: 'serving', startAt: '14:30', stylist: 'Tony' },
    { no: 'A009', name: '王女士', status: 'waiting', stylist: 'Amy' },
    { no: 'A010', name: '张先生', status: 'waiting', stylist: 'Lily' },
    { no: 'A011', name: '陈女士', status: 'waiting', stylist: 'Tony' },
  ])

  // 活动流（最近 5 条）
  const [activities, setActivities] = useState([
    { time: '14:32', text: '🎉 陈女士加入队列' },
    { time: '14:28', text: '✅ A007 王女士完成服务' },
    { time: '14:25', text: '👋 张先生到店取号' },
  ])

  // 弹窗状态
  const [modal, setModal] = useState<null | 'booking' | 'ticket' | 'agreement'>(null)
  const [bookingSuccess, setBookingSuccess] = useState('')
  const [ticketSuccess, setTicketSuccess] = useState('')

  // 时间同步 interval（每秒）
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  // 队列轮换 interval（每 8 秒）
  useEffect(() => {
    const id = setInterval(() => {
      const nowTime = new Date().toLocaleTimeString('zh-CN', {
        hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Shanghai'
      })
      setQueue(prev => {
        if (prev.length === 0) return prev
        const newQueue = [...prev]
        const completed = newQueue.shift()
        newQueue[0] = { ...newQueue[0], status: 'serving', startAt: nowTime }
        const lastNo = parseInt(newQueue[newQueue.length - 1].no.slice(1))
        const randomNames = ['赵先生', '钱女士', '孙先生', '李女士', '周先生', '吴女士', '郑先生', '王女士']
        const randomStylists = ['Tony', 'Amy', 'Lily']
        newQueue.push({
          no: `A${String(lastNo + 1).padStart(3, '0')}`,
          name: randomNames[Math.floor(Math.random() * randomNames.length)],
          status: 'waiting',
          stylist: randomStylists[Math.floor(Math.random() * randomStylists.length)],
        })
        setActivities(prevActs => [
          { time: nowTime, text: `🎉 ${newQueue[newQueue.length - 1].name}加入队列` },
          { time: nowTime, text: `✅ ${completed.name}完成服务` },
          ...prevActs,
        ].slice(0, 5))
        return newQueue
      })
    }, 8000)
    return () => clearInterval(id)
  }, [])

  const timeStr = now.toLocaleTimeString('zh-CN', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false, timeZone: 'Asia/Shanghai',
  })
  const dateStr = now.toLocaleDateString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    timeZone: 'Asia/Shanghai',
  })
  const weekdayStr = '星期' + ['日','一','二','三','四','五','六'][now.getDay()]

  // 用户位置（简化估算：前面还有 queue 中所有 waiting 的人数）
  const userNumber = bookingSuccess || ticketSuccess
  const waitingCount = queue.filter(q => q.status === 'waiting').length
  const userPosition = userNumber ? waitingCount + 1 : 0
  const userEtaMin = userPosition > 0 ? userPosition * 15 : 0

  // 主题色：暖米 + 深棕 + 金棕（高级沙龙配色）
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

        {/* ⭐ B: 您的号码高亮卡片（取号/预约后显示） */}
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

        {/* ⭐ 大面板：左序号（当前服务）+ 右活动流 + 右队列（D: auto-fit 移动端自动堆叠） */}
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
          {/* 左：当前正在服务的序号（大字 + 渐变背景） */}
          <div style={{
            background: `linear-gradient(135deg, ${t.primary}, ${t.primaryDark})`,
            color: '#fff',
            padding: '32px 20px',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 8,
          }}>
            <div style={{ fontSize: 11, opacity: 0.85, letterSpacing: '0.1em' }}>
              正在服务
            </div>
            <div style={{
              fontSize: 52, fontWeight: 900,
              fontFamily: 'monospace',
              letterSpacing: '0.05em', lineHeight: 1,
            }}>
              {queue[0].no}
            </div>
            <div style={{ fontSize: 13, opacity: 0.95, fontWeight: 600 }}>
              {queue[0].name} · {queue[0].stylist}
            </div>
            <div style={{
              marginTop: 4, padding: '4px 10px',
              background: 'rgba(255,255,255,0.22)',
              borderRadius: 12, fontSize: 11,
            }}>
              开始于 {queue[0].startAt}
            </div>
            <div style={{ marginTop: 6, fontSize: 10, opacity: 0.85 }}>
              ⏱ 每 8 秒自动轮换
            </div>
          </div>

          {/* 右：活动流 + 排队列表 */}
          <div style={{ padding: '20px 24px' }}>
            {/* ⭐ C: 活动流 */}
            <div style={{
              padding: '12px 14px',
              background: t.primaryGlow,
              borderRadius: 10,
              marginBottom: 16,
            }}>
              <div style={{
                fontSize: 11, fontWeight: 700, color: t.primary,
                letterSpacing: '0.05em', marginBottom: 8,
              }}>
                🔥 刚刚发生的
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {activities.slice(0, 3).map((act, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: 10, alignItems: 'center',
                    fontSize: 12, color: t.text,
                  }}>
                    <span style={{
                      fontFamily: 'monospace', fontSize: 11,
                      color: t.textMuted, minWidth: 36,
                    }}>
                      {act.time}
                    </span>
                    <span style={{ flex: 1 }}>{act.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 排队列表 */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: 12,
            }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: t.text }}>
                🚶 实时排队列表
              </h3>
              <span style={{ fontSize: 11, color: t.textMuted }}>
                {waitingCount} 人在等
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {queue.slice(1).map((item, i) => (
                <div key={item.no} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 12px',
                  background: t.bgDeep,
                  borderRadius: 10,
                  border: `1px solid ${t.border}`,
                }}>
                  {/* 左：序号 */}
                  <div style={{
                    minWidth: 50, textAlign: 'center',
                    padding: '5px 8px',
                    background: t.primaryGlow,
                    borderRadius: 8,
                    fontFamily: 'monospace',
                    fontSize: 14, fontWeight: 700,
                    color: t.primary,
                  }}>
                    {item.no}
                  </div>
                  {/* 中：排队信息 */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 14, fontWeight: 600, color: t.text,
                      marginBottom: 2,
                    }}>
                      {item.name} <span style={{ color: t.textMuted, fontWeight: 400, fontSize: 12 }}>· {item.stylist} 老师</span>
                    </div>
                    <div style={{ fontSize: 11, color: t.textSecondary }}>
                      等待中 · 预计 {(i + 1) * 15} 分钟
                    </div>
                  </div>
                  {/* 右：位置 */}
                  <div style={{
                    padding: '3px 8px',
                    background: t.primary,
                    color: '#fff',
                    borderRadius: 12,
                    fontSize: 10, fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}>
                    第 {i + 1} 位
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ⭐ 动作按钮区（点击弹窗） */}
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

        {/* 兜底提示（B 卡片替代了它，保留以防逻辑分支问题） */}
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
    </section>
  )
}
'''

# 读取文件
with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# 用 v2 注释作为锚点定位 BookingSection 起点
actual_start = None
for i, line in enumerate(lines):
    if '⭐ 2026-09-20 01:30 奕霖 v2' in line:
        actual_start = i
        break

if actual_start is None:
    print("ERROR: Could not find BookingSection v2 comment")
    sys.exit(1)

# 找到结束位置（下一个 function ActionButton）
actual_end = None
for i in range(actual_start + 1, len(lines)):
    if lines[i].startswith('function ActionButton'):
        actual_end = i
        break

if actual_end is None:
    print("ERROR: Could not find end of BookingSection")
    sys.exit(1)

print(f"Replacing lines {actual_start+1} to {actual_end} (0-based: {actual_start}-{actual_end-1})")

# 替换：保留 actual_end 之前的内容 + 新内容 + actual_end 之后的内容
new_lines = lines[:actual_start] + [NEW_BOOKING_SECTION + '\n\n'] + lines[actual_end:]

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print(f"OK: wrote {len(new_lines)} lines (was {len(lines)})")