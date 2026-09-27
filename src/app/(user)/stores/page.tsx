'use client'

import { toast } from '@/lib/ui-bus'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/AppLayout'
import POI_DATA from '@/data/bijiang-poi.json'
import MapLauncher from '@/components/MapLauncher'

// 果蔬相关门店（来自 POI 数据）
const ZHILIN_STORES = (POI_DATA as any).other_zhilin
  .filter((p: any) => p.name.includes('芝林'))
  .map((p: any, i: number) => ({
    ...p,
    status: i === 0 ? 'active' : 'pending',
    expectedLaunch: i === 1 ? '2026 Q3' : '2026 Q4',
  }))

// 附近的非芝林店（药房 + 健康店）
const OTHER_STORES = (POI_DATA as any).other_zhilin.filter((p: any) => !p.name.includes('芝林'))

function calcDistance(lng1: number, lat1: number, lng2: number, lat2: number) {
  const R = 6371000
  const toRad = (x: number) => (x * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatDist(m: number | null) {
  if (m === null) return '—'
  if (m < 1000) return Math.round(m) + 'm'
  return (m / 1000).toFixed(1) + 'km'
}

function walkingMin(m: number | null) {
  if (m === null) return '—'
  return Math.ceil(m / 80) + ' 分钟'
}

export default function StoresPage() {
  const router = useRouter()
  const [userLocation, setUserLocation] = useState<{ lng: number; lat: number } | null>(null)
  const [activeTab, setActiveTab] = useState<'zhilin' | 'nearby'>('zhilin')
  const [touchStart, setTouchStart] = useState(0)
  const [touchDelta, setTouchDelta] = useState(0)
  // 索引（不是 derived currentList，prev/next 才有效）
  const [zhilinIdx, setZhilinIdx] = useState(0)
  const [nearbyIdx, setNearbyIdx] = useState(0)

  useEffect(() => {
    const saved = localStorage.getItem('zhilin_user_location')
    if (saved) {
      try {
        setUserLocation(JSON.parse(saved))
      } catch {}
    }
  }, [])

  const allStores = [...ZHILIN_STORES, ...OTHER_STORES]
  const storesWithDistance = allStores
    .map((store: any) => ({
      ...store,
      distance: userLocation ? calcDistance(userLocation.lng, userLocation.lat, store.lng, store.lat) : null,
    }))
    .sort((a, b) => {
      if (a.distance === null) return -1
      if (b.distance === null) return 1
      return a.distance - b.distance
    })

  const zhilinList = storesWithDistance.filter((s) => s.name.includes('芝林'))
  const nearbyList = storesWithDistance.filter((s) => !s.name.includes('芝林'))
  const currentList = activeTab === 'zhilin' ? zhilinList : nearbyList
  // ⭐ 2026-07-30 14:52：导航按钮恢复用 MapLauncher 弹窗（奕霖原意：改进 /map 弹窗本身，不要新页面）
  // 色调外观改进 → MapLauncher v5.0
  // 不再需要 handleNavigate 函数（保留为兑底逻辑以防页面其他地方还在调用）

  return (
    <AppLayout title="附近门店" showHeader>
      <div style={{ padding: '16px', paddingBottom: '100px' }}>
        {/* 顶部位置提示 */}
        <div style={{
          padding: '14px 16px', borderRadius: '14px', marginBottom: '16px',
          background: 'linear-gradient(135deg, rgba(184, 134, 11, 0.12) 0%, rgba(44, 24, 16, 0.25) 100%)',
          border: '1px solid rgba(184, 134, 11, 0.25)',
          display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '12px',
            background: 'rgba(184, 134, 11, 0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '18px', flexShrink: 0,
          }}>📍</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13px', color: '#b8860b', fontWeight: 600, marginBottom: '2px' }}>
              {userLocation ? '已定位到当前位置' : '未开启定位'}
            </div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>
              {userLocation
                ? `${userLocation.lng.toFixed(3)}, ${userLocation.lat.toFixed(3)}`
                : '在地图页面开启定位后查看真实距离'}
            </div>
          </div>
        </div>

        {/* 标签页：芝林 / 附近 */}
        <div style={{
          display: 'flex', gap: '4px', padding: '4px',
          borderRadius: '14px',
          // ⭐ 奕霖 2026-07-24 02:49：白玻璃 vs body 墨绿 → 绿玻璃，跟主色家族一致（高质量）
          background: 'linear-gradient(135deg, rgba(184, 134, 11, 0.12) 0%, rgba(184, 134, 11, 0.06) 100%)',
          border: '1px solid rgba(184, 134, 11, 0.18)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          boxShadow: 'inset 0 1px 0 rgba(184, 134, 11, 0.1)',
          marginBottom: '16px',
        }}>
          {[
            { key: 'zhilin' as const, label: `🏪 芝林 (${zhilinList.length})` },
            { key: 'nearby' as const, label: `📍 附近 (${nearbyList.length})` },
          ].map((t) => (
            <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
              flex: 1, padding: '10px',
              borderRadius: '10px', border: 'none', cursor: 'pointer',
              background: activeTab === t.key
                ? 'linear-gradient(135deg, rgba(184, 134, 11, 0.28) 0%, rgba(184, 134, 11, 0.18) 100%)'
                : 'transparent',
              color: activeTab === t.key ? '#a8e6b8' : 'rgba(168, 230, 184, 0.55)',
              fontSize: '13px', fontWeight: 600,
              transition: 'all 0.2s ease',
            }}>{t.label}</button>
          ))}
        </div>

        {/* === 可切换大卡片 === */}
        {currentList.length > 0 && (() => {
          // 修正：prev/next 改 index，焦点 = currentList[index]
          const focusIdx = activeTab === 'zhilin' ? zhilinIdx : nearbyIdx
          const focus = currentList[focusIdx] || currentList[0]
          const prev = () => {
            if (activeTab === 'zhilin') {
              setZhilinIdx((zhilinIdx - 1 + zhilinList.length) % zhilinList.length)
            } else {
              setNearbyIdx((nearbyIdx - 1 + nearbyList.length) % nearbyList.length)
            }
          }
          const next = () => {
            if (activeTab === 'zhilin') {
              setZhilinIdx((zhilinIdx + 1) % zhilinList.length)
            } else {
              setNearbyIdx((nearbyIdx + 1) % nearbyList.length)
            }
          }
          // 手滑事件
          const onTouchStart = (e: React.TouchEvent) => {
            setTouchStart(e.touches[0].clientX)
            setTouchDelta(0)
          }
          const onTouchMove = (e: React.TouchEvent) => {
            setTouchDelta(e.touches[0].clientX - touchStart)
          }
          const onTouchEnd = () => {
            const delta = touchDelta
            setTouchDelta(0)
            if (Math.abs(delta) > 50) {
              if (delta < 0) next()  // 左滑 = 下一家
              else prev()            // 右滑 = 上一家
            }
          }
          // 键盘监听：电脑端左右箭头
          useEffect(() => {
            const onKey = (e: KeyboardEvent) => {
              if (e.key === 'ArrowLeft') prev()
              else if (e.key === 'ArrowRight') next()
            }
            window.addEventListener('keydown', onKey)
            return () => window.removeEventListener('keydown', onKey)
            // eslint-disable-next-line react-hooks/exhaustive-deps
          }, [activeTab, zhilinIdx, nearbyIdx])
          const isZhilinFocus = focus.name.includes('芝林')
          const isActive = isZhilinFocus && focus.status === 'active'
          return (
            <div style={{ marginBottom: '16px' }}>
              {/* 大卡片（使用 min-height 保证高度） */}
              <div
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                style={{
                position: 'relative',
                minHeight: '180px',
                borderRadius: '24px',
                background: isZhilinFocus
                  ? 'linear-gradient(135deg, rgba(184, 134, 11, 0.25) 0%, rgba(44, 24, 16, 0.45) 100%)'
                  : 'linear-gradient(135deg, rgba(184, 134, 11, 0.15) 0%, rgba(184, 134, 11, 0.25) 100%)',
                border: isZhilinFocus
                  ? '1px solid rgba(184, 134, 11, 0.4)'
                  : '1px solid rgba(184, 134, 11, 0.3)',
                overflow: 'hidden',
                boxShadow: '0 12px 32px rgba(0, 0, 0, 0.3)',
                transform: touchDelta !== 0 ? `translateX(${touchDelta * 0.3}px)` : 'translateX(0)',
                transition: touchDelta === 0 ? 'transform 0.3s ease' : 'none',
                touchAction: 'pan-y',
                cursor: 'grab',
              }}>
                {/* 装饰光晕 */}
                <div style={{
                  position: 'absolute', top: '-40px', right: '-40px',
                  width: '160px', height: '160px', borderRadius: '50%',
                  background: isZhilinFocus
                    ? 'radial-gradient(circle, rgba(184, 134, 11, 0.3) 0%, transparent 70%)'
                    : 'radial-gradient(circle, rgba(184, 134, 11, 0.3) 0%, transparent 70%)',
                }} />

                {/* 左箭头 */}
                <button
                  onClick={prev}
                  style={{
                    position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
                    width: '36px', height: '36px', borderRadius: '50%',
                    background: 'rgba(0, 0, 0, 0.35)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#ffffff', fontSize: '22px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 5, padding: 0, lineHeight: 1,
                  }}>‹</button>

                {/* 右箭头 */}
                <button
                  onClick={next}
                  style={{
                    position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                    width: '36px', height: '36px', borderRadius: '50%',
                    background: 'rgba(0, 0, 0, 0.35)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#ffffff', fontSize: '22px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 5, padding: 0, lineHeight: 1,
                  }}>›</button>

                {/* 卡片内容 */}
                <div style={{ position: 'relative', padding: '20px 50px', textAlign: 'center', zIndex: 1 }}>
                  {/* 顶部状态 */}
                  <div style={{ marginBottom: '10px', display: 'flex', justifyContent: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    {isZhilinFocus && (
                      <span style={{
                        fontSize: '10px', padding: '3px 10px', borderRadius: '10px',
                        background: isActive ? 'rgba(184, 134, 11, 0.25)' : 'rgba(255, 154, 107, 0.2)',
                        color: isActive ? '#b8860b' : '#ff9a6b',
                        fontWeight: 600,
                      }}>
                        {isActive ? '✓ 营业中' : '⏳ 筹备中'}
                      </span>
                    )}
                    {userLocation && focus.distance !== null && (
                      <span style={{
                        fontSize: '10px', padding: '3px 10px', borderRadius: '10px',
                        background: 'rgba(0, 0, 0, 0.3)',
                        color: 'rgba(255, 255, 255, 0.85)',
                        fontWeight: 600,
                      }}>
                        {formatDist(focus.distance)} · 🚶 {walkingMin(focus.distance)}
                      </span>
                    )}
                  </div>

                  {/* 店名 */}
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#ffffff', marginBottom: '8px', lineHeight: 1.3 }}>
                    {focus.name}
                  </div>

                  {/* 地址 */}
                  {focus.address && (
                    <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                      <span>📍</span><span style={{ maxWidth: '85%' }}>{focus.address}</span>
                    </div>
                  )}

                  {/* 3 按钮 */}
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    {/* ⭐ 2026-07-30 14:52：恢复用 MapLauncher（奕霖原意是改进 /map 弹窗本身，不要新页面） */}
                    <MapLauncher
                      lat={focus.lat}
                      lng={focus.lng}
                      name={focus.name}
                      address={focus.address}
                      label="导航"
                      mode="drive"
                      variant="primary"
                    />
                    <button
                      onClick={() => toast.info('电话：13800138000')}
                      style={{
                        padding: '7px 16px', borderRadius: '14px', border: 'none',
                        background: 'rgba(255, 255, 255, 0.12)',
                        backdropFilter: 'blur(10px)',
                        color: '#ffffff', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '4px',
                      }}>
                      <span>📞</span>电话
                    </button>
                    <button
                      onClick={() => router.push('/map')}
                      style={{
                        padding: '7px 16px', borderRadius: '14px', border: 'none',
                        background: 'rgba(255, 154, 107, 0.2)',
                        color: '#ff9a6b', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '4px',
                      }}>
                      <span>🗺️</span>地图
                    </button>
                  </div>
                </div>

                {/* 指示器 */}
                <div style={{ position: 'absolute', bottom: '12px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '6px' }}>
                  {currentList.map((_, i) => (
                    <div
                      key={i}
                      style={{
                        height: '4px', borderRadius: '2px',
                        width: i === focusIdx ? '24px' : '4px',
                        background: i === focusIdx ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.35)',
                        transition: 'all 0.3s ease',
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* 切换提示 */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px', padding: '0 4px' }}>
                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>← 上一家</span>
                <span style={{ fontSize: '11px', color: 'rgba(184, 134, 11, 0.7)', fontWeight: 600 }}>
                  {focus.name}  ·  {focusIdx + 1} / {currentList.length}
                </span>
                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>下一家 →</span>
              </div>
            </div>
          )
        })()}

        {/* 列表 */}
        {currentList.length === 0 ? (
          <div style={{
            padding: '40px 20px', textAlign: 'center',
            borderRadius: '16px', background: 'rgba(255, 255, 255, 0.03)',
            border: '1px dashed rgba(184, 134, 11, 0.2)',
          }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>🏪</div>
            <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)' }}>暂无门店</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {currentList.map((store, i) => {
              const isZhilin = store.name.includes('芝林')
              const isActive = store.status === 'active'
              const accent = isZhilin ? '#b8860b' : '#9ca3af'
              return (
                <div key={i} style={{
                  padding: '16px', borderRadius: '16px',
                  background: isZhilin
                    ? 'linear-gradient(135deg, rgba(184, 134, 11, 0.1) 0%, rgba(44, 24, 16, 0.25) 100%)'
                    : 'rgba(255, 255, 255, 0.04)',
                  border: isZhilin
                    ? '1px solid rgba(184, 134, 11, 0.3)'
                    : '1px solid rgba(255, 255, 255, 0.08)',
                }}>
                  {/* 头部：店名 + 距离 */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff' }}>
                          {store.name}
                        </span>
                        {isZhilin && (
                          <span style={{
                            fontSize: '10px', padding: '2px 8px', borderRadius: '10px',
                            background: isActive ? 'rgba(184, 134, 11, 0.2)' : 'rgba(255, 154, 107, 0.15)',
                            color: isActive ? '#b8860b' : '#ff9a6b',
                            fontWeight: 600,
                          }}>
                            {isActive ? '营业中' : '筹备中'}
                          </span>
                        )}
                      </div>
                      {store.address && (
                        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
                          📍 {store.address}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '12px' }}>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: accent }}>
                        {formatDist(store.distance)}
                      </div>
                      <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>
                        🚶 {walkingMin(store.distance)}
                      </div>
                    </div>
                  </div>

                  {/* 状态/营业时间 */}
                  {isZhilin && !isActive && store.expectedLaunch && (
                    <div style={{
                      fontSize: '11px', color: '#ff9a6b',
                      background: 'rgba(255, 154, 107, 0.1)',
                      padding: '6px 10px', borderRadius: '8px',
                      marginBottom: '10px',
                    }}>
                      📅 预计 {store.expectedLaunch} 开业
                    </div>
                  )}

                  {/* 3 按钮：导航 / 打电话 / 路线 */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                    {/* ⭐ 2026-07-30 14:52：恢复用 MapLauncher（奕霖原意是改进 /map 弹窗本身，不要新页面） */}
                    <MapLauncher
                      lat={store.lat}
                      lng={store.lng}
                      name={store.name}
                      address={store.address}
                      label="导航"
                      mode="drive"
                      variant="ghost"
                    />
                    <button
                      onClick={() => toast.info('电话功能待接入')}
                      style={{
                        padding: '10px 6px', borderRadius: '12px',
                        background: 'rgba(184, 134, 11, 0.1)',
                        border: '1px solid rgba(184, 134, 11, 0.25)',
                        color: '#f472b6', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                      }}>
                      <span style={{ fontSize: '16px' }}>📞</span>
                      <span>电话</span>
                    </button>
                    <button
                      onClick={() => router.push('/map')}
                      style={{
                        padding: '10px 6px', borderRadius: '12px',
                        background: 'rgba(255, 154, 107, 0.1)',
                        border: '1px solid rgba(255, 154, 107, 0.25)',
                        color: '#ff9a6b', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                      }}>
                      <span style={{ fontSize: '16px' }}>🗺️</span>
                      <span>地图</span>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* 底部提示 */}
        <div style={{
          marginTop: '20px', padding: '12px 16px',
          borderRadius: '12px',
          background: 'rgba(184, 134, 11, 0.05)',
          border: '1px dashed rgba(184, 134, 11, 0.2)',
          fontSize: '11px', color: 'rgba(255,255,255,0.5)',
          lineHeight: 1.6,
        }}>
          💡 主店：<span style={{ color: '#b8860b' }}>造型师助手（铜仁市碧江区店）</span><br />
          营业时间：08:00 - 22:00<br />
          联系电话：+86 18 30 85 67 187
        </div>
      </div>
    </AppLayout>
  )
}
