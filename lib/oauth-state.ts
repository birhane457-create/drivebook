import crypto from 'crypto'

const STATE_MAX_AGE_MS = 15 * 60 * 1000 // 15 minutes

/**
 * Sign OAuth state for Google Calendar connect flow.
 * Format: instructorId.timestamp.hmac
 */
export function signOAuthState(instructorId: string): string {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) {
    throw new Error('NEXTAUTH_SECRET is not configured')
  }

  const timestamp = Date.now().toString()
  const payload = `${instructorId}.${timestamp}`
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex')
  return `${payload}.${sig}`
}

/**
 * Verify signed OAuth state and return instructorId if valid.
 */
export function verifyOAuthState(state: string): { instructorId: string } | null {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) return null

  const parts = state.split('.')
  if (parts.length !== 3) return null

  const [instructorId, timestamp, sig] = parts
  if (!instructorId || !timestamp || !sig) return null

  const ts = Number(timestamp)
  if (!Number.isFinite(ts)) return null

  const age = Date.now() - ts
  if (age < 0 || age > STATE_MAX_AGE_MS) return null

  const payload = `${instructorId}.${timestamp}`
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex')

  try {
    const sigBuf = Buffer.from(sig, 'hex')
    const expectedBuf = Buffer.from(expected, 'hex')
    if (sigBuf.length !== expectedBuf.length) return null
    if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null
  } catch {
    return null
  }

  return { instructorId }
}
