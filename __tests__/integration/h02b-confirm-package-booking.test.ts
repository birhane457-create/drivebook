/**
 * H-02b: confirm-package-booking — Validation, Ownership and Concurrency
 *
 * PURPOSE
 * Verify the five fixes applied to app/api/client/confirm-package-booking/route.ts:
 *   1. Negative hoursToDeduct is rejected before the transaction (financial safety)
 *   2. Zero hoursToDeduct is rejected (no-op debit would silently pass)
 *   3. Non-finite hoursToDeduct (NaN, Infinity) is rejected
 *   4. Cross-student ownership mismatch is rejected with 403
 *   5. Concurrent double-confirmation of the same package is serialised correctly
 *
 * WHAT IS NOT TESTED HERE
 *   - H-02: child booking price / wallet debit amount — unchanged, separate finding
 *   - Refund formula — separate finding, not touched by this change
 *
 * ROUTES UNDER TEST
 *   POST /api/client/confirm-package-booking
 *     → app/api/client/confirm-package-booking/route.ts
 *
 * EXECUTION
 *   DATABASE_URL=postgresql://postgres:testpass@localhost:5433/drivebook_test \
 *     npx vitest run __tests__/integration/h02b-confirm-package-booking.test.ts
 *
 * TEST DATABASE
 *   postgresql://postgres:testpass@localhost:5433/drivebook_test
 */

import {
  describe, it, expect, beforeAll, afterAll, beforeEach, vi,
} from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { POST } from '@/app/api/client/confirm-package-booking/route';
import { getWalletBalance } from '@/lib/services/wallet-helpers';

// ── Auth mock ────────────────────────────────────────────────────────────────
// The route calls getServerSession from 'next-auth' (not 'next-auth/next').
vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

vi.mock('next/headers', () => ({
  headers: vi.fn(() => new Map()),
  cookies: vi.fn(() => ({ get: vi.fn(), set: vi.fn() })),
}));

import { getServerSession } from 'next-auth';

// ── Helpers ───────────────────────────────────────────────────────────────────

const TEST_PREFIX = `h02b_${Date.now()}`;
const FUTURE = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours from now
const FUTURE_END = new Date(FUTURE.getTime() + 60 * 60 * 1000); // + 1 hour

function makeRequest(body: Record<string, unknown>): NextRequest {
  return {
    json: async () => body,
    headers: new Headers(),
    method: 'POST',
    url: 'http://localhost:3000/api/client/confirm-package-booking',
  } as any;
}

async function callRoute(
  body: Record<string, unknown>,
  asEmail: string
): Promise<{ status: number; body: any }> {
  (getServerSession as any).mockResolvedValue({ user: { email: asEmail } });
  const res = await POST(makeRequest(body));
  const json = await res.json();
  return { status: res.status, body: json };
}

// ── Fixture factories ─────────────────────────────────────────────────────────

/** Creates a user + provider + customer + wallet, returns their ids */
async function createStudent(tag: string) {
  const user = await prisma.user.create({
    data: {
      email: `${TEST_PREFIX}_${tag}@test.invalid`,
      password: 'hashed',
      role: 'CLIENT',
    },
  });
  const customer = await prisma.customer.create({
    data: {
      userId: user.id,
      name: `Student ${tag}`,
      email: user.email,
      phone: '0400000001',
    },
  });
  const wallet = await prisma.clientWallet.create({
    data: { userId: user.id },
  });
  return { user, customer, wallet };
}

/** Creates an APPROVED instructor provider */
async function createInstructor(tag: string) {
  const iUser = await prisma.user.create({
    data: {
      email: `${TEST_PREFIX}_instr_${tag}@test.invalid`,
      password: 'hashed',
      role: 'INSTRUCTOR',
    },
  });
  const provider = await (prisma.provider.create as any)({
    data: {
      userId: iUser.id,
      name: `Instructor ${tag}`,
      phone: '0400000002',
      hourlyRate: 60,
      approvalStatus: 'APPROVED',
      subscriptionStatus: 'ACTIVE',
      subscriptionTier: 'BASIC',
      isActive: true,
    },
  });
  return { iUser, provider };
}

