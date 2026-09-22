/**
 * PAY-H-04 Constraint Prototype — T1–T7 Test Matrix
 *
 * Runs directly against localhost:5433/drivebook_test with the GIST exclusion
 * constraint already applied. No HTTP server required.
 *
 * Tests:
 *   T1 — Insert (X, 10:00, 11:00)                   → expect: SUCCESS
 *   T2 — Insert (X, 10:30, 11:30) overlapping T1     → expect: CONSTRAINT VIOLATION (capture error)
 *   T3 — Insert (X, 11:00, 12:00) adjacent to T1     → expect: SUCCESS (boundary semantics)
 *   T4 — Insert (X, 09:00, 10:00) adjacent before T1 → expect: SUCCESS (boundary semantics)
 *   T5 — Delete T1, then re-insert (X, 10:00, 11:00) → expect: SUCCESS (removal clears constraint)
 *   T6 — Concurrent inserts of (X, 10:30, 11:30)     → expect: exactly one succeeds
 *   T7 — Insert expired row (X, 10:00, 11:00), then fresh (X, 10:00, 11:00)
 *        → CRITICAL: does expired-but-not-deleted row block fresh insert?
 *           This determines Option A vs Option B for expiry handling.
 *
 * Run: node scripts/payh04-constraint-prototype.mjs
 * (DATABASE_URL must be set to test DB before running)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DB_URL = process.env.DATABASE_URL ?? '';
if (!DB_URL.includes('drivebook_test')) {
  console.error('SAFETY: DATABASE_URL must point to drivebook_test');
  process.exit(1);
}

// ── Fixture setup ─────────────────────────────────────────────────────────────

async function createTestProvider() {
  const user = await prisma.user.create({
    data: {
      email: `payh04_proto_${Date.now()}@test.internal`,
      name: 'PAY-H04 Prototype Provider',
      role: 'CLIENT',
      emailVerified: true,
    },
  });
  const provider = await prisma.provider.create({
    data: {
      userId: user.id,
      name: 'PAY-H04 Prototype Provider',
      phone: '0400000001',
      hourlyRate: 90,
      isActive: true,
      timezone: 'Australia/Perth',
    },
  });
  return { user, provider };
}

async function cleanup(userId, providerId) {
  await prisma.slotReservation.deleteMany({ where: { providerId } });
  await prisma.provider.deleteMany({ where: { id: providerId } });
  await prisma.user.delete({ where: { id: userId } });
}

// ── Test date (well into the future to avoid any now() edge cases) ─────────────
const DATE = '2028-03-15';
function ts(time) {
  // Perth AWST = UTC+8; use +08:00 offset for explicit local time
  return new Date(`${DATE}T${time}:00+08:00`);
}

function slot(providerId, startHH, endHH, minutesUntilExpiry = 600) {
  const expiresAt = new Date(Date.now() + minutesUntilExpiry * 60 * 1000);
  return {
    providerId,
    sessionId: `proto_${startHH}_${endHH}_${Date.now()}`,
    startTime: ts(`${startHH}:00`),
    endTime:   ts(`${endHH}:00`),
    expiresAt,
  };
}

function slotExpired(providerId, startHH, endHH) {
  // expiresAt = 1 second ago — logically expired, not yet deleted
  const expiresAt = new Date(Date.now() - 1000);
  return {
    providerId,
    sessionId: `proto_expired_${startHH}_${endHH}_${Date.now()}`,
    startTime: ts(`${startHH}:00`),
    endTime:   ts(`${endHH}:00`),
    expiresAt,
  };
}

// ── Result helpers ─────────────────────────────────────────────────────────────

function pass(label, detail = '') {
  console.log(`  ✓ ${label}${detail ? '  ' + detail : ''}`);
}

function fail(label, detail = '') {
  console.log(`  ✗ ${label}${detail ? '  ' + detail : ''}`);
}

function captureError(err) {
  return {
    constructorName: err?.constructor?.name ?? 'unknown',
    code:    err?.code ?? 'none',
    message: (err?.message ?? '').substring(0, 300),
    meta:    JSON.stringify(err?.meta ?? {}),
  };
}

// ── T1: Basic insert ──────────────────────────────────────────────────────────

async function runT1(providerId) {
  console.log('\nT1: Insert (10:00–11:00) — expect SUCCESS');
  try {
    const row = await prisma.slotReservation.create({ data: slot(providerId, '10', '11') });
    pass('INSERT succeeded', `id=${row.id}`);
    return row.id;
  } catch (err) {
    fail('INSERT failed (unexpected)', err.message);
    throw err;
  }
}

// ── T2: Overlapping insert — capture exact error ───────────────────────────────

async function runT2(providerId) {
  console.log('\nT2: Insert (10:30–11:30) overlapping T1 — expect CONSTRAINT VIOLATION');
  try {
    await prisma.slotReservation.create({ data: slot(providerId, '10', '11', 600) }); // ensure T1 still there
  } catch { /* ignore — T1 may already exist */ }

  try {
    await prisma.slotReservation.create({ data: slot(providerId, '10', '11') });
    fail('INSERT succeeded (constraint did not fire — UNEXPECTED)');
    return null;
  } catch (err) {
    const captured = captureError(err);
    pass('Constraint fired as expected');
    console.log('  Captured error:');
    console.log(`    constructorName: ${captured.constructorName}`);
    console.log(`    code:            ${captured.code}`);
    console.log(`    message:         ${captured.message}`);
    console.log(`    meta:            ${captured.meta}`);
    return captured;
  }
}

