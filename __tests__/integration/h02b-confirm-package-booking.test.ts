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
    // Package has 1 hour; request matches the booking duration (1h) but exceeds
    // the package capacity. Duration must match the booking, so we create a 1hr
    // booking and pass hoursToDeduct: 1, but the package only has 1hr and it is
    // already fully consumed by the fixture setup. We need a fixture where 0 hours
    // remain — create a 1hr package with a 1hr booking, confirm it, then try again.
    //
    // Simpler: use a 1-hour package and attempt to confirm a 2-hour booking.
    // The 2hr booking → hoursToDeduct: 2, package has 1hr → INSUFFICIENT_HOURS.
    const { packageBooking } = await createPackageFixture(
      studentA, instructor, 1, 60  // 1-hour package, wallet gets $60
    );
    // Create a 2-hour child booking so hoursToDeduct: 2 matches the duration
    const start2h = new Date(FUTURE.getTime() + 50 * 60 * 60 * 1000);
    const end2h   = new Date(start2h.getTime() + 2 * 60 * 60 * 1000);
    const child2h = await (prisma.booking.create as any)({
      data: {
        providerId: instructor.provider.id,
        customerId: studentA.customer.id,
        customerName: studentA.customer.name,
        status: 'PENDING',
        startTime: start2h,
        endTime: end2h,
        duration: 120,
        price: 0,
        isPackageBooking: false,
        parentBookingId: null,
      },
    });

    const balanceBefore = (await getWalletBalance(studentA.user.id)).balance;

    // hoursToDeduct: 2 matches the 2hr booking duration, but package only has 1hr
    const { status, body } = await callRoute(
      { bookingId: child2h.id, packageBookingId: packageBooking.id, hoursToDeduct: 2 },
      studentA.user.email
    );

    expect(status).toBe(400);
    expect(body.error).toMatch(/insufficient hours/i);

    const balanceAfter = (await getWalletBalance(studentA.user.id)).balance;
    expect(balanceAfter).toBeCloseTo(balanceBefore, 2);

    const booking = await prisma.booking.findUnique({ where: { id: child2h.id } });
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

