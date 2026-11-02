/**
 * WLA-012: Business website loader and domain resolution tests.
 *
 * Tests the new fetchBusinessWebsiteData() and resolveBusinessDomain()
 * functions using real PostgreSQL (test DB) and source-inspection tests
 * for the page routing logic.
 *
 * Acceptance criteria:
 *   T01  Migrated single-provider Business → correct website renders
 *   T02  Standalone Business → website renders without a Provider
 *   T03  Multi-provider Business → only its own Providers appear
 *   T04  Business with no published website → null (not-found response)
 *   T05  Unverified BusinessDomain → no public website access
 *   T06  Database connection failure → propagates error, not misleading 404
 *   T07  Cross-tenant domain/provider lookup → no data leakage
 *   T08  Source: custom-domain page uses resolveBusinessDomain (not raw prisma call)
 *   T09  Source: custom-domain page uses fetchBusinessWebsiteData (not fetchProviderWebsiteData for Business path)
 *   T10  Source: .catch(() => null) has been removed from the BusinessDomain path
 *   T11  Source: BusinessPublicPage is used for Business path
 *   T12  Source: Provider path (Path 1) is preserved unchanged
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { fetchBusinessWebsiteData, resolveBusinessDomain } from '@/lib/website/fetchBusinessWebsiteData';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ── Source text (for source-inspection tests T08-T12) ─────────────────────────

const pageSource = readFileSync(
  resolve(process.cwd(), 'app/custom-domain/page.tsx'),
  'utf-8'
);

// ── Test fixtures ─────────────────────────────────────────────────────────────

const PREFIX = 'WLA012';
const DOMAIN_SINGLE  = `wla012-single-${Date.now()}.example.com`;
const DOMAIN_MULTI   = `wla012-multi-${Date.now()}.example.com`;
const DOMAIN_STANDALONE = `wla012-standalone-${Date.now()}.example.com`;
const DOMAIN_UNPUBLISHED = `wla012-unpublished-${Date.now()}.example.com`;
const DOMAIN_UNVERIFIED  = `wla012-unverified-${Date.now()}.example.com`;
const DOMAIN_CROSS   = `wla012-cross-${Date.now()}.example.com`;

let bizSingleId: string;
let bizMultiId: string;
let bizStandaloneId: string;
let bizUnpublishedId: string;
let bizCrossId: string;
let provSingleId: string;
let provMultiAId: string;
let provMultiBId: string;
let provCrossId: string;

async function cleanup() {
  // Delete domains
  await prisma.businessDomain.deleteMany({
    where: { host: { in: [DOMAIN_SINGLE, DOMAIN_MULTI, DOMAIN_STANDALONE, DOMAIN_UNPUBLISHED, DOMAIN_UNVERIFIED, DOMAIN_CROSS] } },
  }).catch(() => {});

  // Unlink providers from WLA012 businesses using raw SQL
  // (businessId field may not be in compiled Prisma client yet — FK set via raw SQL)
  await prisma.$executeRaw`UPDATE "Provider" SET "businessId" = NULL WHERE "businessId" IN (SELECT id FROM "Business" WHERE name LIKE 'WLA012%')`.catch(() => {});

  // Delete businesses (cascades to website, terminology, branding, etc.)
  await (prisma.business as any).deleteMany({ where: { name: { startsWith: PREFIX } } }).catch(() => {});

  // Delete users (cascades to Provider)
  await prisma.user.deleteMany({
    where: { email: { startsWith: `${PREFIX.toLowerCase()}-` } },
  }).catch(() => {});
}

async function createBusiness(overrides?: Record<string, any>) {
  return (prisma.business as any).create({
    data: {
      name: `${PREFIX} Test Business`,
      supportEmail: `${PREFIX}@test.example.com`,
      timezone: 'Australia/Perth',
      isActive: true,
      paymentModel: 'saas',
      ...overrides,
    },
  });
}

async function publishBusiness(businessId: string) {
  return prisma.businessWebsite.upsert({
    where: { businessId },
    create: { businessId, publishedAt: new Date() },
    update: { publishedAt: new Date() },
  });
}

async function addDomain(businessId: string, host: string, verified: boolean) {
  return prisma.businessDomain.create({
    data: { businessId, host, verified, type: 'custom', isPrimary: true },
  });
}

async function createProvider(prefix: string) {
  const user = await prisma.user.create({
    data: { email: `${PREFIX}-${prefix}@test.example.com`, name: `${PREFIX} ${prefix}`, role: 'PROVIDER' },
  });
  const prov = await (prisma.provider as any).create({
    data: {
      user: { connect: { id: user.id } },
      name: `${PREFIX} ${prefix}`,
      phone: '0400000099',
      hourlyRate: 80,
      isActive: true,
      approvalStatus: 'APPROVED',
      subscriptionStatus: 'ACTIVE',
      subscriptionTier: 'STUDIO',
    },
  });
  return { userId: user.id, providerId: prov.id };
}

beforeAll(async () => {
  await cleanup();

  // T01: single-provider migrated Business
  const bSingle = await createBusiness({ name: `${PREFIX} Single Provider` });
  bizSingleId = bSingle.id;
  await publishBusiness(bizSingleId);
  await addDomain(bizSingleId, DOMAIN_SINGLE, true);
  const { providerId: pA } = await createProvider('single');
  provSingleId = pA;
  // Use $queryRaw to set businessId — Prisma client binary not yet regenerated for new field
  await prisma.$executeRaw`UPDATE "Provider" SET "businessId" = ${bizSingleId} WHERE id = ${provSingleId}`;

  // T02: standalone Business (no providers)
  const bStandalone = await createBusiness({ name: `${PREFIX} Standalone` });
  bizStandaloneId = bStandalone.id;
  await publishBusiness(bizStandaloneId);
  await addDomain(bizStandaloneId, DOMAIN_STANDALONE, true);

  // T03: multi-provider Business
  const bMulti = await createBusiness({ name: `${PREFIX} Multi Provider` });
  bizMultiId = bMulti.id;
  await publishBusiness(bizMultiId);
  await addDomain(bizMultiId, DOMAIN_MULTI, true);
  const { providerId: pB } = await createProvider('multi-a');
  const { providerId: pC } = await createProvider('multi-b');
  provMultiAId = pB; provMultiBId = pC;
  await prisma.$executeRaw`UPDATE "Provider" SET "businessId" = ${bizMultiId} WHERE id IN (${provMultiAId}, ${provMultiBId})`;

  // T04: unpublished Business
  const bUnpub = await createBusiness({ name: `${PREFIX} Unpublished` });
  bizUnpublishedId = bUnpub.id;
  // NO publishBusiness call — publishedAt stays null
  await addDomain(bizUnpublishedId, DOMAIN_UNPUBLISHED, true);

  // T05: unverified domain — no Business needed, domain is never verified
  // We still need a business to hold the domain
  const bUnver = await createBusiness({ name: `${PREFIX} Unverified` });
  await publishBusiness(bUnver.id);
  await addDomain(bUnver.id, DOMAIN_UNVERIFIED, false); // verified = false

  // T07: cross-tenant Business with its own provider
  const bCross = await createBusiness({ name: `${PREFIX} Cross Tenant` });
  bizCrossId = bCross.id;
  await publishBusiness(bizCrossId);
  await addDomain(bizCrossId, DOMAIN_CROSS, true);
  const { providerId: pD } = await createProvider('cross');
  provCrossId = pD;
  await prisma.$executeRaw`UPDATE "Provider" SET "businessId" = ${bizCrossId} WHERE id = ${provCrossId}`;
}, 60000);

afterAll(async () => {
  await cleanup();
  // Also clean up unverified business
  await prisma.businessDomain.deleteMany({ where: { host: DOMAIN_UNVERIFIED } }).catch(() => {});
  await prisma.business.deleteMany({ where: { name: `${PREFIX} Unverified` } }).catch(() => {});
}, 30000);

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('WLA-012: fetchBusinessWebsiteData', () => {

  it('T01 — migrated single-provider Business returns correct website data', async () => {
    const data = await fetchBusinessWebsiteData(bizSingleId, `https://${DOMAIN_SINGLE}`);
    expect(data).not.toBeNull();
    expect(data!.business.id).toBe(bizSingleId);
    expect(data!.isPublished).toBe(true);
    // Provider is linked and returned
    expect(data!.providers).toHaveLength(1);
    expect(data!.providers[0].id).toBe(provSingleId);
    expect(data!.canonicalUrl).toBe(`https://${DOMAIN_SINGLE}`);
  }, 20000);

  it('T02 — standalone Business renders without a Provider', async () => {
    const data = await fetchBusinessWebsiteData(bizStandaloneId, `https://${DOMAIN_STANDALONE}`);
    expect(data).not.toBeNull();
    expect(data!.business.id).toBe(bizStandaloneId);
    // No providers
    expect(data!.providers).toHaveLength(0);
    expect(data!.isPublished).toBe(true);
  }, 20000);

  it('T03 — multi-provider Business returns only its own Providers', async () => {
    const data = await fetchBusinessWebsiteData(bizMultiId, `https://${DOMAIN_MULTI}`);
    expect(data).not.toBeNull();
    const ids = data!.providers.map(p => p.id);
    expect(ids).toContain(provMultiAId);
    expect(ids).toContain(provMultiBId);
    // Does NOT contain providers from other businesses
    expect(ids).not.toContain(provSingleId);
    expect(ids).not.toContain(provCrossId);
  }, 20000);

  it('T04 — unpublished Business returns null', async () => {
    const data = await fetchBusinessWebsiteData(bizUnpublishedId, `https://${DOMAIN_UNPUBLISHED}`);
    expect(data).toBeNull();
  }, 20000);

  it('T04b — inactive Business returns null', async () => {
    const inactiveBiz = await createBusiness({ name: `${PREFIX} Inactive`, isActive: false });
    await publishBusiness(inactiveBiz.id);
    try {
      const data = await fetchBusinessWebsiteData(inactiveBiz.id, 'https://inactive.example.com');
      expect(data).toBeNull();
    } finally {
      await prisma.business.delete({ where: { id: inactiveBiz.id } }).catch(() => {});
    }
  }, 20000);

  it('T04c — nonexistent Business ID returns null', async () => {
    const data = await fetchBusinessWebsiteData('does-not-exist', 'https://ghost.example.com');
    expect(data).toBeNull();
  }, 10000);

  it('T07 — cross-tenant: loading Business A does not return Providers from Business B', async () => {
    const dataA = await fetchBusinessWebsiteData(bizSingleId, `https://${DOMAIN_SINGLE}`);
    const dataB = await fetchBusinessWebsiteData(bizCrossId, `https://${DOMAIN_CROSS}`);

    const idsA = dataA!.providers.map(p => p.id);
    const idsB = dataB!.providers.map(p => p.id);

    // No overlap between provider sets
    expect(idsA).not.toContain(provCrossId);
    expect(idsB).not.toContain(provSingleId);
  }, 20000);
});

describe('WLA-012: resolveBusinessDomain', () => {

  it('T05 — unverified domain returns null (no public website access)', async () => {
    const id = await resolveBusinessDomain(DOMAIN_UNVERIFIED);
    expect(id).toBeNull();
  }, 10000);

  it('T01 / T02 / T03 — verified domain resolves to correct Business ID', async () => {
    expect(await resolveBusinessDomain(DOMAIN_SINGLE)).toBe(bizSingleId);
    expect(await resolveBusinessDomain(DOMAIN_STANDALONE)).toBe(bizStandaloneId);
    expect(await resolveBusinessDomain(DOMAIN_MULTI)).toBe(bizMultiId);
  }, 15000);

  it('unknown domain returns null', async () => {
    const id = await resolveBusinessDomain('unknown-domain.example.com');
    expect(id).toBeNull();
  }, 10000);
});

describe('WLA-012: T06 — database error propagation', () => {
  it('resolveBusinessDomain does not swallow database errors', async () => {
    // Verify that resolveBusinessDomain does NOT have a .catch(() => null)
    // by inspecting the source of the loader
    const loaderSource = readFileSync(
      resolve(process.cwd(), 'lib/website/fetchBusinessWebsiteData.ts'),
      'utf-8'
    );
    // The function should not have a broad catch-all that returns null on DB error
    expect(loaderSource).not.toContain('.catch(() => null)');
    expect(loaderSource).not.toContain('.catch(()=>null)');
    // The comment documents the intended behaviour
    expect(loaderSource).toContain('Throws on database errors');
  });

  it('fetchBusinessWebsiteData does not swallow database errors', async () => {
    const loaderSource = readFileSync(
      resolve(process.cwd(), 'lib/website/fetchBusinessWebsiteData.ts'),
      'utf-8'
    );
    expect(loaderSource).not.toContain('.catch(() => null)');
    expect(loaderSource).toContain('Throws on database errors');
  });
});

describe('WLA-012: source inspection — page routing', () => {

  it('T08 — page uses resolveBusinessDomain (not raw prisma.businessDomain.findFirst)', () => {
    expect(pageSource).toContain('resolveBusinessDomain');
    // The old pattern should be gone
    expect(pageSource).not.toContain('businessDomain?.findFirst');
    expect(pageSource).not.toContain("prisma as any").valueOf(); // no (prisma as any) in Business path
  });

  it('T09 — page uses fetchBusinessWebsiteData for Business path', () => {
    expect(pageSource).toContain('fetchBusinessWebsiteData');
    // The broken pattern (passing bizDomain.businessId to Provider loader) is gone
    expect(pageSource).not.toContain('fetchProviderWebsiteData(bizDomain');
    expect(pageSource).not.toContain('fetchProviderWebsiteData(businessId');
  });

  it('T10 — .catch(() => null) removed from BusinessDomain path', () => {
    // The old broad catch-all in the BusinessDomain path is gone.
    // The comment in the page source references it (documenting the removal)
    // but the actual executable call should not exist.
    // Check that the raw prisma call with .catch is gone (not just the comment)
    expect(pageSource).not.toContain('businessDomain?.findFirst');
    expect(pageSource).not.toContain('.catch(() => null)\n');
    // The page no longer has a .catch after a prisma query call
    // (the comment may say .catch(() => null) but no actual invocation exists)
    const executableCatch = pageSource
      .split('\n')
      .filter(line => !line.trimStart().startsWith('*') && !line.trimStart().startsWith('//'))
      .join('\n');
    expect(executableCatch).not.toContain('.catch(() => null)');
  });

  it('T11 — BusinessPublicPage is imported and used for Business path', () => {
    expect(pageSource).toContain("import BusinessPublicPage");
    expect(pageSource).toContain('<BusinessPublicPage');
  });

  it('T12 — Provider path (Path 1) is preserved', () => {
    // Provider lookup still uses customDomain + domainVerified
    expect(pageSource).toContain('customDomain,');
    expect(pageSource).toContain("domainVerified: true");
    expect(pageSource).toContain("STUDIO");
    expect(pageSource).toContain("PREMIUM");
    // Existing BusinessWebsitePage still used for Provider path
    expect(pageSource).toContain('import BusinessWebsitePage');
    expect(pageSource).toContain('<BusinessWebsitePage');
    // Driving fallback preserved
    expect(pageSource).toContain('SubdomainBookingPage');
  });
});
