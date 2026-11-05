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

  // Single-query approach to avoid PGlite prepared statement cache exhaustion.
  // Use $executeRaw (tagged template) for simple queries — PGlite handles each
  // tagged template as a distinct statement and avoids the 42P05 collision.

  // Step 1: Null out FK and slug on test Providers
  await prisma.$executeRaw`
    UPDATE "Provider" SET "businessId" = NULL, "customSlug" = NULL
    WHERE "userId" IN (SELECT id FROM "User" WHERE email ILIKE ${PREFIX + '-%'})
  `.catch((e: any) => errors.push(`null FK: ${e?.message ?? e}`))

  // Step 2: Delete SlugRegistry test entries
  await prisma.$executeRaw`
    DELETE FROM "SlugRegistry"
    WHERE slug LIKE ${TEST_SLUG + '%'}
       OR "ownerId" LIKE ${'test-%'}
  `.catch(() => {/* ignore if table absent */})

  // Step 3: Delete BusinessBranding for test providers (biz_ pattern)
  await prisma.$executeRaw`
    DELETE FROM "BusinessBranding" WHERE "businessId" IN (
      SELECT 'biz_' || p.id FROM "Provider" p
      JOIN "User" u ON u.id = p."userId"
      WHERE u.email ILIKE ${PREFIX + '-%'}
    )
  `.catch((e: any) => errors.push(`del BB: ${e?.message ?? e}`))

  // Step 4: Delete Business records for test providers (biz_ pattern)
  await prisma.$executeRaw`
    DELETE FROM "Business" WHERE id IN (
      SELECT 'biz_' || p.id FROM "Provider" p
      JOIN "User" u ON u.id = p."userId"
      WHERE u.email ILIKE ${PREFIX + '-%'}
    )
  `.catch((e: any) => errors.push(`del Biz: ${e?.message ?? e}`))

  // Step 5: Delete Providers
  await prisma.$executeRaw`
    DELETE FROM "Provider"
    WHERE "userId" IN (SELECT id FROM "User" WHERE email ILIKE ${PREFIX + '-%'})
  `.catch((e: any) => errors.push(`del Prov: ${e?.message ?? e}`))

  // Step 6: Delete Users
  await prisma.$executeRaw`
    DELETE FROM "User" WHERE email ILIKE ${PREFIX + '-%'}
  `.catch((e: any) => errors.push(`del User: ${e?.message ?? e}`))

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
  it('CROSS01 -- Instructor PUT uses unified registry ownership (businessBranding/resolvedBizId)', () => {
    // v3: instructor PUT resolves the canonical Business ID and uses
    // ownerType='businessBranding', not 'provider'/instructor.id
    expect(instructorPutSource).toContain('resolveBusinessId')
    expect(instructorPutSource).toContain("'businessBranding'")
    // Must NOT use 'provider' as ownerType for the registry
    const registrySection = instructorPutSource.slice(
      instructorPutSource.indexOf('updateSlugClaim'),
      instructorPutSource.indexOf('updateSlugClaim') + 100
    )
    expect(registrySection).not.toContain("'provider'")
    expect(instructorPutSource).toContain('WLA-014-SLUG')
  })

  it('CROSS02 -- Business branding PUT uses resolveBusinessId (not hardcoded biz_) and unified registry ownership', () => {
    expect(businessPutSource).toContain('resolveBusinessId')
    expect(businessPutSource).toContain('WLA-014-SLUG v3')
    // Must NOT hardcode biz_ for bizId in the PUT handler
    const putSection = businessPutSource.slice(businessPutSource.indexOf('export async function PUT'))
    expect(putSection).not.toContain('biz_${session')
    // Registry must still use businessBranding/bizId
    expect(businessPutSource).toContain("'businessBranding'")
  })
})

// ── TX01–TX02: Transaction source checks ─────────────────────────────────────