/**
 * Creates a paid package booking (parent) + a pending child booking.
 * Adds wallet credit equal to packageTotalPaid.
 */
async function createPackageFixture(
  student: Awaited<ReturnType<typeof createStudent>>,
  instructor: Awaited<ReturnType<typeof createInstructor>>,
  packageHours = 10,
  hourlyRate = 60
) {
  const packageTotalPaid = packageHours * hourlyRate;
  const tag = `${TEST_PREFIX}_${Math.random().toString(36).slice(2, 8)}`;

  // Parent package booking (already paid)
  const packageBooking = await (prisma.booking.create as any)({
    data: {
      providerId: instructor.provider.id,
      customerId: student.customer.id,
      customerName: student.customer.name,
      status: 'CONFIRMED',
      isPackageBooking: true,
      packageHours,
      packageHoursUsed: 0,
      packageHoursRemaining: packageHours,
      packageTotalPaid,
      packageStatus: 'active',
      lockedHourlyRate: hourlyRate,
      price: packageTotalPaid,
      isPaid: true,
      paidAt: new Date(),
    },
  });

  // Credit the wallet with the package total
  await prisma.walletTransaction.create({
    data: {
      walletId: student.wallet.id,
      type: 'CREDIT',
      amount: packageTotalPaid,
      status: 'CONFIRMED',
      description: `Package purchase ${tag}`,
    },
  });
  // Sync balance cache
  await prisma.clientWallet.update({
    where: { id: student.wallet.id },
    data: { balance: { increment: packageTotalPaid } },
  });

  // Child booking to be confirmed
  const childBooking = await (prisma.booking.create as any)({
    data: {
      providerId: instructor.provider.id,
      customerId: student.customer.id,
      customerName: student.customer.name,
      status: 'PENDING',
      startTime: FUTURE,
      endTime: FUTURE_END,
      duration: 60,
      price: 0,
      isPackageBooking: false,
      parentBookingId: null,
    },
  });

  return { packageBooking, childBooking, packageTotalPaid };
}

// ── Test state ─────────────────────────────────────────────────────────────────

let studentA: Awaited<ReturnType<typeof createStudent>>;
let studentB: Awaited<ReturnType<typeof createStudent>>;
let instructor: Awaited<ReturnType<typeof createInstructor>>;

beforeAll(async () => {
  studentA = await createStudent('A');
  studentB = await createStudent('B');
  instructor = await createInstructor('X');
});

