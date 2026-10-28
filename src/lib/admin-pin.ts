/**
 * 商户后台 PIN 校验（服务端专用）· 2026-10-28
 *
 * 从 admin-auth.ts 拆出来的原因：admin-auth.ts 被客户端组件
 * （AdminGate / AdminLayout / me/points 页）import，
 * 带密钥的模块一旦被它 import，密钥就会进前端包（可离线爆破 6 位 PIN）。
 *
 * 客户端现在改成调服务端接口 /api/admin/auth/admin-pin 验 PIN，
 * 真正的判定永远在服务端。
 */

import { ADMIN_PIN_HASHES, PIN_PEPPER } from '@/config/business.secrets'
import { verifyPinHashes } from './pin-hash'

/** 校验商户后台 PIN */
export function verifyAdminPin(pin: string): boolean {
  return verifyPinHashes(pin, ADMIN_PIN_HASHES, PIN_PEPPER)
}
