import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir, access } from 'fs/promises'
import { join } from 'path'

export const runtime = 'nodejs'

/**
 * /api/ai/activity-image
 *
 * 奕霖 2026-08-05 20:20 + 21:29 升级：
 * - 根据活动标题关键词自动选色（双十二/新年/秒杀/清凉 等）
 * - 更丰富的视觉元素（图标+副标+角标+花纹）
 * - 降级 SVG 永不出错
 *
 * body: { title: string, subtitle?: string, style?: 'auto' | 'warm' | 'cool' | 'fresh' | 'festive' | 'cool_blue' }
 */

interface StyleOption {
  name: string
  c1: string
  c2: string
  c3: string
  emoji: string
  tag: string
  tagColor: string
}

const STYLES: Record<string, StyleOption> = {
  warm: { name: '暖阳金', c1: '#c1272d', c2: '#d35400', c3: '#f39c12', emoji: '☀', tag: 'HOT', tagColor: '#fff' },
  cool: { name: '清凉蓝', c1: '#1e3a8a', c2: '#0ea5e9', c3: '#06b6d4', emoji: '❄', tag: 'NEW', tagColor: '#fff' },
  fresh: { name: '清新绿', c1: '#059669', c2: '#10b981', c3: '#34d399', emoji: '🌿', tag: '限时', tagColor: '#fff' },
  festive: { name: '节日红', c1: '#be123c', c2: '#e11d48', c3: '#fb7185', emoji: '🎉', tag: '节日', tagColor: '#fff' },
  cool_blue: { name: '商务蓝', c1: '#1e40af', c2: '#3b82f6', c3: '#60a5fa', emoji: '💎', tag: 'VIP', tagColor: '#fff' },
}

function autoPickStyle(title: string, subtitle: string): StyleOption {
  const t = (title + subtitle).toLowerCase()
  if (t.includes('新') && (t.includes('年') || t.includes('春') || t.includes('节'))) return STYLES.festive
  if (t.includes('秒杀') || t.includes('闪购') || t.includes('急')) return STYLES.warm
  if (t.includes('清') || t.includes('凉') || t.includes('夏') || t.includes('冰')) return STYLES.cool
  if (t.includes('折') || t.includes('满') || t.includes('减') || t.includes('惠')) return STYLES.warm
  if (t.includes('新客') || t.includes('注册') || t.includes('会员')) return STYLES.cool_blue
  if (t.includes('vip') || t.includes('高端') || t.includes('尊享')) return STYLES.cool_blue
  return STYLES.fresh
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function generateSVG(title: string, subtitle: string, style: StyleOption, id: string): string {
  // title 渲染（按宽度自动换行，限制 1-2 行）
  const safeTitle = escapeXml(title.slice(0, 20))
  const safeSubtitle = subtitle ? escapeXml(subtitle.slice(0, 25)) : ''

  // 装饰花纹（随机选）
  const decorations = [
    `<circle cx='850' cy='120' r='180' fill='rgba(255,255,255,0.08)'/>`,
    `<circle cx='150' cy='400' r='120' fill='rgba(255,255,255,0.06)'/>`,
    `<polygon points='780,80 800,30 820,80 800,130' fill='rgba(255,255,255,0.1)'/>`,
    `<rect x='50' y='200' width='40' height='40' rx='8' fill='rgba(255,255,255,0.08)' transform='rotate(15 70 220)'/>`,
  ]
  const deco = decorations[Math.floor(Math.random() * decorations.length)]

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 512" width="1024" height="512">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${style.c1}"/>
      <stop offset="50%" stop-color="${style.c2}"/>
      <stop offset="100%" stop-color="${style.c3}"/>
    </linearGradient>
    <radialGradient id="r" cx="20%" cy="30%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.4)"/>
      <stop offset="100%" stop-color="transparent"/>
    </radialGradient>
  </defs>
  <rect width="1024" height="512" fill="url(#g)"/>
  <rect width="1024" height="512" fill="url(#r)"/>
  ${deco}
  <rect x='40' y='40' width='100' height='32' rx='16' fill='rgba(255,255,255,0.2)' stroke='rgba(255,255,255,0.4)' stroke-width='1'/>
  <text x='90' y='62' text-anchor='middle' font-family='sans-serif' font-size='16' font-weight='700' fill='${style.tagColor}'>${style.tag}</text>
  <text x='150' y='62' font-family='sans-serif' font-size='14' fill='rgba(255,255,255,0.85)'>${style.emoji} ${style.name}</text>
  <text x='40' y='180' font-family='sans-serif' font-size='14' letter-spacing='3' fill='rgba(255,255,255,0.7)'>PROMOTION</text>
  <text x='40' y='250' font-family='sans-serif' font-size='56' font-weight='900' fill='#ffffff' style='text-shadow: 2px 2px 8px rgba(0,0,0,0.3)'>${safeTitle}</text>
  ${safeSubtitle ? `<text x='40' y='310' font-family='sans-serif' font-size='24' font-weight='500' fill='rgba(255,255,255,0.85)'>${safeSubtitle}</text>` : ''}
  <rect x='40' y='380' width='180' height='60' rx='30' fill='rgba(255,255,255,0.95)'/>
  <text x='130' y='418' text-anchor='middle' font-family='sans-serif' font-size='24' font-weight='800' fill='${style.c1}'>立即查看 →</text>
  <circle cx='950' cy='460' r='40' fill='rgba(255,255,255,0.15)'/>
  <text x='950' y='470' text-anchor='middle' font-family='sans-serif' font-size='32' fill='rgba(255,255,255,0.4)'>${style.emoji}</text>
</svg>`
}

import { writeFileSync, existsSync, mkdirSync } from 'fs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const title = String(body.title || '活动').slice(0, 20)
    const subtitle = String(body.subtitle || '').slice(0, 25)
    const styleKey = body.style && STYLES[body.style as string] ? body.style : 'auto'
    const style = styleKey === 'auto' ? autoPickStyle(title, subtitle) : STYLES[styleKey as string]

    const id = `ai_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const svg = generateSVG(title, subtitle, style, id)

    const dir = join(process.cwd(), 'public', 'ai-covers')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, `${id}.svg`), svg, 'utf-8')

    return NextResponse.json({
      success: true,
      url: `/ai-covers/${id}.svg`,
      style: style.name,
      styleKey: Object.keys(STYLES).find(k => STYLES[k] === style),
      message: `已生成「${style.name}」风格封面图`
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || '生成失败' }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
