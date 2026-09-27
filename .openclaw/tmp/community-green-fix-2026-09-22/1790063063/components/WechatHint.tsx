'use client';

import { useEffect, useState } from 'react';

/**
 * 微信/QQ 内置浏览器检测 + 引导 banner
 *
 * - 检测到微信/QQ 内打开时显示「请在浏览器中打开」提示
 * - 关闭后 24h 内不再显示
 * - 同时在「浏览器内」时显示「正常浏览」小标签（让用户知道状态）
 */
export default function WechatHint() {
  const [browserType, setBrowserType] = useState<'wechat' | 'qq' | 'browser' | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const ua = window.navigator.userAgent;
    const isWechat = /MicroMessenger/i.test(ua);
    const isQQ = /\bQQ\b/i.test(ua) && !/MicroMessenger/i.test(ua);
    const isWeibo = /Weibo/i.test(ua);
    const isDingTalk = /DingTalk/i.test(ua);

    if (isWechat) setBrowserType('wechat');
    else if (isQQ) setBrowserType('qq');
    else if (isWeibo) setBrowserType('qq'); // 归类为"内嵌"
    else if (isDingTalk) setBrowserType('qq');
    else setBrowserType('browser');

    // 24h 冷却
    const dismissedAt = localStorage.getItem('zhilin-wechat-hint-dismissed');
    if (dismissedAt) {
      const hoursSince = (Date.now() - parseInt(dismissedAt, 10)) / (1000 * 60 * 60);
      if (hoursSince < 24) setDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem('zhilin-wechat-hint-dismissed', Date.now().toString());
    setDismissed(true);
  };

  if (browserType === null) return null;

  // 内置浏览器（微信/QQ/微博/钉钉）— 显示引导
  if (browserType === 'wechat' || browserType === 'qq') {
    if (dismissed) return null;

    const isWechat = browserType === 'wechat';
    const config = isWechat
      ? {
          bg: 'linear-gradient(135deg, #f0fdf4, #dcfce7)',
          border: '1px solid #86efac',
          iconBg: 'linear-gradient(135deg, #07c160, #00b853)',
          icon: '💬',
          title: '当前在微信中打开',
          subtitle: '微信内无法直接下载 APK，请按以下操作：',
          steps: [
            '点右上角 ··· 按钮',
            '选「在浏览器中打开」',
            '回到浏览器即可正常下载',
          ],
          cta: '复制链接',
        }
      : {
          bg: 'linear-gradient(135deg, #eff6ff, #dbeafe)',
          border: '1px solid #93c5fd',
          iconBg: 'linear-gradient(135deg, #1296db, #0078d7)',
          icon: '🐧',
          title: '当前在 QQ 中打开',
          subtitle: 'QQ 内置浏览器可能限制下载，建议：',
          steps: [
            '点右上角 ··· 按钮',
            '选「在浏览器中打开」',
            '回到浏览器即可正常下载',
          ],
          cta: '复制链接',
        };

    return (
      <div
        className="no-print"
        style={{
          background: config.bg,
          border: config.border,
          borderRadius: 14,
          padding: 14,
          marginBottom: 16,
          position: 'relative',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
          }}
        >
          {/* 图标 */}
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: config.iconBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              flexShrink: 0,
              color: '#2c1810',
            }}
          >
            {config.icon}
          </div>

          {/* 内容 */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: '#0a0f0d',
                marginBottom: 4,
              }}
            >
              {config.title}
            </div>
            <div
              style={{
                fontSize: 12,
                color: '#374151',
                lineHeight: 1.5,
                marginBottom: 8,
              }}
            >
              {config.subtitle}
            </div>
            <ol
              style={{
                margin: '0 0 10px',
                paddingLeft: 18,
                fontSize: 12,
                color: '#0a0f0d',
                lineHeight: 1.7,
                fontWeight: 500,
              }}
            >
              {config.steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={() => {
                  const url = window.location.href;
                  navigator.clipboard.writeText(url).then(() => {
                    const btn = document.activeElement as HTMLButtonElement;
                    if (btn) btn.textContent = '✓ 已复制';
                    setTimeout(() => {
                      if (btn) btn.textContent = config.cta;
                    }, 1800);
                  });
                }}
                style={{
                  padding: '6px 12px',
                  background: '#0a0f0d',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {config.cta}
              </button>
              <button
                onClick={handleDismiss}
                style={{
                  padding: '6px 12px',
                  background: 'transparent',
                  color: '#6b7280',
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                知道了
              </button>
            </div>
          </div>

          {/* 关闭 */}
          <button
            onClick={handleDismiss}
            aria-label="关闭"
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              width: 24,
              height: 24,
              background: 'transparent',
              border: 'none',
              color: '#9ca3af',
              fontSize: 16,
              cursor: 'pointer',
              padding: 0,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
      </div>
    );
  }

  // 浏览器：显示一个小标签让用户知道检测状态（让奕霖能确认检测到的是浏览器）
  // 但只在 mobile 设备上显示，桌面端不显示
  if (browserType === 'browser') {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(window.navigator.userAgent);
    if (!isMobile) return null;
    return (
      <div
        className="no-print"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '5px 10px',
          background: 'rgba(184, 134, 11, 0.08)',
          border: '1px solid rgba(184, 134, 11, 0.2)',
          borderRadius: 999,
          fontSize: 11,
          color: '#166534',
          marginBottom: 12,
        }}
      >
        <span
          style={{
            display: 'inline-block',
            width: 6,
            height: 6,
            borderRadius: 3,
            background: '#10b981',
          }}
        />
        <span>浏览器访问 · 可正常下载</span>
      </div>
    );
  }

  return null;
}
