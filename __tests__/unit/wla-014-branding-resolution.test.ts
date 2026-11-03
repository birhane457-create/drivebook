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
  // Use raw SQL to clean up all WLA014B test fixtures
  await prisma.$executeRaw`
    UPDATE "Provider" SET "businessId" = NULL
    WHERE "userId" IN (SELECT id FROM "User" WHERE email LIKE 'wla014b-%')
  `.catch(() => {})
  await prisma.$executeRaw`
    DELETE FROM "BusinessBranding" WHERE "businessId" LIKE 'biz_%'
    AND "businessId" IN (
      SELECT 'biz_' || p.id FROM "Provider" p
      JOIN "User" u ON u.id = p."userId"
      WHERE u.email ILIKE 'WLA014B-%'
    )
  `.catch(() => {})
  await prisma.user.deleteMany({
    where: { email: { startsWith: `${PREFIX.toLowerCase()}-` } },
  }).catch(() => {})
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
    const bizId = `biz_${providerId}`
    await upsertBusinessBranding(providerId, { primaryColour: '#123456', logo: null })
    const record = await (prisma.businessBranding as any).findUnique({ where: { businessId: bizId } })
    expect(record).not.toBeNull()
    expect(record.primaryColour).toBe('#123456')
    // Clean up BusinessBranding -> Business -> User (cascades Provider)
    await (prisma.businessBranding as any).delete({ where: { businessId: bizId } }).catch(() => {})
    await (prisma.business as any).delete({ where: { id: bizId } }).catch(() => {})
    await prisma.user.delete({ where: { id: userId } }).catch(() => {})
  }, 20000)

  it('R06 -- updates an existing BusinessBranding record', async () => {
    const { providerId, userId } = await createFixtureProvider('upsert-update')
    const bizId = `biz_${providerId}`
    await upsertBusinessBranding(providerId, { primaryColour: '#111111' })
    await upsertBusinessBranding(providerId, { primaryColour: '#222222' })
    const record = await (prisma.businessBranding as any).findUnique({ where: { businessId: bizId } })
    expect(record.primaryColour).toBe('#222222')
    // Clean up
    await (prisma.businessBranding as any).delete({ where: { businessId: bizId } }).catch(() => {})
    await (prisma.business as any).delete({ where: { id: bizId } }).catch(() => {})
    await prisma.user.delete({ where: { id: userId } }).catch(() => {})
  }, 20000)

  it('R07 -- does not overwrite non-provided fields on update', async () => {
    const { providerId, userId } = await createFixtureProvider('upsert-partial')
    const bizId = `biz_${providerId}`
    await upsertBusinessBranding(providerId, { primaryColour: '#AAAAAA', secondaryColour: '#BBBBBB' })
    // Only update primaryColour -- secondaryColour should be preserved
    await upsertBusinessBranding(providerId, { primaryColour: '#CCCCCC' })
    const record = await (prisma.businessBranding as any).findUnique({ where: { businessId: bizId } })
    expect(record.primaryColour).toBe('#CCCCCC')
    expect(record.secondaryColour).toBe('#BBBBBB') // unchanged
    // Clean up
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