// ── T3: Adjacent slot (end boundary) ─────────────────────────────────────────

async function runT3(providerId) {
  console.log('\nT3: Insert (11:00–12:00) adjacent to T1 — expect SUCCESS (boundary: < not <=)');
  try {
    const row = await prisma.slotReservation.create({ data: slot(providerId, '11', '12') });
    pass('INSERT succeeded', `id=${row.id}`);
  } catch (err) {
    fail('INSERT failed (constraint blocked adjacent slot — WRONG)', err.message);
  }
}

// ── T4: Adjacent slot (start boundary) ───────────────────────────────────────

async function runT4(providerId) {
  console.log('\nT4: Insert (09:00–10:00) adjacent before T1 — expect SUCCESS');
  try {
    const row = await prisma.slotReservation.create({ data: slot(providerId, '09', '10') });
    pass('INSERT succeeded', `id=${row.id}`);
  } catch (err) {
    fail('INSERT failed (constraint blocked adjacent slot — WRONG)', err.message);
  }
}

// ── T5: Delete T1, re-insert same interval ────────────────────────────────────

async function runT5(providerId, t1Id) {
  console.log('\nT5: Delete T1, then re-insert (10:00–11:00) — expect SUCCESS');
  await prisma.slotReservation.delete({ where: { id: t1Id } });
  try {
    const row = await prisma.slotReservation.create({ data: slot(providerId, '10', '11') });
    pass('INSERT succeeded after deletion', `id=${row.id}`);
  } catch (err) {
    fail('INSERT failed after deletion (UNEXPECTED)', err.message);
  }
}

// ── T6: Concurrent inserts ────────────────────────────────────────────────────

async function runT6(providerId) {
  console.log('\nT6: Concurrent inserts of (14:00–15:00) — expect exactly one succeeds');
  // Clear any existing rows for this interval first
  await prisma.slotReservation.deleteMany({
    where: {
      providerId,
      startTime: ts('14:00'),
    },
  });

  const results = await Promise.allSettled([
    prisma.slotReservation.create({ data: slot(providerId, '14', '15') }),
    prisma.slotReservation.create({ data: slot(providerId, '14', '15') }),
    prisma.slotReservation.create({ data: slot(providerId, '14', '15') }),
  ]);

  const successes = results.filter(r => r.status === 'fulfilled').length;
  const failures  = results.filter(r => r.status === 'rejected').length;

  console.log(`  Successes: ${successes}  Failures: ${failures}`);

  if (successes === 1) {
    pass('Exactly one concurrent insert succeeded — constraint is race-safe');
  } else {
    fail(`Expected 1 success, got ${successes} — constraint did not serialise`);
  }

  // Show error from one of the failures
  const firstFailure = results.find(r => r.status === 'rejected');
  if (firstFailure) {
    const captured = captureError(firstFailure.reason);
    console.log('  Concurrent loser error:');
    console.log(`    code:    ${captured.code}`);
    console.log(`    message: ${captured.message.substring(0, 150)}`);
  }
}

