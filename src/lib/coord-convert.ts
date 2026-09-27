/**
 * coord-convert - 坐标系转换（WGS84 ↔ GCJ-02 ↔ BD-09）
 *
 * 中国地图 app 使用 GCJ-02（火星坐标系），高德/腾讯是 GCJ-02，百度是 BD-09。
 * 海外地图（WGS84）的坐标直接传中国地图 app 会有 50-700m 偏差。
 * 此模块把 WGS84 转为各地图 app 需要的坐标系，确保精确定位。
 *
 * 算法来源：GCJ-02 加密算法公开（测绘局偏移算法）。
 */

// 判定坐标是否在中国境内（境外直接返回 WGS84，不转换）
function outOfChina(lat: number, lng: number): boolean {
  if (lng < 72.004 || lng > 137.8347) return true
  if (lat < 0.8293 || lat > 55.8271) return true
  return false
}

// GCJ-02 转换核心
function _transformLat(x: number, y: number): number {
  let ret =
    -100.0 +
    2.0 * x +
    3.0 * y +
    0.2 * y * y +
    0.1 * x * y +
    0.2 * Math.sqrt(Math.abs(x))
  ret +=
    (20.0 * Math.sin(6.0 * x * Math.PI) +
      20.0 * Math.sin(2.0 * x * Math.PI) +
      20.0 * Math.sin(y * Math.PI) +
      40.0 * Math.sin((y / 3.0) * Math.PI) +
      160.0 * Math.sin((y / 12.0) * Math.PI) +
      320 * Math.sin((y / 30.0) * Math.PI)) *
    2.0 / 3.0
  return ret
}

function _transformLng(x: number, y: number): number {
  let ret =
    300.0 +
    x +
    2.0 * y +
    0.1 * x * x +
    0.1 * x * y +
    0.1 * Math.sqrt(Math.abs(x))
  ret +=
    (20.0 * Math.sin(6.0 * x * Math.PI) +
      20.0 * Math.sin(2.0 * x * Math.PI) +
      20.0 * Math.sin(x * Math.PI) +
      40.0 * Math.sin((x / 3.0) * Math.PI) +
      150.0 * Math.sin((x / 12.0) * Math.PI) +
      300.0 * Math.sin((x / 30.0) * Math.PI)) *
    2.0 / 3.0
  return ret
}

function _delta(lat: number, lng: number): { lat: number; lng: number } {
  const a = 6378245.0
  const ee = 0.00669342162296594323
  let dLat = _transformLat(lng - 105.0, lat - 35.0)
  let dLng = _transformLng(lng - 105.0, lat - 35.0)
  const radLat = (lat / 180.0) * Math.PI
  let magic = Math.sin(radLat)
  magic = 1 - ee * magic * magic
  const sqrtMagic = Math.sqrt(magic)
  dLat = (dLat * 180.0) / (((a * (1 - ee)) / (magic * sqrtMagic)) * Math.PI)
  dLng = (dLng * 180.0) / ((a / sqrtMagic) * Math.cos(radLat) * Math.PI)
  return { lat: dLat, lng: dLng }
}

/** WGS84 → GCJ-02（高德/腾讯/Apple Maps in China） */
export function wgs84ToGcj02(lat: number, lng: number): { lat: number; lng: number } {
  if (outOfChina(lat, lng)) return { lat, lng }
  const d = _delta(lat, lng)
  return { lat: lat + d.lat, lng: lng + d.lng }
}

/** GCJ-02 → BD-09（百度地图专用） */
export function gcj02ToBd09(lat: number, lng: number): { lat: number; lng: number } {
  const xPi = (Math.PI * 3000.0) / 180.0
  const z = Math.sqrt(lng * lng + lat * lat) + 0.00002 * Math.sin(lng * xPi)
  const theta = Math.atan2(lat, lng) + 0.000003 * Math.cos(lng * xPi)
  return { lat: z * Math.sin(theta) + 0.006, lng: z * Math.cos(theta) + 0.0065 }
}

/** WGS84 → BD-09（百度地图，一站式） */
export function wgs84ToBd09(lat: number, lng: number): { lat: number; lng: number } {
  const gcj = wgs84ToGcj02(lat, lng)
  return gcj02ToBd09(gcj.lat, gcj.lng)
}

/**
 * 给一个坐标生成所有地图 app 都能用的精确坐标
 * @returns wgs84, gcj02, bd09 三套坐标
 */
export function allCoordinateSystems(lat: number, lng: number) {
  return {
    wgs84: { lat, lng },
    gcj02: wgs84ToGcj02(lat, lng),
    bd09: wgs84ToBd09(lat, lng),
  }
}