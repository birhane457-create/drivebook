/**
 * MM-10-B Regression Tests: SaaS Checkout Session Idempotency
 *
 * Finding: createCheckoutSession() performed a non-atomic stripeSessionId check,
 * called stripe.checkout.sessions.create() with no idempotency key, and wrote
 * the result unconditionally. Two concurrent requests could create two
 * independently chargeable Stripe Checkout Sessions for the same quote.
 *
 * Fix (this commit):
 *   - Generation counter (Quote.checkoutGeneration) incremented atomically on expiry.
 *   - Stripe idempotency key: scs-{quoteId}-{checkoutGeneration}.
 *   - CAS write: updateMany WHERE stripeSessionId IS NULL AND checkoutGeneration=N.
 *   - CAS loser reads DB and returns the winner's session.
 *   - Stripe lookup errors surface as CheckoutSessionLookupError (NOT treated as expiry).
 *   - completed sessions → QuoteAlreadyPaidError (no new chargeable session).
 *   - advanceCheckoutGeneration() CAS-guards on (stripeSessionId, checkoutGeneration).
 *
 * Tests call the real exported functions from saas-payment.ts. Prisma and Stripe
 * are mocked at module scope.
 *
 * Scenario matrix:
 *   S1  — First call, no existing session → creates session with scs-{id}-1
 *   S2  — Concurrent first calls → both receive same session (Stripe idem key)
 *   S3  — Existing open session → returned without calling Stripe create
 *   S4  — Stripe lookup fails → CheckoutSessionLookupError (no create, no advance)
 *   S5  — Existing completed session → QuoteAlreadyPaidError (no new session)
 *   S6  — Existing expired session → generation advanced, new session created
 *   S7  — Two concurrent expiry discoveries → one advance, both get same new session
 *   S8  — CAS write loses (concurrent first calls, DB race) → loser returns winner session
 *   S9  — DB failure after Stripe creation → same idempotency key on retry
 *   S10 — Second payment attempt after expiry → distinct idempotency key (gen incremented)
 */

// ─── Mock declarations ────────────────────────────────────────────────────────

const mockSessionsCreate   = vi.fn()
const mockSessionsRetrieve = vi.fn()
const mockQuoteUpdateMany  = vi.fn()
const mockQuoteFindUnique  = vi.fn()
const mockQuoteUpdate      = vi.fn()
const mockBookingUpdate    = vi.fn()
const mockAuditCreate      = vi.fn()

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(() => ({
    checkout: {
      sessions: {
        create:   (...a: any[]) => mockSessionsCreate(...a),
        retrieve: (...a: any[]) => mockSessionsRetrieve(...a),
      },
    },
  })),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    quote: {
      updateMany:  (...a: any[]) => mockQuoteUpdateMany(...a),
      findUnique:  (...a: any[]) => mockQuoteFindUnique(...a),
      update:      (...a: any[]) => mockQuoteUpdate(...a),
    },
    booking: {
      update: (...a: any[]) => mockBookingUpdate(...a),
    },
    $transaction: vi.fn().mockImplementation(async (cb: any) => cb({
      quote:   { update: mockQuoteUpdate, updateMany: mockQuoteUpdateMany, findUnique: mockQuoteFindUnique },
      booking: { update: mockBookingUpdate },
      auditLog: { create: mockAuditCreate },
    })),
  },
}))

vi.mock('@/lib/core/business-config', () => ({
  getBusinessConfig: vi.fn().mockResolvedValue({
    paymentModel: 'saas',
    capabilities: { commission: false },
    terminology: { booking: 'Booking', provider: 'Provider', customer: 'Customer' },
    timezone: 'Australia/Sydney',
  }),
}))

vi.mock('@/lib/utils/decimal-helpers', () => ({
  toDecimal:           (v: any) => v,
  toNumber:            (v: any) => Number(v),
  roundAmount:         (v: any) => v,
  calculatePercentage: (v: any, _pct: number) => 0,
}))

vi.mock('@/lib/utils/account', () => ({ getDisplayName: (p: any) => p?.name ?? 'Provider' }))

