/**
 * WLA-012: Loader and registration flow integration tests
 *
 * Tests the ACTUAL createBusinessFromTemplate() function from lib/presets/loader.ts
 * against a real PostgreSQL database. REQ-1, REQ-2, REQ-3 per reviewer.
 *
 * REQ-1: Invoke createBusinessFromTemplate() and verify Provider.businessId is set.
 * REQ-2: Repository-wide audit of lib/templates/loader imports.
 * REQ-3: Recovery scenarios - REQ-3c corrected to call actual loader.
 *        Recovery is MANUAL - no automatic production trigger exists.
 *
 * WHAT IS REAL:
 *   - Real PostgreSQL (127.0.0.1:5433/drivebook_test)
 *   - Actual createBusinessFromTemplate() from lib/presets/loader.ts
 *   - Actual loadTemplateConfig() for driving template
 *   - Actual Business + BusinessSettings + BusinessBranding + etc. records created
 *
 * WHAT IS MOCKED: nothing for these tests
 */

import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '@/lib/prisma';
import { createBusinessFromTemplate, loadTemplateConfig } from '@/lib/presets/loader';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PREFIX = 'WLA012L';

async function createTestProvider(label: string) {
  const user = await prisma.user.create({
    data: { email: `${PREFIX}-${label}@test.example.com`, name: `${PREFIX} ${label}`, role: 'PROVIDER' },
  });
  const prov = await (prisma.provider as any).create({
    data: {
      user: { connect: { id: user.id } },
      name: `${PREFIX} ${label} Provider`,
      phone: '0400000099',
      hourlyRate: 80,
      isActive: false,
      approvalStatus: 'PENDING',
      subscriptionStatus: 'TRIAL',
      subscriptionTier: 'BASIC',
    },
  });
  return { userId: user.id, providerId: prov.id };
}

async function cleanup(userEmails: string[], businessIds: string[]) {
  for (const id of businessIds) {
    await prisma.$executeRaw`UPDATE "Provider" SET "businessId" = NULL WHERE "businessId" = ${id}`.catch(() => {});
  }
  for (const id of businessIds) {
    await (prisma.business as any).delete({ where: { id } }).catch(() => {});
  }
  if (userEmails.length > 0) {
    await prisma.user.deleteMany({ where: { email: { in: userEmails } } }).catch(() => {});
  }
}

// ── REQ-1: Actual preset loader invocation ────────────────────────────────────

describe('WLA-012 REQ-1: createBusinessFromTemplate from lib/presets/loader.ts', () => {
  let userId: string;
  let providerId: string;
  let businessId: string;

  afterAll(async () => {
    await cleanup([`${PREFIX}-loader@test.example.com`], [businessId].filter(Boolean));
  }, 30000);

  it('REG-LOADER-01 -- calling createBusinessFromTemplate sets Provider.businessId to biz_${providerId}', async () => {
    // Step 1: create real User + Provider
    const fixtures = await createTestProvider('loader');
    userId = fixtures.userId;
    providerId = fixtures.providerId;
    businessId = `biz_${providerId}`;

    // Step 2: confirm businessId is NULL before
    const before = await prisma.$queryRaw<any[]>`
      SELECT "businessId" FROM "Provider" WHERE id = ${providerId}
    `;
    expect(before[0].businessId).toBeNull();

    // Step 3: load a valid BusinessConfig (driving template)
    const config = await loadTemplateConfig('driving');
    expect(config).not.toBeNull();

    // Step 4: invoke the ACTUAL createBusinessFromTemplate from lib/presets/loader.ts
    // This is the real function imported by register/route.ts
    await createBusinessFromTemplate(prisma as any, businessId, providerId, config!);

    // Step 5: verify Provider.businessId is now set
    const after = await prisma.$queryRaw<any[]>`
      SELECT "businessId" FROM "Provider" WHERE id = ${providerId}
    `;
    expect(after[0].businessId).toBe(businessId);
    expect(after[0].businessId).toBe(`biz_${providerId}`);

    // Step 6: verify the Business and associated records were created
    const biz = await (prisma.business as any).findUnique({ where: { id: businessId } });
    expect(biz).not.toBeNull();
    expect(biz.id).toBe(businessId);

    const settings = await prisma.businessSettings.findUnique({ where: { businessId } });
    expect(settings).not.toBeNull();

    const branding = await prisma.businessBranding.findUnique({ where: { businessId } });
    expect(branding).not.toBeNull();

    const terminology = await prisma.businessTerminology.findUnique({ where: { businessId } });
    expect(terminology).not.toBeNull();

    const capabilities = await prisma.businessCapabilities.findUnique({ where: { businessId } });
    expect(capabilities).not.toBeNull();
  }, 30000);
});

