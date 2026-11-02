/**
 * WLA-007: Real concurrent domain claim — actual route handler + real PostgreSQL
 *
 * The partial unique index must be present in the database before this test runs.
 * Applied to test DB on 2026-11-01 (see docs/audit/WLA-007-DEPLOYMENT-EVIDENCE.md).
 *
 * Two distinct providers attempt to verify the same custom domain simultaneously.
 * The index enforces: only one provider can have domainVerified=true for any
 * given customDomain at the same time.
 *
 * WHAT IS TESTED
 *   DOM-01  Index present (guard — fails fast if index missing)
 *   DOM-02  Two concurrent update attempts → exactly one succeeds
 *   DOM-03  The losing attempt receives P2002 (unique constraint violation)
 *   DOM-04  Exactly one verified owner after the race
 *   DOM-05  The losing provider's domainVerified remains false
 *   DOM-06  Route handler: actual POST handler invoked with mocked DNS;
 *           real Prisma; real PostgreSQL; loser returns HTTP 409
 *
 * DATABASE: postgresql://postgres:testpass@127.0.0.1:5433/drivebook_test
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library'

// ── Mocks for route handler (DNS + auth only; Prisma is REAL) ─────────────────

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),  // overridden per test
}))

vi.mock('next/headers', () => ({
  headers: vi.fn(() => new Map()),
  cookies: vi.fn(() => ({ get: vi.fn(), set: vi.fn() })),
}))

// DNS: mock so both providers pass CNAME verification
vi.mock('dns/promises', () => ({
  default: {
    resolveCname: vi.fn().mockResolvedValue(['cname.vercel-dns.com']),
    resolve4: vi.fn().mockResolvedValue([]),
  },
}))

// Vercel domain attachment: succeeds silently
vi.mock('@/lib/services/vercel-domains', () => ({
  addDomainToVercel: vi.fn().mockResolvedValue({ success: true }),
}))

import { POST } from '@/app/api/instructor/domain/verify/route'
import { NextRequest } from 'next/server'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const PREFIX = 'WLA007DOM'
const TEST_DOMAIN = `wla007-test-${Date.now()}.example.com`

let providerAId: string
let providerBId: string

async function cleanup() {
  await prisma.provider.updateMany({
    where: { id: { in: [providerAId ?? '__none__', providerBId ?? '__none__'] } },
    data: { customDomain: null, domainVerified: false },
  }).catch(() => {})
  await prisma.user.deleteMany({
    where: { email: { in: [
      `${PREFIX}-prov-a@test.com`, `${PREFIX}-prov-b@test.com`,
    ]}},
  }).catch(() => {})
  await prisma.provider.deleteMany({
    where: { id: { in: [providerAId ?? '__none__', providerBId ?? '__none__'] } },
  }).catch(() => {})
}

beforeAll(async () => {
  await cleanup()

  const userA = await prisma.user.create({
    data: { email: `${PREFIX}-prov-a@test.com`, name: 'DOM Provider A', role: 'PROVIDER' },
  })
  const provA = await (prisma.provider as any).create({
    data: {
      user:               { connect: { id: userA.id } },
      name:               'DOM Provider A',
      phone:              '0400000040',
      hourlyRate:         80,
      approvalStatus:     'APPROVED',
      isActive:           true,
      subscriptionStatus: 'ACTIVE',
      subscriptionTier:   'STUDIO',   // STUDIO qualifies for custom domain
    },
  })
  providerAId = provA.id

  const userB = await prisma.user.create({
    data: { email: `${PREFIX}-prov-b@test.com`, name: 'DOM Provider B', role: 'PROVIDER' },
  })
  const provB = await (prisma.provider as any).create({
    data: {
      user:               { connect: { id: userB.id } },
      name:               'DOM Provider B',
      phone:              '0400000041',
      hourlyRate:         80,
      approvalStatus:     'APPROVED',
      isActive:           true,
      subscriptionStatus: 'ACTIVE',
      subscriptionTier:   'STUDIO',
    },
  })
  providerBId = provB.id
}, 30000)

afterAll(async () => {
  await cleanup()
}, 30000)

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('WLA-007: Domain claim concurrency — real PostgreSQL', () => {
  it('DOM-01 — guard: partial unique index is present in the database', async () => {
    const result = await prisma.$queryRaw<any[]>`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'Provider'
        AND indexname = 'Provider_customDomain_domainVerified_unique'
    `
    expect(result).toHaveLength(1)
    expect(result[0].indexdef).toContain('WHERE')
    expect(result[0].indexdef).toContain('"domainVerified"')
    expect(result[0].indexdef).toContain('true')
  }, 15000)

  it('DOM-02..DOM-05 — concurrent Prisma updates; exactly one verified owner', async () => {
    // Both providers attempt to claim the same domain concurrently.
    // The partial unique index means only one update can succeed.
    const results = await Promise.allSettled([
      prisma.provider.update({
        where: { id: providerAId },
        data: { customDomain: TEST_DOMAIN, domainVerified: true, domainVerifiedAt: new Date() },
      }),
      prisma.provider.update({
        where: { id: providerBId },
        data: { customDomain: TEST_DOMAIN, domainVerified: true, domainVerifiedAt: new Date() },
      }),
    ])

    const fulfilled = results.filter(r => r.status === 'fulfilled')
    const rejected  = results.filter(r => r.status === 'rejected')

    // DOM-02: exactly one succeeds
    expect(fulfilled).toHaveLength(1)
    // DOM-03: the loser gets P2002
    expect(rejected).toHaveLength(1)
    const loserError = (rejected[0] as PromiseRejectedResult).reason
    expect(loserError).toBeInstanceOf(PrismaClientKnownRequestError)
    expect(loserError.code).toBe('P2002')

    // DOM-04: exactly one verified owner
    const verifiedOwners = await prisma.provider.findMany({
      where: { customDomain: TEST_DOMAIN, domainVerified: true },
      select: { id: true },
    })
    expect(verifiedOwners).toHaveLength(1)

    // DOM-05: the loser's domainVerified remains false
    const winnerId = (fulfilled[0] as PromiseFulfilledResult<any>).value.id
    const loserId  = winnerId === providerAId ? providerBId : providerAId
    const loser = await prisma.provider.findUnique({
      where: { id: loserId },
      select: { domainVerified: true },
    })
    expect(loser?.domainVerified).toBe(false)
  }, 30000)

  it('DOM-06 — route handler: real Prisma + real PostgreSQL; loser returns HTTP 409', async () => {
    // Reset: clear the winning provider's domain so both start unverified
    await prisma.provider.updateMany({
      where: { id: { in: [providerAId, providerBId] } },
      data: { customDomain: null, domainVerified: false, domainVerifiedAt: null },
    })

    const domain2 = `wla007-route-${Date.now()}.example.com`

    const { getServerSession } = await import('next-auth')

    // First handler call: Provider A
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: { id: 'dom-user-a', providerId: providerAId, role: 'provider' },
    } as any)
    const reqA = new NextRequest('http://localhost/api/instructor/domain/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: domain2 }),
    })
    const resA = await POST(reqA)

    // Provider A claims first — should succeed (200)
    expect(resA.status).toBe(200)

    // Second handler call: Provider B claims the same domain
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: { id: 'dom-user-b', providerId: providerBId, role: 'provider' },
    } as any)
    const reqB = new NextRequest('http://localhost/api/instructor/domain/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: domain2 }),
    })
    const resB = await POST(reqB)

    // Provider B must receive 409
    expect(resB.status).toBe(409)
    const jsonB = await resB.json()
    expect(jsonB.error).toMatch(/claimed by another|already verified/i)

    // Exactly one verified owner
    const owners = await prisma.provider.findMany({
      where: { customDomain: domain2, domainVerified: true },
      select: { id: true },
    })
    expect(owners).toHaveLength(1)
    expect(owners[0].id).toBe(providerAId)

    // Clean up this sub-test's domain
    await prisma.provider.updateMany({
      where: { id: { in: [providerAId, providerBId] } },
      data: { customDomain: null, domainVerified: false, domainVerifiedAt: null },
    })
  }, 30000)
})
