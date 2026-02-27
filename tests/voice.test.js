const request = require('supertest');
// mock database service before loading anything that imports it
jest.mock('../services/database-service', () => ({
  prisma: {
    booking: { findFirst: jest.fn() },
    message: { create: jest.fn() },
    $disconnect: jest.fn(() => Promise.resolve())
  }
}));
const db = require('../services/database-service');
const app = require('../server');

jest.mock('../services/instructor-service', () => ({
  findInstructorByPhone: jest.fn()
}));

const instrService = require('../services/instructor-service');

describe('Voice webhook', () => {
  afterAll(async () => {
    await db.prisma.$disconnect();
  });

  test('returns TwiML and routes to voicemail when instructor not found', async () => {
    instrService.findInstructorByPhone.mockResolvedValue(null);
    const res = await request(app).post('/api/voice/incoming').send({ From: '+61400000000', To: '+61411111111' });
    expect(res.status).toBe(200);
    expect(res.type).toBe('text/xml');
    expect(res.text).toContain('<Response>');
  });
});
