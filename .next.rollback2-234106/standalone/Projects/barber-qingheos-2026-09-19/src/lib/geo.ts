// Geolocation + distance calculation utilities

export interface GeoCoord {
  lng: number
  lat: number
  name?: string  // 可选 — 用于 map 页显示门店名
}

// ─── WGS-84 → GCJ-02 坐标转换（国家加密坐标） ────────────────────────────────
const PI = Math.PI
const A = 6378245.0
const EE = 0.00669342162296594323

/**
 * 判断坐标是否在中国境外（国测局边界）
 */
export function isOutOfChina(lng: number, lat: number): boolean {
  return lng < 73.66 || lng > 135.05 || lat < 3.86 || lat > 53.55
}

function transformLat(x: number, y: number): number {
  let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x))
  ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0
  ret += (20.0 * Math.sin(y * PI) + 40.0 * Math.sin(y / 3.0 * PI)) * 2.0 / 3.0
  ret += (160.0 * Math.sin(y / 12.0 * PI) + 320.0 * Math.sin(y * PI / 30.0)) * 2.0 / 3.0
  return ret
}

function transformLng(x: number, y: number): number {
  let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x))
  ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0
  ret += (20.0 * Math.sin(x * PI) + 40.0 * Math.sin(x / 3.0 * PI)) * 2.0 / 3.0
  ret += (150.0 * Math.sin(x / 12.0 * PI) + 300.0 * Math.sin(x / 30.0 * PI)) * 2.0 / 3.0
  return ret
}

/**
 * WGS-84（浏览器GPS）转 GCJ-02（高德/中国地图）
 * 浏览器 geolocation 返回 WGS-84，在中国会偏 100-700 米
 */
export function convertWGS84ToGCJ02(lng: number, lat: number): { lng: number; lat: number } {
  if (isOutOfChina(lng, lat)) return { lng, lat }
  let dLat = transformLat(lng - 105.0, lat - 35.0)
  let dLng = transformLng(lng - 105.0, lat - 35.0)
  const radLat = (lat / 180.0) * PI
  let magic = Math.sin(radLat)
  magic = 1 + EE * magic * magic
  const sqrtMagic = Math.sqrt(magic)
  dLat = (dLat * 180.0) / ((A * (1 - EE)) / (magic * sqrtMagic) * PI)
  dLng = (dLng * 180.0) / (A / sqrtMagic * Math.cos(radLat) * PI)
  return { lng: lng + dLng, lat: lat + dLat }
}

// ─── AMap.Geolocation 封装 ───────────────────────────────────────────────────

declare global {
  interface Window {
    AMap?: any
  }
}

/**
 * 优先级1: 高德 SDK 定位（直接返回 GCJ-02，无需转换）
 */
export async function getLocationFromAMap(): Promise<{ lng: number; lat: number; source: 'amap' } | null> {
  if (typeof window === 'undefined' || !window.AMap) return null

  return new Promise((resolve) => {
    try {
      window.AMap.plugin(['AMap.Geolocation'], () => {
        const geo = new window.AMap!.Geolocation({
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 60000,
        })
        geo.getCurrentPosition((status: string, result: any) => {
          if (status === 'complete' && result?.position) {
            resolve({
              lng: result.position.lng,
              lat: result.position.lat,
              source: 'amap' as const,
            })
          } else {
            resolve(null)
          }
        })
      })
    } catch {
      resolve(null)
    }
  })
}

// ─── 浏览器 Geolocation + 坐标转换 ───────────────────────────────────────────

/**
 * 优先级2: 浏览器原生定位 + WGS-84→GCJ-02 转换
 */
export async function getUserLocationFromBrowser(): Promise<{ lng: number; lat: number; source: 'browser' } | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return null

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const wgsLng = position.coords.longitude
        const wgsLat = position.coords.latitude
        const gcj = convertWGS84ToGCJ02(wgsLng, wgsLat)
        resolve({ lng: gcj.lng, lat: gcj.lat, source: 'browser' as const })
      },
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  })
}

// ─── Store location ───────────────────────────────────────────────────────────

// Store location (造型师助手·附小店) — 从高德app直接读取的真实坐标
// 完整地址：贵州省铜仁市碧江区干群路与清水大道交汇处东北50米（清水大道清水花园一栋1单元10-11号）
// 高德GCJ-02坐标（与高德地图显示一致）
// 2026-06-07 奕霖人工校准
export const STORE_LOCATION: GeoCoord = {
  lng: 109.200269,
  lat: 27.732818,
}

// localStorage key for cached real store location
const STORE_LOCATION_CACHE_KEY = 'zhilin_store_real_location'

/**
 * 获取真实门店坐标
 * 优先级：localStorage缓存 > 默认STORE_LOCATION
 * MapView 初始化后会用高德 JS API 地理编码覆盖此值
 */
export function getRealStoreLocation(): GeoCoord {
  try {
    const cached = localStorage.getItem(STORE_LOCATION_CACHE_KEY)
    if (cached) {
      const parsed = JSON.parse(cached) as { lng: number; lat: number }
      if (typeof parsed.lng === 'number' && typeof parsed.lat === 'number') {
        return parsed
      }
    }
  } catch {
    // ignore parse errors
  }
  return { ...STORE_LOCATION }
}

/**
 * 保存真实门店坐标到 localStorage（MapView 地理编码后调用）
 */
export function saveRealStoreLocation(lng: number, lat: number): void {
  try {
    localStorage.setItem(STORE_LOCATION_CACHE_KEY, JSON.stringify({ lng, lat }))
  } catch {
    // ignore quota errors
  }
}

