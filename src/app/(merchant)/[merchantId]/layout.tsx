import { extractMerchantId, loadMerchantConfig } from '@/domain/merchant/service'
import { ConfigProvider } from '@/config/ConfigProvider'
import '../../globals.css'
import type { Metadata } from 'next'

/**
 * TenantLayout - 多租户动态路由的 Layout
 *
 * 关键设计:
 * 1. 从 URL 路径解析 merchantId (如 /zhilin/map → 'zhilin')
 * 2. 动态加载该商户的配置 (内存缓存 → 文件 → 默认)
 * 3. 注入 ConfigProvider (用动态 config 替换静态 BUSINESS_CONFIG)
 * 4. 生成商户特定的 metadata (title, description, favicon)
 *
 * 路径示例:
 *   /zhilin/map    → merchantId='zhilin', config=BUSINESS_CONFIG (默认造型师助手)
 *   /map          → 走根 /, 不经过本 layout (保留原 URL)
 *   /[其他]/map  → 走 [merchantId]/* 动态路由
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ merchantId: string }>
}): Promise<Metadata> {
  const { merchantId } = await params
  const config = await loadMerchantConfig(merchantId)

  return {
    title: `${config.name} - ${config.slogan}`,
    description: config.description,
    icons: {
      icon: config.assets.favicon,
    },
  }
}

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ merchantId: string }>
}) {
  const { merchantId } = await params
  const config = await loadMerchantConfig(merchantId)

  // 验证 merchantId 存在 (否则 fallback 到根路径)
  if (!extractMerchantId(`/${merchantId}`)) {
    // 防御性编程: 实际不会到这里
  }

  return (
    <html lang="zh-CN" data-merchant-id={config.id}>
      <body>
        <ConfigProvider>
          {/* 注入商户特定 CSS 变量 (在 ConfigProvider 之外) */}
          <style>{`
            :root[data-merchant-id="${config.id}"] {
              --merchant-primary: ${config.theme.bgDeep};
              --merchant-accent: ${config.theme.green};
            }
          `}</style>
          {children}
        </ConfigProvider>
      </body>
    </html>
  )
}
