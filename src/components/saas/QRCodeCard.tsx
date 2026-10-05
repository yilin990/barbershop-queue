'use client';

/**
 * SaaS 通用底部 QR 组件
 *
 * 所有 SaaS 项目（造型师助手、未来、未来美容/餐饮/健身等）的标准底部元素：
 * - 小码 inline 缩略图（80x80）
 * - 点击放大 modal（320x320）
 * - 添加到主屏幕 3 步引导（按平台）
 * - URL 自动用当前页面（如要定制传 url prop）
 *
 * 配色：theme color 通过 prop 适配（默认 #b8860b 绿）
 *
 * 用法：
 *   <QRCodeCard />                                  // 默认绿色 + 当前页面
 *   <QRCodeCard theme="#ff6b35" />                  // 橙色（餐饮）
 *   <QRCodeCard url="https://xxx" theme="#c084fc" /> // 紫色（美容）
 */

import { useEffect, useState } from 'react';

type Platform = 'ios' | 'android' | 'wechat' | 'browser';

interface QRCodeCardProps {
  url?: string;
  title?: string;
  subtitle?: string;
  theme?: string;
  hint?: string;
  className?: string;
}

export default function QRCodeCard({
  url,
  title = '扫码访问本店',
  subtitle = '或长按识别二维码',
  theme = '#b8860b',
  hint,
  className,
}: QRCodeCardProps) {
  const [smallSvg, setSmallSvg] = useState<string>('');
  const [largeSvg, setLargeSvg] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [platform, setPlatform] = useState<Platform>('browser');
  const [targetUrl, setTargetUrl] = useState('');

  useEffect(() => {
    // v2 — 公网 URL 自动替换：本地/内网 → SaaS 公网（通用 SaaS 公网模板，让本地 QR 也指向 https://zhilin.qingheos.cn）
    const getPublicUrl = (): string => {
      if (typeof window === 'undefined') return '';
      if (url) return url;
      const { hostname, pathname, search } = window.location;
      const isLocal = hostname === 'localhost' || hostname === '127.0.0.1'
        || /^192\.168\./.test(hostname) || /^10\./.test(hostname);
      return isLocal ? `https://zhilin.qingheos.cn${pathname}${search}` : window.location.href;
    };
    const currentUrl = getPublicUrl();
    setTargetUrl(currentUrl);

    if (typeof window !== 'undefined') {
      const ua = window.navigator.userAgent;
      const isWechat = /MicroMessenger/i.test(ua);
      const isIOS = /iPad|iPhone|iPod/.test(ua);
      const isAndroid = /Android/i.test(ua);
      if (isWechat) setPlatform('wechat');
      else if (isIOS) setPlatform('ios');
      else if (isAndroid) setPlatform('android');
      else setPlatform('browser');
    }

    import('qrcode').then((QRCode) => {
      QRCode.toString(currentUrl, {
        type: 'svg',
        margin: 1,
        width: 80,
        color: { dark: '#2c1810', light: '#ffffff' },
        errorCorrectionLevel: 'M',
      }).then((svg: string) => setSmallSvg(svg));

      QRCode.toString(currentUrl, {
        type: 'svg',
        margin: 1,
        width: 220,
        color: { dark: '#2c1810', light: '#ffffff' },
        errorCorrectionLevel: 'H',
      }).then((svg: string) => setLargeSvg(svg));
    });
  }, [url]);

  const platformGuide: Record<Platform, { title: string; steps: string[] }> = {
    ios: {
      title: '🍎 iPhone 用户',
      steps: [
        '点底部分享按钮 ⤴',
        '选「添加到主屏幕」',
        '下次像 App 一样直接打开',
      ],
    },
    android: {
      title: '🤖 安卓用户',
      steps: [
        '点浏览器右上角菜单 ⋮',
        '选「添加到主屏幕」',
        '下次像 App 一样直接打开',
      ],
    },
    wechat: {
      title: '💬 微信用户',
      steps: [
        '长按图片识别二维码',
        '或在浏览器中打开链接',
        '加到主屏幕，下次秒开',
      ],
    },
    browser: {
      title: '💻 电脑用户',
      steps: [
        '用手机扫码打开',
        '或保存图片到相册',
        '微信扫一扫选相册图片',
      ],
    },
  };

  const guide = platformGuide[platform];

  return (
    <>
      <div
        onClick={() => setShowModal(true)}
        role="button"
        aria-label="点击查看二维码"
        className={className}
        style={{
          background: `linear-gradient(180deg, ${theme}1f 0%, ${theme}0a 100%)`,
          border: `1px solid ${theme}33`,
          borderRadius: 18,
          padding: 16,
          marginBottom: 16,
          boxShadow: `0 8px 32px rgba(0, 0, 0, 0.35), 0 0 0 1px ${theme}1a inset`,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          cursor: 'pointer',
          transition: 'transform 0.15s, box-shadow 0.15s, border-color 0.15s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.borderColor = `${theme}66`;
          e.currentTarget.style.boxShadow = `0 12px 36px ${theme}26, 0 0 0 1px ${theme}40 inset`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.borderColor = `${theme}33`;
          e.currentTarget.style.boxShadow = `0 8px 32px rgba(0, 0, 0, 0.35), 0 0 0 1px ${theme}1a inset`;
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            background: '#ffffff',
            borderRadius: 10,
            padding: 4,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {smallSvg ? (
            <div
              style={{ width: '100%', height: '100%' }}
              dangerouslySetInnerHTML={{ __html: smallSvg }}
            />
          ) : (
            <div style={{ fontSize: 10, color: '#9ca3af' }}>QR</div>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: '#fff',
              marginBottom: 4,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span style={{ fontSize: 16 }}>📲</span>
            <span>{title}</span>
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'rgba(255,255,255,0.7)',
              lineHeight: 1.5,
            }}
          >
            {subtitle} · 点击查看大图
          </div>
          <div
            style={{
              fontSize: 10,
              color: theme,
              fontFamily: 'monospace',
              marginTop: 4,
              wordBreak: 'break-all',
            }}
          >
            {targetUrl.replace(/^https?:\/\//, '').slice(0, 40)}
            {targetUrl.length > 47 ? '…' : ''}
          </div>
        </div>

        <div
          style={{
            color: theme,
            fontSize: 18,
            opacity: 0.6,
            flexShrink: 0,
          }}
        >
          →
        </div>
      </div>

      {showModal && (
              <div
                onClick={() => setShowModal(false)}
                style={{
                  position: 'fixed',
                  inset: 0,
                  background: 'rgba(0, 0, 0, 0.78)',
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 16,
                  paddingTop: 'max(40px, env(safe-area-inset-top, 40px))',
                  paddingBottom: 'calc(40px + env(safe-area-inset-bottom, 0px))',
                  zIndex: 1000,
                }}
              >
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    position: 'relative',
                    background: '#ffffff',
                    borderRadius: 20,
                    width: '100%',
                    maxWidth: 340,
                    padding: '32px 28px 28px',
                    boxShadow: '0 32px 80px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(0, 0, 0, 0.04)',
                    textAlign: 'center',
                  }}
                >
                  <button
                    onClick={() => setShowModal(false)}
                    aria-label="关闭"
                    style={{
                      position: 'absolute',
                      top: 14,
                      right: 14,
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: 'transparent',
                      border: 'none',
                      color: '#94a3b8',
                      fontSize: 20,
                      fontWeight: 300,
                      lineHeight: 1,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0, 0, 0, 0.05)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    ×
                  </button>

                  <div
                    style={{
                      width: 48,
                      height: 48,
                      margin: '0 auto 18px',
                      borderRadius: '50%',
                      background: theme + '14',
                      border: '1.5px solid ' + theme + '40',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <div
                      style={{
                        width: 16,
                        height: 16,
                        border: '2px solid ' + theme,
                        borderRadius: 3,
                        position: 'relative',
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          width: 10,
                          height: 1.5,
                          background: theme,
                          transform: 'translate(-50%, -50%)',
                        }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          width: 10,
                          height: 1.5,
                          background: theme,
                          transform: 'translate(-50%, -50%) rotate(90deg)',
                        }}
                      />
                    </div>
                  </div>

                  <div
                    style={{
                      fontSize: 17,
                      fontWeight: 700,
                      color: '#2c1810',
                      letterSpacing: '-0.3px',
                      marginBottom: 6,
                      paddingRight: 24,
                    }}
                  >
                    {title}
                  </div>

                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 400,
                      color: '#64748b',
                      marginBottom: 22,
                      lineHeight: 1.5,
                      paddingRight: 24,
                    }}
                  >
                    {subtitle || '长按或扫码识别二维码'}
                  </div>

                  <div
                    style={{
                      width: 252,
                      height: 252,
                      margin: '0 auto 22px',
                      background: '#ffffff',
                      borderRadius: 14,
                      padding: 16,
                      border: '1px solid rgba(0, 0, 0, 0.06)',
                      boxShadow: '0 4px 24px rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(0, 0, 0, 0.02)',
                      display: 'grid',
                      placeItems: 'center',
                      overflow: 'hidden',
                    }}
                  >
                    {largeSvg ? (
                      <div
                        style={{
                          width: 220,
                          height: 220,
                          display: 'grid',
                          placeItems: 'center',
                          lineHeight: 0,
                        }}
                        dangerouslySetInnerHTML={{ __html: largeSvg }}
                      />
                    ) : (
                      <div style={{ fontSize: 13, color: '#94a3b8' }}>生成中…</div>
                    )}
                  </div>

                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 400,
                      color: '#94a3b8',
                      lineHeight: 1.5,
                      letterSpacing: '0.1px',
                    }}
                  >
                    长按或扫码识别 · Safari / 微信 / QQ 均支持
                  </div>
                </div>
              </div>
            )}

    </>
  );
}
