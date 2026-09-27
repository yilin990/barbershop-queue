'use client'

import { useState, useEffect } from 'react'

interface WeatherData {
  location: string
  temp: number
  condition: string
  humidity: number
  windSpeed: number
  feelsLike: number
  tomorrowCondition: string
  tomorrowTemp: string
  uvIndex: number
  tips: string[]
}

const WEATHER_EMOJI: Record<string, string> = {
  '晴': '☀️', '多云': '⛅', '阴': '☁️', '雾': '🌫️',
  '小雨': '🌧️', '中雨': '🌧️', '大雨': '🌧️',
  '雷阵雨': '⛈️', '阵雨': '🌦️', '雪': '❄️',
  '小雪': '🌨️', '大雪': '❄️',
}

function getEmoji(condition: string): string {
  for (const [key, emoji] of Object.entries(WEATHER_EMOJI)) {
    if (condition.includes(key)) return emoji
  }
  return '🌤️'
}

interface WeatherWidgetProps {
  city?: string
  compact?: boolean // compact for embedding in chat
  onCityChange?: (city: string) => void
}

export default function WeatherWidget({ city = '铜仁', compact = false, onCityChange }: WeatherWidgetProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchWeather = async (cityName: string, isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/weather?city=${encodeURIComponent(cityName)}`)
      const json = await res.json()

      if (json.success) {
        setWeather(json.data)
        setLastUpdate(new Date())
      } else {
        setError(json.error || '获取天气失败')
      }
    } catch {
      setError('网络错误，请稍后再试')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchWeather(city)
    // Auto refresh every 10 minutes
    const interval = setInterval(() => fetchWeather(city, true), 600000)
    return () => clearInterval(interval)
  }, [city])

  // Compact style for chat integration
  if (compact) {
    if (loading) {
      return <span style={{ color: 'rgba(127,220,148,0.5)' }}>查询天气中...</span>
    }
    if (error || !weather) {
      return <span style={{ color: 'rgba(255,100,100,0.7)' }}>天气查询失败</span>
    }
    return (
      <span>
        {getEmoji(weather.condition)} {weather.temp}°C {weather.condition}，{weather.tips[0]}
      </span>
    )
  }

  // Full widget
  return (
    <div
      style={{
        background: 'linear-gradient(135deg, rgba(127,220,148,0.08) 0%, rgba(127,220,148,0.03) 100%)',
        border: '1px solid rgba(127,220,148,0.15)',
        borderRadius: '16px',
        padding: '16px',
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '14px' }}>🌤️</span>
          <span style={{ fontSize: '12px', color: 'rgba(127,220,148,0.6)', letterSpacing: '0.5px' }}>
            铜仁天气
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {lastUpdate && (
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)' }}>
              {lastUpdate.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={() => fetchWeather(city, true)}
            disabled={refreshing}
            style={{
              background: 'none',
              border: 'none',
              cursor: refreshing ? 'wait' : 'pointer',
              fontSize: '12px',
              color: 'rgba(127,220,148,0.5)',
              transition: 'all 0.2s',
              transform: refreshing ? 'rotate(360deg)' : 'none',
              animation: refreshing ? 'spin 1s linear infinite' : 'none',
            }}
          >
            🔄
          </button>
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(127,220,148,0.4)', fontSize: '13px' }}>
          加载天气中...
        </div>
      )}

      {error && (
        <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(255,100,100,0.7)', fontSize: '13px' }}>
          {error}
          <button
            onClick={() => fetchWeather(city)}
            style={{
              display: 'block',
              margin: '8px auto 0',
              background: 'rgba(127,220,148,0.1)',
              border: '1px solid rgba(127,220,148,0.2)',
              borderRadius: '8px',
              padding: '4px 12px',
              color: '#fbbf24',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            重试
          </button>
        </div>
      )}

      {weather && !loading && (
        <>
          {/* Main info */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '42px', lineHeight: 1 }}>{getEmoji(weather.condition)}</span>
            <div style={{ marginLeft: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                <span style={{ fontSize: '36px', fontWeight: 700, color: '#fff' }}>{weather.temp}</span>
                <span style={{ fontSize: '16px', color: 'rgba(255,255,255,0.5)' }}>°C</span>
              </div>
              <div style={{ fontSize: '13px', color: 'rgba(127,220,148,0.8)', marginTop: '2px' }}>
                {weather.condition}
              </div>
            </div>
          </div>

          {/* Details grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '8px',
              marginBottom: '12px',
            }}
          >
            {[
              { label: '体感', value: `${weather.feelsLike}°C` },
              { label: '湿度', value: `${weather.humidity}%` },
              { label: '风速', value: `${weather.windSpeed}km/h` },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  background: 'rgba(0,0,0,0.2)',
                  borderRadius: '8px',
                  padding: '8px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', marginBottom: '2px' }}>
                  {item.label}
                </div>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>

          {/* Tips */}
          {weather.tips[0] && (
            <div
              style={{
                background: 'rgba(127,220,148,0.06)',
                borderRadius: '8px',
                padding: '8px 10px',
                fontSize: '11px',
                color: 'rgba(127,220,148,0.7)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span>💡</span>
              <span>{weather.tips[0]}</span>
            </div>
          )}
        </>
      )}
    </div>
  )
}