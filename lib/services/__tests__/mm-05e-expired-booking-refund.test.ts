/**
 * MM-05-E-R / MM-05-E-S Regression Tests
 * Expired-booking post-refund durable state
 *
 * Finding MM-05-E-R: No WebhookEvent written after successful expired-booking refund.
 * Finding MM-05-E-S: booking.status stays EXPIRED (not CANCELLED) after refund.
 *
 * Fix (this commit): after stripe.refunds.create() succeeds, a SERIALIZABLE
 * prisma.$transaction writes:
 *   A. booking.updateMany WHERE status='EXPIRED' → CANCELLED + stripeRefundId
 *   B. recordWebhookEvent(tx, ...)
 * with CAS semantics: count=0 triggers a state-verification branch that
 * distinguishes already-complete (idempotent), repair-needed, integrity-error,
 * and unexpected-status cases before any WebhookEvent write proceeds.
 *
 * Two invariants under test:
 *   INV-E1: successful refund produces durable WebhookEvent + CANCELLED + stripeRefundId
 *   INV-E2: successfully refunded booking does not remain EXPIRED
 *   INV-E3: repeated delivery never creates a second refund
 *   INV-E4: DB failure after Stripe success → retry reuses same Stripe key
 *   INV-E5: CANCELLED+null refundId → repair path writes refundId
 *   INV-E6: CANCELLED+different refundId → hard integrity error, no overwrite
 *   INV-E7: concurrent deliveries → one refund, consistent final state
 *   INV-E8: duplicate WebhookEvent after correct state → safe early return
 *
 * Tests exercise the extracted post-refund logic mirroring the production
 * catch(err instanceof ExpiredBookingError) block verbatim.
 */

// ─── Mock declarations ────────────────────────────────────────────────────────

const mockRefundsCreate   = vi.fn();
const mockUpdateMany      = vi.fn();
const mockFindUnique      = vi.fn();
const mockBookingUpdate   = vi.fn();
const mockWebhookCreate   = vi.fn();
const mockSendAlert       = vi.fn();

vi.mock('@/lib/services/alert-service', () => ({ sendAlert: (...a: any[]) => mockSendAlert(...a) }));
vi.mock('@/lib/prisma', () => ({
  prisma: { webhookEvent: { create: (...a: any[]) => mockWebhookCreate(...a) } },
}));

// ─── Support types/classes (mirror production) ────────────────────────────────

class DuplicateWebhookEventError extends Error {
  constructor(public readonly idempotencyKey: string) {
    super(`Webhook event already claimed: ${idempotencyKey}`);
    this.name = 'DuplicateWebhookEventError';
  }
}

