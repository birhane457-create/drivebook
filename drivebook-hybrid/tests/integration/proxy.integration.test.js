const request = require('supertest');
const express = require('express');

jest.setTimeout(20000);

let mockServer;
let app;

beforeAll(async () => {
  // Use a test-specific mock port to avoid collisions with running dev mock
  process.env.MOCK_DRIVEBOOK_PORT = process.env.MOCK_DRIVEBOOK_PORT || '3005';
  // Ensure proxy client points to the mock backend
  process.env.DRIVEBOOK_BASE_URL = `http://localhost:${process.env.MOCK_DRIVEBOOK_PORT}`;

  // Start mock DriveBook backend
  const mockApp = require('../../mock-drivebook-server');
  mockServer = mockApp.listen(Number(process.env.MOCK_DRIVEBOOK_PORT));

  // Create an express app mounting the proxy router directly to avoid global middleware
  app = express();
  app.use(express.json());
  const proxyRouter = require('../../routes/main-app-proxy');
  app.use('/api', proxyRouter);
});

afterAll(async () => {
  if (mockServer && mockServer.close) {
    await new Promise((resolve) => mockServer.close(resolve));
  }
});

test('GET /api/instructors/recommendations returns recommendations via proxy', async () => {
  const res = await request(app).get('/api/instructors/recommendations?location=Joondalup%20WA');
  expect(res.status).toBe(200);
  expect(res.body).toHaveProperty('recommendations');
  expect(Array.isArray(res.body.recommendations)).toBe(true);
});

test('POST /api/public/bookings/bulk creates booking via proxy', async () => {
  const payload = {
    instructorQuery: 'Debesay',
    packageType: 'PACKAGE_6',
    bookingType: 'later',
    registrationType: 'myself',
    accountHolderName: 'Test User',
    accountHolderEmail: 'test@example.com',
    accountHolderPhone: '+61123456789',
    scheduledBookings: [{ date: '2026-06-01', time: '09:00', duration: 60, pickupLocation: 'Joondalup WA' }]
  };

  const res = await request(app)
    .post('/api/public/bookings/bulk')
    .send(payload)
    .set('Content-Type', 'application/json');

  expect(res.status).toBe(200);
  expect(res.body).toHaveProperty('success', true);
  expect(res.body).toHaveProperty('bookingId');
});
