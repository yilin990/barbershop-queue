/**
 * /user-agreement - 用户协议公开页
 *
 * ⭐ 2026-07-13 14:25 奕霖需求：协议已写但没有公开页
 * - 直接读 docs/user-agreement.md
 * - 简单 markdown 渲染（标题/段落/列表足够，0 依赖）
 * - 顶部返回按钮 + 底部"我同意"（用于登录前同意）
 */
import React from 'react'
import { promises as fs } from 'fs'
import path from 'path'
import AppLayout from '@/components/AppLayout'
import Link from 'next/link'

export const runtime = 'nodejs'
export const dynamic = 'force-static'

async function readMarkdown(): Promise<string> {
  // ⭐ 上溯到项目根目录读 docs（页面在 official/ 下，docs 在 ../docs/）
  const candidates = [
    path.join(process.cwd(), '..', 'docs', 'user-agreement.md'),
    path.join(process.cwd(), 'docs', 'user-agreement.md'),
    path.join(process.cwd(), '..', '..', 'docs', 'user-agreement.md'),
  ]
  for (const p of candidates) {
    try {
      return await fs.readFile(p, 'utf-8')
    } catch {}
  }
  return '# 协议文件未找到'
}

function renderMarkdown(md: string) {
  // 极简 markdown 渲染：# / ## / ### / 段落 / 列表 / **粗体** / 普通文本
  const lines = md.split('\n')
  const out: React.ReactElement[] = []
  let inList = false
  let listBuffer: string[] = []

  const flushList = () => {
    if (inList && listBuffer.length) {
      out.push(
        <ul key={`ul-${out.length}`} style={{ margin: '12px 0', paddingLeft: 22 }}>
          {listBuffer.map((item, i) => (
            <li key={i} style={{ fontSize: 14, lineHeight: 1.85, color: 'rgba(255,255,255,0.78)' }}>
              {item}
            </li>
          ))}
        </ul>
      )
      listBuffer = []
      inList = false
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.startsWith('# ')) {
      flushList()
      out.push(
        <h1 key={i} style={{ fontSize: 24, fontWeight: 800, color: '#fff', marginTop: 28, marginBottom: 12 }}>
          {line.slice(2)}
        </h1>
      )
    } else if (line.startsWith('## ')) {
      flushList()
      out.push(
        <h2 key={i} style={{ fontSize: 18, fontWeight: 700, color: '#fbbf24', marginTop: 24, marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid rgba(127,220,148,0.2)' }}>
          {line.slice(3)}
        </h2>
      )
    } else if (line.startsWith('### ')) {
      flushList()
      out.push(
        <h3 key={i} style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.95)', marginTop: 16, marginBottom: 8 }}>
          {line.slice(4)}
        </h3>
      )
    } else if (line.trim().startsWith('- ')) {
      inList = true
      listBuffer.push(line.replace(/^[\s]*- /, '').replace(/\*\*/g, ''))
    } else if (line.trim() === '') {
      flushList()
    } else if (line.trim().startsWith('|')) {
      // 表格行：跳过（原始 markdown 通常很丑）
      continue
    } else {
      flushList()
      // 段落：处理 **粗体**
      const segments: React.ReactElement[] = []
      const parts = line.split(/(\*\*[^*]+\*\*)/)
      parts.forEach((seg, j) => {
        if (seg.startsWith('**') && seg.endsWith('**')) {
          segments.push(<strong key={j} style={{ color: '#fbbf24' }}>{seg.slice(2, -2)}</strong>)
        } else if (seg) {
          segments.push(<span key={j}>{seg}</span>)
        }
      })
      out.push(
        <p key={i} style={{ fontSize: 14, lineHeight: 1.85, color: 'rgba(255,255,255,0.85)', margin: '8px 0' }}>
          {segments}
        </p>
      )
    }
  }
  flushList()
  return out
}

export default async function UserAgreementPage() {
  const md = await readMarkdown()
  return (
    <AppLayout hideBottomTabBar>
      <div style={{ padding: '16px', maxWidth: 720, margin: '0 auto', color: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <Link
            href="/"
            style={{
              padding: '6px 12px', borderRadius: 10,
              border: '1px solid rgba(127, 220, 148, 0.3)',
              color: '#fbbf24', textDecoration: 'none',
              fontSize: 14,
            }}
          >
            ← 返回
          </Link>
          <h1 style={{ margin: 0, fontSize: 20 }}>📜 用户协议</h1>
        </div>
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 14, padding: '20px 18px',
        }}>
          {renderMarkdown(md)}
        </div>
        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <Link
            href="/privacy-policy"
            style={{ color: '#fbbf24', textDecoration: 'none', fontSize: 14 }}
          >
            查看《隐私政策》→
          </Link>
        </div>
      </div>
    </AppLayout>
  )
}