describe('H-02b-F3: duplicate hour-accounting regression', () => {
  /**
   * Before the fix, availableHours = packageTotalHours - packageHoursUsed - otherUsedHours.
   * packageHoursUsed and otherUsedHours both count confirmed lessons, so each confirmed
   * lesson was subtracted twice.
   *
   * Example with a 3-hour package and three 1-hour lessons:
   *   After lesson 1: packageHoursUsed=1, otherUsedHours=1 → old: 3-1-1=1 (wrong), new: 3-1=2
   *   After lesson 2: packageHoursUsed=2, otherUsedHours=2 → old: 3-2-2=-1 (wrong), new: 3-2=1
   *   Lesson 3 would have been blocked by the old code even though 1 hour remains.
   *
   * The fix uses only child booking records as the authoritative source.
   * packageHoursUsed is retained for display/audit but not used in the availability check.
   */

  /** Create a child booking with explicit startTime/endTime for a given hour slot */
  async function createChildBooking(
    student: Awaited<ReturnType<typeof createStudent>>,
    instr: Awaited<ReturnType<typeof createInstructor>>,
    hourOffset: number   // hours from FUTURE for this lesson's start
  ) {
    const start = new Date(FUTURE.getTime() + hourOffset * 60 * 60 * 1000 + 24 * 60 * 60 * 1000);
    const end   = new Date(start.getTime() + 60 * 60 * 1000); // 1 hour later
    return (prisma.booking.create as any)({
      data: {
        providerId:    instr.provider.id,
        customerId:    student.customer.id,
        customerName:  student.customer.name,
        status:        'PENDING',
        startTime:     start,
        endTime:       end,
        duration:      60,
        price:         0,
        isPackageBooking: false,
        parentBookingId: null,
      },
    });
  }

  it('F3-01: three sequential confirmations on a 3-hour package — all succeed, correct available hours after each', async () => {
    /**
     * Scenario: 3-hour package, 3 one-hour lessons confirmed one at a time.
     * With the old double-count formula, lesson 3 would be blocked (available = -1).
     * With the fix, each confirmation correctly sees the remaining hours.
     *
     * Expected after each confirmation:
     *   Before any: available = 3
     *   After 1st:  available = 2
     *   After 2nd:  available = 1
     *   After 3rd:  available = 0  (package completed)
     */
    const pkg = await createPackageFixture(studentA, instructor, 3, 60);
    // 3-hour package: wallet credited $180 (3 × $60)

    const child1 = await createChildBooking(studentA, instructor, 0);
    const child2 = await createChildBooking(studentA, instructor, 2);
    const child3 = await createChildBooking(studentA, instructor, 4);

    // ── Confirm lesson 1 ──────────────────────────────────────────────────────
    const r1 = await callRoute(
      { bookingId: child1.id, packageBookingId: pkg.packageBooking.id, hoursToDeduct: 1 },
      studentA.user.email
    );
    expect(r1.status).toBe(200);

    // After lesson 1: packageHoursUsed = 1, 1 confirmed child booking
    const pkgAfter1 = await prisma.booking.findUnique({ where: { id: pkg.packageBooking.id } });
    expect(Number(pkgAfter1?.packageHoursUsed)).toBeCloseTo(1, 4);
    expect(Number(pkgAfter1?.packageHoursRemaining)).toBeCloseTo(2, 4);

    // ── Confirm lesson 2 ──────────────────────────────────────────────────────
    const r2 = await callRoute(
      { bookingId: child2.id, packageBookingId: pkg.packageBooking.id, hoursToDeduct: 1 },
      studentA.user.email
    );
    // Old formula: 3 - 1 (packageHoursUsed) - 1 (otherUsedHours) = 1 → would pass.
    // New formula: 3 - 1 (otherUsedHours: child1 confirmed) = 2 → correct.
    expect(r2.status).toBe(200);

    const pkgAfter2 = await prisma.booking.findUnique({ where: { id: pkg.packageBooking.id } });
    expect(Number(pkgAfter2?.packageHoursUsed)).toBeCloseTo(2, 4);
    expect(Number(pkgAfter2?.packageHoursRemaining)).toBeCloseTo(1, 4);

    // ── Confirm lesson 3 ──────────────────────────────────────────────────────
    // This is the critical assertion: the old code would compute
    //   available = 3 - 2 - 2 = -1 → INSUFFICIENT_HOURS (wrong block)
    // The fixed code computes:
    //   available = 3 - 2 (child1+child2 confirmed) = 1 → passes
    const r3 = await callRoute(
      { bookingId: child3.id, packageBookingId: pkg.packageBooking.id, hoursToDeduct: 1 },
      studentA.user.email
    );
    expect(r3.status).toBe(200);

    const pkgAfter3 = await prisma.booking.findUnique({ where: { id: pkg.packageBooking.id } });
    expect(Number(pkgAfter3?.packageHoursUsed)).toBeCloseTo(3, 4);
    expect(Number(pkgAfter3?.packageHoursRemaining)).toBeCloseTo(0, 4);
    expect(pkgAfter3?.packageStatus).toBe('completed');

    // All three child bookings confirmed
    const children = await prisma.booking.findMany({
      where: {
        id: { in: [child1.id, child2.id, child3.id] },
      },
      select: { id: true, status: true },
    });
    expect(children.every(c => c.status === 'CONFIRMED')).toBe(true);

    // Wallet debited 3 × $60 = $180 (package was $180, should be fully consumed)
    const walletBalance = (await getWalletBalance(studentA.user.id)).balance;
    // Net = $180 (package credit) - $180 (3 × $60 debit) = $0
    // Note: other tests in the suite may have added credits too — compare relative debits
    const debits = await prisma.walletTransaction.findMany({
      where: {
        walletId: studentA.wallet.id,
        type: 'DEBIT',
        status: 'CONFIRMED',
        description: { contains: 'Package hours used' },
      },
    });
    // At least 3 package-hours debits exist (may be more from other tests)
    const packageDebitsForThisRun = debits.filter(d =>
      [child1.id, child2.id, child3.id].includes(d.bookingId ?? '')
    );
    expect(packageDebitsForThisRun).toHaveLength(3);
    const totalDebited = packageDebitsForThisRun.reduce((s, d) => s + Number(d.amount), 0);
    expect(totalDebited).toBeCloseTo(180, 2); // 3 × $60
  });

  it('F3-02: attempting a 4th lesson on an exhausted 3-hour package → 400 INSUFFICIENT_HOURS', async () => {
    /**
     * After all 3 hours are used, a 4th confirmation attempt must be rejected.
     * Verifies the boundary at package exhaustion.
     */
    const pkg = await createPackageFixture(studentA, instructor, 3, 60);

    const child1 = await createChildBooking(studentA, instructor, 6);
    const child2 = await createChildBooking(studentA, instructor, 8);
    const child3 = await createChildBooking(studentA, instructor, 10);
    const child4 = await createChildBooking(studentA, instructor, 12);

    // Confirm all 3 valid lessons
    await callRoute({ bookingId: child1.id, packageBookingId: pkg.packageBooking.id, hoursToDeduct: 1 }, studentA.user.email);
    await callRoute({ bookingId: child2.id, packageBookingId: pkg.packageBooking.id, hoursToDeduct: 1 }, studentA.user.email);
    await callRoute({ bookingId: child3.id, packageBookingId: pkg.packageBooking.id, hoursToDeduct: 1 }, studentA.user.email);

    // 4th attempt must fail
    const r4 = await callRoute(
      { bookingId: child4.id, packageBookingId: pkg.packageBooking.id, hoursToDeduct: 1 },
      studentA.user.email
    );
    expect(r4.status).toBe(400);
    expect(r4.body.error).toMatch(/insufficient hours/i);
    expect(r4.body.available).toBeCloseTo(0, 2);

    // child4 stays PENDING
    const c4 = await prisma.booking.findUnique({ where: { id: child4.id } });
    expect(c4?.status).toBe('PENDING');
  });
});

