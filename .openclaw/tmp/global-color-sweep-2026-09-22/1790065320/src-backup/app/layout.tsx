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
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js').then(
                    (reg) => console.log('[PWA] SW registered:', reg.scope),
                    (err) => console.warn('[PWA] SW failed:', err)
                  );
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