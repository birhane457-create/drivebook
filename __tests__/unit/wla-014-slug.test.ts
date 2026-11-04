/**
 * WLA-014-SLUG: Slug uniqueness enforcement and cross-table consistency tests.
 *
 * Finding corrected: Provider.customSlug @unique and migration already exist.
 * Remaining gaps addressed:
 *   - P2002 handling (both routes return 409)
 *   - Business PUT atomic transaction
 *   - Cross-table slug check (both routes)
 *   - SlugRegistry table: DB-level cross-table uniqueness (race-safe)
 *   - Business ID exclusion bug fixed (uses resolveBusinessId, not biz_ assumption)
 *
 * WHAT IS TESTED:
 *   IDX01  Schema: Provider.customSlug @unique present
 *   IDX02  Migration creates Provider_customSlug_key
 *   IDX03  SlugRegistry model in schema with @unique on slug
 *   IDX04  SlugRegistry migration exists
 *   P2002A  Instructor PUT catches P2002 on slug/customSlug → 409
 *   P2002B  Business PUT catches P2002 on slug/customSlug → 409
 *   CROSS01 Instructor PUT removed legacy biz_ exclusion (uses registry instead)
 *   CROSS02 Business PUT checks both tables (V-16 FIX)
 *   TX01    Business PUT wraps writes in transaction (source check)
 *   TX02    Instructor PUT wraps Provider update + slug registry in transaction
 *   REG01   claimSlug() creates a SlugRegistry row (real DB)
 *   REG02   claimSlug() throws P2002 for a duplicate slug (real DB)
 *   REG03   updateSlugClaim() releases old entry and creates new one (real DB)
 *   DB01    Provider unique index rejects a duplicate customSlug (real DB)
 *   DB02    BusinessBranding unique index rejects a duplicate customSlug (real DB)
 *   DB03    Cross-table gap is closed: SlugRegistry prevents same slug in both tables
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// ── Source files ─────────────────────────────────────────────────────────────

const instructorPutSource = readFileSync(
  resolve(process.cwd(), 'app/api/instructor/branding/route.ts'), 'utf-8'
)
const businessPutSource = readFileSync(
  resolve(process.cwd(), 'app/api/business/branding/route.ts'), 'utf-8'
)
const schemaSrc = readFileSync(
  resolve(process.cwd(), 'prisma/schema.prisma'), 'utf-8'
)
const migrationSrc = readFileSync(
  resolve(process.cwd(), 'prisma/migrations/20261007222011_brand_v11_provider_customslug_unique/migration.sql'),
  'utf-8'
)
const registryMigrationSrc = readFileSync(
  resolve(process.cwd(), 'prisma/migrations/20261104000001_wla_014_slug_slug_registry/migration.sql'),
  'utf-8'
)

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PREFIX = 'WLA014SL'
const TEST_SLUG = 'wla014sl-test-slug'

type Fixture = { userId: string; providerId: string }

async function createFixture(label: string): Promise<Fixture> {
  const user = await prisma.user.create({
    data: { email: `${PREFIX}-${label}@test.example.com`, name: `${PREFIX} ${label}`, role: 'PROVIDER' },
  })
  const prov = await (prisma.provider as any).create({
    data: {
      user: { connect: { id: user.id } },
      name: `${PREFIX} ${label}`,
      phone: '0400000099',
      hourlyRate: 80,
    },
  })
  return { userId: user.id, providerId: prov.id }
}

// ── Cleanup ────────────────────────────────────────────────────────────────────

async function cleanup() {
  const errors: string[] = []

  // Use $queryRawUnsafe to avoid prepared statement caching issues with PGlite
  const testProviders = await prisma.$queryRawUnsafe<Array<{ id: string; businessId: string | null }>>(
    `SELECT id, "businessId" FROM "Provider"
     WHERE "userId" IN (SELECT id FROM "User" WHERE email ILIKE '${PREFIX}-%')`
  ).catch(() => [] as any[])

  const providerIds = (testProviders as any[]).map((p) => p.id)
  const businessIds = (testProviders as any[]).map((p) => p.businessId).filter(Boolean)
  const legacyBizIds = providerIds.map((id: string) => `biz_${id}`)
  const allBizIds = [...new Set([...businessIds, ...legacyBizIds])]

  try {
    await prisma.$queryRawUnsafe(`UPDATE "Provider" SET "businessId" = NULL, "customSlug" = NULL WHERE "userId" IN (SELECT id FROM "User" WHERE email ILIKE '${PREFIX}-%')`)
  } catch (e) { errors.push(`null FK: ${e}`) }

  for (const bizId of allBizIds) {
    try { await prisma.$queryRawUnsafe(`DELETE FROM "BusinessBranding" WHERE "businessId" = '${bizId}'`) }
    catch (e) { errors.push(`del BB ${bizId}: ${e}`) }
  }
  for (const bizId of allBizIds) {
    try { await prisma.$queryRawUnsafe(`DELETE FROM "Business" WHERE id = '${bizId}'`) }
    catch (e) { errors.push(`del Biz ${bizId}: ${e}`) }
  }
  try { await prisma.$queryRawUnsafe(`DELETE FROM "Provider" WHERE "userId" IN (SELECT id FROM "User" WHERE email ILIKE '${PREFIX}-%')`) }
  catch (e) { errors.push(`del Prov: ${e}`) }
  try { await prisma.$queryRawUnsafe(`DELETE FROM "User" WHERE email ILIKE '${PREFIX}-%'`) }
  catch (e) { errors.push(`del User: ${e}`) }

  // Clean up any SlugRegistry entries for test slugs
  try {
    await prisma.$queryRawUnsafe(`DELETE FROM "SlugRegistry" WHERE slug LIKE '${TEST_SLUG}%' OR ownerId LIKE '${PREFIX}%'`)
  } catch (e) { /* ignore if table doesn't exist yet */ }

  if (errors.length > 0) {
    throw new Error(`[WLA-014-SLUG cleanup] ${errors.length} error(s):\n${errors.join('\n')}`)
  }
}

