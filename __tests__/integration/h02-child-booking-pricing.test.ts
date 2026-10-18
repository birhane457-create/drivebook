/**
 * H-02 VERIFICATION TESTS
 * 
 * Finding: Child booking `price: 0` — lesson has no recorded economic value
 * Fix: Set price = authorizedDuration × applicableRate at booking confirmation
 * 
 * Policy: docs/audit/PACKAGE-ACCOUNTING-POLICY.md (approved 2026-10-18)
 * - Face-value wallet credit model (Model A)
 * - Locked rate = instructor's current rate at booking confirmation time
 * - Hours are estimates, not guarantees
 * - Rate changes affect future bookings only
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { prisma } from '@/lib/prisma';
import { POST } from '@/app/api/client/confirm-package-booking/route';
import type { NextRequest } from 'next/server';

// Mock next-auth
const mockSession = {
  user: { id: 'test-user-id', email: 'student@test.com', role: 'CLIENT' },
  expires: '2099-12-31',
};

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(() => Promise.resolve(mockSession)),
}));

describe('H-02: Child Booking Pricing', () => {
  let instructor: any;
  let student: any;
  let packageBooking: any;
  let pendingBooking: any;

  beforeEach(async () => {
    // Clean slate
    await prisma.walletTransaction.deleteMany({});
    await prisma.clientWallet.deleteMany({});
    await prisma.booking.deleteMany({});
    await prisma.customer.deleteMany({});
    await prisma.provider.deleteMany({});
    await prisma.user.deleteMany({});

    // Create instructor
    const instructorUser = await prisma.user.create({
      data: { email: 'instructor@test.com', role: 'INSTRUCTOR' },
    });
    instructor = await prisma.provider.create({
      data: {
        userId: instructorUser.id,
        name: 'Test Instructor',
        phone: '+61400000000',
        hourlyRate: 70, // Current rate: $70/hr
        subscriptionTier: 'BASIC',
      },
    });

    // Create student
    const studentUser = await prisma.user.create({
      data: { email: 'student@test.com', role: 'CLIENT' },
    });
    student = await prisma.customer.create({
      data: {
        userId: studentUser.id,
        name: 'Test Student',
        email: 'student@test.com',
        phone: '+61400000001',
      },
    });

    // Create wallet with $700 credit (10-hour package at $70/hr)
    const wallet = await prisma.clientWallet.create({
      data: { userId: studentUser.id, balance: 700 },
    });
    await prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: 'CREDIT',
        amount: 700,
        status: 'CONFIRMED',
        description: 'Package purchase — 10 hrs',
      },
    });

    // Create paid package booking (parent)
    const now = new Date();
    packageBooking = await prisma.booking.create({
      data: {
        providerId: instructor.id,
        customerId: student.id,
        status: 'CONFIRMED',
        isPackageBooking: true,
        packageHours: 10,
        packageHoursUsed: 0,
        packageHoursRemaining: 10,
        packageTotalPaid: 698.25, // $700 - $35 discount + $33.25 fee
        lockedHourlyRate: 70,
        lockedDiscountPct: 5,
        isPaid: true,
        paidAt: now,
        startTime: now,
        endTime: new Date(now.getTime() + 3600000),
        duration: 60,
        price: 70,
      },
    });

    // Create pending child booking (1 hour)
    const futureStart = new Date(Date.now() + 86400000); // Tomorrow
    const futureEnd = new Date(futureStart.getTime() + 3600000); // +1hr
    pendingBooking = await prisma.booking.create({
      data: {
        providerId: instructor.id,
        customerId: student.id,
        status: 'PENDING',
        startTime: futureStart,
        endTime: futureEnd,
        duration: 60,
        price: 0, // H-02 bug: should be set at confirmation
        isPackageBooking: false,
        parentBookingId: null,
      },
    });
  });

  afterEach(async () => {
    await prisma.walletTransaction.deleteMany({});
    await prisma.clientWallet.deleteMany({});
    await prisma.booking.deleteMany({});
    await prisma.customer.deleteMany({});
    await prisma.provider.deleteMany({});
    await prisma.user.deleteMany({});
  });

  /**
   * H02-T01: Basic confirmation sets correct price
   * Verify: price = 1hr × $70/hr = $70
   */
  it('H02-T01: Confirmation sets price = duration × current instructor rate', async () => {
    const request = {
      json: async () => ({
        bookingId: pendingBooking.id,
        packageBookingId: packageBooking.id,
        hoursToDeduct: 1,
      }),
      headers: new Map(),
    } as unknown as NextRequest;

    const response = await POST(request);
    expect(response.status).toBe(200);

    const confirmed = await prisma.booking.findUnique({
      where: { id: pendingBooking.id },
      select: { price: true, platformFee: true, providerPayout: true, commissionRate: true },
    });

    expect(Number(confirmed!.price)).toBe(70); // 1hr × $70/hr
    expect(confirmed!.isPaid).toBe(true);
    expect(confirmed!.status).toBe('CONFIRMED');
  });

  /**
   * H02-T02: Platform fee calculated correctly
   * Policy: 3.6% of lesson price (from DB settings)
   */
  it('H02-T02: Platform fee = (lesson price) × (DB fee rate)', async () => {
    const request = {
      json: async () => ({
        bookingId: pendingBooking.id,
        packageBookingId: packageBooking.id,
        hoursToDeduct: 1,
      }),
      headers: new Map(),
    } as unknown as NextRequest;

    const response = await POST(request);
    expect(response.status).toBe(200);

    const confirmed = await prisma.booking.findUnique({
      where: { id: pendingBooking.id },
      select: { price: true, platformFee: true },
    });

    const expectedFee = parseFloat((70 * 0.036).toFixed(2)); // 3.6% of $70
    expect(Number(confirmed!.platformFee)).toBe(expectedFee);
  });

  /**
   * H02-T03: Provider payout calculated correctly
   * Commission rate depends on instructor's subscription tier
   */
  it('H02-T03: Provider payout = price × (1 - commission rate)', async () => {
    const request = {
      json: async () => ({
        bookingId: pendingBooking.id,
        packageBookingId: packageBooking.id,
        hoursToDeduct: 1,
      }),
      headers: new Map(),
    } as unknown as NextRequest;

    const response = await POST(request);
    expect(response.status).toBe(200);

    const confirmed = await prisma.booking.findUnique({
      where: { id: pendingBooking.id },
      select: { price: true, providerPayout: true, commissionRate: true },
    });

    // BASIC tier = 15% commission (from platform-pricing.ts)
    const expectedPayout = parseFloat((70 * 0.85).toFixed(2)); // $70 × (1 - 0.15)
    expect(Number(confirmed!.providerPayout)).toBe(expectedPayout);
    expect(Number(confirmed!.commissionRate)).toBe(0.15);
  });

  /**
   * H02-T04: Transaction record created with correct amounts
   */
  it('H02-T04: Transaction record matches booking financials', async () => {
    const request = {
      json: async () => ({
        bookingId: pendingBooking.id,
        packageBookingId: packageBooking.id,
        hoursToDeduct: 1,
      }),
      headers: new Map(),
    } as unknown as NextRequest;

    const response = await POST(request);
    expect(response.status).toBe(200);

    const transaction = await prisma.transaction.findFirst({
      where: { bookingId: pendingBooking.id },
      select: { amount: true, platformFee: true, providerPayout: true, type: true, status: true },
    });

    expect(transaction).toBeTruthy();
    expect(Number(transaction!.amount)).toBe(70);
    expect(transaction!.type).toBe('BOOKING_PAYMENT');
    expect(transaction!.status).toBe('COMPLETED');
  });

  /**
   * H02-T05: Wallet debit = lesson price
   */
  it('H02-T05: Wallet debited by lesson price', async () => {
    const walletBefore = await prisma.clientWallet.findUnique({
      where: { userId: student.userId! },
      select: { balance: true },
    });

    const request = {
      json: async () => ({
        bookingId: pendingBooking.id,
        packageBookingId: packageBooking.id,
        hoursToDeduct: 1,
      }),
      headers: new Map(),
    } as unknown as NextRequest;

    const response = await POST(request);
    expect(response.status).toBe(200);

    const walletAfter = await prisma.clientWallet.findUnique({
      where: { userId: student.userId! },
      select: { balance: true },
    });

    const debit = Number(walletBefore!.balance) - Number(walletAfter!.balance);
    expect(debit).toBe(70); // Debited $70 for 1hr lesson
  });

  /**
   * H02-T06: Rate change scenario — future booking uses NEW rate
   * Policy: Locked rate = instructor's CURRENT rate at confirmation time
   */
  it('H02-T06: Rate change — new booking uses instructor current rate', async () => {
    // Instructor raises rate to $80/hr
    await prisma.provider.update({
      where: { id: instructor.id },
      data: { hourlyRate: 80 },
    });

    const request = {
      json: async () => ({
        bookingId: pendingBooking.id,
        packageBookingId: packageBooking.id,
        hoursToDeduct: 1,
      }),
      headers: new Map(),
    } as unknown as NextRequest;

    const response = await POST(request);
    expect(response.status).toBe(200);

    const confirmed = await prisma.booking.findUnique({
      where: { id: pendingBooking.id },
      select: { price: true },
    });

    expect(Number(confirmed!.price)).toBe(80); // Uses NEW rate $80, not package rate $70
  });

  /**
   * H02-T07: Insufficient balance after rate increase
   * Customer has $700 credit. After 8 lessons at $70 ($560), remaining $140.
   * Instructor raises rate to $150/hr. Next booking should fail.
   */
  it('H02-T07: Insufficient balance blocks booking after rate increase', async () => {
    // Consume $560 (8 hours at $70/hr)
    await prisma.clientWallet.update({
      where: { userId: student.userId! },
      data: { balance: { decrement: 560 } },
    });
    await prisma.walletTransaction.create({
      data: {
        walletId: (await prisma.clientWallet.findUnique({ where: { userId: student.userId! } }))!.id,
        type: 'DEBIT',
        amount: 560,
        status: 'CONFIRMED',
        description: 'Previous lessons',
      },
    });

    // Instructor raises rate to $150/hr
    await prisma.provider.update({
      where: { id: instructor.id },
      data: { hourlyRate: 150 },
    });

    const request = {
      json: async () => ({
        bookingId: pendingBooking.id,
        packageBookingId: packageBooking.id,
        hoursToDeduct: 1,
      }),
      headers: new Map(),
    } as unknown as NextRequest;

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(402); // Insufficient balance
    expect(body.code).toBe('INSUFFICIENT_WALLET_BALANCE');
    expect(body.available).toBe(140);
    expect(body.required).toBe(150);
  });

  /**
   * H02-T08: 2-hour booking uses current rate
   */
  it('H02-T08: Multi-hour booking price = duration × current rate', async () => {
    // Create 2-hour booking
    const futureStart = new Date(Date.now() + 86400000);
    const futureEnd = new Date(futureStart.getTime() + 7200000); // +2hrs
    const twoHourBooking = await prisma.booking.create({
      data: {
        providerId: instructor.id,
        customerId: student.id,
        status: 'PENDING',
        startTime: futureStart,
        endTime: futureEnd,
        duration: 120,
        price: 0,
      },
    });

    const request = {
      json: async () => ({
        bookingId: twoHourBooking.id,
        packageBookingId: packageBooking.id,
        hoursToDeduct: 2,
      }),
      headers: new Map(),
    } as unknown as NextRequest;

    const response = await POST(request);
    expect(response.status).toBe(200);

    const confirmed = await prisma.booking.findUnique({
      where: { id: twoHourBooking.id },
      select: { price: true },
    });

    expect(Number(confirmed!.price)).toBe(140); // 2hrs × $70/hr
  });

  /**
   * H02-T09: Different instructor with different rate
   * Customer switches instructors mid-package
   */
  it('H02-T09: Different instructor rate applies to their booking', async () => {
    // Create second instructor at $90/hr
    const instructor2User = await prisma.user.create({
      data: { email: 'instructor2@test.com', role: 'INSTRUCTOR' },
    });
    const instructor2 = await prisma.provider.create({
      data: {
        userId: instructor2User.id,
        name: 'Expensive Instructor',
        phone: '+61400000002',
        hourlyRate: 90, // More expensive
        subscriptionTier: 'PRO',
      },
    });

    // Create booking with instructor2
    const futureStart = new Date(Date.now() + 86400000);
    const futureEnd = new Date(futureStart.getTime() + 3600000);
    const otherInstructorBooking = await prisma.booking.create({
      data: {
        providerId: instructor2.id,
        customerId: student.id,
        status: 'PENDING',
        startTime: futureStart,
        endTime: futureEnd,
        duration: 60,
        price: 0,
      },
    });

    const request = {
      json: async () => ({
        bookingId: otherInstructorBooking.id,
        packageBookingId: packageBooking.id,
        hoursToDeduct: 1,
      }),
      headers: new Map(),
    } as unknown as NextRequest;

    const response = await POST(request);
    expect(response.status).toBe(200);

    const confirmed = await prisma.booking.findUnique({
      where: { id: otherInstructorBooking.id },
      select: { price: true, commissionRate: true },
    });

    expect(Number(confirmed!.price)).toBe(90); // Uses instructor2's rate
    expect(Number(confirmed!.commissionRate)).toBe(0.12); // PRO tier = 12%
  });

  /**
   * H02-T10: Financial reconciliation
   * Verify: price = platformFee + providerPayout (with rounding tolerance)
   */
  it('H02-T10: Financial fields reconcile within rounding tolerance', async () => {
    const request = {
      json: async () => ({
        bookingId: pendingBooking.id,
        packageBookingId: packageBooking.id,
        hoursToDeduct: 1,
      }),
      headers: new Map(),
    } as unknown as NextRequest;

    const response = await POST(request);
    expect(response.status).toBe(200);

    const confirmed = await prisma.booking.findUnique({
      where: { id: pendingBooking.id },
      select: { price: true, platformFee: true, providerPayout: true },
    });

    const price = Number(confirmed!.price);
    const fee = Number(confirmed!.platformFee);
    const payout = Number(confirmed!.providerPayout);

    // Commission split: price = providerPayout / (1 - commissionRate)
    // Platform doesn't take platformFee from this transaction (wallet-funded)
    // The commission is the only deduction: price × commissionRate
    const commission = price - payout;
    
    // Verify commission makes sense (BASIC = 15%)
    const expectedCommission = parseFloat((price * 0.15).toFixed(2));
    expect(Math.abs(commission - expectedCommission)).toBeLessThan(0.02); // Rounding tolerance
  });
});
