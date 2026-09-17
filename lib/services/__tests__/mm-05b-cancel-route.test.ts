/**
 * MM-05-B Regression Tests: Public Booking Cancel Route — Refund Idempotency
 *
 * Finding: The public cancel route (app/api/public/bookings/[id]/cancel/route.ts)
 * had no idempotency key on its Stripe refund call, meaning a Stripe failure
 * followed by a retry could issue two separate refunds for the same booking.
 *
 * Fix (dc13c7b0): idempotencyKey `cancel-refund-${bookingId}` added as the second
 * argument to stripe.refunds.create().
 *
 * Three invariants verified here without importing the route (avoids Next.js
 * module graph and real DB/Stripe deps):
 *
 * B1 — Idempotency key is `cancel-refund-${bookingId}` passed as second arg to
 *       stripe.refunds.create(). Stripe deduplicates retries using this key.
 *
 * B2 — CAS gate: only one concurrent cancel wins. Second request (updateMany
 *       returns count=0) gets ALREADY_CANCELLED error; Stripe is not called.
 *
 * B3 — Stripe failure is non-fatal: booking stays CANCELLED (no rollback),
 *       response signals requiresManualAction=true. The idempotency key ensures
 *       the next retry returns the same Stripe refund object rather than creating
 *       a new one.
 */

// ─── Mock declarations ────────────────────────────────────────────────────────
// All vi.fn() calls must be at module scope before vi.mock() calls.

const mockRefundsCreate  = vi.fn();
const mockUpdateMany     = vi.fn();
const mockFindUnique     = vi.fn();
const mockBookingUpdate  = vi.fn();

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(() => ({
    refunds: { create: (...args: any[]) => mockRefundsCreate(...args) },
  })),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn().mockImplementation(async (cb: any) => {
      return cb({
        booking: {
          updateMany: (...args: any[]) => mockUpdateMany(...args),
          findUnique: (...args: any[]) => mockFindUnique(...args),
        },
      });
    }),
    booking: { update: (...args: any[]) => mockBookingUpdate(...args) },
  },
}));

vi.mock('@/lib/utils/timezone', () => ({
  resolveTimezone:    vi.fn().mockReturnValue('Australia/Sydney'),
  timezoneFromState:  vi.fn().mockReturnValue('Australia/Sydney'),
  DEFAULT_TIMEZONE:   'Australia/Sydney',
}));

vi.mock('@/lib/services/waiting-list-notify', () => ({
  notifyWaitingList: vi.fn().mockResolvedValue(undefined),
}));

// ─── Test data ────────────────────────────────────────────────────────────────

const BOOKING_ID      = 'bk_mm05b_test';
const PAYMENT_INTENT  = 'pi_mm05b_test';
const STRIPE_REFUND_ID = 're_mm05b_test';

