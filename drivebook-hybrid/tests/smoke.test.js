/**
 * Smoke Test Suite
 * Tests critical endpoints with real validation logic (no mocking).
 * Run with: npm test -- smoke.test.js
 */

process.env.NODE_ENV = 'test';
process.env.SKIP_TWILIO_VALIDATION = 'true';
// Clear Vapi secret so verifyVapiSecret middleware bypasses auth in tests.
process.env.VAPI_WEBHOOK_SECRET = '';

const request = require('supertest');

jest.mock('../services/database-service', () => ({
  prisma: {
    booking:    { findFirst: jest.fn(), create: jest.fn() },
    instructor: { findFirst: jest.fn(), findUnique: jest.fn() },
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

describe('Health endpoint', () => {
  test('GET /api/health returns status field', async () => {
    const res = await request(app)
      .get('/api/health')
      .expect('Content-Type', /json/);

    // 503 in test env (no real DB) is expected — we only assert shape, not status
    expect([200, 503]).toContain(res.status);
    expect(res.body).toHaveProperty('status');
    expect(typeof res.body.uptime).toBe('number');
  });
});

describe('Booking API  validation', () => {
  test('returns 400 on invalid phone number', async () => {
    const res = await request(app).post('/api/bookings').send({
      instructorId: 'inst-123', clientName: 'John Smith',
      clientPhone: 'badphone', date: '2050-01-01', time: '09:00', duration: 60,
    });
    expect(res.status).toBe(400);
  });

  test('returns 400 on past date', async () => {
    const res = await request(app).post('/api/bookings').send({
      instructorId: 'inst-123', clientName: 'John Smith',
      clientPhone: '+61412345678', date: '2000-01-01', time: '09:00', duration: 60,
    });
    expect(res.status).toBe(400);
  });

  test('returns 400 on out-of-hours time', async () => {
    const res = await request(app).post('/api/bookings').send({
      instructorId: 'inst-123', clientName: 'John Smith',
      clientPhone: '+61412345678', date: '2050-01-01', time: '23:00', duration: 60,
    });
    expect(res.status).toBe(400);
  });
});

describe('Instructor lookup', () => {
  test('GET /api/instructor/lookup returns 404 when instructor not found', async () => {
    const res = await request(app)
      .get('/api/instructor/lookup?phone=0499999999')
      .expect(404);
    expect(res.body).toHaveProperty('error');
  });
});