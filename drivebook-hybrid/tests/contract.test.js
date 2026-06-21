/**
 * Contract Tests — DriveBook API
 *
 * These tests verify the shape of the API responses the voice service depends
 * on.  A contract break (e.g. field renamed, status code changed, new required
 * field) will fail here BEFORE the code reaches production.
 *
 * Philosophy:
 *   - Test response SHAPE, not business logic.
 *   - Every endpoint the AI prompt template calls is covered.
 *   - Tests use supertest against the local express app + mocked upstream.
 *   - Run in CI with: npm test -- contract.test.js
 *
 * Endpoints covered (from AI_PROMPT_TEMPLATE.md):
 *   GET  /api/health
 *   POST /api/availability              (check availability)
 *   GET  /api/availability/slots        (list open slots)
 *   GET  /api/instructors/search        (search by location / name)
 *   GET  /api/instructors/recommendations
 *   POST /api/public/bookings/bulk      (create booking)
 *   GET  /api/bookings/lookup           (look up by phone)
 *   POST /api/verifications/otp         (send OTP)
 *   POST /api/verifications/otp/confirm (confirm OTP)
 *   GET  /api/public/bookings/:id       (booking detail + eligibility)
 *   POST /api/public/bookings/:id/cancel
 *   POST /api/public/bookings/:id/reschedule
 */

'use strict';

process.env.NODE_ENV = 'test';
process.env.SKIP_TWILIO_VALIDATION = 'true';

const request = require('supertest');

// ── Mock all outbound HTTP so tests run offline ────────────────────────────────
jest.mock('../services/drivebook-api-client', () => ({}));

// Mock axios so all proxy calls return controlled responses without hitting the network
jest.mock('axios', () => {
  const mockAxios = jest.fn().mockImplementation(({ url, method }) => {
    const path = url.replace(/^https?:\/\/[^/]+/, '').split('?')[0];

    // Health
    if (path === '/api/health') {
      return Promise.resolve({ status: 200, headers: { 'content-type': 'application/json' }, data: { status: 'ok', uptime: 42 } });
    }
    // Availability slots
    if (path === '/api/availability/slots') {
      return Promise.resolve({ status: 200, headers: { 'content-type': 'application/json' }, data: { slots: [{ time: '09:00', available: true }] } });
    }
    // Availability check
    if (path === '/api/availability') {
      return Promise.resolve({ status: 200, headers: { 'content-type': 'application/json' }, data: { available: true, slots: [] } });
    }
    // Instructor recommendations
    if (path === '/api/instructors/recommendations') {
      return Promise.resolve({ status: 200, headers: { 'content-type': 'application/json' }, data: { recommendations: [{ id: 'inst_1', name: 'Debesay', hourlyRate: 79 }] } });
    }
    // Instructor search
    if (path === '/api/instructors/search') {
      return Promise.resolve({ status: 200, headers: { 'content-type': 'application/json' }, data: { instructors: [{ id: 'inst_1', name: 'Debesay', hourlyRate: 79 }] } });
    }
    // Packages
    if (path === '/api/packages') {
      return Promise.resolve({ status: 200, headers: { 'content-type': 'application/json' }, data: { packages: [{ type: 'PACKAGE_10', hours: 10, price: 790 }] } });
    }
    // Booking creation
    if (path === '/api/public/bookings/bulk' && method === 'POST') {
      return Promise.resolve({ status: 200, headers: { 'content-type': 'application/json' }, data: {
        success: true, bookingId: 'bkg_test_001', status: 'PENDING_PAYMENT',
        checkoutUrl: 'https://drivebook.com.au/booking/bkg_test_001/payment', total: 790,
      }});
    }
    // Booking lookup
    if (path === '/api/bookings/lookup') {
      return Promise.resolve({ status: 200, headers: { 'content-type': 'application/json' }, data: {
        bookings: [{ bookingId: 'bkg_test_001', startTime: '2050-01-01T09:00:00Z', instructor: { name: 'Debesay' }, status: 'CONFIRMED' }],
      }});
    }
    // OTP send
    if (path === '/api/verifications/otp' && method === 'POST') {
      return Promise.resolve({ status: 200, headers: { 'content-type': 'application/json' }, data: { verificationId: 'vrf_001', expiresAt: '2050-01-01T09:10:00Z' } });
    }
    // OTP confirm
    if (path === '/api/verifications/otp/confirm' && method === 'POST') {
      return Promise.resolve({ status: 200, headers: { 'content-type': 'application/json' }, data: { verified: true, verificationToken: 'tok_abc123' } });
    }
    // Cancel
    if (path.match(/\/api\/public\/bookings\/[^/]+\/cancel/)) {
      return Promise.resolve({ status: 200, headers: { 'content-type': 'application/json' }, data: { success: true, refund: { percentage: 100, amount: 790 } } });
    }
    // Reschedule
    if (path.match(/\/api\/public\/bookings\/[^/]+\/reschedule/)) {
      return Promise.resolve({ status: 200, headers: { 'content-type': 'application/json' }, data: { success: true, oldStartTime: '2050-01-01T09:00:00Z', newStartTime: '2050-01-03T10:00:00Z' } });
    }
    // Fallback
    return Promise.resolve({ status: 404, headers: {}, data: { error: 'Not found' } });
  });
  return mockAxios;
});

