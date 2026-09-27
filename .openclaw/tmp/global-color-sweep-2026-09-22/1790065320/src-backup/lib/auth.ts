// Auth utilities - mock implementation for demo

export interface AuthResult {
  success: boolean
  userId?: string
  error?: string
}

// Mock login - accepts phone/email/wechat
// In production, this would call a real auth API
export async function loginWithPhone(phone: string): Promise<AuthResult> {
  await new Promise((r) => setTimeout(r, 600)) // Simulate network
  if (!phone || phone.length < 7) {
    return { success: false, error: '请输入正确的手机号' }
  }
  return { success: true, userId: `phone_${phone}` }
}

export async function loginWithEmail(email: string): Promise<AuthResult> {
  await new Promise((r) => setTimeout(r, 600))
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return { success: false, error: '请输入正确的邮箱' }
  }
  return { success: true, userId: `email_${email}` }
}

export async function loginWithWechat(code: string): Promise<AuthResult> {
  await new Promise((r) => setTimeout(r, 800))
  if (!code) {
    return { success: false, error: '微信授权失败，请重试' }
  }
  return { success: true, userId: `wechat_${code}` }
}

// Check if user is logged in (reads from localStorage directly)
export function checkAuthStatus(): boolean {
  if (typeof window === 'undefined') return false
  const stored = localStorage.getItem('zhilin-user-storage')
  if (!stored) return false
  try {
    const parsed = JSON.parse(stored)
    return !!(parsed.state?.user && parsed.state?.isLoggedIn)
  } catch {
    return false
  }
}