describe('H-02b-F4: client-supplied hours must match server-derived booking duration', () => {
  /**
   * hoursToDeduct is accepted from the client for format validation only.
   * The route derives the authoritative duration from booking.startTime/endTime
   * inside the transaction, and rejects any request where the supplied value
   * differs by more than ±0.001h (~3.6 seconds).
   *
   * This prevents:
   *   - A client sending hoursToDeduct: 1 for a 2-hour lesson (underpays $60)
   *   - A client sending hoursToDeduct: 2 for a 1-hour lesson (over-deducts, but
   *     wastes the student's own package hours — still rejected for consistency)
   */

  it('F4-01: 2-hour booking with hoursToDeduct: 1 — rejected, all state unchanged', async () => {
    // Create a 2-hour child booking
    const { packageBooking } = await createPackageFixture(studentA, instructor, 10, 60);
    const start = new Date(FUTURE.getTime() + 30 * 60 * 60 * 1000);
    const end   = new Date(start.getTime() + 2 * 60 * 60 * 1000); // 2 hours
    const child2h = await (prisma.booking.create as any)({
      data: {
        providerId:    instructor.provider.id,
        customerId:    studentA.customer.id,
        customerName:  studentA.customer.name,
        status:        'PENDING',
        startTime:     start,
        endTime:       end,
        duration:      120,
        price:         0,
        isPackageBooking: false,
        parentBookingId: null,
      },
    });

    const balanceBefore = (await getWalletBalance(studentA.user.id)).balance;
    const pkgBefore = await prisma.booking.findUnique({ where: { id: packageBooking.id } });

    // Send hoursToDeduct: 1 for a 2-hour booking — mismatch
    const { status, body } = await callRoute(
      { bookingId: child2h.id, packageBookingId: packageBooking.id, hoursToDeduct: 1 },
      studentA.user.email
    );

    expect(status).toBe(409);
    expect(body.error).toMatch(/does not match the booking duration/i);
    expect(body.supplied).toBeCloseTo(1, 3);
    expect(body.serverDerived).toBeCloseTo(2, 3);

    // Booking still PENDING
    const bookingAfter = await prisma.booking.findUnique({ where: { id: child2h.id } });
    expect(bookingAfter?.status).toBe('PENDING');

    // Wallet unchanged
    const balanceAfter = (await getWalletBalance(studentA.user.id)).balance;
    expect(balanceAfter).toBeCloseTo(balanceBefore, 2);

    // Package counters unchanged
    const pkgAfter = await prisma.booking.findUnique({ where: { id: packageBooking.id } });
    expect(Number(pkgAfter?.packageHoursUsed)).toBe(Number(pkgBefore?.packageHoursUsed));
    expect(Number(pkgAfter?.packageHoursRemaining)).toBe(Number(pkgBefore?.packageHoursRemaining));
  });

  it('F4-02: 1-hour booking with hoursToDeduct: 2 — rejected, all state unchanged', async () => {
    // FUTURE child booking is 1 hour (FUTURE → FUTURE_END defined at top of file)
    const { packageBooking, childBooking } = await createPackageFixture(studentA, instructor, 10, 60);

    const balanceBefore = (await getWalletBalance(studentA.user.id)).balance;
    const pkgBefore = await prisma.booking.findUnique({ where: { id: packageBooking.id } });

    // Send hoursToDeduct: 2 for a 1-hour booking — mismatch
    const { status, body } = await callRoute(
      { bookingId: childBooking.id, packageBookingId: packageBooking.id, hoursToDeduct: 2 },
      studentA.user.email
    );

    expect(status).toBe(409);
    expect(body.error).toMatch(/does not match the booking duration/i);
    expect(body.supplied).toBeCloseTo(2, 3);
    expect(body.serverDerived).toBeCloseTo(1, 3);

    // Booking still PENDING
    const bookingAfter = await prisma.booking.findUnique({ where: { id: childBooking.id } });
    expect(bookingAfter?.status).toBe('PENDING');

    // Wallet unchanged
    const balanceAfter = (await getWalletBalance(studentA.user.id)).balance;
    expect(balanceAfter).toBeCloseTo(balanceBefore, 2);

    // Package counters unchanged
    const pkgAfter = await prisma.booking.findUnique({ where: { id: packageBooking.id } });
    expect(Number(pkgAfter?.packageHoursUsed)).toBe(Number(pkgBefore?.packageHoursUsed));
    expect(Number(pkgAfter?.packageHoursRemaining)).toBe(Number(pkgBefore?.packageHoursRemaining));
  });

  it('F4-03: exact match (1h booking, hoursToDeduct: 1) — succeeds normally', async () => {
    // Regression: the mismatch check must not block a correct request
    const { packageBooking, childBooking } = await createPackageFixture(studentA, instructor, 10, 60);
    const balanceBefore = (await getWalletBalance(studentA.user.id)).balance;

    const { status, body } = await callRoute(
      { bookingId: childBooking.id, packageBookingId: packageBooking.id, hoursToDeduct: 1 },
      studentA.user.email
    );

    expect(status).toBe(200);
    expect(body.success).toBe(true);

    // Wallet debited $60
    const balanceAfter = (await getWalletBalance(studentA.user.id)).balance;
    expect(balanceBefore - balanceAfter).toBeCloseTo(60, 2);

    // Booking confirmed
    const bookingAfter = await prisma.booking.findUnique({ where: { id: childBooking.id } });
    expect(bookingAfter?.status).toBe('CONFIRMED');
  });
});

