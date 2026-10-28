/**
 * 店员 PIN 校验（服务端专用）· 2026-10-28
 *
 * 为什么要从 staff-auth.ts 拆出来：
 *   staff-auth.ts 同时被客户端组件（StaffGate.tsx）import，
 *   只要它 import 了带密钥的模块，密钥就会进前端包。
 *   所以「验 PIN」必须住在只被服务端 import 的文件里。
 */

import { STAFF_PIN_HASHES, PIN_PEPPER } from '@/config/business.secrets'
import { verifyPinHashes } from './pin-hash'

/** 验证店员 PIN 是否命中白名单 */
export function verifyStaffPin(pin: string): boolean {
  return verifyPinHashes(pin, STAFF_PIN_HASHES, PIN_PEPPER)
}
