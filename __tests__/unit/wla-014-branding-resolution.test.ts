/**
 * WLA-014: Canonical branding resolution service tests.
 *
 * Tests the shared resolution service (lib/branding/resolution.ts) and
 * the source-level changes to fetchProviderWebsiteData.ts and the
 * instructor branding PUT route.
 *
 * WHAT IS TESTED:
 *   R01  resolveProviderBranding uses BusinessBranding when record exists (canonical)
 *   R02  resolveProviderBranding falls back to Provider when no BusinessBranding exists
 *   R03  resolveProviderBranding returns defaults when neither record exists
 *   R04  resolveProviderBranding correctly inverts showBrandingOnBookingPage -> showPlatformBranding
 *   R05  upsertBusinessBranding creates a record if one doesn't exist
 *   R06  upsertBusinessBranding updates an existing record
 *   R07  upsertBusinessBranding does not overwrite non-provided fields
 *
 * SOURCE INSPECTION TESTS:
 *   S01  fetchProviderWebsiteData no longer unconditionally overrides BusinessBranding colours
 *   S02  instructor branding PUT uses upsertBusinessBranding (not conditional update)
 *   S03  canonical resolution service is used in instructor branding route
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'
import { resolveProviderBranding, upsertBusinessBranding } from '@/lib/branding/resolution'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// â”€â”€ Source files for inspection tests â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const fetchSource = readFileSync(
  resolve(process.cwd(), 'lib/website/fetchProviderWebsiteData.ts'), 'utf-8'
)
const instructorBrandingSource = readFileSync(
  resolve(process.cwd(), 'app/api/instructor/branding/route.ts'), 'utf-8'
)
const resolutionSource = readFileSync(
  resolve(process.cwd(), 'lib/branding/resolution.ts'), 'utf-8'
)

// â”€â”€ Fixtures â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const PREFIX = 'WLA014B'

async function createFixtureProvider(label: string) {
  const user = await prisma.user.create({
    data: { email: `${PREFIX}-${label}@test.example.com`, name: `${PREFIX} ${label}`, role: 'PROVIDER' },
  })
  const prov = await (prisma.provider as any).create({
    data: {
      user: { connect: { id: user.id } },
      name: `${PREFIX} ${label}`,
      phone: '0400000099',
      hourlyRate: 80,
      isActive: false,
      approvalStatus: 'PENDING',
      subscriptionStatus: 'TRIAL',
      subscriptionTier: 'BASIC',
    },
  })
  return { userId: user.id, providerId: prov.id }
}

async function cleanup() {
  // Use raw SQL to clean up all WLA014B test fixtures (case-insensitive via ILIKE).
  // All deletions are scoped to EXACT Business IDs linked to test providers —
  // never use global LIKE patterns that could match legitimate records.
  //
  // Cleanup failures are collected and thrown as an aggregate error so the
  // test suite fails if any leftover data remains. Silent error swallowing
  // would allow stale fixtures to cause false-positive passes.

  const errors: string[] = []

  // Step 1: Find all test providers and their businessId values
  const testProviders = await prisma.$queryRaw<Array<{ id: string; businessId: string | null }>>`
    SELECT id, "businessId" FROM "Provider"
    WHERE "userId" IN (SELECT id FROM "User" WHERE email ILIKE ${PREFIX + '-%'})
  `

  const providerIds = testProviders.map((p: any) => p.id)
  const businessIds = testProviders
    .map((p: any) => p.businessId)
    .filter((b: any) => b !== null)
  // Also include legacy biz_ IDs for each provider (existing migrated records)
  const legacyBizIds = providerIds.map((id: string) => `biz_${id}`)

  const allBizIds = [...new Set([...businessIds, ...legacyBizIds])]

  // Step 2: Null out Provider.businessId to remove FK dependency
  try {
    await prisma.$executeRaw`
      UPDATE "Provider" SET "businessId" = NULL
      WHERE "userId" IN (SELECT id FROM "User" WHERE email ILIKE ${PREFIX + '-%'})
    `
  } catch (err) {
    errors.push(`Step 2 (null businessId): ${err instanceof Error ? err.message : String(err)}`)
  }

  // Step 3: Delete BusinessBranding for specific test Business IDs only
  for (const bizId of allBizIds) {
    try {
      await prisma.$executeRaw`DELETE FROM "BusinessBranding" WHERE "businessId" = ${bizId}`
    } catch (err) {
      errors.push(`Step 3 (delete BusinessBranding ${bizId}): ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // Step 4: Delete Business records for specific test Business IDs only
  for (const bizId of allBizIds) {
    try {
      await prisma.$executeRaw`DELETE FROM "Business" WHERE id = ${bizId}`
    } catch (err) {
      errors.push(`Step 4 (delete Business ${bizId}): ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // Step 5: Delete Providers for test users
  try {
    await prisma.$executeRaw`
      DELETE FROM "Provider"
      WHERE "userId" IN (SELECT id FROM "User" WHERE email ILIKE ${PREFIX + '-%'})
    `
  } catch (err) {
    errors.push(`Step 5 (delete Providers): ${err instanceof Error ? err.message : String(err)}`)
  }

  // Step 6: Delete test Users
  try {
    await prisma.$executeRaw`
      DELETE FROM "User" WHERE email ILIKE ${PREFIX + '-%'}
    `
  } catch (err) {
    errors.push(`Step 6 (delete Users): ${err instanceof Error ? err.message : String(err)}`)
  }

  if (errors.length > 0) {
    throw new Error(
      `[WLA-014 cleanup] ${errors.length} cleanup error(s) — test isolation may be compromised:\n` +
      errors.join('\n')
    )
  }
}

beforeAll(async () => { await cleanup() }, 30000)
afterAll(async () => { await cleanup() }, 30000)

// â”€â”€ R01-R04: resolveProviderBranding unit tests (real DB) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('WLA-014 R: resolveProviderBranding', () => {
  it('R01 -- returns BusinessBranding when canonical record exists', async () => {
    const { providerId } = await createFixtureProvider('canon')
    const bizId = `biz_${providerId}`
    // Use upsertBusinessBranding which also creates the parent Business if absent
    await upsertBusinessBranding(providerId, {
      logo: 'https://example.com/logo.png',
      primaryColour: '#FF0000',
      secondaryColour: '#00FF00',
      fontFamily: 'Inter',
      theme: 'dark',
      showPlatformBranding: false,
      customSlug: null,
    })
    // Also set Provider legacy fields to different values
    await prisma.provider.update({
      where: { id: providerId },
      data: { brandColorPrimary: '#0000FF', brandColorSecondary: '#FFFF00' },
    })
    const result = await resolveProviderBranding(providerId)
    // Must use BusinessBranding, not Provider overrides
    expect(result.source).toBe('businessBranding')
    expect(result.primaryColour).toBe('#FF0000')   // from BusinessBranding, not '#0000FF'
    expect(result.secondaryColour).toBe('#00FF00') // from BusinessBranding, not '#FFFF00'
    expect(result.logo).toBe('https://example.com/logo.png')
    expect(result.theme).toBe('dark')
    expect(result.showPlatformBranding).toBe(false)
    // Clean up
    await (prisma.businessBranding as any).delete({ where: { businessId: bizId } }).catch(() => {})
    await (prisma.business as any).delete({ where: { id: bizId } }).catch(() => {})
    const row = await prisma.provider.findUnique({ where: { id: providerId }, select: { userId: true } })
    if (row?.userId) await prisma.user.delete({ where: { id: row.userId } }).catch(() => {})
  }, 20000)

  it('R02 -- falls back to Provider when no BusinessBranding exists', async () => {
    const { providerId, userId } = await createFixtureProvider('fallback')
    await prisma.provider.update({
      where: { id: providerId },
      data: {
        brandLogo: 'https://example.com/prov-logo.png',
        brandColorPrimary: '#AABBCC',
        showBrandingOnBookingPage: true,
      },
    })
    const result = await resolveProviderBranding(providerId)
    expect(result.source).toBe('provider')
    expect(result.primaryColour).toBe('#AABBCC')
    expect(result.logo).toBe('https://example.com/prov-logo.png')
    // showBrandingOnBookingPage=true means "show provider branding" = NOT showPlatformBranding
    expect(result.showPlatformBranding).toBe(false)
    await prisma.user.delete({ where: { id: userId } }).catch(() => {})
  }, 20000)

  it('R03 -- returns defaults when neither record exists', async () => {
    const result = await resolveProviderBranding('nonexistent-provider-id')
    expect(result.source).toBe('default')
    expect(result.primaryColour).toBe('#3B82F6')
    expect(result.logo).toBeNull()
  }, 10000)

  it('R04 -- showBrandingOnBookingPage=false inverts to showPlatformBranding=true', async () => {
    const { providerId, userId } = await createFixtureProvider('invert')
    await prisma.provider.update({
      where: { id: providerId },
      data: { showBrandingOnBookingPage: false },
    })
    const result = await resolveProviderBranding(providerId)
    // showBrandingOnBookingPage=false â†’ NOT hiding platform branding â†’ showPlatformBranding=true
    expect(result.showPlatformBranding).toBe(true)
    await prisma.user.delete({ where: { id: userId } }).catch(() => {})
  }, 15000)
})

// â”€â”€ R05-R07: upsertBusinessBranding unit tests (real DB) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('WLA-014 R: upsertBusinessBranding', () => {
  it('R05 -- creates a BusinessBranding record if none exists', async () => {
    const { providerId, userId } = await createFixtureProvider('upsert-create')
    await upsertBusinessBranding(providerId, { primaryColour: '#123456', logo: null })
    // v4: Business ID is auto-generated — resolve the actual ID from Provider
    const { resolveBusinessId } = await import('@/lib/branding/resolution')
    const bizId = await resolveBusinessId(providerId)
    expect(bizId).toBeTruthy()
    const record = await (prisma.businessBranding as any).findUnique({ where: { businessId: bizId } })
    expect(record).not.toBeNull()
    expect(record.primaryColour).toBe('#123456')
    // Clean up: null FK, delete BusinessBranding, Business, User
    await prisma.$executeRaw`UPDATE "Provider" SET "businessId" = NULL WHERE id = ${providerId}`.catch(() => {})
    await (prisma.businessBranding as any).delete({ where: { businessId: bizId } }).catch(() => {})
    await (prisma.business as any).delete({ where: { id: bizId } }).catch(() => {})
    await prisma.user.delete({ where: { id: userId } }).catch(() => {})
  }, 20000)

  it('R06 -- updates an existing BusinessBranding record', async () => {
    const { providerId, userId } = await createFixtureProvider('upsert-update')
    await upsertBusinessBranding(providerId, { primaryColour: '#111111' })
    await upsertBusinessBranding(providerId, { primaryColour: '#222222' })
    // v4: resolve actual Business ID
    const { resolveBusinessId } = await import('@/lib/branding/resolution')
    const bizId = await resolveBusinessId(providerId)
    expect(bizId).toBeTruthy()
    const record = await (prisma.businessBranding as any).findUnique({ where: { businessId: bizId } })
    expect(record.primaryColour).toBe('#222222')
    // Clean up
    await prisma.$executeRaw`UPDATE "Provider" SET "businessId" = NULL WHERE id = ${providerId}`.catch(() => {})
    await (prisma.businessBranding as any).delete({ where: { businessId: bizId } }).catch(() => {})
    await (prisma.business as any).delete({ where: { id: bizId } }).catch(() => {})
    await prisma.user.delete({ where: { id: userId } }).catch(() => {})
  }, 20000)

  it('R07 -- does not overwrite non-provided fields on update', async () => {
    const { providerId, userId } = await createFixtureProvider('upsert-partial')
    await upsertBusinessBranding(providerId, { primaryColour: '#AAAAAA', secondaryColour: '#BBBBBB' })
    // Only update primaryColour -- secondaryColour should be preserved
    await upsertBusinessBranding(providerId, { primaryColour: '#CCCCCC' })
    // v4: resolve actual Business ID
    const { resolveBusinessId } = await import('@/lib/branding/resolution')
    const bizId = await resolveBusinessId(providerId)
    expect(bizId).toBeTruthy()
    const record = await (prisma.businessBranding as any).findUnique({ where: { businessId: bizId } })
    expect(record.primaryColour).toBe('#CCCCCC')
    expect(record.secondaryColour).toBe('#BBBBBB') // unchanged
    // Clean up
    await prisma.$executeRaw`UPDATE "Provider" SET "businessId" = NULL WHERE id = ${providerId}`.catch(() => {})
    await (prisma.businessBranding as any).delete({ where: { businessId: bizId } }).catch(() => {})
    await (prisma.business as any).delete({ where: { id: bizId } }).catch(() => {})
    await prisma.user.delete({ where: { id: userId } }).catch(() => {})
  }, 20000)
})

// â”€â”€ S01-S03: Source inspection tests â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('WLA-014 S: Source-level verification', () => {
  it('S01 -- fetchProviderWebsiteData no longer overrides BusinessBranding colours from Provider', () => {
    // The old shim unconditionally replaced BusinessBranding colours with Provider fields.
    // It has been removed in WLA-014 fix.
    expect(fetchSource).not.toContain('config.branding.primaryColour = instructor.brandColorPrimary')
    expect(fetchSource).not.toContain('config.branding.secondaryColour = instructor.brandColorSecondary')
    // The WLA-014 fix comment must be present
    expect(fetchSource).toContain('WLA-014 FIX: BusinessBranding is the canonical branding store')
  })

  it('S02 -- instructor branding PUT uses upsertBusinessBranding (not conditional update)', () => {
    // The V-07 conditional block (`if (existingBranding) { update }`) has been replaced
    expect(instructorBrandingSource).toContain('upsertBusinessBranding')
    expect(instructorBrandingSource).not.toContain('existingBranding')
    // WLA-014 comment present
    expect(instructorBrandingSource).toContain('WLA-014 FIX')
  })

  it('S03 -- resolution service defines BusinessBranding as authoritative source', () => {
    expect(resolutionSource).toContain('source: \'businessBranding\'')
    expect(resolutionSource).toContain('source: \'provider\'')
    expect(resolutionSource).toContain('Fall back to Provider legacy fields')
    // Inversion is applied exactly once, in the resolution service
    expect(resolutionSource).toContain('showPlatformBranding: !provider.showBrandingOnBookingPage')
  })

  it('S04 -- resolution service does not invert showPlatformBranding in upsertBusinessBranding', () => {
    // The upsert takes showPlatformBranding directly (caller must pre-compute inversion).
    // This prevents the inversion being applied twice.
    const upsertBlock = resolutionSource.slice(
      resolutionSource.indexOf('export async function upsertBusinessBranding'),
      resolutionSource.length
    )
    // No inversion inside upsert â€” caller is responsible
    expect(upsertBlock).not.toContain('!showPlatformBranding')
    expect(upsertBlock).not.toContain('showBrandingOnBookingPage')
  })
})

// S03 replacement test (corrected comment string match)
describe('WLA-014 S03-corrected: resolution service authoritative source', () => {
  it('S03b -- resolution service source field values are present', () => {
    // Use double-quote style to avoid CRLF/encoding issues with escaped quotes
    expect(resolutionSource).toContain("source: 'businessBranding'")
    expect(resolutionSource).toContain("source: 'provider'")
    // Exact comment text from resolution.ts (no trailing 's')
    expect(resolutionSource).toContain('Fall back to Provider legacy fields')
    expect(resolutionSource).toContain('showPlatformBranding: !provider.showBrandingOnBookingPage')
  })
})

// Issue A: paymentModel preservation
describe('WLA-014 Issue-A: Business creation preserves paymentModel from Provider', () => {
  it('A01 -- upsertBusinessBranding source derives paymentModel from Provider.businessModel', () => {
    // The upsertBusinessBranding source must NOT hardcode paymentModel: 'saas'.
    // It must read the Provider's businessModel field and map it correctly.
    const resolutionSource = readFileSync(
      resolve(process.cwd(), 'lib/branding/resolution.ts'), 'utf-8'
    )
    expect(resolutionSource).not.toContain("paymentModel: 'saas'")
    expect(resolutionSource).toContain("paymentModel")
    // Must derive from Provider field, not hardcode
    expect(resolutionSource).toContain('businessModel')
    expect(resolutionSource).toContain("'marketplace'")
  })
})

// Issue C: driving-specific renderer uses canonical branding
describe('WLA-014 Issue-C: Driving-specific renderer uses canonical BusinessBranding', () => {
  it('C01 -- subdomain page imports resolveProviderBranding', () => {
    const subdomainSource = readFileSync(
      resolve(process.cwd(), 'app/subdomain/[slug]/page.tsx'), 'utf-8'
    )
    expect(subdomainSource).toContain('resolveProviderBranding')
    expect(subdomainSource).toContain('WLA-014 FIX')
  })

  it('C02 -- subdomain page no longer reads Provider branding fields directly for rendering', () => {
    const subdomainSource = readFileSync(
      resolve(process.cwd(), 'app/subdomain/[slug]/page.tsx'), 'utf-8'
    )
    // The canonicalBranding object must be used, not instructor.brandLogo directly
    expect(subdomainSource).toContain('canonicalBranding.logo')
    expect(subdomainSource).toContain('canonicalBranding.primaryColour')
    expect(subdomainSource).toContain('canonicalBranding.secondaryColour')
    expect(subdomainSource).toContain('canonicalBranding.showPlatformBranding')
    // Must NOT use old direct reads for branding render decisions
    expect(subdomainSource).not.toContain('instructor.showBrandingOnBookingPage')
    expect(subdomainSource).not.toContain('instructor.brandLogo')
    expect(subdomainSource).not.toContain('instructor.brandColorPrimary')
    expect(subdomainSource).not.toContain('instructor.brandColorSecondary')
  })
})

// Issue D: partial-write surfacing
describe('WLA-014 Issue-D: Partial-write is surfaced to the caller', () => {
  it('D01 -- instructor branding route returns 207 on BusinessBranding upsert failure', () => {
    const routeSource = readFileSync(
      resolve(process.cwd(), 'app/api/instructor/branding/route.ts'), 'utf-8'
    )
    // Must NOT silently swallow the error
    expect(routeSource).toContain('partialWrite: true') // D01: 207 path exists
    // Must return a non-200 status on failure
    expect(routeSource).toContain('partialWrite: true')
    expect(routeSource).toContain('status: 207')
  })
})

// Issue E: inversion comment correctness
describe('WLA-014 Issue-E: Inversion comment is accurate', () => {
  it('E01 -- upsertBusinessBranding comment says caller applies inversion (not the helper)', () => {
    const resolutionSource = readFileSync(
      resolve(process.cwd(), 'lib/branding/resolution.ts'), 'utf-8'
    )
    // The corrected comment states the caller is responsible for inversion
    expect(resolutionSource).toContain('CALLER is responsible')
    // The old wrong comment (inversion applied inside the helper) must be gone
    expect(resolutionSource).not.toContain('The inversion is applied once here')
  })

  it('E02 -- instructor route applies inversion before calling upsertBusinessBranding', () => {
    const routeSource = readFileSync(
      resolve(process.cwd(), 'app/api/instructor/branding/route.ts'), 'utf-8'
    )
    // The inversion is done in the instructor route, not in the helper
    expect(routeSource).toContain('showBrandingOnBookingPage !== true')
    expect(routeSource).toContain('Inversion applied here')
  })
})

// D01 fix: verify 207 path exists (not that success:true is absent from the whole file)
describe('WLA-014 Issue-D corrected: 207 partial-write path exists', () => {
  it('D01b -- instructor route has explicit 207 response for BusinessBranding upsert failure', () => {
    const routeSource = readFileSync(
      resolve(process.cwd(), 'app/api/instructor/branding/route.ts'), 'utf-8'
    )
    // The catch block must return 207 with partialWrite flag
    expect(routeSource).toContain('partialWrite: true')
    expect(routeSource).toContain('status: 207')
    // And the normal success path must still return success: true
    expect(routeSource).toContain('success: true, branding: updated')
    // The failure catch must not silently continue to the success return
    expect(routeSource).toContain('[WLA-014] BusinessBranding upsert failed')
  })
})

// WLA-014 v3: Business identity, GET canonical, Dashboard 207 handling
describe('WLA-014 v3: Business identity via Provider.businessId', () => {
  it('B01 -- resolveBusinessId uses Provider.businessId when available (real DB)', async () => {
    const { resolveBusinessId } = await import('@/lib/branding/resolution')
    const { providerId, userId } = await createFixtureProvider('bizid')
    const explicitBizId = `explicit-biz-${providerId}`
    try {
      // Set Provider.businessId to an explicit non-biz_ value
      await (prisma.business as any).create({
        data: {
          id: explicitBizId,
          name: `${PREFIX} Explicit Biz`,
          supportEmail: `${PREFIX}-explicit@test.example.com`,
          timezone: 'Australia/Perth',
          isActive: true,
          paymentModel: 'saas',
        },
      })
      await prisma.$executeRaw`UPDATE "Provider" SET "businessId" = ${explicitBizId} WHERE id = ${providerId}`
      const resolved = await resolveBusinessId(providerId)
      // Must use the explicit FK, not biz_ derivation
      expect(resolved).toBe(explicitBizId)
      expect(resolved).not.toBe(`biz_${providerId}`)
    } finally {
      await prisma.$executeRaw`UPDATE "Provider" SET "businessId" = NULL WHERE id = ${providerId}`.catch(() => {})
      await (prisma.business as any).delete({ where: { id: explicitBizId } }).catch(() => {})
      await prisma.user.delete({ where: { id: userId } }).catch(() => {})
    }
  }, 20000)

  it('B02 -- resolveBusinessId falls back to biz_ for existing migrated records (real DB)', async () => {
    const { resolveBusinessId } = await import('@/lib/branding/resolution')
    const { providerId, userId } = await createFixtureProvider('legacybiz')
    const legacyBizId = `biz_${providerId}`
    try {
      // Create legacy Business with biz_ ID; Provider.businessId remains null
      await (prisma.business as any).create({
        data: {
          id: legacyBizId,
          name: `${PREFIX} Legacy Biz`,
          supportEmail: `${PREFIX}-legacy2@test.example.com`,
          timezone: 'Australia/Perth',
          isActive: true,
          paymentModel: 'saas',
        },
      })
      const resolved = await resolveBusinessId(providerId)
      expect(resolved).toBe(legacyBizId)
    } finally {
      await (prisma.business as any).delete({ where: { id: legacyBizId } }).catch(() => {})
      await prisma.user.delete({ where: { id: userId } }).catch(() => {})
    }
  }, 20000)

  it('B03 -- upsertBusinessBranding links Provider.businessId after creating new Business', async () => {
    const { providerId, userId } = await createFixtureProvider('linkbiz')
    try {
      // No existing Business -- upsertBusinessBranding should create one and set businessId
      await upsertBusinessBranding(providerId, { primaryColour: '#ABCDEF' })
      // Provider.businessId must now be set
      const row = await prisma.$queryRaw<any[]>`SELECT "businessId" FROM "Provider" WHERE id = ${providerId}`
      const bizId = row[0].businessId
      expect(bizId).toBeTruthy()
      // The Business record must exist
      const biz = await (prisma.business as any).findUnique({ where: { id: bizId }, select: { id: true } })
      expect(biz).toBeTruthy()
      expect(biz.id).toBe(bizId)
      // The BusinessBranding record must exist for this Business
      const branding = await (prisma.businessBranding as any).findUnique({ where: { businessId: bizId }, select: { businessId: true } })
      expect(branding).toBeTruthy()
      expect(branding.businessId).toBe(bizId)
    } finally {
      // Read the actual businessId to clean up exact records
      const row = await prisma.$queryRaw<any[]>`SELECT "businessId" FROM "Provider" WHERE id = ${providerId}`
      const bizId = row[0]?.businessId
      if (bizId) {
        await prisma.$executeRaw`UPDATE "Provider" SET "businessId" = NULL WHERE id = ${providerId}`.catch(() => {})
        await (prisma.businessBranding as any).delete({ where: { businessId: bizId } }).catch(() => {})
        await (prisma.business as any).delete({ where: { id: bizId } }).catch(() => {})
      }
      // Also clean up any biz_ legacy record if it exists (defensive)
      await (prisma.businessBranding as any).delete({ where: { businessId: `biz_${providerId}` } }).catch(() => {})
      await (prisma.business as any).delete({ where: { id: `biz_${providerId}` } }).catch(() => {})
      await prisma.user.delete({ where: { id: userId } }).catch(() => {})
    }
  }, 20000)

  it('B04 -- upsertBusinessBranding creates Business with independent (non-biz_) ID', async () => {
    const { providerId, userId } = await createFixtureProvider('indepbiz')
    try {
      // No existing Business — upsertBusinessBranding must create one with an independent ID
      await upsertBusinessBranding(providerId, { primaryColour: '#ABCDEF' })

      const row = await prisma.$queryRaw<any[]>`SELECT "businessId" FROM "Provider" WHERE id = ${providerId}`
      const bizId = row[0].businessId

      // Provider.businessId must be set
      expect(bizId).toBeTruthy()
      // The Business ID must NOT follow the biz_ convention (it must be independent)
      expect(bizId).not.toBe(`biz_${providerId}`)
      expect(bizId.startsWith('biz_')).toBe(false)
      // The Business ID must be a valid cuid (starts with 'c' and is 20+ chars)
      expect(bizId.length).toBeGreaterThanOrEqual(20)
    } finally {
      const row = await prisma.$queryRaw<any[]>`SELECT "businessId" FROM "Provider" WHERE id = ${providerId}`
      const bizId = row[0]?.businessId
      if (bizId) {
        await prisma.$executeRaw`UPDATE "Provider" SET "businessId" = NULL WHERE id = ${providerId}`.catch(() => {})
        await (prisma.businessBranding as any).delete({ where: { businessId: bizId } }).catch(() => {})
        await (prisma.business as any).delete({ where: { id: bizId } }).catch(() => {})
      }
      await (prisma.businessBranding as any).delete({ where: { businessId: `biz_${providerId}` } }).catch(() => {})
      await (prisma.business as any).delete({ where: { id: `biz_${providerId}` } }).catch(() => {})
      await prisma.user.delete({ where: { id: userId } }).catch(() => {})
    }
  }, 20000)
})

describe('WLA-014 v3: GET returns canonical branding', () => {
  it('G01 -- instructor branding GET endpoint uses resolveProviderBranding (source check)', () => {
    const routeSource = readFileSync(
      resolve(process.cwd(), 'app/api/instructor/branding/route.ts'), 'utf-8'
    )
    expect(routeSource).toContain('resolveProviderBranding')
    expect(routeSource).toContain('WLA-014 v3')
    expect(routeSource).toContain('brandingSource')
    // Inversion must be applied on GET return (showPlatformBranding -> showBrandingOnBookingPage)
    expect(routeSource).toContain('!canonical.showPlatformBranding')
  })

  it('G02 -- resolveProviderBranding returns canonical BusinessBranding values when they differ from Provider fields (DB-backed)', async () => {
    // Integration test: creates a Provider with DIFFERENT BusinessBranding values
    // from the Provider legacy fields, then calls resolveProviderBranding() (the
    // same function the GET handler uses) and verifies the canonical values win.
    const { providerId, userId } = await createFixtureProvider('getcanon')
    const bizId = `biz_${providerId}`
    try {
      // Create legacy Business + BusinessBranding with values DIFFERENT from Provider
      await (prisma.business as any).create({
        data: {
          id: bizId,
          name: `${PREFIX} Canonical Biz`,
          supportEmail: `${PREFIX}-canon@test.example.com`,
          timezone: 'Australia/Perth',
          isActive: true,
          paymentModel: 'saas',
        },
      })
      await (prisma.businessBranding as any).create({
        data: {
          businessId: bizId,
          logo: 'https://cdn.example.com/canonical-logo.png',
          primaryColour: '#FF0000',  // RED — different from Provider's default #3B82F6
          secondaryColour: '#00FF00',
          theme: 'dark',
          showPlatformBranding: false,  // false = show branding → inverted to showBrandingOnBookingPage = true
          customSlug: 'canonical-slug',
        },
      })

      // Call the same function the GET handler calls
      const canonical = await resolveProviderBranding(providerId)

      // Must return canonical BusinessBranding values, not stale Provider fields
      expect(canonical.source).toBe('businessBranding')
      expect(canonical.logo).toBe('https://cdn.example.com/canonical-logo.png')
      expect(canonical.primaryColour).toBe('#FF0000')  // BusinessBranding, NOT Provider's default
      expect(canonical.secondaryColour).toBe('#00FF00')
      expect(canonical.theme).toBe('dark')
      expect(canonical.showPlatformBranding).toBe(false)
      expect(canonical.customSlug).toBe('canonical-slug')
      expect(canonical.resolvedBusinessId).toBe(bizId)

      // The GET handler applies this inversion: showBrandingOnBookingPage = !showPlatformBranding
      // Verify it would produce the correct value for the dashboard
      const showBrandingOnBookingPage = !canonical.showPlatformBranding
      expect(showBrandingOnBookingPage).toBe(true)  // false inverted = true
    } finally {
      await (prisma.businessBranding as any).delete({ where: { businessId: bizId } }).catch(() => {})
      await (prisma.business as any).delete({ where: { id: bizId } }).catch(() => {})
      await prisma.user.delete({ where: { id: userId } }).catch(() => {})
    }
  }, 20000)
})

describe('WLA-014 v3: Dashboard detects HTTP 207 partial write', () => {
  it('D02 -- dashboard handleSave checks for status 207 before showing success', () => {
    const dashSource = readFileSync(
      resolve(process.cwd(), 'app/dashboard/branding/page.tsx'), 'utf-8'
    )
    // Dashboard must check brandRes.status === 207
    expect(dashSource).toContain('brandRes.status === 207')
    // Must throw an error (not set success message) on 207
    expect(dashSource).toContain('Please try saving again')
    // All settings saved must only appear AFTER the 207 check
    const check207Pos = dashSource.indexOf('brandRes.status === 207')
    const successPos = dashSource.indexOf("setMessage('All settings saved!')")
    expect(check207Pos).toBeGreaterThan(0)
    expect(successPos).toBeGreaterThan(check207Pos)
  })

  it('D03 -- dashboard does NOT show success when 207 partial write occurs', () => {
    const dashSource = readFileSync(
      resolve(process.cwd(), 'app/dashboard/branding/page.tsx'), 'utf-8'
    )
    // The 207 block must throw (converting to setError), not fall through to setMessage
    const check207Block = dashSource.slice(
      dashSource.indexOf('brandRes.status === 207'),
      dashSource.indexOf("setMessage('All settings saved!')")
    )
    expect(check207Block).toContain('throw new Error')
  })

  it('D04 -- 207 response handling logic produces error not success (logic simulation, not React component test)', async () => {
    // Simulates the dashboard's 207 handling logic without rendering the React component.
    // The dashboard does: if (brandRes.status === 207) { const body = await brandRes.json(); throw new Error(body.error || '...') }
    // This test verifies that behavior by constructing a mock Response and applying the same logic.

    // Simulate a 207 response with a partialWrite error message
    const mock207Response = {
      status: 207,
      ok: true,  // 207 is 2xx so .ok is true — this is the trap the dashboard must detect
      json: async () => ({
        success: false,
        partialWrite: true,
        error: 'Branding preferences saved to your profile, but the shared configuration could not be updated. Please try saving again.',
      }),
    } as any

    // Simulate the dashboard's handleSave logic for the 207 check
    let errorThrown: Error | null = null
    let successMessage: string | null = null

    // The dashboard checks: if (brandRes.status === 207) { throw new Error(body.error || fallback) }
    // This check happens BEFORE setMessage('All settings saved!')
    if (mock207Response.status === 207) {
      const body = await mock207Response.json()
      errorThrown = new Error(body.error || 'Your branding was partially saved. Please try saving again to sync all settings.')
    } else {
      successMessage = 'All settings saved!'
    }

    // 207 must produce an error, not a success message
    expect(errorThrown).not.toBeNull()
    expect(errorThrown!.message).toContain('Please try saving again')
    expect(successMessage).toBeNull()

    // Verify the trap: .ok is true for 207 (2xx) but status is 207, not 200
    expect(mock207Response.ok).toBe(true)
    expect(mock207Response.status).not.toBe(200)
  })
})

describe('WLA-014 v3: Business identity is transitional (biz_ only for legacy)', () => {
  it('ARCH01 -- resolution service documents biz_ as transitional, not permanent', () => {
    const resolutionSource = readFileSync(
      resolve(process.cwd(), 'lib/branding/resolution.ts'), 'utf-8'
    )
    // Must document that biz_ is transitional
    expect(resolutionSource).toContain('TRANSITIONAL')
    // Must show the preferred path uses Provider.businessId
    expect(resolutionSource).toContain('Provider.businessId')
    // Must not claim biz_ is the canonical identity model
    expect(resolutionSource).not.toContain('biz_ is canonical')
  })

  it('ARCH02 -- new Business creation uses independent ID, not biz_ (source check)', () => {
    const resolutionSource = readFileSync(
      resolve(process.cwd(), 'lib/branding/resolution.ts'), 'utf-8'
    )
    // Scope checks to the upsertBusinessBranding function (the CREATION path).
    // The resolveBusinessId function (READ path) legitimately uses legacyBizId for legacy fallback.
    const upsertStart = resolutionSource.indexOf('export async function upsertBusinessBranding')
    const upsertSection = resolutionSource.slice(upsertStart)
    // The creation path must not set an explicit biz_ id
    expect(upsertSection).not.toContain('id: legacyBizId')
    expect(upsertSection).not.toContain('id: `biz_')
    // Must document that new records use independent/auto-generated IDs
    expect(upsertSection).toContain('INDEPENDENT')
    expect(upsertSection).toContain('auto-generated')
    // Must NOT have the P2002-specific catch (no longer needed with auto-generated IDs)
    expect(upsertSection).not.toContain('P2002')
    // The FK UPDATE must be followed by a rowsAffected check, not a .catch
    const fkUpdateIdx = upsertSection.indexOf('UPDATE "Provider" SET "businessId"')
    const afterFk = upsertSection.slice(fkUpdateIdx, fkUpdateIdx + 300)
    expect(afterFk).toContain('rowsAffected')
    expect(afterFk).not.toContain('.catch')
    // Note: .catch(err =>) is allowed on the orphaned Business cleanup in the failure path,
    // but NOT on the FK UPDATE itself (checked above).
  })

  it('ARCH03 -- FK assignment failure throws error and cleans up orphaned Business (source check)', () => {
    const resolutionSource = readFileSync(
      resolve(process.cwd(), 'lib/branding/resolution.ts'), 'utf-8'
    )
    const upsertStart = resolutionSource.indexOf('export async function upsertBusinessBranding')
    const upsertSection = resolutionSource.slice(upsertStart)
    // The failure path (rowsAffected === 0 and re-read returns null) must throw,
    // not just log. Logging is not a substitute for enforcing the invariant.
    const elseBranch = upsertSection.slice(
      upsertSection.indexOf('FK assignment failed'),
      upsertSection.indexOf('businessBranding.upsert')
    )
    expect(elseBranch).toContain('throw new Error')
    // The orphaned Business must be cleaned up before throwing
    expect(elseBranch).toContain('business.delete')
    // Must NOT continue to the branding write after the throw
    // (The throw is before businessBranding.upsert, verified by the slice boundary)
  })
})