afterAll(async () => {
  // Clean up by email prefix — safe because TEST_PREFIX is unique per run
  const users = await prisma.user.findMany({
    where: { email: { contains: TEST_PREFIX } },
    select: { id: true },
  });
  const userIds = users.map(u => u.id);
  if (userIds.length > 0) {
    await prisma.walletTransaction.deleteMany({
      where: { wallet: { userId: { in: userIds } } },
    });
    await prisma.clientWallet.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.customer.deleteMany({ where: { userId: { in: userIds } } });
    await (prisma.provider.deleteMany as any)({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
  await prisma.$disconnect();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('H-02b: confirm-package-booking input validation', () => {
  it('V-01: negative hoursToDeduct → 400, no wallet debit, no booking change', async () => {
    const { packageBooking, childBooking } = await createPackageFixture(studentA, instructor);
    const balanceBefore = (await getWalletBalance(studentA.user.id)).balance;

    const { status, body } = await callRoute(
      { bookingId: childBooking.id, packageBookingId: packageBooking.id, hoursToDeduct: -1 },
      studentA.user.email
    );

    expect(status).toBe(400);
    expect(body.error).toMatch(/finite positive/i);

    // Wallet untouched
    const balanceAfter = (await getWalletBalance(studentA.user.id)).balance;
    expect(balanceAfter).toBe(balanceBefore);

    // Booking still PENDING
    const booking = await prisma.booking.findUnique({ where: { id: childBooking.id } });
    expect(booking?.status).toBe('PENDING');

    // packageHoursUsed unchanged
    const pkg = await prisma.booking.findUnique({ where: { id: packageBooking.id } });
    expect(Number(pkg?.packageHoursUsed)).toBe(0);
  });

  it('V-02: zero hoursToDeduct → 400, no wallet debit', async () => {
    const { packageBooking, childBooking } = await createPackageFixture(studentA, instructor);

    const { status, body } = await callRoute(
      { bookingId: childBooking.id, packageBookingId: packageBooking.id, hoursToDeduct: 0 },
      studentA.user.email
    );

    expect(status).toBe(400);
    expect(body.error).toMatch(/finite positive/i);
  });

  it('V-03: NaN hoursToDeduct → 400', async () => {
    const { packageBooking, childBooking } = await createPackageFixture(studentA, instructor);

    const { status, body } = await callRoute(
      { bookingId: childBooking.id, packageBookingId: packageBooking.id, hoursToDeduct: NaN },
      studentA.user.email
    );

    expect(status).toBe(400);
    expect(body.error).toMatch(/finite positive/i);
  });

  it('V-04: Infinity hoursToDeduct → 400', async () => {
    const { packageBooking, childBooking } = await createPackageFixture(studentA, instructor);

    const { status, body } = await callRoute(
      { bookingId: childBooking.id, packageBookingId: packageBooking.id, hoursToDeduct: Infinity },
      studentA.user.email
    );

    expect(status).toBe(400);
    expect(body.error).toMatch(/finite positive/i);
  });

  it('V-05: string hoursToDeduct → 400', async () => {
    const { packageBooking, childBooking } = await createPackageFixture(studentA, instructor);

    const { status, body } = await callRoute(
      { bookingId: childBooking.id, packageBookingId: packageBooking.id, hoursToDeduct: '1' as any },
      studentA.user.email
    );

    // String '1' is typeof 'string', not 'number' → rejected
    expect(status).toBe(400);
    expect(body.error).toMatch(/finite positive/i);
  });
});

describe('H-02b: ownership check', () => {
  it('O-01: student B cannot confirm student A\'s child booking → 403', async () => {
    // Package belongs to studentA; studentB authenticates
    const { packageBooking, childBooking } = await createPackageFixture(studentA, instructor);

    const { status, body } = await callRoute(
      { bookingId: childBooking.id, packageBookingId: packageBooking.id, hoursToDeduct: 1 },
      studentB.user.email   // authenticated as B, but booking belongs to A
    );

    expect(status).toBe(403);
    // Booking still PENDING
    const booking = await prisma.booking.findUnique({ where: { id: childBooking.id } });
    expect(booking?.status).toBe('PENDING');
  });

  it('O-02: student A can confirm their own booking → 200', async () => {
    const { packageBooking, childBooking } = await createPackageFixture(studentA, instructor);
    const balanceBefore = (await getWalletBalance(studentA.user.id)).balance;

    const { status, body } = await callRoute(
      { bookingId: childBooking.id, packageBookingId: packageBooking.id, hoursToDeduct: 1 },
      studentA.user.email
    );

    expect(status).toBe(200);
    expect(body.success).toBe(true);

    // Wallet debited by lockedHourlyRate × hoursToDeduct = 60 × 1 = $60
    const balanceAfter = (await getWalletBalance(studentA.user.id)).balance;
    expect(balanceBefore - balanceAfter).toBeCloseTo(60, 2);

    // Booking confirmed
    const booking = await prisma.booking.findUnique({ where: { id: childBooking.id } });
    expect(booking?.status).toBe('CONFIRMED');
  });
});

describe('H-02b: concurrent double-confirmation (serialization)', () => {
  it('C-01: two concurrent confirm requests for the same child booking — only one succeeds', async () => {
    /**
     * This test fires two simultaneous POST requests for the same bookingId.
     * Under the old Read Committed transaction both could have confirmed,
     * double-debiting the wallet and double-decrementing packageHoursUsed.
     * Under Serializable one serializes after the other; the second sees the
     * booking already CONFIRMED (or catches a serialization failure and retries
     * to find the booking already done) and returns an appropriate response.
     *
     * Expected outcome:
     *   - Exactly one 200 response
     *   - booking.status = 'CONFIRMED' (not double-written)
     *   - wallet debited exactly once ($60)
     *   - packageHoursUsed = 1 (not 2)
     */
    const { packageBooking, childBooking } = await createPackageFixture(studentA, instructor);
    const balanceBefore = (await getWalletBalance(studentA.user.id)).balance;

    // Fire both requests simultaneously (no await between them)
    const [r1, r2] = await Promise.all([
      callRoute(
        { bookingId: childBooking.id, packageBookingId: packageBooking.id, hoursToDeduct: 1 },
        studentA.user.email
      ),
      callRoute(
        { bookingId: childBooking.id, packageBookingId: packageBooking.id, hoursToDeduct: 1 },
        studentA.user.email
      ),
    ]);

    const statuses = [r1.status, r2.status].sort();

    // Exactly one success
    const successes = [r1, r2].filter(r => r.status === 200);
    expect(successes).toHaveLength(1);

    // The other must be a non-200 (409 ALREADY_CONFIRMED after the status guard,
    // or 400 INSUFFICIENT_HOURS if the retry recalculates available hours as 0)
    const failures = [r1, r2].filter(r => r.status !== 200);
    expect(failures).toHaveLength(1);
    expect([400, 409]).toContain(failures[0].status);

    // Database: wallet debited exactly once
    const balanceAfter = (await getWalletBalance(studentA.user.id)).balance;
    expect(balanceBefore - balanceAfter).toBeCloseTo(60, 2); // one deduction, not two

    // Database: packageHoursUsed = 1, not 2
    const pkg = await prisma.booking.findUnique({ where: { id: packageBooking.id } });
    expect(Number(pkg?.packageHoursUsed)).toBeCloseTo(1, 4);

    // Database: booking confirmed exactly once
    const booking = await prisma.booking.findUnique({ where: { id: childBooking.id } });
    expect(booking?.status).toBe('CONFIRMED');
  });

  it('C-02: two concurrent confirms each for their own child booking — both succeed independently', async () => {
    /**
     * Verify that Serializable isolation does not over-serialize independent
     * transactions. Two students each confirming different child bookings from
     * the same package should both succeed — as long as hours are available.
     * (The package has 10 hours; each request uses 1 hour.)
     */
    // Use a package with 10 hours so both can succeed
    const { packageBooking: pkg, childBooking: child1 } = await createPackageFixture(
      studentA, instructor, 10
    );
    // Create a second child booking on the SAME package (same package, different child)
    const child2 = await (prisma.booking.create as any)({
      data: {
        providerId: instructor.provider.id,
        customerId: studentA.customer.id,
        customerName: studentA.customer.name,
        status: 'PENDING',
        startTime: new Date(FUTURE.getTime() + 2 * 60 * 60 * 1000),
        endTime: new Date(FUTURE.getTime() + 3 * 60 * 60 * 1000),
        duration: 60,
        price: 0,
        isPackageBooking: false,
        parentBookingId: null,
      },
    });

    const [r1, r2] = await Promise.all([
      callRoute(
        { bookingId: child1.id, packageBookingId: pkg.id, hoursToDeduct: 1 },
        studentA.user.email
      ),
      callRoute(
        { bookingId: child2.id, packageBookingId: pkg.id, hoursToDeduct: 1 },
        studentA.user.email
      ),
    ]);

    // Both should succeed (10 hours available, each takes 1)
    // Under Serializable one retries if it hits P2034, but both ultimately commit
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);

    // Wallet debited twice ($60 each = $120 total)
    const balance = (await getWalletBalance(studentA.user.id)).balance;
    // Both child bookings had wallets credited $600 (10hr × $60 each fixture)
    // Then debited $60 each = $120. Net balance relative to start depends on
    // how many fixtures we created; check packageHoursUsed is the safest assertion.
    const updatedPkg = await prisma.booking.findUnique({ where: { id: pkg.id } });
    expect(Number(updatedPkg?.packageHoursUsed)).toBeCloseTo(2, 4);
  });
});

describe('H-02b: insufficient hours after previous confirmed bookings', () => {
  it('I-01: confirming more hours than available → 400, wallet untouched', async () => {
    // Package has 1 hour; request 2 hours
    const { packageBooking, childBooking } = await createPackageFixture(
      studentA, instructor, 1, 60  // 1-hour package
    );
    const balanceBefore = (await getWalletBalance(studentA.user.id)).balance;

    const { status, body } = await callRoute(
      { bookingId: childBooking.id, packageBookingId: packageBooking.id, hoursToDeduct: 2 },
      studentA.user.email
    );

    expect(status).toBe(400);
    expect(body.error).toMatch(/insufficient hours/i);

    const balanceAfter = (await getWalletBalance(studentA.user.id)).balance;
    expect(balanceAfter).toBe(balanceBefore);

    const booking = await prisma.booking.findUnique({ where: { id: childBooking.id } });
    expect(booking?.status).toBe('PENDING');
  });
});

describe('H-02b-F1: missing wallet fails closed', () => {
  it('F1-01: no wallet — booking stays PENDING, hour counters unchanged, no debit', async () => {
    /**
     * Reproduces H-02b-F1: previously if userWallet was null the route confirmed
     * the booking and decremented packageHoursUsed with no wallet debit.
     *
     * Fix: wallet absence throws WALLET_NOT_FOUND inside the transaction,
     * rolling back ALL changes: booking stays PENDING, hour counters unchanged.
     */
    const { packageBooking, childBooking } = await createPackageFixture(studentA, instructor);

    // Delete the wallet so it is absent during confirmation
    await prisma.clientWallet.delete({ where: { id: studentA.wallet.id } });

    const { status, body } = await callRoute(
      { bookingId: childBooking.id, packageBookingId: packageBooking.id, hoursToDeduct: 1 },
      studentA.user.email
    );

    expect(status).toBe(422);
    expect(body.error).toMatch(/wallet not found/i);

    // Booking must still be PENDING — not confirmed
    const bookingAfter = await prisma.booking.findUnique({ where: { id: childBooking.id } });
    expect(bookingAfter?.status).toBe('PENDING');

    // Hour counters must be unchanged
    const pkgAfter = await prisma.booking.findUnique({ where: { id: packageBooking.id } });
    expect(Number(pkgAfter?.packageHoursUsed)).toBe(0);
    expect(Number(pkgAfter?.packageHoursRemaining)).toBe(10);

    // Recreate wallet so afterAll cleanup works
    studentA.wallet = await prisma.clientWallet.create({ data: { userId: studentA.user.id } });
  });
});

describe('H-02b-F2: insufficient wallet balance fails closed', () => {
  it('F2-01: package hours available but wallet empty — all state unchanged, no debit', async () => {
    /**
     * Reproduces H-02b-F2: previously the route checked package hours but not
     * the authoritative ledger balance. A student with hours remaining but a
     * depleted wallet (e.g. admin-deducted, refunded externally) could confirm
     * a lesson for free.
     *
     * Fix: authoritative ledger balance is aggregated inside the transaction.
     * If balance < transactionAmount the transaction throws INSUFFICIENT_WALLET_BALANCE
     * and rolls back — booking PENDING, hour counters unchanged, no debit created.
     */
    // Create package fixture — this adds wallet credit of packageTotalPaid ($600)
    const { packageBooking, childBooking, packageTotalPaid } =
      await createPackageFixture(studentA, instructor, 10, 60);

    // Drain the wallet: add a debit for the full balance so nothing remains
    await prisma.walletTransaction.create({
      data: {
        walletId: studentA.wallet.id,
        type: 'DEBIT',
        amount: packageTotalPaid, // drains the $600 credit added by createPackageFixture
        status: 'CONFIRMED',
        description: 'Test drain — simulate empty wallet',
      },
    });
    await prisma.clientWallet.update({
      where: { id: studentA.wallet.id },
      data: { balance: { decrement: packageTotalPaid } },
    });

    // Confirm the balance is now $0
    const walletBefore = await prisma.clientWallet.findUnique({
      where: { id: studentA.wallet.id },
      include: { transactions: { where: { status: 'CONFIRMED' } } },
    });
    const credits = walletBefore!.transactions.filter(t => t.type === 'CREDIT');
    const debits  = walletBefore!.transactions.filter(t => t.type === 'DEBIT');
    const balance = credits.reduce((s, t) => s + Number(t.amount), 0)
                  - debits.reduce((s, t) => s + Number(t.amount), 0);
    expect(balance).toBeCloseTo(0, 2);

    // Package hours are still available (10h, none used)
    const pkgBefore = await prisma.booking.findUnique({ where: { id: packageBooking.id } });
    expect(Number(pkgBefore?.packageHoursUsed)).toBe(0);

    // Attempt confirmation — should fail with 402 (payment required)
    const { status, body } = await callRoute(
      { bookingId: childBooking.id, packageBookingId: packageBooking.id, hoursToDeduct: 1 },
      studentA.user.email
    );

    expect(status).toBe(402);
    expect(body.error).toMatch(/insufficient wallet balance/i);
    expect(body.available).toBeCloseTo(0, 2);
    expect(body.required).toBeCloseTo(60, 2); // 1h × $60

    // Booking must still be PENDING
    const bookingAfter = await prisma.booking.findUnique({ where: { id: childBooking.id } });
    expect(bookingAfter?.status).toBe('PENDING');

    // Hour counters must be unchanged
    const pkgAfter = await prisma.booking.findUnique({ where: { id: packageBooking.id } });
    expect(Number(pkgAfter?.packageHoursUsed)).toBe(0);
    expect(Number(pkgAfter?.packageHoursRemaining)).toBe(10);

    // No new debit created (only the drain debit we added above)
    const debitsAfter = await prisma.walletTransaction.findMany({
      where: { walletId: studentA.wallet.id, type: 'DEBIT', status: 'CONFIRMED' },
    });
    // Only the drain debit exists — no confirmation debit
    expect(debitsAfter).toHaveLength(1);
    expect(debitsAfter[0].description).toMatch(/drain/i);
  });

  it('F2-02: partial balance — enough for some lessons but not this one — fails closed', async () => {
    /**
     * Student wallet has $40 remaining; lesson costs $60 (1h × $60/hr).
     * The route must reject with 402 and leave all state unchanged.
     */
    const { packageBooking, childBooking, packageTotalPaid } =
      await createPackageFixture(studentA, instructor, 10, 60);

    // Leave only $40: drain $560 of the $600 credit
    const drainAmount = packageTotalPaid - 40;
    await prisma.walletTransaction.create({
      data: {
        walletId: studentA.wallet.id,
        type: 'DEBIT',
        amount: drainAmount,
        status: 'CONFIRMED',
        description: 'Test partial drain',
      },
    });
    await prisma.clientWallet.update({
      where: { id: studentA.wallet.id },
      data: { balance: { decrement: drainAmount } },
    });

    const { status, body } = await callRoute(
      { bookingId: childBooking.id, packageBookingId: packageBooking.id, hoursToDeduct: 1 },
      studentA.user.email
    );

    expect(status).toBe(402);
    expect(body.available).toBeCloseTo(40, 2);
    expect(body.required).toBeCloseTo(60, 2);

    const bookingAfter = await prisma.booking.findUnique({ where: { id: childBooking.id } });
    expect(bookingAfter?.status).toBe('PENDING');

    const pkgAfter = await prisma.booking.findUnique({ where: { id: packageBooking.id } });
    expect(Number(pkgAfter?.packageHoursUsed)).toBe(0);
  });
});
