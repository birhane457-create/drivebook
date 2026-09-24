/**
 * P0-02 Regression Test: S-7 Middleware Public-Path Overlap Defence
 * 
 * Verifies that arbitrary /api/auth/* routes cannot bypass authentication
 * by inheriting public path exemption. Only explicit NextAuth endpoints
 * should be public.
 * 
 * Finding: S-7 (MEDIUM severity defence-in-depth gap)
 * Decision: D-20
 * Fix: Explicit NextAuth endpoint whitelist
 */

import { vi } from 'vitest'

// Mock next/server and next-auth/jwt so the middleware module can be imported
// in a Node test environment without requiring Next.js runtime
vi.mock('next/server', () => ({
  NextResponse: {
    next: vi.fn(() => ({ headers: { set: vi.fn() } })),
    redirect: vi.fn(),
    rewrite: vi.fn(),
    json: vi.fn(),
  },
}))

vi.mock('next-auth/jwt', () => ({
  getToken: vi.fn(),
}))

import { isPublicMiddlewarePath } from '../../middleware'

describe('S-7 Public Path Overlap Defence', () => {
  describe('Attack vectors - should be BLOCKED', () => {
    it('rejects /api/auth/admin-backdoor (arbitrary auth route)', () => {
      expect(isPublicMiddlewarePath('/api/auth/admin-backdoor')).toBe(false)
    })

    it('rejects /api/auth/secret (arbitrary auth route)', () => {
      expect(isPublicMiddlewarePath('/api/auth/secret')).toBe(false)
    })

    it('rejects /api/auth/admin (arbitrary auth route)', () => {
      expect(isPublicMiddlewarePath('/api/auth/admin')).toBe(false)
    })

    it('rejects /api/auth/internal/config (nested arbitrary route)', () => {
      expect(isPublicMiddlewarePath('/api/auth/internal/config')).toBe(false)
    })

    it('rejects /api/auth/test (arbitrary auth route)', () => {
      expect(isPublicMiddlewarePath('/api/auth/test')).toBe(false)
    })
  })

  describe('Legitimate NextAuth endpoints - should be ALLOWED', () => {
    it('allows /api/auth (NextAuth base)', () => {
      expect(isPublicMiddlewarePath('/api/auth')).toBe(true)
    })

    it('allows /api/auth/signin (exact)', () => {
      expect(isPublicMiddlewarePath('/api/auth/signin')).toBe(true)
    })

    it('allows /api/auth/signout (exact)', () => {
      expect(isPublicMiddlewarePath('/api/auth/signout')).toBe(true)
    })

    it('allows /api/auth/callback/google (one provider segment)', () => {
      expect(isPublicMiddlewarePath('/api/auth/callback/google')).toBe(true)
    })

    it('allows /api/auth/callback/credentials (one provider segment)', () => {
      expect(isPublicMiddlewarePath('/api/auth/callback/credentials')).toBe(true)
    })

    it('allows /api/auth/session (exact)', () => {
      expect(isPublicMiddlewarePath('/api/auth/session')).toBe(true)
    })

    it('allows /api/auth/csrf (exact)', () => {
      expect(isPublicMiddlewarePath('/api/auth/csrf')).toBe(true)
    })

    it('allows /api/auth/providers (exact)', () => {
      expect(isPublicMiddlewarePath('/api/auth/providers')).toBe(true)
    })

    it('allows /api/auth/verify-request (exact)', () => {
      expect(isPublicMiddlewarePath('/api/auth/verify-request')).toBe(true)
    })

    it('allows /api/auth/error (exact)', () => {
      expect(isPublicMiddlewarePath('/api/auth/error')).toBe(true)
    })
  })

  describe('Whitelist boundary — sub-paths of exact endpoints must be BLOCKED', () => {
    it('rejects /api/auth/signin/anything', () => {
      expect(isPublicMiddlewarePath('/api/auth/signin/anything')).toBe(false)
    })

    it('rejects /api/auth/session/anything', () => {
      expect(isPublicMiddlewarePath('/api/auth/session/anything')).toBe(false)
    })

    it('rejects /api/auth/providers/anything', () => {
      expect(isPublicMiddlewarePath('/api/auth/providers/anything')).toBe(false)
    })

    it('rejects /api/auth/error/anything', () => {
      expect(isPublicMiddlewarePath('/api/auth/error/anything')).toBe(false)
    })

    it('rejects /api/auth/csrf/anything', () => {
      expect(isPublicMiddlewarePath('/api/auth/csrf/anything')).toBe(false)
    })

    it('rejects /api/auth/signout/anything', () => {
      expect(isPublicMiddlewarePath('/api/auth/signout/anything')).toBe(false)
    })

    it('rejects /api/auth/callback/google/extra (too many segments)', () => {
      expect(isPublicMiddlewarePath('/api/auth/callback/google/extra')).toBe(false)
    })

    it('rejects /api/auth/callback (no provider segment)', () => {
      expect(isPublicMiddlewarePath('/api/auth/callback')).toBe(false)
    })
  })

  describe('Protected API paths - should be BLOCKED by middleware auth check', () => {
    it('rejects /api/admin/users (protected admin route)', () => {
      // Note: isPublicMiddlewarePath returns false, then middleware checks isProtectedApiPath
      expect(isPublicMiddlewarePath('/api/admin/users')).toBe(false)
    })

    it('rejects /api/instructor/bookings (protected instructor route)', () => {
      expect(isPublicMiddlewarePath('/api/instructor/bookings')).toBe(false)
    })

    it('rejects /api/client/profile (protected client route)', () => {
      expect(isPublicMiddlewarePath('/api/client/profile')).toBe(false)
    })

    it('rejects /api/bookings/create (protected bookings route)', () => {
      expect(isPublicMiddlewarePath('/api/bookings/create')).toBe(false)
    })
  })

  describe('Wildcard edge cases', () => {
    it('rejects /api/auth* (not exact match)', () => {
      expect(isPublicMiddlewarePath('/api/auth-admin')).toBe(false)
    })

    it('rejects /api/authenticate (similar but not /api/auth)', () => {
      expect(isPublicMiddlewarePath('/api/authenticate')).toBe(false)
    })

    it('rejects /api/authorization (similar prefix)', () => {
      expect(isPublicMiddlewarePath('/api/authorization')).toBe(false)
    })
  })

  describe('Public app routes - should be ALLOWED', () => {
    it('allows /', () => {
      expect(isPublicMiddlewarePath('/')).toBe(true)
    })

    it('allows /login', () => {
      expect(isPublicMiddlewarePath('/login')).toBe(true)
    })

    it('allows /register', () => {
      expect(isPublicMiddlewarePath('/register')).toBe(true)
    })

    it('allows /about', () => {
      expect(isPublicMiddlewarePath('/about')).toBe(true)
    })

    it('allows /blog/post-title (nested public path)', () => {
      expect(isPublicMiddlewarePath('/blog/post-title')).toBe(true)
    })

    it('rejects /dashboard (protected)', () => {
      expect(isPublicMiddlewarePath('/dashboard')).toBe(false)
    })

    it('rejects /admin (protected)', () => {
      expect(isPublicMiddlewarePath('/admin')).toBe(false)
    })
  })

  describe('Regression: future developer mistakes', () => {
    it('prevents accidental public /api/auth/admin endpoint', () => {
      // If a developer creates app/api/auth/admin/route.ts,
      // it should NOT be publicly accessible
      expect(isPublicMiddlewarePath('/api/auth/admin')).toBe(false)
    })

    it('prevents accidental public /api/auth/copilot endpoint', () => {
      // If a developer creates app/api/auth/copilot/route.ts,
      // it should NOT be publicly accessible
      expect(isPublicMiddlewarePath('/api/auth/copilot')).toBe(false)
    })

    it('prevents accidental public /api/auth/internal endpoint', () => {
      // Internal auth utilities should not be public
      expect(isPublicMiddlewarePath('/api/auth/internal')).toBe(false)
    })
  })
})

/**
 * Test summary:
 * 
 * ✅ Arbitrary /api/auth/* routes are blocked (attack vectors)
 * ✅ Legitimate NextAuth endpoints remain public
 * ✅ Protected API paths remain protected
 * ✅ Wildcard edge cases handled correctly
 * ✅ Future developer mistakes prevented by whitelist approach
 * 
 * Defence-in-depth restored: Only explicitly whitelisted NextAuth
 * endpoints can be public. Any new route under /api/auth/* must be
 * explicitly added to the whitelist or it will require authentication.
 */