beforeAll(() => cleanup(), 30000)
afterAll(() => cleanup(), 30000)

// ── IDX01–IDX04: Schema and migration source checks ───────────────────────────

describe('WLA-014-SLUG IDX: Unique constraint source verification', () => {
  it('IDX01 -- Provider.customSlug has @unique in schema.prisma', () => {
    const providerSection = schemaSrc.slice(
      schemaSrc.indexOf('model Provider {'),
      schemaSrc.indexOf('\nmodel ', schemaSrc.indexOf('model Provider {') + 1)
    )
    expect(providerSection).toContain('customSlug')
    expect(providerSection).toContain('@unique')
    expect(schemaSrc).toContain('V-11 FIX')
  })

  it('IDX02 -- Migration creates Provider_customSlug_key unique index', () => {
    expect(migrationSrc).toContain('CREATE UNIQUE INDEX')
    expect(migrationSrc).toContain('"Provider_customSlug_key"')
    expect(migrationSrc).toContain('"customSlug"')
    expect(migrationSrc).toContain('IF NOT EXISTS')
  })

  it('IDX03 -- SlugRegistry model exists in schema with @unique on slug', () => {
    expect(schemaSrc).toContain('model SlugRegistry {')
    const registrySection = schemaSrc.slice(
      schemaSrc.indexOf('model SlugRegistry {'),
      schemaSrc.indexOf('\nmodel ', schemaSrc.indexOf('model SlugRegistry {') + 1)
    )
    expect(registrySection).toContain('slug')
    expect(registrySection).toContain('@unique')
    expect(registrySection).toContain('ownerType')
    expect(registrySection).toContain('ownerId')
    // Schema comment documents the cross-table rationale
    expect(schemaSrc).toContain('WLA-014-SLUG')
  })

  it('IDX04 -- SlugRegistry migration creates SlugRegistry_slug_key unique index', () => {
    expect(registryMigrationSrc).toContain('CREATE UNIQUE INDEX')
    expect(registryMigrationSrc).toContain('"SlugRegistry_slug_key"')
    expect(registryMigrationSrc).toContain('"SlugRegistry"')
    // Migration includes backfill for existing slugs
    expect(registryMigrationSrc).toContain('INSERT INTO "SlugRegistry"')
    expect(registryMigrationSrc).toContain('ON CONFLICT')
  })
})