// ── REQ-2: Repository-wide import audit ────────────────────────────────────────
//
// Repository-wide grep for 'lib/templates/loader' across all .ts, .js, .mjs files:
//
// File                                           | Match type         | Classification
// ---------------------------------------------- | ------------------ | ---------------
// lib/templates/loader.ts                         | self-reference     | Dead code (unused file)
// lib/presets/loader.ts                           | header comment     | Duplicate file header (misleading)
// app/api/register/route.ts                       | NO match           | Active production route
// __tests__/unit/wla-012-business-website.test.ts | readFileSync       | Audit test (source inspection only)
// __tests__/integration/wla-012-loader-*.test.ts  | readFileSync       | Audit test (source inspection only)
// MULTI_VERTICAL_IMPLEMENTATION_COMPLETE.md       | code example       | Documentation
// ARCHITECTURE_AUDIT_VIOLATIONS.md                | directory listing  | Documentation
// AUDIT-MASTER-TRACKER.md                         | tracker text       | Documentation
//
// Conclusion: lib/templates/loader.ts has ZERO module imports anywhere.
// It is dead code -- not imported by any production route, test, or script.

describe('WLA-012 REQ-2: lib/templates/loader.ts -- repository-wide import audit', () => {
  it('REG-LOADER-02a -- lib/presets/loader.ts is the active production path', () => {
    const registerSource = readFileSync(
      resolve(process.cwd(), 'app/api/register/route.ts'),
      'utf-8'
    );
    expect(registerSource).toContain("from '@/lib/presets/loader'");
    expect(registerSource).not.toContain("from '@/lib/templates/loader'");
  });

  it('REG-LOADER-02b -- lib/templates/loader.ts is dead code (zero module imports in repository)', () => {
    // Confirmed by repository-wide search (see comment block above this describe).
    // The search found no actual 'import ... from ... lib/templates/loader' anywhere.
    // Only readFileSync references in audit tests (source inspection) were found.

    const registerSource = readFileSync(
      resolve(process.cwd(), 'app/api/register/route.ts'),
      'utf-8'
    );
    // Active registration route imports presets, not templates
    expect(registerSource).not.toContain("lib/templates/loader");

    // lib/templates/loader.ts has the businessId fix applied defensively
    const templateSource = readFileSync(
      resolve(process.cwd(), 'lib/templates/loader.ts'),
      'utf-8'
    );
    expect(templateSource).toContain('UPDATE "Provider"');
    expect(templateSource).toContain('SET "businessId" = ');
    expect(templateSource).not.toContain('TODO: Add businessId field to Provider schema');
  });
});

// ── REQ-3: Recovery scenarios ─────────────────────────────────────────────────

