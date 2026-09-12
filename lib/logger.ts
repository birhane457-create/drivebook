/**
 * Lightweight structured logger for DriveBook.
 *
 * In production:  only warn/error are emitted (info/debug are silent)
 * In development: all levels are emitted with emoji prefixes
 *
 * Usage:
 *   import { logger } from '@/lib/logger'
 *   logger.info('[webhook] booking confirmed', { bookingId })
 *   logger.error('[auth] login failed', { email })   // safe — no passwords
 *   logger.warn('[wallet] drift detected', { userId, drift })
 *
 * Never log secrets, passwords, full card numbers, or raw tokens.
 */

const isDev = process.env.NODE_ENV !== 'production'

function fmt(level: string, message: string, meta?: Record<string, unknown>): string {
  const ts = new Date().toISOString()
  const base = `[${ts}] ${level}: ${message}`
  if (!meta || Object.keys(meta).length === 0) return base
  return `${base} ${JSON.stringify(meta)}`
}

export const logger = {
  debug(message: string, meta?: Record<string, unknown>) {
    if (isDev) console.debug(fmt('DEBUG', message, meta))
  },
  info(message: string, meta?: Record<string, unknown>) {
    if (isDev) console.log(fmt('INFO ', message, meta))
  },
  warn(message: string, meta?: Record<string, unknown>) {
    console.warn(fmt('WARN ', message, meta))
  },
  error(message: string, meta?: Record<string, unknown>) {
    console.error(fmt('ERROR', message, meta))
  },
}