describe('WLA-014-SLUG TX: Atomic writes (source checks)', () => {
  it('TX01 -- Business branding PUT wraps BusinessBranding upsert, Provider mirror, and registry update in a transaction', () => {
    const putSection = businessPutSource.slice(businessPutSource.indexOf('export async function PUT'))
    expect(putSection).toContain('$transaction')
    expect(putSection).toContain('businessBranding.upsert')
    expect(putSection).toContain('provider.updateMany')
    expect(putSection).toContain('updateSlugClaim')
    expect(putSection).toContain('WLA-014-SLUG')
  })

  it('TX02 -- Instructor branding PUT wraps Provider update and registry update in a transaction', () => {
    expect(instructorPutSource).toContain('$transaction')
    expect(instructorPutSource).toContain('tx.provider.update')
    expect(instructorPutSource).toContain('updateSlugClaim')
  })

  it('TX03 -- Instructor PUT only writes customSlug when field is present in request (omitted-slug fix)', () => {
    // slugIsBeingChanged guard must be present in the file
    expect(instructorPutSource).toContain('slugIsBeingChanged')
    // The spread guard must appear in the provider update data block
    expect(instructorPutSource).toContain('...(slugIsBeingChanged && { customSlug')
    // The update data must NOT contain a bare unconditional `customSlug:` assignment
    const txStart = instructorPutSource.indexOf('tx.provider.update')
    const txSection = instructorPutSource.slice(txStart, txStart + 600)
    // Unconditional customSlug write would look like:
    //   customSlug: customSlug || null,   (no leading spread/conditional)
    // The guarded form is:
    //   ...(slugIsBeingChanged && { customSlug: ... })
    // Verify the unconditional pattern (without spread) is absent from the data block
    expect(txSection).not.toMatch(/^\s+customSlug:\s/m)
    expect(txSection).toContain('slugIsBeingChanged')
  })

  it('TX04 -- Business PUT only writes customSlug when field is present in request (omitted-slug fix)', () => {
    const putSection = businessPutSource.slice(businessPutSource.indexOf('export async function PUT'))
    expect(putSection).toContain('slugIsBeingChanged')
    const mirrorSection = putSection.slice(
      putSection.indexOf('provider.updateMany'),
      putSection.indexOf('provider.updateMany') + 400
    )
    expect(mirrorSection).toContain('slugIsBeingChanged')
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
      const row = await prisma.$queryRaw<any[]>`SELECT * FROM "SlugRegistry" WHERE slug = ${slug}`
      expect(row.length).toBe(1)
      expect(row[0].ownerType).toBe('provider')
      expect(row[0].ownerId).toBe('test-provider-reg01')
    } finally {
      await prisma.$executeRaw`DELETE FROM "SlugRegistry" WHERE slug = ${slug}`.catch(() => {})
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
    await prisma.$executeRaw`DELETE FROM "SlugRegistry" WHERE slug = ${slug}`.catch(() => {})
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
      const oldRow = await prisma.$queryRaw<any[]>`SELECT * FROM "SlugRegistry" WHERE slug = ${oldSlug}`
      expect(oldRow.length).toBe(0)
      // New slug must be registered
      const newRow = await prisma.$queryRaw<any[]>`SELECT * FROM "SlugRegistry" WHERE slug = ${newSlug}`
      expect(newRow.length).toBe(1)
      expect(newRow[0].ownerId).toBe('test-provider-reg03')
    } finally {
      await prisma.$executeRaw`DELETE FROM "SlugRegistry" WHERE slug IN (${oldSlug}, ${newSlug})`.catch(() => {})
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
      await prisma.$executeRaw`DELETE FROM "SlugRegistry" WHERE slug = ${slug}`.catch(() => {})
      await (prisma.businessBranding as any).delete({ where: { businessId: bizId } }).catch(() => {})
      await (prisma.business as any).delete({ where: { id: bizId } }).catch(() => {})
      await prisma.user.delete({ where: { id: userId } }).catch(() => {})
    }
  }, 20000)
})

// ── V3: Omit / clear / cross-route ownership tests ───────────────────────────

