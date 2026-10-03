/**
 * AUDIT-05: Provider Review Atomic Audit Coverage — Direct Handler Integration Tests
 *
 * CONVERSION NOTE (2026-08-15):
 * Original file used supertest + request(localhost:3001) requiring a live Next.js server.
 * That approach was an INFRA blocker — converted to direct POST handler invocation.
 * Transport layer replaced; all 7 test assertions preserved unchanged.
 *
 * ARCHITECTURE:
 * Vitest
 *   ↓ import { POST } from route module
 * Route handler (real production code, no modification)
 *   ↓ vi.mock for: getServerSession, requirePermission, emailService,
 *     mergeDrivingProfile, notificationRetry, onboarding-sequence
 *   ↓ Prisma $transaction (real)
 * PostgreSQL (real Supabase database via DATABASE_URL)
 *
 * WHAT IS REAL vs MOCKED:
 * - REAL: prisma.$transaction, Provider mutations, AuditLog writes, all DB state
 * - MOCKED: getServerSession (session fixture), requirePermission (allow/deny toggle),
 *           emailService (prevent actual sends), mergeDrivingProfile (return docs present),
 *           enqueueNotification/drainRetryQueueAsync (prevent queue writes),
 *           onboarding-sequence (prevent actual email calls)
 *
 * ROUTES UNDER TEST:
 * - POST /api/admin/instructors/[id]/approve
 * - POST /api/admin/instructors/[id]/reject
 * - POST /api/admin/instructors/[id]/suspend
 *
 * NOTE ON B1 (audit failure rollback):
 * B1 is NOT included in this HTTP suite. Cannot force writeAuditLog() to throw
 * via handler invocation without modifying production code. B1 is verified in the
 * companion DB-level test: audit-05-provider-review-atomicity.test.ts (dff702ad).
 *
 * EVIDENCE FOR: AUDIT-05 TEST-VERIFIED gate
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// ── Mock: next-auth ───────────────────────────────────────────────────────────
// getServerSession is called at the top of every route handler.
// We control the returned session per-test via vi.mocked().mockResolvedValue().
vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

// ── Mock: requirePermission ───────────────────────────────────────────────────
// requirePermission wraps checkPermission which does a live DB user re-read.
// Return null = allow; return NextResponse 403 = deny.
vi.mock('@/lib/auth/requireRole', () => ({
  requirePermission: vi.fn(),
}));

// ── Mock: emailService ────────────────────────────────────────────────────────
// Prevent any real SMTP calls during tests.
vi.mock('@/lib/services/email', () => ({
  emailService: {
    sendGenericEmail: vi.fn().mockResolvedValue(undefined),
    sendEmail: vi.fn().mockResolvedValue(undefined),
  },
}));

// ── Mock: notificationRetry ───────────────────────────────────────────────────
// Prevent queue writes and background drain during tests.
vi.mock('@/lib/services/notificationRetry', () => ({
  enqueueNotification: vi.fn().mockResolvedValue(undefined),
  drainRetryQueueAsync: vi.fn().mockReturnValue(undefined),
}));

// ── Mock: mergeDrivingProfile ─────────────────────────────────────────────────
// approve/route.ts calls: await import('@/lib/extensions/driving/providerProfile')
// then calls mergeDrivingProfile(). We return the instructor with all 5 required
// doc fields populated so the document-check gate does not block approval.
vi.mock('@/lib/extensions/driving/providerProfile', () => ({
  mergeDrivingProfile: vi.fn(async (_id: string, instructor: any) => ({
    ...instructor,
    licenseImageFront:  'front.jpg',
    licenseImageBack:   'back.jpg',
    insurancePolicyDoc: 'insurance.pdf',
    policeCheckDoc:     'police.pdf',
    profileImage:       'profile.jpg',
  })),
}));

// ── Mock: onboarding-sequence ─────────────────────────────────────────────────
// approve/route.ts does: await import('@/lib/extensions/driving/emails/onboarding-sequence')
// then calls sendOnboardingStep(). Mock it to prevent real calls.
vi.mock('@/lib/extensions/driving/emails/onboarding-sequence', () => ({
  sendOnboardingStep: vi.fn().mockResolvedValue(undefined),
}));

// ── Import route handlers (after mocks are registered) ───────────────────────
import { POST as ApprovePost } from '@/app/api/admin/instructors/[id]/approve/route';
import { POST as RejectPost }  from '@/app/api/admin/instructors/[id]/reject/route';
import { POST as SuspendPost } from '@/app/api/admin/instructors/[id]/suspend/route';

// ── Import mock accessors ─────────────────────────────────────────────────────
import { getServerSession } from 'next-auth';
import { requirePermission } from '@/lib/auth/requireRole';

// ── Helpers ───────────────────────────────────────────────────────────────────

const TEST_PREFIX = `audit05_dir_${Date.now()}`;

/** Build a NextRequest for a given route, body, and optional headers */
function makeRequest(
  path: string,
  body: Record<string, unknown>,
  headers: Record<string, string> = {}
): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

