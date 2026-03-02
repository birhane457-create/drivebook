const request = require('supertest');
// prevent. Prisma initialization during tests by mocking database service
jest.mock('../services/database-service', () => ({
  prisma: {
    booking: { findFirst: jest.fn() },
    message: { create: jest.fn() },
    instructor: { findFirst: jest.fn() },
    $disconnect: jest.fn(() => Promise.resolve())
  }
}));
const db = require('../services/database-service');
const app = require('../server');

jest.mock('../services/sms-service', () => ({ sendBookingConfirmation: jest.fn(() => Promise.resolve({ success: true })) }));

describe('Booking API', () => {
  afterAll(async () => {
    await db.prisma.$disconnect();
  });

  test('validation failure for bad phone', async () => {
    const res = await request(app).post('/api/bookings').send({
      instructorId: '1', clientName: 'Jo', clientPhone: 'badphone', date: '2050-01-01', time: '09:00', duration: 60
    });
    expect(res.status).toBe(400);
  });
});
