import { NextRequest, NextResponse } from 'next/server'
import { extractToken, verifyToken } from '@/lib/jwt'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

// ============== GET /api/discussions ==============
// 列表讨论帖子
// query: ?category=cold&search=发烧&page=1&limit=20
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    const where: any = {
      category: { not: null }, // 只要讨论帖（排除旧评价类评论）
    }
    if (category && category !== 'all') {
      where.category = category
    }
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { content: { contains: search } },
        { tags: { contains: search } },
      ]
    }

    const [posts, total] = await Promise.all([
      prisma.comment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, nickname: true, avatar: true } },
          _count: { select: { replies: true } },
        },
      }),
      prisma.comment.count({ where }),
    ])

    // 解析 [author|avatar|replies] 前缀 + tags JSON
    const formatted = posts.map((p) => {
      const meta = parseContentMeta(p.content)
      let tags: string[] = []
      try {
        if (p.tags) tags = JSON.parse(p.tags)
      } catch {
        tags = []
      }
      return {
        id: p.id,
        category: p.category,
        title: p.title,
        excerpt: meta.body,
        author: meta.author,
        avatar: meta.avatar,
        time: formatTime(p.createdAt),
        replies: meta.repliesCount,
        likes: p.likes,
        tags,
        userId: p.userId,
      }
    })

    return NextResponse.json({
      success: true,
      posts: formatted,
      total,
      page,
      pages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('[discussions GET] Error:', error)
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 })
  }
}

// ============== POST /api/discussions ==============
// 发新讨论帖（需要登录）
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = extractToken(authHeader)
    if (!token) {
      return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 })
    }
    const payload = verifyToken(token)
    if (!payload || !payload.userId) {
      return NextResponse.json({ success: false, error: '登录已过期' }, { status: 401 })
    }

    const body = await request.json()
    const { category, title, content, tags } = body

    // 校验
    if (!category || !title?.trim() || !content?.trim()) {
      return NextResponse.json(
        { success: false, error: '分类/标题/内容不能为空' },
        { status: 400 }
      )
    }
    if (title.length > 80) {
      return NextResponse.json({ success: false, error: '标题不超过 80 字' }, { status: 400 })
    }
    if (content.length > 1000) {
      return NextResponse.json({ success: false, error: '内容不超过 1000 字' }, { status: 400 })
    }

    // 取用户信息作为 author
    const user = await prisma.user.findUnique({ where: { id: payload.userId } })
    if (!user) {
      return NextResponse.json({ success: false, error: '用户不存在' }, { status: 401 })
    }

    const tagsJson = Array.isArray(tags) ? JSON.stringify(tags.slice(0, 6)) : null
    const fullContent = `[${user.nickname}|${user.avatar}|0] ${content.trim()}`

    const post = await prisma.comment.create({
      data: {
        userId: payload.userId,
        rating: 0,
        content: fullContent,
        likes: 0,
        category: String(category),
        title: title.trim(),
        tags: tagsJson,
      },
    })

    return NextResponse.json({
      success: true,
      post: {
        id: post.id,
        category: post.category,
        title: post.title,
        excerpt: content.trim(),
        author: user.nickname,
        avatar: user.avatar,
        time: '刚刚',
        replies: 0,
        likes: 0,
        tags: tags || [],
        userId: post.userId,
      },
    })
  } catch (error) {
    console.error('[discussions POST] Error:', error)
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 })
  }
}

// ============== 工具函数 ==============
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
