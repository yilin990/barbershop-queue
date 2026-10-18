'use client'

/**
 * CasesDemoSection · 案例 Demo 占位
 * 段 230 落地 · 2026-09-30 18:39
 *
 * 功能：预留位置展示 demo 案例（real client 真实改造前后对比）
 * 当前是占位状态，后续可接：
 * - 真实客户 demo（需授权）
 * - AI 生成 before/after 对比图
 * - 视频 demo（before/after 短视频）
 */

export default function CasesDemoSection() {
  return (
    <div style={{
      background: 'rgba(44, 24, 16, 0.3)',
      borderRadius: '16px',
      padding: '18px 16px',
      marginBottom: '16px',
      border: '1px dashed rgba(184, 134, 11, 0.4)',
    }}>
      <h2 style={{
        fontSize: 14, fontWeight: 700, color: '#fff',
        marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span>🎬</span> 真实改造案例
        <span style={{
          fontSize: 11, fontWeight: 500, color: 'rgba(184, 134, 11, 0.85)',
          marginLeft: 'auto',
          background: 'rgba(184, 134, 11, 0.15)',
          padding: '2px 8px',
          borderRadius: 8,
        }}>
          Demo 占位
        </span>
      </h2>
      <p style={{
        fontSize: 11, color: 'rgba(255,255,255,0.5)',
        marginBottom: 14, lineHeight: 1.5,
      }}>即将上线：客户 before/after 真实改造对比</p>

      {/* Demo 占位卡 */}
      <div style={{
        background: 'rgba(184, 134, 11, 0.05)',
        border: '1px dashed rgba(184, 134, 11, 0.3)',
        borderRadius: 12,
        padding: '20px 16px',
        textAlign: 'center',
        marginBottom: 10,
      }}>
        <div style={{
          fontSize: 48,
          marginBottom: 10,
          opacity: 0.6,
        }}>
          🎥
        </div>
        <div style={{
          fontSize: 13,
          fontWeight: 700,
          color: 'rgba(255,255,255,0.7)',
          marginBottom: 6,
        }}>
          即将上线 · 真实案例视频
        </div>
        <div style={{
          fontSize: 11,
          color: 'rgba(255,255,255,0.5)',
          lineHeight: 1.5,
          marginBottom: 14,
        }}>
          客户授权的真实改造过程<br />
          从咨询 → 设计 → 修剪 → 完成
        </div>

        {/* before/after 模拟 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 8,
          marginTop: 14,
        }}>
          <DemoPlaceholder label="改造前" emoji="📷" />
          <DemoPlaceholder label="改造后" emoji="✨" />
        </div>
      </div>

      {/* 进度条 */}
      <div style={{
        background: 'rgba(184, 134, 11, 0.08)',
        borderRadius: 8,
        padding: '12px 14px',
        marginTop: 10,
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 6,
        }}>
          <span style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'rgba(184, 134, 11, 0.85)',
          }}>
            📋 Demo 准备进度
          </span>
          <span style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'rgba(184, 134, 11, 0.85)',
          }}>
            25%
          </span>
        </div>
        <div style={{
          height: 6,
          background: 'rgba(184, 134, 11, 0.15)',
          borderRadius: 3,
          overflow: 'hidden',
        }}>
          <div style={{
            width: '25%',
            height: '100%',
            background: 'linear-gradient(90deg, #b8860b, #8b6508)',
            borderRadius: 3,
          }} />
        </div>
        <div style={{
          fontSize: 10,
          color: 'rgba(255,255,255,0.5)',
          marginTop: 6,
          lineHeight: 1.4,
        }}>
          ✓ 数据 schema 设计<br />
          ✓ UI 占位卡片<br />
          ○ 真实客户授权收集<br />
          ○ 拍摄 / AI 生成<br />
          ○ 上线展示
        </div>
      </div>
    </div>
  )
}

function DemoPlaceholder({ label, emoji }: { label: string; emoji: string }) {
  return (
    <div style={{
      background: 'rgba(184, 134, 11, 0.08)',
      border: '1px dashed rgba(184, 134, 11, 0.3)',
      borderRadius: 8,
      aspectRatio: '3 / 4',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
    }}>
      <div style={{ fontSize: 24, opacity: 0.6 }}>{emoji}</div>
      <div style={{
        fontSize: 10,
        color: 'rgba(255,255,255,0.5)',
        fontWeight: 600,
      }}>
        {label}
      </div>
    </div>
  )
}