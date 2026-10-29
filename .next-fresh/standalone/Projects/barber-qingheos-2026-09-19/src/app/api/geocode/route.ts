// Geocode API - GET /api/geocode?address=xxx
import { geocodeAddress, reverseGeocode } from '@/lib/amap'
import { getUserLocation, STORE_LOCATION, calcDistance, formatDistance } from '@/lib/geo'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const address = url.searchParams.get('address')
  const lng = parseFloat(url.searchParams.get('lng') || '0')
  const lat = parseFloat(url.searchParams.get('lat') || '0')
  const mode = url.searchParams.get('mode') || 'geocode' // geocode | reverse | nearby

  try {
    // Address -> coordinates
    if (address && mode === 'geocode') {
      const result = await geocodeAddress(address)
      if (!result) {
        return Response.json({ success: false, error: '地址解析失败' }, { status: 404 })
      }
      return Response.json({ success: true, type: 'geocode', data: result })
    }

    // Reverse: coordinates -> address
    if (lng && lat && mode === 'reverse') {
      const addr = await reverseGeocode(lng, lat)
      return Response.json({ success: true, type: 'reverse', address: addr })
    }

    // Nearby: get user location + distance to store
    if (mode === 'nearby') {
      const userLoc = await getUserLocation()
      const distanceKm = calcDistance(userLoc, STORE_LOCATION)
      const distanceStr = formatDistance(distanceKm)

      return Response.json({
        success: true,
        type: 'nearby',
        data: {
          user: {
            lng: userLoc.lng,
            lat: userLoc.lat,
            isDefault: userLoc.isDefault,
          },
          store: {
            lng: STORE_LOCATION.lng,
            lat: STORE_LOCATION.lat,
          },
          distanceKm,
          distanceStr,
        },
      })
    }

    return Response.json({ success: false, error: '参数不足' }, { status: 400 })
  } catch (error: any) {
    console.error('[Geocode API] Error:', error?.message || error)
    return Response.json(
      { success: false, error: '服务暂时不可用' },
      { status: 500 }
    )
  }
}