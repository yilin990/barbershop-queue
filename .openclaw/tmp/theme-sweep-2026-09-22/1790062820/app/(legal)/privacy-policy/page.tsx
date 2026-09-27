/**
 * /privacy-policy - 隐私政策公开页
 *
 * ⭐ 2026-07-13 14:25 奕霖需求：协议已写但没有公开页
 */

import { promises as fs } from 'fs'
import path from 'path'
import AppLayout from '@/components/AppLayout'
import { renderMarkdown } from '@/components/legal/MarkdownRenderer'
import Link from 'next/link'

export const runtime = 'nodejs'
export const dynamic = 'force-static'

async function readMarkdown(): Promise<string> {
  const candidates = [
    path.join(process.cwd(), '..', 'docs', 'privacy-policy.md'),
    path.join(process.cwd(), 'docs', 'privacy-policy.md'),
    path.join(process.cwd(), '..', '..', 'docs', 'privacy-policy.md'),
  ]
  for (const p of candidates) {
    try {
      return await fs.readFile(p, 'utf-8')
    } catch {}
  }
  return '# 隐私政策文件未找到'
}

export default async function PrivacyPolicyPage() {
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
          <h1 style={{ margin: 0, fontSize: 20 }}>🔒 隐私政策</h1>
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
            href="/user-agreement"
            style={{ color: '#fbbf24', textDecoration: 'none', fontSize: 14 }}
          >
            ← 返回《用户协议》
          </Link>
        </div>
      </div>
    </AppLayout>
  )
}