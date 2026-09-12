/**
 * Proxy URL Verification Tests
 *
 * Verifies that the proxy builds the correct outbound URL for each voice tool.
 * This catches configuration bugs like DRIVEBOOK_BASE_URL pointing at localhost
 * instead of the real Vercel deployment — the exact bug that caused 2-minute
 * stalls in production.
 *
 * Rather than testing the response shape (covered by contract.test.js), these
 * tests inspect axios.mock.calls to assert:
 *   - The correct base URL was used (drivebook.com.au, not localhost)
 *   - The correct path was constructed
 *   - Required query parameters were forwarded
 *   - Required headers (x-vapi-secret, x-api-key) were forwarded
 *
 * Run with: npm test -- proxy-url.test.js
 */

'use strict';

process.env.NODE_ENV            = 'test';
process.env.SKIP_TWILIO_VALIDATION = 'true';
// Set the base URL before loading app so config picks it up
process.env.DRIVEBOOK_BASE_URL  = 'https://drivebook.com.au';
process.env.VAPI_WEBHOOK_SECRET = 'test-vapi-secret-value';
process.env.DRIVEBOOK_API_KEY   = 'test-api-key-value';

jest.mock('axios', () => {
  const fn = jest.fn().mockResolvedValue({
    status: 200,
    headers: { 'content-type': 'application/json' },
    data: {
      recommendations: [{ id: 'inst_1', name: 'Debesay', voice: { summary: 'test' } }],
      count: 1,
      availableSlots: [],
      packages: [],
      bookings: [],
      verificationId: 'vrf_001',
      expiresAt: '2099-01-01T00:00:00Z',
      valid: true,
      formattedAddress: '81 King William Street, Bayswater WA 6053',
      result: 'in',
    },
  });
  return fn;
});

