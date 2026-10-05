/**
 * 简单 markdown 渲染（共享给 /user-agreement 和 /privacy-policy）
 * 只支持：# ## ### 标题、- 列表、**粗体**、段落
 */
import React from 'react'

export function renderMarkdown(md: string): React.ReactElement[] {
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
        <h2 key={i} style={{ fontSize: 18, fontWeight: 700, color: '#b8860b', marginTop: 24, marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid rgba(184, 134, 11,0.2)' }}>
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
      continue
    } else {
      flushList()
      const parts = line.split(/(\*\*[^*]+\*\*)/)
      out.push(
        <p key={i} style={{ fontSize: 14, lineHeight: 1.85, color: 'rgba(255,255,255,0.85)', margin: '8px 0' }}>
          {parts.map((seg, j) => {
            if (seg.startsWith('**') && seg.endsWith('**')) {
              return <strong key={j} style={{ color: '#b8860b' }}>{seg.slice(2, -2)}</strong>
            }
            return <span key={j}>{seg}</span>
          })}
        </p>
      )
    }
  }
  flushList()
  return out
}