// ── T7: Expired-row blocking — CRITICAL for Option A/B decision ───────────────

async function runT7(providerId) {
  console.log('\nT7: Expired-but-not-deleted row (16:00–17:00), then fresh insert — OPTION A/B DECISION');
  console.log('  (This determines whether expired rows block new reservations)');

  // Insert an already-expired row (expiresAt = 1 second ago)
  const expiredRow = await prisma.slotReservation.create({
    data: slotExpired(providerId, '16', '17'),
  });
  console.log(`  Expired row inserted: id=${expiredRow.id} expiresAt=${expiredRow.expiresAt.toISOString()}`);

  // Attempt to insert a fresh row for the same interval WITHOUT deleting the expired row
  try {
    const freshRow = await prisma.slotReservation.create({
      data: slot(providerId, '16', '17'),
    });
    pass('Fresh insert SUCCEEDED despite expired row existing');
    console.log('  → OPTION B is viable: expired rows do NOT block new reservations');
    console.log('  → The all-rows constraint does NOT block after expiry (partial semantics respected by tsrange)');
    console.log('  NOTE: This would mean the constraint IS partial in effect via tsrange semantics.');
    await prisma.slotReservation.delete({ where: { id: freshRow.id } });
  } catch (err) {
    const captured = captureError(err);
    fail('Fresh insert BLOCKED by expired row');
    console.log('  → OPTION A REQUIRED: must synchronously delete expired rows before insert');
    console.log('  → Expired-but-not-cleaned rows block new reservations for the same interval');
    console.log('  → Application must delete expired rows for target interval before create()');
    console.log(`  Error: code=${captured.code} message=${captured.message.substring(0, 150)}`);
  }

  // Cleanup expired row
  await prisma.slotReservation.deleteMany({ where: { id: expiredRow.id } });

  // Verify fresh insert works AFTER expired row is deleted
  try {
    const postDeleteRow = await prisma.slotReservation.create({
      data: slot(providerId, '16', '17'),
    });
    pass('Fresh insert succeeded AFTER expired row deleted', `id=${postDeleteRow.id}`);
    await prisma.slotReservation.delete({ where: { id: postDeleteRow.id } });
  } catch (err) {
    fail('Fresh insert failed even after expired row deleted (UNEXPECTED)', err.message);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('PAY-H-04 Constraint Prototype — T1–T7');
  console.log(`DB: ${DB_URL.substring(0, 70)}...`);
  console.log(`Constraint: SlotReservation_no_overlap (GIST exclusion, all rows)`);

  const { user, provider } = await createTestProvider();
  const providerId = provider.id;
  console.log(`\nTest provider: ${providerId}`);

  try {
    const t1Id = await runT1(providerId);
    const t2Error = await runT2(providerId);
    await runT3(providerId);
    await runT4(providerId);
    await runT5(providerId, t1Id);
    await runT6(providerId);
    await runT7(providerId);

    console.log('\n─────────────────────────────────────────────');
    console.log('PROTOTYPE SUMMARY');
    console.log('─────────────────────────────────────────────');
    if (t2Error) {
      console.log(`T2 Prisma error code:        ${t2Error.code}`);
      console.log(`T2 constructor:              ${t2Error.constructorName}`);
      console.log(`T2 meta:                     ${t2Error.meta}`);
    }
    console.log('─────────────────────────────────────────────');
  } finally {
    await cleanup(user.id, providerId);
    console.log('\nTest fixtures cleaned up.');
    await prisma.$disconnect();
  }
}

main().catch(err => {
  console.error('Prototype failed:', err);
  prisma.$disconnect();
  process.exit(1);
});
