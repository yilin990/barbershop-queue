'use client'

import { toast } from '@/lib/ui-bus'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/AppLayout'
import WechatHint from '@/components/WechatHint'
// ⭐ 奕霖 2026-10-04 00:04：内联 SVG 替代 Iconify（真 SSR）
import { AutoAwesomeIcon } from '@/components/icons/BrandIcons'
import { BUSINESS_CONFIG } from '@/config/business.config'
import MapLauncher from '@/components/MapLauncher'
import { PinSetupModal } from '@/components/PinSetupModal'
import { PinUnlockModal } from '@/components/PinUnlockModal'
// ⭐ 2026-09-20 17:46 奕霖拍板：BookingSection 抽出为独立组件，merchant + queue 两处 100% 一致
import BookingSection from '@/components/BookingSection'
// v1.1.54 清禾：商户 ID 单一真相源。原来这里硬编码 merchantCode:'G0001'
// → 那个 code 的真身是 m_grocery_001（果蔬店），理发店的 code 是 B0001。
import { DEFAULT_MERCHANT_ID } from '@/lib/merchant'
import {
  hasPin, getRemindState, dismissRemind, isLockExpired,
  isInGracePeriod, getGraceRemainingMs,
  setLastAuthTime, clearPin,
} from '@/lib/manager-auth'

// 与 /community 一致的 UI 风格
// ⭐ 2026-09-20 01:42 奕霖拍板：全局改暖米深棕沙龙配色（76+46 处引用）
const PRIMARY = '#b8860b'
const PRIMARY_RGBA = '184, 134, 11'
const GOLD = PRIMARY                 // 别名兼容：76 处引用
const GOLD_RGBA = PRIMARY_RGBA       // 别名兼容：46 处引用
const GREEN_RGBA = PRIMARY_RGBA      // 历史别名兼容
const GREEN = PRIMARY                // 历史别名兼容
const CARD_BG = 'linear-gradient(180deg, #faf6f0 0%, #fffaf0 100%)'

