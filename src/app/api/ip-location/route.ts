import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      ''

    // 使用 ip-api.com（免费、稳定、无需key）
    const url = ip
      ? `http://ip-api.com/json/${ip}`
      : 'http://ip-api.com/json/'

    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 5000)
    const res = await fetch(url, { signal: ctl.signal }).finally(() => clearTimeout(t))
    const data = await res.json()

    if (data?.status === 'success') {
      const { regionName, city, lat, lon } = data

      // 贵州或铜仁用户 → 返回铜仁市中心（GCJ-02，与高德一致）
      if (regionName?.includes('贵州') || city?.includes('铜仁')) {
        return NextResponse.json({
          lng: 109.191,
          lat: 27.718,
          city: city || '铜仁',
          region: regionName,
          source: 'ip-api-tongren',
        })
      }

      // 其他地区 → 尝试用返回的坐标（ip-api返回WGS-84，但差异可接受）
      return NextResponse.json({
        lng: lon,
        lat: lat,
        city: city,
        region: regionName,
        source: 'ip-api-fallback',
      })
    }

    // ip-api 查不到 → 直接返回铜仁兜底（不返回500，避免打断定位流程）
    return NextResponse.json({
      lng: 109.191,
      lat: 27.718,
      city: '铜仁',
      region: '贵州',
      source: 'tongren-fallback',
    })
  } catch {
    // 网络错误 → 直接返回铜仁兜底
    return NextResponse.json({
      lng: 109.191,
      lat: 27.718,
      city: '铜仁',
      region: '贵州',
      source: 'tongren-fallback',
    })
  }
}