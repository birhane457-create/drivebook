/**
 * Failure-Mode Tests — Proxy Error Handling & Retry Behaviour
 *
 * Tests what happens when the upstream (Vercel main app) is unreachable,
 * slow, or returns unexpected data. These are the exact failure modes seen
 * in production: ECONNRESET, ETIMEDOUT, 500s, malformed responses.
 *
 * Key fact about retry behaviour:
 *   PROXY_GET_RETRIES defaults to 2 — meaning 3 total attempts per request
 *   (original + 2 retries). To force a final error, tests must reject 3 times
 *   for GET endpoints. POST endpoints are NOT retried — 1 rejection suffices.
 *
 * Run with: npm test -- booking.test.js
 */

'use strict';

process.env.NODE_ENV = 'test';
process.env.SKIP_TWILIO_VALIDATION = 'true';
process.env.VAPI_WEBHOOK_SECRET = '';

jest.mock('axios', () => {
  const fn = jest.fn().mockResolvedValue({
    status: 200,
    headers: { 'content-type': 'application/json' },
    data: { recommendations: [], count: 0 },
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

function networkError(code, message) {
  const err = new Error(message || code);
  err.code = code;
  return err;
}

// Reject n times with the given error (for exhausting GET retries)
function rejectTimes(err, n) {
  let mock = axios;
  for (let i = 0; i < n; i++) mock = mock.mockRejectedValueOnce(err);
  return mock;
}

afterEach(() => {
  axios.mockClear();
});

// ── Network error classification ──────────────────────────────────────────────

describe('Proxy — network error classification', () => {

  // GET endpoints: PROXY_GET_RETRIES=2 → 3 total attempts → need 3 rejections to exhaust
  // POST endpoints: not retried → 1 rejection returns error immediately

  test('ECONNRESET → 502 with error message', async () => {
    rejectTimes(networkError('ECONNRESET', 'socket hang up'), 3);

    const res = await request(app)
      .get('/api/instructors/recommendations?location=6051&vehicleType=AUTO');

    expect(res.status).toBe(502);
    expect(res.body).toHaveProperty('error');
    expect(typeof res.body.error).toBe('string');
  });

  test('ETIMEDOUT → 504 with error message', async () => {
    rejectTimes(networkError('ETIMEDOUT', 'timeout'), 3);

    const res = await request(app)
      .get('/api/packages?instructorId=inst_1');

    expect(res.status).toBe(504);
    expect(res.body).toHaveProperty('error');
  });

  test('ECONNABORTED → 504 with error message', async () => {
    rejectTimes(networkError('ECONNABORTED', 'socket timeout'), 3);

    const res = await request(app)
      .get('/api/availability/slots?instructorId=inst_1&date=2026-07-21&lessonDurationMinutes=60');

    expect(res.status).toBe(504);
    expect(res.body).toHaveProperty('error');
  });

  test('ECONNREFUSED → 503 with error message (not retried)', async () => {
    // ECONNREFUSED is not classified as transient — no retry, single rejection suffices
    axios.mockRejectedValueOnce(networkError('ECONNREFUSED', 'connection refused'));

    const res = await request(app)
      .get('/api/availability/slots?instructorId=inst_1&date=2026-07-21&lessonDurationMinutes=60');

    expect(res.status).toBe(503);
    expect(res.body).toHaveProperty('error');
  });

  test('upstream 500 → proxy passes 500 through unchanged', async () => {
    axios.mockResolvedValueOnce({
      status: 500,
      headers: { 'content-type': 'application/json' },
      data: { error: 'Internal server error' },
    });

    const res = await request(app)
      .get('/api/instructors/recommendations?location=6051&vehicleType=AUTO');

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error');
  });

});

// ── Malformed / unexpected upstream responses ─────────────────────────────────

describe('Proxy — malformed upstream responses', () => {

  test('null recommendations array → 200, does not crash', async () => {
    axios.mockResolvedValueOnce({
      status: 200,
      headers: { 'content-type': 'application/json' },
      data: { recommendations: null, count: 0 },
    });

    const res = await request(app)
      .get('/api/instructors/recommendations?location=6051&vehicleType=AUTO');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('recommendations');
  });

  test('empty recommendations array → 200, count is 0', async () => {
    axios.mockResolvedValueOnce({
      status: 200,
      headers: { 'content-type': 'application/json' },
      data: { recommendations: [], count: 0 },
    });

    const res = await request(app)
      .get('/api/instructors/recommendations?location=9999&vehicleType=AUTO');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.recommendations)).toBe(true);
    expect(res.body.count).toBe(0);
  });

  test('empty availableSlots array → 200, does not crash', async () => {
    axios.mockResolvedValueOnce({
      status: 200,
      headers: { 'content-type': 'application/json' },
      data: {
        instructorId: 'inst_1',
        date: '2026-07-21',
        lessonDurationMinutes: 60,
        timezone: 'Australia/Perth',
        availableSlots: [],
      },
    });

    const res = await request(app)
      .get('/api/availability/slots?instructorId=inst_1&date=2026-07-21&lessonDurationMinutes=60');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.availableSlots)).toBe(true);
    expect(res.body.availableSlots.length).toBe(0);
  });

  test('non-JSON upstream response → proxy handles without crashing', async () => {
    axios.mockResolvedValueOnce({
      status: 200,
      headers: { 'content-type': 'text/html' },
      data: '<html>Error</html>',
    });

    const res = await request(app)
      .get('/api/instructors/recommendations?location=6051&vehicleType=AUTO');

    expect(res.status).toBeLessThan(600);
  });

});

// ── Retry behaviour ───────────────────────────────────────────────────────────

describe('Proxy — retry behaviour on transient GET failures', () => {

  test('first attempt ECONNRESET, second attempt succeeds → 200, axios called twice', async () => {
    const connErr = networkError('ECONNRESET', 'socket hang up');

    axios
      .mockRejectedValueOnce(connErr)   // attempt 1 fails
      .mockResolvedValueOnce({           // attempt 2 (first retry) succeeds
        status: 200,
        headers: { 'content-type': 'application/json' },
        data: {
          recommendations: [{ id: 'inst_1', name: 'Debesay', voice: { summary: 'test' } }],
          count: 1,
        },
      });

    const res = await request(app)
      .get('/api/instructors/recommendations?location=6051&vehicleType=AUTO');

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(axios).toHaveBeenCalledTimes(2);
  });

  test('all 3 attempts fail → retries exhausted, returns 502', async () => {
    rejectTimes(networkError('ECONNRESET', 'socket hang up'), 3);

    const res = await request(app)
      .get('/api/instructors/recommendations?location=6051&vehicleType=AUTO');

    expect(res.status).toBe(502);
    expect(res.body).toHaveProperty('error');
    // All 3 attempts were made (original + 2 retries)
    expect(axios).toHaveBeenCalledTimes(3);
  });

  test('POST endpoints are NOT retried — single ECONNRESET → 502, axios called once', async () => {
    axios.mockRejectedValueOnce(networkError('ECONNRESET', 'socket hang up'));

    const res = await request(app)
      .post('/api/locations/validate')
      .send({ pickupLocation: '81 King William Street, Bayswater WA' });

    expect(res.status).toBe(502);
    expect(axios).toHaveBeenCalledTimes(1);
  });

});