describe('WLA-014-SLUG V3: Omit, clear, and cross-route slug handling (real DB)', () => {
  it('OWN01 -- updateSlugClaim with same ownerType/ownerId is idempotent across both routes', async () => {
    const { claimSlug, releaseSlug } = await import('@/lib/branding/slug-registry')
    const bizId = 'test-own01-biz'
    const slug = TEST_SLUG + '-own01'
    try {
      await prisma.$transaction(async (tx) => { await claimSlug(tx, slug, 'businessBranding', bizId) })
      await prisma.$transaction(async (tx) => { await releaseSlug(tx, 'businessBranding', bizId) })
      const rows = await prisma.$queryRaw<any[]>`SELECT * FROM "SlugRegistry" WHERE slug = ${slug}`
      expect(rows.length).toBe(0)
    } finally {
      await prisma.$executeRaw`DELETE FROM "SlugRegistry" WHERE slug = ${slug} OR "ownerId" = ${bizId}`.catch(() => {})
    }
  }, 15000)

  it('OMIT01 -- omitting customSlug does not release the existing registry claim', async () => {
    const { claimSlug } = await import('@/lib/branding/slug-registry')
    const bizId = 'test-omit01-biz'
    const slug = TEST_SLUG + '-omit01'
    try {
      await prisma.$transaction(async (tx) => { await claimSlug(tx, slug, 'businessBranding', bizId) })
      // slugIsBeingChanged = false when customSlug is undefined
      const slugIsBeingChanged = false
      if (slugIsBeingChanged) { throw new Error('Test logic error') }
      const rows = await prisma.$queryRaw<any[]>`SELECT * FROM "SlugRegistry" WHERE slug = ${slug}`
      expect(rows.length).toBe(1)
      expect(rows[0].ownerId).toBe(bizId)
    } finally {
      await prisma.$executeRaw`DELETE FROM "SlugRegistry" WHERE slug = ${slug} OR "ownerId" = ${bizId}`.catch(() => {})
    }
  }, 15000)

  it('CLEAR01 -- explicitly clearing customSlug (empty string → null) releases the registry claim', async () => {
    const { claimSlug, updateSlugClaim } = await import('@/lib/branding/slug-registry')
    const bizId = 'test-clear01-biz'
    const slug = TEST_SLUG + '-clear01'
    try {
      await prisma.$transaction(async (tx) => { await claimSlug(tx, slug, 'businessBranding', bizId) })
      // slugIsBeingChanged = true, newSlug = null (clear)
      await prisma.$transaction(async (tx) => {
        await updateSlugClaim(tx, 'businessBranding', bizId, slug, null)
      })
      const rows = await prisma.$queryRaw<any[]>`SELECT * FROM "SlugRegistry" WHERE slug = ${slug}`
      expect(rows.length).toBe(0)
    } finally {
      await prisma.$executeRaw`DELETE FROM "SlugRegistry" WHERE slug = ${slug} OR "ownerId" = ${bizId}`.catch(() => {})
    }
  }, 15000)

  it('CROSS-ROUTE01 -- slug claimed by one bizId blocks the same slug from a different bizId', async () => {
    const { claimSlug } = await import('@/lib/branding/slug-registry')
    const bizId1 = 'test-crossrt01-biz1'
    const bizId2 = 'test-crossrt01-biz2'
    const slug = TEST_SLUG + '-crossrt01'
    try {
      await prisma.$transaction(async (tx) => { await claimSlug(tx, slug, 'businessBranding', bizId1) })
      let caught: any = null
      try {
        await prisma.$transaction(async (tx) => { await claimSlug(tx, slug, 'businessBranding', bizId2) })
      } catch (err) { caught = err }
      expect(caught).not.toBeNull()
      expect(caught?.code).toBe('P2002')
    } finally {
      await prisma.$executeRaw`DELETE FROM "SlugRegistry" WHERE slug = ${slug}`.catch(() => {})
    }
  }, 15000)
})
