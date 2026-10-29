import { NextRequest, NextResponse } from 'next/server'
import { extractToken, verifyToken } from '@/lib/jwt'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

// ============== GET /api/discussions/[id] ==============
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const post = await prisma.comment.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, nickname: true, avatar: true } },
        replies: {
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!post || !post.category) {
      return NextResponse.json({ success: false, error: '帖子不存在' }, { status: 404 })
    }

    // 解析 author|avatar|replies 前缀
    const meta = parseContentMeta(post.content)
    let tags: string[] = []
    try {
      if (post.tags) tags = JSON.parse(post.tags)
    } catch {
      tags = []
    }

    return NextResponse.json({
      success: true,
      post: {
        id: post.id,
        category: post.category,
        title: post.title,
        excerpt: meta.body,
        author: meta.author,
        avatar: meta.avatar,
        time: formatTime(post.createdAt),
        likes: post.likes,
        tags,
        userId: post.userId,
        replies: post.replies.map((r) => ({
          id: r.id,
          userName: r.userName,
          userAvatar: r.userAvatar,
          content: r.content,
          time: formatTime(r.createdAt),
        })),
      },
    })
  } catch (error) {
    console.error('[discussions/:id GET] Error:', error)
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 })
  }
}

// ============== DELETE /api/discussions/[id] ==============
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = extractToken(authHeader)
    if (!token) {
      return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 })
    }
    const payload = verifyToken(token)
    if (!payload?.userId) {
      return NextResponse.json({ success: false, error: '登录已过期' }, { status: 401 })
    }

    const { id } = await params
    const post = await prisma.comment.findUnique({ where: { id } })
    if (!post) {
      return NextResponse.json({ success: false, error: '帖子不存在' }, { status: 404 })
    }
    if (post.userId !== payload.userId) {
      return NextResponse.json({ success: false, error: '只能删除自己的帖子' }, { status: 403 })
    }

    // 先删 replies，再删 post（Cascade 已配，会自动删）
    await prisma.comment.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[discussions/:id DELETE] Error:', error)
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 })
  }
}

// ===== 工具函数（与主路由共享）=====
function parseContentMeta(content: string): { author: string; avatar: string; body: string; repliesCount: number } {
  // 旧格式: [author|avatar|repliesCount] body — 不用 regex /s flag (ES5 target)
  if (content.startsWith('[')) {
    const endBracket = content.indexOf(']')
    if (endBracket > 0) {
      const meta = content.substring(1, endBracket)
      const body = content.substring(endBracket + 1).replace(/^\s+/, '')
      const parts = meta.split('|')
      if (parts.length >= 3) {
        return {
          author: parts[0] || '匿名',
          avatar: parts[1] || '👤',
          repliesCount: parseInt(parts[2] || '0', 10),
          body,
        }
      }
    }
  }
  return { author: '匿名', avatar: '👤', repliesCount: 0, body: content }
}

function formatTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - new Date(date).getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return '刚刚'
  if (diffMin < 60) return `${diffMin} 分钟前`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour} 小时前`
  const diffDay = Math.floor(diffHour / 24)
  if (diffDay < 30) return `${diffDay} 天前`
  return new Date(date).toLocaleDateString('zh-CN')
}