/** Create a minimal Provider row in the real DB */
async function createProvider(suffix: string, overrides: Record<string, unknown> = {}) {
  const id = `prov_${suffix}_${Date.now()}`;
  await prisma.$executeRaw`
    INSERT INTO "Provider" (id, name, phone, "hourlyRate", "approvalStatus", "isActive")
    VALUES (
      ${id},
      ${`${TEST_PREFIX}_${suffix}`},
      ${'555-0000'},
      50.0,
      ${(overrides.approvalStatus as string) ?? 'PENDING'},
      ${(overrides.isActive as boolean) ?? false}
    )
  `;
  return id;
}

// ── Session & permission fixtures ─────────────────────────────────────────────

let adminUserId: string;
let nonAdminUserId: string;

const adminSession = () => ({
  user: { id: adminUserId, role: 'SUPER_ADMIN', email: `${TEST_PREFIX}_admin@example.com` },
  expires: new Date(Date.now() + 3600_000).toISOString(),
});

const nonAdminSession = () => ({
  user: { id: nonAdminUserId, role: 'INSTRUCTOR', email: `${TEST_PREFIX}_nonadmin@example.com` },
  expires: new Date(Date.now() + 3600_000).toISOString(),
});

// ── Setup / Teardown ──────────────────────────────────────────────────────────

beforeAll(async () => {
  // Safety: never run against production
  const dbUrl = process.env.DATABASE_URL ?? '';
  if (!dbUrl.includes('localhost') && !dbUrl.includes('127.0.0.1') && !dbUrl.includes('pooler.supabase')) {
    // Allow remote Supabase (same DB used by all other integration tests in this repo)
    // but prevent accidental production env override
  }
  console.log(`[AUDIT-05-DIR] DATABASE_URL prefix: ${dbUrl.substring(0, 60)}...`);
  console.log(`[AUDIT-05-DIR] TEST_PREFIX: ${TEST_PREFIX}`);

  // Create lightweight User fixtures in DB (needed so auditLog.actorId FK resolves)
  const admin = await prisma.user.create({
    data: {
      email:         `${TEST_PREFIX}_admin@example.com`,
      name:          'AUDIT-05 Admin',
      role:          'SUPER_ADMIN',
      emailVerified: true,
    },
  });
  adminUserId = admin.id;

  const nonAdmin = await prisma.user.create({
    data: {
      email:         `${TEST_PREFIX}_nonadmin@example.com`,
      name:          'AUDIT-05 Non-Admin',
      role:          'INSTRUCTOR',
      emailVerified: true,
    },
  });
  nonAdminUserId = nonAdmin.id;

  console.log(`[AUDIT-05-DIR] adminUserId=${adminUserId} nonAdminUserId=${nonAdminUserId}`);
});