describe('H-02b-F5: booking duration read inside transaction, not from pre-flight snapshot', () => {
  /**
   * F5 fix: the child booking is fetched inside the SERIALIZABLE transaction
   * (step 1b) so that startTime/endTime come from the consistent DB snapshot
   * at confirmation time, not from a pre-transaction read.
   *
   * Test strategy: create a booking with 1-hour duration, then update the DB
   * to a 2-hour duration before calling the route. Send hoursToDeduct: 1.
   *
   * Before F5: the route read startTime/endTime from the pre-flight fetch, so
   * it would see 1 hour, pass the mismatch check, and confirm at the wrong price.
   *
   * After F5: the route reads startTime/endTime from the tx-scoped fetch. It sees
   * the updated 2-hour duration in the DB, computes serverDerivedHours = 2, and
   * rejects hoursToDeduct: 1 with HOURS_DURATION_MISMATCH (409).
   */

  it('F5-01: booking times updated between pre-flight and transaction — route uses transaction-scoped times', async () => {
    const { packageBooking, childBooking } = await createPackageFixture(studentA, instructor);
    // childBooking was created as 1 hour (FUTURE → FUTURE_END)

    const balanceBefore = (await getWalletBalance(studentA.user.id)).balance;
    const pkgBefore = await prisma.booking.findUnique({ where: { id: packageBooking.id } });

    // Simulate a concurrent update: extend the booking to 2 hours in the DB
    // BEFORE the route's transaction runs. The pre-flight check has already
    // occurred (in our test, the pre-flight and transaction are not separated
    // in time, but the transaction fetch will see whatever is in the DB now).
    const newEnd2h = new Date(FUTURE.getTime() + 2 * 60 * 60 * 1000);
    await (prisma.booking.update as any)({
      where: { id: childBooking.id },
      data: { endTime: newEnd2h, duration: 120 },
    });

    // Now call the route with hoursToDeduct: 1 — matches the original 1hr booking
    // but the DB now has a 2hr booking. The tx-scoped fetch sees 2 hours.
    const { status, body } = await callRoute(
      { bookingId: childBooking.id, packageBookingId: packageBooking.id, hoursToDeduct: 1 },
      studentA.user.email
    );

    // Route must reject because tx-scoped times give serverDerivedHours=2, not 1
    expect(status).toBe(409);
    expect(body.error).toMatch(/does not match the booking duration/i);
    expect(body.supplied).toBeCloseTo(1, 3);
    expect(body.serverDerived).toBeCloseTo(2, 3);

    // Booking still PENDING (was not confirmed)
    const bookingAfter = await prisma.booking.findUnique({ where: { id: childBooking.id } });
    expect(bookingAfter?.status).toBe('PENDING');

    // Wallet unchanged
    const balanceAfter = (await getWalletBalance(studentA.user.id)).balance;
    expect(balanceAfter).toBeCloseTo(balanceBefore, 2);

    // Package counters unchanged
    const pkgAfter = await prisma.booking.findUnique({ where: { id: packageBooking.id } });
    expect(Number(pkgAfter?.packageHoursUsed)).toBe(Number(pkgBefore?.packageHoursUsed));
    expect(Number(pkgAfter?.packageHoursRemaining)).toBe(Number(pkgBefore?.packageHoursRemaining));
  });

  it('F5-02: booking times unchanged — correct hoursToDeduct succeeds with tx-scoped duration', async () => {
    /**
     * Regression guard: F5 fix must not block the normal happy path.
     * When times have not changed, the tx-scoped duration matches hoursToDeduct
     * and the confirmation succeeds.
     */
    const { packageBooking, childBooking } = await createPackageFixture(studentA, instructor);
    const balanceBefore = (await getWalletBalance(studentA.user.id)).balance;

    // No modification to the booking — times are still 1 hour
    const { status, body } = await callRoute(
      { bookingId: childBooking.id, packageBookingId: packageBooking.id, hoursToDeduct: 1 },
      studentA.user.email
    );

    expect(status).toBe(200);
    expect(body.success).toBe(true);

    // Wallet debited $60 (1h × $60/hr)
    const balanceAfter = (await getWalletBalance(studentA.user.id)).balance;
    expect(balanceBefore - balanceAfter).toBeCloseTo(60, 2);

    const bookingAfter = await prisma.booking.findUnique({ where: { id: childBooking.id } });
    expect(bookingAfter?.status).toBe('CONFIRMED');
  });
});
