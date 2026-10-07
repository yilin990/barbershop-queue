export const dynamic = "force-dynamic"

import { BUSINESS_CONFIG } from '@/config/business.config';
import { ConfigProvider } from '@/config/ConfigProvider';

import './globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#faf6f0',  // ⭐ 2026-09-20 01:42 奕霖拍板：全局改暖米
};

export const metadata: Metadata = {
  title: `${BUSINESS_CONFIG.name} - ${BUSINESS_CONFIG.slogan}`,
  description: BUSINESS_CONFIG.description,
  applicationName: BUSINESS_CONFIG.name,
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: BUSINESS_CONFIG.name,
  },
  formatDetection: {
    telephone: true,
  },
  icons: {
    icon: BUSINESS_CONFIG.assets.favicon,
    apple: '/apple-touch-icon.png',
  },
  manifest: '/manifest.json',
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
    'apple-mobile-web-app-title': BUSINESS_CONFIG.name,
    'theme-color': '#faf6f0',  // ⭐ 2026-09-20 01:42 奕霖拍板：全局改暖米
    'msapplication-TileColor': '#0a0f0d',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <head>
        {/* ⭐ 2026-09-22 18:05 奕霖拍板方案A：barber 复古字体 — Alfa Slab One + Rye + Noto Serif SC
         * ⭐ 2026-10-08 00:05 清禾：改为本机系统字体，不再拉 Google Fonts 外链
         * 实测数据：Noto Serif SC 4 个字重的 CSS 本身就有 452,936 字节 / 404 条 @font-face，
         * 而 <link rel="stylesheet"> 是阻塞渲染的 —— 手机弱网下光解析它就几秒，
         * 直接表现成「换个设备就打不开 / 一直转圈」。
         * 各处 font-family 已经写了本地兜底（'Songti SC', Georgia, serif），
         * 删掉外链后自动落到系统衬线字体，复古感保留、速度天差地别。
         * 👉 想恢复复古招牌字体：我可以自托管子集（不拉 442KB CSS），说一声就做。
         */}

        {/* PWA Manifest */}
        <link rel="manifest" href="/manifest.json" />

        {/* iOS Apple Touch Icon */}
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />

        {/* iOS Splash Screens（让启动像 App）*/}
        <link
          rel="apple-touch-startup-image"
          href="/apple-touch-icon.png"
        />

        {/* Service Worker 注册 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // ⭐ 2026-09-30 奕霖: PWA service worker 临时禁用 — 缓存导致代码改完浏览器看不到新内容
              // 改回: 把下面 navigator.serviceWorker.register('/sw.js') 取消注释
              if (false && 'serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js').then(
                    (reg) => console.log('[PWA] SW registered:', reg.scope),
                    (err) => console.warn('[PWA] SW failed:', err)
                  );
                });
              }
              // ⭐ 2026-09-30 主动 unregister 已注册的 SW，让旧缓存失效
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then((regs) => {
                  regs.forEach((reg) => reg.unregister());
                });
              }
            `,
          }}
        />
      </head>
      <body>
        <ConfigProvider>{children}</ConfigProvider>
      </body>
    </html>
  );
}