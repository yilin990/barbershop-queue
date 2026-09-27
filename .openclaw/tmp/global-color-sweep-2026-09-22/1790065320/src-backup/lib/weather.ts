// Weather utility using wttr.in (free, no API key required)

export interface WeatherData {
  location: string
  temp: number       // 当前温度 °C
  condition: string   // 天气状况 (多云/晴/雨...)
  humidity: number    // 湿度 %
  windSpeed: number   // 风速 km/h
  feelsLike: number   // 体感温度
  tomorrowCondition: string  // 明天天气
  tomorrowTemp: string      // 明天温度范围
  uvIndex: number     // 紫外线指数
  tips: string[]       // 健康建议
}

// Parse wttr.in JSON format
// https://wttr.in/铜仁?format=j1
export interface WttrResponse {
  nearest_area: Array<{
    areaName: Array<{ value: string }>
    country: Array<{ value: string }>
    region: Array<{ value: string }>
  }>
  current_condition: Array<{
    temp_C: string
    weatherCode: string
    humidity: string
    windspeedKmph: string
    FeelsLikeC: string
    UVIndex: string
    localObsDateTime: string
  }>
  weather: Array<{
    maxtempC: string
    mintempC: string
    hourly: Array<{
      weatherCode: string
      tempC: string
      chanceofrain: string
      weatherDesc: Array<{ value: string }>
    }>
  }>
}

// Weather code -> Chinese condition mapping
const WEATHER_CODE_MAP: Record<string, { text: string; emoji: string }> = {
  '113': { text: '晴', emoji: '☀️' },
  '116': { text: '多云', emoji: '⛅' },
  '119': { text: '阴', emoji: '☁️' },
  '122': { text: '阴', emoji: '☁️' },
  '143': { text: '雾', emoji: '🌫️' },
  '176': { text: '晴转阵雨', emoji: '🌦️' },
  '179': { text: '阵雪', emoji: '🌨️' },
  '182': { text: '雪', emoji: '🌨️' },
  '185': { text: '冻雨', emoji: '🌨️' },
  '200': { text: '雷阵雨', emoji: '⛈️' },
  '227': { text: '风', emoji: '💨' },
  '230': { text: '暴风雪', emoji: '❄️' },
  '248': { text: '雾', emoji: '🌫️' },
  '260': { text: '雾', emoji: '🌫️' },
  '263': { text: '小雨', emoji: '🌧️' },
  '266': { text: '小雨', emoji: '🌧️' },
  '281': { text: '雨夹雪', emoji: '🌨️' },
  '284': { text: '雨夹雪', emoji: '🌨️' },
  '293': { text: '小雨', emoji: '🌧️' },
  '296': { text: '小雨', emoji: '🌧️' },
  '299': { text: '中雨', emoji: '🌧️' },
  '302': { text: '中雨', emoji: '🌧️' },
  '305': { text: '中雨', emoji: '🌧️' },
  '308': { text: '大雨', emoji: '🌧️' },
  '311': { text: '雨夹雪', emoji: '🌨️' },
  '314': { text: '雨夹雪', emoji: '🌨️' },
  '317': { text: '小雪', emoji: '🌨️' },
  '320': { text: '小雪', emoji: '🌨️' },
  '323': { text: '雪', emoji: '🌨️' },
  '326': { text: '雪', emoji: '🌨️' },
  '329': { text: '大雪', emoji: '❄️' },
  '332': { text: '大雪', emoji: '❄️' },
  '335': { text: '大雪', emoji: '❄️' },
  '338': { text: '冰雹', emoji: '🌨️' },
  '350': { text: '冰雹', emoji: '🌨️' },
  '365': { text: '雨夹雪', emoji: '🌨️' },
  '368': { text: '小雪', emoji: '🌨️' },
  '371': { text: '大雪', emoji: '❄️' },
  '374': { text: '冰雹', emoji: '🌨️' },
  '377': { text: '冰雹', emoji: '🌨️' },
  '386': { text: '雷阵雨', emoji: '⛈️' },
  '389': { text: '雷阵雨', emoji: '⛈️' },
  '392': { text: '雷阵雨', emoji: '⛈️' },
  '395': { text: '雷阵雪', emoji: '⛈️' },
}

function getWeatherInfo(code: string): { text: string; emoji: string } {
  return WEATHER_CODE_MAP[code] || { text: '未知', emoji: '🌤️' }
}