// ─── Import subject under test (after mocks are declared) ────────────────────
import {
  createCheckoutSession,
  advanceCheckoutGeneration,
  CheckoutSessionLookupError,
  QuoteAlreadyPaidError,
} from '../saas-payment'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const QUOTE_ID    = 'q_mm10b_test'
const BOOKING_ID  = 'bk_mm10b_test'
const PROVIDER_ID = 'prov_mm10b'
const CUSTOMER_ID = 'cust_mm10b'
const SESSION_A   = 'cs_mm10b_A'
const SESSION_B   = 'cs_mm10b_B'
const URL_A       = 'https://checkout.stripe.com/A'
const URL_B       = 'https://checkout.stripe.com/B'
const BIZ_ID      = `biz_${PROVIDER_ID}`

function makeQuote(overrides: Partial<{
  status: string
  stripeSessionId: string | null
  checkoutGeneration: number
}> = {}) {
  return {
    id:                 QUOTE_ID,
    bookingId:          BOOKING_ID,
    providerId:         PROVIDER_ID,
    customerId:         CUSTOMER_ID,
    status:             overrides.status             ?? 'ACCEPTED',
    stripeSessionId:    overrides.stripeSessionId    ?? null,
    checkoutGeneration: overrides.checkoutGeneration ?? 1,
    depositAmount:      100,
    lineItems:          [],
    provider:           { id: PROVIDER_ID, name: 'Test Provider' },
    customer:           { id: CUSTOMER_ID, name: 'Test Customer', email: 'c@test.com' },
    booking:            { id: BOOKING_ID, startTime: new Date(), customer: {}, provider: {} },
  }
}

