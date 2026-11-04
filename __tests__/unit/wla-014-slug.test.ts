/**
 * WLA-014-SLUG: Slug uniqueness enforcement and cross-table consistency tests.
 *
 * Finding: The schema and migration for Provider.customSlug @unique already exist.
 * This test suite verifies:
 *   (1) Both unique indexes are present in the database
 *   (2) P2002 concurrent slug claims are handled as 409 in both route sources
 *   (3) Both PUT routes check cross-table uniqueness before writing
 *   (4) The business branding PUT wraps both writes in a transaction
 *   (5) Actual DB: creating a duplicate customSlug raises a P2002 error
 *
 * WHAT IS TESTED:
 *   IDX01  Production source check: Provider.customSlug @unique in schema
 *   IDX02  Production source check: migration creates Provider_customSlug_key
 *   P2002A  Instructor branding PUT catches P2002 on customSlug and returns 409
 *   P2002B  Business branding PUT catches P2002 on customSlug and returns 409
 *   CROSS01 Instructor branding PUT checks BusinessBranding before writing
 *   CROSS02 Business branding PUT already checks both tables (V-16 FIX)
 *   TX01    Business branding PUT wraps writes in a transaction (source check)
 *   DB01    Actual DB: Provider unique index rejects a duplicate slug (real DB)
 *   DB02    Actual DB: BusinessBranding unique index rejects a duplicate slug (real DB)
 *   DB03    Cross-table: same slug in Provider and BusinessBranding is detectable (real DB)
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

  if (errors.length > 0) {
    throw new Error(`[WLA-014-SLUG cleanup] ${errors.length} error(s):\n${errors.join('\n')}`)
  }
}

beforeAll(() => cleanup(), 30000)
afterAll(() => cleanup(), 30000)

// ── IDX01–IDX02: Schema and migration source checks ───────────────────────────

describe('WLA-014-SLUG IDX: Unique constraint source verification', () => {
  it('IDX01 -- Provider.customSlug has @unique in schema.prisma', () => {
    // The @unique must appear on the Provider model's customSlug field
    const providerSection = schemaSrc.slice(
      schemaSrc.indexOf('model Provider {'),
      schemaSrc.indexOf('\nmodel ', schemaSrc.indexOf('model Provider {') + 1)
    )
    expect(providerSection).toContain('customSlug')
    expect(providerSection).toContain('@unique')
    // The comment documents the V-11 fix rationale
    expect(schemaSrc).toContain('V-11 FIX')
  })

  it('IDX02 -- Migration creates Provider_customSlug_key unique index', () => {
    expect(migrationSrc).toContain('CREATE UNIQUE INDEX')
    expect(migrationSrc).toContain('"Provider_customSlug_key"')
    expect(migrationSrc).toContain('"customSlug"')
    expect(migrationSrc).toContain('IF NOT EXISTS')
  })
})

// ── P2002A–P2002B: Error handling source checks ───────────────────────────────

describe('WLA-014-SLUG P2002: Concurrent claim error handling (source checks)', () => {
  it('P2002A -- Instructor branding PUT catches P2002 on customSlug and returns 409', () => {
    // The outer catch must check for P2002 and customSlug target and return 409
    expect(instructorPutSource).toContain("code === 'P2002'")
    expect(instructorPutSource).toContain("status: 409")
    expect(instructorPutSource).toContain('WLA-014-SLUG')
    // Confirm the 409 appears near the P2002 check (within 300 chars of it)
    const p2002Idx = instructorPutSource.indexOf("code === 'P2002'")
    const nearby = instructorPutSource.slice(p2002Idx, p2002Idx + 300)
    expect(nearby).toContain('409')
  })

  it('P2002B -- Business branding PUT catches P2002 on customSlug and returns 409', () => {
    expect(businessPutSource).toContain("code === 'P2002'")
    expect(businessPutSource).toContain('customSlug')
    expect(businessPutSource).toContain('status: 409')
  })
})

// ── CROSS01–CROSS02: Cross-table uniqueness checks ────────────────────────────

describe('WLA-014-SLUG CROSS: Cross-table slug uniqueness enforcement (source checks)', () => {
  it('CROSS01 -- Instructor branding PUT checks BusinessBranding before writing', () => {
    // Must query businessBranding.findFirst for the slug before writing to Provider
    expect(instructorPutSource).toContain('businessBranding.findFirst')
    expect(instructorPutSource).toContain('customSlug')
    // WLA-014-SLUG comment must be present documenting the cross-table rationale
    expect(instructorPutSource).toContain('WLA-014-SLUG')
  })

  it('CROSS02 -- Business branding PUT checks both Provider and BusinessBranding (V-16 FIX)', () => {
    // V-16 FIX must cross-check Provider.customSlug
    expect(businessPutSource).toContain('V-16 FIX')
    expect(businessPutSource).toContain('provider.findFirst')
    expect(businessPutSource).toContain('businessBranding.findFirst')
  })
})

// ── TX01: Transaction source check ───────────────────────────────────────────

describe('WLA-014-SLUG TX: Business branding two-step write atomicity (source check)', () => {
  it('TX01 -- Business branding PUT wraps BusinessBranding upsert and Provider mirror in a transaction', () => {
    // Must use prisma.$transaction to wrap both writes atomically
    expect(businessPutSource).toContain('$transaction')
    expect(businessPutSource).toContain('businessBranding.upsert')
    expect(businessPutSource).toContain('provider.updateMany')
    // WLA-014-SLUG comment must document the transaction rationale
    expect(businessPutSource).toContain('WLA-014-SLUG')
  })
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

  it('DB03 -- Cross-table: same slug can appear in both Provider and BusinessBranding without a cross-table constraint', async () => {
    // This test DOCUMENTS the gap: independent unique indexes do not prevent the
    // same slug existing in both tables simultaneously. The application checks
    // enforce cross-table uniqueness, but there is no DB-level cross-table constraint.
    const { providerId, userId } = await createFixture('cross3')
    const bizId = `biz_${providerId}`
    const slug = TEST_SLUG + '-db03'
    try {
      await (prisma.business as any).create({
        data: { id: bizId, name: `DB03 Biz`, supportEmail: `db03@test.local`, timezone: 'Australia/Perth', paymentModel: 'saas', isActive: true },
      })
      await (prisma.businessBranding as any).create({
        data: { businessId: bizId, primaryColour: '#123456', showPlatformBranding: true, customSlug: slug },
      })
      await prisma.$executeRaw`UPDATE "Provider" SET "customSlug" = ${slug} WHERE id = ${providerId}`

      // Both rows now have the same slug — DB allows it because indexes are per-table
      const provRow = await prisma.$queryRawUnsafe<any[]>(`SELECT "customSlug" FROM "Provider" WHERE id = '${providerId}'`)
      const bizRow = await prisma.$queryRawUnsafe<any[]>(`SELECT "customSlug" FROM "BusinessBranding" WHERE "businessId" = '${bizId}'`)
      expect(provRow[0].customSlug).toBe(slug)
      expect(bizRow[0].customSlug).toBe(slug)
      // Both have same slug — this is the documented gap. Application checks prevent
      // this during writes, but there is no DB constraint across tables.
    } finally {
      await prisma.$executeRaw`UPDATE "Provider" SET "customSlug" = NULL WHERE id = ${providerId}`.catch(() => {})
      await (prisma.businessBranding as any).delete({ where: { businessId: bizId } }).catch(() => {})
      await (prisma.business as any).delete({ where: { id: bizId } }).catch(() => {})
      await prisma.user.delete({ where: { id: userId } }).catch(() => {})
    }
  }, 20000)
})
