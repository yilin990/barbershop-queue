'use client';

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

/**
 * 底部折叠「📲 安装」按钮（常驻 FAB）
 *
 * - 默认状态：右下角小药丸按钮，悬浮在 BottomTabBar 上方
 * - 点击展开：底部抽屉（bottom sheet），显示完整安装路径
 *   - iOS: 分享 → 添加到主屏幕
 *   - Android: 下载 APK / PWA 模式备选
 *   - 通用: 二维码（让别的手机扫）
 * - 展开时背景全屏点击关闭
 * - 已安装（PWA standalone / 在 WebView 内）→ 不渲染
 *
 * 设计原则：
 * - 不与 BottomTabBar 冲突：FAB 浮在 tab bar 上方 70px + safe-area
 * - 不重复 AddToHomeScreenPrompt 的逻辑：本组件是「用户主动入口」，
 *   那个是「自动引导」
 * - 不打断阅读：默认仅 56×56 药丸，不占视觉焦点
 */
export default function InstallSheetButton() {
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'other'>('other');
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [hide, setHide] = useState(true); // 默认隐藏，检测完才显示
  const [qrSvg, setQrSvg] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const apkUrl = 'https://zhilin.qingheos.cn/zhilin.apk';
  const webUrl = 'https://zhilin.qingheos.cn';

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const ua = window.navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
    const isAndroid = /Android/.test(ua);

    // 1. 已安装 PWA（standalone 模式）→ 不显示
    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    ) {
      setHide(true);
      return;
    }

    // 2. 在 Android WebView 内（已经在 APK 里打开）→ 不显示
    const isInWebView = /; wv\)|WebView|wv\) /.test(ua);
    if (isInWebView) {
      setHide(true);
      return;
    }

    // 3. 桌面浏览器 / 其他 → 不显示（保持只在手机端）
    if (!isIOS && !isAndroid) {
      setHide(true);
      return;
    }

    if (isIOS) setPlatform('ios');
    else if (isAndroid) setPlatform('android');

    setHide(false); // 通过检测，显示 FAB

    // 4. Android: 监听 Chrome PWA 横幅事件
    if (isAndroid) {
      const handler = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e as BeforeInstallPromptEvent);
      };
      window.addEventListener('beforeinstallprompt', handler);
      return () => window.removeEventListener('beforeinstallprompt', handler);
    }
  }, []);

  // 展开时生成 QR code（仅生成一次）
  useEffect(() => {
    if (!open || qrSvg) return;
    import('qrcode').then((QRCode) => {
      QRCode.toString(apkUrl, {
        type: 'svg',
        margin: 1,
        width: 200,
        color: { dark: '#0a0f0d', light: '#ffffff' },
        errorCorrectionLevel: 'H',
      }).then((svg: string) => setQrSvg(svg));
    });
  }, [open, qrSvg]);

  const handlePwaInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
    }
    setOpen(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(apkUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  if (hide) return null;

  return (
    <>
      {/* 折叠按钮：右下角浮动药丸（BottomTabBar 上方） */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="安装果蔬鲜生"
          style={{
            position: 'fixed',
            right: 16,
            // BottomTabBar 高度 64 + safe-area 16 = 80px
            bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))',
            zIndex: 9000,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '10px 16px 10px 12px',
            background: 'linear-gradient(135deg, #fbbf24 0%, #4a9d65 100%)',
            color: '#0a0f0d',
            border: 'none',
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 6px 20px rgba(127, 220, 148, 0.45), 0 2px 6px rgba(0, 0, 0, 0.15)',
            letterSpacing: 0.2,
            transition: 'transform 0.15s, box-shadow 0.15s',
            // 防止 body 滚动
            touchAction: 'manipulation',
          }}
          onMouseDown={(e) => {
            e.currentTarget.style.transform = 'scale(0.96)';
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <span style={{ fontSize: 16 }}>📲</span>
          <span>安装</span>
        </button>
      )}

      {/* 展开：全屏背景蒙层 + 底部抽屉 */}
      {open && (
        <>
          {/* 背景蒙层（点击关闭） */}
          <div
            onClick={() => setOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(10, 15, 13, 0.6)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
              zIndex: 9990,
              animation: 'qinghe-fab-fade-in 0.2s ease',
            }}
          />

          {/* 底部抽屉 */}
          <div
            role="dialog"
            aria-labelledby="install-sheet-title"
            style={{
              position: 'fixed',
              left: 0,
              right: 0,
              bottom: 0,
              maxHeight: '85vh',
              background: 'linear-gradient(180deg, rgba(10, 15, 13, 0.98) 0%, rgba(13, 31, 23, 0.98) 100%)',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              borderTop: '1px solid rgba(127, 220, 148, 0.3)',
              boxShadow: '0 -12px 40px rgba(0, 0, 0, 0.5)',
              padding: '20px 18px calc(20px + env(safe-area-inset-bottom, 0px))',
              zIndex: 9995,
              overflowY: 'auto',
              animation: 'qinghe-fab-slide-up 0.32s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
          >
            <style>{`
              @keyframes qinghe-fab-fade-in {
                from { opacity: 0; }
                to { opacity: 1; }
              }
              @keyframes qinghe-fab-slide-up {
                from { transform: translateY(100%); }
                to { transform: translateY(0); }
              }
            `}</style>

            {/* 拖拽条 */}
            <div
              style={{
                width: 40,
                height: 4,
                background: 'rgba(127, 220, 148, 0.4)',
                borderRadius: 2,
                margin: '0 auto 16px',
              }}
            />

            {/* 标题 */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: 18,
              }}
            >
              <div>
                <h2
                  id="install-sheet-title"
                  style={{
                    margin: 0,
                    fontSize: 18,
                    fontWeight: 800,
                    color: '#f0fdf4',
                    letterSpacing: -0.4,
                  }}
                >
                  安装果蔬鲜生 App
                </h2>
                <p
                  style={{
                    margin: '4px 0 0',
                    fontSize: 12.5,
                    color: 'rgba(220, 240, 230, 0.65)',
                    lineHeight: 1.5,
                  }}
                >
                  {platform === 'ios'
                    ? 'iOS 用户：分享到主屏幕，像 App 一样秒开'
                    : 'Android 用户：下载 70KB 安装包，独立运行'}
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="关闭"
                style={{
                  background: 'rgba(127, 220, 148, 0.1)',
                  border: '1px solid rgba(127, 220, 148, 0.2)',
                  color: 'rgba(220, 240, 230, 0.8)',
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  fontSize: 18,
                  cursor: 'pointer',
                  lineHeight: 1,
                  flexShrink: 0,
                  marginLeft: 12,
                }}
              >
                ×
              </button>
            </div>

            {/* Android: 主推 APK 下载 */}
            {platform === 'android' && (
              <>
                <a
                  href={apkUrl}
                  download="zhilin-pharmacy.apk"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    padding: '16px 20px',
                    background: 'linear-gradient(135deg, #fbbf24 0%, #4a9d65 100%)',
                    color: '#0a0f0d',
                    border: 'none',
                    borderRadius: 14,
                    fontSize: 15,
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 6px 20px rgba(127, 220, 148, 0.4)',
                    textDecoration: 'none',
                    marginBottom: 12,
                  }}
                >
                  <span style={{ fontSize: 20 }}>📦</span>
                  <span>下载 APK 安装包（70KB）</span>
                </a>

                {deferredPrompt && (
                  <button
                    onClick={handlePwaInstall}
                    style={{
                      width: '100%',
                      padding: '14px 18px',
                      background: 'rgba(127, 220, 148, 0.1)',
                      border: '1px solid rgba(127, 220, 148, 0.25)',
                      borderRadius: 12,
                      color: '#e8f5ec',
                      fontSize: 13.5,
                      fontWeight: 600,
                      cursor: 'pointer',
                      marginBottom: 12,
                    }}
                  >
                    💡 或用 Chrome PWA 模式（不装 APK）
                  </button>
                )}
              </>
            )}

            {/* iOS: 引导步骤 */}
            {platform === 'ios' && (
              <div
                style={{
                  padding: '14px 16px',
                  background: 'rgba(127, 220, 148, 0.08)',
                  border: '1px solid rgba(127, 220, 148, 0.18)',
                  borderRadius: 12,
                  marginBottom: 12,
                }}
              >
                <div style={{ fontSize: 13, color: '#e8f5ec', lineHeight: 1.7 }}>
                  <div style={{ marginBottom: 8 }}>
                    <span style={{ color: '#fbbf24', fontWeight: 700 }}>① </span>
                    点 Safari 底部分享按钮 <ShareIcon />
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <span style={{ color: '#fbbf24', fontWeight: 700 }}>② </span>
                    滑到「添加到主屏幕」<HomeIcon />
                  </div>
                  <div>
                    <span style={{ color: '#fbbf24', fontWeight: 700 }}>③ </span>
                    点右上「添加」，桌面出现 🌿 图标
                  </div>
                </div>
              </div>
            )}

            {/* 通用：二维码 + 链接 */}
            <div
              style={{
                padding: '16px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(127, 220, 148, 0.15)',
                borderRadius: 14,
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                }}
              >
                {/* 二维码 */}
                <div
                  style={{
                    width: 100,
                    height: 100,
                    background: '#ffffff',
                    borderRadius: 8,
                    padding: 6,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {qrSvg ? (
                    <div
                      style={{ width: '100%', height: '100%' }}
                      dangerouslySetInnerHTML={{ __html: qrSvg }}
                    />
                  ) : (
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>QR</div>
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 12,
                      color: 'rgba(220, 240, 230, 0.7)',
                      marginBottom: 4,
                    }}
                  >
                    让别人扫码下载
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: '#fbbf24',
                      fontFamily: 'monospace',
                      wordBreak: 'break-all',
                      marginBottom: 8,
                      lineHeight: 1.4,
                    }}
                  >
                    {apkUrl}
                  </div>
                  <button
                    onClick={handleCopy}
                    style={{
                      padding: '6px 12px',
                      background: copied ? '#10b981' : 'rgba(127, 220, 148, 0.15)',
                      color: copied ? '#ffffff' : '#e8f5ec',
                      border: '1px solid rgba(127, 220, 148, 0.3)',
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {copied ? '✓ 已复制' : '🔗 复制链接'}
                  </button>
                </div>
              </div>
            </div>

            {/* 更新说明（奕霖关心的点） */}
            <div
              style={{
                padding: '10px 12px',
                background: 'rgba(127, 220, 148, 0.05)',
                border: '1px dashed rgba(127, 220, 148, 0.2)',
                borderRadius: 10,
                fontSize: 11.5,
                color: 'rgba(220, 240, 230, 0.7)',
                lineHeight: 1.6,
              }}
            >
              💡 <strong style={{ color: '#fbbf24' }}>自动更新：</strong>
              APK 装上后无需手动更新。每次打开果蔬鲜生，自动获取最新版本（Service Worker 后台静默升级）。
              只有「原生壳」改了（图标、新增原生能力）才需要重新下载 APK。
            </div>
          </div>
        </>
      )}
    </>
  );
}

function ShareIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      style={{ display: 'inline-block', verticalAlign: 'middle', marginLeft: 4 }}
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
      style={{ display: 'inline-block', verticalAlign: 'middle', marginLeft: 4 }}
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