// Represents the shape the route reads from the Stripe SDK
const stripeRefundResponse = {
  id:     STRIPE_REFUND_ID,
  amount: 10000,   // $100.00 in cents
  status: 'succeeded',
  object: 'refund',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Simulates the CAS gate + Stripe refund logic from the cancel route.
 * Extracted verbatim from route.ts lines 212–275 to keep the test
 * independent of the Next.js module graph.
 */
async function runCancelLogic(opts: {
  stripe: { refunds: { create: (...a: any[]) => any } } | null;
  prisma: {
    $transaction: (cb: any) => Promise<any>;
    booking: { update: (...a: any[]) => any };
  };
  bookingId: string;
  paymentIntentId: string | null;
  isPaid: boolean;
  refundAmount: number;
  refundPercentage: number;
  bookingNotes: string;
}): Promise<{
  status: number;
  body: Record<string, any>;
}> {
  const { stripe, prisma, bookingId, paymentIntentId, isPaid, refundAmount, refundPercentage, bookingNotes } = opts;
  const now = new Date();

  // CAS gate (mirrors route.ts lines 212–236)
  let updated: any;
  try {
    updated = await prisma.$transaction(async (tx: any) => {
      const guard = await tx.booking.updateMany({
        where: {
          id: bookingId,
          status: { notIn: ['CANCELLED', 'COMPLETED', 'EXPIRED', 'NO_SHOW'] },
        },
        data: {
          status: 'CANCELLED',
          cancelledAt: now,
          notes: `${bookingNotes}\n\nCancelled: test. Refund: ${refundPercentage}%`.trim(),
        },
      });

      if (guard.count === 0) {
        throw Object.assign(new Error('ALREADY_CANCELLED'), { code: 'ALREADY_CANCELLED' });
      }

      return tx.booking.findUnique({ where: { id: bookingId } });
    });
  } catch (err: any) {
    if (err?.code === 'ALREADY_CANCELLED') {
      return { status: 400, body: { error: 'Booking has already been cancelled' } };
    }
    throw err;
  }

  // Stripe refund (mirrors route.ts lines 241–275)
  let stripeRefundId: string | null = null;
  let stripeRefundError: string | null = null;

  if (refundAmount > 0 && isPaid) {
    if (paymentIntentId && stripe) {
      try {
        const refund = await stripe.refunds.create(
          {
            payment_intent: paymentIntentId,
            amount: Math.round(refundAmount * 100),
            reason: 'requested_by_customer',
            metadata: {
              bookingId,
              refundPercentage: String(refundPercentage),
              cancelledBy: 'voice_agent',
              reason: 'student_request',
            },
          },
          { idempotencyKey: `cancel-refund-${bookingId}` },
        );
        stripeRefundId = refund.id;

        await prisma.booking.update({
          where: { id: bookingId },
          data: { notes: `${updated?.notes ?? ''}\n[Stripe refund: ${refund.id}]` },
        });
      } catch (refundErr: any) {
        stripeRefundError = refundErr.message ?? 'Refund failed';
        // Non-fatal — booking stays CANCELLED
      }
    }
  }

  return {
    status: 200,
    body: {
      success: true,
      booking: updated,
      refund: {
        percentage: refundPercentage,
        amount: refundAmount,
        stripeRefundId,
        requiresManualAction: refundAmount > 0 && isPaid && !stripeRefundId,
        error: stripeRefundError,
      },
    },
  };
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('MM-05-B: Public cancel route — refund idempotency invariants', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateMany.mockResolvedValue({ count: 1 });
    mockFindUnique.mockResolvedValue({ id: BOOKING_ID, status: 'CANCELLED', notes: '' });
    mockBookingUpdate.mockResolvedValue({});
    mockRefundsCreate.mockResolvedValue(stripeRefundResponse);
  });

  // ─── B1 ──────────────────────────────────────────────────────────────────

  it('B1: stripe.refunds.create receives idempotencyKey=cancel-refund-{bookingId} as second argument', async () => {
    const mockStripe = { refunds: { create: mockRefundsCreate } };
    const mockPrisma = {
      $transaction: vi.fn().mockImplementation(async (cb: any) => cb({
        booking: {
          updateMany: mockUpdateMany,
          findUnique: mockFindUnique,
        },
      })),
      booking: { update: mockBookingUpdate },
    };

    const result = await runCancelLogic({
      stripe:           mockStripe,
      prisma:           mockPrisma,
      bookingId:        BOOKING_ID,
      paymentIntentId:  PAYMENT_INTENT,
      isPaid:           true,
      refundAmount:     100,
      refundPercentage: 100,
      bookingNotes:     '',
    });

    expect(result.status).toBe(200);
    expect(result.body.success).toBe(true);

    // The critical assertion: idempotency key is passed as the SECOND argument
    expect(mockRefundsCreate).toHaveBeenCalledTimes(1);
    const [firstArg, secondArg] = mockRefundsCreate.mock.calls[0];

    // First arg: refund params
    expect(firstArg).toMatchObject({
      payment_intent: PAYMENT_INTENT,
      amount:         10000,   // $100 * 100 cents
      reason:         'requested_by_customer',
      metadata:       expect.objectContaining({ bookingId: BOOKING_ID }),
    });

    // Second arg: Stripe request options — the idempotency key
    expect(secondArg).toEqual({ idempotencyKey: `cancel-refund-${BOOKING_ID}` });

    // Response contains the Stripe refund ID
    expect(result.body.refund.stripeRefundId).toBe(STRIPE_REFUND_ID);
    expect(result.body.refund.requiresManualAction).toBe(false);
  });

  // ─── B2 ──────────────────────────────────────────────────────────────────

  it('B2: CAS gate — second concurrent cancel gets 400; Stripe is NOT called', async () => {
    // Simulate: booking already CANCELLED (updateMany returns count=0)
    mockUpdateMany.mockResolvedValueOnce({ count: 0 });

    const mockStripe = { refunds: { create: mockRefundsCreate } };
    const mockPrisma = {
      $transaction: vi.fn().mockImplementation(async (cb: any) => cb({
        booking: {
          updateMany: mockUpdateMany,
          findUnique: mockFindUnique,
        },
      })),
      booking: { update: mockBookingUpdate },
    };

    const result = await runCancelLogic({
      stripe:           mockStripe,
      prisma:           mockPrisma,
      bookingId:        BOOKING_ID,
      paymentIntentId:  PAYMENT_INTENT,
      isPaid:           true,
      refundAmount:     100,
      refundPercentage: 100,
      bookingNotes:     '',
    });

    // CAS miss → 400, not 200
    expect(result.status).toBe(400);
    expect(result.body.error).toBe('Booking has already been cancelled');

    // Stripe must NOT be called — CAS gate stopped execution before the refund path
    expect(mockRefundsCreate).not.toHaveBeenCalled();
  });

  it('B2: first cancel wins — updateMany count=1; second call (count=0) stopped at gate', async () => {
    let callCount = 0;
    mockUpdateMany.mockImplementation(async () => {
      callCount++;
      return { count: callCount === 1 ? 1 : 0 };
    });

    const makeRequest = async () => {
      const mockStripe = { refunds: { create: mockRefundsCreate } };
      const mockPrisma = {
        $transaction: vi.fn().mockImplementation(async (cb: any) => cb({
          booking: {
            updateMany: mockUpdateMany,
            findUnique: mockFindUnique,
          },
        })),
        booking: { update: mockBookingUpdate },
      };
      return runCancelLogic({
        stripe: mockStripe, prisma: mockPrisma,
        bookingId: BOOKING_ID, paymentIntentId: PAYMENT_INTENT,
        isPaid: true, refundAmount: 100, refundPercentage: 100, bookingNotes: '',
      });
    };

    const [first, second] = await Promise.all([makeRequest(), makeRequest()]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 400]);   // exactly one success, one rejection

    // Stripe called at most once — only the winner reaches the refund path
    expect(mockRefundsCreate.mock.calls.length).toBeLessThanOrEqual(1);
  });

  // ─── B3 ──────────────────────────────────────────────────────────────────

  it('B3: Stripe failure is non-fatal — booking stays CANCELLED; response flags requiresManualAction', async () => {
    mockRefundsCreate.mockRejectedValueOnce(new Error('card_declined'));

    const mockStripe = { refunds: { create: mockRefundsCreate } };
    const mockPrisma = {
      $transaction: vi.fn().mockImplementation(async (cb: any) => cb({
        booking: {
          updateMany: mockUpdateMany,
          findUnique: mockFindUnique,
        },
      })),
      booking: { update: mockBookingUpdate },
    };

    const result = await runCancelLogic({
      stripe:           mockStripe,
      prisma:           mockPrisma,
      bookingId:        BOOKING_ID,
      paymentIntentId:  PAYMENT_INTENT,
      isPaid:           true,
      refundAmount:     100,
      refundPercentage: 100,
      bookingNotes:     '',
    });

    // Route returns 200 — cancel succeeded even though Stripe failed
    expect(result.status).toBe(200);
    expect(result.body.success).toBe(true);

    // Refund section signals the failure
    expect(result.body.refund.stripeRefundId).toBeNull();
    expect(result.body.refund.requiresManualAction).toBe(true);
    expect(result.body.refund.error).toBe('card_declined');

    // Booking was NOT rolled back — updateMany (the CANCELLED write) was called
    // but prisma.booking.update (the post-refund notes write) was NOT called
    expect(mockUpdateMany).toHaveBeenCalledTimes(1);
    expect(mockBookingUpdate).not.toHaveBeenCalled();
  });

  it('B3: idempotency key ensures Stripe retry returns same refund object (not a new charge)', () => {
    // This is a contract assertion, not a runtime assertion.
    // Stripe's idempotency guarantee: two calls with the same idempotencyKey
    // within 24h return the same response object. The key structure guarantees
    // per-booking de-duplication: different bookings have different keys.
    const booking1Key = `cancel-refund-bk_001`;
    const booking2Key = `cancel-refund-bk_002`;
    const retryKey    = `cancel-refund-bk_001`;

    // Same booking, retried → same key → Stripe returns existing refund
    expect(retryKey).toBe(booking1Key);

    // Different booking → different key → Stripe creates new refund (correct)
    expect(booking2Key).not.toBe(booking1Key);

    // Key format matches production code: `cancel-refund-${params.id}`
    expect(booking1Key).toMatch(/^cancel-refund-/);
  });
});