// Distance calculation using Haversine formula
export function calcDistance(coord1: GeoCoord, coord2: GeoCoord): number {
  const R = 6371 // Earth radius in km
  const dLat = toRad(coord2.lat - coord1.lat)
  const dLng = toRad(coord2.lng - coord1.lng)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(coord1.lat)) * Math.cos(toRad(coord2.lat)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c // km
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180)
}

// Format distance for display
export function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)}米`
  }
  return `${km.toFixed(1)}公里`
}

// ─── Manual location（用户手动校准） ────────────────────────────────────────
const MANUAL_LOCATION_KEY = 'zhilin_user_manual_location'

/**
 * 获取手动校准位置
 * 优先级：manual > browser geolocation > 铜仁默认
 */
export function getManualLocation(): GeoCoord | null {
  try {
    const raw = localStorage.getItem(MANUAL_LOCATION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { lng: number; lat: number }
    if (typeof parsed.lng === 'number' && typeof parsed.lat === 'number') {
      return parsed
    }
  } catch {
    // ignore
  }
  return null
}

/**
 * 保存手动校准位置
 */
export function saveManualLocation(lng: number, lat: number): void {
  try {
    localStorage.setItem(MANUAL_LOCATION_KEY, JSON.stringify({ lng, lat }))
  } catch {
    // ignore
  }
}

/**
 * 清除手动校准位置（恢复到自动定位）
 */
export function clearManualLocation(): void {
  try {
    localStorage.removeItem(MANUAL_LOCATION_KEY)
  } catch {
    // ignore
  }
}

// ─── 3层定位降级主函数 ────────────────────────────────────────────────────────

export interface UserLocation extends GeoCoord {
  source: 'manual' | 'amap' | 'browser' | 'ip'
  isDefault: boolean
}

/**
 * 3层定位降级 + 坐标系统一
 *
 * 优先级：
 * 1. 手动校准（localStorage，用户自己校准过）
 * 2. 高德 SDK（AMap.Geolocation，GCJ-02，直接可用）
 * 3. 浏览器 Geolocation + WGS-84→GCJ-02 转换
 * 4. 后端 IP 定位（淘宝 IP 库，城市级兜底）
 */
export async function getUserLocation(): Promise<UserLocation> {
  // 优先级1: 手动校准（直接用，已是 GCJ-02）
  const manual = getManualLocation()
  if (manual) {
    return { ...manual, source: 'manual', isDefault: false }
  }

  // 优先级2: 高德 SDK（GCJ-02，最准确）
  const amap = await getLocationFromAMap()
  if (amap) return { ...amap, isDefault: false }

  // 优先级3: 浏览器 Geolocation + 坐标转换
  const browser = await getUserLocationFromBrowser()
  if (browser) return { ...browser, isDefault: false }

  // 优先级4: 后端 IP 定位（城市级兜底）
  try {
    const res = await fetch('/api/ip-location')
    if (res.ok) {
      const ip = await res.json()
      if (ip?.lng && ip?.lat) {
        return { lng: ip.lng, lat: ip.lat, source: 'ip', isDefault: false }
      }
    }
  } catch {
    // fall through to default
  }

  // 兜底：铜仁市中心
  return {
    lng: 109.191,
    lat: 27.718,
    source: 'ip',
    isDefault: true,
  }
}

// ─── Legacy browser geolocation helper（保留兼容） ───────────────────────────
export function getBrowserLocation(): Promise<GeoCoord> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position: GeolocationPosition) => {
        resolve({
          lng: position.coords.longitude,
          lat: position.coords.latitude,
        })
      },
      (error: GeolocationPositionError) => {
        let msg = '定位失败'
        switch (error.code) {
          case error.PERMISSION_DENIED:
            msg = '定位权限被拒绝'
            break
          case error.POSITION_UNAVAILABLE:
            msg = '无法获取位置（室内GPS信号弱）'
            break
          case error.TIMEOUT:
            msg = '定位超时，请尝试手动校准'
            break
        }
        reject(new Error(msg))
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    )
  })
}

// Estimate walking time (rough)
export function estimateWalkingTime(km: number): string {
  const walkingSpeed = 5 // km/h
  const hours = km / walkingSpeed
  if (hours < 0.1) {
    return '约5分钟'
  }
  const minutes = Math.round(hours * 60)
  if (minutes < 60) {
    return `约${minutes}分钟`
  }
  return `约${Math.round(hours * 10) / 10}小时`
}

// Estimate driving time (rough)
export function estimateDrivingTime(km: number): string {
  const speed = 30 // km/h in city
  const hours = km / speed
  const minutes = Math.round(hours * 60)
  if (minutes < 1) {
    return '约1分钟'
  }
  if (minutes < 60) {
    return `约${minutes}分钟`
  }
  return `约${Math.round(hours * 10) / 10}小时`
}

// Build 高德 URL for navigation
export function buildAmapNavigationUrl(
  fromLng: number,
  fromLat: number,
  toLng: number,
  toLat: number,
  type: 'walk' | 'drive' = 'drive'
): string {
  const mode = type === 'walk' ? 'walking' : 'car'
  return `https://uri.amap.com/navigation?to=${toLng},${toLat},造型师助手（铜仁市碧江区店）&mode=${mode}&callnative=1`
}

// Is store currently open?
export function isStoreOpen(): boolean {
  const now = new Date()
  const hours = now.getHours()
  const minutes = now.getMinutes()
  const currentMinutes = hours * 60 + minutes
  // Open: 08:00 (480) - 23:30 (1410)
  return currentMinutes >= 480 && currentMinutes <= 1410
}