// ── P2002A–P2002B: Error handling source checks ───────────────────────────────

describe('WLA-014-SLUG P2002: Concurrent claim error handling (source checks)', () => {
  it('P2002A -- Instructor branding PUT catches P2002 on slug/customSlug and returns 409', () => {
    expect(instructorPutSource).toContain("code === 'P2002'")
    expect(instructorPutSource).toContain("status: 409")
    expect(instructorPutSource).toContain('WLA-014-SLUG')
    // Confirm 409 appears near P2002 check
    const p2002Idx = instructorPutSource.indexOf("code === 'P2002'")
    const nearby = instructorPutSource.slice(p2002Idx, p2002Idx + 400)
    expect(nearby).toContain('409')
    // Must check both 'slug' and 'customSlug' targets
    expect(nearby).toContain('customSlug')
    expect(nearby).toContain("'slug'")
  })

  it('P2002B -- Business branding PUT catches P2002 on slug/customSlug and returns 409', () => {
    expect(businessPutSource).toContain("code === 'P2002'")
    expect(businessPutSource).toContain('409')
    expect(businessPutSource).toContain("'slug'")
  })
})

// ── CROSS01–CROSS02: Cross-table uniqueness checks ────────────────────────────

describe('WLA-014-SLUG CROSS: Cross-table slug uniqueness enforcement (source checks)', () => {
  it('CROSS01 -- Instructor PUT uses SlugRegistry (not biz_ legacy exclusion)', () => {
    // The old cross-table check used `biz_${instructor.id}` which was wrong after WLA-014
    // introduced independent Business IDs. The correct fix is to use the registry.
    expect(instructorPutSource).toContain('updateSlugClaim')
    expect(instructorPutSource).toContain('slug-registry')
    // Must NOT use the legacy biz_ convention for the BusinessBranding exclusion
    expect(instructorPutSource).not.toContain('biz_${instructor.id}')
    // WLA-014-SLUG comment must be present
    expect(instructorPutSource).toContain('WLA-014-SLUG')
  })

  it('CROSS02 -- Business branding PUT uses SlugRegistry and still checks both tables (V-16 FIX)', () => {
    expect(businessPutSource).toContain('updateSlugClaim')
    expect(businessPutSource).toContain('slug-registry')
    expect(businessPutSource).toContain('V-16 FIX')
  })
})

// ── TX01–TX02: Transaction source checks ─────────────────────────────────────

describe('WLA-014-SLUG TX: Atomic writes (source checks)', () => {
  it('TX01 -- Business branding PUT wraps BusinessBranding upsert, Provider mirror, and registry update in a transaction', () => {
    expect(businessPutSource).toContain('$transaction')
    expect(businessPutSource).toContain('businessBranding.upsert')
    expect(businessPutSource).toContain('provider.updateMany')
    expect(businessPutSource).toContain('updateSlugClaim')
    expect(businessPutSource).toContain('WLA-014-SLUG')
  })

  it('TX02 -- Instructor branding PUT wraps Provider update and registry update in a transaction', () => {
    expect(instructorPutSource).toContain('$transaction')
    expect(instructorPutSource).toContain('tx.provider.update')
    expect(instructorPutSource).toContain('updateSlugClaim')
  })
})

// ── REG01–REG03: SlugRegistry DB tests ───────────────────────────────────────

