'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** 用户健康画像（清禾 2026-07-03 按奕霖要求新增）*/
export interface UserHealthProfile {
  age?: number            // 年龄（岁）
  gender?: '男' | '女' | '其他' // 性别
  birthday?: string       // ISO 日期
  allergy?: string        // 过敏史（逗号分隔）
  chronicDiseases?: string // 慢病（逗号分隔）
  lastSymptoms?: string   // 最近症状摘要
}

/** 用户偏好（持久化 + 账号隔离）*/
export interface UserPreferences {
  fontSize?: 'small' | 'normal' | 'large'  // 字号
  theme?: 'auto' | 'dark' | 'light'          // 主题
  notifyOrder?: boolean                       // 订单通知
  notifyPromo?: boolean                       // 活动通知
  language?: 'zh-CN' | 'en'                  // 语言
}

export interface User {
  id: string
  nickname: string
  avatar: string
  phone?: string
  role: string
  points: number
  createdAt: string
  lastLoginAt?: string
  token?: string
  // ⭐ 清禾 2026-07-03 新增：健康画像 + 偏好
  profile?: UserHealthProfile
  preferences?: UserPreferences
}

interface UserState {
  user: User | null
  token: string | null
  isLoggedIn: boolean
  isLoading: boolean
  login: (user: User, token: string) => void
  /** ⭐ 2026-10-05 01:25 奕霖立：软登录（手机号+称呼即可登录，无 token）
   *  - 用途：/merchant/queue 预约/取号提交成功后自动登录
   *  - 效果：/orders 等页面不再弹 LoginModal（认账同一用户）
   */
  softLogin: (phone: string, name?: string, queueId?: string) => void
  logout: () => void
  updateUser: (updates: Partial<User>) => void
  /** ⭐ 奕霖 2026-07-03：更新健康画像 */
  updateProfile: (updates: Partial<UserHealthProfile>) => Promise<void>
  /** ⭐ 奕霖 2026-07-03：更新偏好 */
  updatePreferences: (updates: Partial<UserPreferences>) => Promise<void>
  refreshUser: () => Promise<void>
  clearAuth: () => void
  /** ⭐ 奕霖 2026-07-05：从 cookie 恢复登录态 */
  restoreFromCookie: () => Promise<void>
  /** ⭐ 奕霖 2026-07-05：编辑基础资料 */
  updateBasic: (updates: { nickname?: string; avatar?: string; phone?: string; birthday?: string | null }) => Promise<any>
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoggedIn: false,
      isLoading: false,

      login: (user: User, token: string) => {
        set({ user, token, isLoggedIn: true })
        // ⭐ 2026-10-28：zhilin-token 改成 httpOnly 之后，前端**不能**再写这个 cookie
        //   （document.cookie 看不见 httpOnly cookie；而且明文 token 落在 document.cookie
        //    里 = XSS 可读）。服务端在登录响应里已经下发了 httpOnly cookie，
        //   前端只保留 zhilin-user-id。
        if (typeof document !== 'undefined') {
          const maxAge = 30 * 24 * 3600
          document.cookie = `zhilin-user-id=${encodeURIComponent(user.id)}; Path=/; Max-Age=${maxAge}; SameSite=Lax`
        }
      },

