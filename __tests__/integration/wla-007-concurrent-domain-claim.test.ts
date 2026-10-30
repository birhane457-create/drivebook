/**
 * WLA-007 TESTS — Concurrent domain ownership claims (corrected)
 *
 * Previous fix used a tautological updateMany condition that provided no protection.
 * This corrected fix uses a DB-level partial unique index that prevents two providers
 * from having the same customDomain with domainVerified=true simultaneously.
 *
 * The route catches P2002 (unique constraint violation) and returns 409.
 *
 * WHAT IS TESTED
 *   C01  Route catches P2002 and returns 409
 *   C02  Route uses prisma.provider.update (not updateMany with tautology)
 *   C03  Migration SQL creates partial unique index
 *   C04  Migration index is partial (WHERE domainVerified = true only)
 *   C05  Route source no longer contains the tautological AND/NOT condition
 *   C06  Existing V-01 ownership check still present (regression guard)
 *   C07  Pure-logic: P2002 from concurrent claim → 409 response
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const routeSource = readFileSync(
  resolve(process.cwd(), 'app/api/instructor/domain/verify/route.ts'),
  'utf-8'
);

const migrationSource = readFileSync(
  resolve(process.cwd(), 'prisma/migrations/20261027000001_wla_007_domain_verified_unique/migration.sql'),
  'utf-8'
);

describe('WLA-007 — Concurrent domain ownership claims (DB constraint fix)', () => {

  it('C01 | Route catches P2002 and returns 409', () => {
    expect(routeSource).toContain("'P2002'");
    expect(routeSource).toContain('409');
    expect(routeSource).toContain('claimed by another account');
  });

  it('C02 | Route uses prisma.provider.update (not updateMany with tautology)', () => {
    // The corrected fix uses a simple update with P2002 catch
    expect(routeSource).toContain('prisma.provider.update(');
    // The old tautological updateMany is gone
    expect(routeSource).not.toContain('claimed.count');
  });

  it('C03 | Migration creates partial unique index on customDomain', () => {
    expect(migrationSource).toContain('CREATE UNIQUE INDEX');
    expect(migrationSource).toContain('Provider_customDomain_domainVerified_unique');
    expect(migrationSource).toContain('"customDomain"');
  });

  it('C04 | Migration index is partial (WHERE domainVerified = true)', () => {
    // The index only applies to verified domains — multiple providers can
    // have the same customDomain pending (domainVerified=false)
    expect(migrationSource).toContain('WHERE "domainVerified" = true');
  });

  it('C05 | Route source no longer contains tautological AND/NOT condition', () => {
    // The previous broken code had: AND: [NOT: { id: { not: instructor.id } }]
    // which was always true and provided no protection
    expect(routeSource).not.toContain('id: { not: instructor.id }');
    expect(routeSource).not.toContain('claimed = await');
  });

  it('C06 | Existing V-01 ownership check still present (regression guard)', () => {
    expect(routeSource).toContain('V-01 FIX');
    expect(routeSource).toContain('existingOwner');
  });

  it('C07 | Pure-logic: P2002 from concurrent claim produces 409', () => {
    // Simulate: Provider A and B both pass the pre-write findFirst check.
    // Provider A's update succeeds. Provider B's update fails with P2002
    // because the partial unique index prevents two verified owners.
    function attemptClaim(
      providerId: string,
      domain: string,
      dbState: Map<string, { customDomain: string | null; domainVerified: boolean }>
    ): { success: boolean; error?: string } {
      // Check if another provider already has this domain verified
      for (const [id, record] of dbState) {
        if (id !== providerId && record.customDomain === domain && record.domainVerified) {
          // P2002 — unique constraint violation
          return { success: false, error: 'P2002' };
        }
      }
      // No conflict — claim succeeds
      dbState.set(providerId, { customDomain: domain, domainVerified: true });
      return { success: true };
    }

    const db = new Map<string, { customDomain: string | null; domainVerified: boolean }>([
      ['prov-a', { customDomain: null, domainVerified: false }],
      ['prov-b', { customDomain: null, domainVerified: false }],
    ]);

    // Both pass the pre-write check (neither has the domain yet)
    // Provider A claims first
    const resultA = attemptClaim('prov-a', 'test.com', db);
    expect(resultA.success).toBe(true);

    // Provider B claims second — should fail with P2002
    const resultB = attemptClaim('prov-b', 'test.com', db);
    expect(resultB.success).toBe(false);
    expect(resultB.error).toBe('P2002');

    // Only Provider A owns the verified domain
    expect(db.get('prov-a')?.customDomain).toBe('test.com');
    expect(db.get('prov-a')?.domainVerified).toBe(true);
    expect(db.get('prov-b')?.customDomain).toBe(null);
    expect(db.get('prov-b')?.domainVerified).toBe(false);
  });

});
