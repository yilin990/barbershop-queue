'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { BUSINESS_CONFIG, type BusinessConfig } from '@/config/business.config'
import { loadMerchantConfig } from '@/domain/merchant/service'

/**
 * /[merchantId]/page.tsx - 多租户动态路由的商户首页
 *
 * 路径示例:
 *   /zhilin/        → 造型师助手 (等同于 /)
 *   /zaofagongchang/  → 造发工场 (第 2 商户测试)
 *   /unknown/       → 兜底用默认造型师助手 config
 *
 * 与原 / 路径的差异:
 *   - 原 / 是单租户, 用静态 import BUSINESS_CONFIG
 *   - 本路由是多租户, 从 URL 动态加载 config
 *   - 内容结构相同, 主题色 + 文案跟随 config
 *
 * 后续扩展:
 *   - 完整复用 /page.tsx 内容 (抽 HomePage 组件)
 *   - 添加 [merchantId]/map, [merchantId]/me 等子路由
 */

interface PageProps {
  params: Promise<{ merchantId: string }>
}

export default function TenantPage({ params }: PageProps) {
  const { merchantId } = use(params)
  const [config, setConfig] = useState<BusinessConfig | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    loadMerchantConfig(merchantId).then((c) => {
      if (!cancelled) {
        setConfig(c)
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [merchantId])

  if (loading) {
    return (
      <div style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#2c1810',
        color: '#fffaf0',
        fontFamily: 'Inter, sans-serif',
      }}>
        <div>加载中…</div>
      </div>
    )
  }

  if (!config) {
    return (
      <div style={{ padding: 40, color: '#fffaf0', background: '#2c1810' }}>
        <h1>商户未找到</h1>
      </div>
    )
  }

  const t = config.theme

  return (
    <div style={{
      minHeight: '100dvh',
      background: t.bgDeep,
      color: t.text,
      fontFamily: 'Inter, -apple-system, sans-serif',
    }}>
      {/* 顶部导航 */}
      <nav style={{
        position: 'fixed',
        top: 0, left: 0, right: 0,
        background: `${t.bgDeep}f0`,
        backdropFilter: 'blur(20px)',
        borderBottom: `1px solid ${t.glassBorder}`,
        padding: '16px 40px',
        zIndex: 100,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40,
            background: `linear-gradient(135deg, ${t.green}, ${t.greenDark})`,
            borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20,
          }}>🍵</div>
          <span style={{ fontSize: 18, fontWeight: 700 }}>{config.name}</span>
          <span style={{
            marginLeft: 8,
            padding: '2px 8px',
            background: 'rgba(184, 134, 11, 0.15)',
            color: t.green,
            fontSize: 11,
            borderRadius: 4,
          }}>{config.id}</span>
        </div>
        <div style={{ display: 'flex', gap: 24, fontSize: 14 }}>
          <Link href={`/${merchantId}/map`} style={{ color: t.textSecondary }}>地图</Link>
          <Link href={`/${merchantId}/chat`} style={{ color: t.textSecondary }}>AI 咨询</Link>
          <Link href={`/${merchantId}/orders`} style={{ color: t.textSecondary }}>订单</Link>
          <Link href={`/${merchantId}/me`} style={{ color: t.textSecondary }}>我的</Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 40px',
        paddingTop: 80,
      }}>
        <div style={{ maxWidth: 900, textAlign: 'center' }}>
          <p style={{
            fontSize: 14, color: t.green, marginBottom: 16,
            letterSpacing: '0.1em', fontWeight: 500,
          }}>{config.name}</p>
          <h1 style={{
            fontSize: 64, fontWeight: 800,
            lineHeight: 1.1, marginBottom: 24,
          }}>
            {config.slogan}
          </h1>
          <p style={{
            fontSize: 18, color: t.textSecondary,
            marginBottom: 48, lineHeight: 1.8,
          }}>{config.description}</p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
            <Link
              href={`/${merchantId}/chat`}
              style={{
                padding: '16px 36px',
                background: t.green,
                color: t.bgDeep,
                borderRadius: 100,
                textDecoration: 'none',
                fontWeight: 700,
                fontSize: 16,
              }}
            >开始咨询</Link>
            <Link
              href={`/${merchantId}/map`}
              style={{
                padding: '16px 36px',
                background: 'rgba(255,255,255,0.03)',
                color: t.text,
                border: `1px solid ${t.glassBorder}`,
                borderRadius: 100,
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: 16,
              }}
            >查门店</Link>
          </div>

          {/* 联系方式 */}
          <div style={{
            marginTop: 64,
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 16,
            textAlign: 'left',
          }}>
            <InfoCard label="电话" value={config.contact.phone} theme={t} />
            <InfoCard label="地址" value={config.contact.address} theme={t} />
            <InfoCard label="营业时间" value={config.contact.hours} theme={t} />
          </div>

          {/* 模板信息 */}
          <div style={{
            marginTop: 48,
            padding: 16,
            background: 'rgba(184, 134, 11, 0.05)',
            border: `1px solid ${t.glassBorder}`,
            borderRadius: 8,
            fontSize: 12,
            color: t.textMuted,
            textAlign: 'left',
          }}>
            🦞 <strong>多租户动态路由测试</strong> &nbsp; merchantId = <code>{merchantId}</code>
            <br/>
            配置来源: {config.id === BUSINESS_CONFIG.id ? '默认（business.config.ts）' : 'data/merchants/' + merchantId + '/config.json'}
          </div>
      {/* 品牌故事 */}
      <section style={{
        padding: '100px 40px',
        background: `linear-gradient(180deg, ${t.bgDeep} 0%, ${t.bgCard} 50%, ${t.bgDeep} 100%)`,
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: '15%', left: '5%', width: '400px', height: '400px',
          background: `radial-gradient(circle, ${t.tealGlow} 0%, transparent 60%)`,
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: '10%', right: '5%', width: '500px', height: '500px',
          background: `radial-gradient(circle, ${t.tealGlow} 0%, transparent 60%)`,
          pointerEvents: 'none',
        }} />
        <div style={{ maxWidth: 1100, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 12,
              padding: '8px 20px',
              background: t.tealGlow,
              border: `1px solid ${t.glassBorder}`,
              borderRadius: 100,
              marginBottom: 24,
            }}>
              <span style={{ fontSize: 14, color: t.green, fontWeight: 600, letterSpacing: '0.1em' }}>品牌故事</span>
            </div>
            <h2 style={{ fontSize: 48, fontWeight: 800, marginBottom: 16, lineHeight: 1.2, color: t.text }}>
              {(config as any).brandStory?.title || `${config.name} · 一颗好果，从田间到舌尖`}
            </h2>
            <p style={{ fontSize: 18, color: t.green, fontStyle: 'italic', fontWeight: 500 }}>
              —— {(config as any).brandStory?.subtitle || '近一点，再近一点。'}
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 56, alignItems: 'center' }}>
            <div>
              {((config as any).brandStory?.paragraphs || [
                '铜仁老社区的巷口，有一间开了近十年的鲜生店。',
                '最早的时候，只有一台旧冰柜和一位爱挑拣的老阿姨。街坊邻居想买点好造型，总爱先来这里看看。老阿姨不急着卖，先掰一块给你尝尝，问问家里几口人、有没有小孩老人。',
                '后来阿姨退休了，店里来了一位新店员。街坊们发现，他有点"较真"，每次进货都要挨个检查造型的新鲜度，叶子蔫了、表皮软了，坚决不上架。奇怪的是，大家反而更愿意来找他——因为他认真，每一颗果都要亲自尝过才敢卖给街坊。',
                '十年，小店慢慢变成老店。货架换过几茬，门头也重新刷过漆。但那些熟悉的街坊，进门还是习惯先喊一声"来了啊"，像回家一样。',
              ]).map((para: string, i: number, arr: string[]) => (
                <p key={i} style={{
                  fontSize: 16, color: t.textSecondary, lineHeight: 2,
                  marginBottom: i === arr.length - 1 ? 0 : 20,
                  textIndent: '2em',
                }}>{para}</p>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {((config as any).brandStory?.highlights || [
                { icon: '🍎', label: '近十年老鲜生店' },
                { icon: '🍵', label: '先尝后买，不满意不收钱' },
                { icon: '🤝', label: '每颗果亲自挑过' },
                { icon: '🏠', label: '街坊的"第二个家"' },
              ]).map((h: any, i: number) => (
                <div key={i} style={{
                  padding: '20px 24px',
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: 16,
                  border: `1px solid ${t.glassBorder}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  transition: 'all 0.3s ease',
                }}>
                  <div style={{
                    width: 52, height: 52,
                    background: `linear-gradient(135deg, ${t.tealGlow}, ${t.tealGlow})`,
                    borderRadius: 14,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 26, flexShrink: 0,
                  }}>{h.icon}</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: t.text }}>{h.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
        </div>
      </section>

      {/* ⭐ 2026-09-20 01:14 奕霖立项：理发店 4 大功能区（白色主题） */}
      <section id="booking" style={{
        padding: '60px 20px 80px',
        background: t.bgDeep,
        borderTop: `1px solid ${t.glassBorder}`,
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div style={{
              display: 'inline-block', padding: '6px 16px',
              background: t.tealGlow, borderRadius: 20,
              color: t.teal, fontSize: 13, fontWeight: 600,
              marginBottom: 16,
            }}>📅 预约 · 取号 · 实时排队</div>
            <h2 style={{ fontSize: 40, fontWeight: 800, color: t.text, marginBottom: 12 }}>
              线上一键预约 · 到店不排队
            </h2>
            <p style={{ fontSize: 16, color: t.textSecondary }}>
              选发型师 · 选时段 · 系统自动锁位 · 提前 5 分钟到店
            </p>
          </div>

          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 20, marginBottom: 40,
          }}>
            {/* 卡片 1：在线预约 */}
            <div style={{
              padding: 28,
              background: t.bgCard,
              border: `1px solid ${t.glassBorder}`,
              borderRadius: 16,
            }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📅</div>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: t.text, marginBottom: 8 }}>
                在线预约
              </h3>
              <p style={{ fontSize: 14, color: t.textSecondary, marginBottom: 16, lineHeight: 1.6 }}>
                提前 1-7 天选发型师 + 选时段<br/>
                系统自动锁位，到店直接报预约号
              </p>
              <BookingForm theme={t} />
            </div>

            {/* 卡片 2：实时排队 */}
            <div style={{
              padding: 28,
              background: t.bgCard,
              border: `1px solid ${t.glassBorder}`,
              borderRadius: 16,
            }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🚶</div>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: t.text, marginBottom: 8 }}>
                实时排队
              </h3>
              <p style={{ fontSize: 14, color: t.textSecondary, marginBottom: 16, lineHeight: 1.7 }}>
                当前正在服务：<b style={{ color: t.teal }}>A08</b><br/>
                您前面还有 <b style={{ color: t.text }}>3 位</b><br/>
                预计等待 <b style={{ color: t.text }}>25 分钟</b>
              </p>
              <div style={{
                padding: '12px 16px',
                background: t.tealGlow,
                borderRadius: 10,
                fontSize: 13, color: t.textSecondary,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span>⏱</span>
                <span>最后更新：刚刚 · 每 30 秒刷新</span>
              </div>
            </div>

            {/* 卡片 3：现场取号 */}
            <div style={{
              padding: 28,
              background: t.bgCard,
              border: `1px solid ${t.glassBorder}`,
              borderRadius: 16,
            }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🎫</div>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: t.text, marginBottom: 8 }}>
                现场取号
              </h3>
              <p style={{ fontSize: 14, color: t.textSecondary, marginBottom: 16, lineHeight: 1.6 }}>
                输入手机号，立即拿号<br/>
                到号会微信通知
              </p>
              <TakeTicketForm theme={t} />
            </div>
          </div>

          {/* 协议卡片 */}
          <div style={{
            padding: 28,
            background: t.bgCard,
            border: `1px solid ${t.glassBorder}`,
            borderRadius: 16,
          }}>
            <h3 style={{
              fontSize: 18, fontWeight: 700, color: t.text,
              marginBottom: 16,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{ fontSize: 24 }}>📋</span>
              <span>预约与排队协议（请仔细阅读）</span>
            </h3>
            <ol style={{
              paddingLeft: 20,
              fontSize: 14, color: t.textSecondary,
              lineHeight: 1.9,
              margin: 0,
            }}>
              <li style={{ marginBottom: 8 }}>
                <b style={{ color: t.text }}>提前到店</b>：预约时段请提前 <b style={{ color: t.teal }}>5 分钟</b> 到店，超时未到视为放弃。
              </li>
              <li style={{ marginBottom: 8 }}>
                <b style={{ color: t.text }}>晚到取消</b>：晚到 <b style={{ color: t.accent }}>2 分钟</b> 系统自动取消预约，号源自动释放给现场排队顾客。
              </li>
              <li style={{ marginBottom: 8 }}>
                <b style={{ color: t.text }}>线上预约与线下排队互斥</b>：同一时段预约号优先于现场取号顾客，预约取消后该号源立刻加入线下排队。
              </li>
              <li style={{ marginBottom: 8 }}>
                <b style={{ color: t.text }}>取消规则</b>：请至少提前 30 分钟取消，3 次无故违约将限制后续预约。
              </li>
              <li style={{ marginBottom: 8 }}>
                <b style={{ color: t.text }}>改约规则</b>：可随时取消原预约并重新预约，不计入违约。
              </li>
              <li>
                <b style={{ color: t.text }}>争议处理</b>：如有疑问请拨打 <b style={{ color: t.teal }}>{config.contact.phone}</b> 或到店咨询。
              </li>
            </ol>
            <div style={{
              marginTop: 20, padding: '12px 16px',
              background: t.tealGlow, borderRadius: 10,
              fontSize: 13, color: t.textSecondary,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ fontSize: 18 }}>🛡</span>
              <span>本协议由 <b style={{ color: t.teal }}>qingheos</b> 提供技术支持 · 数据归属顾客</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

function InfoCard({ label, value, theme }: { label: string; value: string; theme: any }) {
  return (
    <div style={{
      padding: 16,
      background: 'rgba(255,255,255,0.02)',
      border: `1px solid ${theme.glassBorder}`,
      borderRadius: 12,
    }}>
      <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 4, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 14, color: theme.text }}>{value}</div>
    </div>
  )
}

// ⭐ 2026-09-20 01:14 奕霖立项：理发店预约表单（在线预约）
function BookingForm({ theme }: { theme: any }) {
  const [stylist, setStylist] = useState('tony')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [phone, setPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  async function submit() {
    setError('')
    if (!phone || phone.length < 11) { setError('请填写 11 位手机号'); return }
    if (!date || !time) { setError('请选择日期和时段'); return }
    setSubmitting(true)
    try {
      await new Promise((r) => setTimeout(r, 800))
      const no = 'A' + Math.floor(Math.random() * 99).toString().padStart(2, '0')
      setSuccess(no)
    } catch (e: any) {
      setError(e?.message || '提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div style={{ padding: 20, background: theme.tealGlow, borderRadius: 12, textAlign: 'center' }}>
        <div style={{ fontSize: 14, color: theme.textSecondary, marginBottom: 8 }}>预约成功</div>
        <div style={{ fontSize: 36, fontWeight: 900, color: theme.teal, letterSpacing: '0.1em' }}>{success}</div>
        <div style={{ fontSize: 12, color: theme.textSecondary, marginTop: 8 }}>
          请提前 5 分钟到店 · 晚到 2 分钟自动取消
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <select value={stylist} onChange={(e) => setStylist(e.target.value)} style={inputStyle(theme)}>
        <option value="tony">Tony 老师（烫染专家）</option>
        <option value="amy">Amy（资深剪发）</option>
        <option value="lily">Lily（造型师）</option>
      </select>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle(theme)} />
      <select value={time} onChange={(e) => setTime(e.target.value)} style={inputStyle(theme)}>
        <option value="">选择时段</option>
        <option value="10:00">10:00</option>
        <option value="11:00">11:00</option>
        <option value="14:00">14:00</option>
        <option value="15:00">15:00</option>
        <option value="16:00">16:00</option>
        <option value="17:00">17:00</option>
      </select>
      <input
        type="tel"
        placeholder="手机号（接收通知）"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        style={inputStyle(theme)}
      />
      {error && <div style={{ fontSize: 12, color: theme.accent }}>{error}</div>}
      <button
        onClick={submit}
        disabled={submitting}
        style={{
          padding: '12px 16px',
          background: submitting ? theme.textMuted : theme.teal,
          color: '#fff',
          border: 'none',
          borderRadius: 10,
          fontSize: 14,
          fontWeight: 600,
          cursor: submitting ? 'not-allowed' : 'pointer',
        }}
      >
        {submitting ? '提交中…' : '✅ 立即预约'}
      </button>
    </div>
  )
}

// ⭐ 2026-09-20 01:14 奕霖立项：理发店取号表单（现场取号）
function TakeTicketForm({ theme }: { theme: any }) {
  const [phone, setPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [ticket, setTicket] = useState('')

  async function take() {
    if (!phone || phone.length < 11) return
    setSubmitting(true)
    await new Promise((r) => setTimeout(r, 800))
    setSubmitting(false)
    setTicket('B' + Math.floor(Math.random() * 99).toString().padStart(2, '0'))
  }

  if (ticket) {
    return (
      <div style={{ padding: 20, background: theme.tealGlow, borderRadius: 12, textAlign: 'center' }}>
        <div style={{ fontSize: 14, color: theme.textSecondary, marginBottom: 8 }}>您的排队号</div>
        <div style={{ fontSize: 48, fontWeight: 900, color: theme.teal, letterSpacing: '0.1em' }}>{ticket}</div>
        <div style={{ fontSize: 12, color: theme.textSecondary, marginTop: 8 }}>
          请到店等待叫号 · 前面还有 3 位
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <input
        type="tel"
        placeholder="手机号"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        style={inputStyle(theme)}
      />
      <button
        onClick={take}
        disabled={submitting}
        style={{
          padding: '12px 16px',
          background: submitting ? theme.textMuted : theme.teal,
          color: '#fff',
          border: 'none',
          borderRadius: 10,
          fontSize: 14,
          fontWeight: 600,
          cursor: submitting ? 'not-allowed' : 'pointer',
        }}
      >
        {submitting ? '取号中…' : '🎫 立即取号'}
      </button>
    </div>
  )
}

function inputStyle(theme: any) {
  return {
    padding: '10px 12px',
    background: '#fff',
    border: `1px solid ${theme.glassBorder}`,
    borderRadius: 8,
    fontSize: 14,
    color: theme.text,
    outline: 'none',
    fontFamily: 'inherit',
  } as any
}
