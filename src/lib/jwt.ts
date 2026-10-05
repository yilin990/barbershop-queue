import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'zhilin-pharmacy-secret-2026'
const JWT_EXPIRES_IN = '30d'

export interface JwtPayload {
  userId: string
  phone: string
  role: string
}

/**
 * Sign a JWT token for a user
 */
export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
}

/**
 * Verify and decode a JWT token
 * Returns null if invalid or expired
 */
export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload
    return decoded
  } catch {
    return null
  }
}

/**
 * Extract token from Authorization header
 */
export function extractToken(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null
  return authHeader.slice(7)
}