jest.mock('../services/database-service', () => ({
  prisma: {
    booking:    { findFirst: jest.fn() },
    message:    { create: jest.fn() },
    instructor: { findFirst: jest.fn() },
    $disconnect: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock('../services/instructor-service', () => ({
  findInstructorByPhone: jest.fn(() => Promise.resolve(null)),
}));

jest.mock('../services/sms-service', () => ({
  sendBookingConfirmation: jest.fn(() => Promise.resolve({ success: true })),
  sendSms:                 jest.fn(() => Promise.resolve({ success: true })),
  resendPaymentLink:       jest.fn(() => Promise.resolve({ success: true })),
}));

const request = require('supertest');
const axios   = require('axios');
const app     = require('../server');

// All requests in this suite need to pass the Vapi secret to get past middleware.
// We're testing what the proxy sends OUTBOUND, not the inbound auth itself.
const SECRET = 'test-vapi-secret-value';
function authedRequest(method, path) {
  return request(app)[method](path).set('x-vapi-secret', SECRET);
}

// Convenience: get the URL from the most recent axios call
function lastCalledUrl() {
  return axios.mock.calls[axios.mock.calls.length - 1][0].url;
}

function lastCalledHeaders() {
  return axios.mock.calls[axios.mock.calls.length - 1][0].headers || {};
}

afterEach(() => {
  axios.mockClear();
});

// ── Base URL verification ─────────────────────────────────────────────────────

describe('Proxy URL — base URL targeting', () => {

  test('recommendations: targets drivebook.com.au, not localhost', async () => {
    await authedRequest('get', '/api/instructors/recommendations?location=6051&vehicleType=AUTO');

    const url = lastCalledUrl();
    expect(url).toContain('https://drivebook.com.au');
    expect(url).not.toContain('localhost');
    expect(url).not.toContain('127.0.0.1');
  });

  test('packages: targets drivebook.com.au', async () => {
    await authedRequest('get', '/api/packages?instructorId=inst_1');

    expect(lastCalledUrl()).toContain('https://drivebook.com.au');
    expect(lastCalledUrl()).not.toContain('localhost');
  });

  test('availability slots: targets drivebook.com.au', async () => {
    await authedRequest('get', '/api/availability/slots?instructorId=inst_1&date=2026-07-21&lessonDurationMinutes=60');

    expect(lastCalledUrl()).toContain('https://drivebook.com.au');
    expect(lastCalledUrl()).not.toContain('localhost');
  });

});

// ── Path construction ─────────────────────────────────────────────────────────

describe('Proxy URL — correct path construction', () => {

  test('recommendations path is /api/instructors/recommendations', async () => {
    await authedRequest('get', '/api/instructors/recommendations?location=6051&vehicleType=AUTO');

    expect(lastCalledUrl()).toContain('/api/instructors/recommendations');
  });

  test('packages path is /api/packages', async () => {
    await authedRequest('get', '/api/packages?instructorId=inst_1');

    expect(lastCalledUrl()).toContain('/api/packages');
  });

  test('availability slots path is /api/availability/slots', async () => {
    await authedRequest('get', '/api/availability/slots?instructorId=inst_1&date=2026-07-21&lessonDurationMinutes=60');

    expect(lastCalledUrl()).toContain('/api/availability/slots');
  });

  test('bookings lookup path is /api/bookings/lookup', async () => {
    // bookings path bypasses verifyVapiSecret — no secret needed
    await request(app).get('/api/bookings/lookup?phone=0400123456');

    expect(lastCalledUrl()).toContain('/api/bookings/lookup');
  });

  test('locations validate path is /api/locations/validate', async () => {
    await authedRequest('post', '/api/locations/validate')
      .send({ pickupLocation: '81 King William Street, Bayswater WA' });

    expect(lastCalledUrl()).toContain('/api/locations/validate');
  });

  test('OTP path is /api/verifications/otp', async () => {
    await authedRequest('post', '/api/verifications/otp')
      .send({ phone: '0400000001', purpose: 'cancel' });

    expect(lastCalledUrl()).toContain('/api/verifications/otp');
    expect(lastCalledUrl()).not.toContain('/otp/confirm');
  });

});

// ── Query parameter forwarding ────────────────────────────────────────────────

describe('Proxy URL — query parameter forwarding', () => {

  test('location and vehicleType are forwarded to recommendations', async () => {
    await authedRequest('get', '/api/instructors/recommendations?location=6051&vehicleType=AUTO');

    const url = lastCalledUrl();
    expect(url).toContain('location=6051');
    expect(url).toContain('vehicleType=AUTO');
  });

  test('instructorId is forwarded to packages', async () => {
    await authedRequest('get', '/api/packages?instructorId=inst_abc_123');

    expect(lastCalledUrl()).toContain('instructorId=inst_abc_123');
  });

  test('date and lessonDurationMinutes are forwarded to slots', async () => {
    await authedRequest('get', '/api/availability/slots?instructorId=inst_1&date=2026-07-21&lessonDurationMinutes=60');

    const url = lastCalledUrl();
    expect(url).toContain('date=2026-07-21');
    expect(url).toContain('lessonDurationMinutes=60');
  });

  test('phone is forwarded to bookings lookup', async () => {
    await request(app).get('/api/bookings/lookup?phone=0412345678');

    expect(lastCalledUrl()).toContain('phone=0412345678');
  });

});

// ── Header forwarding ─────────────────────────────────────────────────────────

describe('Proxy URL — header forwarding', () => {

  test('x-vapi-secret is forwarded to upstream', async () => {
    await authedRequest('get', '/api/instructors/recommendations?location=6051&vehicleType=AUTO');

    const headers = lastCalledHeaders();
    expect(headers['x-vapi-secret']).toBe('test-vapi-secret-value');
  });

  test('x-api-key is forwarded to upstream', async () => {
    await authedRequest('get', '/api/packages?instructorId=inst_1');

    const headers = lastCalledHeaders();
    expect(headers['x-api-key']).toBe('test-api-key-value');
  });

  test('both x-vapi-secret and x-api-key are present on every proxied request', async () => {
    await authedRequest('get', '/api/availability/slots?instructorId=inst_1&date=2026-07-21&lessonDurationMinutes=60');

    const headers = lastCalledHeaders();
    expect(headers['x-vapi-secret']).toBe('test-vapi-secret-value');
    expect(headers['x-api-key']).toBe('test-api-key-value');
  });

});
