/**
 * PB-UI-03 INTEGRATION TESTS — Package balance display: dollar balance as primary metric
 *
 * Finding: student dashboard displays "Hours Remaining" as the primary entitlement metric,
 * contradicting the approved dollar-wallet policy (PACKAGE-ACCOUNTING-POLICY.md §5).
 *
 * Fix: /api/client/packages now returns wallet.balance (authoritative dollar amount from
 * getWalletBalance()) alongside the hours summary. The dashboard presents dollar credit
 * as the primary card; estimated hours are secondary and qualified by the applicable rate.
 *
 * WHAT IS TESTED
 *   P01  API returns wallet.balance as a top-level field derived from wallet transactions
 *   P02  wallet.balance = total CREDIT − total DEBIT (exact from WalletTransaction rows)
 *   P03  wallet.balance changes after a lesson deduction
 *   P04  wallet.balance is 0 for a user with no wallet transactions
 *   P05  API returns lockedHourlyRate on each package (for estimated-hours calculation)
 *   P06  hoursUsed is derived from child booking durations, not stale packageHoursUsed counter
 *   P07  Summary still includes hours fields (backward compat; secondary info)
 *   P08  Zero balance returns correctly (empty wallet, not null)
 *
 * DATABASE
 *   postgresql://postgres:testpass@localhost:5433/drivebook_test
 *
 * EXECUTION
 *   DATABASE_URL=postgresql://postgres:testpass@localhost:5433/drivebook_test \
 *   DIRECT_URL=postgresql://postgres:testpass@localhost:5433/drivebook_test \
 *     npx vitest run __tests__/integration/pb-ui-03-packages-balance-display.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

// ── Auth mock ──────────────────────────────────────────────────────────────────
vi.mock('next-auth/next', () => ({
  getServerSession: vi.fn(),
}));

vi.mock('next/headers', () => ({
  headers: vi.fn(() => new Map()),
  cookies: vi.fn(() => ({ get: vi.fn(), set: vi.fn() })),
}));

import { GET } from '@/app/api/client/packages/route';
import { getServerSession } from 'next-auth/next';

// ── Test data ─────────────────────────────────────────────────────────────────
const HOURLY_RATE = 70;
const PACKAGE_HOURS = 10;
const PACKAGE_TOTAL_PAID = 652.68; // discountedBase + platformFee

let providerId: string;
let customerId: string;
let userEmail: string;
let userId: string;
let walletId: string;
let packageBookingId: string;

function makeRequest(): NextRequest {
  return {
    json: async () => ({}),
    headers: new Headers(),
    method: 'GET',
    url: 'http://localhost/api/client/packages',
    nextUrl: new URL('http://localhost/api/client/packages'),
  } as unknown as NextRequest;
}

// ── Setup / teardown ──────────────────────────────────────────────────────────
beforeAll(async () => {
  // Provider
  const pu = await prisma.user.create({
    data: { email: `pb03-prov-${Date.now()}@test.com`, role: 'PROVIDER' },
  });
  const p = await (prisma.provider as any).create({
    data: {
      userId: pu.id, name: 'PB03 Provider', phone: '0411000007',
      hourlyRate: HOURLY_RATE, approvalStatus: 'APPROVED', isActive: true,
    },
  });
  providerId = p.id;

  // Customer + user + wallet
  userEmail = `pb03-user-${Date.now()}@test.com`;
  const u = await prisma.user.create({ data: { email: userEmail, role: 'CLIENT' } });
  userId = u.id;
  const c = await prisma.customer.create({
    data: { name: 'PB03 Customer', email: userEmail, phone: '0422000007', userId },
  });
  customerId = c.id;
  const w = await prisma.clientWallet.create({ data: { userId, balance: 0 } });
  walletId = w.id;

  // Fund wallet: credit PACKAGE_TOTAL_PAID
  await prisma.walletTransaction.create({
    data: {
      walletId, type: 'CREDIT', amount: PACKAGE_TOTAL_PAID,
      status: 'CONFIRMED', description: 'Package purchase',
    },
  });

  // Parent package booking
  const startTime = new Date(Date.now() + 48 * 3600000);
  const pb = await (prisma.booking as any).create({
    data: {
      providerId, customerId, status: 'CONFIRMED', isPaid: true,
      startTime, endTime: new Date(startTime.getTime() + 3600000),
      duration: 60, price: HOURLY_RATE,
      isPackageBooking: true, packageHours: PACKAGE_HOURS,
      packageHoursUsed: 0,          // stale counter — deliberately NOT updated
      packageHoursRemaining: PACKAGE_HOURS, // stale counter
      packageTotalPaid: PACKAGE_TOTAL_PAID,
      lockedHourlyRate: HOURLY_RATE,
      lockedDiscountPct: 10,
      source: 'platform',
    },
  });
  packageBookingId = pb.id;

  // Mock session
  vi.mocked(getServerSession).mockResolvedValue({
    user: { id: userId, email: userEmail, role: 'CLIENT' },
    expires: '2099-12-31',
  } as any);
});

afterAll(async () => {
  await (prisma.booking as any).deleteMany({ where: { providerId } });
  await (prisma.walletTransaction as any).deleteMany({ where: { walletId } });
  await prisma.clientWallet.deleteMany({ where: { userId } });
  await prisma.customer.deleteMany({ where: { id: customerId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  const pRow = await (prisma.provider as any).findUnique({ where: { id: providerId }, select: { userId: true } });
  await (prisma.provider as any).delete({ where: { id: providerId } });
  if (pRow?.userId) await prisma.user.deleteMany({ where: { id: pRow.userId } });
  await prisma.$disconnect();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PB-UI-03 — /api/client/packages wallet dollar balance', () => {

  it('P01 | API response includes wallet.balance as top-level field', async () => {
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveProperty('wallet');
    expect(body.wallet).toHaveProperty('balance');
    expect(typeof body.wallet.balance).toBe('number');
  });

  it('P02 | wallet.balance = CREDIT total − DEBIT total (exact from WalletTransaction rows)', async () => {
    const res = await GET(makeRequest());
    const body = await res.json();

    // Only one CREDIT of PACKAGE_TOTAL_PAID, no DEBITs yet
    expect(body.wallet.balance).toBeCloseTo(PACKAGE_TOTAL_PAID, 2);
    expect(body.wallet.totalPaid).toBeCloseTo(PACKAGE_TOTAL_PAID, 2);
    expect(body.wallet.totalSpent).toBeCloseTo(0, 2);
  });

  it('P03 | wallet.balance decreases after a lesson deduction', async () => {
    const lessonPrice = HOURLY_RATE; // $70

    // Debit wallet for one lesson
    await prisma.walletTransaction.create({
      data: {
        walletId, type: 'DEBIT', amount: lessonPrice,
        status: 'CONFIRMED', description: 'Lesson deduction',
      },
    });

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.wallet.balance).toBeCloseTo(PACKAGE_TOTAL_PAID - lessonPrice, 2);
    expect(body.wallet.totalSpent).toBeCloseTo(lessonPrice, 2);

    // Clean up for other tests
    await prisma.walletTransaction.deleteMany({
      where: { walletId, type: 'DEBIT', description: 'Lesson deduction' },
    });
  });

  it('P04 | wallet.balance is 0 for a new user with no transactions', async () => {
    // Create a separate user+wallet with no transactions
    const u2 = await prisma.user.create({
      data: { email: `pb03-empty-${Date.now()}@test.com`, role: 'CLIENT' },
    });
    await prisma.clientWallet.create({ data: { userId: u2.id, balance: 0 } });
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: { id: u2.id, email: u2.email, role: 'CLIENT' },
      expires: '2099-12-31',
    } as any);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.wallet.balance).toBe(0);
    expect(body.packages).toHaveLength(0);

    // Clean up
    await prisma.clientWallet.deleteMany({ where: { userId: u2.id } });
    await prisma.user.deleteMany({ where: { id: u2.id } });
  });

  it('P05 | each package includes lockedHourlyRate for estimated-hours calculation', async () => {
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.packages.length).toBeGreaterThan(0);
    const pkg = body.packages[0];
    expect(pkg).toHaveProperty('lockedHourlyRate');
    expect(pkg.lockedHourlyRate).toBe(HOURLY_RATE);
  });

  it('P06 | hoursUsed is from child booking durations, not stale packageHoursUsed counter', async () => {
    // Add a child booking (1hr, CONFIRMED) — packageHoursUsed is still 0 (stale)
    const startTime = new Date(Date.now() - 2 * 3600000);
    await (prisma.booking as any).create({
      data: {
        providerId, customerId, status: 'CONFIRMED',
        parentBookingId: packageBookingId,
        startTime, endTime: new Date(startTime.getTime() + 3600000),
        duration: 60, price: HOURLY_RATE,
        isPackageBooking: false, source: 'platform',
        platformFee: 0, providerPayout: HOURLY_RATE,
      },
    });

    const res = await GET(makeRequest());
    const body = await res.json();
    const pkg = body.packages.find((p: any) => p.id === packageBookingId);

    // hoursUsed should be 1h (from child booking duration), not 0 (from stale counter)
    expect(pkg.hoursUsed).toBeCloseTo(1, 1);

    // Clean up
    await (prisma.booking as any).deleteMany({ where: { parentBookingId: packageBookingId } });
  });

  it('P07 | summary still includes hours fields (secondary info, backward compat)', async () => {
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body).toHaveProperty('summary');
    expect(body.summary).toHaveProperty('total');
    expect(body.summary).toHaveProperty('used');
    expect(body.summary).toHaveProperty('remaining');
    expect(body.summary).toHaveProperty('activeCount');
    expect(body.summary).toHaveProperty('expiring_soon');
  });

  it('P08 | zero balance returns correctly (not null)', async () => {
    // Drain wallet via a large DEBIT
    await prisma.walletTransaction.create({
      data: {
        walletId, type: 'DEBIT', amount: PACKAGE_TOTAL_PAID,
        status: 'CONFIRMED', description: 'Full drain for test',
      },
    });

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.wallet.balance).toBe(0);
    expect(body.wallet.balance).not.toBeNull();
    expect(typeof body.wallet.balance).toBe('number');

    // Clean up
    await prisma.walletTransaction.deleteMany({
      where: { walletId, type: 'DEBIT', description: 'Full drain for test' },
    });
  });

});
