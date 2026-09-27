import { Metadata } from 'next'
import { BUSINESS_CONFIG } from '@/config/business.config'

export const metadata: Metadata = {
  title: `风格库 · 您的造型灵感 | ${BUSINESS_CONFIG.name}`,
  description: `${BUSINESS_CONFIG.name} - 造型 AI 助手，根据脸型与发质推荐发型、染发配色、风格史追踪、就近门店。`,
  keywords: ['风格库', '造型AI', '发型推荐', '染发配色', '脸型推荐', '铜仁', '造型师助手', '专属造型顾问'],
  openGraph: {
    title: `风格库 · 您的造型灵感`,
    description: '造型 AI 助手 · 根据脸型推荐发型 · 染发配色建议 · 发型史追踪 · 24小时在线',
    type: 'website',
    locale: 'zh_CN',
  },
}

export default function PharmacistLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
