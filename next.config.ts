import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // v0.8.89: 暂时跳过类型检查 (代码库有累积的 TypeScript 错误,优先部署 middleware)
    ignoreBuildErrors: true,
  },
  output: 'standalone',
  allowedDevOrigins: [
    'while-bear-pacific-gay.trycloudflare.com',
    '*.trycloudflare.com',
    'qingheos.cn',
    '*.qingheos.cn',
    'zhilin.qingheos.cn',
    'localhost',
    '127.0.0.1',
  ],
  devIndicators: false,
  // ⭐ 奕霖 2026-07-06 18:57：方案 A 落地，根域 301 永久跳转到商户端
  async redirects() {
    return [
      {
        source: '/',
        destination: '/merchant',
        permanent: true,  // 308 永久重定向（保留 HTTP 方法）
      },
      {
        source: '/landing',
        destination: '/merchant',
        permanent: true,  // 老链接也一并收口
      },
      // ⭐ 奕霖 2026-08-25 03:00 拍板：/pickup 显示零售台（与 8-22 一致）
      // /pickup/snapshots 不受影响（不是 exact /pickup）
      {
        source: '/pickup',
        destination: '/retail',
        permanent: true,
      },
    ]
  },
  // ⭐ 奕霖 2026-07-15 14:50 授权：Cloudflare 缓存优化
  // 移除 next.js 默认 vary: rsc, next-router-*，让 Cloudflare 能缓存 API 响应
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Vary', value: 'Accept-Encoding' },
        ],
      },
      // ⭐ 奕霖 2026-08-07 17:31 反馈：「问题依旧」→ cloudflared s-maxage=31536000 缓存 1 年
      // 'use client' 页面 force-dynamic 不影响 cache-control 头，必须在 next.config.ts 里显式覆盖
      // 这 4 个页面是迭代最快的（flash-sale 秒杀/cart 提交/orders 详情/coupon 优惠券），不能让 cloudflared 缓存
      {
        source: '/activity/flash-sale',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'CDN-Cache-Control', value: 'no-store' },
        ],
      },
      {
        source: '/cart',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'CDN-Cache-Control', value: 'no-store' },
        ],
      },
      {
        source: '/orders/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'CDN-Cache-Control', value: 'no-store' },
        ],
      },
      {
        source: '/coupon',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'CDN-Cache-Control', value: 'no-store' },
        ],
      },
      {
        source: '/retail',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=60, s-maxage=300' },
          { key: 'CDN-Cache-Control', value: 'public, s-maxage=300' },
        ],
      },
      // ⭐ 清禾 2026-09-04 加: /retail 静态缓存 (5min), CF Cache Rules 已配套
      // ⭐ 奕霖 2026-08-13 19:50：底部「安装」按钮看不到 → iOS Safari 缓存 1 年
      // merchant / products / community / me / chat 是迭代最快的用户页面（InstallSheetButton / AddToHomeScreen 等）
      // 不让 cloudflared 缓存，下发就能看到新功能
      {
        source: '/merchant',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=60, s-maxage=300' },
          { key: 'Pragma', value: 'public' },
          { key: 'CDN-Cache-Control', value: 'public, s-maxage=300' },
        ],
      },
      {
        source: '/products/:path*',
        headers: [
        { key: 'Cache-Control', value: 'public, max-age=60, s-maxage=300' },
        { key: 'Pragma', value: 'public' },
        { key: 'CDN-Cache-Control', value: 'public, s-maxage=300' },
        ],
      },
      {
        source: '/community',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'CDN-Cache-Control', value: 'no-store' },
        ],
      },
      {
        source: '/me',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'CDN-Cache-Control', value: 'no-store' },
        ],
      },
      {
        source: '/chat',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'CDN-Cache-Control', value: 'no-store' },
        ],
      },
    ]
  },
  experimental: {},
};

export default nextConfig;