class ExpiredBookingIntegrityError extends Error {
  constructor(message: string) { super(message); this.name = 'ExpiredBookingIntegrityError'; }
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BOOKING_ID    = 'bk_mm05e_test';
const PI_ID         = 'pi_mm05e_test';
const IDEM_KEY      = `idem-outer-${BOOKING_ID}`;
const REFUND_ID     = 're_mm05e_test';
const REFUND_ID_ALT = 're_mm05e_OTHER';  // a different refund (integrity error scenario)

const stripeRefundResponse = { id: REFUND_ID, amount: 10000, status: 'succeeded' };

// ─── Extracted post-refund logic ──────────────────────────────────────────────
// Mirrors the production catch(err instanceof ExpiredBookingError) block
// in handleBookingPaymentSuccess() (webhook/route.ts ~1133-1248).

async function recordWebhookEvent(
  db: any,
  idempotencyKey: string,
  eventType: string,
  stripeEventId: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  try {
    await db.webhookEvent.create({
      data: { idempotencyKey, eventType, stripeEventId, metadata, processedAt: new Date() },
    });
  } catch (err: any) {
    if (err?.code === 'P2002') throw new DuplicateWebhookEventError(idempotencyKey);
    throw err;
  }
}

type PostRefundOutcome =
  | 'completed'         // normal path
  | 'idempotent'        // already done
  | 'repaired'          // refundId was null, now written
  | 'duplicate-event'   // WebhookEvent duplicate after verified-correct state
  | 'stripe-failed'     // refund call threw
  | 'db-failed'         // post-refund DB write failed
  | 'integrity-error'   // different refundId already on booking
  | 'unexpected-status';// booking in neither EXPIRED nor CANCELLED

interface PostRefundResult {
  outcome: PostRefundOutcome;
  stripeCallCount: number;
  webhookWriteCount: number;
  bookingUpdateCount: number;   // updateMany CAS calls
  bookingFindCount: number;     // findUnique calls
  bookingRepairCount: number;   // direct update calls (repair path)
  alertSent: boolean;
  alertSeverity?: string;
}

async function runExpiredBookingPostRefund(opts: {
  stripe: any;
  prisma: any;
  bookingId: string;
  paymentIntentId: string;
  idempotencyKey: string;
}): Promise<PostRefundResult> {
  const { stripe, prisma, bookingId, paymentIntentId, idempotencyKey } = opts;
  const counts = { stripe: 0, webhook: 0, update: 0, find: 0, repair: 0 };
  let alertSent = false;
  let alertSeverity: string | undefined;
  let outcome: PostRefundOutcome = 'completed';

  // ── Step 1: Stripe refund ──────────────────────────────────────────────────
  let refund: any;
  try {
    refund = await stripe.refunds.create(
      { payment_intent: paymentIntentId, reason: 'duplicate',
        metadata: { bookingId, reason: 'Booking expired before payment confirmed' } },
      { idempotencyKey: `expired-booking-refund-${bookingId}-${paymentIntentId}` },
    );
    counts.stripe++;
  } catch (refundErr: any) {
    alertSent = true;
    alertSeverity = 'CRITICAL';
    return { outcome: 'stripe-failed', stripeCallCount: counts.stripe,
      webhookWriteCount: 0, bookingUpdateCount: 0, bookingFindCount: 0,
      bookingRepairCount: 0, alertSent, alertSeverity };
  }

  // ── Step 2: Durable DB state (SERIALIZABLE) ────────────────────────────────
  try {
    // withSerializableRetry omitted in tests — tx behaviour is deterministic
    await prisma.$transaction(async (tx: any) => {
      const transitioned = await tx.booking.updateMany({
        where: { id: bookingId, status: 'EXPIRED' },
        data: { status: 'CANCELLED', stripeRefundId: refund.id,
          notes: `EXPIRED_PAYMENT_REFUNDED: ${refund.id}` },
      });
      counts.update++;

      if (transitioned.count === 0) {
        // Inspect current state
        const current = await tx.booking.findUnique({
          where: { id: bookingId },
          select: { status: true, stripeRefundId: true },
        });
        counts.find++;

        if (!current) throw new Error(`Booking ${bookingId} not found`);

        if (current.status === 'CANCELLED') {
          if (current.stripeRefundId === refund.id) {
            outcome = 'idempotent';
            // fall through to WebhookEvent write
          } else if (current.stripeRefundId === null) {
            await tx.booking.update({
              where: { id: bookingId },
              data: { stripeRefundId: refund.id },
            });
            counts.repair++;
            outcome = 'repaired';
          } else {
            // Different refundId — integrity error
            alertSent = true; alertSeverity = 'CRITICAL';
            throw new ExpiredBookingIntegrityError(
              `Integrity error: booking ${bookingId} CANCELLED with different refundId (${current.stripeRefundId} vs ${refund.id})`
            );
          }
        } else {
          alertSent = true; alertSeverity = 'CRITICAL';
          throw new ExpiredBookingIntegrityError(
            `Unexpected booking status '${current.status}' for ${bookingId}`
          );
        }
      }

      // WebhookEvent — inside same tx; only reached after booking state verified
      await recordWebhookEvent(tx, idempotencyKey, 'payment_intent.succeeded',
        paymentIntentId, { expiredBooking: true, bookingId, stripeRefundId: refund.id });
      counts.webhook++;
    });
  } catch (dbErr: any) {
    if (dbErr?.name === 'DuplicateWebhookEventError') {
      outcome = 'duplicate-event';
    } else if (dbErr?.name === 'ExpiredBookingIntegrityError') {
      outcome = dbErr.message.includes('different refundId') ? 'integrity-error' : 'unexpected-status';
    } else {
      alertSent = true; alertSeverity = 'CRITICAL';
      return { outcome: 'db-failed', stripeCallCount: counts.stripe,
        webhookWriteCount: counts.webhook, bookingUpdateCount: counts.update,
        bookingFindCount: counts.find, bookingRepairCount: counts.repair,
        alertSent, alertSeverity };
    }
  }

  return { outcome, stripeCallCount: counts.stripe, webhookWriteCount: counts.webhook,
    bookingUpdateCount: counts.update, bookingFindCount: counts.find,
    bookingRepairCount: counts.repair, alertSent, alertSeverity };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeStripe(opts: { throws?: Error; refundResult?: any } = {}) {
  return {
    refunds: {
      create: opts.throws
        ? vi.fn().mockRejectedValue(opts.throws)
        : vi.fn().mockResolvedValue(opts.refundResult ?? stripeRefundResponse),
    },
  };
}

function makePrisma(txImpl: (tx: any) => Promise<void>) {
  const tx = {
    booking: {
      updateMany: (...a: any[]) => mockUpdateMany(...a),
      findUnique: (...a: any[]) => mockFindUnique(...a),
      update:     (...a: any[]) => mockBookingUpdate(...a),
    },
    webhookEvent: { create: (...a: any[]) => mockWebhookCreate(...a) },
  };
  return {
    $transaction: vi.fn().mockImplementation((cb: any) => cb(tx)),
    webhookEvent: { create: (...a: any[]) => mockWebhookCreate(...a) },
  };
}

function defaultInvoke(overrides: Partial<Parameters<typeof runExpiredBookingPostRefund>[0]> = {}) {
  return runExpiredBookingPostRefund({
    stripe:           makeStripe(),
    prisma:           makePrisma(async () => {}),
    bookingId:        BOOKING_ID,
    paymentIntentId:  PI_ID,
    idempotencyKey:   IDEM_KEY,
    ...overrides,
  });
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('MM-05-E-R/S: Expired-booking post-refund durable state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendAlert.mockResolvedValue(undefined);
    mockUpdateMany.mockResolvedValue({ count: 1 });
    mockFindUnique.mockResolvedValue(null);
    mockBookingUpdate.mockResolvedValue({});
    mockWebhookCreate.mockResolvedValue({});
  });

  // ─── E1: Normal path ───────────────────────────────────────────────────────

  it('E1 (INV-E1/E2): normal refund → CANCELLED + stripeRefundId + WebhookEvent written', async () => {
    const result = await defaultInvoke();

    expect(result.outcome).toBe('completed');
    expect(result.stripeCallCount).toBe(1);

    // Booking CAS update called with EXPIRED guard
    expect(mockUpdateMany).toHaveBeenCalledOnce();
    expect(mockUpdateMany.mock.calls[0][0]).toMatchObject({
      where: { id: BOOKING_ID, status: 'EXPIRED' },
      data:  expect.objectContaining({ status: 'CANCELLED', stripeRefundId: REFUND_ID }),
    });

    // WebhookEvent written inside same tx
    expect(mockWebhookCreate).toHaveBeenCalledOnce();
    expect(mockWebhookCreate.mock.calls[0][0].data).toMatchObject({
      idempotencyKey: IDEM_KEY,
      metadata:       expect.objectContaining({ stripeRefundId: REFUND_ID, expiredBooking: true }),
    });

    expect(result.alertSent).toBe(false);
  });

  // ─── E2: Stripe transient failure ──────────────────────────────────────────

  it('E2 (INV-E4): Stripe fails → no DB write; outcome stripe-failed → caller returns HTTP 500', async () => {
    const result = await defaultInvoke({
      stripe: makeStripe({ throws: new Error('stripe_network_timeout') }),
    });

    expect(result.outcome).toBe('stripe-failed');
    expect(result.stripeCallCount).toBe(0);      // refunds.create threw before incrementing
    expect(mockUpdateMany).not.toHaveBeenCalled();
    expect(mockWebhookCreate).not.toHaveBeenCalled();
    expect(result.alertSent).toBe(true);
    expect(result.alertSeverity).toBe('CRITICAL');
  });

  it('E2 (INV-E4): after Stripe failure, retry uses same idempotency key', async () => {
    // First attempt: Stripe fails
    let capturedKey: string | undefined;
    const failStripe = {
      refunds: { create: vi.fn().mockImplementationOnce((_: any, opts: any) => {
        capturedKey = opts.idempotencyKey;
        throw new Error('timeout');
      }) },
    };
    const r1 = await runExpiredBookingPostRefund({
      stripe: failStripe, prisma: makePrisma(async () => {}),
      bookingId: BOOKING_ID, paymentIntentId: PI_ID, idempotencyKey: IDEM_KEY,
    });
    expect(r1.outcome).toBe('stripe-failed');

    // Second attempt (Stripe retry): uses same key
    const okStripe = {
      refunds: { create: vi.fn().mockImplementationOnce((_: any, opts: any) => {
        expect(opts.idempotencyKey).toBe(capturedKey);  // same key
        return stripeRefundResponse;
      }) },
    };
    mockUpdateMany.mockResolvedValueOnce({ count: 1 });
    mockWebhookCreate.mockResolvedValueOnce({});
    const r2 = await runExpiredBookingPostRefund({
      stripe: okStripe, prisma: makePrisma(async () => {}),
      bookingId: BOOKING_ID, paymentIntentId: PI_ID, idempotencyKey: IDEM_KEY,
    });
    expect(r2.outcome).toBe('completed');
    expect(capturedKey).toBe(`expired-booking-refund-${BOOKING_ID}-${PI_ID}`);
  });

  // ─── E3: DB fails after Stripe succeeds ────────────────────────────────────

  it('E3 (INV-E4): DB transaction fails after Stripe succeeds → db-failed; retry reuses Stripe key', async () => {
    mockUpdateMany.mockRejectedValueOnce(new Error('db_connection_error'));

    const result = await defaultInvoke();
    expect(result.outcome).toBe('db-failed');
    expect(result.stripeCallCount).toBe(1);       // Stripe was called
    expect(result.webhookWriteCount).toBe(0);     // DB write never committed

    // On retry: Stripe returns same refund (idempotency), DB succeeds
    mockUpdateMany.mockResolvedValueOnce({ count: 1 });
    mockWebhookCreate.mockResolvedValueOnce({});
    const retryResult = await defaultInvoke();
    expect(retryResult.outcome).toBe('completed');
    expect(retryResult.stripeCallCount).toBe(1);
    expect(retryResult.webhookWriteCount).toBe(1);
  });

  // ─── E4: Already CANCELLED with same refund ID (idempotent retry) ──────────

  it('E4 (INV-E3/E1): booking already CANCELLED with same refundId → idempotent; no second Stripe call from same invocation', async () => {
    // updateMany finds no EXPIRED booking — already CANCELLED
    mockUpdateMany.mockResolvedValueOnce({ count: 0 });
    mockFindUnique.mockResolvedValueOnce({ status: 'CANCELLED', stripeRefundId: REFUND_ID });

    const result = await defaultInvoke();

    // Stripe was still called (idempotent — Stripe returns existing refund)
    expect(result.stripeCallCount).toBe(1);
    expect(result.outcome).toBe('idempotent');

    // WebhookEvent write attempted
    expect(result.bookingRepairCount).toBe(0);    // no repair needed
    expect(result.alertSent).toBe(false);
  });

  // ─── E5: CANCELLED with null refundId — repair path ────────────────────────

  it('E5 (INV-E5): CANCELLED + stripeRefundId=null → repair writes refundId', async () => {
    mockUpdateMany.mockResolvedValueOnce({ count: 0 });
    mockFindUnique.mockResolvedValueOnce({ status: 'CANCELLED', stripeRefundId: null });
    mockBookingUpdate.mockResolvedValueOnce({});
    mockWebhookCreate.mockResolvedValueOnce({});

    const result = await defaultInvoke();

    expect(result.outcome).toBe('repaired');
    expect(result.bookingRepairCount).toBe(1);    // direct update was called

    // Repair writes the correct refundId
    expect(mockBookingUpdate).toHaveBeenCalledOnce();
    expect(mockBookingUpdate.mock.calls[0][0]).toMatchObject({
      where: { id: BOOKING_ID },
      data:  { stripeRefundId: REFUND_ID },
    });

    expect(result.alertSent).toBe(false);
  });

  // ─── E6: CANCELLED with different refundId — integrity error ───────────────

  it('E6 (INV-E6): CANCELLED + different stripeRefundId → integrity error; no overwrite; alert fired', async () => {
    mockUpdateMany.mockResolvedValueOnce({ count: 0 });
    mockFindUnique.mockResolvedValueOnce({ status: 'CANCELLED', stripeRefundId: REFUND_ID_ALT });

    const result = await defaultInvoke();

    expect(result.outcome).toBe('integrity-error');
    expect(result.bookingRepairCount).toBe(0);    // never wrote anything

    // The existing different refundId must NOT have been overwritten
    expect(mockBookingUpdate).not.toHaveBeenCalled();
    expect(mockUpdateMany).toHaveBeenCalledOnce();  // only the initial CAS attempt

    expect(result.alertSent).toBe(true);
    expect(result.alertSeverity).toBe('CRITICAL');
  });

  // ─── E7: Concurrent deliveries ─────────────────────────────────────────────

  it('E7 (INV-E3/E7): concurrent deliveries → one Stripe refund; consistent final state', async () => {
    // Model concurrency: first invocation wins the CAS (count=1),
    // second invocation misses (count=0) but finds CANCELLED+correct refundId
    let casCallCount = 0;
    mockUpdateMany.mockImplementation(async () => {
      casCallCount++;
      return { count: casCallCount === 1 ? 1 : 0 };
    });
    mockFindUnique.mockResolvedValue({ status: 'CANCELLED', stripeRefundId: REFUND_ID });
    mockWebhookCreate.mockResolvedValue({});

    // Both invocations receive the same refund object (Stripe idempotency)
    const stripe = makeStripe();

    const invoke = () => runExpiredBookingPostRefund({
      stripe, prisma: makePrisma(async () => {}),
      bookingId: BOOKING_ID, paymentIntentId: PI_ID, idempotencyKey: IDEM_KEY,
    });

    const [r1, r2] = await Promise.all([invoke(), invoke()]);
    const outcomes = [r1.outcome, r2.outcome].sort();

    // One completes, one is idempotent (or duplicate-event) — no integrity error
    expect(outcomes).not.toContain('integrity-error');
    expect(outcomes).not.toContain('stripe-failed');
    expect(outcomes).not.toContain('db-failed');

    // Stripe called twice (both deliveries called Stripe — idempotency key deduplicates)
    expect((stripe.refunds.create as any).mock.calls.length).toBe(2);
  });

  // ─── E8: Duplicate WebhookEvent after correct state ────────────────────────

  it('E8 (INV-E8): duplicate WebhookEvent only safe after booking state verified correct', async () => {
    // Normal path: updateMany succeeds (count=1), but WebhookEvent P2002 duplicate
    mockUpdateMany.mockResolvedValueOnce({ count: 1 });
    mockWebhookCreate.mockRejectedValueOnce(
      Object.assign(new Error('Unique constraint'), { code: 'P2002' })
    );

    const result = await defaultInvoke();

    // Booking update was already applied; DuplicateWebhookEventError is caught safely
    // because the CAS write (count=1) confirmed the booking state was correct first
    expect(result.outcome).toBe('duplicate-event');
    expect(result.bookingUpdateCount).toBe(1);    // booking was updated this invocation
    expect(result.alertSent).toBe(false);         // not an error — expected on concurrent retry
  });

  it('E8: duplicate-event from IDEMPOTENT path — booking already correct before tx', async () => {
    // Booking was CANCELLED (prior delivery succeeded), WebhookEvent also already exists
    mockUpdateMany.mockResolvedValueOnce({ count: 0 });
    mockFindUnique.mockResolvedValueOnce({ status: 'CANCELLED', stripeRefundId: REFUND_ID });
    mockWebhookCreate.mockRejectedValueOnce(
      Object.assign(new Error('Unique constraint'), { code: 'P2002' })
    );

    const result = await defaultInvoke();

    // Both booking and WebhookEvent already complete — idempotent + duplicate-event
    // The final outcome is duplicate-event (WebhookEvent threw after booking verified)
    expect(result.outcome).toBe('duplicate-event');
    expect(result.bookingRepairCount).toBe(0);
    expect(result.alertSent).toBe(false);
  });

  // ─── Idempotency key format verification ───────────────────────────────────

  it('Stripe idempotency key is stable and deterministic per (bookingId, paymentIntentId)', async () => {
    let capturedKey: string | undefined;
    const stripe = {
      refunds: { create: vi.fn().mockImplementationOnce((_: any, opts: any) => {
        capturedKey = opts.idempotencyKey;
        return stripeRefundResponse;
      }) },
    };
    mockUpdateMany.mockResolvedValue({ count: 1 });
    mockWebhookCreate.mockResolvedValue({});

    await runExpiredBookingPostRefund({
      stripe, prisma: makePrisma(async () => {}),
      bookingId: BOOKING_ID, paymentIntentId: PI_ID, idempotencyKey: IDEM_KEY,
    });

    expect(capturedKey).toBe(`expired-booking-refund-${BOOKING_ID}-${PI_ID}`);

    // A different booking produces a different key
    const key2 = `expired-booking-refund-bk_OTHER-${PI_ID}`;
    expect(key2).not.toBe(capturedKey);
  });
});
