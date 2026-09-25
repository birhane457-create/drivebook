/**
 * AUDIT-05: Provider Review Atomic Audit Coverage — HTTP Integration Tests
 *
 * PURPOSE:
 * Verify that the ACTUAL approve/reject/suspend route handlers:
 * 1. Perform Provider state mutations atomically with AuditLog writes
 * 2. Roll back Provider changes when audit write fails
 * 3. Enforce authorization properly (no mutation + no audit for unauthorized requests)
 * 4. Use correct audit action enums (APPROVE_INSTRUCTOR, REJECT_INSTRUCTOR, SUSPEND_INSTRUCTOR)
 * 5. Capture correct metadata (actor, reason, target, IP, user-agent)
 *
 * ARCHITECTURE:
 * Vitest
 *   ↓ HTTP requests
 * Next.js application (localhost:3001)
 *   ↓ actual middleware/auth/permissions
 * Admin provider review routes
 *   ↓ Prisma $transaction
 * PostgreSQL (localhost:5433/drivebook_test)
 *
 * AUTHENTICATION:
 * - Real admin user with USERS_PROVIDERS_* permissions
 * - Session cookie via /api/auth/signin
 * - NO mocked auth, NO bypasses
 *
 * ROUTES UNDER TEST:
 * - POST /api/admin/instructors/[id]/approve
 * - POST /api/admin/instructors/[id]/reject
 * - POST /api/admin/instructors/[id]/suspend
 *
 * DATABASE: postgresql://postgres:testpass@localhost:5433/drivebook_test
 *
 * EXECUTION:
 * 1. Start server: PORT=3001 DATABASE_URL=postgresql://postgres:testpass@localhost:5433/drivebook_test npm run dev
 * 2. Run tests: DATABASE_URL=postgresql://postgres:testpass@localhost:5433/drivebook_test npx vitest run audit-05-http
 *
 * EVIDENCE FOR: AUDIT-05 TEST-VERIFIED gate
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

const TEST_SERVER_URL = process.env.TEST_SERVER_URL || 'http://localhost:3001';
const TEST_PREFIX = `audit05_http_${Date.now()}`;

let testAdmin: any;
let testNonAdmin: any;
let adminSessionCookie: string;
let nonAdminSessionCookie: string;

describe('AUDIT-05: Provider Review Atomic Audit Coverage (HTTP)', () => {
  beforeAll(async () => {
    // Safety: verify test database
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl || !dbUrl.includes('drivebook_test')) {
      throw new Error(`SAFETY: DATABASE_URL must contain 'drivebook_test'. Current: ${dbUrl?.substring(0, 50)}...`);
    }
    console.log(`[AUDIT-05-HTTP] Database: ${dbUrl.substring(0, 70)}...`);

    // Check server is running
    try {
      await request(TEST_SERVER_URL).get('/api/health').timeout(5000);
      console.log('[AUDIT-05-HTTP] Server is reachable');
    } catch (err) {
      throw new Error(`TEST SERVER NOT RUNNING: Start Next.js on ${TEST_SERVER_URL}. Error: ${err}`);
    }

    // Create admin user with permissions
    const hashedPassword = await bcrypt.hash('admin-test-pass-audit05', 10);
    testAdmin = await prisma.user.create({
      data: {
        email: `${TEST_PREFIX}_admin@example.com`,
        name: 'AUDIT-05 Admin',
        role: 'SUPER_ADMIN', // SUPER_ADMIN has wildcard permissions (no StaffMember record needed)
        password: hashedPassword,
        emailVerified: true,
      },
    });

    // Create non-admin user (no provider permissions)
    const nonAdminPassword = await bcrypt.hash('nonadmin-test-pass-audit05', 10);
    testNonAdmin = await prisma.user.create({
      data: {
        email: `${TEST_PREFIX}_nonadmin@example.com`,
        name: 'AUDIT-05 Non-Admin',
        role: 'INSTRUCTOR', // Not ADMIN
        password: nonAdminPassword,
        emailVerified: true,
      },
    });

    // Authenticate admin with proper CSRF flow
    console.log('[AUDIT-05-HTTP] Authenticating admin...');
    
    // Step 1: Get CSRF token
    const csrfResponse = await request(TEST_SERVER_URL).get('/api/auth/csrf');
    const csrfToken = csrfResponse.body.csrfToken;
    const csrfCookies = (csrfResponse.headers['set-cookie'] as string[]) ?? [];
    const csrfCookieHeader = csrfCookies.map((c: string) => c.split(';')[0]).join('; ');

    // Step 2: POST credentials with CSRF
    const adminAuthRes = await request(TEST_SERVER_URL)
      .post('/api/auth/callback/credentials')
      .set('Cookie', csrfCookieHeader)
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send(
        `csrfToken=${encodeURIComponent(csrfToken)}&email=${encodeURIComponent(testAdmin.email)}&password=${encodeURIComponent('admin-test-pass-audit05')}`
      );

    if (adminAuthRes.status !== 200 && adminAuthRes.status !== 302) {
      throw new Error(`Admin authentication failed: ${adminAuthRes.status} ${JSON.stringify(adminAuthRes.body)}`);
    }

    const cookies = adminAuthRes.headers['set-cookie'];
    if (!cookies) {
      throw new Error('No session cookie returned from admin auth');
    }
    const sessionCookie = cookies.find((c: string) => c.includes('next-auth.session-token'));
    if (!sessionCookie) {
      throw new Error('No next-auth.session-token in response');
    }
    adminSessionCookie = sessionCookie.split(';')[0];
    console.log('[AUDIT-05-HTTP] Admin authenticated');

    // Authenticate non-admin with proper CSRF flow
    const csrfResponse2 = await request(TEST_SERVER_URL).get('/api/auth/csrf');
    const csrfToken2 = csrfResponse2.body.csrfToken;
    const csrfCookies2 = (csrfResponse2.headers['set-cookie'] as string[]) ?? [];
    const csrfCookieHeader2 = csrfCookies2.map((c: string) => c.split(';')[0]).join('; ');

    const nonAdminAuthRes = await request(TEST_SERVER_URL)
      .post('/api/auth/callback/credentials')
      .set('Cookie', csrfCookieHeader2)
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send(
        `csrfToken=${encodeURIComponent(csrfToken2)}&email=${encodeURIComponent(testNonAdmin.email)}&password=${encodeURIComponent('nonadmin-test-pass-audit05')}`
      );

    if (nonAdminAuthRes.status !== 200 && nonAdminAuthRes.status !== 302) {
      throw new Error(`Non-admin authentication failed: ${nonAdminAuthRes.status}`);
    }

    const nonAdminCookies = nonAdminAuthRes.headers['set-cookie'];
    if (!nonAdminCookies) {
      throw new Error('No session cookie returned from non-admin auth');
    }
    const nonAdminSession = nonAdminCookies.find((c: string) => c.includes('next-auth.session-token'));
    if (!nonAdminSession) {
      throw new Error('No next-auth.session-token for non-admin');
    }
    nonAdminSessionCookie = nonAdminSession.split(';')[0];
    console.log('[AUDIT-05-HTTP] Non-admin authenticated');
  });

  afterAll(async () => {
    // Cleanup
    await prisma.auditLog.deleteMany({
      where: { actorId: { in: [testAdmin.id, testNonAdmin.id] } },
    });
    await prisma.provider.deleteMany({
      where: {
        name: { startsWith: TEST_PREFIX },
      },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [testAdmin.id, testNonAdmin.id] } },
    });
    console.log('[AUDIT-05-HTTP] Cleanup complete');
  });

  describe('A: Successful Route Operations', () => {
    it('A1: approve route writes Provider.approvalStatus=APPROVED + AuditLog atomically', async () => {
      // Create Provider using raw SQL (matching working test DB schema)
      const providerId = `prov_a1_${Date.now()}`;
      await prisma.$executeRaw`
        INSERT INTO "Provider" (id, name, phone, "hourlyRate", "approvalStatus", "isActive")
        VALUES (${providerId}, ${`${TEST_PREFIX}_a1`}, ${'555-0001'}, 50.0, 'PENDING', false)
      `;

      // Create required documents using Prisma (handles all defaults automatically)
      await prisma.drivingProviderProfile.create({
        data: {
          providerId: providerId,
          licenseImageFront: 'front.jpg',
          licenseImageBack: 'back.jpg',
          insurancePolicyDoc: 'insurance.pdf',
          policeCheckDoc: 'police.pdf',
        },
      });

      // Also need to update Provider with profileImage (required for approval)
      await prisma.$executeRaw`
        UPDATE "Provider" SET "profileImage" = 'profile_a1.jpg' WHERE id = ${providerId}
      `;

      const res = await request(TEST_SERVER_URL)
        .post(`/api/admin/instructors/${providerId}/approve`)
        .set('Cookie', adminSessionCookie)
        .send({});

      expect(res.status).toBe(200);

      const updated = await prisma.$queryRaw`SELECT * FROM "Provider" WHERE id = ${providerId}`;
      expect(updated[0].approvalStatus).toBe('APPROVED');

      const auditLogs = await prisma.auditLog.findMany({
        where: { targetType: 'provider', targetId: providerId },
      });
      expect(auditLogs.length).toBe(1);
      expect(auditLogs[0].action).toBe('APPROVE_INSTRUCTOR');
    });

    it('A2: reject route writes Provider.approvalStatus=REJECTED + AuditLog atomically', async () => {
      const providerId = `prov_a2_${Date.now()}`;
      await prisma.$executeRaw`
        INSERT INTO "Provider" (id, name, phone, "hourlyRate", "approvalStatus", "isActive")
        VALUES (${providerId}, ${`${TEST_PREFIX}_a2`}, ${'555-0002'}, 50.0, 'PENDING', false)
      `;

      const res = await request(TEST_SERVER_URL)
        .post(`/api/admin/instructors/${providerId}/reject`)
        .set('Cookie', adminSessionCookie)
        .send({ reason: 'Incomplete documentation' });

      expect(res.status).toBe(200);

      const updated = await prisma.$queryRaw`SELECT * FROM "Provider" WHERE id = ${providerId}`;
      expect(updated[0].approvalStatus).toBe('REJECTED');

      const auditLogs = await prisma.auditLog.findMany({
        where: { targetType: 'provider', targetId: providerId },
      });
      expect(auditLogs.length).toBe(1);
      expect(auditLogs[0].action).toBe('REJECT_INSTRUCTOR');
    });

    it('A3: suspend route writes Provider.isActive=false + AuditLog atomically', async () => {
      const providerId = `prov_a3_${Date.now()}`;
      await prisma.$executeRaw`
        INSERT INTO "Provider" (id, name, phone, "hourlyRate", "approvalStatus", "isActive")
        VALUES (${providerId}, ${`${TEST_PREFIX}_a3`}, ${'555-0003'}, 50.0, 'APPROVED', true)
      `;

      const res = await request(TEST_SERVER_URL)
        .post(`/api/admin/instructors/${providerId}/suspend`)
        .set('Cookie', adminSessionCookie)
        .send({ reason: 'Policy violation' });

      expect(res.status).toBe(200);

      const updated = await prisma.$queryRaw`SELECT * FROM "Provider" WHERE id = ${providerId}`;
      expect(updated[0].approvalStatus).toBe('SUSPENDED');
      expect(updated[0].isActive).toBe(false);

      const auditLogs = await prisma.auditLog.findMany({
        where: { targetType: 'provider', targetId: providerId },
      });
      expect(auditLogs.length).toBe(1);
      expect(auditLogs[0].action).toBe('SUSPEND_INSTRUCTOR');
    });
  });

  // NOTE: B1 (audit failure rollback) is NOT included in this HTTP suite.
  // 
  // Rationale:
  // - Cannot force writeAuditLog() to throw via HTTP without test-only production endpoint
  // - Creating test-only endpoints increases attack surface unnecessarily
  // - Atomicity property is proven by database-level tests (audit-05-provider-review-atomicity.test.ts)
  //
  // Evidence model:
  // - HTTP tests prove: route integration, auth, correct enums, metadata
  // - DB tests prove: transaction atomicity, rollback on audit failure

  describe('C: Authorization', () => {
    it('C1: unauthorized request returns 401/403 and performs no Provider mutation or AuditLog write', async () => {
      const providerId = `prov_c1_${Date.now()}`;
      await prisma.$executeRaw`
        INSERT INTO "Provider" (id, name, phone, "hourlyRate", "approvalStatus", "isActive")
        VALUES (${providerId}, ${`${TEST_PREFIX}_c1`}, ${'555-0004'}, 50.0, 'PENDING', false)
      `;

      const res = await request(TEST_SERVER_URL)
        .post(`/api/admin/instructors/${providerId}/approve`)
        .set('Cookie', nonAdminSessionCookie)
        .send({});

      expect([401, 403]).toContain(res.status);

      const unchanged = await prisma.$queryRaw`SELECT * FROM "Provider" WHERE id = ${providerId}`;
      expect(unchanged[0].approvalStatus).toBe('PENDING');

      const auditLogs = await prisma.auditLog.findMany({
        where: { targetType: 'provider', targetId: providerId },
      });
      expect(auditLogs.length).toBe(0);
    });

    it('C2: unauthenticated request returns 401 and performs no mutations', async () => {
      const providerId = `prov_c2_${Date.now()}`;
      await prisma.$executeRaw`
        INSERT INTO "Provider" (id, name, phone, "hourlyRate", "approvalStatus", "isActive")
        VALUES (${providerId}, ${`${TEST_PREFIX}_c2`}, ${'555-0005'}, 50.0, 'PENDING', false)
      `;

      const res = await request(TEST_SERVER_URL)
        .post(`/api/admin/instructors/${providerId}/approve`)
        .send({});

      expect(res.status).toBe(401);

      const unchanged = await prisma.$queryRaw`SELECT * FROM "Provider" WHERE id = ${providerId}`;
      expect(unchanged[0].approvalStatus).toBe('PENDING');

      const auditLogs = await prisma.auditLog.findMany({
        where: { targetType: 'provider', targetId: providerId },
      });
      expect(auditLogs.length).toBe(0);
    });
  });

  describe('D: Metadata Correctness', () => {
    it('D1: audit metadata includes reason, actor, IP, user-agent', async () => {
      const providerId = `prov_d1_${Date.now()}`;
      await prisma.$executeRaw`
        INSERT INTO "Provider" (id, name, phone, "hourlyRate", "approvalStatus", "isActive")
        VALUES (${providerId}, ${`${TEST_PREFIX}_d1`}, ${'555-0006'}, 50.0, 'PENDING', false)
      `;

      const res = await request(TEST_SERVER_URL)
        .post(`/api/admin/instructors/${providerId}/reject`)
        .set('Cookie', adminSessionCookie)
        .set('User-Agent', 'AUDIT-05-Test-Agent')
        .set('X-Forwarded-For', '10.0.0.99')
        .send({ reason: 'Test rejection reason' });

      expect(res.status).toBe(200);

      const auditLog = await prisma.auditLog.findFirst({
        where: { targetType: 'provider', targetId: providerId },
      });

      expect(auditLog).toBeTruthy();
      expect(auditLog?.actorId).toBe(testAdmin.id);
      expect(auditLog?.metadata).toMatchObject({ reason: 'Test rejection reason' });
      expect(auditLog?.ipAddress).toBe('10.0.0.99');
      expect(auditLog?.userAgent).toContain('AUDIT-05-Test-Agent');
    });
  });

  describe('E: Multiple Operations', () => {
    it('E1: approve→suspend sequence creates two distinct audit entries with correct actions', async () => {
      const providerId = `prov_e1_${Date.now()}`;
      await prisma.$executeRaw`
        INSERT INTO "Provider" (id, name, phone, "hourlyRate", "approvalStatus", "isActive")
        VALUES (${providerId}, ${`${TEST_PREFIX}_e1`}, ${'555-0007'}, 50.0, 'PENDING', false)
      `;

      // Add required documents for approve using Prisma (handles all defaults automatically)
      await prisma.drivingProviderProfile.create({
        data: {
          providerId: providerId,
          licenseImageFront: 'front2.jpg',
          licenseImageBack: 'back2.jpg',
          insurancePolicyDoc: 'ins2.pdf',
          policeCheckDoc: 'police2.pdf',
        },
      });

      // Also need to update Provider with profileImage (required for approval)
      await prisma.$executeRaw`
        UPDATE "Provider" SET "profileImage" = 'profile_e1.jpg' WHERE id = ${providerId}
      `;

      const res1 = await request(TEST_SERVER_URL)
        .post(`/api/admin/instructors/${providerId}/approve`)
        .set('Cookie', adminSessionCookie)
        .send({});

      expect(res1.status).toBe(200);

      const res2 = await request(TEST_SERVER_URL)
        .post(`/api/admin/instructors/${providerId}/suspend`)
        .set('Cookie', adminSessionCookie)
        .send({ reason: 'Suspended after approval for testing' });

      expect(res2.status).toBe(200);

      const auditLogs = await prisma.auditLog.findMany({
        where: { targetType: 'provider', targetId: providerId },
        orderBy: { createdAt: 'asc' },
      });

      expect(auditLogs.length).toBe(2);
      expect(auditLogs[0].action).toBe('APPROVE_INSTRUCTOR');
      expect(auditLogs[1].action).toBe('SUSPEND_INSTRUCTOR');
      expect(auditLogs[1].metadata).toMatchObject({ reason: 'Suspended after approval for testing' });
    });
  });
});