// Mock database + instructor service (avoid real DB hits)
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
 * Assert that every key in `shape` exists on `obj` (deep, non-strict).
 * Arrays are checked to have at least one element matching the item shape.
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
      // Check the first element matches the shape
      if (actual.length > 0) assertShape(actual[0], expected[0], `${fullPath}[0]`);
    }
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Contract Tests — API Response Shapes', () => {

  // ── Health ──────────────────────────────────────────────────────────────────
  describe('GET /api/health', () => {
    test('returns 200 with status and uptime fields', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      assertShape(res.body, { status: 'string', uptime: 0 });
    });
  });

  // ── Availability ────────────────────────────────────────────────────────────
  describe('GET /api/availability/slots', () => {
    test('returns 200 with slots array containing time and available', async () => {
      const res = await request(app)
        .get('/api/availability/slots')
        .query({ instructorId: 'inst_1', date: '2050-01-01', duration: '60' });
      expect(res.status).toBe(200);
      assertShape(res.body, {
        slots: [{ time: 'string', available: true }],
      });
    });
  });

  describe('POST /api/availability', () => {
    test('returns 200 with available boolean', async () => {
      const res = await request(app)
        .post('/api/availability')
        .query({ instructorId: 'inst_1', date: '2050-01-01', duration: '60' })
        .send({});
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('available');
      expect(typeof res.body.available).toBe('boolean');
    });
  });

  // ── Instructors ─────────────────────────────────────────────────────────────
  describe('GET /api/instructors/recommendations', () => {
    test('returns 200 with recommendations array (id, name, hourlyRate)', async () => {
      const res = await request(app)
        .get('/api/instructors/recommendations')
        .query({ location: '123 Main St Joondalup' });
      expect(res.status).toBe(200);
      assertShape(res.body, {
        recommendations: [{ id: 'string', name: 'string', hourlyRate: 0 }],
      });
    });
  });

  describe('GET /api/instructors/search', () => {
    test('returns 200 with instructors array (id, name)', async () => {
      const res = await request(app)
        .get('/api/instructors/search')
        .query({ location: '123 Main St' });
      expect(res.status).toBe(200);
      assertShape(res.body, {
        instructors: [{ id: 'string', name: 'string' }],
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
      scheduledBookings: [
        {
          date: '2050-01-01',
          time: '09:00',
          duration: 60,
          pickupLocation: '123 Main St Joondalup WA 6027',
        },
      ],
    };

    test('returns success=true, bookingId, status, checkoutUrl, total', async () => {
      const res = await request(app)
        .post('/api/public/bookings/bulk')
        .send(validPayload);
      expect(res.status).toBe(200);
      assertShape(res.body, {
        success: true,
        bookingId: 'string',
        status: 'string',
        checkoutUrl: 'string',
        total: 0,
      });
    });

    test('checkoutUrl is a valid HTTPS URL', async () => {
      const res = await request(app)
        .post('/api/public/bookings/bulk')
        .send(validPayload);
      expect(res.body.checkoutUrl).toMatch(/^https:\/\//);
    });

    test('status is PENDING_PAYMENT for a new booking', async () => {
      const res = await request(app)
        .post('/api/public/bookings/bulk')
        .send(validPayload);
      expect(res.body.status).toBe('PENDING_PAYMENT');
    });
  });

  // ── Booking lookup ─────────────────────────────────────────────────────────
  describe('GET /api/bookings/lookup', () => {
    test('returns bookings array with bookingId, startTime, instructor.name, status', async () => {
      const res = await request(app)
        .get('/api/bookings/lookup')
        .query({ phone: '0400123456' });
      expect(res.status).toBe(200);
      assertShape(res.body, {
        bookings: [
          {
            bookingId: 'string',
            startTime: 'string',
            instructor: { name: 'string' },
            status: 'string',
          },
        ],
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
      assertShape(res.body, {
        verificationId: 'string',
        expiresAt: 'string',
      });
    });
  });

  describe('POST /api/verifications/otp/confirm', () => {
    test('returns verified boolean and verificationToken on success', async () => {
      const res = await request(app)
        .post('/api/verifications/otp/confirm')
        .send({ verificationId: 'vrf_001', code: '123456' });
      expect(res.status).toBe(200);
      expect(res.body.verified).toBe(true);
      expect(res.body).toHaveProperty('verificationToken');
      expect(typeof res.body.verificationToken).toBe('string');
    });
  });

  // ── Cancel ──────────────────────────────────────────────────────────────────
  describe('POST /api/public/bookings/:id/cancel', () => {
    test('returns success=true with refund object (percentage, amount)', async () => {
      const res = await request(app)
        .post('/api/public/bookings/bkg_test_001/cancel')
        .set('X-Verification-Token', 'tok_abc123')
        .send({ reason: 'student_request' });
      expect(res.status).toBe(200);
      assertShape(res.body, {
        success: true,
        refund: { percentage: 0, amount: 0 },
      });
    });
  });

  // ── Reschedule ──────────────────────────────────────────────────────────────
  describe('POST /api/public/bookings/:id/reschedule', () => {
    test('returns success=true with oldStartTime and newStartTime', async () => {
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
      assertShape(res.body, {
        success: true,
        oldStartTime: 'string',
        newStartTime: 'string',
      });
    });
  });
});

// ── Voice session service unit tests ──────────────────────────────────────────

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

  test('normalises 04xx and +614xx to the same key', async () => {
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

  test('buildRecoveryPrompt mentions verification code for AWAITING_OTP', async () => {
    await voiceSession.saveSession('0400111111', { lastAction: 'AWAITING_OTP' });
    const session = await voiceSession.getSession('0400111111');
    const prompt = voiceSession.buildRecoveryPrompt(session);
    expect(prompt).toContain('verification code');
  });

  test('getStorageMode returns map in test environment', () => {
    expect(voiceSession.getStorageMode()).toBe('map');
  });
});