      // ⭐ 2026-10-05 01:25 奕霖立：软登录实现
      softLogin: (phone: string, name?: string, queueId?: string) => {
        const cleanPhone = (phone || '').replace(/\D/g, '')
        if (!cleanPhone) return
        const existing = get().user
        // ⭐ 2026-10-28：软会话签发（重复登录也要换一份新的）
        const mintSoftSession = () => {
          if (!queueId || typeof document === 'undefined') return
          fetch('/api/auth/soft-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ phone: cleanPhone, queueId }),
          }).catch(() => {})
        }
        // 已登录且手机号一致：只更新昵称（不覆盖已有 user 信息）
        if (existing && existing.phone === cleanPhone) {
          mintSoftSession()
          if (name && name !== existing.nickname) {
            set({ user: { ...existing, nickname: name } })
          }
          if (!get().isLoggedIn) set({ isLoggedIn: true })
          return
        }
        // 新软登录：建最小 user 对象
        const softUser: User = {
          id: existing?.id || ('soft_' + cleanPhone),
          nickname: name || existing?.nickname || ('铜仁用户' + cleanPhone.slice(-4)),
          avatar: existing?.avatar || '',
          phone: cleanPhone,
          role: existing?.role || 'guest',
          points: existing?.points ?? 0,
          createdAt: existing?.createdAt || new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
        }
        set({ user: softUser, isLoggedIn: true })
        // 软登录也写 cookie（user-id 一致性）
        if (typeof document !== 'undefined') {
          const maxAge = 30 * 24 * 3600
          document.cookie = `zhilin-user-id=${encodeURIComponent(softUser.id)}; Path=/; Max-Age=${maxAge}; SameSite=Lax`
        }
        // ⭐ 2026-10-28：换一份服务端签发的「软会话」——
        //   有了它，顾客才能读自己的排队/订单（GET /api/queues?phone= 现在要求登录态）。
        //   凭证是刚建的那一单（queueId），别人光知道手机号拿不到。
        mintSoftSession()
      },

      logout: () => {
        set({ user: null, token: null, isLoggedIn: false })
        // 清 cookie：httpOnly 的那个只能由服务端清（/api/auth/logout 会置过期）
        if (typeof document !== 'undefined') {
          document.cookie = 'zhilin-user-id=; Path=/; Max-Age=0; SameSite=Lax'
        }
        fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
      },

      /**
       * ⭐ 奕霖 2026-07-05 修复登录失效：从 cookie 恢复登录态
       * 任何页面 mount 时调用，如果有 cookie 没在 store 就恢复
       */
      restoreFromCookie: async () => {
        if (typeof window === 'undefined') return
        const { isLoggedIn, token } = get()
        // 如果 store 里已有 token，不重复
        if (isLoggedIn && token) return
        // ⭐ 2026-10-28：zhilin-token 是 httpOnly 了，JS 读不到 cookie。
        //   改成问服务端要（服务端读 cookie → 验签 → 回 token + user）。
        try {
          const res = await fetch('/api/auth/session', { credentials: 'include' })
          const data = await res.json()
          if (data.success && data.user) {
            set({
              token: data.token,
              user: { ...(get().user || {}), ...data.user },
              isLoggedIn: true,
            })
          }
        } catch (e) {
          console.error('[restoreFromCookie] failed:', e)
        }
      },

      /**
       * ⭐ 奕霖 2026-07-05 需求：编辑基础资料（昵称/头像/手机号换绑）
       */
      updateBasic: async (updates: { nickname?: string; avatar?: string; phone?: string; birthday?: string | null }) => {
        const { user, token } = get()
        if (!user || !token) { throw new Error('未登录') }
        // 乐观更新
        const newUser = { ...user, ...updates }
        set({ user: newUser })
        // 后端持久化
        try {
          const res = await fetch('/api/users/me/basic', {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(updates),
          })
          const data = await res.json()
          if (!data.success) {
            // 回滚
            set({ user })
            throw new Error(data.error || '更新失败')
          }
          if (data.user) {
            // ⭐ 奕霖 2026-07-05：把 birthday 同步到 user.profile（API 返回在顶层）
            const merged: any = { ...newUser, ...data.user }
            if ('birthday' in data.user) {
              merged.profile = { ...(user.profile || {}), birthday: data.user.birthday }
            }
            set({ user: merged })
            // ⭐ 完整刷新用户数据，确保 /api/users/me 的 profile 字段也同步
            try { await get().refreshUser() } catch {}
          }
          return data
        } catch (e) {
          console.error('[updateBasic]', e)
          throw e
        }
      },

      updateUser: (updates: Partial<User>) => {
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        }))
      },

      /**
       * 奕霖 2026-07-03：更新健康画像（年龄/过敏/慢病）
       * 写入后端 + 同步本地
       */
      updateProfile: async (updates: Partial<UserHealthProfile>) => {
        const { user, token } = get()
        if (!user) return
        const newProfile = { ...(user.profile || {}), ...updates }
        // 先本地乐观更新
        set((state) => ({
          user: state.user ? { ...state.user, profile: newProfile } : null,
        }))
        // 后端同步
        if (token) {
          try {
            await fetch('/api/users/me/profile', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify(newProfile),
            })
          } catch (e) {
            console.error('Update profile failed:', e)
          }
        }
      },

      /**
       * 奕霖 2026-07-03：更新用户偏好（持久化 + 账号隔离）
       */
      updatePreferences: async (updates: Partial<UserPreferences>) => {
        const { user, token } = get()
        if (!user) return
        const newPrefs = { ...(user.preferences || {}), ...updates }
        // 先本地乐观更新
        set((state) => ({
          user: state.user ? { ...state.user, preferences: newPrefs } : null,
        }))
        // 后端同步
        if (token) {
          try {
            await fetch('/api/users/me/preferences', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify(newPrefs),
            })
          } catch (e) {
            console.error('Update preferences failed:', e)
          }
        }
      },

      /**
       * Verify stored token with the backend and refresh user data
       */
      refreshUser: async () => {
        const { token } = get()
        if (!token) {
          set({ user: null, token: null, isLoggedIn: false })
          return
        }
        try {
          const res = await fetch('/api/users/me', {
            headers: { Authorization: `Bearer ${token}` },
          })
          const data = await res.json()
          if (data.success && data.user) {
            set({
              user: { ...get().user, ...data.user },
              isLoggedIn: true,
            })
          } else {
            // Token invalid
            set({ user: null, token: null, isLoggedIn: false })
          }
        } catch (e) {
          console.error('Refresh user failed:', e)
        }
      },

      clearAuth: () => {
        set({ user: null, token: null, isLoggedIn: false })
      },
    }),
    {
      name: 'zhilin-user-storage',
      // ⭐ 清禾 2026-07-03 升级：存 accountId 实现多账号隔离
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isLoggedIn: state.isLoggedIn,
      }),
    }
  )
)

/** 清禾 2026-07-03：根据当前 user 生成 AI 药师上下文摘要
 * 用于注入到 system prompt，避免 AI 重复问基础信息
 */
export function getAIUserContext(): string {
  const { user } = useUserStore.getState()
  if (!user) return ''
  const lines: string[] = []
  if (user.nickname) lines.push(`昵称：${user.nickname}`)
  if (user.profile?.age) lines.push(`年龄：${user.profile.age}岁`)
  if (user.profile?.gender) lines.push(`性别：${user.profile.gender}`)
  if (user.profile?.allergy) lines.push(`过敏史：${user.profile.allergy}`)
  if (user.profile?.chronicDiseases) lines.push(`慢病：${user.profile.chronicDiseases}`)
  if (user.profile?.lastSymptoms) lines.push(`最近症状：${user.profile.lastSymptoms}`)
  if (user.role) lines.push(`会员等级：${user.role}`)
  if (lines.length === 0) return ''
  return lines.join(' | ')
}