/**
 * Contract Tests — DriveBook Hybrid Voice Service
 *
 * Verifies the shape of every API response the voice service depends on.
 * A contract break (renamed field, changed status code, new required field)
 * will fail here before the code reaches production.
 *
 * Philosophy:
 *   - Test response SHAPE, not business logic.
 *   - Every endpoint the AI prompt calls is covered.
 *   - Tests use supertest against the local express app with mocked upstream.
 *   - Run with: npm test
 *
 * Endpoints covered:
 *   GET  /api/health
 *   POST /api/availability
 *   GET  /api/availability/slots
 *   GET  /api/instructors/search
 *   GET  /api/instructors/recommendations
 *   POST /api/public/bookings/bulk
 *   GET  /api/bookings/lookup
 *   POST /api/verifications/otp
 *   POST /api/verifications/otp/confirm
 *   GET  /api/bookings/:id/cancellation-policy
 *   GET  /api/public/bookings/:id/payment-status
 *   GET  /api/public/bookings/:id/timeline
 *   GET  /api/public/bookings/:id
 *   POST /api/public/bookings/:id/cancel
 *   POST /api/public/bookings/:id/reschedule
 */

'use strict';

process.env.NODE_ENV = 'test';
process.env.SKIP_TWILIO_VALIDATION = 'true';
// Clear Vapi secret so verifyVapiSecret middleware bypasses auth in tests.
// The .env file has a real secret which would cause 401 on all requests.
process.env.VAPI_WEBHOOK_SECRET = '';

const request = require('supertest');

// ── Mock all outbound HTTP so tests run offline ───────────────────────────────
// Note: drivebook-api-client was archived — axios is the only HTTP client now.