// Generate health tips based on weather
function generateTips(condition: string, temp: number, humidity: number, uvIndex: string): string[] {
  const tips: string[] = []
  const code = parseInt(uvIndex || '0')

  if (temp > 30) {
    tips.push('注意防暑，尽量避免长时间户外活动')
    tips.push('多喝水，适当补充电解质')
  } else if (temp < 10) {
    tips.push('天气较凉，注意保暖，适时添加衣物')
  }

  if (condition.includes('雨')) {
    tips.push('出门记得带伞，注意路面湿滑')
  }

  if (condition.includes('晴') || condition.includes('多云')) {
    if (code >= 6) {
      tips.push('紫外线较强，外出注意防晒')
    }
  }

  if (humidity > 80) {
    tips.push('湿度较大，注意通风除湿')
  }

  if (tips.length === 0) {
    tips.push('适合外出活动，保持好心情~')
  }

  return tips
}

// Main weather fetch function
export async function fetchWeather(city: string = '铜仁'): Promise<WeatherData> {
  const encodedCity = encodeURIComponent(city)
  const url = `https://wttr.in/${encodedCity}?format=j1&lang=zh`

  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
    next: { revalidate: 300 }, // cache 5 minutes
  })

  if (!response.ok) {
    throw new Error(`Weather API error: ${response.status}`)
  }

  const data: WttrResponse = await response.json()

  const current = data.current_condition[0]
  const weatherToday = data.weather[0]

  const currentCode = current.weatherCode
  const { text: condition, emoji } = getWeatherInfo(currentCode)

  // Get tomorrow's weather from hourly data (tomorrow = index 8-15 roughly for 8am-4pm)
  const tomorrowHourly = weatherToday.hourly.slice(8, 17) // 8am to 4pm tomorrow
  const tomorrowRainChance = tomorrowHourly.length > 0
    ? Math.max(...tomorrowHourly.map(h => parseInt(h.chanceofrain || '0')))
    : 0
  const tomorrowTemps = tomorrowHourly.map(h => parseInt(h.tempC || '0')).filter(t => !isNaN(t))
  const tomorrowMax = tomorrowTemps.length > 0 ? Math.max(...tomorrowTemps) : parseInt(current.temp_C) + 5
  const tomorrowMin = tomorrowTemps.length > 0 ? Math.min(...tomorrowTemps) : parseInt(current.temp_C) - 5

  // Find most common weather code in tomorrow's daytime
  const tomorrowCode = tomorrowHourly.length > 0
    ? (tomorrowHourly.reduce((prev, curr) =>
        parseInt(curr.chanceofrain || '0') > parseInt(prev.chanceofrain || '0') ? curr : prev
      ).weatherCode)
    : currentCode
  const { text: tomorrowCondition } = getWeatherInfo(tomorrowCode)

  const tips = generateTips(condition, parseInt(current.temp_C), parseInt(current.humidity), current.UVIndex)

  return {
    location: data.nearest_area[0]?.areaName[0]?.value || city,
    temp: parseInt(current.temp_C),
    condition,
    humidity: parseInt(current.humidity),
    windSpeed: parseInt(current.windspeedKmph),
    feelsLike: parseInt(current.FeelsLikeC),
    tomorrowCondition,
    tomorrowTemp: `${tomorrowMin}~${tomorrowMax}°C`,
    uvIndex: parseInt(current.UVIndex || '0'),
    tips,
  }
}

// Format weather for chat (果小蔬 style)
export function formatWeatherForChat(weather: WeatherData): string {
  const lines: string[] = []

  lines.push(`刚查了下，${weather.location}现在${weather.temp}°C，${weather.condition}。`)
  lines.push(`体感${weather.feelsLike}°C，湿度${weather.humidity}%，风速${weather.windSpeed}km/h。`)

  if (weather.tips.length > 0) {
    lines.push(weather.tips[0])
  }

  // Add rain tip if needed
  if (weather.condition.includes('雨')) {
    lines.push('出门记得带伞哦~')
  } else if (weather.temp > 30) {
    lines.push('天热别乱跑，小心别中暑！')
  } else if (weather.temp < 10) {
    lines.push('天凉记得加衣服，别感冒了~')
  }

  return lines.join(' ')
}

// Quick weather check (summary format)
export function formatWeatherSummary(weather: WeatherData): string {
  return `${weather.condition} ${weather.temp}°C | ${weather.location}`
}