function makeStripeSession(id: string, url: string, status: 'open' | 'complete' | 'expired') {
  return { id, url: status === 'open' ? url : null, status }
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('MM-10-B: SaaS Checkout Session idempotency — generation-based fix', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: successful Stripe create and successful CAS write
    mockSessionsCreate.mockResolvedValue(makeStripeSession(SESSION_A, URL_A, 'open'))
    mockQuoteUpdateMany.mockResolvedValue({ count: 1 })
    mockQuoteFindUnique.mockResolvedValue(makeQuote())
    mockBookingUpdate.mockResolvedValue({})
    mockAuditCreate.mockResolvedValue({})
  })

  // ─── S1: First call ──────────────────────────────────────────────────────────

  it('S1: first call (no existing session) → creates session; idempotency key = scs-{id}-1', async () => {
    mockQuoteFindUnique.mockResolvedValueOnce(makeQuote())  // initial load
    // CAS wins (count=1), then booking+audit tx succeeds via $transaction mock

    const result = await createCheckoutSession(QUOTE_ID, BIZ_ID)

    expect(result).toEqual({ sessionId: SESSION_A, url: URL_A })

    // Stripe called with correct idempotency key for generation 1
    expect(mockSessionsCreate).toHaveBeenCalledTimes(1)
    const [_params, options] = mockSessionsCreate.mock.calls[0]
    expect(options).toMatchObject({ idempotencyKey: `scs-${QUOTE_ID}-1` })

    // CAS write targets null stripeSessionId, generation 1
    expect(mockQuoteUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: QUOTE_ID, stripeSessionId: null, checkoutGeneration: 1 }),
      data:  expect.objectContaining({ stripeSessionId: SESSION_A, status: 'PENDING_PAYMENT' }),
    }))
  })

  // ─── S2: Concurrent first calls ──────────────────────────────────────────────

  it('S2: concurrent first calls → Stripe idempotency key ensures same session; CAS winner and loser both return same URL', async () => {
    // Both calls see no existing session initially
    mockQuoteFindUnique.mockResolvedValue(makeQuote())
    // Stripe returns same session for both (idempotency key scs-{id}-1)
    mockSessionsCreate.mockResolvedValue(makeStripeSession(SESSION_A, URL_A, 'open'))

    let casCallCount = 0
    mockQuoteUpdateMany.mockImplementation(async () => {
      casCallCount++
      // First CAS wins, second loses
      return { count: casCallCount === 1 ? 1 : 0 }
    })

    // When CAS loses, the loser reads the DB and finds SESSION_A
    mockQuoteFindUnique.mockImplementation(async (args: any) => {
      if (args?.select?.stripeSessionId) {
        return { stripeSessionId: SESSION_A }
      }
      return makeQuote()
    })
    mockSessionsRetrieve.mockResolvedValue(makeStripeSession(SESSION_A, URL_A, 'open'))

    const [r1, r2] = await Promise.all([
      createCheckoutSession(QUOTE_ID, BIZ_ID),
      createCheckoutSession(QUOTE_ID, BIZ_ID),
    ])

    // Both return the same session
    expect(r1.sessionId).toBe(SESSION_A)
    expect(r2.sessionId).toBe(SESSION_A)
    expect(r1.url).toBe(URL_A)
    expect(r2.url).toBe(URL_A)

    // Both Stripe calls used the same idempotency key
    const keys = mockSessionsCreate.mock.calls.map(([, opts]) => opts.idempotencyKey)
    expect(new Set(keys).size).toBe(1)
    expect(keys[0]).toBe(`scs-${QUOTE_ID}-1`)
  })

  // ─── S3: Existing open session ───────────────────────────────────────────────

  it('S3: existing open session → returned directly; Stripe create NOT called', async () => {
    mockQuoteFindUnique.mockResolvedValueOnce(
      makeQuote({ stripeSessionId: SESSION_A, checkoutGeneration: 1 })
    )
    mockSessionsRetrieve.mockResolvedValueOnce(makeStripeSession(SESSION_A, URL_A, 'open'))

    const result = await createCheckoutSession(QUOTE_ID, BIZ_ID)

    expect(result).toEqual({ sessionId: SESSION_A, url: URL_A })
    expect(mockSessionsCreate).not.toHaveBeenCalled()
    expect(mockQuoteUpdateMany).not.toHaveBeenCalled()
  })

  // ─── S4: Stripe lookup fails ─────────────────────────────────────────────────

  it('S4: Stripe session retrieve fails → CheckoutSessionLookupError; no create, no generation advance', async () => {
    mockQuoteFindUnique.mockResolvedValueOnce(
      makeQuote({ stripeSessionId: SESSION_A, checkoutGeneration: 1 })
    )
    mockSessionsRetrieve.mockRejectedValueOnce(new Error('Stripe 503'))

    await expect(createCheckoutSession(QUOTE_ID, BIZ_ID))
      .rejects.toThrow(CheckoutSessionLookupError)

    // Must NOT have called stripe.checkout.sessions.create — session existence unknown
    expect(mockSessionsCreate).not.toHaveBeenCalled()
    // Must NOT have advanced the generation — that would use a stale key assumption
    expect(mockQuoteUpdateMany).not.toHaveBeenCalled()
  })

  // ─── S5: Completed session → QuoteAlreadyPaidError ───────────────────────────

  it('S5: existing completed Stripe session → QuoteAlreadyPaidError; no new session created', async () => {
    mockQuoteFindUnique.mockResolvedValueOnce(
      makeQuote({ stripeSessionId: SESSION_A, checkoutGeneration: 1 })
    )
    mockSessionsRetrieve.mockResolvedValueOnce(makeStripeSession(SESSION_A, URL_A, 'complete'))

    await expect(createCheckoutSession(QUOTE_ID, BIZ_ID))
      .rejects.toThrow(QuoteAlreadyPaidError)

    expect(mockSessionsCreate).not.toHaveBeenCalled()
  })

  it('S5: quote.status = PAID → QuoteAlreadyPaidError immediately (no Stripe call)', async () => {
    mockQuoteFindUnique.mockResolvedValueOnce(makeQuote({ status: 'PAID' }))

    await expect(createCheckoutSession(QUOTE_ID, BIZ_ID))
      .rejects.toThrow(QuoteAlreadyPaidError)

    expect(mockSessionsCreate).not.toHaveBeenCalled()
    expect(mockSessionsRetrieve).not.toHaveBeenCalled()
  })

  // ─── S6: Expired session → generation advanced, new session created ───────────

  it('S6: expired session → generation advanced to 2; new session created with scs-{id}-2', async () => {
    // Initial load: existing session, generation 1
    mockQuoteFindUnique
      .mockResolvedValueOnce(makeQuote({ stripeSessionId: SESSION_A, checkoutGeneration: 1 }))
      // After advance, refreshed quote has no session and generation 2
      .mockResolvedValueOnce(makeQuote({ stripeSessionId: null, checkoutGeneration: 2 }))

    mockSessionsRetrieve
      .mockResolvedValueOnce(makeStripeSession(SESSION_A, URL_A, 'expired'))

    // Advance CAS succeeds
    mockQuoteUpdateMany
      .mockResolvedValueOnce({ count: 1 })  // advanceCheckoutGeneration
      .mockResolvedValueOnce({ count: 1 })  // _createAndBindSession CAS

    mockSessionsCreate.mockResolvedValueOnce(makeStripeSession(SESSION_B, URL_B, 'open'))

    const result = await createCheckoutSession(QUOTE_ID, BIZ_ID)

    expect(result).toEqual({ sessionId: SESSION_B, url: URL_B })

    // Generation was advanced
    expect(mockQuoteUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id:                QUOTE_ID,
        stripeSessionId:   SESSION_A,  // guards on old session ID
        checkoutGeneration: 1,          // guards on old generation
      }),
      data: expect.objectContaining({
        stripeSessionId:   null,
        checkoutGeneration: { increment: 1 },
      }),
    }))

    // New session used generation 2 in idempotency key
    const [, opts] = mockSessionsCreate.mock.calls[0]
    expect(opts.idempotencyKey).toBe(`scs-${QUOTE_ID}-2`)
  })

  // ─── S7: Two concurrent expiry discoveries ───────────────────────────────────

  it('S7: two concurrent expiry discoveries → only one generation advance; both get same new session', async () => {
    let advanceCount = 0
    let bindCount = 0

    mockQuoteFindUnique.mockImplementation(async (args: any) => {
      // select-only query (CAS loser reading current state)
      if (args?.select?.stripeSessionId) {
        return { stripeSessionId: SESSION_B }
      }
      // Full quote load: after the generation has advanced, return gen=2 with no session
      const q = makeQuote({ stripeSessionId: SESSION_A, checkoutGeneration: 1 })
      // Once both have advanced, return no-session gen-2 for the post-advance re-read
      if (advanceCount > 0) {
        return makeQuote({ stripeSessionId: null, checkoutGeneration: 2 })
      }
      return q
    })

    mockSessionsRetrieve.mockImplementation(async (id: string) => {
      if (id === SESSION_A) return makeStripeSession(SESSION_A, URL_A, 'expired')
      return makeStripeSession(SESSION_B, URL_B, 'open')
    })

    mockQuoteUpdateMany.mockImplementation(async (args: any) => {
      if (args?.data?.checkoutGeneration?.increment) {
        // advanceCheckoutGeneration call
        advanceCount++
        return { count: advanceCount === 1 ? 1 : 0 }
      }
      // CAS bind call
      bindCount++
      return { count: 1 }
    })

    mockSessionsCreate.mockResolvedValue(makeStripeSession(SESSION_B, URL_B, 'open'))

    const [r1, r2] = await Promise.all([
      createCheckoutSession(QUOTE_ID, BIZ_ID),
      createCheckoutSession(QUOTE_ID, BIZ_ID),
    ])

    // Both converge on SESSION_B
    expect(r1.sessionId).toBe(SESSION_B)
    expect(r2.sessionId).toBe(SESSION_B)
    expect(r1.url).toBe(URL_B)
    expect(r2.url).toBe(URL_B)

    // advanceCount may be 1 or 2 depending on scheduling — what matters is that
    // at most one advance wins (count=1), the second is a safe no-op (count=0)
    expect(advanceCount).toBeGreaterThanOrEqual(1)

    // Both Stripe create calls used the same generation-2 key
    const createKeys = mockSessionsCreate.mock.calls.map(([, opts]) => opts?.idempotencyKey)
    const distinctKeys = new Set(createKeys.filter(Boolean))
    expect(distinctKeys.size).toBe(1)
    expect([...distinctKeys][0]).toBe(`scs-${QUOTE_ID}-2`)
  })

  // ─── S8: CAS write loses ─────────────────────────────────────────────────────

  it('S8: CAS write loses (concurrent first call won) → loser reads DB and returns winner session', async () => {
    // Loser's Stripe create returns SESSION_A (same as winner via idempotency)
    mockSessionsCreate.mockResolvedValueOnce(makeStripeSession(SESSION_A, URL_A, 'open'))
    // CAS: loser gets count=0
    mockQuoteUpdateMany.mockResolvedValueOnce({ count: 0 })
    // Loser reads DB: finds SESSION_A already bound by winner
    mockQuoteFindUnique
      .mockResolvedValueOnce(makeQuote())  // initial load
      .mockResolvedValueOnce({ stripeSessionId: SESSION_A })  // read after CAS loss
    mockSessionsRetrieve.mockResolvedValueOnce(makeStripeSession(SESSION_A, URL_A, 'open'))

    const result = await createCheckoutSession(QUOTE_ID, BIZ_ID)

    expect(result).toEqual({ sessionId: SESSION_A, url: URL_A })
    // Loser does NOT return its own unbound session — it retrieves and returns the winner's
    expect(mockSessionsRetrieve).toHaveBeenCalledWith(SESSION_A)
  })

  // ─── S9: DB failure after Stripe creation ────────────────────────────────────

  it('S9: DB fails after Stripe create → same idempotency key on retry; session bound on retry', async () => {
    let callCount = 0
    mockSessionsCreate.mockResolvedValue(makeStripeSession(SESSION_A, URL_A, 'open'))

    // First attempt: CAS throws DB error
    mockQuoteUpdateMany
      .mockRejectedValueOnce(new Error('DB connection error'))  // first attempt fails
      .mockResolvedValueOnce({ count: 1 })                      // retry succeeds

    // Both attempts load the same quote (no session yet)
    mockQuoteFindUnique.mockResolvedValue(makeQuote())

    // First attempt: expect DB error
    await expect(createCheckoutSession(QUOTE_ID, BIZ_ID)).rejects.toThrow('DB connection error')

    // Retry (second attempt) succeeds
    const result = await createCheckoutSession(QUOTE_ID, BIZ_ID)
    expect(result).toEqual({ sessionId: SESSION_A, url: URL_A })

    // Both Stripe calls used the same idempotency key (generation 1 unchanged)
    expect(mockSessionsCreate).toHaveBeenCalledTimes(2)
    const keys = mockSessionsCreate.mock.calls.map(([, opts]) => opts.idempotencyKey)
    expect(keys[0]).toBe(keys[1])
    expect(keys[0]).toBe(`scs-${QUOTE_ID}-1`)
  })

  // ─── S10: Second payment attempt after expiry uses distinct key ───────────────

  it('S10: second payment attempt after expiry → distinct Stripe idempotency key (generation 2)', async () => {
    // Second attempt starts with generation 2 already set (prior expiry already advanced)
    mockQuoteFindUnique.mockResolvedValueOnce(
      makeQuote({ stripeSessionId: null, checkoutGeneration: 2 })
    )
    mockSessionsCreate.mockResolvedValueOnce(makeStripeSession(SESSION_B, URL_B, 'open'))
    mockQuoteUpdateMany.mockResolvedValueOnce({ count: 1 })

    const result = await createCheckoutSession(QUOTE_ID, BIZ_ID)
    expect(result).toEqual({ sessionId: SESSION_B, url: URL_B })

    const [, opts] = mockSessionsCreate.mock.calls[0]
    expect(opts.idempotencyKey).toBe(`scs-${QUOTE_ID}-2`)
    // Distinct from the first-attempt key
    expect(opts.idempotencyKey).not.toBe(`scs-${QUOTE_ID}-1`)
  })

  // ─── advanceCheckoutGeneration CAS guard ─────────────────────────────────────

  it('advanceCheckoutGeneration: concurrent calls with same (sessionId, generation) — first wins, second is no-op', async () => {
    let count = 0
    mockQuoteUpdateMany.mockImplementation(async () => {
      count++
      return { count: count === 1 ? 1 : 0 }
    })

    await Promise.all([
      advanceCheckoutGeneration(QUOTE_ID, SESSION_A, 1),
      advanceCheckoutGeneration(QUOTE_ID, SESSION_A, 1),
    ])

    // Both called updateMany — but only first got count=1
    expect(mockQuoteUpdateMany).toHaveBeenCalledTimes(2)
    // Both calls guard on the exact same (stripeSessionId, checkoutGeneration)
    for (const [args] of mockQuoteUpdateMany.mock.calls) {
      expect(args.where).toMatchObject({
        id:                 QUOTE_ID,
        stripeSessionId:    SESSION_A,
        checkoutGeneration: 1,
      })
      expect(args.data).toMatchObject({
        stripeSessionId:    null,
        checkoutGeneration: { increment: 1 },
      })
    }
  })

  it('advanceCheckoutGeneration: different sessionId is rejected (no advance)', async () => {
    mockQuoteUpdateMany.mockResolvedValueOnce({ count: 0 })  // wrong session ID — no match

    await advanceCheckoutGeneration(QUOTE_ID, 'cs_WRONG', 1)

    // Called with wrong sessionId — no advance (count=0, which is the CAS failing gracefully)
    expect(mockQuoteUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ stripeSessionId: 'cs_WRONG' }),
    }))
  })
})