jest.mock('axios', () => {
  const mockAxios = jest.fn().mockImplementation(({ url, method }) => {
    const path = url.replace(/^https?:\/\/[^/]+/, '').split('?')[0];

    if (path === '/api/health') {
      return Promise.resolve({
        status: 200,
        headers: { 'content-type': 'application/json' },
        data: { status: 'ok', uptime: 42 },
      });
    }

    if (path === '/api/availability/slots') {
      return Promise.resolve({
        status: 200,
        headers: { 'content-type': 'application/json' },
        data: {
          instructorId: 'inst_1',
          date: '2050-01-01',
          lessonDurationMinutes: 60,
          timezone: 'Australia/Perth',
          availableSlots: [{
            startTime: '2050-01-01T01:00:00.000Z',
            endTime: '2050-01-01T02:00:00.000Z',
            bookingTime: '09:00',
            lessonDuration: 60,
            voice: { speakTime: '9:00 AM', speakDate: 'Wednesday 1 January', confirmation: 'Wednesday 1 January at 9:00 AM' },
          }],
        },
      });
    }

    if (path === '/api/availability') {
      return Promise.resolve({
        status: 200,
        headers: { 'content-type': 'application/json' },
        data: { available: true, slots: [] },
      });
    }

    if (path === '/api/instructors/recommendations') {
      return Promise.resolve({
        status: 200,
        headers: { 'content-type': 'application/json' },
        data: {
          recommendations: [{
            id: 'inst_1',
            name: 'Debesay',
            hourlyRate: 79,
            rating: 4.9,
            reviews: 42,
            reason: 'Top rated instructor near you',
            badges: ['Top Rated'],
            voice: { summary: 'Top rated instructor near you • Automatic • English • $79 per hour' },
          }],
          count: 1,
        },
      });
    }

    if (path === '/api/instructors/search') {
      return Promise.resolve({
        status: 200,
        headers: { 'content-type': 'application/json' },
        data: { instructors: [{ id: 'inst_1', name: 'Debesay', hourlyRate: 79 }] },
      });
    }

    if (path === '/api/packages') {
      return Promise.resolve({
        status: 200,
        headers: { 'content-type': 'application/json' },
        data: {
          instructor: { id: 'inst_1', name: 'Debesay', hourlyRate: 79 },
          packages: [{ type: 'PACKAGE_10', hours: 10, price: 790, priceWithFee: 818.44 }],
          voicePackages: [
            '6 hours for 427.50 dollars, that is 5 percent off',
            '10 hours for 712.44 dollars, 10 percent off, the most popular choice',
            '15 hours for 1044.36 dollars, 12 percent off, the best savings',
          ],
          testPackage: { available: true, price: 150, name: 'Driving Test Package' },
          platformFee: { percentage: 2.99, description: 'Platform fee covers payment processing and booking services' },
        },
      });
    }

    if (path === '/api/public/bookings/bulk' && method === 'POST') {
      return Promise.resolve({
        status: 201,   // server returns 201 Created — confirmed from bulk/route.ts
        headers: { 'content-type': 'application/json' },
        data: {
          success: true,
          bookingId: 'bkg_test_001',
          bookingType: 'now',
          status: 'PENDING_PAYMENT',
          isShortNotice: false,
          total: 818.44,
          checkoutUrl: 'https://drivebook.com.au/booking/bkg_test_001/payment?token=abc123',
          voice: {
            instructor: 'Debesay',
            package: '10 Hour Package',
            packageHours: 10,
            scheduledHours: 1,
            scheduledLessons: 1,
            remainingHours: 9,
            firstLesson: 'Wednesday 1 January at 9:00 AM',
            paymentRequired: true,
            slotHeldMinutes: 10,
            pickupVerified: true,
            confirmation: 'Your 10 Hour Package with Debesay is reserved for 10 minutes. A payment link has been sent to your phone.',
          },
        },
      });
    }

    if (path === '/api/bookings/lookup') {
      return Promise.resolve({
        status: 200,
        headers: { 'content-type': 'application/json' },
        data: {
          bookings: [{
            id: 'bkg_test_001',          // server returns `id`, not `bookingId`
            startTime: '2050-01-01T09:00:00Z',
            instructor: { id: 'inst_1', name: 'Debesay' },
            status: 'CONFIRMED',
            duration: 60,
            pickupLocation: '123 Main St Joondalup',
          }],
        },
      });
    }

    if (path === '/api/verifications/otp' && method === 'POST') {
      return Promise.resolve({
        status: 200,
        headers: { 'content-type': 'application/json' },
        data: { verificationId: 'vrf_001', expiresAt: '2050-01-01T09:10:00Z' },
      });
    }

    if (path === '/api/verifications/otp/confirm' && method === 'POST') {
      return Promise.resolve({
        status: 200,
        headers: { 'content-type': 'application/json' },
        // Server returns `valid` (not `verified`) — confirmed from route.ts source
        data: { success: true, valid: true, verificationToken: 'tok_abc123', expiresAt: '2050-01-01T09:10:00Z' },
      });
    }

    if (path.match(/\/api\/public\/bookings\/[^/]+\/cancel/)) {
      return Promise.resolve({
        status: 200,
        headers: { 'content-type': 'application/json' },
        data: { success: true, refund: { percentage: 100, amount: 818.44 } },
      });
    }

    if (path.match(/\/api\/public\/bookings\/[^/]+\/reschedule/)) {
      return Promise.resolve({
        status: 200,
        headers: { 'content-type': 'application/json' },
        data: {
          success: true,
          oldStartTime: '2050-01-01T09:00:00Z',
          newStartTime: '2050-01-03T10:00:00Z',
        },
      });
    }

    if (path.match(/\/api\/bookings\/[^/]+\/cancellation-policy/)) {
      return Promise.resolve({
        status: 200,
        headers: { 'content-type': 'application/json' },
        data: {
          canCancel: true,
          isPendingPayment: false,
          refundPercentage: 100,
          refundAmount: 818.44,
          hoursUntilLesson: 72,
          reason: '48+ hours notice — full refund.',
        },
      });
    }

    if (path.match(/\/api\/public\/bookings\/[^/]+\/payment-status/)) {
      return Promise.resolve({
        status: 200,
        headers: { 'content-type': 'application/json' },
        data: {
          bookingId: 'bkg_test_001',
          status: 'CONFIRMED',
          paymentStatus: 'succeeded',
          isPaid: true,
          canPay: false,
        },
      });
    }

    if (path.match(/\/api\/public\/bookings\/[^/]+\/timeline/)) {
      return Promise.resolve({
        status: 200,
        headers: { 'content-type': 'application/json' },
        data: {
          bookingId: 'bkg_test_001',
          status: 'CONFIRMED',
          // Server returns `timestamp` and `description` — confirmed from timeline/route.ts
          events: [
            { timestamp: '2050-01-01T09:00:00.000Z', description: 'Booking created with Debesay' },
            { timestamp: '2050-01-01T09:03:00.000Z', description: 'Payment received — booking confirmed' },
          ],
        },
      });
    }

    if (path.match(/\/api\/public\/bookings\/[^/]+(\/)?$/) && method === 'GET') {
      return Promise.resolve({
        status: 200,
        headers: { 'content-type': 'application/json' },
        data: {
          bookingId: 'bkg_test_001',
          status: 'CONFIRMED',
          canCancel: true,
          canReschedule: true,
          startTime: '2050-01-01T09:00:00Z',
          duration: 60,
          pickupLocation: '123 Main St Joondalup',
          instructor: { name: 'Debesay' },
        },
      });
    }

    return Promise.resolve({ status: 404, headers: {}, data: { error: 'Not found' } });
  });

  return mockAxios;
});

