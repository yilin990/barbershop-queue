import type { Metadata } from 'next'
import CASES from '@/data/hairstyle-cases.json'

/**
 * /cases/[id] 动态 OG meta · 段 235
 *
 * 每个案例有专属标题 / 描述 / 价格
 * generateMetadata 让 next.js 在 server 端读取 params.id
 */

interface HairstyleCase {
  id: string
  name: string
  tagline: string
  description: string
  price_range: string
  duration_min: number
  gender: 'male' | 'female' | 'unisex'
}

const CASES_TYPED = CASES as HairstyleCase[]

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params
  const c = CASES_TYPED.find(c => c.id === id)

  if (!c) {
    return {
      title: '案例未找到',
      description: '该案例可能已下线。',
    }
  }

  const title = `${c.name} · ${c.tagline}`
  const description = `${c.description} 参考价 ${c.price_range}，用时 ${c.duration_min} 分钟。`
  const ogImage = `/og-cases-${c.id}.png`

  return {
    title,
    description,
    openGraph: {
      type: 'article',
      locale: 'zh_CN',
      url: `/cases/${c.id}`,
      siteName: 'AI 找发型',
      title,
      description,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: c.name,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  }
}

export default function CaseDetailLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}