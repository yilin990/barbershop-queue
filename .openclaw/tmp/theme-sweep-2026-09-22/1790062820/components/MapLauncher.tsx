'use client'

/**
 * MapLauncher v15 - 复制地址栏指令（方案 A 落地）
 *
 * v1.0 (2026-07-30 03:59)：基础 geo: + web URL
 * v2.0 (2026-07-30 04:31)：坐标精确化 + 弹窗美化
 * v3.0 (2026-07-30 05:09)：native scheme 优先 + 弹窗被挡修复
 * v4.0 (2026-07-30 14:29)：弹窗紧凑化 + 居中弹出 + mode 参数
 * v5.0 (2026-07-30 14:52)：色调外观深度升级
 * v6.0 (2026-07-30 15:08)：slide-up + Portal + iOS 黑名单已知
 * v7.0 (2026-07-30 19:26)：Portal转义transform containing block
 * v8.0 (2026-07-30 19:53)：<a href> Safari 原生处理
 * v9.0 (2026-07-30 20:22)：onClick 异步 setShowSheet
 * v10.0 (2026-07-30 20:36)：backScheme=:// 格式 + amapNativeStyle 修正
 * v11.0 (2026-07-30 20:48)：cnblogs 实战代码 + callnative fallback
 * v12.0 (2026-07-30 21:01)：豆包建议 + 方案A 落地（ui双选）
 * v13.0 (2026-07-30 21:32)：地址修正 + web URL 置顶
 * v14.0 (2026-07-30 23:42)：用户授权二级弹窗
 * v15.0 (2026-07-30 23:51)：方案 A 落地 - 复制地址栏指令
 * - 核心洞察：iOS Safari 黑名单只拦截 click，不拦截 URL bar 输入
 * - 用户复制 scheme URL → 打开 Safari → 粘贴地址栏 → 回车 → 100% 调起
 * - navigator.clipboard.writeText + document.execCommand('copy') 双保险
 * - 步骤提示卡（iOS Safari 专属）：打开 Safari → 长按地址栏 → 粘贴 → 前往
 * - 保留 web URL 兜底（直接用网页版按钮）
 */

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { allCoordinateSystems } from '@/lib/coord-convert'

export type TravelMode = 'drive' | 'walk' | 'bus' | 'ride'

interface MapLauncherProps {
  /** 纬度 (WGS84) */
  lat: number
  /** 经度 (WGS84) */
  lng: number
  /** 地点名称 */
  name: string
  /** 地址文本 */
  address?: string
  /** 按钮显示文字 */
  label?: string
  /** 自定义样式 */
  className?: string
  /** 显示风格 */
  variant?: 'primary' | 'ghost' | 'icon'
  /** 出行方式（影响 scheme URL 的 mode 参数 + 弹窗标题） */
  mode?: TravelMode
  /** 自定义触发器样式（覆盖默认 variant 样式） */
  triggerStyle?: React.CSSProperties
  /** 自定义触发器内容 */
  triggerContent?: React.ReactNode
}

interface MapOption {
  key: string
  label: string
  icon: string
  /** 原生 scheme（移动端，优先调用） */
  scheme?: string
  /** Web URL fallback（桌面端 / scheme 失败时降级） */
  url: string
  description?: string
  recommended?: boolean
  badge?: string
}

const MODE_LABELS: Record<TravelMode, string> = {
  drive: '驾车',
  walk: '步行',
  bus: '公交',
  ride: '打车',
}

const MODE_ICONS: Record<TravelMode, string> = {
  drive: '🗺️',
  walk: '🚶',
  bus: '🚌',
  ride: '🚕',
}

function detectPlatform(): 'ios' | 'android' | 'desktop' {
  if (typeof navigator === 'undefined') return 'desktop'
  const ua = navigator.userAgent
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  return 'desktop'
}

/**
 * ⭐ v7.0：调起原生 app 的 3 重保险机制
 * 1. iframe trick：比 window.location.href 更可靠（不阻塞主线程）
 * 2. blur 事件：app 接管页面后立即识别（比 visibilitychange 更快）
 * 3. 1.5s 快速 fallback：避免等太久变白板
 */
function openNative(scheme: string, fallbackUrl: string) {
  let appOpened = false
  let fallbackTimer: ReturnType<typeof setTimeout> | null = null

  const onBlur = () => {
    // iOS app 接管后页面立刻 blur（比 visibilitychange 还快）
    appOpened = true
    cleanup()
  }

  const cleanup = () => {
    window.removeEventListener('blur', onBlur)
    document.removeEventListener('visibilitychange', onVisChange)
    if (fallbackTimer) clearTimeout(fallbackTimer)
  }

  const onVisChange = () => {
    if (document.visibilityState === 'hidden') {
      appOpened = true
      cleanup()
    }
  }

  window.addEventListener('blur', onBlur)
  document.addEventListener('visibilitychange', onVisChange)

  fallbackTimer = setTimeout(() => {
    cleanup()
    if (!appOpened && document.visibilityState === 'visible') {
      window.open(fallbackUrl, '_blank', 'noopener,noreferrer')
    }
  }, 1500)

  // ⭐ v7.0：iframe trick 比 window.location.href 更可靠
  // iOS Safari 对 iframe 的 scheme 处理不会阻塞主线程
  const iframe = document.createElement('iframe')
  iframe.style.display = 'none'
  iframe.src = scheme
  document.body.appendChild(iframe)
  setTimeout(() => {
    try {
      document.body.removeChild(iframe)
    } catch {}
  }, 200)
}