jest.mock('../services/database-service', () => ({
  prisma: {
    booking: { findFirst: jest.fn() },
    message: { create: jest.fn() },
    instructor: { findFirst: jest.fn() },
    $disconnect: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock('../services/instructor-service', () => ({
  findInstructorByPhone: jest.fn(() => Promise.resolve(null)),
}));

jest.mock('../services/sms-service', () => ({
  sendBookingConfirmation: jest.fn(() => Promise.resolve({ success: true })),
  sendSms: jest.fn(() => Promise.resolve({ success: true })),
  resendPaymentLink: jest.fn(() => Promise.resolve({ success: true })),
}));

const app = require('../server');

// ── Helper ────────────────────────────────────────────────────────────────────

/**
 * Assert every key in `shape` exists on `obj` (deep, non-strict).
 * Arrays: checked to have at least one element matching the item shape.
 * Primitives: validated by type when the shape value is a sentinel:
 *   'string'  → typeof actual === 'string'
 *   0 (number) → typeof actual === 'number'
 *   true/false (boolean) → typeof actual === 'boolean'
 */
function assertShape(obj, shape, path = '') {
  for (const [key, expected] of Object.entries(shape)) {
    const fullPath = path ? `${path}.${key}` : key;
    expect(obj).toHaveProperty(key);
    const actual = obj[key];
    if (expected !== null && typeof expected === 'object' && !Array.isArray(expected)) {
      assertShape(actual, expected, fullPath);
    } else if (Array.isArray(expected) && expected.length > 0) {
      expect(Array.isArray(actual)).toBe(true);
      if (actual.length > 0) assertShape(actual[0], expected[0], `${fullPath}[0]`);
    } else if (typeof expected === 'string') {
      expect(typeof actual).toBe('string');
    } else if (typeof expected === 'number') {
      expect(typeof actual).toBe('number');
    } else if (typeof expected === 'boolean') {
      expect(typeof actual).toBe('boolean');
    }
  }
}

// ── Contract Tests ────────────────────────────────────────────────────────────

describe('Contract Tests — API Response Shapes', () => {

  // ── Health ──────────────────────────────────────────────────────────────────
  describe('GET /api/health', () => {
    test('returns status field', async () => {
      // The hybrid health check runs a DB query — returns 503 in test when DB is unavailable.
      // We only assert the shape, not the status code, since test env has no real DB.
      const res = await request(app).get('/api/health');
      expect([200, 503]).toContain(res.status);
      expect(res.body).toHaveProperty('status');
    });
  });

  // ── Availability ────────────────────────────────────────────────────────────
  describe('GET /api/availability/slots', () => {
    test('returns slots with voice.confirmation, bookingTime, and timezone', async () => {
      const res = await request(app)
        .get('/api/availability/slots')
        .query({ instructorId: 'inst_1', date: '2050-01-01', duration: '60' });
      expect(res.status).toBe(200);
      assertShape(res.body, {
        timezone: 'string',
        availableSlots: [{
          bookingTime: 'string',
          voice: { speakTime: 'string', speakDate: 'string', confirmation: 'string' },
        }],
      });
    });
  });

  describe('POST /api/availability', () => {
    test('returns available boolean', async () => {
      const res = await request(app)
        .post('/api/availability')
        .query({ instructorId: 'inst_1', date: '2050-01-01', duration: '60' })
        .send({});
      expect(res.status).toBe(200);
      expect(typeof res.body.available).toBe('boolean');
    });
  });

  // ── Instructors ─────────────────────────────────────────────────────────────
  describe('GET /api/instructors/recommendations', () => {
    test('returns recommendations with voice.summary field', async () => {
      const res = await request(app)
        .get('/api/instructors/recommendations')
        .query({ location: 'Maylands' });
      expect(res.status).toBe(200);
      assertShape(res.body, {
        recommendations: [{
          id: 'string',
          name: 'string',
          hourlyRate: 0,
          voice: { summary: 'string' },
        }],
      });
    });
  });

  describe('GET /api/instructors/search', () => {
    test('returns instructors array with id and name', async () => {
      const res = await request(app)
        .get('/api/instructors/search')
        .query({ location: 'Maylands' });
      expect(res.status).toBe(200);
      assertShape(res.body, { instructors: [{ id: 'string', name: 'string' }] });
    });
  });

  // ── Packages ─────────────────────────────────────────────────────────────────
  describe('GET /api/packages', () => {
    test('returns voicePackages array and testPackage with price', async () => {
      const res = await request(app)
        .get('/api/packages')
        .query({ instructorId: 'inst_1' });
      expect(res.status).toBe(200);
      assertShape(res.body, {
        instructor: { id: 'string', name: 'string', hourlyRate: 0 },
        packages: [{ type: 'string', hours: 0, priceWithFee: 0 }],
        voicePackages: ['string'],
        testPackage: { price: 0 },
      });
    });

    test('voicePackages has 3 entries (6h, 10h, 15h)', async () => {
      const res = await request(app)
        .get('/api/packages')
        .query({ instructorId: 'inst_1' });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.voicePackages)).toBe(true);
      expect(res.body.voicePackages.length).toBe(3);
      res.body.voicePackages.forEach((line) => {
        expect(typeof line).toBe('string');
        expect(line.length).toBeGreaterThan(0);
      });
    });
  });

  // ── Booking creation ─────────────────────────────────────────────────────────
  describe('POST /api/public/bookings/bulk', () => {
    const validPayload = {
      instructorId: 'inst_1',
      packageType: 'PACKAGE_10',
      hours: 10,
      accountHolderName: 'Sarah Jones',
      accountHolderEmail: 'sarah@example.com',
      accountHolderPhone: '0400123456',
      scheduledBookings: [{
        date: '2050-01-01',
        time: '09:00',
        duration: 60,
        pickupLocation: '123 Main St Joondalup WA 6027',
        pickupValidated: true,
        notes: '',
      }],
    };

    test('returns success, bookingId, status, checkoutUrl, total', async () => {
      const res = await request(app)
        .post('/api/public/bookings/bulk')
        .send(validPayload);
      expect(res.status).toBe(201); // server returns 201 Created
      assertShape(res.body, {
        success: true,
        bookingId: 'string',
        status: 'string',
        checkoutUrl: 'string',
        total: 0,
      });
    });

    test('returns voice block with remainingHours, package, confirmation', async () => {
      const res = await request(app)
        .post('/api/public/bookings/bulk')
        .send(validPayload);
      assertShape(res.body, {
        voice: {
          instructor: 'string',
          package: 'string',
          packageHours: 0,
          remainingHours: 0,
          scheduledLessons: 0,
          confirmation: 'string',
          slotHeldMinutes: 0,
        },
      });
    });

    test('checkoutUrl is a valid HTTPS URL', async () => {
      const res = await request(app)
        .post('/api/public/bookings/bulk')
        .send(validPayload);
      expect(res.body.checkoutUrl).toMatch(/^https:\/\//);
    });

    test('status is PENDING_PAYMENT for a normal booking', async () => {
      const res = await request(app)
        .post('/api/public/bookings/bulk')
        .send(validPayload);
      expect(res.body.status).toBe('PENDING_PAYMENT');
    });

    test('short-notice booking returns status PENDING, isShortNotice:true, no checkoutUrl', async () => {
      // Temporarily override the mock to simulate a short-notice response
      const axios = require('axios');
      const originalImpl = axios.getMockImplementation();
      axios.mockImplementationOnce(({ url, method }) => {
        const path = url.replace(/^https?:\/\/[^/]+/, '').split('?')[0];
        if (path === '/api/public/bookings/bulk' && method === 'POST') {
          return Promise.resolve({
            status: 201,
            headers: { 'content-type': 'application/json' },
            data: {
              success: true,
              bookingId: 'bkg_short_001',
              bookingType: 'now',
              status: 'PENDING',
              isShortNotice: true,
              total: 0,
              // No checkoutUrl — short-notice bookings await instructor approval first
              voice: {
                instructor: 'Debesay',
                package: '10 Hour Package',
                packageHours: 10,
                scheduledHours: 1,
                scheduledLessons: 1,
                remainingHours: 9,
                firstLesson: 'Wednesday 1 January at 9:00 AM',
                paymentRequired: false,
                slotHeldMinutes: 10,
                pickupVerified: true,
                confirmation: 'Debesay needs to approve this booking first. You will be notified within a few minutes.',
              },
            },
          });
        }
        return Promise.resolve({ status: 404, headers: {}, data: { error: 'Not found' } });
      });

      const res = await request(app)
        .post('/api/public/bookings/bulk')
        .send(validPayload);
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('PENDING');
      expect(res.body.isShortNotice).toBe(true);
      expect(res.body.checkoutUrl).toBeUndefined();
      expect(res.body.voice.paymentRequired).toBe(false);
      expect(typeof res.body.voice.confirmation).toBe('string');
    });

    test('accepts pickupValidated:false (spoken address fallback)', async () => {
      const res = await request(app)
        .post('/api/public/bookings/bulk')
        .send({
          ...validPayload,
          scheduledBookings: [{
            ...validPayload.scheduledBookings[0],
            pickupValidated: false,
            pickupLocation: 'Eighty one King William Street Bayswater',
          }],
        });
      expect(res.status).toBe(201); // server returns 201 Created
      expect(res.body.success).toBe(true);
    });
  });

  // ── Booking lookup ─────────────────────────────────────────────────────────
  describe('GET /api/bookings/lookup', () => {
    test('returns bookings with id, startTime, instructor.name, status', async () => {
      const res = await request(app)
        .get('/api/bookings/lookup')
        .query({ phone: '0400123456' });
      expect(res.status).toBe(200);
      // Server returns `id` (not `bookingId`) — confirmed from lookup/route.ts
      assertShape(res.body, {
        bookings: [{ id: 'string', startTime: 'string', instructor: { name: 'string' }, status: 'string' }],
      });
    });
  });

  // ── OTP ─────────────────────────────────────────────────────────────────────
  describe('POST /api/verifications/otp', () => {
    test('returns verificationId and expiresAt', async () => {
      const res = await request(app)
        .post('/api/verifications/otp')
        .send({ phone: '0400123456', purpose: 'cancel' });
      expect(res.status).toBe(200);
      assertShape(res.body, { verificationId: 'string', expiresAt: 'string' });
    });
  });

  describe('POST /api/verifications/otp/confirm', () => {
    test('returns valid:true and verificationToken', async () => {
      const res = await request(app)
        .post('/api/verifications/otp/confirm')
        .send({ verificationId: 'vrf_001', code: '123456' });
      expect(res.status).toBe(200);
      // Server returns `valid` (not `verified`) — field confirmed from route.ts
      expect(res.body.valid).toBe(true);
      expect(typeof res.body.verificationToken).toBe('string');
    });
  });

  // ── Cancellation policy ──────────────────────────────────────────────────────
  describe('GET /api/bookings/:id/cancellation-policy', () => {
    test('returns canCancel, isPendingPayment, refundPercentage, refundAmount, hoursUntilLesson, reason', async () => {
      const res = await request(app)
        .get('/api/bookings/bkg_test_001/cancellation-policy');
      expect(res.status).toBe(200);
      assertShape(res.body, {
        canCancel: true,
        isPendingPayment: false,
        refundPercentage: 0,
        refundAmount: 0,
        hoursUntilLesson: 0,
        reason: 'string',
      });
    });

    test('canCancel:false when booking already cancelled', async () => {
      const axios = require('axios');
      axios.mockImplementationOnce(({ url }) => {
        const path = url.replace(/^https?:\/\/[^/]+/, '').split('?')[0];
        if (path.match(/\/api\/bookings\/[^/]+\/cancellation-policy/)) {
          return Promise.resolve({
            status: 200,
            headers: { 'content-type': 'application/json' },
            data: { canCancel: false, isPendingPayment: false, refundPercentage: 0, refundAmount: 0, hoursUntilLesson: null, reason: 'This booking has already been cancelled.' },
          });
        }
        return Promise.resolve({ status: 404, headers: {}, data: {} });
      });
      const res = await request(app).get('/api/bookings/bkg_test_001/cancellation-policy');
      expect(res.status).toBe(200);
      expect(res.body.canCancel).toBe(false);
      expect(typeof res.body.reason).toBe('string');
    });

    test('isPendingPayment:true for unpaid booking — no refund needed', async () => {
      const axios = require('axios');
      axios.mockImplementationOnce(({ url }) => {
        const path = url.replace(/^https?:\/\/[^/]+/, '').split('?')[0];
        if (path.match(/\/api\/bookings\/[^/]+\/cancellation-policy/)) {
          return Promise.resolve({
            status: 200,
            headers: { 'content-type': 'application/json' },
            data: { canCancel: true, isPendingPayment: true, refundPercentage: 0, refundAmount: 0, hoursUntilLesson: 48, reason: 'Booking has not been paid — slot will be released immediately, no refund required.' },
          });
        }
        return Promise.resolve({ status: 404, headers: {}, data: {} });
      });
      const res = await request(app).get('/api/bookings/bkg_test_001/cancellation-policy');
      expect(res.status).toBe(200);
      expect(res.body.canCancel).toBe(true);
      expect(res.body.isPendingPayment).toBe(true);
      expect(res.body.refundAmount).toBe(0);
    });

    test('50% refund when 24-48 hours notice', async () => {
      const axios = require('axios');
      axios.mockImplementationOnce(({ url }) => {
        const path = url.replace(/^https?:\/\/[^/]+/, '').split('?')[0];
        if (path.match(/\/api\/bookings\/[^/]+\/cancellation-policy/)) {
          return Promise.resolve({
            status: 200,
            headers: { 'content-type': 'application/json' },
            data: { canCancel: true, isPendingPayment: false, refundPercentage: 50, refundAmount: 409.22, hoursUntilLesson: 30, reason: '24–48 hours notice — 50% refund.' },
          });
        }
        return Promise.resolve({ status: 404, headers: {}, data: {} });
      });
      const res = await request(app).get('/api/bookings/bkg_test_001/cancellation-policy');
      expect(res.status).toBe(200);
      expect(res.body.refundPercentage).toBe(50);
      expect(typeof res.body.refundAmount).toBe('number');
      expect(res.body.refundAmount).toBeGreaterThan(0);
    });

    test('0% refund when less than 24 hours notice', async () => {
      const axios = require('axios');
      axios.mockImplementationOnce(({ url }) => {
        const path = url.replace(/^https?:\/\/[^/]+/, '').split('?')[0];
        if (path.match(/\/api\/bookings\/[^/]+\/cancellation-policy/)) {
          return Promise.resolve({
            status: 200,
            headers: { 'content-type': 'application/json' },
            data: { canCancel: true, isPendingPayment: false, refundPercentage: 0, refundAmount: 0, hoursUntilLesson: 6, reason: 'Less than 24 hours notice — no refund.' },
          });
        }
        return Promise.resolve({ status: 404, headers: {}, data: {} });
      });
      const res = await request(app).get('/api/bookings/bkg_test_001/cancellation-policy');
      expect(res.status).toBe(200);
      expect(res.body.refundPercentage).toBe(0);
      expect(res.body.refundAmount).toBe(0);
      expect(typeof res.body.reason).toBe('string');
    });
  });

  // ── Payment status ───────────────────────────────────────────────────────────
  describe('GET /api/public/bookings/:id/payment-status', () => {
    test('returns paymentStatus and canPay', async () => {
      const res = await request(app)
        .get('/api/public/bookings/bkg_test_001/payment-status');
      expect(res.status).toBe(200);
      assertShape(res.body, { bookingId: 'string', paymentStatus: 'string', canPay: true });
    });
  });

  // ── Timeline ─────────────────────────────────────────────────────────────────
  describe('GET /api/public/bookings/:id/timeline', () => {
    test('returns events array with timestamp and description', async () => {
      const res = await request(app)
        .get('/api/public/bookings/bkg_test_001/timeline');
      expect(res.status).toBe(200);
      // Server returns `timestamp` and `description` (not `type`/`time`) — confirmed from timeline/route.ts
      assertShape(res.body, {
        bookingId: 'string',
        status: 'string',
        events: [{ timestamp: 'string', description: 'string' }],
      });
    });
  });

  // ── Booking detail ───────────────────────────────────────────────────────────
  describe('GET /api/public/bookings/:id', () => {
    test('returns canCancel and canReschedule booleans', async () => {
      const res = await request(app)
        .get('/api/public/bookings/bkg_test_001');
      expect(res.status).toBe(200);
      expect(typeof res.body.canCancel).toBe('boolean');
      expect(typeof res.body.canReschedule).toBe('boolean');
    });
  });

  // ── Cancel ────────────────────────────────────────────────────────────────────
  describe('POST /api/public/bookings/:id/cancel', () => {
    test('returns success:true with refund percentage and amount', async () => {
      const res = await request(app)
        .post('/api/public/bookings/bkg_test_001/cancel')
        .set('X-Verification-Token', 'tok_abc123')
        .send({ reason: 'student_request' });
      expect(res.status).toBe(200);
      assertShape(res.body, { success: true, refund: { percentage: 0, amount: 0 } });
    });
  });

  // ── Reschedule ────────────────────────────────────────────────────────────────
  describe('POST /api/public/bookings/:id/reschedule', () => {
    test('returns success:true with oldStartTime and newStartTime', async () => {
      const res = await request(app)
        .post('/api/public/bookings/bkg_test_001/reschedule')
        .set('X-Verification-Token', 'tok_abc123')
        .send({
          newDate: '2050-01-03',
          newTime: '10:00',
          duration: 60,
          reason: 'Client request',
          verificationToken: 'tok_abc123',
          phone: '0400123456',
        });
      expect(res.status).toBe(200);
      assertShape(res.body, { success: true, oldStartTime: 'string', newStartTime: 'string' });
    });
  });

}); // end Contract Tests

// ── Voice Session Service unit tests ─────────────────────────────────────────

describe('VoiceSessionService', () => {
  const voiceSession = require('../services/voice-session-service');

  afterEach(async () => {
    await voiceSession.clearSession('0400111111');
    await voiceSession.clearSession('+61400111111');
  });

  test('saves and retrieves a session', async () => {
    await voiceSession.saveSession('0400111111', {
      lastAction: 'BOOKING_CREATED',
      bookingId: 'bkg_001',
      checkoutUrl: 'https://drivebook.com.au/booking/bkg_001/payment',
      instructorName: 'Debesay',
    });
    const session = await voiceSession.getSession('0400111111');
    expect(session).not.toBeNull();
    expect(session.bookingId).toBe('bkg_001');
    expect(session.lastAction).toBe('BOOKING_CREATED');
  });

  test('normalises 04xx and +614xx to the same session key', async () => {
    await voiceSession.saveSession('0400111111', { lastAction: 'BOOKING_CREATED', bookingId: 'bkg_001' });
    const session = await voiceSession.getSession('+61400111111');
    expect(session).not.toBeNull();
    expect(session.bookingId).toBe('bkg_001');
  });

  test('returns null after session is cleared', async () => {
    await voiceSession.saveSession('0400111111', { lastAction: 'BOOKING_CREATED', bookingId: 'bkg_001' });
    await voiceSession.clearSession('0400111111');
    expect(await voiceSession.getSession('0400111111')).toBeNull();
  });

  test('buildRecoveryPrompt mentions instructor name for BOOKING_CREATED', async () => {
    await voiceSession.saveSession('0400111111', {
      lastAction: 'BOOKING_CREATED',
      instructorName: 'Debesay',
    });
    const session = await voiceSession.getSession('0400111111');
    const prompt = voiceSession.buildRecoveryPrompt(session);
    expect(prompt).toContain('Debesay');
    expect(prompt).toContain('payment link');
  });

  test('buildRecoveryPrompt handles AWAITING_OTP purpose context', async () => {
    await voiceSession.saveSession('0400111111', { lastAction: 'AWAITING_OTP', otpPurpose: 'cancel' });
    const session = await voiceSession.getSession('0400111111');
    const prompt = voiceSession.buildRecoveryPrompt(session);
    expect(prompt).toContain('verifying your identity');
    expect(prompt).toContain('code');
  });

  test('getStorageMode returns map in test environment', () => {
    expect(voiceSession.getStorageMode()).toBe('map');
  });

}); // end VoiceSessionService
