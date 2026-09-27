// 高德地图 API 工具

export const AMAP_JS_KEY = 'f0d6459ee9fa11450a48cfcf4519a8d9'

// 高德 Web服务 API 基础地址
const AMAP_WEB_API_BASE = 'https://restapi.amap.com/v3'

export interface AmapGeocodeResult {
  province: string
  city: string
  district: string
  address: string
  lng: number
  lat: number
}

// 地址 -> 经纬度（地理编码）
export async function geocodeAddress(address: string): Promise<AmapGeocodeResult | null> {
  const params = new URLSearchParams({
    key: AMAP_JS_KEY,
    address,
    city: '铜仁',
    output: 'json',
  })

  const url = `${AMAP_WEB_API_BASE}/geocode/geo?${params.toString()}`

  try {
    const res = await fetch(url, { next: { revalidate: 3600 } })
    const data = await res.json()

    if (data.status === '1' && data.geocodes && data.geocodes.length > 0) {
      const g = data.geocodes[0]
      return {
        province: g.province || '',
        city: g.city || '',
        district: g.district || '',
        address: g.formatted_address || address,
        lng: parseFloat(g.location.split(',')[0]),
        lat: parseFloat(g.location.split(',')[1]),
      }
    }
    return null
  } catch {
    return null
  }
}

// 经纬度 -> 地址（逆地理编码）
export async function reverseGeocode(lng: number, lat: number): Promise<string> {
  const params = new URLSearchParams({
    key: AMAP_JS_KEY,
    location: `${lng},${lat}`,
    extensions: 'all',
    output: 'json',
  })

  const url = `${AMAP_WEB_API_BASE}/geocode/regeo?${params.toString()}`

  try {
    const res = await fetch(url, { next: { revalidate: 300 } })
    const data = await res.json()

    if (data.status === '1' && data.regeocode) {
      const addr = data.regeocode.formatted_address
      return addr || ''
    }
    return ''
  } catch {
    return ''
  }
}

// 路径规划（步行/驾车）
export interface RoutePlan {
  distance: number      // 米
  duration: number      // 秒
  strategy: string      // 导航策略
  steps: string[]       // 路线描述
}

export async function getRoutePlan(
  fromLng: number,
  fromLat: number,
  toLng: number,
  toLat: number,
  type: 'walk' | 'drive' = 'walk'
): Promise<RoutePlan | null> {
  const params = new URLSearchParams({
    key: AMAP_JS_KEY,
    origin: `${fromLng},${fromLat}`,
    destination: `${toLng},${toLat}`,
    strategy: type === 'walk' ? '10' : '0', // 步行=最短距离，驾车=速度最快
    mode: type === 'walk' ? 'walking' : 'driving',
  })

  const url = `${AMAP_WEB_API_BASE}/direction/${type === 'walk' ? 'walking' : 'driving'}?${params.toString()}`

  try {
    const res = await fetch(url, { next: { revalidate: 60 } })
    const data = await res.json()

    if (data.status === '1' && data.route && data.route.paths && data.route.paths.length > 0) {
      const path = data.route.paths[0]
      const steps = (path.steps as Array<{ instruction: string }>).map(s => s.instruction)
      return {
        distance: parseInt(path.distance),
        duration: parseInt(path.duration),
        strategy: data.route.strategy || '',
        steps,
      }
    }
    return null
  } catch {
    return null
  }
}

// 加载高德 JS API（用于地图组件）
export function getAmapJSUrl(): string {
  // 预加载需要的插件（Geocoder 地理编码、PlaceSearch POI 搜索、ToolBar 工具条、Scale 比例尺、MoveAnimation 平滑动画）
  const plugins = ['AMap.Geocoder', 'AMap.PlaceSearch', 'AMap.ToolBar', 'AMap.Scale', 'AMap.MoveAnimation']
  return `https://webapi.amap.com/maps?v=2.0&key=${AMAP_JS_KEY}&plugin=${plugins.join(',')}`
}

// 构建高德地图分享链接
export function buildAmapShareUrl(lng: number, lat: number, name: string): string {
  return `https://uri.amap.com/goto?key=${encodeURIComponent(name)}&lng=${lng}&lat=${lat}&type=point&callnative=1`
}

// 构建高德导航URL
export function buildAmapNavigationUrl(
  fromLng: number,
  fromLat: number,
  toLng: number,
  toLat: number,
  type: 'walk' | 'drive' = 'drive'
): string {
  const mode = type === 'walk' ? 'walking' : 'car'
  return `https://uri.amap.com/navigation?to=${toLng},${toLat},果蔬鲜生&mode=${mode}&callnative=1`
}