describe('WLA-014-SLUG REG: SlugRegistry cross-table uniqueness (real DB)', () => {
  it('REG01 -- claimSlug() creates a SlugRegistry row', async () => {
    const { claimSlug } = await import('@/lib/branding/slug-registry')
    const slug = TEST_SLUG + '-reg01'
    try {
      await prisma.$transaction(async (tx) => {
        await claimSlug(tx, slug, 'provider', 'test-provider-reg01')
      })
      const row = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "SlugRegistry" WHERE slug = '${slug}'`)
      expect(row.length).toBe(1)
      expect(row[0].ownerType).toBe('provider')
      expect(row[0].ownerId).toBe('test-provider-reg01')
    } finally {
      await prisma.$queryRawUnsafe(`DELETE FROM "SlugRegistry" WHERE slug = '${slug}'`).catch(() => {})
    }
  }, 15000)

  it('REG02 -- claimSlug() throws P2002 for a duplicate slug (cross-table race prevention)', async () => {
    const { claimSlug } = await import('@/lib/branding/slug-registry')
    const slug = TEST_SLUG + '-reg02'
    // First claim (provider)
    await prisma.$transaction(async (tx) => {
      await claimSlug(tx, slug, 'provider', 'test-provider-reg02a')
    })
    // Second claim (businessBranding) — must fail with P2002
    let caught: any = null
    try {
      await prisma.$transaction(async (tx) => {
        await claimSlug(tx, slug, 'businessBranding', 'test-biz-reg02b')
      })
    } catch (err) {
      caught = err
    }
    await prisma.$queryRawUnsafe(`DELETE FROM "SlugRegistry" WHERE slug = '${slug}'`).catch(() => {})
    expect(caught).not.toBeNull()
    expect(caught?.code).toBe('P2002')
  }, 15000)

  it('REG03 -- updateSlugClaim() releases old entry and creates new one atomically', async () => {
    const { claimSlug, updateSlugClaim } = await import('@/lib/branding/slug-registry')
    const oldSlug = TEST_SLUG + '-reg03-old'
    const newSlug = TEST_SLUG + '-reg03-new'
    try {
      // Claim old slug
      await prisma.$transaction(async (tx) => {
        await claimSlug(tx, oldSlug, 'provider', 'test-provider-reg03')
      })
      // Update to new slug
      await prisma.$transaction(async (tx) => {
        await updateSlugClaim(tx, 'provider', 'test-provider-reg03', oldSlug, newSlug)
      })
      // Old slug must be gone
      const oldRow = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "SlugRegistry" WHERE slug = '${oldSlug}'`)
      expect(oldRow.length).toBe(0)
      // New slug must be registered
      const newRow = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "SlugRegistry" WHERE slug = '${newSlug}'`)
      expect(newRow.length).toBe(1)
      expect(newRow[0].ownerId).toBe('test-provider-reg03')
    } finally {
      await prisma.$queryRawUnsafe(`DELETE FROM "SlugRegistry" WHERE slug IN ('${oldSlug}', '${newSlug}')`).catch(() => {})
    }
  }, 15000)
})

// ── DB01–DB03: Real database tests ───────────────────────────────────────────

describe('WLA-014-SLUG DB: Unique index enforcement (real DB)', () => {
  it('DB01 -- Provider unique index rejects a duplicate customSlug', async () => {
    const { providerId: p1Id, userId: u1Id } = await createFixture('dup1a')
    const { providerId: p2Id, userId: u2Id } = await createFixture('dup1b')
    const slug = TEST_SLUG + '-db01'
    try {
      // Set slug on first Provider via Prisma ORM (returns P2002 on violation)
      await (prisma.provider as any).update({ where: { id: p1Id }, data: { customSlug: slug } })
      // Attempt to set same slug on second Provider — must fail with P2002
      let caught: any = null
      try {
        await (prisma.provider as any).update({ where: { id: p2Id }, data: { customSlug: slug } })
      } catch (err) {
        caught = err
      }
      expect(caught).not.toBeNull()
      expect(caught?.code).toBe('P2002')
    } finally {
      await (prisma.provider as any).update({ where: { id: p1Id }, data: { customSlug: null } }).catch(() => {})
      await (prisma.provider as any).update({ where: { id: p2Id }, data: { customSlug: null } }).catch(() => {})
      await prisma.user.delete({ where: { id: u1Id } }).catch(() => {})
      await prisma.user.delete({ where: { id: u2Id } }).catch(() => {})
    }
  }, 20000)

  it('DB02 -- BusinessBranding unique index rejects a duplicate customSlug', async () => {
    const { providerId: p1Id, userId: u1Id } = await createFixture('dup2a')
    const { providerId: p2Id, userId: u2Id } = await createFixture('dup2b')
    const biz1Id = `biz_${p1Id}`
    const biz2Id = `biz_${p2Id}`
    const slug = TEST_SLUG + '-db02'
    try {
      // Create two Business + BusinessBranding records
      for (const [bizId, providerId] of [[biz1Id, p1Id], [biz2Id, p2Id]] as [string, string][]) {
        await (prisma.business as any).create({
          data: { id: bizId, name: `DB02 Biz`, supportEmail: `db02-${providerId}@test.local`, timezone: 'Australia/Perth', paymentModel: 'saas', isActive: true },
        })
        await (prisma.businessBranding as any).create({
          data: { businessId: bizId, primaryColour: '#123456', showPlatformBranding: true },
        })
      }
      // Set slug on first BusinessBranding via Prisma ORM
      await (prisma.businessBranding as any).update({ where: { businessId: biz1Id }, data: { customSlug: slug } })
      // Attempt to set same slug on second — must fail with P2002
      let caught: any = null
      try {
        await (prisma.businessBranding as any).update({ where: { businessId: biz2Id }, data: { customSlug: slug } })
      } catch (err) {
        caught = err
      }
      expect(caught).not.toBeNull()
      expect(caught?.code).toBe('P2002')
    } finally {
      await (prisma.businessBranding as any).delete({ where: { businessId: biz1Id } }).catch(() => {})
      await (prisma.businessBranding as any).delete({ where: { businessId: biz2Id } }).catch(() => {})
      await (prisma.business as any).delete({ where: { id: biz1Id } }).catch(() => {})
      await (prisma.business as any).delete({ where: { id: biz2Id } }).catch(() => {})
      await prisma.user.delete({ where: { id: u1Id } }).catch(() => {})
      await prisma.user.delete({ where: { id: u2Id } }).catch(() => {})
    }
  }, 20000)

  it('DB03 -- SlugRegistry prevents the same slug appearing in both Provider and BusinessBranding', async () => {
    // The old gap (documented in the previous DB03 test) is now closed by the registry.
    // Attempting to claim the same slug in both tables should fail on the second claim
    // because SlugRegistry.slug is globally unique.
    const { claimSlug } = await import('@/lib/branding/slug-registry')
    const { providerId, userId } = await createFixture('cross3b')
    const bizId = `biz_${providerId}`
    const slug = TEST_SLUG + '-db03'
    try {
      await (prisma.business as any).create({
        data: { id: bizId, name: `DB03 Biz`, supportEmail: `db03b@test.local`, timezone: 'Australia/Perth', paymentModel: 'saas', isActive: true },
      })
      await (prisma.businessBranding as any).create({
        data: { businessId: bizId, primaryColour: '#123456', showPlatformBranding: true },
      })

      // First claim: BusinessBranding claims the slug via registry
      await prisma.$transaction(async (tx) => {
        await claimSlug(tx, slug, 'businessBranding', bizId)
        await (tx as any).businessBranding.update({ where: { businessId: bizId }, data: { customSlug: slug } })
      })

      // Second claim: Provider tries to claim the same slug — must fail via registry P2002
      let caught: any = null
      try {
        await prisma.$transaction(async (tx) => {
          await claimSlug(tx, slug, 'provider', providerId)
          await (tx as any).provider.update({ where: { id: providerId }, data: { customSlug: slug } })
        })
      } catch (err) {
        caught = err
      }
      expect(caught).not.toBeNull()
      expect(caught?.code).toBe('P2002')  // SlugRegistry rejects the duplicate
    } finally {
      await prisma.$queryRawUnsafe(`DELETE FROM "SlugRegistry" WHERE slug = '${slug}'`).catch(() => {})
      await (prisma.businessBranding as any).delete({ where: { businessId: bizId } }).catch(() => {})
      await (prisma.business as any).delete({ where: { id: bizId } }).catch(() => {})
      await prisma.user.delete({ where: { id: userId } }).catch(() => {})
    }
  }, 20000)
})