export default function MerchantDisplayPage() {
  const router = useRouter()
  const [bookingOpen, setBookingOpen] = useState(false)
  // ⭐ 奕霖 2026-08-13 20:07：底部内联二维码小样图 + 点击放大
        const [bookingForm, setBookingForm] = useState({
    name: '',
    phone: '',
    service: '精剪造型',
    date: '',
    time: '',
    note: '',
  })
  const [bookingResult, setBookingResult] = useState<{
    orderNo: string
    pointsAdded: number
    totalPoints: number
  } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  // ⭐ 2026-07-13 14:18 奕霖需求：首页品牌故事接真实数据
  const [merchantStats, setMerchantStats] = useState<{
    productCount: number
    inStockCount: number
    memberCount: number
    orderCount: number
    deliveredCount: number
    reviewCount: number
    avgRating: number
  } | null>(null)
  useEffect(() => {
    fetch('/api/merchant/stats')
      .then(r => r.json())
      .then(d => {
        if (d.success) setMerchantStats(d.data.stats)
      })
      .catch(() => { /* 静默失败，以静态占位为准 */ })
  }, [])
  const [memberData, setMemberData] = useState<any>(null)
  const [memberLoading, setMemberLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [memberOpen, setMemberOpen] = useState(false)
  const [memberPhone, setMemberPhone] = useState('')

  const services = [
    { name: '精剪造型', icon: '✂️', desc: '资深师傅·脸型定制' },
    { name: '染发护色', icon: '🎨', desc: '进口染膏·发质滋养' },
    { name: '烫发造型', icon: '💫', desc: '冷烫热烫·自然持久' },
    { name: '形象设计', icon: '👔', desc: '场合造型·风格咨询' },
    { name: '洗护套餐', icon: '💆', desc: '头皮 SPA·深层护理' },
    { name: '会员特权', icon: '💎', desc: '积分储值·优先预约' },
  ]

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      // 真存到数据库（通过 /api/orders），自动触发会员升级
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // v1.1.54：直接传 merchantId，不再靠 G0001 猜商户
          merchantId: DEFAULT_MERCHANT_ID,
          // v1.1.54：下单后同步写排队表，店长在排队页能看到在线预约
          enqueue: true,
          enqueueService: bookingForm.service,
          scheduledAt: bookingForm.time,
          customerName: bookingForm.name,
          phone: bookingForm.phone,
          items: [
            {
              name: `服务预约 - ${bookingForm.service}`,
              price: 1, // 服务预约象征性收 1 元
              quantity: 1,
            },
          ],
          deliveryType: 'pickup', // 到店
          remark: `预约时间：${bookingForm.date} ${bookingForm.time}${bookingForm.note ? ' | 备注：' + bookingForm.note : ''}`,
          simulateComplete: true, // 演示模式：直接完成 + 算积分
        }),
      })
      const data = await res.json()
      if (!data.success) {
        toast.error('预约失败：' + (data.error || '未知错误'))
        setSubmitting(false)
        return
      }
      // 显示订单号 + 积分
      setBookingResult({
        // v1.1.54：真实字段是顶层 orderNo。原来的 data.order.orderNo 会抛
        // TypeError → 走进 catch → 顾客看到「网络错误」，其实单子已成功。
        orderNo: data.orderNo || data.order?.orderNo || '',
        pointsAdded: data.membership?.pointsAdded ?? 0,
        totalPoints: data.membership?.newPointsBalance ?? 0,
      })
      setSubmitted(true)
      // 5 秒后关闭弹窗（多留点时间看积分）
      setTimeout(() => {
        setBookingOpen(false)
        setSubmitted(false)
        setBookingResult(null)
        setBookingForm({ name: '', phone: '', service: '精剪造型', date: '', time: '', note: '' })
      }, 5000)
    } catch (e: any) {
      toast.error('网络错误：' + (e?.message ?? 'unknown'))
    } finally {
      setSubmitting(false)
    }
  }

  // 会员查询（顾客输入手机号查自己的会员信息）
  const handleMemberLookup = async () => {
    if (!/^1[3-9]\d{9}$/.test(memberPhone)) {
      toast.info('请输入正确的手机号')
      return
    }
    setMemberLoading(true)
    try {
      // v1.1.42 原来查的是 /api/customer/lookup?merchantCode=G0001
      //   那是一套独立的老积分系统(G0001 码 + 积分 + tier)，
      //   跟新的 MemberCard(m_barber_001 + 余额 + 等级) 毫无关系，
      //   所以门店主页「我的会员」永远查不到数据。现在直接查真实储值卡。
      const res = await fetch(`/api/members/${memberPhone}?merchantId=m_barber_001`)
      const data = await res.json()
      if (!data.ok) {
        setMemberData({ card: null })
        return
      }
      setMemberData(data)
    } catch (e: any) {
      toast.error('网络错误：' + (e?.message ?? 'unknown'))
    } finally {
      setMemberLoading(false)
    }
  }

  const brandStory = BUSINESS_CONFIG.brandStory
  const displayParagraphs = expanded
    ? brandStory.paragraphs
    : brandStory.paragraphs.slice(0, 2)

  return (
    <AppLayout title={BUSINESS_CONFIG.name}>
      {/* ============ Logo + 名称区 ============ */}
      <div style={{
        background: CARD_BG,
        borderRadius: '18px',
        padding: '24px 20px',
        marginBottom: '16px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35)',
        border: `1px solid rgba(${GREEN_RGBA}, 0.1)`,
        backdropFilter: 'blur(20px)',
        textAlign: 'center',
      }}>
        <div style={{
          width: 72, height: 72, margin: '0 auto 14px',
          background: `linear-gradient(135deg, rgba(${GREEN_RGBA}, 0.2), rgba(${GREEN_RGBA}, 0.05))`,
          borderRadius: 18, padding: 4,
          boxShadow: `0 4px 20px rgba(${GREEN_RGBA}, 0.2)`,
        }}>
          <img src={BUSINESS_CONFIG.assets.logo} alt={BUSINESS_CONFIG.name} style={{
            width: '100%', height: '100%', borderRadius: 14, objectFit: 'cover',
          }} />
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#2c1810', marginBottom: 6 }}>
          {BUSINESS_CONFIG.name}
        </h1>
        <p style={{
          fontSize: 13, color: GREEN, fontStyle: 'italic', marginBottom: 10,
        }}>—— 近一点，再近一点 ——</p>
        <p style={{
          display: 'inline-block',
          padding: '4px 12px',
          background: `rgba(${GREEN_RGBA}, 0.1)`,
          border: `1px solid rgba(${GREEN_RGBA}, 0.3)`,
          borderRadius: 100,
          fontSize: 12, color: GREEN, fontWeight: 600,
        }}>
          🟢 营业中 · {BUSINESS_CONFIG.contact.hours}
        </p>
        {/* 我的会员入口 */}
        <div
          onClick={() => setMemberOpen(true)}
          style={{
            display: 'inline-block',
            marginTop: 10,
            padding: '6px 14px',
            background: 'rgba(184, 134, 11, 0.05)',
            border: `1px solid rgba(${GREEN_RGBA}, 0.3)`,
            borderRadius: 100,
            fontSize: 12, color: GREEN, fontWeight: 500,
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          🎫 我的会员 / 查积分
        </div>
      </div>

      {/* ============ 快捷操作 ============ */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '8px',
        marginBottom: '16px',
      }}>
        <a href={`tel:${BUSINESS_CONFIG.contact.phone}`} style={{
          background: `linear-gradient(135deg, rgba(${GREEN_RGBA}, 0.2), rgba(${GREEN_RGBA}, 0.05))`,
          border: `1px solid rgba(${GREEN_RGBA}, 0.3)`,
          padding: '14px 8px', borderRadius: '14px',
          textAlign: 'center', textDecoration: 'none',
          fontSize: 12, fontWeight: 600, color: GREEN,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        }}>
          <span style={{ fontSize: 22 }}>📞</span>
          致电商家
        </a>
        <button onClick={() => router.push('/merchant/queue')} style={{
          background: `linear-gradient(135deg, rgba(${GREEN_RGBA}, 0.2), rgba(${GREEN_RGBA}, 0.05))`,
          border: `1px solid rgba(${GREEN_RGBA}, 0.3)`,
          padding: '14px 8px', borderRadius: '14px',
          textAlign: 'center', cursor: 'pointer',
          fontSize: 12, fontWeight: 600, color: GREEN,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          fontFamily: 'inherit',
        }}>
          <span style={{ fontSize: 22 }}>🚶</span>
          实时排队
        </button>
        <a href="/map" style={{
          background: `linear-gradient(135deg, rgba(${GREEN_RGBA}, 0.2), rgba(${GREEN_RGBA}, 0.05))`,
          border: `1px solid rgba(${GREEN_RGBA}, 0.3)`,
          padding: '14px 8px', borderRadius: '14px',
          textAlign: 'center', textDecoration: 'none',
          fontSize: 12, fontWeight: 600, color: GREEN,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        }}>
          <span style={{ fontSize: 22 }}>📍</span>
          导航到店
        </a>
      </div>

      {/* ============ AI 找药入口（2026-07-02 清禾：从精选商品改为 AI 找药）============ */}
      <button
        onClick={() => router.push('/ai-find-drug')}
        style={{
          width: '100%',
          padding: '20px',
          marginBottom: '16px',
          background: `linear-gradient(135deg, rgba(${GREEN_RGBA}, 0.25) 0%, rgba(${GREEN_RGBA}, 0.08) 100%)`,
          border: `1.5px solid rgba(${GREEN_RGBA}, 0.4)`,
          borderRadius: '18px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          cursor: 'pointer',
          textAlign: 'left',
          boxShadow: '0 8px 32px rgba(184, 134, 11, 0.2)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* 背景 halo */}
        <div style={{
          position: 'absolute',
          right: -30, top: -30,
          width: 120, height: 120,
          background: `radial-gradient(circle, rgba(${GREEN_RGBA}, 0.2) 0%, transparent 70%)`,
          pointerEvents: 'none',
        }} />
        <div style={{
          fontSize: '40px',
          width: 56, height: 56,
          background: `linear-gradient(135deg, rgba(${GREEN_RGBA}, 0.3), rgba(${GREEN_RGBA}, 0.1))`,
          borderRadius: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          {/* ⭐ 奕霖 2026-10-04 00:04：内联 SVG 替代 Iconify（真 SSR）+ 金色品牌 + drop-shadow */}
          <AutoAwesomeIcon
            size={36}
            style={{
              color: GREEN,
              filter: 'drop-shadow(0 0 4px rgba(184, 134, 11, 0.3))',
            }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: '17px', fontWeight: 700, color: '#2c1810' }}>造型 AI</span>
            <span style={{
              padding: '2px 8px',
              background: `linear-gradient(135deg, rgba(${GREEN_RGBA}, 0.3), rgba(${GREEN_RGBA}, 0.15))`,
              color: GREEN,
              fontSize: 10, fontWeight: 700,
              borderRadius: 6,
              letterSpacing: '0.5px',
            }}>新</span>
          </div>
          <div style={{ fontSize: '12px', color: `rgba(${GREEN_RGBA}, 0.95)`, lineHeight: 1.5 }}>
            根据脸型与发质，AI 帮你推荐发型 · 数十款风格
          </div>
        </div>
        <div style={{ fontSize: '24px', color: GREEN, opacity: 0.8 }}>›</div>
      </button>

      {/* ⭐ 奕霖 2026-07-07 13:30：店员核销中心从首页移除（用户看不见这个功能） */}
      {/* 店员入口已迁移到「我的」Tab → 底部「我是店员」折叠区 */}

      {/* ============ 品牌故事 ============ */}
      <div style={{
        background: CARD_BG,
        borderRadius: '18px',
        padding: '22px',
        marginBottom: '16px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35)',
        border: `1px solid rgba(${GREEN_RGBA}, 0.1)`,
        backdropFilter: 'blur(20px)',
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 12px',
          background: `rgba(${GREEN_RGBA}, 0.1)`,
          border: `1px solid rgba(${GREEN_RGBA}, 0.2)`,
          borderRadius: 100, marginBottom: 14,
        }}>
          <span style={{ fontSize: 12, color: GREEN, fontWeight: 600 }}>📖 品牌故事</span>
        </div>

        <img
          src="/grocery-assets/brand-barber-hero.jpg"
          alt="造型师助手 · 暖色调理发工作室"
          style={{
            width: '100%',
            borderRadius: '12px',
            marginBottom: '14px',
            objectFit: 'cover',
            maxHeight: '240px',
          }}
        />

        <h2 style={{
          fontSize: 20, fontWeight: 700, color: '#2c1810',
          marginBottom: 6, lineHeight: 1.3,
        }}>{brandStory.title}</h2>
        <p style={{
          fontSize: 13, color: GREEN, fontStyle: 'italic',
          marginBottom: 14,
        }}>—— {brandStory.subtitle}</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {displayParagraphs.map((para, i) => (
            <p key={i} style={{
              fontSize: 14, color: 'rgba(44, 24, 16,0.78)',
              lineHeight: 1.85, textIndent: '2em', margin: 0,
            }}>{para}</p>
          ))}
        </div>

        {brandStory.paragraphs.length > 2 && (
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              marginTop: 10, padding: '6px 14px',
              background: `rgba(${GREEN_RGBA}, 0.08)`,
              border: `1px solid rgba(${GREEN_RGBA}, 0.2)`,
              borderRadius: 100,
              fontSize: 12, color: GREEN, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >{expanded ? '收起 ↑' : `展开 ↓ 还有 ${brandStory.paragraphs.length - 2} 段`}</button>
        )}

        {/* 亮点标签 */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 16 }}>
          {brandStory.highlights.map((h, i) => (
            <span key={i} style={{
              padding: '4px 10px',
              background: `rgba(${GREEN_RGBA}, 0.08)`,
              border: `1px solid rgba(${GREEN_RGBA}, 0.18)`,
              borderRadius: 100,
              fontSize: 12, color: 'rgba(44, 24, 16,0.85)',
            }}>{h.icon} {h.label}</span>
          ))}
        </div>

        {/* ⭐ 2026-07-13 14:18 奕霖需求：接真实数据 */}
        {merchantStats && (
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
            marginTop: 18,
            padding: '14px 0',
            borderTop: `1px solid rgba(${GREEN_RGBA}, 0.1)`,
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: GREEN }}>{merchantStats.productCount.toLocaleString()}</div>
              <div style={{ fontSize: 11, color: 'rgba(44, 24, 16,0.85)', marginTop: 2 }}>在售造型</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: GREEN }}>{merchantStats.memberCount}</div>
              <div style={{ fontSize: 11, color: 'rgba(44, 24, 16,0.9)', marginTop: 2 }}>服务会员</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: GREEN }}>{merchantStats.deliveredCount}</div>
              <div style={{ fontSize: 11, color: 'rgba(44, 24, 16,0.9)', marginTop: 2 }}>已完结订单</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: GREEN }}>
                {merchantStats.avgRating > 0 ? merchantStats.avgRating.toFixed(1) : '—'}
                <span style={{ fontSize: 13, opacity: 0.9 }}> ⭐</span>
              </div>
              <div style={{ fontSize: 11, color: 'rgba(44, 24, 16,0.9)', marginTop: 2 }}>
                {merchantStats.reviewCount > 0 ? `${merchantStats.reviewCount} 条评价` : '暂无评价'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ============ 找药入口（2026-07-01 清禾新加）============ */}
      <button
        onClick={() => router.push('/products')}
        style={{
          width: '100%',
          padding: '18px 20px',
          marginBottom: '16px',
          background: `linear-gradient(135deg, rgba(${GREEN_RGBA}, 0.2) 0%, rgba(${GREEN_RGBA}, 0.08) 100%)`,
          border: `1px solid rgba(${GREEN_RGBA}, 0.35)`,
          borderRadius: '18px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          cursor: 'pointer',
          textAlign: 'left',
          boxShadow: '0 8px 32px rgba(184, 134, 11, 0.15)',
        }}
      >
        <div style={{ fontSize: '32px' }}>🔍</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: '#2c1810', marginBottom: '2px' }}>
            立即咨询
          </div>
          <div style={{ fontSize: '11.5px', color: `rgba(${GREEN_RGBA}, 0.95)` }}>
            数十款风格 · 9 大脸型 · 发型史追踪
          </div>
        </div>
        <div style={{ fontSize: '20px', color: GREEN, opacity: 0.9 }}>›</div>
      </button>

      {/* ============ 服务项目 ============ */}
      <div style={{
        background: CARD_BG,
        borderRadius: '18px',
        padding: '22px',
        marginBottom: '16px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35)',
        border: `1px solid rgba(${GREEN_RGBA}, 0.1)`,
        backdropFilter: 'blur(20px)',
      }}>
        <h2 style={{
          fontSize: 16, fontWeight: 700, color: '#2c1810',
          marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span>💼</span> 服务项目
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          {services.map((s, i) => (
            <div key={i} style={{
              padding: '14px 10px',
              background: `rgba(${GREEN_RGBA}, 0.06)`,
              border: `1px solid rgba(${GREEN_RGBA}, 0.12)`,
              borderRadius: 14,
              textAlign: 'center', cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = `rgba(${GREEN_RGBA}, 0.12)`
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = `rgba(${GREEN_RGBA}, 0.06)`
              }}
            >
              <div style={{ fontSize: 24, marginBottom: 4 }}>{s.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#2c1810', marginBottom: 2 }}>{s.name}</div>
              <div style={{ fontSize: 11, color: 'rgba(44, 24, 16,0.9)' }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ============ 联系方式 ============ */}
      <div style={{
        background: CARD_BG,
        borderRadius: '18px',
        padding: '22px',
        marginBottom: '16px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35)',
        border: `1px solid rgba(${GREEN_RGBA}, 0.1)`,
        backdropFilter: 'blur(20px)',
      }}>
        <h2 style={{
          fontSize: 16, fontWeight: 700, color: '#2c1810',
          marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span>📍</span> 联系方式
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <InfoRow icon="🏠" label="门店地址" value={BUSINESS_CONFIG.contact.address} />
          {/* ⭐ 2026-07-30 03:59 奕霖需求：地图选 app 导航（精确定位） */}
          {(() => {
            const c = BUSINESS_CONFIG.contact.coords
            const lng = (c && c[0]) ?? 109.200269
            const lat = (c && c[1]) ?? 27.732818
            return (
              <div style={{ display: 'flex', justifyContent: 'flex-start', paddingLeft: 4 }}>
                <MapLauncher
                  lat={lat}
                  lng={lng}
                  name={BUSINESS_CONFIG.name}
                  address={BUSINESS_CONFIG.contact.address}
                  label="导航到店"
                  variant="ghost"
                />
              </div>
            )
          })()}
          <InfoRow icon="📞" label="联系电话" value={BUSINESS_CONFIG.contact.phone} />
          <InfoRow icon="⏰" label="营业时间" value={BUSINESS_CONFIG.contact.hours} />
        </div>
      </div>

      {/* ⭐ 奕霖 2026-08-13 20:21：微信/QQ 内置浏览器检测引导 */}
      <WechatHint />
      <div style={{
        textAlign: 'center', padding: '20px 0 100px',
        fontSize: 12, color: 'rgba(44, 24, 16,0.35)',
      }}>
        © 2026 {BUSINESS_CONFIG.name} · 铜仁市碧江区
      </div>

      {/* ============ 预约弹窗 ============ */}
      {bookingOpen && (
        <div onClick={() => setBookingOpen(false)} style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16,
          paddingTop: 'max(60px, env(safe-area-inset-top, 60px))',
          paddingBottom: 'calc(72px + env(safe-area-inset-bottom, 0px))',
          zIndex: 1000,
          overflowY: 'auto',
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: 'linear-gradient(180deg, #0a1410 0%, #2c1810 100%)',
            borderRadius: 20,
            width: '100%', maxWidth: 500,
            maxHeight: 'calc(100dvh - 220px)',
            display: 'flex', flexDirection: 'column',
            borderTop: `1px solid rgba(${GREEN_RGBA}, 0.3)`,
            border: `1px solid rgba(${GREEN_RGBA}, 0.2)`,
            overflow: 'hidden',
            marginTop: 'auto',
            marginBottom: 'auto',
          }}>
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: 24 }}>
              <div style={{
                width: 40, height: 4, background: `rgba(${GREEN_RGBA}, 0.3)`,
                borderRadius: 2, margin: '0 auto 16px',
              }} />
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: '#2c1810' }}>
                📅 预约服务
              </h3>

              {submitted && bookingResult ? (
              <div style={{ textAlign: 'center', padding: '32px 20px' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: GREEN }}>预约成功</div>
                <div style={{ fontSize: 12, color: 'rgba(44, 24, 16,0.9)', marginTop: 4 }}>
                  商家会尽快与您联系
                </div>
                {/* 订单 + 积分 */}
                <div style={{
                  marginTop: 20, padding: 16,
                  background: 'rgba(184, 134, 11, 0.08)',
                  border: '1px solid rgba(184, 134, 11, 0.25)',
                  borderRadius: 12,
                }}>
                  <div style={{ fontSize: 11, color: 'rgba(44, 24, 16,0.9)', marginBottom: 4 }}>
                    订单号
                  </div>
                  <div style={{
                    fontSize: 14, fontWeight: 600, color: GREEN,
                    fontFamily: 'monospace', marginBottom: 12,
                  }}>
                    {bookingResult.orderNo}
                  </div>
                  <div style={{
                    height: 1, background: 'rgba(184, 134, 11, 0.2)', margin: '0 0 12px',
                  }} />
                  <div style={{ fontSize: 12, color: 'rgba(44, 24, 16,0.9)' }}>
                    获得积分 <span style={{ color: GREEN, fontWeight: 700 }}>+{bookingResult.pointsAdded}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(44, 24, 16,0.9)', marginTop: 4 }}>
                    累计积分 <span style={{ color: GREEN, fontWeight: 700 }}>{bookingResult.totalPoints}</span>
                  </div>
                </div>
              </div>
            ) : submitted ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: GREEN }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>预约成功！</div>
              </div>
            ) : (
              <form data-booking-form onSubmit={handleBooking} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Field label="姓名" required>
                  <input
                    required
                    value={bookingForm.name}
                    onChange={(e) => setBookingForm({ ...bookingForm, name: e.target.value })}
                    placeholder="请输入您的姓名"
                    style={inputStyle}
                  />
                </Field>
                <Field label="电话" required>
                  <input
                    required type="tel"
                    value={bookingForm.phone}
                    onChange={(e) => setBookingForm({ ...bookingForm, phone: e.target.value })}
                    placeholder="请输入联系电话"
                    style={inputStyle}
                  />
                </Field>
                <Field label="服务类型">
                  <select
                    value={bookingForm.service}
                    onChange={(e) => setBookingForm({ ...bookingForm, service: e.target.value })}
                    style={inputStyle}
                  >
                    {services.map((s) => (
                      <option key={s.name} value={s.name} style={{ background: '#2c1810' }}>
                        {s.icon} {s.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <Field label="日期" required>
                    <input
                      required type="date"
                      value={bookingForm.date}
                      onChange={(e) => setBookingForm({ ...bookingForm, date: e.target.value })}
                      style={inputStyle}
                    />
                  </Field>
                  <Field label="时间" required>
                    <input
                      required type="time"
                      value={bookingForm.time}
                      onChange={(e) => setBookingForm({ ...bookingForm, time: e.target.value })}
                      style={inputStyle}
                    />
                  </Field>
                </div>
                <Field label="备注">
                  <textarea
                    value={bookingForm.note}
                    onChange={(e) => setBookingForm({ ...bookingForm, note: e.target.value })}
                    placeholder="如有特殊需求请说明..."
                    rows={3}
                    style={{ ...inputStyle, resize: 'none', fontFamily: 'inherit' }}
                  />
                </Field>
              </form>
              )}
            </div>{/* 关闭 flex:1 scroll 区 */}
            
            {/* ⭐ Sticky bottom CTA - 永远在底部固定，不管内容多长 */}
            {!submitted && (
              <div style={{
                flexShrink: 0,
                padding: '16px 24px',
                paddingBottom: 'max(20px, calc(env(safe-area-inset-bottom, 0px) + 20px))',
                background: 'rgba(44, 24, 16, 0.95)',
                borderTop: `1px solid rgba(${GREEN_RGBA}, 0.15)`,
              }}>
                <button
                  type="button"
                  onClick={() => {
                    // 触发表单提交
                    const form = document.querySelector('[data-booking-form]') as HTMLFormElement
                    form?.requestSubmit()
                  }}
                  disabled={submitting}
                  style={{
                    width: '100%',
                    padding: '14px',
                    background: submitting
                      ? 'rgba(245, 234, 211,0.3)'
                      : `linear-gradient(135deg, ${GREEN}, #6abf78)`,
                    color: submitting ? 'rgba(245, 234, 211,0.5)' : '#0a1410',
                    border: 'none',
                    borderRadius: 12,
                    fontSize: 15, fontWeight: 700,
                    cursor: submitting ? 'wait' : 'pointer',
                    boxShadow: submitting ? 'none' : '0 4px 16px rgba(184, 134, 11, 0.25)',
                  }}
                >
                  {submitting ? '提交中...' : '确认预约'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============ 我的会员 弹窗 ============ */}
      {memberOpen && (
        <div onClick={() => setMemberOpen(false)} style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16,
          paddingTop: 'max(60px, env(safe-area-inset-top, 60px))', // ⭐ 不吸附顶部, 居中弹出
          paddingBottom: 'calc(72px + env(safe-area-inset-bottom, 0px))', // ⭐ 给 TabBar safe space
          // v1.1.42 原来这里是 1000，但服务条款门是 zIndex 99999，
          //   会员弹窗被整个压住 —— 店长点「我的会员」看着像没数据，其实是被盖住了。
          zIndex: 100100,
          overflowY: 'auto',
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: 'linear-gradient(180deg, #0a1410 0%, #2c1810 100%)',
            borderRadius: 20,
            width: '100%', maxWidth: 500,
            maxHeight: 'calc(100dvh - 220px)', // ⭐ modal 高度限制，居中 + 留 TabBar safe space
            display: 'flex',
            flexDirection: 'column',
            borderTop: `1px solid rgba(${GREEN_RGBA}, 0.3)`,
            border: `1px solid rgba(${GREEN_RGBA}, 0.2)`,
            overflow: 'hidden',
            marginTop: 'auto',
            marginBottom: 'auto',
          }}>
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: 24 }}>
            <div style={{
              width: 36, height: 4, background: 'rgba(245, 234, 211,0.2)',
              borderRadius: 2, margin: '0 auto 16px',
            }} />
            <h3 style={{
              fontSize: 18, fontWeight: 700, marginBottom: 16,
              color: '#2c1810', textAlign: 'center',
            }}>
              🎫 我的会员
            </h3>

            {!memberData ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <Field label="请输入手机号查会员卡" required center>
                  <input
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={memberPhone}
                    onChange={(e) => setMemberPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                    onKeyDown={(e) => e.key === 'Enter' && handleMemberLookup()}
                    placeholder="13900000000"
                    maxLength={11}
                    autoFocus
                    style={{
                      ...inputStyle,
                      textAlign: 'center',
                      letterSpacing: '2px',
                      fontSize: 18,
                      fontWeight: 600,
                      minHeight: 52,
                    }}
                  />
                </Field>
                <button
                  onClick={handleMemberLookup}
                  disabled={memberLoading || memberPhone.length !== 11}
                  style={{
                    width: '100%',
                    padding: '14px',
                    background: memberLoading || memberPhone.length !== 11
                      ? `rgba(${GREEN_RGBA}, 0.2)`
                      : `linear-gradient(135deg, ${GREEN}, #6abf78)`,
                    color: '#0a1410',
                    border: 'none',
                    borderRadius: 12,
                    fontSize: 15, fontWeight: 700,
                    cursor: memberLoading || memberPhone.length !== 11 ? 'not-allowed' : 'pointer',
                  }}
                >
                  {memberLoading ? '查询中...' : '查询会员卡'}
                </button>
                <p style={{
                  fontSize: 11, color: 'rgba(44, 24, 16,0.85)',
                  textAlign: 'center', marginTop: 8,
                }}>
                  消费时让店长开卡，充值后余额和消费记录都能在这里看到
                </p>
              </div>
            ) : !memberData.card ? (
              <div style={{ textAlign: 'center', padding: '32px 16px' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🎫</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#2c1810' }}>
                  这个手机号还没有会员卡
                </div>
                <div style={{
                  fontSize: 12, color: 'rgba(44, 24, 16,0.85)', marginTop: 8,
                }}>
                  到店消费时让店长开卡，充一次就能查余额和消费记录
                </div>
                <button
                  onClick={() => { setMemberOpen(false); setBookingOpen(true); }}
                  style={{
                    marginTop: 20,
                    padding: '12px 28px',
                    background: `linear-gradient(135deg, ${GREEN}, #6abf78)`,
                    color: '#0a1410', border: 'none', borderRadius: 12,
                    fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  立即预约
                </button>
              </div>
            ) : (
              <MemberCardReal data={memberData} phone={memberPhone} />
            )}
            </div>{/* 关闭 flex:1 scroll 区 */}
            
            {/* ⭐ Sticky bottom CTA - 永远在底部固定，不管上面多高 */}
            {memberData && memberData.card && (
              <div style={{
                flexShrink: 0,
                padding: '16px 24px',
                paddingBottom: 'max(20px, calc(env(safe-area-inset-bottom, 0px) + 20px))',
                background: 'rgba(44, 24, 16, 0.95)',
                borderTop: `1px solid rgba(${GREEN_RGBA}, 0.15)`,
              }}>
                <button
                  onClick={() => { setMemberOpen(false); setBookingOpen(true); }}
                  style={{
                    width: '100%',
                    padding: '14px',
                    background: `linear-gradient(135deg, ${GREEN}, #6abf78)`,
                    color: '#0a1410', border: 'none', borderRadius: 12,
                    fontSize: 15, fontWeight: 700, cursor: 'pointer',
                    boxShadow: '0 4px 16px rgba(184, 134, 11, 0.25)',
                  }}
                >
                  继续预约
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ⭐ 2026-09-22 15:14 奕霖拍板：底部 4 大功能区（预约/实时排队/取号/协议）已撤掉，BookingSection import 暂保留以备回滚 */}

    </AppLayout>
  )
}


const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  background: 'rgba(245, 234, 211,0.04)',
  border: `1px solid rgba(${GREEN_RGBA}, 0.15)`,
  borderRadius: 10,
  color: '#2c1810',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
}

function Field({ label, required, center, children }: { label: string; required?: boolean; center?: boolean; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', alignItems: center ? 'center' : 'stretch' }}>
      <span style={{ fontSize: 12, color: 'rgba(44, 24, 16,0.9)', fontWeight: 500, textAlign: center ? 'center' : 'left' }}>
        {label} {required && <span style={{ color: GREEN }}>*</span>}
      </span>
      {children}
    </label>
  )
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <div style={{
        fontSize: 16, flexShrink: 0,
        width: 32, height: 32, borderRadius: 8,
        background: `rgba(${GREEN_RGBA}, 0.1)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, color: 'rgba(44, 24, 16,0.45)', marginBottom: 2 }}>{label}</div>
        <div style={{
          fontSize: 13, color: '#2c1810',
          wordBreak: 'break-word', lineHeight: 1.5,
        }}>{value}</div>
      </div>
    </div>
  )
}



// v1.1.42 真实会员卡展示（门店主页「我的会员」弹窗）
function MemberCardReal({ data, phone }: { data: any; phone: string }) {
  const c = data.card || {}
  const logs: any[] = Array.isArray(data.logs) ? data.logs : []
  const LV: Record<string, { label: string }> = {
    normal: { label: '普通卡' },
    silver: { label: '银卡' },
    gold: { label: '金卡' },
    diamond: { label: '钻石卡' },
  }
  const lv = LV[c.level] || LV.normal
  const yuan = (n: number) => '¥' + Number(n || 0).toFixed(2)
  const sub = 'rgba(44, 24, 16,0.85)'
  const ink = '#2c1810'
  const TYPE_LABEL: Record<string, string> = {
    open: '开卡', recharge: '充值', consume: '消费',
    adjust: '调整', frozen: '冻结', unfreeze: '解冻',
  }
  const nx = c.nextLevel
  // v1.1.42 修：接口返回的是 minRechargeCents(分)，不是 minRechargeYuan。
  //   原来读错字段拿到 undefined，need 算成 0，于是永远显示「已达 金卡」。
  const nxYuan = Number(nx?.minRechargeCents || 0) / 100
  const need = Math.max(0, nxYuan - Number(c.rechargeYuan || 0))
  const pct = nxYuan > 0
    ? Math.min(100, (Number(c.rechargeYuan || 0) / nxYuan) * 100)
    : 0
  return (
    <div>
      <div style={{
        background: 'linear-gradient(135deg, rgba(184,134,11,0.2) 0%, rgba(184,134,11,0.05) 100%)',
        border: '1px solid rgba(184,134,11,0.3)',
        borderRadius: 16, padding: 20, marginBottom: 16,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: 'rgba(44,24,16,0.9)', fontWeight: 700 }}>
            {lv.label} · {(Number(c.discount || 1) * 10).toFixed(1)} 折
          </span>
          <span style={{ fontSize: 11, color: sub }}>
            {c.status === 'active' ? '正常' : '已冻结'}
          </span>
        </div>
        <div style={{ fontSize: 11, color: sub, marginBottom: 2 }}>卡内余额</div>
        <div style={{
          fontSize: 32, fontWeight: 800, color: ink,
          fontFamily: 'monospace', letterSpacing: 1, marginBottom: 6,
        }}>{yuan(c.balanceYuan)}</div>
        <div style={{ fontSize: 11, color: sub, marginBottom: 16 }}>
          {(c.phone || phone || '').replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <div>
            <div style={{ fontSize: 11, color: sub }}>累计充值</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: ink }}>{yuan(c.rechargeYuan)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: sub }}>累计消费</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: ink }}>{yuan(c.consumeYuan)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: sub }}>到店次数</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: ink }}>{c.visitCount || 0}</div>
          </div>
        </div>
      </div>

      {nx && (
        <div style={{ background: 'rgba(245,234,211,0.04)', borderRadius: 12, padding: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: sub, marginBottom: 6 }}>
            {need > 0
              ? '距 ' + nx.label + '（累计充值满 ' + yuan(nxYuan) + '）还差 ' + yuan(need)
              : '已达 ' + nx.label}
          </div>
          <div style={{ width: '100%', height: 6, background: 'rgba(245,234,211,0.1)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: pct + '%', height: '100%', background: GREEN }} />
          </div>
        </div>
      )}

      <div style={{ fontSize: 13, fontWeight: 600, color: ink, marginBottom: 8 }}>最近记录</div>
      {logs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 16, color: sub, fontSize: 12 }}>还没有记录</div>
      ) : (
        <div style={{ background: 'rgba(245,234,211,0.04)', borderRadius: 12, overflow: 'hidden' }}>
          {logs.slice(0, 6).map((l: any, i: number) => (
            <div key={l.id || i} style={{
              padding: 12,
              borderBottom: i < Math.min(5, logs.length - 1) ? '1px solid rgba(245,234,211,0.05)' : 'none',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: ink, fontWeight: 600 }}>
                  {TYPE_LABEL[l.type] || l.type}
                </span>
                <span style={{
                  fontSize: 14, fontWeight: 700, fontFamily: 'monospace',
                  color: Number(l.changeYuan) < 0 ? '#dc2626' : GREEN,
                }}>
                  {Number(l.changeYuan) < 0 ? '' : '+'}{yuan(l.changeYuan)}
                </span>
              </div>
              {l.note ? (
                <div style={{ fontSize: 11, color: sub, marginTop: 3 }}>{l.note}</div>
              ) : null}
              <div style={{ fontSize: 10, color: sub, marginTop: 3, opacity: 0.7 }}>
                {String(l.createdAt || '').replace('T', ' ').slice(0, 16)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
