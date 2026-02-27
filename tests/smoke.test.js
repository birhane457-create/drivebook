/**
 * Smoke Test Suite
 * Tests critical endpoints without mocking (integration test)
 * Run with: npm test -- smoke.test.js
 */

const request = require('supertest');
const app = require('../server');

describe('Smoke Tests - Live Integration', () => {
  /**
   * Health endpoint - essential for load balancers and monitoring
   */
  test('GET /api/health returns 200 with status ok', async () => {
    const res = await request(app)
      .get('/api/health')
      .expect(200)
      .expect('Content-Type', /json/);

    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('uptime');
    expect(typeof res.body.uptime).toBe('number');
  });

  /**
   * Voice webhook - simulates Twilio POST
   */
  test('POST /api/voice/incoming returns valid TwiML on instructor not found', async () => {
    const res = await request(app)
      .post('/api/voice/incoming')
      .send({
        From: '+61400000000',
        To: '+61411111111'
      })
      .expect(200)
      .expect('Content-Type', /xml/);

    expect(res.text).toContain('<?xml');
    expect(res.text).toContain('<Response>');
    expect(res.text).toContain('Record');
    expect(res.text).toContain('/api/voice/voicemail');
  });

  /**
   * Booking API - return 400 on bad validation
   */
  test('POST /api/bookings returns 400 on invalid phone', async () => {
    const res = await request(app)
      .post('/api/bookings')
      .send({
        instructorId: 'inst-123',
        clientName: 'John',
        clientPhone: 'badphone', // invalid
        date: '2050-01-01',
        time: '09:00',
        duration: 60
      });

    expect(res.status).toBe(400);
  });

  /**
   * Booking API - return 400 on past date
   */
  test('POST /api/bookings returns 400 on past date', async () => {
    const res = await request(app)
      .post('/api/bookings')
      .send({
        instructorId: 'inst-123',
        clientName: 'John',
        clientPhone: '+61412345678',
        date: '2000-01-01', // past
        time: '09:00',
        duration: 60
      });

    expect(res.status).toBe(400);
  });

  /**
   * Booking API - return 400 on invalid time (out of hours)
   */
  test('POST /api/bookings returns 400 on out-of-hours time', async () => {
    const res = await request(app)
      .post('/api/bookings')
      .send({
        instructorId: 'inst-123',
        clientName: 'John',
        clientPhone: '+61412345678',
        date: '2050-01-01',
        time: '23:00', // after 20:00 (8pm)
        duration: 60
      });

    expect(res.status).toBe(400);
  });

  /**
   * Instructor lookup - return 404 if not found
   */
  test('GET /api/instructor/lookup returns 404 on unknown phone', async () => {
    const res = await request(app)
      .get('/api/instructor/lookup?phone=%2B61499999999')
      .expect(404);

    expect(res.body).toHaveProperty('error');
  });
});
