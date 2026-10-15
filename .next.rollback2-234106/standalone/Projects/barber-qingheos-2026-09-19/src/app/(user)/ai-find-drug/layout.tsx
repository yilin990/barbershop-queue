import type { Metadata } from 'next'

/**
 * /ai-find-drug/* 默认 OG meta · 段 235
 *
 * 覆盖 4 个独立路由（cases / care / products / demo）
 * 每个子页面可以通过 export const metadata 覆盖
 */

export const metadata: Metadata = {
  title: 'AI 找发型 · 造型助手',
  description: '说需求，造型助手帮你选风格。对话式挑选，24h 在线，到店可沟通。',
  keywords: ['发型', '造型', '造型师', '染发', '烫发', '护发', '案例库', 'AI 推荐'],
  authors: [{ name: '造型助手' }],
  creator: '造型助手',
  publisher: '造型助手',
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    url: '/ai-find-drug',
    siteName: 'AI 找发型',
    title: 'AI 找发型 · 造型助手',
    description: '说需求，造型助手帮你选风格。15 款精选造型，男女皆备。',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'AI 找发型',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI 找发型 · 造型助手',
    description: '说需求，造型助手帮你选风格。',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function AIFindDrugLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}