'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { getRealStoreLocation, saveRealStoreLocation, getUserLocation, calcDistance, formatDistance, getManualLocation, saveManualLocation } from '@/lib/geo'
import { getAmapJSUrl } from '@/lib/amap'

const STORE_NAME = '果蔬鲜生（附小店）'
// 新地址（高德地图上查的）：干群路与清水大道交叉口东北50米
const STORE_ADDRESS = '贵州省铜仁市碧江区干群路与清水大道交汇处东北50米'
const STORE_HOURS = '08:00 - 23:30'

// Unicode-safe base64 编码（btoa 不能处理 emoji 等非 ASCII 字符）
function b64(str: string): string {
  return btoa(unescape(encodeURIComponent(str)))
}

interface MapViewProps {
  userLng?: number
  userLat?: number
  onUserLocationChange?: (lng: number, lat: number) => void
  onStoreLocationResolved?: (lng: number, lat: number) => void
  height?: string
  showControls?: boolean
}

export default function MapView({
  userLng,
  userLat,
  onUserLocationChange,
  onStoreLocationResolved,
  height = '300px',
  showControls = true,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markersRef = useRef<{ user?: any; store?: any }>({})
  const [mapLoaded, setMapLoaded] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)
  const [userPos, setUserPos] = useState<{ lng: number; lat: number } | null>(
    userLng && userLat ? { lng: userLng, lat: userLat } : null
  )
  const [distance, setDistance] = useState<string | null>(null)
  const [storePos, setStorePos] = useState(() => getRealStoreLocation())
  const [geocoding, setGeocoding] = useState(false)
  const [hasUserLocation, setHasUserLocation] = useState(!!(userLng && userLat))
  const [showManualInput, setShowManualInput] = useState(false)
  const [manualLngInput, setManualLngInput] = useState('')
  const [manualLatInput, setManualLatInput] = useState('')
  const [manualInputError, setManualInputError] = useState('')

  // 抽出来的标记创建函数
  const updateStoreMarker = (map: any, lng: number, lat: number, name: string) => {
    if (markersRef.current.store) {
      map.remove(markersRef.current.store)
    }

    const icon = new window.AMap.Icon({
      size: new window.AMap.Size(48, 48),
      image: 'data:image/svg+xml;base64,' + b64(`
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
          <circle cx="24" cy="24" r="24" fill="#1a3a2a" stroke="#b8860b" stroke-width="2"/>
          <text x="24" y="30" text-anchor="middle" font-size="22" fill="#b8860b">🍵</text>
        </svg>
      `),
      imageSize: new window.AMap.Size(48, 48),
    })

    const storeMarker = new window.AMap.Marker({
      position: new window.AMap.LngLat(lng, lat),
      title: name,
      icon,
      extData: { type: 'store' },
      label: {
        content: `<div style="background:rgba(13,31,23,0.95);color:#b8860b;font-size:12px;font-weight:600;padding:3px 8px;border-radius:8px;border:1px solid rgba(184, 134, 11,0.4);white-space:nowrap;">🍵 ${name}</div>`,
        direction: 'top',
        offset: new window.AMap.Pixel(-30, -50),
      },
    })

    const infoWindow = new window.AMap.InfoWindow({
      content: `
        <div style="background:#0d1f17;color:#fff;padding:12px 16px;border-radius:12px;font-size:12px;min-width:200px;border:1px solid rgba(184, 134, 11,0.3);">
          <div style="font-weight:700;font-size:14px;margin-bottom:6px;color:#b8860b;">🍵 ${name}</div>
          <div style="color:rgba(255,255,255,0.6);font-size:11px;margin-bottom:4px;">📍 ${STORE_ADDRESS}</div>
          <div style="color:rgba(184, 134, 11,0.8);font-size:11px;">🕐 ${STORE_HOURS}</div>
        </div>
      `,
      offset: new window.AMap.Pixel(0, -36),
    })

    storeMarker.on('click', () => infoWindow.open(map, storeMarker.getPosition()))
    map.add(storeMarker)
    markersRef.current.store = storeMarker
    infoWindow.open(map, new window.AMap.LngLat(lng, lat))
  }

  // PlaceSearch 搜店名（POI精准坐标）
  const tryPlaceSearch = (map: any) => {
    const placeSearch = new window.AMap.PlaceSearch({
      city: '铜仁',
      citylimit: true,
      pageSize: 1,
    })
    placeSearch.search(STORE_NAME, (status: string, result: any) => {
      if (status === 'complete' && result.poiList && result.poiList.pois && result.poiList.pois.length > 0) {
        const poi = result.poiList.pois[0]
        const realLng = poi.location.lng
        const realLat = poi.location.lat
        console.log('[MapView] ✅ PlaceSearch hit:', poi.name, realLng, realLat)
        saveRealStoreLocation(realLng, realLat)
        setStorePos({ lng: realLng, lat: realLat })
        if (onStoreLocationResolved) onStoreLocationResolved(realLng, realLat)
        updateStoreMarker(map, realLng, realLat, poi.name || STORE_NAME)
        map.setCenter([realLng, realLat])
        setGeocoding(false)
      } else {
        console.warn('[MapView] ⚠️ PlaceSearch miss, fallback Geocoder')
        runGeocode(map)
      }
    })
  }

  // Geocoder fallback（搜地址，拿到的是小区中心点，不准）
  const runGeocode = (map: any) => {
    const geocoder = new window.AMap.Geocoder({ city: '铜仁市' })
    geocoder.getLocation(STORE_ADDRESS, (status: string, result: any) => {
      setGeocoding(false)
      if (status === 'complete' && result.geocodes && result.geocodes.length > 0) {
        const loc = result.geocodes[0].location
        const realLng = loc.lng
        const realLat = loc.lat
        console.log('[MapView] Geocoder hit:', realLng, realLat)
        saveRealStoreLocation(realLng, realLat)
        setStorePos({ lng: realLng, lat: realLat })
        if (onStoreLocationResolved) onStoreLocationResolved(realLng, realLat)
        updateStoreMarker(map, realLng, realLat, STORE_NAME)
        map.setCenter([realLng, realLat])
      } else {
        console.warn('[MapView] Geocoder failed:', status, result)
      }
    })
  }

  // 异步拿真实坐标
  const resolveStoreLocation = useCallback((map: any) => {
    setGeocoding(true)
    if (!window.AMap) {
      setGeocoding(false)
      return
    }
    // 动态加载 PlaceSearch + Geocoder 插件
    window.AMap.plugin(['AMap.PlaceSearch', 'AMap.Geocoder'], () => {
      tryPlaceSearch(map)
    })
  }, [onStoreLocationResolved])

  // 初始化地图
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const loadAMap = () => {
      if (typeof window.AMap === 'undefined') {
        setMapError('地图加载失败，请检查网络')
        return
      }

      try {
        const sp = getRealStoreLocation()
        const map = new window.AMap.Map(containerRef.current!, {
          zoom: 15,
          center: [sp.lng, sp.lat],
          viewMode: '2D',
          mapStyle: 'amap://styles/darkblue',
        })

        mapRef.current = map

        // 1) 先用缓存坐标画标记
        updateStoreMarker(map, sp.lng, sp.lat, STORE_NAME)

        // 2) 异步拿真实坐标（PlaceSearch 优先）
        resolveStoreLocation(map)

        setMapLoaded(true)
      } catch (err) {
        console.error('[MapView] init error:', err)
        setMapError('地图初始化失败')
      }
    }

    if (typeof window.AMap !== 'undefined') {
      loadAMap()
    } else {
      const script = document.createElement('script')
      script.src = getAmapJSUrl()
      script.async = true
      script.onload = loadAMap
      script.onerror = () => setMapError('地图脚本加载失败')
      document.head.appendChild(script)
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.destroy()
        mapRef.current = null
      }
    }
  }, [resolveStoreLocation])

  // 更新用户位置 marker
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !userPos) return

    if (markersRef.current.user) {
      mapRef.current.remove(markersRef.current.user)
    }

    const userIcon = new window.AMap.Icon({
      size: new window.AMap.Size(32, 32),
      image: 'data:image/svg+xml;base64,' + b64(`
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
          <circle cx="16" cy="16" r="14" fill="rgba(69,135,255,0.25)" stroke="rgba(69,135,255,0.8)" stroke-width="2"/>
          <circle cx="16" cy="16" r="6" fill="#4587FF"/>
          <circle cx="16" cy="16" r="3" fill="#fff"/>
        </svg>
      `),
      imageSize: new window.AMap.Size(32, 32),
    })

    const userMarker = new window.AMap.Marker({
      position: new window.AMap.LngLat(userPos.lng, userPos.lat),
      title: '我的位置',
      icon: userIcon,
      extData: { type: 'user' },
      draggable: true, // 可拖动校准
    })

    // 拖动结束后自动更新位置并保存
    userMarker.on('dragend', (e: any) => {
      const newLng = e.lnglat.lng
      const newLat = e.lnglat.lat
      console.log('[MapView] manual dragend:', newLng, newLat)
      setUserPos({ lng: newLng, lat: newLat })
      saveManualLocation(newLng, newLat)
      if (onUserLocationChange) onUserLocationChange(newLng, newLat)
    })

    mapRef.current.add(userMarker)
    markersRef.current.user = userMarker

    const dist = calcDistance(userPos, storePos)
    setDistance(formatDistance(dist))

    // 缩放到能同时看到两个标记
    const minLng = Math.min(userPos.lng, storePos.lng)
    const maxLng = Math.max(userPos.lng, storePos.lng)
    const minLat = Math.min(userPos.lat, storePos.lat)
    const maxLat = Math.max(userPos.lat, storePos.lat)
    const paddingFactor = dist < 0.5 ? 2.5 : dist < 2 ? 1.8 : 1.2

    try {
      mapRef.current.setBounds(
        new window.AMap.Bounds(
          new window.AMap.LngLat(minLng - paddingFactor * 0.005, minLat - paddingFactor * 0.005),
          new window.AMap.LngLat(maxLng + paddingFactor * 0.005, maxLat + paddingFactor * 0.005)
        ),
        false,
        [60, 60, 60, 60]
      )
    } catch (e) {
      // ignore
    }
  }, [userPos, mapLoaded, storePos])

  const handleLocate = useCallback(async () => {
    if (locating) return
    setLocating(true)
    setShowManualInput(false)
    setManualInputError('')

    try {
      const pos = await getUserLocation()
      setUserPos({ lng: pos.lng, lat: pos.lat })
      setHasUserLocation(true)
      if (onUserLocationChange) {
        onUserLocationChange(pos.lng, pos.lat)
      }
    } catch (error: any) {
      console.error('[MapView] locate error:', error)
      // 定位失败时弹出手动输入
      setManualInputError(error?.message || '定位失败')
      setShowManualInput(true)
    } finally {
      setLocating(false)
    }
  }, [locating, onUserLocationChange])

  const handleManualInputConfirm = useCallback(() => {
    const lng = parseFloat(manualLngInput.trim())
    const lat = parseFloat(manualLatInput.trim())
    if (isNaN(lng) || isNaN(lat)) {
      setManualInputError('请输入有效的经纬度数字')
      return
    }
    if (lng < 73 || lng > 135 || lat < 15 || lat > 60) {
      setManualInputError('经纬度超出中国范围，请检查')
      return
    }
    setManualInputError('')
    setShowManualInput(false)
    setUserPos({ lng, lat })
    setHasUserLocation(true)
    saveManualLocation(lng, lat)
    if (onUserLocationChange) onUserLocationChange(lng, lat)
    setManualLngInput('')
    setManualLatInput('')
  }, [manualLngInput, manualLatInput, onUserLocationChange])

  const handleClearManual = useCallback(() => {
    setShowManualInput(false)
    setManualLngInput('')
    setManualLatInput('')
    setManualInputError('')
    // 清除后重新触发一次定位
    handleLocate()
  }, [handleLocate])

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div
        ref={containerRef}
        id="map-container"
        style={{
          width: '100%',
          height,
          borderRadius: '16px',
          overflow: 'hidden',
          border: '1px solid rgba(184, 134, 11,0.15)',
          background: 'rgba(13,31,23,0.5)',
        }}
      />

      {mapError && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(13,31,23,0.92)',
            color: 'rgba(184, 134, 11,0.6)',
            fontSize: '13px',
            gap: '8px',
            borderRadius: '16px',
          }}
        >
          <span style={{ fontSize: '28px' }}>🗺️</span>
          <span>{mapError}</span>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: 'rgba(184, 134, 11,0.1)',
              border: '1px solid rgba(184, 134, 11,0.2)',
              borderRadius: '8px',
              padding: '5px 14px',
              color: '#b8860b',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            重试
          </button>
        </div>
      )}

      {!mapLoaded && !mapError && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(13,31,23,0.8)',
            color: 'rgba(184, 134, 11,0.5)',
            fontSize: '12px',
            gap: '8px',
            borderRadius: '16px',
          }}
        >
          <span style={{ fontSize: '24px' }}>⏳</span>
          <span>地图加载中{geocoding ? '（正在定位门店...）' : ''}...</span>
        </div>
      )}

      {showControls && mapLoaded && (
        <>
          <button
            onClick={handleLocate}
            disabled={locating}
            style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              width: '44px',
              height: '44px',
              minWidth: '44px',
              borderRadius: '14px',
              background: locating
                ? 'rgba(184, 134, 11,0.3)'
                : 'rgba(13,31,23,0.92)',
              border: '1px solid rgba(184, 134, 11,0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: locating ? 'wait' : 'pointer',
              fontSize: '20px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
              backdropFilter: 'blur(12px)',
              transition: 'all 0.2s',
              zIndex: 10,
            }}
            title="定位我的位置"
          >
            {locating ? '⏳' : '📍'}
          </button>

          {/* 手动校准按钮 */}
          <button
            onClick={() => setShowManualInput(v => !v)}
            style={{
              position: 'absolute',
              top: '64px',
              right: '12px',
              width: '44px',
              height: '44px',
              minWidth: '44px',
              borderRadius: '14px',
              background: showManualInput
                ? 'rgba(184, 134, 11,0.3)'
                : 'rgba(13,31,23,0.85)',
              border: '1px solid rgba(184, 134, 11,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '18px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
              backdropFilter: 'blur(12px)',
              transition: 'all 0.2s',
              zIndex: 10,
            }}
            title="手动校准位置"
          >
            ✏️
          </button>


          {distance && hasUserLocation && (
            <div
              style={{
                position: 'absolute',
                top: '12px',
                left: '12px',
                background: 'rgba(13,31,23,0.92)',
                border: '1px solid rgba(184, 134, 11,0.35)',
                borderRadius: '22px',
                padding: '7px 14px',
                fontSize: '15px',
                fontWeight: 700,
                color: '#b8860b',
                backdropFilter: 'blur(12px)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
              }}
            >
              📍 {distance}
            </div>
          )}

          {/* 手动输入弹窗 */}
          {showManualInput && (
            <div
              style={{
                position: 'absolute',
                top: '120px',
                right: '12px',
                width: '220px',
                background: 'rgba(13,31,23,0.96)',
                border: '1px solid rgba(184, 134, 11,0.3)',
                borderRadius: '14px',
                padding: '12px',
                backdropFilter: 'blur(16px)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                zIndex: 20,
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#b8860b', marginBottom: '8px' }}>
                ✏️ 手动校准位置
              </div>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', marginBottom: '8px', lineHeight: 1.4 }}>
                输入你的真实经纬度，<br/>或拖动地图上的蓝点进行校准
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <input
                  type="text"
                  placeholder="经度 如: 109.200"
                  value={manualLngInput}
                  onChange={e => setManualLngInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleManualInputConfirm()}
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(184, 134, 11,0.2)',
                    borderRadius: '8px',
                    padding: '6px 8px',
                    color: '#fff',
                    fontSize: '12px',
                    outline: 'none',
                    width: '100%',
                    boxSizing: 'border-box',
                  }}
                />
                <input
                  type="text"
                  placeholder="纬度 如: 27.733"
                  value={manualLatInput}
                  onChange={e => setManualLatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleManualInputConfirm()}
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(184, 134, 11,0.2)',
                    borderRadius: '8px',
                    padding: '6px 8px',
                    color: '#fff',
                    fontSize: '12px',
                    outline: 'none',
                    width: '100%',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              {manualInputError && (
                <div style={{ fontSize: '10px', color: '#ff6b6b', marginTop: '4px' }}>
                  ⚠️ {manualInputError}
                </div>
              )}
              <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                <button
                  onClick={handleManualInputConfirm}
                  style={{
                    flex: 1,
                    background: 'rgba(184, 134, 11,0.2)',
                    border: '1px solid rgba(184, 134, 11,0.4)',
                    borderRadius: '8px',
                    padding: '5px 0',
                    color: '#b8860b',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  确认
                </button>
                <button
                  onClick={handleClearManual}
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    padding: '5px 0',
                    color: 'rgba(255,255,255,0.4)',
                    fontSize: '11px',
                    cursor: 'pointer',
                  }}
                >
                  清除并重新定位
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
