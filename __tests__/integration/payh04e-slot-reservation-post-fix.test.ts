/**
 * PAY-H-04-E: SlotReservation Post-Fix Verification
 *
 * PURPOSE:
 * Prove that the two acceptance invariants hold after the PAY-H-04 fix:
 *
 *   INVARIANT: For a given providerId, no two SlotReservation rows may have
 *   overlapping [startTime, endTime) intervals, regardless of sequential retries
 *   or concurrent first requests.
 *
 * ARCHITECTURE: Same as PAY-H-04-B (baseline) — real HTTP through Next.js.
 *   Vitest -> Supertest -> Next.js (localhost:3001)
 *     -> check-and-reserve/route.ts (with PAY-H-04 fix applied)
 *     -> Prisma -> isolated PostgreSQL (localhost:5433/drivebook_test)
 *        WITH: btree_gist installed + SlotReservation_no_overlap constraint
 *
 * CRITICAL PRE-CONDITION:
 *   The test database must have the PAY-H-04 migration applied:
 *     CREATE EXTENSION IF NOT EXISTS btree_gist;
 *     EXCLUDE USING GIST (providerId WITH =, tsrange(startTime, endTime, '[)') WITH &&)
 *   The runner script applies this automatically via prisma db push.
 *
 * PASS CRITERIA (what proves the fix works):
 *   E1: Concurrent overlapping reservations — at most 1 succeeds (was: both succeeded)
 *   E2: Concurrent same-interval — at most 1 succeeds (was: both succeeded)
 *   E3: Sequential overlapping — still blocked (regression guard)
 *   E4: Adjacent boundary slots — both still succeed (regression guard)
 *   E5: Concurrent non-overlapping — both still succeed (regression guard)
 *   E6: Reserve/release/re-reserve lifecycle — still works (regression guard)
 *
 * EXECUTION:  .\scripts\run-payh04e-http-tests.ps1
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { prisma } from '@/lib/prisma';

const TEST_SERVER_URL = process.env.TEST_SERVER_URL || 'http://localhost:3001';
const TEST_PREFIX = `payh04e_${Date.now()}`;
const TEST_DATE = '2027-07-20';

let testProviderId: string;
let testUserId: string;

// ── Helpers ───────────────────────────────────────────────────────────────────

function reserve(providerId: string, time: string, duration: number, sessionId: string) {
  return request(TEST_SERVER_URL)
    .post('/api/availability/check-and-reserve')
    .send({ providerId, date: TEST_DATE, time, duration, sessionId });
}

function release(providerId: string, time: string, duration: number, sessionId: string) {
  const params = new URLSearchParams({
    providerId, date: TEST_DATE, time, duration: String(duration), sessionId,
  });
  return request(TEST_SERVER_URL)
    .delete(`/api/availability/check-and-reserve?${params}`);
}

async function activeReservations(providerId: string) {
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

// ── Setup / Teardown ──────────────────────────────────────────────────────────

describe('PAY-H-04-E: SlotReservation Post-Fix Verification (HTTP)', () => {

  beforeAll(async () => {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl?.includes('drivebook_test')) {
      throw new Error(`SAFETY: DATABASE_URL must point to drivebook_test. Got: ${dbUrl?.substring(0, 60)}`);
    }
    console.log(`[PAY-H04E] DB: ${dbUrl.substring(0, 70)}...`);
    console.log(`[PAY-H04E] Server: ${TEST_SERVER_URL}`);

    // Verify server reachable
    const probe = await request(TEST_SERVER_URL).get('/api/health').timeout(5000);
    if (probe.status !== 200) throw new Error(`Server not ready: ${probe.status}`);

    // Verify constraint is installed before running tests
    const constraintCheck = await prisma.$queryRaw<Array<{ conname: string }>>`
      SELECT conname FROM pg_constraint
      WHERE conname = 'SlotReservation_no_overlap'
    `;
    if (constraintCheck.length === 0) {
      throw new Error(
        'PAY-H-04 constraint SlotReservation_no_overlap is NOT installed. ' +
        'Apply migration 20260922000001_payh04_slot_reservation_no_overlap first.'
      );
    }
    console.log('[PAY-H04E] Constraint SlotReservation_no_overlap: confirmed present');

    // Create test provider
    const user = await prisma.user.create({
      data: {
        email: `${TEST_PREFIX}_provider@test.com`,
        name: 'PAY-H04E Test Provider',
        role: 'CLIENT',
        emailVerified: true,
      },
    });
    const provider = await prisma.provider.create({
      data: {
        userId: user.id,
        name: 'PAY-H04E Test Provider',
        phone: '0400000002',
        hourlyRate: 90,
        isActive: true,
        timezone: 'Australia/Perth',
      },
    });
    testProviderId = provider.id;
    testUserId = user.id;
    console.log(`[PAY-H04E] Provider: ${testProviderId}`);
  });

  beforeEach(async () => {
    await prisma.slotReservation.deleteMany({ where: { providerId: testProviderId } });
  });

  afterAll(async () => {
    console.log('[PAY-H04E] Cleaning up...');
    await prisma.slotReservation.deleteMany({ where: { providerId: testProviderId } });
    await prisma.provider.deleteMany({ where: { id: testProviderId } });
    await prisma.user.delete({ where: { id: testUserId } });
    console.log('[PAY-H04E] Cleanup complete.');
  });

  // ── E1: Concurrent overlapping — INVARIANT PROOF ─────────────────────────

  describe('E1: Concurrent overlapping reservations — INVARIANT (was RACE in baseline)', () => {
    it('at most one request succeeds — overlapping rows no longer committed', async () => {
      const sessionA = `${TEST_PREFIX}_E1_sessA`;
      const sessionB = `${TEST_PREFIX}_E1_sessB`;

      const [resA, resB] = await Promise.all([
        reserve(testProviderId, '10:00', 60, sessionA),  // 10:00–11:00
        reserve(testProviderId, '10:30', 60, sessionB),  // 10:30–11:30 (overlaps)
      ]);

      const rows = await activeReservations(testProviderId);

      console.log(`[E1] Request A (10:00–11:00): ${resA.status}`);
      console.log(`[E1] Request B (10:30–11:30): ${resB.status}`);
      console.log(`[E1] Active reservation rows: ${rows.length}`);
      rows.forEach(r => console.log(`[E1]   row: ${r.sessionId.slice(-4)} start=${r.startTime.toISOString()} end=${r.endTime.toISOString()}`));

      // INVARIANT: at most one overlapping reservation may be committed
      expect(rows.length).toBeLessThanOrEqual(1);

      // At least one must receive a definitive (non-5xx) response
      expect(resA.status).toBeLessThan(500);
      expect(resB.status).toBeLessThan(500);

      // Exactly one must succeed (200); the other must be rejected (409)
      const statuses = [resA.status, resB.status].sort();
      if (rows.length === 0) {
        // Both serialised before either committed — both 409
        console.log('[E1] OUTCOME: both rejected (race serialised before commit)');
        expect(statuses).toEqual([409, 409]);
      } else {
        // Exactly one committed
        console.log('[E1] OUTCOME: exactly one succeeded, one rejected');
        expect(statuses).toContain(200);
        expect(statuses).toContain(409);
      }

      // If two rows exist the invariant is violated — this is the key assertion
      if (rows.length === 2) {
        const overlap = rows[0].startTime < rows[1].endTime && rows[1].startTime < rows[0].endTime;
        console.log(`[E1] INVARIANT VIOLATED: 2 rows, overlap=${overlap}`);
      }
      // The expect above already asserts length <= 1; this is belt-and-suspenders
      expect(rows.length).not.toBe(2);
    });
  });

  // ── E2: Concurrent same-interval — INVARIANT PROOF ───────────────────────

  describe('E2: Concurrent same-interval different sessions — INVARIANT (was RACE in baseline)', () => {
    it('at most one request succeeds — identical interval not committed twice', async () => {
      const sessionA = `${TEST_PREFIX}_E2_sessA`;
      const sessionB = `${TEST_PREFIX}_E2_sessB`;

      const [resA, resB] = await Promise.all([
        reserve(testProviderId, '13:00', 60, sessionA),
        reserve(testProviderId, '13:00', 60, sessionB),
      ]);

      const rows = await activeReservations(testProviderId);

      console.log(`[E2] Request A (13:00–14:00): ${resA.status}`);
      console.log(`[E2] Request B (13:00–14:00): ${resB.status}`);
      console.log(`[E2] Active reservation rows: ${rows.length}`);

      expect(rows.length).toBeLessThanOrEqual(1);
      expect(resA.status).toBeLessThan(500);
      expect(resB.status).toBeLessThan(500);
      expect(rows.length).not.toBe(2);
    });
  });

  // ── E3: Sequential overlap — regression guard ─────────────────────────────

  describe('E3: Sequential overlapping — regression guard (must still block)', () => {
    it('second sequential reservation is still blocked', async () => {
      const sessionA = `${TEST_PREFIX}_E3_sessA`;
      const sessionB = `${TEST_PREFIX}_E3_sessB`;

      const resA = await reserve(testProviderId, '10:00', 60, sessionA);
      expect(resA.status).toBe(200);

      const resB = await reserve(testProviderId, '10:30', 60, sessionB);
      const rows = await activeReservations(testProviderId);

      console.log(`[E3] A (10:00–11:00): ${resA.status}  B (10:30–11:30): ${resB.status}  rows: ${rows.length}`);
      expect(resB.status).toBe(409);
      expect(rows.length).toBe(1);
    });
  });

  // ── E4: Adjacent boundary — regression guard ──────────────────────────────

  describe('E4: Adjacent boundary slots — regression guard (must still succeed)', () => {
    it('10:00–11:00 and 11:00–12:00 both succeed', async () => {
      const sessionA = `${TEST_PREFIX}_E4_sessA`;
      const sessionB = `${TEST_PREFIX}_E4_sessB`;

      const resA = await reserve(testProviderId, '10:00', 60, sessionA);
      const resB = await reserve(testProviderId, '11:00', 60, sessionB);
      const rows = await activeReservations(testProviderId);

      console.log(`[E4] A (10:00–11:00): ${resA.status}  B (11:00–12:00): ${resB.status}  rows: ${rows.length}`);
      expect(resA.status).toBe(200);
      expect(resB.status).toBe(200);
      expect(rows.length).toBe(2);
    });
  });

  // ── E5: Concurrent non-overlapping — regression guard ────────────────────

  describe('E5: Concurrent non-overlapping — regression guard (must both succeed)', () => {
    it('09:00 and 11:00 slots succeed concurrently', async () => {
      const sessionA = `${TEST_PREFIX}_E5_sessA`;
      const sessionB = `${TEST_PREFIX}_E5_sessB`;

      const [resA, resB] = await Promise.all([
        reserve(testProviderId, '09:00', 60, sessionA),
        reserve(testProviderId, '11:00', 60, sessionB),
      ]);

      const rows = await activeReservations(testProviderId);
      console.log(`[E5] A (09:00–10:00): ${resA.status}  B (11:00–12:00): ${resB.status}  rows: ${rows.length}`);
      expect(resA.status).toBe(200);
      expect(resB.status).toBe(200);
      expect(rows.length).toBe(2);
    });
  });

  // ── E6: Reserve/release/re-reserve — regression guard ────────────────────

  describe('E6: Reserve then release lifecycle — regression guard', () => {
    it('after release, slot is available to a different session', async () => {
      const sessionA = `${TEST_PREFIX}_E6_sessA`;
      const sessionB = `${TEST_PREFIX}_E6_sessB`;

      const resA = await reserve(testProviderId, '15:00', 60, sessionA);
      expect(resA.status).toBe(200);

      const blocked = await reserve(testProviderId, '15:00', 60, sessionB);
      expect(blocked.status).toBe(409);

      const rel = await release(testProviderId, '15:00', 60, sessionA);
      expect(rel.status).toBe(200);

      const resB = await reserve(testProviderId, '15:00', 60, sessionB);
      const rows = await activeReservations(testProviderId);

      console.log(`[E6] Re-reserve after release: ${resB.status}  rows: ${rows.length}`);
      expect(resB.status).toBe(200);
      expect(rows.length).toBe(1);
      expect(rows[0].sessionId).toBe(sessionB);
    });
  });

});
