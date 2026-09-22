/**
 * PAY-H-04-B: SlotReservation Concurrent Race — Hostile Baseline
 *
 * PURPOSE:
 * Demonstrate that the unprotected check-and-reserve endpoint (Path A) allows
 * two concurrent requests to both create overlapping SlotReservation rows,
 * proving the TOCTOU race under real HTTP conditions.
 *
 * ARCHITECTURE:
 *   Vitest -> Supertest HTTP -> Next.js (localhost:3001)
 *     -> check-and-reserve/route.ts (no auth, public endpoint)
 *     -> Prisma -> isolated PostgreSQL (localhost:5433/drivebook_test)
 *
 * ROUTES UNDER TEST:
 *   POST /api/availability/check-and-reserve
 *
 * NO PRODUCTION CODE IS MODIFIED. Tests the existing unprotected route.
 *
 * BASELINE EVIDENCE REQUIRED:
 *   B1: Concurrent overlapping reservations — both succeed (VULNERABLE)
 *   B2: Concurrent identical interval, different sessionIds — both succeed (VULNERABLE)
 *   B3: Sequential overlapping reservations — second blocked correctly (control)
 *   B4: Back-to-back adjacent slots — both succeed (boundary semantics must be preserved)
 *   B5: Concurrent non-overlapping — both succeed (legitimate concurrent operations)
 *   B6: Single reservation then release — slot becomes available (lifecycle test)
 *
 * DATABASE: postgresql://postgres:testpass@localhost:5433/drivebook_test
 * EXECUTION: .\scripts\run-payh04b-http-tests.ps1
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { prisma } from '@/lib/prisma';

const TEST_SERVER_URL = process.env.TEST_SERVER_URL || 'http://localhost:3001';
const TEST_PREFIX = `payh04b_${Date.now()}`;

// Fixed future date for all tests — must be after 2026-09-22 to avoid past-date issues
const TEST_DATE = '2027-06-15';

let testProviderId: string;

// Helper: reserve a slot via HTTP
function reserve(
  providerId: string,
  time: string,
  duration: number,
  sessionId: string
) {
  return request(TEST_SERVER_URL)
    .post('/api/availability/check-and-reserve')
    .send({ providerId, date: TEST_DATE, time, duration, sessionId });
}

// Helper: release a slot via HTTP
function release(
  providerId: string,
  time: string,
  duration: number,
  sessionId: string
) {
  const params = new URLSearchParams({
    providerId,
    date: TEST_DATE,
    time,
    duration: String(duration),
    sessionId,
  });
  return request(TEST_SERVER_URL)
    .delete(`/api/availability/check-and-reserve?${params}`);
}

// Helper: count active SlotReservation rows for this provider on the test date
async function activeReservationCount(
  providerId: string,
  startHour: number
): Promise<number> {
  const datePrefix = `2027-06-15T${String(startHour).padStart(2, '0')}`;
  const rows = await prisma.slotReservation.count({
    where: {
      providerId,
      expiresAt: { gt: new Date() },
      startTime: { gte: new Date(`${TEST_DATE}T00:00:00.000Z`) },
    },
  });
  return rows;
}

// Helper: get all active SlotReservation rows for this provider on the test date
async function getActiveReservations(providerId: string) {
  return prisma.slotReservation.findMany({
    where: {
      providerId,
      expiresAt: { gt: new Date() },
      startTime: { gte: new Date(`${TEST_DATE}T00:00:00.000Z`) },
    },
    select: { id: true, sessionId: true, startTime: true, endTime: true },
    orderBy: { startTime: 'asc' },
  });
}

describe('PAY-H-04-B: SlotReservation Concurrent Race (HTTP Hostile Baseline)', () => {

  beforeAll(async () => {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl?.includes('drivebook_test')) {
      throw new Error(`SAFETY: DATABASE_URL must point to drivebook_test. Got: ${dbUrl?.substring(0, 60)}`);
    }
    console.log(`[PAY-H04B] DB: ${dbUrl.substring(0, 70)}...`);
    console.log(`[PAY-H04B] Server: ${TEST_SERVER_URL}`);
    console.log(`[PAY-H04B] Test date: ${TEST_DATE}`);

    // Verify server reachable
    const probe = await request(TEST_SERVER_URL).get('/api/health').timeout(5000);
    if (probe.status !== 200) throw new Error(`Server not ready: ${probe.status}`);

    // Create a test provider (needed for the FK on SlotReservation)
    const user = await prisma.user.create({
      data: {
        email: `${TEST_PREFIX}_provider@test.com`,
        name: 'PAY-H04B Test Provider',
        role: 'CLIENT',
        emailVerified: true,
      },
    });

    const provider = await prisma.provider.create({
      data: {
        userId: user.id,
        name: 'PAY-H04B Test Provider',
        phone: '0400000000',
        hourlyRate: 90,
        isActive: true,
        timezone: 'Australia/Perth',
      },
    });

    testProviderId = provider.id;
    console.log(`[PAY-H04B] Provider ID: ${testProviderId}`);
  });

  beforeEach(async () => {
    // Clear all SlotReservation rows for this provider between tests
    await prisma.slotReservation.deleteMany({ where: { providerId: testProviderId } });
  });

  afterAll(async () => {
    console.log('[PAY-H04B] Cleaning up...');
    await prisma.slotReservation.deleteMany({ where: { providerId: testProviderId } });
    await prisma.provider.deleteMany({ where: { id: testProviderId } });
    const provider = await prisma.provider.findUnique({ where: { id: testProviderId }, select: { userId: true } });
    if (provider?.userId) {
      await prisma.user.delete({ where: { id: provider.userId } });
    }
    console.log('[PAY-H04B] Cleanup complete.');
  });

  // ── B1: Concurrent overlapping reservations ─────────────────────────────

  describe('B1: Concurrent overlapping reservations (TOCTOU VULNERABLE)', () => {
    it('both concurrent requests succeed — two overlapping rows committed (RACE CONFIRMED)', async () => {
      // Session A: 10:00–11:00
      // Session B: 10:30–11:30  (overlaps A by 30 minutes)
      const sessionA = `${TEST_PREFIX}_B1_sessA`;
      const sessionB = `${TEST_PREFIX}_B1_sessB`;

      const [resA, resB] = await Promise.all([
        reserve(testProviderId, '10:00', 60, sessionA),
        reserve(testProviderId, '10:30', 60, sessionB),
      ]);

      const rows = await getActiveReservations(testProviderId);

      console.log(`[B1] Request A (10:00–11:00): ${resA.status}`);
      console.log(`[B1] Request B (10:30–11:30): ${resB.status}`);
      console.log(`[B1] Active reservation rows: ${rows.length}`);
      rows.forEach(r => console.log(`[B1]   row: ${r.sessionId.slice(-4)} startTime=${r.startTime.toISOString()} endTime=${r.endTime.toISOString()}`));

      // EVIDENCE: Under the race, both requests return 200
      // and two overlapping rows exist in the database.
      expect(resA.status).toBe(200);
      expect(resB.status).toBe(200);

      // VULNERABLE: two rows committed with overlapping intervals
      expect(rows.length).toBe(2);

      // Verify they actually overlap (startA < endB AND startB < endA)
      const rowA = rows.find(r => r.sessionId === sessionA);
      const rowB = rows.find(r => r.sessionId === sessionB);
      expect(rowA).toBeDefined();
      expect(rowB).toBeDefined();

      const overlaps =
        rowA!.startTime < rowB!.endTime &&
        rowB!.startTime < rowA!.endTime;
      console.log(`[B1] Intervals overlap: ${overlaps}`);
      expect(overlaps).toBe(true);
    });
  });

  // ── B2: Concurrent same-interval, different sessions ────────────────────

  describe('B2: Concurrent same-interval different sessionIds (TOCTOU VULNERABLE)', () => {
    it('both requests succeed — same interval reserved twice (RACE CONFIRMED)', async () => {
      const sessionA = `${TEST_PREFIX}_B2_sessA`;
      const sessionB = `${TEST_PREFIX}_B2_sessB`;

      // Both want exactly 10:00–11:00
      const [resA, resB] = await Promise.all([
        reserve(testProviderId, '10:00', 60, sessionA),
        reserve(testProviderId, '10:00', 60, sessionB),
      ]);

      const rows = await getActiveReservations(testProviderId);

      console.log(`[B2] Request A (10:00–11:00): ${resA.status}`);
      console.log(`[B2] Request B (10:00–11:00): ${resB.status}`);
      console.log(`[B2] Active reservation rows: ${rows.length}`);

      expect(resA.status).toBe(200);
      expect(resB.status).toBe(200);
      // VULNERABLE: identical intervals, both committed
      expect(rows.length).toBe(2);
    });
  });

  // ── B3: Sequential overlapping — control ────────────────────────────────

  describe('B3: Sequential overlapping reservations (CONTROL — should block)', () => {
    it('second sequential reservation is blocked by existing active reservation', async () => {
      const sessionA = `${TEST_PREFIX}_B3_sessA`;
      const sessionB = `${TEST_PREFIX}_B3_sessB`;

      // First reservation succeeds
      const resA = await reserve(testProviderId, '10:00', 60, sessionA);
      expect(resA.status).toBe(200);

      // Second (overlapping) reservation, different session, sequential
      const resB = await reserve(testProviderId, '10:30', 60, sessionB);

      const rows = await getActiveReservations(testProviderId);

      console.log(`[B3] Request A (10:00–11:00): ${resA.status}`);
      console.log(`[B3] Request B (10:30–11:30): ${resB.status}`);
      console.log(`[B3] Active reservation rows: ${rows.length}`);

      // CONTROL: sequential check-then-create works correctly
      // The race only occurs under concurrency, not sequentially
      expect(resB.status).toBe(409);
      expect(rows.length).toBe(1);
    });
  });

  // ── B4: Back-to-back adjacent slots ─────────────────────────────────────

  describe('B4: Back-to-back adjacent slots (boundary semantics — must NOT conflict)', () => {
    it('10:00–11:00 then 11:00–12:00 — both succeed (strict < boundary preserved)', async () => {
      const sessionA = `${TEST_PREFIX}_B4_sessA`;
      const sessionB = `${TEST_PREFIX}_B4_sessB`;

      const resA = await reserve(testProviderId, '10:00', 60, sessionA);
      const resB = await reserve(testProviderId, '11:00', 60, sessionB);

      const rows = await getActiveReservations(testProviderId);

      console.log(`[B4] Request A (10:00–11:00): ${resA.status}`);
      console.log(`[B4] Request B (11:00–12:00): ${resB.status}`);
      console.log(`[B4] Active reservation rows: ${rows.length}`);

      // Boundary semantics: adjacent slots must not conflict
      expect(resA.status).toBe(200);
      expect(resB.status).toBe(200);
      expect(rows.length).toBe(2);
    });
  });

  // ── B5: Concurrent non-overlapping ──────────────────────────────────────

  describe('B5: Concurrent non-overlapping slots (legitimate operations — must both succeed)', () => {
    it('concurrent 09:00 and 11:00 slots — both succeed (no false conflict)', async () => {
      const sessionA = `${TEST_PREFIX}_B5_sessA`;
      const sessionB = `${TEST_PREFIX}_B5_sessB`;

      const [resA, resB] = await Promise.all([
        reserve(testProviderId, '09:00', 60, sessionA),
        reserve(testProviderId, '11:00', 60, sessionB),
      ]);

      const rows = await getActiveReservations(testProviderId);

      console.log(`[B5] Request A (09:00–10:00): ${resA.status}`);
      console.log(`[B5] Request B (11:00–12:00): ${resB.status}`);
      console.log(`[B5] Active reservation rows: ${rows.length}`);

      expect(resA.status).toBe(200);
      expect(resB.status).toBe(200);
      expect(rows.length).toBe(2);
    });
  });

  // ── B6: Reserve then release lifecycle ──────────────────────────────────

  describe('B6: Reserve then release — slot becomes available (lifecycle)', () => {
    it('after release, same slot can be reserved by a different session', async () => {
      const sessionA = `${TEST_PREFIX}_B6_sessA`;
      const sessionB = `${TEST_PREFIX}_B6_sessB`;

      // Reserve
      const resA = await reserve(testProviderId, '10:00', 60, sessionA);
      expect(resA.status).toBe(200);

      // Verify blocked
      const blocked = await reserve(testProviderId, '10:00', 60, sessionB);
      expect(blocked.status).toBe(409);

      // Release
      const rel = await release(testProviderId, '10:00', 60, sessionA);
      console.log(`[B6] Release: ${rel.status}`);
      expect(rel.status).toBe(200);

      // Now session B can reserve
      const resB = await reserve(testProviderId, '10:00', 60, sessionB);
      console.log(`[B6] Re-reserve after release: ${resB.status}`);
      expect(resB.status).toBe(200);

      const rows = await getActiveReservations(testProviderId);
      expect(rows.length).toBe(1);
      expect(rows[0].sessionId).toBe(sessionB);
    });
  });

});
