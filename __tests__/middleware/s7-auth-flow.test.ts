/**
 * P0-02 Request-Level Test: S-7 Middleware Authentication Flow
 *
 * GPT audit finding: isPublicMiddlewarePath() === false does not
 * prove authentication is enforced. An unknown /api/auth/* route
 * could fall through all conditions and reach NextResponse.next()
 * without getToken() being called.
 *
 * This test proves the actual middleware request/response behaviour:
 *   - /api/auth/admin-backdoor + no session → 401
 *   - /api/auth/signin             + no session → passes through (public)
 *   - /api/auth/callback/google    + no session → passes through (public)
 *   - /api/auth/session            + no session → passes through (public)
 *   - /api/admin/users             + no session → 401
 *   - /api/admin/users             + valid session → passes through
 *
 * Finding: S-7 (MEDIUM, D-20)
 * Fix: isUnknownAuthApiPath gate added to auth check block
 */

import { vi } from 'vitest'

// ── Hoisted mocks ─────────────────────────────────────────────────────────
// vi.mock is hoisted to the top of the file. All variables referenced inside
// vi.mock factories must themselves be hoisted with vi.hoisted().

const { mockGetToken, mockJson, mockNext, mockRedirect, mockRewrite } = vi.hoisted(() => {
  const mockGetToken = vi.fn()
  const mockJson     = vi.fn((_body: unknown, init?: ResponseInit) => ({ _mocked: 'json', status: (init as { status?: number })?.status ?? 200 }))
  const mockNext     = vi.fn(() => ({ _mocked: 'next' }))
  const mockRedirect = vi.fn((_url: unknown) => ({ _mocked: 'redirect' }))
  const mockRewrite  = vi.fn((_url: unknown) => ({ _mocked: 'rewrite' }))
  return { mockGetToken, mockJson, mockNext, mockRedirect, mockRewrite }
})

vi.mock('next-auth/jwt', () => ({ getToken: mockGetToken }))

vi.mock('next/server', () => ({
  NextResponse: {
    json:     mockJson,
    next:     mockNext,
    redirect: mockRedirect,
    rewrite:  mockRewrite,
  },
}))

import { middleware } from '../../middleware'

// ── Request builder ───────────────────────────────────────────────────────
// Builds a minimal object that satisfies every property the middleware reads.

function makeRequest(pathname: string): Parameters<typeof middleware>[0] {
  const clonedUrl = {
    pathname,
    searchParams: { get: (_k: string) => null },
    startsWith: (s: string) => pathname.startsWith(s),    // used nowhere — middleware uses url.pathname.startsWith
  }

  return {
    headers: {
      get: (name: string) => {
        if (name === 'host') return 'drivebook.com.au'
        if (name === 'x-forwarded-proto') return 'https'
        return null
      },
    },
    nextUrl: { clone: () => clonedUrl },
    cookies: { get: (_name: string) => undefined },
    url: `https://drivebook.com.au${pathname}`,
  } as unknown as Parameters<typeof middleware>[0]
}

// ── Helpers ───────────────────────────────────────────────────────────────

function expectBlocked401() {
  expect(mockJson).toHaveBeenCalledWith({ error: 'Unauthorized' }, { status: 401 })
  expect(mockNext).not.toHaveBeenCalled()
}

function expectPassThrough() {
  expect(mockNext).toHaveBeenCalled()
  expect(mockJson).not.toHaveBeenCalled()
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('S-7 Request-Level Authentication Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetToken.mockResolvedValue(null)   // default: no session
  })

  // ── Attack vectors ──────────────────────────────────────────────────────

  describe('Unknown /api/auth/* routes — no session → must return 401', () => {
    it('/api/auth/admin-backdoor returns 401', async () => {
      await middleware(makeRequest('/api/auth/admin-backdoor'))
      expectBlocked401()
    })

    it('/api/auth/admin returns 401', async () => {
      await middleware(makeRequest('/api/auth/admin'))
      expectBlocked401()
    })

    it('/api/auth/secret returns 401', async () => {
      await middleware(makeRequest('/api/auth/secret'))
      expectBlocked401()
    })

    it('/api/auth/internal/config returns 401', async () => {
      await middleware(makeRequest('/api/auth/internal/config'))
      expectBlocked401()
    })

    it('/api/auth/copilot returns 401', async () => {
      await middleware(makeRequest('/api/auth/copilot'))
      expectBlocked401()
    })
  })

  // ── Legitimate NextAuth endpoints must remain publicly reachable ─────────

  describe('Whitelisted NextAuth endpoints — no session → must pass through', () => {
    it('/api/auth/signin passes through', async () => {
      await middleware(makeRequest('/api/auth/signin'))
      expectPassThrough()
    })

    it('/api/auth/signout passes through', async () => {
      await middleware(makeRequest('/api/auth/signout'))
      expectPassThrough()
    })

    it('/api/auth/callback/google passes through', async () => {
      await middleware(makeRequest('/api/auth/callback/google'))
      expectPassThrough()
    })

    it('/api/auth/callback/credentials passes through', async () => {
      await middleware(makeRequest('/api/auth/callback/credentials'))
      expectPassThrough()
    })

    it('/api/auth/session passes through', async () => {
      await middleware(makeRequest('/api/auth/session'))
      expectPassThrough()
    })

    it('/api/auth/csrf passes through', async () => {
      await middleware(makeRequest('/api/auth/csrf'))
      expectPassThrough()
    })

    it('/api/auth/providers passes through', async () => {
      await middleware(makeRequest('/api/auth/providers'))
      expectPassThrough()
    })

    it('/api/auth/error passes through', async () => {
      await middleware(makeRequest('/api/auth/error'))
      expectPassThrough()
    })

    it('/api/auth/verify-request passes through', async () => {
      await middleware(makeRequest('/api/auth/verify-request'))
      expectPassThrough()
    })
  })

  // ── Standard protected paths ──────────────────────────────────────────────

  describe('Standard protected paths — no session → 401', () => {
    it('/api/admin/users returns 401', async () => {
      await middleware(makeRequest('/api/admin/users'))
      expectBlocked401()
    })

    it('/api/instructor/bookings returns 401', async () => {
      await middleware(makeRequest('/api/instructor/bookings'))
      expectBlocked401()
    })

    it('/api/client/profile returns 401', async () => {
      await middleware(makeRequest('/api/client/profile'))
      expectBlocked401()
    })
  })

  describe('Standard protected paths — valid session → passes through', () => {
    it('/api/admin/users passes with valid session', async () => {
      mockGetToken.mockResolvedValue({ sub: 'user-123', role: 'ADMIN' })
      await middleware(makeRequest('/api/admin/users'))
      expectPassThrough()
    })
  })

  // ── Unknown /api/auth/* with valid session ────────────────────────────────

  describe('Unknown /api/auth/* — valid session → passes through', () => {
    it('/api/auth/admin-backdoor passes WITH valid session', async () => {
      // Edge middleware blocks unauthenticated only; handler must authorise further.
      mockGetToken.mockResolvedValue({ sub: 'user-123' })
      await middleware(makeRequest('/api/auth/admin-backdoor'))
      expectPassThrough()
    })
  })
})