export default function MapLauncher({
  lat,
  lng,
  name,
  address,
  label = '导航到店',
  className = '',
  variant = 'primary',
  mode = 'drive',
  triggerStyle,
  triggerContent,
}: MapLauncherProps) {
  const [showSheet, setShowSheet] = useState(false)
  const [pendingAuth, setPendingAuth] = useState<MapOption | null>(null)
  const [copied, setCopied] = useState(false)
  // ⭐ v16.0：跨会话记住用户上次选择的地图 APP（localStorage）
  const [mapPreference, setMapPreferenceState] = useState<string | null>(null)
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      setMapPreferenceState(localStorage.getItem('zhilin-map-preference'))
    } catch {}
  }, [])
  const setMapPreference = (key: string) => {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem('zhilin-map-preference', key)
      setMapPreferenceState(key)
    } catch {}
  }
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop'>('desktop')

  useEffect(() => {
    setPlatform(detectPlatform())
  }, [])

  // ⭐ v2.0：坐标转换
  const coords = allCoordinateSystems(lat, lng)
  const gcj = coords.gcj02
  const bd = coords.bd09
  const encName = encodeURIComponent(name)

  const isMobile = platform === 'ios' || platform === 'android'

  // 出行方式映射（每个地图 app 的 mode 参数不同）
  const amapMode = { drive: 'car', walk: 'walk', bus: 'bus', ride: 'car' }[mode]
  const baiduMode = { drive: 'driving', walk: 'walking', bus: 'transit', ride: 'riding' }[mode]
  const qqMode = { drive: 'drive', walk: 'walk', bus: 'bus', ride: 'ride' }[mode]
  const appleDirflg = { drive: 'd', walk: 'w', bus: 'r', ride: 'd' }[mode]
  const googleMode = { drive: 'driving', walk: 'walking', bus: 'transit', ride: 'driving' }[mode]
  // ⭐ v10.0 修正：高德 iOS scheme style 实际值：0=驾车, 1=公交, 2=步行, 3=骑行
  // 之前映射完全错（drive='2' 是步行，walk='4' 是无效值会导致高德静默拒绝）
  const amapNativeStyle = { drive: '0', walk: '2', bus: '1', ride: '3' }[mode]

  const options: MapOption[] = isMobile
    ? [
        {
          key: 'gaode',
          label: '高德地图',
          icon: '🟢',
          scheme:
            platform === 'ios'
              ? `iosamap://navi?sourceApplication=qinghe&backScheme=qinghe://&lat=${gcj.lat}&lon=${gcj.lng}&name=${encName}&style=${amapNativeStyle}&dev=0`
              : `androidamap://navi?sourceApplication=qinghe&backScheme=qinghe://&lat=${gcj.lat}&lon=${gcj.lng}&name=${encName}&style=${amapNativeStyle}&dev=0`,
          url: `https://uri.amap.com/navigation?to=${gcj.lng},${gcj.lat},${encName}&mode=${amapMode}&callnative=1&src=qinghe&coordinate=gaode`,
          description: `${MODE_LABELS[mode]} · 调起高德`,
          recommended: true,
          badge: '推荐',
        },
        {
          key: 'baidu',
          label: '百度地图',
          icon: '🔵',
          scheme: `baidumap://map/direction?destination=${bd.lat},${bd.lng}|${encName}&mode=${baiduMode}&coord_type=bd09&src=qinghe`,
          url: `https://api.map.baidu.com/direction?destination=${bd.lat},${bd.lng}&mode=${baiduMode}&region=全国&output=html&coord_type=bd09&src=qinghe`,
          description: `${MODE_LABELS[mode]} · 调起百度`,
        },
        {
          key: 'tencent',
          label: '腾讯地图',
          icon: '🟡',
          scheme: `qqmap://map/routeplan?type=${qqMode}&from=我的位置&tocoord=${gcj.lat},${gcj.lng}|${encName}&referer=qinghe`,
          url: `https://apis.map.qq.com/uri/v1/routeplan?from=&to=${gcj.lat},${gcj.lng}&type=${qqMode}&policy=1&referer=qinghe`,
          description: `${MODE_LABELS[mode]} · 调起腾讯`,
        },
        {
          key: 'apple',
          label: platform === 'ios' ? 'Apple 地图' : 'Google Maps',
          icon: platform === 'ios' ? '🍎' : '🌍',
          scheme:
            platform === 'ios'
              ? `maps://?daddr=${lat},${lng}&dirflg=${appleDirflg}&q=${encName}`
              : `google.navigation:q=${lat},${lng}&mode=${googleMode}`,
          url:
            platform === 'ios'
              ? `https://maps.apple.com/?daddr=${lat},${lng}&dirflg=${appleDirflg}&q=${encName}`
              : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=${googleMode}`,
          description: platform === 'ios' ? '系统地图 · 100% 调起' : '调起 Google Maps',
          // ⭐ v16.0：iOS 平台 Apple Maps 永远推荐（系统级 Universal Link）
          recommended: platform === 'ios',
          badge: platform === 'ios' ? 'iOS 首选' : undefined,
        },
      ]
    : [
        {
          key: 'gaode',
          label: '高德地图',
          icon: '🟢',
          url: `https://uri.amap.com/navigation?to=${gcj.lng},${gcj.lat},${encName}&mode=${amapMode}&callnative=1&src=qinghe&coordinate=gaode`,
          description: `${MODE_LABELS[mode]} · 国内最准`,
          recommended: true,
          badge: '推荐',
        },
        {
          key: 'baidu',
          label: '百度地图',
          icon: '🔵',
          url: `https://api.map.baidu.com/direction?destination=${bd.lat},${bd.lng}&mode=${baiduMode}&region=全国&output=html&coord_type=bd09&src=qinghe`,
          description: `${MODE_LABELS[mode]} · 百度生态`,
        },
        {
          key: 'tencent',
          label: '腾讯地图',
          icon: '🟡',
          url: `https://apis.map.qq.com/uri/v1/routeplan?from=&to=${gcj.lat},${gcj.lng}&type=${qqMode}&policy=1&referer=qinghe`,
          description: `${MODE_LABELS[mode]} · 腾讯系`,
        },
        {
          key: 'apple',
          label: 'Apple 地图',
          icon: '🍎',
          url: `https://maps.apple.com/?daddr=${lat},${lng}&dirflg=${appleDirflg}&q=${encName}`,
          description: `${MODE_LABELS[mode]} · macOS`,
        },
        {
          key: 'google',
          label: 'Google Maps',
          icon: '🌍',
          url: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=${googleMode}`,
          description: `${MODE_LABELS[mode]} · 国际版`,
        },
      ]

  // ⭐ v16.0：选项排序 - iOS Apple Maps 排第一 + 用户上次选择排第一
const sortedOptions = [...options].sort((a, b) => {
  // iOS 平台：Apple Maps 永远排第一（系统级，100% 调起）
  if (platform === 'ios') {
    if (a.key === 'apple') return -1
    if (b.key === 'apple') return 1
  }
  // 用户上次选择排第一（跨会话记忆）
  if (mapPreference) {
    if (a.key === mapPreference) return -1
    if (b.key === mapPreference) return 1
  }
  // 推荐项排第一
  if (a.recommended && !b.recommended) return -1
  if (b.recommended && !a.recommended) return 1
  return 0
})

// ⭐ v6.0：始终弹窗（不再区分 mobile/desktop），由弹窗选项决定 native scheme
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    setShowSheet(true)
  }

  const handleOption = (option: MapOption) => {
    // ⭐ v16.0：跨会话记住用户选择（下次弹窗排第一）
    setMapPreference(option.key)

    // ⭐ v16.0：iOS Apple Maps = 系统级 Universal Link，100% 调起
    // iOS Safari 点击 https://maps.apple.com/?daddr=... → 系统自动弹"在 Maps 中打开？"对话框
    // 这是 Apple 系统级方案，永不被黑名单，不需要走 pendingAuth
    if (option.key === 'apple' && platform === 'ios') {
      setShowSheet(false)
      window.location.href = option.url
      return
    }

    // ⭐ v14.0：方案 A - 其他 APP 用户主动授权后才真跳转
    if (option.scheme && isMobile) {
      // 移动端有 scheme → 需要用户授权
      setPendingAuth(option)
    } else {
      // 桌面端 / 无 scheme（网页版）→ 不需要授权，直接跳转
      setShowSheet(false)
      window.location.href = option.url
    }
  }

  /**
   * ⭐ v14.0：用户点击"授权打开"按钮后真触发
   * 保留 v11.0 的 cnblogs 实战模式 + callnative fallback
   * 延时从 700ms 拉长到 1500ms（给 iOS 系统 prompt 更多响应时间）
   */
  const handleConfirmAuth = (option: MapOption) => {
    setShowSheet(false)
    setPendingAuth(null)

    if (option.scheme) {
      window.location.href = option.scheme
      setTimeout(() => {
        if (document.visibilityState === 'visible' && !document.hidden) {
          // scheme 失败（iOS 黑名单 / 没装 app / 用户之前取消过）
          // fallback 到 callnative web URL
          window.location.href = option.url
        }
      }, 1500)
    }
  }

  /**
   * ⭐ v14.0：用户点"取消"回到主弹窗，可重新选择
   */
  const handleCancelAuth = () => {
    setPendingAuth(null)
    setCopied(false)
  }

  /**
   * ⭐ v15.0：复制 scheme URL 到剪贴板（教用户粘到 Safari 地址栏）
   * iOS Safari 黑名单只拦截 click → 不拦截 URL bar 输入
   * 用户复制 iosamap://navi?... → 打开 Safari → 粘贴到地址栏 → 回车 → 100% 调起
   */
  const handleCopyScheme = async (option: MapOption) => {
    if (!option.scheme) return
    try {
      await navigator.clipboard.writeText(option.scheme)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      // 降级：用 textarea 选中 + document.execCommand('copy')
      const ta = document.createElement('textarea')
      ta.value = option.scheme
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.select()
      try {
        document.execCommand('copy')
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch (e) {
        console.error('复制失败', e)
      }
      document.body.removeChild(ta)
    }
  }

  /**
   * ⭐ v8.0：Safari 原生方案选择器处理
   * 当 option 是 <a href={scheme}> 时，Safari 已经原生处理了 scheme 跳转
   * 这个点击处理器只负责：app 未装时 fallback 到 web URL
   */
  const handleSchemeClick = (option: MapOption) => {
    // ⭐ v9.0 关键：不要同步 setShowSheet(false)！
    // 原因：React 会在 onClick handler 结束后重新渲染，卸誣 <a> 元素。
    // 如果卸得太快，Safari 来不及处理 href scheme 跳转 → scheme 跳转被取消 → fallback 总是触发
    // 修法：让 Safari 先处理跳转，弹窗在 blur/timeout 才异步关闭

    let fallbackTimer: ReturnType<typeof setTimeout> | null = null

    const cleanup = () => {
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('visibilitychange', onVisChange)
      if (fallbackTimer) clearTimeout(fallbackTimer)
    }

    const onBlur = () => {
      // app 接管了页面 → Safari 已成功跳转 → 关闭弹窗
      cleanup()
      setShowSheet(false)
    }

    const onVisChange = () => {
      if (document.visibilityState === 'hidden') onBlur()
    }

    window.addEventListener('blur', onBlur)
    document.addEventListener('visibilitychange', onVisChange)

    // 1.8s 后页面仍可见 → scheme 未生效 → fallback 到 web
    fallbackTimer = setTimeout(() => {
      cleanup()
      if (document.visibilityState === 'visible' && !document.hidden) {
        // scheme 未生效，app 未装或者被拒绝 → 转到 web 版
        window.open(option.url, '_blank', 'noopener,noreferrer')
      }
      // fallback 后才关闭弹窗
      setShowSheet(false)
    }, 1800)
  }

  // 按钮样式（保持 v3.0）
  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    textDecoration: 'none',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    WebkitTapHighlightColor: 'transparent',
  }

  const styleByVariant: Record<string, React.CSSProperties> = {
    primary: {
      padding: '10px 18px',
      borderRadius: 12,
      background:
        'linear-gradient(135deg, rgba(127, 220, 148, 0.25) 0%, rgba(127, 220, 148, 0.15) 100%)',
      border: '1px solid rgba(127, 220, 148, 0.4)',
      color: '#a8e6b8',
      fontSize: 14,
      fontWeight: 600,
      boxShadow: '0 4px 16px rgba(127, 220, 148, 0.2)',
    },
    ghost: {
      padding: '6px 12px',
      borderRadius: 10,
      background: 'rgba(127, 220, 148, 0.08)',
      border: '1px solid rgba(127, 220, 148, 0.22)',
      color: '#fbbf24',
      fontSize: 12,
    },
    icon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      background: 'rgba(127, 220, 148, 0.12)',
      border: '1px solid rgba(127, 220, 148, 0.25)',
      color: '#fbbf24',
      fontSize: 16,
    },
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={className}
        title={address || name}
        style={
          triggerStyle || {
            ...baseStyle,
            ...styleByVariant[variant],
            // ⭐ v7.0：button 默认样式覆盖
            border: styleByVariant[variant].border || 'none',
            background: styleByVariant[variant].background || 'transparent',
            font: 'inherit',
            color: styleByVariant[variant].color,
          }
        }
      >
        {triggerContent || (
          <>
            <span>{MODE_ICONS[mode]}</span>
            <span>{label}</span>
          </>
        )}
      </button>

      {/* ⭐ v7.0：用 React Portal 把弹窗转到 document.body 下
          转义父级 transform 创建的 containing block（/stores 卡片用 transform: translateX 做滑动手势）
          position: fixed 在有 transform 的祖先下会变成相对该祖先定位 → 弹窗被锁在卡片里
          Portal 是唯一干净的解决方案 */}
      {showSheet && typeof document !== 'undefined' && createPortal(
        <div
          onClick={() => setShowSheet(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            // ⭐ v7.0：zIndex 提到 99999，Portal + body 下最大概率脱离一切层叠上下文
            zIndex: 99999,
            display: 'flex',
            // ⭐ v6.0：flex-end（贴底，slide-up 从底部上来，更“出格”感）
            alignItems: 'flex-end',
            justifyContent: 'center',
            padding: '16px',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <style>{`
            @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
            // ⭐ v6.0：slideUp 从底部上来代替 popIn 从中心弹出
            @keyframes slideUp {
              from { transform: translateY(100%) }
              to { transform: translateY(0) }
            }
          `}</style>

          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              // ⭐ v5.0：更深邃的绿黑色调背景
              background:
                'linear-gradient(180deg, rgba(13, 31, 23, 0.99) 0%, rgba(10, 15, 13, 0.99) 100%)',
              // ⭐ v6.0：顶部圆角代替全边圆角（贴底样式）
              borderRadius: '24px 24px 0 0',
              // ⭐ v6.0：加上安全区适配（iPhone 主屏指示器）
              padding: '14px 14px calc(20px + env(safe-area-inset-bottom, 0px))',
              width: '100%',
              maxWidth: 420,
              maxHeight: '82vh',
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
              overscrollBehavior: 'contain',
              // ⭐ v5.0：多层 boxShadow（外部投影 + 内部描边 + inset 高光）
              boxShadow:
                '0 -16px 64px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(127, 220, 148, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
              // ⭐ v6.0：slideUp 动画 + 顶部顶部高光
              animation: 'slideUp 0.32s cubic-bezier(0.34, 1.56, 0.64, 1)',
              position: 'relative',
            }}
          >
            {/* ⭐ v5.0：顶部双层光晕（1px 渐变线 + 8px light 区域） */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 1,
                background:
                  'linear-gradient(90deg, transparent 0%, rgba(127, 220, 148, 0.9) 50%, transparent 100%)',
                boxShadow: '0 0 12px rgba(127, 220, 148, 0.5)',
                zIndex: 2,
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 8,
                background:
                  'linear-gradient(180deg, rgba(127, 220, 148, 0.08) 0%, transparent 100%)',
                pointerEvents: 'none',
              }}
            />

            {/* ⭐ v5.0：标题区背景微光（让头部有"聚焦"感） */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 10,
                padding: '6px 4px',
                borderRadius: 12,
                background:
                  'linear-gradient(180deg, rgba(127, 220, 148, 0.05) 0%, transparent 100%)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    background:
                      'linear-gradient(135deg, rgba(127, 220, 148, 0.35) 0%, rgba(45, 90, 61, 0.7) 100%)',
                    border: '1px solid rgba(127, 220, 148, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 17,
                    flexShrink: 0,
                    boxShadow:
                      '0 4px 14px rgba(127, 220, 148, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
                  }}
                >
                  🌿
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: '#fff',
                      letterSpacing: '-0.2px',
                    }}
                  >
                    {MODE_LABELS[mode]}导航
                  </div>
                  <div
                    style={{
                      fontSize: 9,
                      color: 'rgba(127, 220, 148, 0.75)',
                      marginTop: 2,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-block',
                        width: 5,
                        height: 5,
                        borderRadius: 3,
                        background: '#fbbf24',
                        boxShadow: '0 0 6px #fbbf24',
                      }}
                    />
                    已装 App · 直接调起
                  </div>
                </div>
              </div>
              {/* ⭐ v5.0：关闭按钮 hover 变红 */}
              <button
                onClick={() => setShowSheet(false)}
                aria-label="关闭"
                onMouseEnter={(e) => {
                  ;(e.currentTarget as HTMLElement).style.background =
                    'rgba(255, 100, 100, 0.15)'
                  ;(e.currentTarget as HTMLElement).style.borderColor =
                    'rgba(255, 120, 120, 0.4)'
                  ;(e.currentTarget as HTMLElement).style.color =
                    'rgba(255, 180, 180, 0.95)'
                }}
                onMouseLeave={(e) => {
                  ;(e.currentTarget as HTMLElement).style.background =
                    'rgba(255, 255, 255, 0.06)'
                  ;(e.currentTarget as HTMLElement).style.borderColor =
                    'rgba(255, 255, 255, 0.1)'
                  ;(e.currentTarget as HTMLElement).style.color =
                    'rgba(255, 255, 255, 0.7)'
                }}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 9,
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: 'rgba(255, 255, 255, 0.7)',
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'all 0.15s',
                }}
              >
                ✕
              </button>
            </div>

            {/* ⭐ v5.0：地点信息卡 - inset shadow + 增强 padding */}
            <div
              style={{
                marginBottom: 10,
                padding: '11px 13px',
                borderRadius: 12,
                background:
                  'linear-gradient(135deg, rgba(127, 220, 148, 0.1) 0%, rgba(127, 220, 148, 0.04) 100%)',
                border: '1px solid rgba(127, 220, 148, 0.18)',
                boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: -25,
                  right: -25,
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  background:
                    'radial-gradient(circle, rgba(127, 220, 148, 0.18) 0%, transparent 70%)',
                }}
              />
              <div style={{ position: 'relative' }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#fff',
                    marginBottom: 3,
                  }}
                >
                  📍 {name}
                </div>
                {address && (
                  <div
                    style={{
                      fontSize: 11,
                      color: 'rgba(255, 255, 255, 0.6)',
                      lineHeight: 1.4,
                    }}
                  >
                    {address}
                  </div>
                )}
                <div
                  style={{
                    fontSize: 10,
                    color: 'rgba(127, 220, 148, 0.6)',
                    marginTop: 5,
                    fontFamily: 'monospace',
                  }}
                >
                  {lat.toFixed(6)}, {lng.toFixed(6)}
                </div>
              </div>
            </div>

            {/* ⭐ v14.0：方案 A - 用户主动授权二级对话框
              用户点 APP 选项后不立即跳转，显示“授权”对话框让用户明确授权
              iOS Safari 黑名单状态下，给用户明确反馈 + 让用户主动决定 */}
            {pendingAuth ? (
              <div
                key="pending-auth"
                style={{
                  padding: '14px 4px',
                  animation: 'slideUp 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
              >
                {/* APP 大图标 */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    marginBottom: 10,
                  }}
                >
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 16,
                      background: pendingAuth.recommended
                        ? 'linear-gradient(135deg, rgba(127, 220, 148, 0.4) 0%, rgba(127, 220, 148, 0.15) 100%)'
                        : 'linear-gradient(135deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.04) 100%)',
                      border: pendingAuth.recommended
                        ? '1.5px solid rgba(127, 220, 148, 0.5)'
                        : '1px solid rgba(255, 255, 255, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 28,
                      boxShadow: pendingAuth.recommended
                        ? '0 6px 24px rgba(127, 220, 148, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                        : 'inset 0 1px 0 rgba(255, 255, 255, 0.08)',
                    }}
                  >
                    {pendingAuth.icon}
                  </div>
                </div>

                {/* 标题：即将打开 XXX */}
                <div
                  style={{
                    textAlign: 'center',
                    fontSize: 15,
                    fontWeight: 700,
                    color: '#fff',
                    marginBottom: 4,
                    letterSpacing: '-0.2px',
                  }}
                >
                  即将打开「{pendingAuth.label}」
                </div>
                <div
                  style={{
                    textAlign: 'center',
                    fontSize: 11,
                    color: 'rgba(255, 255, 255, 0.55)',
                    marginBottom: 12,
                  }}
                >
                  {MODE_LABELS[mode]}导航 · 终点：{name}
                </div>

                {/* iOS Safari 黑名单警告 */}
                {platform === 'ios' && (
                  <div
                    style={{
                      padding: '10px 12px',
                      borderRadius: 10,
                      background: 'rgba(255, 180, 60, 0.08)',
                      border: '1px solid rgba(255, 180, 60, 0.22)',
                      marginBottom: 14,
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8,
                    }}
                  >
                    <span style={{ fontSize: 14, flexShrink: 0 }}>⚠️</span>
                    <div style={{ fontSize: 10, color: 'rgba(255, 220, 160, 0.85)', lineHeight: 1.5 }}>
                      iOS Safari 调起 APP 经常被系统拦截。
                      <br />
                      最稳的方法是复制指令 → 粘到 Safari 地址栏。
                    </div>
                  </div>
                )}

                {/* ⭐ v15.0：核心按钮 - 复制地址栏指令 */}
                <button
                  type="button"
                  onClick={() => handleCopyScheme(pendingAuth)}
                  style={{
                    width: '100%',
                    padding: '14px',
                    borderRadius: 12,
                    background: copied
                      ? 'linear-gradient(135deg, rgba(127, 220, 148, 0.45) 0%, rgba(127, 220, 148, 0.25) 100%)'
                      : 'linear-gradient(135deg, #fbbf24 0%, #4a9d65 100%)',
                    border: '1px solid rgba(127, 220, 148, 0.6)',
                    color: '#0a0f0d',
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: copied
                      ? '0 4px 16px rgba(127, 220, 148, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.3)'
                      : '0 4px 16px rgba(127, 220, 148, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
                    transition: 'all 0.15s',
                    marginBottom: 12,
                  }}
                >
                  {copied ? '✓ 已复制到剪贴板' : '📋 复制地址栏指令'}
                </button>

                {/* ⭐ v15.0：步骤提示 - 教用户粘到 Safari 地址栏 */}
                {platform === 'ios' && (
                  <div
                    style={{
                      padding: '10px 12px',
                      borderRadius: 10,
                      background: 'rgba(127, 220, 148, 0.06)',
                      border: '1px solid rgba(127, 220, 148, 0.18)',
                      marginBottom: 10,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        color: 'rgba(127, 220, 148, 0.85)',
                        fontWeight: 700,
                        marginBottom: 6,
                      }}
                    >
                      接下来操作：
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: 'rgba(255, 255, 255, 0.7)',
                        lineHeight: 1.6,
                      }}
                    >
                      ① 打开 <strong style={{ color: '#fbbf24' }}>Safari</strong> 浏览器
                      <br />
                      ② 长按地址栏 → <strong style={{ color: '#fbbf24' }}>粘贴</strong>
                      <br />
                      ③ 点「前往」→ {pendingAuth.label} 自动打开
                    </div>
                  </div>
                )}

                {/* ⭐ v15.0：网页版备选（保留 v13.0 兜底逻辑） */}
                <button
                  type="button"
                  onClick={() => handleConfirmAuth(pendingAuth)}
                  style={{
                    width: '100%',
                    padding: '11px',
                    borderRadius: 11,
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: 'rgba(255, 255, 255, 0.8)',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    marginBottom: 8,
                  }}
                >
                  🌐 直接用网页版
                </button>

                {/* 取消按钮 */}
                <button
                  type="button"
                  onClick={handleCancelAuth}
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: 10,
                    background: 'transparent',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: 'rgba(255, 255, 255, 0.5)',
                    cursor: 'pointer',
                    fontSize: 11,
                  }}
                >
                  取消
                </button>

                {/* 返回提示 */}
                <div
                  style={{
                    textAlign: 'center',
                    marginTop: 10,
                    fontSize: 10,
                    color: 'rgba(255, 255, 255, 0.3)',
                  }}
                >
                  点取消可重新选择其他 APP
                </div>
              </div>
            ) : (
              <>
                {/* ⭐ v13.0：豆包建议 + 位置修正 - "网页版导航"作为主推荐
                  iOS Safari 黑名单 / 微信拦截 / APP 未装 / iOS 17.4+ Scheme 限制
                  → 最可靠选项放在最顶部，带"推荐"徽章 */}
                {isMobile && (
              <a
                href={options.find((o) => o.key === 'gaode')?.url}
                target="_self"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '14px 16px',
                  borderRadius: 14,
                  background:
                    'linear-gradient(135deg, rgba(127, 220, 148, 0.3) 0%, rgba(127, 220, 148, 0.15) 100%)',
                  border: '1.5px solid rgba(127, 220, 148, 0.6)',
                  color: '#0a0f0d',
                  fontSize: 14,
                  fontWeight: 700,
                  textDecoration: 'none',
                  cursor: 'pointer',
                  boxShadow:
                    '0 4px 16px rgba(127, 220, 148, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
                  position: 'relative',
                  marginBottom: 14,
                }}
                onMouseEnter={(e) => {
                  ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'
                  ;(e.currentTarget as HTMLElement).style.boxShadow =
                    '0 6px 24px rgba(127, 220, 148, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.4)'
                }}
                onMouseLeave={(e) => {
                  ;(e.currentTarget as HTMLElement).style.transform = 'translateY(0)'
                  ;(e.currentTarget as HTMLElement).style.boxShadow =
                    '0 4px 16px rgba(127, 220, 148, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.3)'
                }}
              >
                <span style={{ fontSize: 17 }}>🌐</span>
                <span>网页版导航</span>
                <span
                  style={{
                    position: 'absolute',
                    top: -8,
                    right: 10,
                    fontSize: 9,
                    padding: '2px 8px',
                    borderRadius: 6,
                    background: 'linear-gradient(135deg, #fbbf24 0%, #4a9d65 100%)',
                    color: '#0a0f0d',
                    fontWeight: 800,
                    letterSpacing: '0.5px',
                    boxShadow: '0 2px 8px rgba(127, 220, 148, 0.4)',
                  }}
                >
                  推荐
                </span>
              </a>
            )}

            {/* 分隔线：网页版 → APP 选项 */}
            {isMobile && (
              <div
                style={{
                  marginBottom: 10,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <div style={{ flex: 1, height: 1, background: 'rgba(255, 255, 255, 0.08)' }} />
                <span
                  style={{
                    fontSize: 10,
                    color: 'rgba(255, 255, 255, 0.4)',
                    letterSpacing: '0.5px',
                  }}
                >
                  或选择地图 APP（可能打不开）
                </span>
                <div style={{ flex: 1, height: 1, background: 'rgba(255, 255, 255, 0.08)' }} />
              </div>
            )}

            {/* ⭐ v5.0：地图选项 - 多层 boxShadow + 推荐项 glow */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {sortedOptions.map((opt) => {
                // ⭐ v8.0：mobile + scheme → <a href> 让 Safari 原生处理 scheme
                // 这是 iOS 调起 app 的标准姿势，比 iframe/window.location 都可靠
                const useAnchor = isMobile && !!opt.scheme

                // 共享子节点（<a> 和 <button> 都用）
                const optionChildren = (
                  <>
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 10,
                        background: opt.recommended
                          ? 'linear-gradient(135deg, rgba(127, 220, 148, 0.5) 0%, rgba(127, 220, 148, 0.25) 100%)'
                          : 'rgba(255, 255, 255, 0.08)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 17,
                        flexShrink: 0,
                        boxShadow: opt.recommended
                          ? '0 4px 16px rgba(127, 220, 148, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
                          : 'inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                      }}
                    >
                      {opt.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{opt.label}</span>
                        {opt.badge && (
                          <span
                            style={{
                              fontSize: 9,
                              padding: '2px 7px',
                              borderRadius: 6,
                              background:
                                'linear-gradient(135deg, #fbbf24 0%, #4a9d65 100%)',
                              color: '#0a0f0d',
                              fontWeight: 800,
                              letterSpacing: '0.3px',
                              boxShadow:
                                '0 2px 8px rgba(127, 220, 148, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
                            }}
                          >
                            {opt.badge}
                          </span>
                        )}
                      </div>
                      {opt.description && (
                        <div
                          style={{
                            fontSize: 10,
                            color: 'rgba(255, 255, 255, 0.55)',
                            marginTop: 2,
                          }}
                        >
                          {opt.description}
                        </div>
                      )}
                    </div>
                    <span
                      style={{
                        color: 'rgba(127, 220, 148, 0.6)',
                        fontSize: 16,
                        flexShrink: 0,
                      }}
                    >
                      ›
                    </span>
                  </>
                )

                // 共享样式 + hover 行为
                const optionStyle: React.CSSProperties = {
                  display: 'flex',
                  alignItems: 'center',
                  gap: 11,
                  padding: '11px 13px',
                  borderRadius: 12,
                  width: '100%',
                  background: opt.recommended
                    ? 'linear-gradient(135deg, rgba(127, 220, 148, 0.22) 0%, rgba(127, 220, 148, 0.08) 100%)'
                    : 'linear-gradient(180deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.02) 100%)',
                  border: opt.recommended
                    ? '1.5px solid rgba(127, 220, 148, 0.5)'
                    : '1px solid rgba(255, 255, 255, 0.08)',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: 13,
                  textAlign: 'left',
                  boxShadow: opt.recommended
                    ? '0 0 24px rgba(127, 220, 148, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                    : 'inset 0 1px 0 rgba(255, 255, 255, 0.03)',
                  transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  position: 'relative',
                }

                const onOptionEnter = (e: React.MouseEvent<HTMLElement>) => {
                  if (opt.recommended) {
                    ;(e.currentTarget as HTMLElement).style.boxShadow =
                      '0 0 32px rgba(127, 220, 148, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
                  } else {
                    ;(e.currentTarget as HTMLElement).style.boxShadow =
                      'inset 0 1px 0 rgba(255, 255, 255, 0.08)'
                  }
                  ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'
                }
                const onOptionLeave = (e: React.MouseEvent<HTMLElement>) => {
                  if (opt.recommended) {
                    ;(e.currentTarget as HTMLElement).style.boxShadow =
                      '0 0 24px rgba(127, 220, 148, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                  } else {
                    ;(e.currentTarget as HTMLElement).style.boxShadow =
                      'inset 0 1px 0 rgba(255, 255, 255, 0.03)'
                  }
                  ;(e.currentTarget as HTMLElement).style.transform = 'translateY(0)'
                }

                // ⭐ v11.0：改用 button（统一所有平台都是 button）
                // 原因：v8/v9/v10 都试过 anchor + scheme，但 Safari 有静默拒绝问题
                // 改用 button + window.location.href 主动启动，避免 Safari 状态问题
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => handleOption(opt)}
                    onMouseEnter={onOptionEnter}
                    onMouseLeave={onOptionLeave}
                    style={optionStyle}
                  >
                    {optionChildren}
                  </button>
                )

                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => handleOption(opt)}
                    onMouseEnter={onOptionEnter}
                    onMouseLeave={onOptionLeave}
                    style={optionStyle}
                  >
                    {optionChildren}
                  </button>
                )
              })}
            </div>
              </>
            )}

            {/* ⭐ v5.0：底部品牌水印 */}
            <div
              style={{
                marginTop: 12,
                textAlign: 'center',
                fontSize: 9,
                color: 'rgba(255, 255, 255, 0.2)',
                letterSpacing: '0.3px',
              }}
            >
              由果小蔬 OS 提供 · 打开您设备的地图 App
            </div>

            {/* 取消按钮 */}
            <button
              onClick={() => setShowSheet(false)}
              style={{
                width: '100%',
                marginTop: 8,
                padding: '8px',
                borderRadius: 10,
                background: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: 'rgba(255, 255, 255, 0.6)',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 500,
              }}
            >
              取消
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}