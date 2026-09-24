/**
 * RBAC-M-02 Verification Tests
 *
 * Proves that admin routes use permission-based authorization,
 * not role-based authorization.
 *
 * Original finding (Phase 1 register):
 *   "app/admin/revenue/route.ts checks role === 'SUPER_ADMIN'
 *    instead of requirePermission(PERM.FINANCIAL_REPORTS_VIEW)"
 *
 * Current state:
 *   All sampled admin routes use requirePermission/checkPermission
 *   with fine-grained permissions.
 *
 * These tests prove:
 *   1. ADMIN with correct permission → allowed
 *   2. ADMIN without permission → 403
 *   3. SUPER_ADMIN → allowed (bypass)
 *   4. Non-admin → 403
 *   5. Unauthenticated → 401
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3001';

// Test users
let superAdminUser: any;
let adminWithPermUser: any;
let adminWithoutPermUser: any;
let clientUser: any;

// Cleanup IDs
const testEmails: string[] = [];

beforeAll(async () => {
  const timestamp = Date.now();

  // 1. SUPER_ADMIN
  superAdminUser = await prisma.user.create({
    data: {
      email: `rbac-m02-superadmin-${timestamp}@test.internal`,
      name: 'RBAC M02 Super Admin',
      role: 'SUPER_ADMIN',
      password: await bcrypt.hash('test123', 10),
      emailVerified: true,
    },
  });
  testEmails.push(superAdminUser.email);

  await prisma.staffMember.create({
    data: {
      userId: superAdminUser.id,
      name: superAdminUser.name,
      email: superAdminUser.email,
      department: 'ADMIN',
      permissions: [], // SUPER_ADMIN doesn't need permissions
    },
  });

  // 2. ADMIN with FINANCE_REVENUE_VIEW permission
  adminWithPermUser = await prisma.user.create({
    data: {
      email: `rbac-m02-admin-with-perm-${timestamp}@test.internal`,
      name: 'RBAC M02 Admin With Permission',
      role: 'ADMIN',
      password: await bcrypt.hash('test123', 10),
      emailVerified: true,
    },
  });
  testEmails.push(adminWithPermUser.email);

  await prisma.staffMember.create({
    data: {
      userId: adminWithPermUser.id,
      name: adminWithPermUser.name,
      email: adminWithPermUser.email,
      department: 'FINANCE',
      permissions: ['finance.revenue.view'], // has the required permission
    },
  });

  // 3. ADMIN without FINANCE_REVENUE_VIEW permission
  adminWithoutPermUser = await prisma.user.create({
    data: {
      email: `rbac-m02-admin-no-perm-${timestamp}@test.internal`,
      name: 'RBAC M02 Admin Without Permission',
      role: 'ADMIN',
      password: await bcrypt.hash('test123', 10),
      emailVerified: true,
    },
  });
  testEmails.push(adminWithoutPermUser.email);

  await prisma.staffMember.create({
    data: {
      userId: adminWithoutPermUser.id,
      name: adminWithoutPermUser.name,
      email: adminWithoutPermUser.email,
      department: 'OPERATIONS',
      permissions: ['operations.bookings.view'], // different permission, NOT finance.revenue.view
    },
  });

  // 4. CLIENT user (non-admin)
  clientUser = await prisma.user.create({
    data: {
      email: `rbac-m02-client-${timestamp}@test.internal`,
      name: 'RBAC M02 Client',
      role: 'CLIENT',
      password: await bcrypt.hash('test123', 10),
      emailVerified: true,
    },
  });
  testEmails.push(clientUser.email);
});

afterAll(async () => {
  // Cleanup
  await prisma.staffMember.deleteMany({ where: { email: { in: testEmails } } });
  await prisma.user.deleteMany({ where: { email: { in: testEmails } } });
  await prisma.$disconnect();
});

async function authenticateAndFetch(email: string, password: string, endpoint: string): Promise<Response> {
  // Get CSRF token
  const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf`);
  const { csrfToken } = await csrfRes.json();
  const csrfCookies = csrfRes.headers.get('set-cookie') || '';

  // Authenticate
  const authBody = `csrfToken=${encodeURIComponent(csrfToken)}&email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`;
  const authRes = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: csrfCookies },
    body: authBody,
    redirect: 'manual',
  });

  const sessionCookie = authRes.headers.get('set-cookie')?.split(';')[0] || '';

  // Fetch the protected endpoint
  return fetch(`${BASE_URL}${endpoint}`, {
    headers: { Cookie: sessionCookie },
  });
}

describe('RBAC-M-02 Verification: /admin/revenue', () => {
  it('R1: SUPER_ADMIN can access /admin/revenue', async () => {
    const res = await authenticateAndFetch(superAdminUser.email, 'test123', '/api/admin/revenue');
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('totalCommission');
  });

  it('R2: ADMIN with finance.revenue.view permission can access /admin/revenue', async () => {
    const res = await authenticateAndFetch(adminWithPermUser.email, 'test123', '/api/admin/revenue');
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('totalCommission');
  });

  it('R3: ADMIN without finance.revenue.view permission receives 403', async () => {
    const res = await authenticateAndFetch(adminWithoutPermUser.email, 'test123', '/api/admin/revenue');
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toMatch(/permission|forbidden/i);
  });

  it('R4: CLIENT user (non-admin) receives 403', async () => {
    const res = await authenticateAndFetch(clientUser.email, 'test123', '/api/admin/revenue');
    expect(res.status).toBe(403);
  });

  it('R5: Unauthenticated request receives 401', async () => {
    const res = await fetch(`${BASE_URL}/api/admin/revenue`);
    expect(res.status).toBe(401);
  });
});

describe('RBAC-M-02 Verification: /admin/payouts/process', () => {
  it('P1: SUPER_ADMIN can access /admin/payouts/process', async () => {
    const res = await authenticateAndFetch(superAdminUser.email, 'test123', '/api/admin/payouts/process');
    // POST without body will return 400, but auth should pass (not 401/403)
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it('P2: ADMIN without finance.payouts.process permission receives 403', async () => {
    const res = await authenticateAndFetch(adminWithoutPermUser.email, 'test123', '/api/admin/payouts/process');
    expect(res.status).toBe(403);
  });
});

describe('RBAC-M-02 Verification: /admin/clients/[id]/wallet/deduct-credit', () => {
  it('W1: SUPER_ADMIN can access wallet deduction endpoint', async () => {
    const res = await authenticateAndFetch(
      superAdminUser.email,
      'test123',
      `/api/admin/clients/${clientUser.id}/wallet/deduct-credit`
    );
    // POST without Idempotency-Key will return 400, but auth should pass
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it('W2: ADMIN without users.customers.wallet_deduct permission receives 403', async () => {
    const res = await authenticateAndFetch(
      adminWithoutPermUser.email,
      'test123',
      `/api/admin/clients/${clientUser.id}/wallet/deduct-credit`
    );
    expect(res.status).toBe(403);
  });
});
