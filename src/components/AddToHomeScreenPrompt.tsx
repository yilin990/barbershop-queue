'use client';

import React, { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

const DISMISSED_KEY = 'zhilin-pwa-dismissed';
const VISIT_COUNT_KEY = 'zhilin-pwa-visits';
const COOKIE_DAYS = 30; // 30 天冷却
const MIN_VISIT_TRIGGER = 2; // 第二次访问才提示

/**
 * 智能引导用户从网页添加到 PWA（桌面图标）
 *
 * 核心逻辑:
 * 1. iOS Safari: 用说明式引导（分享按钮 → 添加到主屏幕）
 * 2. Android Chrome: 监听原生 beforeinstallprompt 事件，自动用 One-tap 安装
 * 3. 触发条件: 第二次访问后 + 用户已停留 5 秒 + 30 天内不重复弹
 * 4. 关闭后 30 天内不再提示
 */
export default function AddToHomeScreenPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'other'>('other');
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // 1. 检查是否已安装（PWA 独立窗口运行）
    if (window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true) {
      setInstalled(true);
      return;
    }

    // 1.5 检测是否在 Android WebView 内（即已经在 APK 里打开了）→ 不弹
    const ua = window.navigator.userAgent;
    const isInWebView = /; wv\)|WebView|wv\) /.test(ua);
    if (isInWebView) {
      return;
    }

    // 2. 30 天内关闭过 → 不再弹
    const dismissed = localStorage.getItem(DISMISSED_KEY);
    if (dismissed) {
      const dismissedAt = parseInt(dismissed, 10);
      const daysSince = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);
      if (daysSince < COOKIE_DAYS) return;
    }

    // 3. 访问次数计数（仅首次会话内有效）
    const visitCount = parseInt(localStorage.getItem(VISIT_COUNT_KEY) || '0', 10) + 1;
    localStorage.setItem(VISIT_COUNT_KEY, visitCount.toString());
    if (visitCount < MIN_VISIT_TRIGGER) return;

    // 4. 平台检测
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
    const isAndroid = /Android/.test(ua);

    if (isIOS) {
      setPlatform('ios');
    } else if (isAndroid) {
      setPlatform('android');
    } else {
      // 桌面或其他浏览器 → 不弹
      return;
    }

    // 5. Android: 监听原生事件（Chrome PWA 安装横幅 — 作为 PWA 备选）
    if (isAndroid) {
      const handler = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e as BeforeInstallPromptEvent);
      };
      window.addEventListener('beforeinstallprompt', handler);
      // 5 秒后弹（让用户先浏览页面）
      setTimeout(() => setShowPrompt(true), 5000);
      return () => window.removeEventListener('beforeinstallprompt', handler);
    }

    // 6. iOS: 5 秒延迟弹
    setTimeout(() => setShowPrompt(true), 5000);
  }, []);

  const handleInstall = async () => {
    if (platform === 'android' && deferredPrompt) {
      // Android 原生 One-tap 安装
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setInstalled(true);
      }
      setShowPrompt(false);
    }
    // iOS 没有原生 API，引导用户手动操作
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, Date.now().toString());
    setShowPrompt(false);
  };

  if (installed || !showPrompt) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'linear-gradient(180deg, rgba(10, 15, 13, 0.97) 0%, rgba(13, 31, 23, 0.97) 100%)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(184, 134, 11, 0.25)',
        boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.5)',
        padding: '16px 18px calc(16px + env(safe-area-inset-bottom, 0px)) 18px',
        zIndex: 9999,
        animation: 'qinghe-pwa-slide-up 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}
      role="dialog"
      aria-labelledby="pwa-prompt-title"
    >
      <style>{`
        @keyframes qinghe-pwa-slide-up {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {/* App icon */}
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: 'linear-gradient(135deg, #b8860b 0%, #4a9d65 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 4px 12px rgba(184, 134, 11, 0.3)',
          }}
        >
          <span style={{ fontSize: 26 }}>🌿</span>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <h3
            id="pwa-prompt-title"
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 700,
              color: '#fffaf0',
              letterSpacing: -0.2,
            }}
          >
            添加到桌面 · 秒开造型师助手
          </h3>
          <p
            style={{
              margin: '4px 0 0 0',
              fontSize: 12.5,
              color: 'rgba(220, 240, 230, 0.7)',
              lineHeight: 1.5,
            }}
          >
            {platform === 'ios'
              ? `点底部分享 → 添加到主屏幕，下一次像 App 一样直接打开`
              : '下载造型师助手 App 安装包（70KB），像 App 一样独立打开'}
          </p>
        </div>

        <button
          onClick={handleDismiss}
          aria-label="关闭"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'rgba(220, 240, 230, 0.5)',
            fontSize: 22,
            cursor: 'pointer',
            padding: 0,
            width: 28,
            height: 28,
            flexShrink: 0,
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>

      {/* iOS 详细步骤图示 */}
      {platform === 'ios' && (
        <div
          style={{
            marginTop: 14,
            padding: '12px 14px',
            background: 'rgba(184, 134, 11, 0.08)',
            borderRadius: 10,
            border: '1px solid rgba(184, 134, 11, 0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 18, flexShrink: 0 }}>
            <span>📱</span>
          </div>
          <div
            style={{
              fontSize: 11.5,
              color: 'rgba(220, 240, 230, 0.85)',
              lineHeight: 1.6,
            }}
          >
            <strong style={{ color: '#b8860b' }}>iOS 步骤：</strong>
            ① 点底部
            <ShareIcon />
            分享 　② 选「添加到主屏幕」
            <HomeIcon />
            　③ 点「添加」
          </div>
        </div>
      )}

      {/* Android: APK 下载按钮（主推） */}
      {platform === 'android' && (
        <div
          style={{
            display: 'flex',
            gap: 8,
            marginTop: 14,
            flexWrap: 'wrap',
          }}
        >
          <a
            href="/zhilin.apk"
            download="zhilin-pharmacy.apk"
            onClick={handleInstall}
            style={{
              flex: 1,
              minWidth: 160,
              background: 'linear-gradient(135deg, #b8860b 0%, #4a9d65 100%)',
              border: 'none',
              borderRadius: 10,
              padding: '12px 16px',
              color: '#2c1810',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(184, 134, 11, 0.3)',
              letterSpacing: 0.2,
              textAlign: 'center',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <span style={{ fontSize: 16 }}>📦</span>
            <span>下载 APK 安装包（70KB）</span>
          </a>
          {deferredPrompt && (
            <button
              onClick={handleInstall}
              style={{
                flex: 0,
                minWidth: 100,
                background: 'rgba(184, 134, 11, 0.1)',
                border: '1px solid rgba(184, 134, 11, 0.25)',
                borderRadius: 10,
                padding: '12px 14px',
                color: 'rgba(220, 240, 230, 0.85)',
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
              }}
              title="用 PWA 模式添加到主屏幕（不用装 APK）"
            >
              PWA 模式
            </button>
          )}
          <button
            onClick={handleDismiss}
            style={{
              flex: 0,
              minWidth: 64,
              background: 'transparent',
              border: '1px solid rgba(184, 134, 11, 0.15)',
              borderRadius: 10,
              padding: '12px 14px',
              color: 'rgba(220, 240, 230, 0.6)',
              fontSize: 12.5,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            稍后
          </button>
        </div>
      )}

      {/* iOS: 分享到主屏幕（不变） */}
      {platform === 'ios' && (
        <div
          style={{
            display: 'flex',
            gap: 8,
            marginTop: 14,
          }}
        >
          <button
            onClick={handleInstall}
            style={{
              flex: 1,
              background: 'linear-gradient(135deg, #b8860b 0%, #4a9d65 100%)',
              border: 'none',
              borderRadius: 10,
              padding: '12px 16px',
              color: '#2c1810',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(184, 134, 11, 0.3)',
              letterSpacing: 0.2,
            }}
          >
            📱 我知道了
          </button>
          <button
            onClick={handleDismiss}
            style={{
              flex: 0,
              minWidth: 80,
              background: 'rgba(184, 134, 11, 0.1)',
              border: '1px solid rgba(184, 134, 11, 0.2)',
              borderRadius: 10,
              padding: '12px 16px',
              color: 'rgba(220, 240, 230, 0.85)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            稍后
          </button>
        </div>
      )}
    </div>
  );
}

function ShareIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    >
      <path
        d="M12 2L12 14M12 2L8 6M12 2L16 6M4 14v6a2 2 0 002 2h12a2 2 0 002-2v-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    >
      <path
        d="M3 12l9-9 9 9M5 10v10a2 2 0 002 2h10a2 2 0 002-2V10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
