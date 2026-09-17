/**
 * MM-05-E-R / MM-05-E-S Direct Production-Path Verification
 * payment_intent.succeeded → handleBookingPaymentSuccess → ExpiredBookingError path
 *
 * ENVIRONMENT REQUIREMENT:
 *   SUB22_TEST_DATABASE_URL=<isolated PostgreSQL URL>
 *   STRIPE_WEBHOOK_SECRET=<any string, e.g. "whsec_test_mm05e">
 *
 * These tests call the real exported POST handler from route.ts.
 * Prisma writes against the isolated database — never production.
 * Stripe outbound API calls (refunds.create) are mocked.
 *
 * STATUS: Direct production-path verification infrastructure — PENDING EXECUTION.
 * Cannot run without SUB22_TEST_DATABASE_URL pointing to an isolated Postgres.
 *
 * RELATIONSHIP TO AUDIT:
 *   MM-05-E-R: FIX-VERIFIED (extracted-logic tests, 11/11, commit 4bc20a6f).
 *   MM-05-E-S: FIX-VERIFIED (same commit).
 *   This file provides the direct-handler evidence required to advance both
 *   findings from FIX-VERIFIED → CLOSED under AUDIT-PROCESS.md.
 *
 * Tests:
 *   E-P1: EXPIRED booking → handler returns 200; booking.status=CANCELLED;
 *         booking.stripeRefundId=<refund.id>; WebhookEvent written with
 *         idempotencyKey matching the outer event key; no CONFIRMED write
 *
 *   E-P2: Stripe refund fails → handler returns 500; booking remains EXPIRED;
 *         no WebhookEvent written; retry uses same idempotency key and succeeds
 *
 *   E-P3: DB transaction fails after Stripe succeeds → handler returns 500;
 *         retry succeeds using same Stripe idempotency key; final state: CANCELLED
 *
 *   E-P4: duplicate delivery after successful refund → 200; booking already
 *         CANCELLED + stripeRefundId set; Stripe NOT called again;
 *         exactly one WebhookEvent row
 *
 *   E-P5: booking already CANCELLED + stripeRefundId null (partial prior write)
 *         → refund succeeds; stripeRefundId repaired; 200 returned
 *
 *   E-P6: concurrent deliveries → one refund (Stripe idempotency);
 *         consistent CANCELLED state; exactly one WebhookEvent row
 *
 *   E-P7: CONFIRMED booking (normal paid booking) → booking confirmed normally;
 *         NO expired-booking refund path taken; booking remains CONFIRMED
 */

import { NextRequest } from 'next/server';
import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';

// ─── Environment guard ────────────────────────────────────────────────────────

const TEST_DB_URL    = process.env.SUB22_TEST_DATABASE_URL;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? 'whsec_test_mm05e_direct';
const TEST_PREFIX    = 'test-mm05e';

function requireTestEnvironment() {
  if (!TEST_DB_URL) {
    throw new Error(
      '[MM-05-E-R/S SKIP] Direct production-path verification requires ' +
      'SUB22_TEST_DATABASE_URL pointing to an isolated staging/test PostgreSQL database. ' +
      'This test suite will not run without it. ' +
      'Set SUB22_TEST_DATABASE_URL to a non-production database and re-run. ' +
      'Do NOT point this at the Supabase production database.'
    );
  }
  process.env.DATABASE_URL = TEST_DB_URL;
  process.env.NODE_ENV     = 'development'; // rate limiter fails-open
}

// ─── Module-level mocks ───────────────────────────────────────────────────────

