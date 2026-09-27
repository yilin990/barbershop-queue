/**
 * SMS sending utility - mock implementation
 * In dev: just console.log the code
 * In prod: integrate with Alibaba Cloud / Tencent Cloud SMS
 */

const IS_DEV = process.env.NODE_ENV !== 'production'

/**
 * Generate a 6-digit verification code
 */
export function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

/**
 * Send SMS verification code
 * DEV: logs to console and returns the code
 * PROD: calls SMS API (mocked for now)
 */
export async function sendSmsCode(phone: string, code: string): Promise<{ success: boolean; devCode?: string }> {
  if (IS_DEV) {
    // In development, just console.log so user can see it
    console.log(`\n📱 [DEV] SMS to ${phone}: 您的验证码是 ${code}，5分钟内有效\n`)
    return { success: true, devCode: code }
  }

  // In production, integrate with real SMS service
  // Mock for now - always succeeds
  try {
    // TODO: Integrate with Alibaba Cloud SMS or Tencent Cloud SMS
    // const result = await aliyunSmsSend({ PhoneNumbers: phone, TemplateParam: { code } })
    console.log(`[PROD] SMS would be sent to ${phone} with code ${code}`)
    return { success: true }
  } catch (error) {
    console.error('[SMS] Send failed:', error)
    return { success: false }
  }
}

/**
 * Validate phone number format (Chinese mobile)
 */
export function isValidPhone(phone: string): boolean {
  return /^1[3-9]\d{9}$/.test(phone)
}