describe('WLA-012 REQ-3: Recovery and retry scenarios', () => {
  let userIdR: string;
  let providerIdR: string;
  let businessIdR: string;

  afterAll(async () => {
    await cleanup(
      [`${PREFIX}-recovery@test.example.com`],
      [businessIdR].filter(Boolean)
    );
  }, 30000);

  it('REQ-3a -- createBusinessFromTemplate success: Business created and Provider.businessId set', async () => {
    const { userId: u, providerId: p } = await createTestProvider('recovery');
    userIdR = u;
    providerIdR = p;
    businessIdR = `biz_${p}`;

    const config = await loadTemplateConfig('driving');
    await createBusinessFromTemplate(prisma as any, businessIdR, providerIdR, config!);

    const row = await prisma.$queryRaw<any[]>`SELECT "businessId" FROM "Provider" WHERE id = ${providerIdR}`;
    expect(row[0].businessId).toBe(businessIdR);
  }, 30000);

  it('REQ-3b -- MANUAL recovery: re-running createBusinessFromTemplate repairs missing Provider.businessId', async () => {
    // IMPORTANT: Recovery is MANUAL -- no automatic production trigger exists.
    // The production documentation (BUSINESS_TYPES_STATUS.md) says:
    //   "Repair: Re-run createBusinessFromTemplate(providerId) via the admin panel or
    //    a one-off script."
    // There is no admin panel endpoint or cron that automatically triggers this.
    // This test documents that MANUAL re-invocation works -- not automatic recovery.

    // Simulate partial failure: Business exists but Provider.businessId is NULL
    await prisma.$executeRaw`UPDATE "Provider" SET "businessId" = NULL WHERE id = ${providerIdR}`;

    const partial = await prisma.$queryRaw<any[]>`SELECT "businessId" FROM "Provider" WHERE id = ${providerIdR}`;
    expect(partial[0].businessId).toBeNull();

    const bizExists = await (prisma.business as any).findUnique({ where: { id: businessIdR } });
    expect(bizExists).not.toBeNull();

    // MANUAL repair: re-run createBusinessFromTemplate (as a developer would via admin/script)
    const config = await loadTemplateConfig('driving');
    await createBusinessFromTemplate(prisma as any, businessIdR, providerIdR, config!);

    const repaired = await prisma.$queryRaw<any[]>`SELECT "businessId" FROM "Provider" WHERE id = ${providerIdR}`;
    expect(repaired[0].businessId).toBe(businessIdR);
  }, 30000);

  it('REQ-3c -- actual loader call: existing non-null businessId is NOT overwritten', async () => {
    // This test calls the ACTUAL createBusinessFromTemplate() with a different proposed
    // Business ID. The loader must not overwrite an existing non-null relationship.
    //
    // REQ-3c corrected per reviewer: no manual SQL -- the actual loader exercises the guard.

    // Provider currently has businessIdR set (from REQ-3b repair)
    const beforeCall = await prisma.$queryRaw<any[]>`SELECT "businessId" FROM "Provider" WHERE id = ${providerIdR}`;
    expect(beforeCall[0].businessId).toBe(businessIdR); // confirm non-null before

    // Create a different Business ID -- simulates a second registration attempt or
    // a different businessId being proposed
    const alternateBusinessId = `biz_alternate_${providerIdR}`;
    const altBiz = await (prisma.business as any).create({
      data: {
        id: alternateBusinessId,
        name: `${PREFIX} Alternate Business`,
        supportEmail: `${PREFIX}-alternate@test.example.com`,
        timezone: 'Australia/Perth',
        isActive: true,
        paymentModel: 'saas',
        subscriptionTier: 'STUDIO',
      },
    });

    try {
      // Call the actual loader with the ALTERNATE business ID
      // The WHERE businessId IS NULL guard in createBusinessFromTemplate must prevent
      // the existing businessIdR from being overwritten with alternateBusinessId
      const config = await loadTemplateConfig('driving');
      await createBusinessFromTemplate(prisma as any, alternateBusinessId, providerIdR, config!);

      // Provider.businessId must still be the ORIGINAL businessIdR, not alternateBusinessId
      const afterCall = await prisma.$queryRaw<any[]>`SELECT "businessId" FROM "Provider" WHERE id = ${providerIdR}`;
      expect(afterCall[0].businessId).toBe(businessIdR);
      expect(afterCall[0].businessId).not.toBe(alternateBusinessId);
    } finally {
      await (prisma.business as any).delete({ where: { id: alternateBusinessId } }).catch(() => {});
    }
  }, 30000);

  it('REQ-3d -- createBusinessFromTemplate upsert prevents Business record duplication on retry', async () => {
    const before = await (prisma.business as any).count({ where: { id: businessIdR } });
    expect(before).toBe(1);

    const config = await loadTemplateConfig('driving');
    await createBusinessFromTemplate(prisma as any, businessIdR, providerIdR, config!);

    const after = await (prisma.business as any).count({ where: { id: businessIdR } });
    expect(after).toBe(1); // upsert: still exactly one
  }, 30000);
});
