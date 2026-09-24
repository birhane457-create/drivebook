import { describe, expect, it } from 'vitest'

import { isPublicMiddlewarePath } from './middleware'

describe('S-7 middleware public-path boundary', () => {
  it('does not treat / as a prefix for protected routes', () => {
    expect(isPublicMiddlewarePath('/')).toBe(true)
    expect(isPublicMiddlewarePath('/admin/users')).toBe(false)
    expect(isPublicMiddlewarePath('/api/admin/users')).toBe(false)
    expect(isPublicMiddlewarePath('/api/client/wallet')).toBe(false)
    expect(isPublicMiddlewarePath('/api/bookings/123')).toBe(false)
  })

  it('does not expose arbitrary /api/auth paths', () => {
    expect(isPublicMiddlewarePath('/api/auth/session')).toBe(true)
    expect(isPublicMiddlewarePath('/api/auth/callback/google')).toBe(true)
    expect(isPublicMiddlewarePath('/api/auth/admin')).toBe(false)
    expect(isPublicMiddlewarePath('/api/auth/internal/test')).toBe(false)
  })

  it('keeps legitimate public route boundaries', () => {
    expect(isPublicMiddlewarePath('/login')).toBe(true)
    expect(isPublicMiddlewarePath('/login/example')).toBe(true)
    expect(isPublicMiddlewarePath('/login-not-a-route')).toBe(false)
    expect(isPublicMiddlewarePath('/features')).toBe(true)
    expect(isPublicMiddlewarePath('/features/ai')).toBe(true)
    expect(isPublicMiddlewarePath('/feature-store')).toBe(false)
  })
})