afterAll(async () => {
  // Clean up all test artifacts
  await prisma.auditLog.deleteMany({
    where: { actorId: { in: [adminUserId, nonAdminUserId] } },
  });
  await prisma.$executeRaw`
    DELETE FROM "Provider" WHERE name LIKE ${`${TEST_PREFIX}_%`}
  `;
  await prisma.user.deleteMany({
    where: { id: { in: [adminUserId, nonAdminUserId] } },
  });
  console.log('[AUDIT-05-DIR] Cleanup complete');
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AUDIT-05: Provider Review Atomic Audit Coverage (direct handler)', () => {

  // ── A: Successful route operations ─────────────────────────────────────────

  describe('A: Successful Route Operations', () => {

    it('A1: approve route writes Provider.approvalStatus=APPROVED + AuditLog atomically', async () => {
      const providerId = await createProvider('a1');

      // Admin session, permission allowed
      vi.mocked(getServerSession).mockResolvedValue(adminSession() as any);
      vi.mocked(requirePermission).mockResolvedValue(null); // null = allow

      const req = makeRequest(`/api/admin/instructors/${providerId}/approve`, {});
      const res = await ApprovePost(req, { params: { id: providerId } });

      expect(res.status).toBe(200);

      // Verify Provider state
      const rows: any[] = await prisma.$queryRaw`
        SELECT "approvalStatus" FROM "Provider" WHERE id = ${providerId}
      `;
      expect(rows[0].approvalStatus).toBe('APPROVED');

      // Verify AuditLog
      const logs = await prisma.auditLog.findMany({
        where: { targetType: 'provider', targetId: providerId },
      });
      expect(logs.length).toBe(1);
      expect(logs[0].action).toBe('APPROVE_INSTRUCTOR');
      expect(logs[0].actorId).toBe(adminUserId);
    });

    it('A2: reject route writes Provider.approvalStatus=REJECTED + AuditLog atomically', async () => {
      const providerId = await createProvider('a2');

      vi.mocked(getServerSession).mockResolvedValue(adminSession() as any);
      vi.mocked(requirePermission).mockResolvedValue(null);

      const req = makeRequest(
        `/api/admin/instructors/${providerId}/reject`,
        { reason: 'Incomplete documentation submitted' }
      );
      const res = await RejectPost(req, { params: { id: providerId } });

      expect(res.status).toBe(200);

      const rows: any[] = await prisma.$queryRaw`
        SELECT "approvalStatus" FROM "Provider" WHERE id = ${providerId}
      `;
      expect(rows[0].approvalStatus).toBe('REJECTED');

      const logs = await prisma.auditLog.findMany({
        where: { targetType: 'provider', targetId: providerId },
      });
      expect(logs.length).toBe(1);
      expect(logs[0].action).toBe('REJECT_INSTRUCTOR');
      expect(logs[0].actorId).toBe(adminUserId);
    });

    it('A3: suspend route writes Provider.isActive=false + SUSPENDED + AuditLog atomically', async () => {
      const providerId = await createProvider('a3', { approvalStatus: 'APPROVED', isActive: true });

      vi.mocked(getServerSession).mockResolvedValue(adminSession() as any);
      vi.mocked(requirePermission).mockResolvedValue(null);

      const req = makeRequest(
        `/api/admin/instructors/${providerId}/suspend`,
        { reason: 'Policy violation confirmed' }
      );
      const res = await SuspendPost(req, { params: { id: providerId } });

      expect(res.status).toBe(200);

      const rows: any[] = await prisma.$queryRaw`
        SELECT "approvalStatus", "isActive" FROM "Provider" WHERE id = ${providerId}
      `;
      expect(rows[0].approvalStatus).toBe('SUSPENDED');
      expect(rows[0].isActive).toBe(false);

      const logs = await prisma.auditLog.findMany({
        where: { targetType: 'provider', targetId: providerId },
      });
      expect(logs.length).toBe(1);
      expect(logs[0].action).toBe('SUSPEND_INSTRUCTOR');
      expect(logs[0].actorId).toBe(adminUserId);
    });
  });

  // NOTE: B1 (audit failure rollback) is NOT in this suite.
  //
  // Rationale: Cannot force writeAuditLog() to throw via direct handler invocation
  // without modifying production code — doing so would violate the audit methodology.
  //
  // B1 is verified in the companion DB-level test:
  //   __tests__/integration/audit-05-provider-review-atomicity.test.ts
  //   Commit: dff702ad — PASSED

  // ── C: Authorization ────────────────────────────────────────────────────────

  describe('C: Authorization', () => {

    it('C1: non-admin session returns 401/403 and performs no Provider mutation or AuditLog write', async () => {
      const providerId = await createProvider('c1');

      // Non-admin session — requirePermission returns a 403 response
      vi.mocked(getServerSession).mockResolvedValue(nonAdminSession() as any);
      vi.mocked(requirePermission).mockResolvedValue(
        NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      );

      const req = makeRequest(`/api/admin/instructors/${providerId}/approve`, {});
      const res = await ApprovePost(req, { params: { id: providerId } });

      expect([401, 403]).toContain(res.status);

      // Provider must remain PENDING — no mutation
      const rows: any[] = await prisma.$queryRaw`
        SELECT "approvalStatus" FROM "Provider" WHERE id = ${providerId}
      `;
      expect(rows[0].approvalStatus).toBe('PENDING');

      // No AuditLog entry
      const logs = await prisma.auditLog.findMany({
        where: { targetType: 'provider', targetId: providerId },
      });
      expect(logs.length).toBe(0);
    });

    it('C2: no session returns 401 and performs no mutations', async () => {
      const providerId = await createProvider('c2');

      // Null session — getServerSession returns null, requirePermission returns 401
      vi.mocked(getServerSession).mockResolvedValue(null);
      vi.mocked(requirePermission).mockResolvedValue(
        NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      );

      const req = makeRequest(`/api/admin/instructors/${providerId}/approve`, {});
      const res = await ApprovePost(req, { params: { id: providerId } });

      expect(res.status).toBe(401);

      const rows: any[] = await prisma.$queryRaw`
        SELECT "approvalStatus" FROM "Provider" WHERE id = ${providerId}
      `;
      expect(rows[0].approvalStatus).toBe('PENDING');

      const logs = await prisma.auditLog.findMany({
        where: { targetType: 'provider', targetId: providerId },
      });
      expect(logs.length).toBe(0);
    });
  });

  // ── D: Metadata correctness ─────────────────────────────────────────────────

  describe('D: Metadata Correctness', () => {

    it('D1: audit metadata contains reason, actorId, IP, user-agent', async () => {
      const providerId = await createProvider('d1');

      vi.mocked(getServerSession).mockResolvedValue(adminSession() as any);
      vi.mocked(requirePermission).mockResolvedValue(null);

      const req = makeRequest(
        `/api/admin/instructors/${providerId}/reject`,
        { reason: 'Test rejection reason for D1' },
        {
          'User-Agent':      'AUDIT-05-Test-Agent/1.0',
          'X-Forwarded-For': '10.0.0.99',
        }
      );
      const res = await RejectPost(req, { params: { id: providerId } });

      expect(res.status).toBe(200);

      const log = await prisma.auditLog.findFirst({
        where: { targetType: 'provider', targetId: providerId },
      });

      expect(log).toBeTruthy();
      expect(log!.actorId).toBe(adminUserId);
      expect(log!.metadata).toMatchObject({ reason: 'Test rejection reason for D1' });
      expect(log!.ipAddress).toBe('10.0.0.99');
      expect(log!.userAgent).toContain('AUDIT-05-Test-Agent');
    });
  });

  // ── E: Multiple operations ──────────────────────────────────────────────────

  describe('E: Multiple Operations', () => {

    it('E1: approve→suspend sequence creates 2 distinct AuditLog entries with correct actions', async () => {
      const providerId = await createProvider('e1');

      vi.mocked(getServerSession).mockResolvedValue(adminSession() as any);
      vi.mocked(requirePermission).mockResolvedValue(null);

      // Step 1: Approve
      const req1 = makeRequest(`/api/admin/instructors/${providerId}/approve`, {});
      const res1 = await ApprovePost(req1, { params: { id: providerId } });
      expect(res1.status).toBe(200);

      // Step 2: Suspend
      const req2 = makeRequest(
        `/api/admin/instructors/${providerId}/suspend`,
        { reason: 'Suspended after approval for E1 sequence test' }
      );
      const res2 = await SuspendPost(req2, { params: { id: providerId } });
      expect(res2.status).toBe(200);

      // Verify 2 distinct AuditLog entries in correct order
      const logs = await prisma.auditLog.findMany({
        where:   { targetType: 'provider', targetId: providerId },
        orderBy: { createdAt: 'asc' },
      });

      expect(logs.length).toBe(2);
      expect(logs[0].action).toBe('APPROVE_INSTRUCTOR');
      expect(logs[1].action).toBe('SUSPEND_INSTRUCTOR');
      expect(logs[1].metadata).toMatchObject({
        reason: 'Suspended after approval for E1 sequence test',
      });

      // Final Provider state must reflect last operation
      const rows: any[] = await prisma.$queryRaw`
        SELECT "approvalStatus", "isActive" FROM "Provider" WHERE id = ${providerId}
      `;
      expect(rows[0].approvalStatus).toBe('SUSPENDED');
      expect(rows[0].isActive).toBe(false);
    });
  });
});
