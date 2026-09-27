// Weather API - GET /api/weather?city=铜仁
import { fetchWeather, formatWeatherForChat } from '@/lib/weather'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const city = url.searchParams.get('city') || '铜仁'

  try {
    const weather = await fetchWeather(city)

    // Also include chat-formatted version
    const chatText = formatWeatherForChat(weather)

    return Response.json({
      success: true,
      data: weather,
      chatText,
      source: 'wttr.in',
    })
  } catch (error: any) {
    console.error('[天气API] Error:', error?.message || error)
    return Response.json(
      {
        success: false,
        error: '获取天气失败，请稍后再试',
        data: null,
      },
      { status: 500 }
    )
  }
}