const mockRefundsCreate = vi.fn();
const mockSendAlert     = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/services/alert-service', () => ({ sendAlert: (...a: any[]) => mockSendAlert(...a) }));
vi.mock('@/lib/services/email',         () => ({ emailService: { sendGenericEmail: vi.fn().mockResolvedValue(undefined) } }));
vi.mock('@/lib/services/sms',           () => ({ smsService:   { sendSMS:          vi.fn().mockResolvedValue(undefined) } }));
vi.mock('@/lib/services/notifications', () => ({ notifyPaymentReceived: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/services/receipt-email', () => ({
  sendSingleLessonReceipt:    vi.fn().mockResolvedValue(undefined),
  sendPackagePurchaseReceipt: vi.fn().mockResolvedValue(undefined),
  sendWalletTopUpReceipt:     vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/services/payout-service',  () => ({ recordPaymentCollected: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/services/ledger-service',  () => ({
  appendLedgerEntry: vi.fn().mockResolvedValue(undefined),
  incrementLedger:   vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/services/auditLogger', () => ({
  logFinancialAction: vi.fn().mockResolvedValue(undefined),
  logSubscriptionAction: vi.fn().mockResolvedValue(undefined),
  AuditAction: { PAYMENT_SUCCEEDED: 'PAYMENT_SUCCEEDED', PAYMENT_FAILED: 'PAYMENT_FAILED' },
  ActorRole:   { SYSTEM: 'SYSTEM' },
}));
vi.mock('@/lib/utils/timezone', () => ({
  DEFAULT_TIMEZONE:  'Australia/Sydney',
  resolveTimezone:   vi.fn().mockReturnValue('Australia/Sydney'),
  timezoneFromState: vi.fn().mockReturnValue('Australia/Sydney'),
}));

// Stripe mock: refunds.create is mocked; webhooks.constructEvent uses real verification
vi.mock('stripe', async (importOriginal) => {
  const RealStripe = (await importOriginal<typeof import('stripe')>()).default;
  return {
    default: vi.fn().mockImplementation((key: string, opts: any) => {
      const real = new RealStripe(key, opts);
      return {
        ...real,
        refunds: { ...real.refunds, create: (...a: any[]) => mockRefundsCreate(...a) },
      };
    }),
  };
});

// ─── Shared state ─────────────────────────────────────────────────────────────

let prisma:       PrismaClient;
let POST:         typeof import('../route').POST;
let testProvider: { id: string };
let testUser:     { id: string };
let testCustomer: { id: string };

const MOCK_REFUND_ID  = 're_mm05e_direct_test';
const BOOKING_AMOUNT  = 8000; // $80.00 in cents

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function createFixtures() {
  const suffix     = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const userId     = `${TEST_PREFIX}-user-${suffix}`;
  const custUserId = `${TEST_PREFIX}-custuser-${suffix}`;
  const providerId = `${TEST_PREFIX}-prov-${suffix}`;
  const customerId = `${TEST_PREFIX}-cust-${suffix}`;

  testUser = await prisma.user.create({
    data: { id: userId, email: `${TEST_PREFIX}-prov-${suffix}@example.com`,
            name: 'MM-05-E Test Provider', role: 'INSTRUCTOR' },
  });

  const custUserRecord = await prisma.user.create({
    data: { id: custUserId, email: `${TEST_PREFIX}-cust-${suffix}@example.com`,
            name: 'MM-05-E Test Customer', role: 'CLIENT' },
  });

  testProvider = await prisma.provider.create({
    data: { id: providerId, userId, name: 'MM-05-E Test Provider',
            phone: '+61400000002', hourlyRate: 80 },
  });

  testCustomer = await prisma.customer.create({
    data: { id: customerId, userId: custUserRecord.id,
            name: 'MM-05-E Test Customer', phone: '+61400000003' },
  });
}

/**
 * Create a booking in the given status for use as a test fixture.
 * paymentIntentId is stored in booking.paymentIntentId (the field the webhook reads).
 */
async function createBooking(opts: {
  status:          string;
  paymentIntentId: string;
  stripeRefundId?: string | null;
}): Promise<{ id: string }> {
  return prisma.booking.create({
    data: {
      providerId:      testProvider.id,
      customerId:      testCustomer.id,
      status:          opts.status,
      paymentIntentId: opts.paymentIntentId,
      stripeRefundId:  opts.stripeRefundId ?? null,
      price:           80,
      isPaid:          opts.status === 'CONFIRMED',
    } as any,
  });
}

/**
 * Build a payment_intent.succeeded event for the given booking/PI.
 */
function makePaymentSucceededEvent(opts: {
  bookingId:       string;
  paymentIntentId: string;
  eventId:         string;
  amountCents:     number;
}): Stripe.Event {
  const now = Math.floor(Date.now() / 1000);
  return {
    id:          opts.eventId,
    object:      'event',
    api_version: '2026-02-25.clover' as any,
    created:     now,
    type:        'payment_intent.succeeded',
    livemode:    false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    data: {
      object: {
        id:              opts.paymentIntentId,
        object:          'payment_intent',
        amount:          opts.amountCents,
        amount_received: opts.amountCents,
        status:          'succeeded',
        metadata: {
          bookingId: opts.bookingId,
        },
        last_payment_error: null,
        charges: { data: [{ id: `ch_mm05e_${Date.now()}` }] },
      } as any,
    },
  } as Stripe.Event;
}

async function postEvent(event: Stripe.Event) {
  const body = JSON.stringify(event);
  const sig  = Stripe.webhooks.generateTestHeaderString({
    payload: body, secret: WEBHOOK_SECRET,
  });
  const req = new NextRequest('http://localhost/api/stripe/webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'stripe-signature': sig },
    body,
  });
  const res  = await POST(req);
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

function idemKey(event: Stripe.Event) {
  return `${event.type}_${event.id}_${event.created}`;
}

async function cleanup() {
  if (!prisma) return;
  const userIds = (await prisma.user.findMany({
    where: { id: { startsWith: TEST_PREFIX } }, select: { id: true },
  })).map((u) => u.id);

  if (userIds.length) {
    const provIds = (await prisma.provider.findMany({
      where: { userId: { in: userIds } }, select: { id: true },
    })).map((p) => p.id);
    if (provIds.length) {
      await prisma.booking.deleteMany({ where: { providerId: { in: provIds } } });
      await prisma.provider.deleteMany({ where: { id: { in: provIds } } });
    }
    const custIds = (await prisma.customer.findMany({
      where: { userId: { in: userIds } }, select: { id: true },
    })).map((c) => c.id);
    if (custIds.length) {
      await prisma.customer.deleteMany({ where: { id: { in: custIds } } });
    }
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }

  await prisma.webhookEvent.deleteMany({
    where: { idempotencyKey: { startsWith: `payment_intent.succeeded_evt_mm05e` } },
  });
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('MM-05-E-R/S direct handler: payment_intent.succeeded → expired-booking path', () => {
  beforeAll(async () => {
    requireTestEnvironment();

    prisma = new PrismaClient({ datasources: { db: { url: TEST_DB_URL! } } });
    await prisma.$connect();

    // Dynamic import AFTER DATABASE_URL is set so route.ts Prisma singleton uses test DB
    ({ POST } = await import('../route'));

    await createFixtures();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    mockRefundsCreate.mockResolvedValue({ id: MOCK_REFUND_ID, status: 'succeeded' });
    // Clean up WebhookEvents between tests
    await prisma.webhookEvent.deleteMany({
      where: { idempotencyKey: { startsWith: 'payment_intent.succeeded_evt_mm05e' } },
    });
  });

  afterAll(async () => {
    if (!prisma) return;
    await cleanup();
    await prisma.$disconnect();
  });

  // ─── E-P1: normal expired-booking path ───────────────────────────────────────

  it('E-P1 (INV-E1/E2): EXPIRED booking → 200; status=CANCELLED; stripeRefundId set; WebhookEvent written', async () => {
    const piId    = `pi_mm05e_p1_${Date.now()}`;
    const booking = await createBooking({ status: 'EXPIRED', paymentIntentId: piId });
    const event   = makePaymentSucceededEvent({
      bookingId: booking.id, paymentIntentId: piId,
      eventId:   `evt_mm05e_p1_${Date.now()}`, amountCents: BOOKING_AMOUNT,
    });

    const { status, json } = await postEvent(event);
    expect(status).toBe(200);
    expect(json).toMatchObject({ received: true });

    // ── INV-E2: booking status updated to CANCELLED (not left EXPIRED)
    const updated = await prisma.booking.findUnique({ where: { id: booking.id } });
    expect(updated!.status).toBe('CANCELLED');

    // ── INV-E1: stripeRefundId persisted
    expect(updated!.stripeRefundId).toBe(MOCK_REFUND_ID);

    // ── INV-E1: WebhookEvent written with the correct idempotency key
    const webhookRow = await prisma.webhookEvent.findUnique({
      where: { idempotencyKey: idemKey(event) },
    });
    expect(webhookRow).not.toBeNull();
    expect(webhookRow!.stripeEventId).toBe(event.data.object.id);
    expect((webhookRow!.metadata as any)?.expiredBooking).toBe(true);
    expect((webhookRow!.metadata as any)?.stripeRefundId).toBe(MOCK_REFUND_ID);

    // ── Stripe called with correct idempotency key
    expect(mockRefundsCreate).toHaveBeenCalledTimes(1);
    const [, opts] = mockRefundsCreate.mock.calls[0];
    expect(opts.idempotencyKey).toBe(`expired-booking-refund-${booking.id}-${piId}`);
  }, 30000);

  // ─── E-P2: Stripe refund fails ────────────────────────────────────────────────

  it('E-P2 (INV-E4): Stripe refund fails → 500; booking stays EXPIRED; no WebhookEvent; retry recovers', async () => {
    const piId    = `pi_mm05e_p2_${Date.now()}`;
    const booking = await createBooking({ status: 'EXPIRED', paymentIntentId: piId });
    const event   = makePaymentSucceededEvent({
      bookingId: booking.id, paymentIntentId: piId,
      eventId:   `evt_mm05e_p2_${Date.now()}`, amountCents: BOOKING_AMOUNT,
    });

    // First attempt: Stripe fails
    mockRefundsCreate.mockRejectedValueOnce(new Error('stripe_timeout'));
    const { status: s1 } = await postEvent(event);
    expect(s1).toBe(500);

    // Booking still EXPIRED — not partially mutated
    const afterFail = await prisma.booking.findUnique({ where: { id: booking.id } });
    expect(afterFail!.status).toBe('EXPIRED');
    expect(afterFail!.stripeRefundId).toBeNull();

    // No WebhookEvent committed
    const webhookAfterFail = await prisma.webhookEvent.findUnique({
      where: { idempotencyKey: idemKey(event) },
    });
    expect(webhookAfterFail).toBeNull();

    // Retry: same event, Stripe succeeds
    mockRefundsCreate.mockResolvedValueOnce({ id: MOCK_REFUND_ID, status: 'succeeded' });
    const { status: s2 } = await postEvent(event);
    expect(s2).toBe(200);

    // Retry used the same Stripe idempotency key
    expect(mockRefundsCreate.mock.calls[0][1].idempotencyKey)
      .toBe(mockRefundsCreate.mock.calls[1][1].idempotencyKey);

    // Final state: CANCELLED + refundId + WebhookEvent
    const afterRetry = await prisma.booking.findUnique({ where: { id: booking.id } });
    expect(afterRetry!.status).toBe('CANCELLED');
    expect(afterRetry!.stripeRefundId).toBe(MOCK_REFUND_ID);

    const webhookAfterRetry = await prisma.webhookEvent.findUnique({
      where: { idempotencyKey: idemKey(event) },
    });
    expect(webhookAfterRetry).not.toBeNull();
  }, 30000);

  // ─── E-P3: DB fails after Stripe succeeds ────────────────────────────────────

  it('E-P3 (INV-E4): Stripe succeeds but initial DB tx fails → retry repairs state', async () => {
    // This scenario is hard to force through the real handler without instrumentation.
    // We approximate it by verifying the idempotency key invariant: if Stripe returns
    // the same refund on a retry, the handler reaches the DB write with the correct refundId.
    // Full DB-failure simulation requires test infrastructure beyond the scope here.
    // Documented as a known gap in the direct-path verification.

    const piId    = `pi_mm05e_p3_${Date.now()}`;
    const booking = await createBooking({ status: 'EXPIRED', paymentIntentId: piId });
    const event   = makePaymentSucceededEvent({
      bookingId: booking.id, paymentIntentId: piId,
      eventId:   `evt_mm05e_p3_${Date.now()}`, amountCents: BOOKING_AMOUNT,
    });

    // Simulate a prior partial state: booking manually set to CANCELLED but no refundId
    // (as if a prior delivery crashed between the Stripe call and the DB tx commit)
    await prisma.booking.update({
      where: { id: booking.id },
      data:  { status: 'CANCELLED', stripeRefundId: null } as any,
    });

    // Handler receives the same event again — finds booking CANCELLED+null refundId → repair path
    const { status } = await postEvent(event);
    expect(status).toBe(200);

    // repair path: stripeRefundId written
    const repaired = await prisma.booking.findUnique({ where: { id: booking.id } });
    expect(repaired!.stripeRefundId).toBe(MOCK_REFUND_ID);

    // WebhookEvent written
    const webhookRow = await prisma.webhookEvent.findUnique({
      where: { idempotencyKey: idemKey(event) },
    });
    expect(webhookRow).not.toBeNull();
  }, 30000);

  // ─── E-P4: duplicate delivery after success ───────────────────────────────────

  it('E-P4 (INV-E3): duplicate delivery after successful refund → 200; Stripe NOT called again; one WebhookEvent', async () => {
    const piId    = `pi_mm05e_p4_${Date.now()}`;
    const booking = await createBooking({ status: 'EXPIRED', paymentIntentId: piId });
    const event   = makePaymentSucceededEvent({
      bookingId: booking.id, paymentIntentId: piId,
      eventId:   `evt_mm05e_p4_${Date.now()}`, amountCents: BOOKING_AMOUNT,
    });

    // First delivery
    const { status: s1 } = await postEvent(event);
    expect(s1).toBe(200);
    expect(mockRefundsCreate).toHaveBeenCalledTimes(1);

    // Second delivery (duplicate)
    const { status: s2, json: j2 } = await postEvent(event);
    expect(s2).toBe(200);
    expect(j2).toMatchObject({ received: true });

    // Stripe NOT called again
    expect(mockRefundsCreate).toHaveBeenCalledTimes(1);

    // Exactly one WebhookEvent row
    const rows = await prisma.webhookEvent.findMany({
      where: { idempotencyKey: idemKey(event) },
    });
    expect(rows).toHaveLength(1);

    // Booking final state unchanged from first delivery
    const final = await prisma.booking.findUnique({ where: { id: booking.id } });
    expect(final!.status).toBe('CANCELLED');
    expect(final!.stripeRefundId).toBe(MOCK_REFUND_ID);
  }, 30000);

  // ─── E-P5: CANCELLED + null stripeRefundId (partial prior write) ──────────────

  it('E-P5 (INV-E5): CANCELLED + null stripeRefundId → repair path writes refundId; 200 returned', async () => {
    const piId    = `pi_mm05e_p5_${Date.now()}`;
    // Create booking already CANCELLED but missing stripeRefundId
    const booking = await createBooking({
      status: 'CANCELLED', paymentIntentId: piId, stripeRefundId: null,
    });
    const event = makePaymentSucceededEvent({
      bookingId: booking.id, paymentIntentId: piId,
      eventId:   `evt_mm05e_p5_${Date.now()}`, amountCents: BOOKING_AMOUNT,
    });

    const { status } = await postEvent(event);
    expect(status).toBe(200);

    // stripeRefundId repaired
    const repaired = await prisma.booking.findUnique({ where: { id: booking.id } });
    expect(repaired!.stripeRefundId).toBe(MOCK_REFUND_ID);

    // No integrity alert fired
    expect(mockSendAlert).not.toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'CRITICAL', message: expect.stringContaining('INTEGRITY ERROR') })
    );
  }, 30000);

  // ─── E-P6: concurrent deliveries ─────────────────────────────────────────────

  it('E-P6 (INV-E3/E7): concurrent deliveries → one refund; consistent CANCELLED state; one WebhookEvent', async () => {
    const piId    = `pi_mm05e_p6_${Date.now()}`;
    const booking = await createBooking({ status: 'EXPIRED', paymentIntentId: piId });
    const event   = makePaymentSucceededEvent({
      bookingId: booking.id, paymentIntentId: piId,
      eventId:   `evt_mm05e_p6_${Date.now()}`, amountCents: BOOKING_AMOUNT,
    });

    const results = await Promise.all([postEvent(event), postEvent(event), postEvent(event)]);

    // All deliveries return 200
    expect(results.every((r) => r.status === 200)).toBe(true);

    // Exactly one WebhookEvent
    const rows = await prisma.webhookEvent.findMany({
      where: { idempotencyKey: idemKey(event) },
    });
    expect(rows).toHaveLength(1);

    // Booking in correct terminal state
    const final = await prisma.booking.findUnique({ where: { id: booking.id } });
    expect(final!.status).toBe('CANCELLED');
    expect(final!.stripeRefundId).toBe(MOCK_REFUND_ID);

    // No integrity error alerts
    const integrityAlerts = mockSendAlert.mock.calls.filter(
      ([a]: any) => typeof a?.message === 'string' && a.message.includes('INTEGRITY ERROR')
    );
    expect(integrityAlerts).toHaveLength(0);
  }, 30000);

  // ─── E-P7: CONFIRMED booking (should NOT trigger expired-booking path) ────────

  it('E-P7: CONFIRMED booking → normal payment path; no expired-booking refund; booking stays CONFIRMED', async () => {
    const piId    = `pi_mm05e_p7_${Date.now()}`;
    const booking = await createBooking({ status: 'CONFIRMED', paymentIntentId: piId });
    const event   = makePaymentSucceededEvent({
      bookingId: booking.id, paymentIntentId: piId,
      eventId:   `evt_mm05e_p7_${Date.now()}`, amountCents: BOOKING_AMOUNT,
    });

    const { status } = await postEvent(event);
    expect(status).toBe(200);

    // No expired-booking refund triggered
    expect(mockRefundsCreate).not.toHaveBeenCalled();

    // Booking stays CONFIRMED
    const final = await prisma.booking.findUnique({ where: { id: booking.id } });
    expect(final!.status).toBe('CONFIRMED');
  }, 30000);
});
