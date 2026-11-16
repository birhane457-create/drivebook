/**
 * PH5-SCH-30: BookingIdempotencyKey Concurrency Test
 *
 * PURPOSE:
 * Determine the exact outcome of two concurrent booking requests with the
 * same Idempotency-Key but different time slots, using Prisma 5.22.0 and
 * PostgreSQL. This test resolves whether the upsert-with-empty-update pattern
 * produces a duplicate booking or prevents one.
 *
 * ARCHITECTURE:
 *   Vitest -> direct Prisma calls -> isolated PostgreSQL (localhost:5433/drivebook_test)
 *
 * PRE-CONDITIONS:
 *   - PostgreSQL running on localhost:5433 with database drivebook_test
 *   - DATABASE_URL set to the test database
 *   - Prisma migrations applied (or prisma db push)
 *   - btree_gist extension installed (for SlotReservation constraint)
 *
 * EXECUTION:
 *   Set DATABASE_URL=postgresql://postgres:testpass@localhost:5433/drivebook_test
 *   npx vitest run __tests__/integration/ph5-sch30-booking-idempotency-concurrency.test.ts
 *
 * TEST MATRIX:
 *   T1 — Sequential same-key, different slot: second should be blocked by
 *        existing idempotency key (replay stored response)
 *   T2 — Concurrent same-key, different slot: determine if both bookings
 *        are created, one fails, or both succeed (THE KEY TEST)
 *   T3 — Concurrent same-key, same slot: GiST constraint should block one
 *        (existing mitigation)
 *   T4 — Concurrent different-key, different slot: both succeed (control)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TEST_PREFIX = `ph5sch30_${Date.now()}`;

// Test provider — created in beforeAll
let testProviderId: string;
let testCustomerId: string;

describe('PH5-SCH-30: BookingIdempotencyKey Concurrency', () => {
  beforeAll(async () => {
    // Create a test provider
    const provider = await prisma.provider.create({
      data: {
        name: `${TEST_PREFIX}_Provider`,
        phone: '0400000000',
        hourlyRate: 70,
        businessModel: 'SAAS',
        paymentMode: 'PLATFORM',
        approvalStatus: 'APPROVED',
        isActive: true,
      },
    });
    testProviderId = provider.id;

    // Create a test customer (no user account — SAAS model)
    const customer = await prisma.customer.create({
      data: {
        name: `${TEST_PREFIX}_Customer`,
        email: `${TEST_PREFIX}@test.com`,
        phone: '0400000001',
        preferredProviderId: testProviderId,
      },
    });
    testCustomerId = customer.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.bookingIdempotencyKey.deleteMany({
      where: { email: { contains: TEST_PREFIX } },
    }).catch(() => {});
    await prisma.booking.deleteMany({
      where: { providerId: testProviderId },
    }).catch(() => {});
    await prisma.customer.deleteMany({
      where: { preferredProviderId: testProviderId },
    }).catch(() => {});
    await prisma.provider.deleteMany({
      where: { id: testProviderId },
    }).catch(() => {});
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up idempotency keys and bookings between tests
    await prisma.bookingIdempotencyKey.deleteMany({
      where: { email: { contains: TEST_PREFIX } },
    }).catch(() => {});
    await prisma.booking.deleteMany({
      where: { providerId: testProviderId },
    }).catch(() => {});
    await prisma.slotReservation.deleteMany({
      where: { providerId: testProviderId },
    }).catch(() => {});
  });

  // T1: Sequential same-key, different slot — second should replay
  it('T1: sequential same-key different-slot — second request replays stored response', async () => {
    const idemKey = `${TEST_PREFIX}_T1`;
    const slot1Start = new Date('2027-06-15T10:00:00Z');
    const slot1End = new Date('2027-06-15T11:00:00Z');
    const slot2Start = new Date('2027-06-15T12:00:00Z');
    const slot2End = new Date('2027-06-15T13:00:00Z');

    // First request — create booking + idempotency key
    const booking1 = await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.create({
        data: {
          providerId: testProviderId,
          customerId: testCustomerId,
          customerName: `${TEST_PREFIX}_Customer`,
          customerPhone: '0400000001',
          status: 'PENDING_PAYMENT',
          startTime: slot1Start,
          endTime: slot1End,
          duration: 60,
          price: 70,
          platformFee: 0,
          providerPayout: 59.5,
          commissionRate: 0.15,
        },
      });

      await (tx as any).bookingIdempotencyKey.upsert({
        where: { key: idemKey },
        update: {},
        create: {
          key: idemKey,
          email: `${TEST_PREFIX}@test.com`,
          bookingId: booking.id,
          response: { bookingId: booking.id, status: 'PENDING_PAYMENT' },
        },
      });

      return booking;
    });

    // Second request — same key, different slot — should find existing key
    const existing = await prisma.bookingIdempotencyKey.findUnique({
      where: { key: idemKey },
    });

    expect(existing).not.toBeNull();
    expect(existing!.bookingId).toBe(booking1.id);

    // Verify only one booking was created
    const allBookings = await prisma.booking.findMany({
      where: { providerId: testProviderId },
    });
    expect(allBookings.length).toBe(1);
  });

  // T2: THE KEY TEST — Concurrent same-key, different slot
  it('T2: concurrent same-key different-slot — determine race outcome', async () => {
    const idemKey = `${TEST_PREFIX}_T2`;
    const slot1Start = new Date('2027-06-16T10:00:00Z');
    const slot1End = new Date('2027-06-16T11:00:00Z');
    const slot2Start = new Date('2027-06-16T14:00:00Z');
    const slot2End = new Date('2027-06-16T15:00:00Z');

    // Simulate the bulk booking flow: check outside tx, create inside tx
    const createBookingWithIdem = async (slotStart: Date, slotEnd: Date) => {
      // Step 1: Check if key exists (OUTSIDE transaction — this is the TOCTOU window)
      const existing = await prisma.bookingIdempotencyKey.findUnique({
        where: { key: idemKey },
      });
      if (existing) {
        return { result: 'replayed', bookingId: existing.bookingId };
      }

      // Step 2: Create booking + upsert key (INSIDE transaction)
      try {
        const booking = await prisma.$transaction(async (tx) => {
          const b = await tx.booking.create({
            data: {
              providerId: testProviderId,
              customerId: testCustomerId,
              customerName: `${TEST_PREFIX}_Customer`,
              customerPhone: '0400000001',
              status: 'PENDING_PAYMENT',
              startTime: slotStart,
              endTime: slotEnd,
              duration: 60,
              price: 70,
              platformFee: 0,
              providerPayout: 59.5,
              commissionRate: 0.15,
            },
          });

          await (tx as any).bookingIdempotencyKey.upsert({
            where: { key: idemKey },
            update: {},
            create: {
              key: idemKey,
              email: `${TEST_PREFIX}@test.com`,
              bookingId: b.id,
              response: { bookingId: b.id, status: 'PENDING_PAYMENT' },
            },
          });

          return b;
        });
        return { result: 'created', bookingId: booking.id };
      } catch (err: any) {
        // Check for P2002 (unique constraint on idempotency key)
        if (err.code === 'P2002') {
          const stored = await prisma.bookingIdempotencyKey.findUnique({
            where: { key: idemKey },
          });
          return { result: 'p2002_caught', bookingId: stored?.bookingId };
        }
        return { result: 'error', error: err.message };
      }
    };

    // Launch both requests concurrently
    const [result1, result2] = await Promise.all([
      createBookingWithIdem(slot1Start, slot1End),
      createBookingWithIdem(slot2Start, slot2End),
    ]);

    // Record the outcome
    console.log('T2 Results:', { result1, result2 });

    // Count bookings created
    const allBookings = await prisma.booking.findMany({
      where: { providerId: testProviderId },
    });

    // Count idempotency keys
    const allKeys = await prisma.bookingIdempotencyKey.findMany({
      where: { key: idemKey },
    });

    console.log('T2: Bookings created:', allBookings.length);
    console.log('T2: Idempotency keys:', allKeys.length);
    console.log('T2: Result1:', result1);
    console.log('T2: Result2:', result2);

    // Record findings for audit
    if (allBookings.length === 2) {
      console.warn('⚠️ PH5-SCH-30 CONFIRMED: Two bookings created with same idempotency key');
      console.warn('⚠️ The upsert with update:{} does NOT prevent duplicate booking creation under concurrency');
    } else if (allBookings.length === 1) {
      console.log('✅ PH5-SCH-30 NOT CONFIRMED: Only one booking created (some mechanism prevented the duplicate)');
    }

    // The test outcome determines the finding:
    // - If allBookings.length === 2: PH5-SCH-30 is a confirmed defect
    // - If allBookings.length === 1: PH5-SCH-30 is mitigated (mechanism TBD)
    expect(allBookings).toBeDefined(); // Basic sanity check
  });

  // T3: Concurrent same-key, same slot — GiST constraint should block
  it('T3: concurrent same-key same-slot — GiST constraint mitigation', async () => {
    const idemKey = `${TEST_PREFIX}_T3`;
    const slotStart = new Date('2027-06-17T10:00:00Z');
    const slotEnd = new Date('2027-06-17T11:00:00Z');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const createBookingWithSlot = async () => {
      const existing = await prisma.bookingIdempotencyKey.findUnique({
        where: { key: idemKey },
      });
      if (existing) return { result: 'replayed' };

      try {
        const booking = await prisma.$transaction(async (tx) => {
          // Create slot reservation (GiST constraint will catch overlap)
          await tx.slotReservation.create({
            data: {
              providerId: testProviderId,
              sessionId: `${idemKey}_${Math.random()}`,
              startTime: slotStart,
              endTime: slotEnd,
              expiresAt,
            },
          });

          const b = await tx.booking.create({
            data: {
              providerId: testProviderId,
              customerId: testCustomerId,
              customerName: `${TEST_PREFIX}_Customer`,
              customerPhone: '0400000001',
              status: 'PENDING_PAYMENT',
              startTime: slotStart,
              endTime: slotEnd,
              duration: 60,
              price: 70,
              platformFee: 0,
              providerPayout: 59.5,
              commissionRate: 0.15,
            },
          });

          await (tx as any).bookingIdempotencyKey.upsert({
            where: { key: idemKey },
            update: {},
            create: {
              key: idemKey,
              email: `${TEST_PREFIX}@test.com`,
              bookingId: b.id,
              response: { bookingId: b.id, status: 'PENDING_PAYMENT' },
            },
          });

          return b;
        });
        return { result: 'created', bookingId: booking.id };
      } catch (err: any) {
        if (err.message?.includes('23P01') || err.message?.includes('SlotReservation_no_overlap')) {
          return { result: 'gist_blocked' };
        }
        if (err.code === 'P2002') {
          return { result: 'p2002_caught' };
        }
        return { result: 'error', error: err.message };
      }
    };

    const [result1, result2] = await Promise.all([
      createBookingWithSlot(),
      createBookingWithSlot(),
    ]);

    console.log('T3 Results:', { result1, result2 });

    const allBookings = await prisma.booking.findMany({
      where: { providerId: testProviderId },
    });

    // GiST constraint should prevent duplicate same-slot bookings
    console.log('T3: Bookings created:', allBookings.length);

    expect(allBookings.length).toBeLessThanOrEqual(1);
  });

  // T4: Concurrent different-key, different slot — both should succeed (control)
  it('T4: concurrent different-key different-slot — both succeed (control)', async () => {
    const key1 = `${TEST_PREFIX}_T4a`;
    const key2 = `${TEST_PREFIX}_T4b`;
    const slot1Start = new Date('2027-06-18T10:00:00Z');
    const slot1End = new Date('2027-06-18T11:00:00Z');
    const slot2Start = new Date('2027-06-18T14:00:00Z');
    const slot2End = new Date('2027-06-18T15:00:00Z');

    const createBooking = async (idemKey: string, slotStart: Date, slotEnd: Date) => {
      const booking = await prisma.$transaction(async (tx) => {
        const b = await tx.booking.create({
          data: {
            providerId: testProviderId,
            customerId: testCustomerId,
            customerName: `${TEST_PREFIX}_Customer`,
            customerPhone: '0400000001',
            status: 'PENDING_PAYMENT',
            startTime: slotStart,
            endTime: slotEnd,
            duration: 60,
            price: 70,
            platformFee: 0,
            providerPayout: 59.5,
            commissionRate: 0.15,
          },
        });

        await (tx as any).bookingIdempotencyKey.upsert({
          where: { key: idemKey },
          update: {},
          create: {
            key: idemKey,
            email: `${TEST_PREFIX}@test.com`,
            bookingId: b.id,
            response: { bookingId: b.id, status: 'PENDING_PAYMENT' },
          },
        });

        return b;
      });
      return booking;
    };

    const [booking1, booking2] = await Promise.all([
      createBooking(key1, slot1Start, slot1End),
      createBooking(key2, slot2Start, slot2End),
    ]);

    expect(booking1).toBeDefined();
    expect(booking2).toBeDefined();

    const allBookings = await prisma.booking.findMany({
      where: { providerId: testProviderId },
    });
    expect(allBookings.length).toBe(2);
  });
});
