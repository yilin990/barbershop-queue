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

  // ⭐ 2026-09-20 15:07 奕霖立：实时排队列表 view 状态（state 必须最先定义）
  const [queueView, setQueueView] = useState<'flat' | 'byStylist'>('flat')

  // ⭐ 2026-09-20 15:34 奕霖立：店长控制台模式（3 档套餐 / per-stylist 自助管）
  type ManagerMode = 'owner' | 'perStylist' | 'ai'
  const [managerTab, setManagerTab] = useState<ManagerMode>('owner')
  const [managedStylist, setManagedStylist] = useState<'Tony' | 'Amy' | 'Lily'>('Tony')

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
  const stylistsList: ('Tony' | 'Amy' | 'Lily')[] = ['Tony', 'Amy', 'Lily']
  // ⭐ 2026-09-20 15:07 奕霖立：per-stylist 分组（必须依赖 arrivedOrders/reservedTodayOrders 定义后）
  const ordersByStylist: Record<'Tony' | 'Amy' | 'Lily', Order[]> = (() => {
    const groups: Record<'Tony' | 'Amy' | 'Lily', Order[]> = { Tony: [], Amy: [], Lily: [] }
    ;[...arrivedOrders, ...reservedTodayOrders].forEach(o => {
      if (!groups[o.stylistName as 'Tony' | 'Amy' | 'Lily']) groups[o.stylistName as 'Tony' | 'Amy' | 'Lily'] = []
      groups[o.stylistName as 'Tony' | 'Amy' | 'Lily'].push(o)
    })
    return groups
  })()
  const reservedTomorrowOrders = orders.filter(o => o.status === 'reserved' && o.scheduledDate === 'tomorrow').sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
  const activeOrders = orders.filter(o => o.status === 'serving' || o.status === 'arrived' || o.status === 'reserved')
  const currentServing = servingOrders[0]

  // 用户位置（前面还有 N 位）
  const userNumber = bookingSuccess || ticketSuccess
  const totalInQueue = arrivedOrders.length + reservedTodayOrders.length
  // 现场取号排在 arrived 末尾，预约用户按 scheduledAt 插入相应位置
  const userPositionAhead = userNumber ? (ticketSuccess ? arrivedOrders.length : 0) : 0
  const userEtaMin = userPositionAhead > 0 ? userPositionAhead * 15 : 0

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
                前面还有 <b style={{ fontSize: 20, fontFamily: 'monospace' }}>{userPositionAhead}</b> 位
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

        {/* ⭐ 2026-09-20 14:26 奕霖立：首次进店 PIN 提示卡（可选设置） */}
        {showPinPrompt && !hasPin() && (
          <div style={{
            marginBottom: 16,
            padding: '14px 18px',
            background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
            border: '1px solid #f59e0b',
            borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#78350f', marginBottom: 4 }}>
                🔐 提示：是否设置 PIN 密码保护店长模式？
              </div>
              <div style={{ fontSize: 12, color: '#92400e' }}>
                店员手机也能扫码进页，只有输入正确 PIN 才能进店长模式
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                onClick={() => setPinModal('setup')}
                style={{
                  padding: '8px 16px',
                  background: '#92400e', color: '#fff', border: 'none',
                  borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}
              >设置 PIN</button>
              <button
                onClick={() => { dismissRemind(); setShowPinPrompt(false) }}
                style={{
                  padding: '8px 12px',
                  background: 'transparent', color: '#92400e',
                  border: '1px solid #92400e',
                  borderRadius: 8, fontSize: 12, cursor: 'pointer',
                }}
              >以后再说</button>
              <button
                onClick={() => { dismissRemind(); setShowPinPrompt(false) }}
                title="下次不再提醒此提示"
                style={{
                  padding: '8px 12px',
                  background: 'transparent', color: '#92400e',
                  border: 'none',
                  borderRadius: 8, fontSize: 11, cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >不再提醒</button>
            </div>
          </div>
        )}

        {/* ⭐ 店长控制台（managerMode toggle，OFF 时只显示紧凑切换按钮） */}
        <div style={{ marginBottom: 16 }}>
          {managerMode ? (
            <>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 10,
                flexWrap: 'wrap', gap: 8,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, flexWrap: 'wrap' }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: t.text, margin: 0 }}>
                    🎛️ 店长控制台
                  </h3>
                  {/* ⭐ 2026-09-20 15:34 奕霖立：3 档模式选择器（基础/智能/旗舰） */}
                  <div style={{
                    display: 'flex', background: t.bgDeep,
                    borderRadius: 6, padding: 2,
                    border: `1px solid ${t.border}`,
                  }}>
                    {([
                      { key: 'owner',       label: '👑 老板管',     hint: '基础版' },
                      { key: 'perStylist',  label: '👨‍🎨 自助管',   hint: '智能版' },
                      { key: 'ai',          label: '🤖 AI 管',     hint: '旗舰版' },
                    ] as { key: ManagerMode; label: string; hint: string }[]).map(tab => (
                      <button
                        key={tab.key}
                        onClick={() => setManagerTab(tab.key)}
                        style={{
                          padding: '5px 10px',
                          background: managerTab === tab.key ? t.primary : 'transparent',
                          color: managerTab === tab.key ? '#fff' : t.textMuted,
                          border: 'none', borderRadius: 4,
                          fontSize: 11, fontWeight: 600, cursor: 'pointer',
                        }}
                      >{tab.label}</button>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, color: t.textMuted }}>
                    {managerTab === 'owner' && `共 ${activeOrders.length} 单进行中`}
                    {managerTab === 'perStylist' && `${managedStylist} 的单`}
                    {managerTab === 'ai' && 'AI 自动管理'}
                  </span>
                  <button
                    onClick={() => setManagerMode(false)}
                    style={{
                      padding: '6px 14px',
                      background: t.accent,
                      color: '#fff', border: 'none', borderRadius: 8,
                      fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    ✕ 关闭店长模式
                  </button>
                </div>
                {hasPin() && (
                  <button
                    onClick={() => setPinModal('change')}
                    style={{
                      marginLeft: 8,
                      padding: '6px 12px',
                      background: 'transparent',
                      color: t.primary, border: `1px solid ${t.primary}`,
                      borderRadius: 8,
                      fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    🔑 修改 PIN
                  </button>
                )}
              </div>

              <div style={{
                background: t.bgCard,
                border: `2px solid ${t.primary}`,
                borderRadius: 12,
                padding: 14,
                boxShadow: '0 4px 16px rgba(184, 134, 11, 0.1)',
              }}>
              {managerTab === 'perStylist' && (
                <div style={{
                  display: 'flex', gap: 6, marginBottom: 12,
                  padding: 6,
                  background: t.bgDeep,
                  borderRadius: 8,
                  border: `1px solid ${t.border}`,
                }}>
                  {([
                    { name: 'Tony',  emoji: '👨‍🎨' },
                    { name: 'Amy',   emoji: '👩‍💼' },
                    { name: 'Lily',  emoji: '💁‍♀️' },
                  ] as { name: 'Tony' | 'Amy' | 'Lily'; emoji: string }[]).map(s => {
                    const cnt = activeOrders.filter(o => o.stylistName === s.name).length
                    // ⭐ 16:37 奕霖拍板：店长卡片只需 emoji + 名字 + 单数
                    const isSelected = managedStylist === s.name
                    return (
                      <button
                        key={s.name}
                        onClick={() => setManagedStylist(s.name)}
                        style={{
                          flex: 1, padding: '8px 4px',
                          background: isSelected ? t.primary : 'transparent',
                          color: isSelected ? '#fff' : t.text,
                          border: 'none', borderRadius: 6,
                          cursor: 'pointer',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                        }}
                      >
                        <span style={{ fontSize: 16 }}>{s.emoji}</span>
                        <span style={{ fontSize: 12, fontWeight: 700 }}>{s.name}</span>
                        <span style={{
                          fontSize: 10, fontWeight: 600,
                          opacity: isSelected ? 0.95 : 0.7,
                        }}>{cnt} 单</span>
                      </button>
                    )
                  })}
                </div>
              )}

              {managerTab === 'ai' && (
                <div style={{
                  padding: '40px 20px', textAlign: 'center',
                  background: t.bgDeep,
                  borderRadius: 10,
                  border: `1px dashed ${t.border}`,
                }}>
                  <div style={{ fontSize: 36, marginBottom: 12 }}>🤖</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 6 }}>
                    AI 自动管理 · 即将上线
                  </div>
                  <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 12 }}>
                    AI 将自动叫号、确认到店、推进进度
                  </div>
                  <div style={{
                    display: 'inline-block',
                    padding: '4px 12px',
                    background: 'rgba(184, 134, 11, 0.15)',
                    color: t.primary,
                    borderRadius: 12, fontSize: 11, fontWeight: 700,
                  }}>旗舰版 ¥299/月</div>
                </div>
              )}

              {managerTab !== 'ai' && (
                (() => {
                  const displayedOrders = managerTab === 'perStylist'
                    ? activeOrders.filter(o => o.stylistName === managedStylist)
                    : activeOrders
                  return displayedOrders.length === 0 ? (
                    <div style={{ padding: 20, textAlign: 'center', color: t.textMuted, fontSize: 13 }}>
                      😊 {managerTab === 'perStylist' ? `${managedStylist} 暂无进行中单` : '当前没有进行中的订单'}
                    </div>
                  ) : (
                    <div style={{
                      display: 'flex', flexDirection: 'column', gap: 8,
                      maxHeight: 400, overflowY: 'auto',
                      paddingRight: 6, marginRight: -6,
                    } as React.CSSProperties}>
                      {displayedOrders.map(o => {
                    const badge = statusLabel(o.status)
                    return (
                      <div key={o.id} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 12px',
                        background: t.bgDeep,
                        border: `1px solid ${t.border}`,
                        borderRadius: 10,
                        flexWrap: 'wrap',
                        flexShrink: 0,
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
              )
            })()
          )}
              </div>
            </>
          ) : (
            <button
              onClick={() => {
                if (!hasPin()) {
                  setPinModal('setup')
                } else if (isInGracePeriod()) {
                  // ⭐ 2026-09-20 14:37 奕霖拍板：免密宽限期内直接切换
                  setManagerMode(true)
                  setLastAuthTime()
                } else {
                  setPinModal('unlock')
                }
              }}
              style={{
                padding: '10px 18px',
                background: t.primary,
                color: '#fff', border: 'none', borderRadius: 10,
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 8,
                boxShadow: '0 2px 8px rgba(184, 134, 11, 0.25)',
              }}
            >
              🎛️ 开启店长模式 <span style={{ fontSize: 11, opacity: 0.85, fontWeight: 500 }}>· {activeOrders.length} 单进行中</span>
            </button>
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
              paddingBottom: 10,
              borderBottom: `1px solid ${t.border}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: t.text, margin: 0 }}>
                  🚶 实时排队
                </h3>
                {/* ⭐ 2026-09-20 15:07 奕霖立：视图切换 [时间][全部] */}
                <div style={{
                  display: 'flex', background: t.bgDeep,
                  borderRadius: 6, padding: 2, marginLeft: 4,
                  border: `1px solid ${t.border}`,
                }}>
                  <button
                    onClick={() => setQueueView('flat')}
                    style={{
                      padding: '4px 10px',
                      background: queueView === 'flat' ? t.primary : 'transparent',
                      color: queueView === 'flat' ? '#fff' : t.textMuted,
                      border: 'none', borderRadius: 4,
                      fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    }}
                  >时间</button>
                  <button
                    onClick={() => setQueueView('byStylist')}
                    style={{
                      padding: '4px 10px',
                      background: queueView === 'byStylist' ? t.primary : 'transparent',
                      color: queueView === 'byStylist' ? '#fff' : t.textMuted,
                      border: 'none', borderRadius: 4,
                      fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    }}
                  >全部</button>
                </div>
              </div>
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
            </div>

            {/* ⭐ 2026-09-20 15:07 奕霖立：按 view 切换 flat 列表 / per-stylist 3 列 */}
            {queueView === 'flat' ? (
              <div style={{
                maxHeight: 320,
                overflowY: 'auto',
                display: 'flex', flexDirection: 'column', gap: 8,
                paddingRight: 4,
                marginRight: -4,
              } as React.CSSProperties}>
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
                        flexShrink: 0,
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
                        <div style={{
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
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            ) : (
              /* ⭐ 全部视图：按理发师分 3 列，每列独立滚动 */
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 8,
                maxHeight: 320,
                overflowY: 'auto',
                paddingRight: 4,
                marginRight: -4,
              } as React.CSSProperties}>
                {stylistsList.map(stylistName => {
                  const stylistOrders = ordersByStylist[stylistName] || []
                  const emoji = stylistName === 'Tony' ? '👨‍🎨' : stylistName === 'Amy' ? '👩‍💼' : '💁‍♀️'
                  return (
                    <div key={stylistName} style={{
                      background: t.bgDeep,
                      borderRadius: 10,
                      padding: 10,
                      border: `1px solid ${t.border}`,
                    }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        marginBottom: 8,
                        paddingBottom: 6,
                        borderBottom: `1px solid ${t.border}`,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: 16 }}>{emoji}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{stylistName}</span>
                        </div>
                        <span style={{
                          fontSize: 11, fontWeight: 700,
                          padding: '2px 7px',
                          background: stylistOrders.length > 0 ? t.primary : t.textMuted,
                          color: '#fff',
                          borderRadius: 10,
                          fontFamily: 'monospace',
                        }}>{stylistOrders.length}单</span>
                      </div>
                      {stylistOrders.length === 0 ? (
                        <div style={{
                          padding: '20px 4px', textAlign: 'center',
                          color: t.textMuted, fontSize: 11,
                        }}>😊 空闲</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {stylistOrders.map(o => {
                            const isArrived = o.status === 'arrived'
                            return (
                              <div key={o.id} style={{
                                padding: '6px 8px',
                                background: t.bgCard,
                                borderRadius: 6,
                                borderLeft: `3px solid ${isArrived ? t.success : t.primary}`,
                                fontSize: 11,
                              }}>
                                <div style={{
                                  fontFamily: 'monospace',
                                  fontWeight: 700,
                                  color: isArrived ? t.success : t.primary,
                                  marginBottom: 2,
                                }}>{o.scheduledAt}</div>
                                <div style={{
                                  fontWeight: 600, color: t.text,
                                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                }}>{o.customerName}</div>
                                <div style={{ color: t.textMuted, fontSize: 10 }}>
                                  {o.service} · {isArrived ? '已到' : '预约'}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
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

      {/* ⭐ 2026-09-20 14:26 奕霖立：PIN 弹窗挂载 */}
      {pinModal === 'setup' && (
        <PinSetupModal t={t} onClose={() => setPinModal(null)} isFirstTime={!hasPin()}
          onSuccess={() => { setManagerMode(true); setShowPinPrompt(false); setLastAuthTime() }} />
      )}
      {pinModal === 'change' && (
        <PinSetupModal t={t} onClose={() => setPinModal(null)} isFirstTime={false} />
      )}
      {pinModal === 'unlock' && (
        <PinUnlockModal t={t} onClose={() => setPinModal(null)}
          onSuccess={() => { setManagerMode(true); setLastAuthTime() }} />
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


function ActionButton({ icon, label, onClick, t }: {
  icon: string; label: string; onClick: () => void; t: any
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '16px 18px',
        background: t.bgCard,
        border: `1px solid ${t.border}`,
        borderRadius: 12,
        cursor: 'pointer',
        fontSize: 15, fontWeight: 600,
        color: t.text,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        boxShadow: '0 2px 8px rgba(184, 134, 11, 0.06)',
      }}
    >
      <span style={{ fontSize: 20 }}>{icon}</span>
      <span>{label}</span>
    </button>
  )
}

// ⭐ 弹窗遮罩
function ModalOverlay({ children, onClose, t }: {
  children: React.ReactNode; onClose: () => void; t: any
}) {
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0,
      background: t.overlayBg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 16,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: t.bgCard,
        borderRadius: 16,
        width: '100%', maxWidth: 440,
        maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 16px 48px rgba(0, 0, 0, 0.2)',
        border: `1px solid ${t.border}`,
      }}>
        {children}
      </div>
    </div>
  )
}

// ⭐ 弹窗头部
function ModalHeader({ title, onClose, t }: {
  title: string; onClose: () => void; t: any
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '16px 20px',
      borderBottom: `1px solid ${t.border}`,
    }}>
      <h3 style={{ fontSize: 18, fontWeight: 700, color: t.text }}>{title}</h3>
      <button onClick={onClose} style={{
        background: 'transparent', border: 'none',
        fontSize: 24, color: t.textMuted,
        cursor: 'pointer', padding: 0, lineHeight: 1,
      }}>×</button>
    </div>
  )
}

// ⭐ 表单字段（不与原有 Field 冲突）
function FormField({ label, required, children, t }: {
  label: string; required?: boolean; children: React.ReactNode; t: any
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, color: t.textSecondary, fontWeight: 500, marginBottom: 4 }}>
        {label} {required && <span style={{ color: t.accent }}>*</span>}
      </div>
      {children}
    </div>
  )
}

// ⭐ 在线预约弹窗
function BookingModal({ t, onClose, onSuccess }: {
  t: any; onClose: () => void; onSuccess: (no: string) => void
}) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [stylist, setStylist] = useState<'Tony' | 'Amy' | 'Lily'>('Tony')
  const [dateKey, setDateKey] = useState<'today' | 'tomorrow' | 'dayAfter'>('today')
  const [timeSlot, setTimeSlot] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [bookedHint, setBookedHint] = useState('')

  // ⭐ 2026-09-20 14:47 奕霖立：24 个时段 (10:00-21:30, 半小时一档)
  const TIME_SLOTS: string[] = []
  for (let h = 10; h <= 21; h++) {
    TIME_SLOTS.push(`${h}:00`)
    TIME_SLOTS.push(`${h}:30`)
