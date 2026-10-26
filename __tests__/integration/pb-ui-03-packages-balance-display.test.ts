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
// PB-UI-03: import the shared utility so P10b tests the ACTUAL implementation
import { estimateHours, estimateHoursValue } from '@/lib/utils/estimate-hours';

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

  it('P09 | canScheduleMore is true even when estimated hours reach zero (balance gates booking, not hours)', async () => {
    // PB-UI-03 reviewer finding 3: hours-remaining must NOT gate scheduling.
    // The API should set canScheduleMore based on status+expiry only.
    // Simulate: package has consumed all hours (hoursUsed = hoursTotal via child bookings)
    // but wallet still has balance. canScheduleMore must still be true.
    const startTime = new Date(Date.now() - 24 * 3600000);
    // Create 10 × 1hr CONFIRMED child bookings = full package consumed
    for (let i = 0; i < 10; i++) {
      await (prisma.booking as any).create({
        data: {
          providerId, customerId, status: 'CONFIRMED',
          parentBookingId: packageBookingId,
          startTime: new Date(startTime.getTime() - i * 3600000),
          endTime: new Date(startTime.getTime() - (i - 1) * 3600000),
          duration: 60, price: HOURLY_RATE,
          isPackageBooking: false, source: 'platform',
          platformFee: 0, providerPayout: HOURLY_RATE,
        },
      });
    }

    const res = await GET(makeRequest());
    const body = await res.json();

    const pkg = body.packages.find((p: any) => p.id === packageBookingId);
    expect(pkg.hoursUsed).toBeCloseTo(10, 0);  // all hours consumed
    // canScheduleMore must still be true — hours do not gate scheduling
    expect(pkg.canScheduleMore).toBe(true);

    // Clean up
    await (prisma.booking as any).deleteMany({ where: { parentBookingId: packageBookingId } });
  });

  it('P10 | currentHourlyRate reflects provider CURRENT rate, not locked purchase rate', async () => {
    // Reviewer finding 4b: P10 must use DIFFERENT values for locked vs current rate
    // to prove the implementation uses the current rate, not the historical locked rate.
    //
    // Setup:
    //   lockedHourlyRate (at purchase) = $70   ← recorded on the Booking at purchase time
    //   provider.hourlyRate (current)  = $80   ← instructor raised rate since purchase
    //
    // Key assertion: currentHourlyRate === $80 (current), not $70 (locked)

    const CURRENT_RATE = 80;    // instructor raised rate after this package was purchased
    const LOCKED_RATE  = HOURLY_RATE; // $70 — the rate locked at purchase time

    // Update the provider's current hourlyRate to $80
    await (prisma.provider as any).update({
      where: { id: providerId },
      data: { hourlyRate: CURRENT_RATE },
    });

    const res = await GET(makeRequest());
    const body = await res.json();

    const pkg = body.packages.find((p: any) => p.id === packageBookingId);

    // currentHourlyRate = provider's CURRENT rate ($80)
    expect(pkg.currentHourlyRate).toBe(CURRENT_RATE);

    // lockedHourlyRate = rate at purchase ($70) — still present for historical reference
    expect(pkg.lockedHourlyRate).toBe(LOCKED_RATE);

    // The two rates differ — proving the test actually distinguishes them
    expect(pkg.currentHourlyRate).not.toBe(pkg.lockedHourlyRate);

    // Verify the estimate formula: walletBalance / currentRate
    // wallet has PACKAGE_TOTAL_PAID ($652.68) in credit
    const currentBalance = body.wallet.balance;
    const expectedHours = currentBalance / CURRENT_RATE; // ~8.16 hrs at $80
    // The API returns the rate; the dashboard computes the label.
    // We verify the rate is correct — if currentHourlyRate=$80 is used,
    // the dashboard would show "Approx. 8.2 hrs at $80/hr" (not 9.3 hrs at $70).
    expect(pkg.currentHourlyRate).toBe(CURRENT_RATE);
    expect(expectedHours).toBeCloseTo(PACKAGE_TOTAL_PAID / CURRENT_RATE, 1);

    // Restore provider hourlyRate for other tests
    await (prisma.provider as any).update({
      where: { id: providerId },
      data: { hourlyRate: HOURLY_RATE },
    });
  });

  it('P10b | estimateHours utility: $700 at $80/hr = 8.75 hrs (not 10 hrs at locked $70 rate)', async () => {
    // Reviewer finding: P10b must call the ACTUAL estimateHours implementation,
    // not just reproduce the formula independently.
    // This test imports and calls lib/utils/estimate-hours.ts directly — the same
    // function used by the dashboard — so any change to the implementation would
    // cause this test to fail.

    const CURRENT_RATE = 80;   // instructor's current rate
    const LOCKED_RATE  = 70;   // purchase-time locked rate
    const BALANCE      = 700;  // reviewer's exact example: $700 wallet balance

    // ── Call the actual shared implementation ────────────────────────────────
    const estimateWithCurrentRate = estimateHoursValue(BALANCE, CURRENT_RATE);
    const estimateWithLockedRate  = estimateHoursValue(BALANCE, LOCKED_RATE);

    // ── Reviewer's exact example ─────────────────────────────────────────────
    // $700 / $80 = 8.75 hrs (correct — dashboard uses current rate)
    expect(estimateWithCurrentRate).toBeCloseTo(8.75, 2);

    // $700 / $70 = 10.0 hrs (wrong — would use locked rate)
    expect(estimateWithLockedRate).toBeCloseTo(10.0, 2);

    // The two estimates are different (confirming rate source matters)
    expect(estimateWithCurrentRate).not.toBeCloseTo(estimateWithLockedRate, 0);

    // Current-rate estimate is less than locked-rate estimate
    // (instructor raised rate → fewer hours for same dollar balance)
    expect(estimateWithCurrentRate).toBeLessThan(estimateWithLockedRate);

    // ── Also verify the formatted string output ───────────────────────────────
    const formattedLabel = estimateHours(BALANCE, CURRENT_RATE);
    // Exact expected output: 8.75 rounds to 8.8 at one decimal place
    expect(formattedLabel).toBe('Approx. 8.8 hrs at $80/hr');
    // Dashboard displays this label — must reference $80/hr (not $70/hr)
    expect(formattedLabel).not.toContain('$70');
  });

});
