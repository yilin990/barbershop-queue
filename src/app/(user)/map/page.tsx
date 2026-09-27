'use client'

import { useState, useEffect, useCallback } from 'react'

import AppLayout from '@/components/AppLayout'
import MapView from '@/components/MapView'
import WeatherWidget from '@/components/WeatherWidget'
import StoreCard from '@/components/StoreCard'
import { getRealStoreLocation, getUserLocation, calcDistance, formatDistance, estimateWalkingTime, estimateDrivingTime, isStoreOpen, getManualLocation, saveManualLocation } from '@/lib/geo'
import POI_DATA from '@/data/bijiang-poi.json'
import MapLauncher from '@/components/MapLauncher'
import { saveUserLocation } from '@/domain/chat/service'

const STORE_INFO = {
  name: '造型师助手（铜仁市碧江区店）',
  address: '贵州省铜仁市碧江区环北清水大道清水花园一栋1单元10-11号',
  phone: '13721566882',
  hours: '08:00 - 23:30',
}

export default function MapPage() {
  const [userLng, setUserLng] = useState<number | undefined>(undefined)
  const [userLat, setUserLat] = useState<number | undefined>(undefined)
  const [storeLng, setStoreLng] = useState<number>(getRealStoreLocation().lng)
  const [storeLat, setStoreLat] = useState<number>(getRealStoreLocation().lat)
  const initialStoreLoc = getRealStoreLocation()
  const [storeName, setStoreName] = useState<string>(
    initialStoreLoc.name ?? '果蔬鲜生'
  )
  const [isDefaultLocation, setIsDefaultLocation] = useState(false)
  const [distance, setDistance] = useState<string | null>(null)
  const [walkingTime, setWalkingTime] = useState<string | null>(null)
  const [drivingTime, setDrivingTime] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)
  const [showWeather, setShowWeather] = useState(false)
  const [storeOpen, setStoreOpen] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [showGeoErrorFallback, setShowGeoErrorFallback] = useState(false)
  const [manualLngInput, setManualLngInput] = useState('')
  const [manualLatInput, setManualLatInput] = useState('')
  const [poiSearch, setPoiSearch] = useState('')
  const [showPOIDropdown, setShowPOIDown] = useState(false)
  
  // POI 列表 (合并所有类别)
  const allPOIs = Object.entries(POI_DATA).flatMap(([cat, items]) => 
    items.map(p => ({...p, category: cat}))
  )
  const filteredPOIs = poiSearch.trim() === '' ? allPOIs.slice(0, 30) : allPOIs.filter(p => 
    p.name.includes(poiSearch) || p.address.includes(poiSearch) || p.category.includes(poiSearch)
  )

  useEffect(() => {
    setStoreOpen(isStoreOpen())
    // 读 URL ?store= 参数
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const store = params.get('store')
      if (store) {
        const stores = (POI_DATA as any).other_zhilin || []
        const matched = stores.find((s: any) => s.name === store)
        if (matched) {
          setStoreLng(matched.lng)
          setStoreLat(matched.lat)
          setStoreName(matched.name)
        }
      }
    }
  }, [])

  useEffect(() => {
    handleLocate()
  }, [])

  // 检测是否为移动端
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768

  const handleLocate = async () => {
    setLocating(true)
    setGeoError(null)
    setShowGeoErrorFallback(false)
    try {
      const pos = await getUserLocation()
      setUserLng(pos.lng)
      setUserLat(pos.lat)
      setIsDefaultLocation(pos.isDefault)
      if (!pos.isDefault) {
        saveUserLocation(pos.lat, pos.lng)
      }

      const store = getRealStoreLocation()
      const dist = calcDistance(pos, store)
      setDistance(formatDistance(dist))
      setWalkingTime(estimateWalkingTime(dist))
      setDrivingTime(estimateDrivingTime(dist))
    } catch (error: any) {
      console.error('[MapPage] locate error:', error)
      setGeoError(error?.message || '定位失败')
      setShowGeoErrorFallback(true)
    } finally {
      setLocating(false)
    }
  }

  const handlePOISelect = (poi: any) => {
    setManualLngInput(poi.lng.toString())
    setManualLatInput(poi.lat.toString())
    setPoiSearch(poi.name)
    setShowPOIDown(false)
  }

  const handleManualGeoSubmit = useCallback(() => {
    const lng = parseFloat(manualLngInput.trim())
    const lat = parseFloat(manualLatInput.trim())
    if (isNaN(lng) || isNaN(lat)) return
    setUserLng(lng)
    setUserLat(lat)
    setIsDefaultLocation(false)
    saveManualLocation(lng, lat)
    saveUserLocation(lat, lng)
    const store = getRealStoreLocation()
    const dist = calcDistance({ lng, lat }, store)
    setDistance(formatDistance(dist))
    setWalkingTime(estimateWalkingTime(dist))
    setDrivingTime(estimateDrivingTime(dist))
    setShowGeoErrorFallback(false)
    setGeoError(null)
    setManualLngInput('')
    setManualLatInput('')
  }, [manualLngInput, manualLatInput])

  const handleStoreLocationResolved = useCallback((lng: number, lat: number) => {
    setStoreLng(lng)
    setStoreLat(lat)
    // Recalculate distance if we have user position
    if (userLng && userLat) {
      const dist = calcDistance({ lng: userLng, lat: userLat }, { lng, lat })
      setDistance(formatDistance(dist))
      setWalkingTime(estimateWalkingTime(dist))
      setDrivingTime(estimateDrivingTime(dist))
    }
  }, [userLng, userLat])

  // ⭐ 2026-07-30 14:29：导航入口直接换成 MapLauncher（native scheme + 多 app 选择）
  // 不再走 buildAmapNavigationUrl 跳网页版
  const cardBtnStyle: React.CSSProperties = {
    background: 'linear-gradient(135deg, rgba(184, 134, 11,0.2) 0%, rgba(184, 134, 11,0.08) 100%)',
    border: '1px solid rgba(184, 134, 11,0.3)',
    borderRadius: '14px',
    padding: '14px 8px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  }
  const cardBtnStyleGhost: React.CSSProperties = {
    background: 'rgba(184, 134, 11,0.06)',
    border: '1px solid rgba(184, 134, 11,0.15)',
    borderRadius: '14px',
    padding: '14px 8px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  }

  return (
    <AppLayout
      title="附近 · 造型师助手（铜仁市碧江区店）"
      headerRight={
        <button
          onClick={() => setShowWeather(prev => !prev)}
          style={{
            background: showWeather ? 'rgba(184, 134, 11,0.2)' : 'transparent',
            border: '1px solid rgba(184, 134, 11,0.2)',
            borderRadius: '8px',
            padding: '4px 10px',
            color: '#b8860b',
            fontSize: '11px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <span>{showWeather ? '🌤️' : '☁️'}</span>
          <span>{showWeather ? '隐藏天气' : '看天气'}</span>
        </button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingTop: '6px' }}>

        {/* ── A. 顶部信息卡 ── */}
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(184, 134, 11,0.12) 0%, rgba(184, 134, 11,0.04) 100%)',
            border: '1px solid rgba(184, 134, 11,0.2)',
            borderRadius: '16px',
            padding: '14px 16px',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            {/* Left: name + address + status */}
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, rgba(184, 134, 11,0.25) 0%, rgba(184, 134, 11,0.1) 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                    flexShrink: 0,
                  }}
                >
                  🍵
                </div>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>{STORE_INFO.name}</div>
                  {/* 营业状态 */}
                  <div
                    style={{
                      fontSize: '11px',
                      color: storeOpen ? '#b8860b' : 'rgba(255,200,100,0.8)',
                      marginTop: '1px',
                    }}
                  >
                    {storeOpen ? '● 营业中' : '○ 休息中'}
                    <span style={{ color: 'rgba(255,255,255,0.25)', margin: '0 4px' }}>·</span>
                    <span style={{ color: 'rgba(255,255,255,0.35)' }}>{STORE_INFO.hours}</span>
                  </div>
                </div>
              </div>

              {/* Address row */}
              <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '12px', color: 'rgba(184, 134, 11,0.45)', flexShrink: 0, marginTop: '1px' }}>📍</span>
                <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>
                  {STORE_INFO.address}
                </span>
              </div>
            </div>

            {/* Right: re-locate button */}
            <button
              onClick={handleLocate}
              disabled={locating}
              style={{
                background: locating ? 'rgba(184, 134, 11,0.15)' : 'rgba(184, 134, 11,0.1)',
                border: '1px solid rgba(184, 134, 11,0.25)',
                borderRadius: '10px',
                padding: '7px 10px',
                color: '#b8860b',
                fontSize: '11px',
                cursor: locating ? 'wait' : 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '3px',
                transition: 'all 0.2s',
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: '18px' }}>{locating ? '⏳' : '📍'}</span>
              <span style={{ whiteSpace: 'nowrap' }}>{locating ? '定位中' : '重新定位'}</span>
            </button>
          </div>
        </div>

        {/* ── Weather (collapsible) ── */}
        {showWeather && <WeatherWidget city="铜仁" />}

        {/* ── B. 地图区 ── */}
        <MapView
          userLng={userLng}
          userLat={userLat}
          onUserLocationChange={(lng, lat) => {
            setUserLng(lng)
            setUserLat(lat)
            const store = getRealStoreLocation()
            setStoreLng(store.lng)
            setStoreLat(store.lat)
            const dist = calcDistance({ lng, lat }, store)
            setDistance(formatDistance(dist))
            setWalkingTime(estimateWalkingTime(dist))
            setDrivingTime(estimateDrivingTime(dist))
          }}
          onStoreLocationResolved={handleStoreLocationResolved}
          height="300px"
          showControls={true}
        />

        {/* ── C. 距离+时间大字显示 ── */}
        {distance && (
          <div
            style={{
              background: 'rgba(13,31,23,0.7)',
              border: '1px solid rgba(184, 134, 11,0.15)',
              borderRadius: '14px',
              padding: '14px 16px',
              display: 'flex',
              justifyContent: 'space-around',
              alignItems: 'center',
              backdropFilter: 'blur(10px)',
            }}
          >
            {/* 距离 */}
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div
                style={{
                  fontSize: distance && distance.includes('米') ? '28px' : '26px',
                  fontWeight: 800,
                  color: '#b8860b',
                  lineHeight: 1,
                  marginBottom: '3px',
                }}
              >
                📍 {distance}
              </div>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>距门店距离</div>
            </div>

            <div style={{ width: '1px', height: '36px', background: 'rgba(184, 134, 11,0.1)' }} />

            {/* 步行时间 */}
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontSize: '18px', fontWeight: 700, color: 'rgba(184, 134, 11,0.85)', lineHeight: 1, marginBottom: '3px' }}>
                🚶 {walkingTime}
              </div>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>步行时间</div>
            </div>

            <div style={{ width: '1px', height: '36px', background: 'rgba(184, 134, 11,0.1)' }} />

            {/* 驾车时间 */}
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontSize: '18px', fontWeight: 700, color: 'rgba(184, 134, 11,0.85)', lineHeight: 1, marginBottom: '3px' }}>
                🚗 {drivingTime}
              </div>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>驾车时间</div>
            </div>
          </div>
        )}

        {/* ── C2. 三个操作按钮 ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
          {/* 导航（驾车） ⭐ 2026-07-30 14:29：换 MapLauncher，弹窗选 native app */}
          <MapLauncher
            lat={storeLat}
            lng={storeLng}
            name={STORE_INFO.name}
            address={STORE_INFO.address}
            mode="drive"
            triggerStyle={cardBtnStyle}
            triggerContent={
              <>
                <span style={{ fontSize: '26px' }}>🗺️</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#b8860b' }}>导航</span>
                <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>驾车路线</span>
              </>
            }
          />

          {/* 拨打 */}
          <a
            href={`tel:${STORE_INFO.phone}`}
            style={{
              background: 'rgba(184, 134, 11,0.08)',
              border: '1px solid rgba(184, 134, 11,0.18)',
              borderRadius: '14px',
              padding: '14px 8px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '6px',
              textDecoration: 'none',
              transition: 'all 0.2s',
            }}
          >
            <span style={{ fontSize: '26px' }}>📞</span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#b8860b' }}>拨打</span>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>{STORE_INFO.phone}</span>
          </a>

          {/* 路线（步行） ⭐ 2026-07-30 14:29：换 MapLauncher，弹窗选 native app */}
          <MapLauncher
            lat={storeLat}
            lng={storeLng}
            name={STORE_INFO.name}
            address={STORE_INFO.address}
            mode="walk"
            triggerStyle={cardBtnStyleGhost}
            triggerContent={
              <>
                <span style={{ fontSize: '26px' }}>🚶</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'rgba(184, 134, 11,0.85)' }}>路线</span>
                <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>步行导航</span>
              </>
            }
          />
        </div>

        {/* ── D. 底部店铺卡 ── */}
        <StoreCard
          distance={distance || undefined}
          userLng={userLng}
          userLat={userLat}
        />

        {/* Geolocation error fallback */}
        {showGeoErrorFallback && (
          <div
            style={{
              padding: '12px 16px',
              background: 'rgba(255,107,107,0.08)',
              border: '1px solid rgba(255,107,107,0.2)',
              borderRadius: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '20px' }}>📡</span>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#ff8a8a' }}>定位失败</div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>
                  {geoError}
                </div>
              </div>
            </div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>
              可能原因：GPS信号弱 / 权限被拒绝 / 高德Key未配置域名白名单<br/>
              <span style={{ color: 'rgba(184, 134, 11,0.5)' }}>请参考 docs/amap-key-config.md 配置高德Key</span>
            </div>

            {/* POI 选择器 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ fontSize: '11px', color: 'rgba(184, 134, 11,0.6)', fontWeight: 600 }}>
                🏪 选附近地点/商家（推荐）
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="搜索地点名: 碧江附小、锦江广场..."
                  value={poiSearch}
                  onChange={e => { setPoiSearch(e.target.value); setShowPOIDown(true) }}
                  onFocus={() => setShowPOIDown(true)}
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(184, 134, 11,0.3)',
                    borderRadius: '8px',
                    padding: '8px 10px',
                    color: '#fff',
                    fontSize: '12px',
                    outline: 'none',
                  }}
                />
                {showPOIDropdown && filteredPOIs.length > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: '4px',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    background: 'rgba(20, 30, 24, 0.98)',
                    border: '1px solid rgba(184, 134, 11,0.3)',
                    borderRadius: '8px',
                    zIndex: 100,
                    backdropFilter: 'blur(20px)',
                  }}>
                    {filteredPOIs.slice(0, 20).map(poi => (
                      <div
                        key={poi.id}
                        onClick={() => handlePOISelect(poi)}
                        style={{
                          padding: '8px 10px',
                          cursor: 'pointer',
                          borderBottom: '1px solid rgba(184, 134, 11,0.1)',
                          fontSize: '12px',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(184, 134, 11,0.1)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <div style={{ color: '#b8860b', fontWeight: 600 }}>{poi.name}</div>
                        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px' }}>
                          {poi.category} · {poi.address}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 或手动输入经纬度 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
                或直接输入经纬度：
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  type="text"
                  placeholder="经度"
                  value={manualLngInput}
                  onChange={e => setManualLngInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleManualGeoSubmit()}
                  style={{
                    flex: 1,
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(184, 134, 11,0.2)',
                    borderRadius: '8px',
                    padding: '7px 10px',
                    color: '#fff',
                    fontSize: '12px',
                    outline: 'none',
                  }}
                />
                <input
                  type="text"
                  placeholder="纬度"
                  value={manualLatInput}
                  onChange={e => setManualLatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleManualGeoSubmit()}
                  style={{
                    flex: 1,
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(184, 134, 11,0.2)',
                    borderRadius: '8px',
                    padding: '7px 10px',
                    color: '#fff',
                    fontSize: '12px',
                    outline: 'none',
                  }}
                />
                <button
                  onClick={handleManualGeoSubmit}
                  disabled={!manualLngInput || !manualLatInput}
                  style={{
                    background: 'rgba(184, 134, 11,0.2)',
                    border: '1px solid rgba(184, 134, 11,0.4)',
                    borderRadius: '8px',
                    padding: '7px 14px',
                    color: '#b8860b',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  确定
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Default location notice */}
        {isDefaultLocation && (
          <div
            style={{
              padding: '10px 14px',
              background: 'rgba(184, 134, 11,0.06)',
              border: '1px solid rgba(184, 134, 11,0.1)',
              borderRadius: '10px',
              fontSize: '11px',
              color: 'rgba(184, 134, 11,0.45)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>ℹ️</span>
            <span>使用默认位置（铜仁市区）。点击右上角📍按钮可获取真实位置。</span>
          </div>
        )}
      </div>
    </AppLayout>
  )
}