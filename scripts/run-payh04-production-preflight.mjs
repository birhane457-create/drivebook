/**
 * PAY-H-04 Production Preflight
 * Runs the three preflight queries against production Supabase.
 * READ-ONLY. No writes, no deletes.
 *
 * Run: node scripts/run-payh04-production-preflight.mjs
 * (uses DATABASE_URL from .env automatically via Prisma)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const timestamp = new Date().toISOString();
const lines = [];

function log(line) {
  console.log(line);
  lines.push(line);
}

async function main() {
  log('PAY-H-04 Production Preflight');
  log(`Timestamp: ${timestamp}`);
  log(`DB host: ${process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] ?? 'unknown'} (credentials not logged)`);
  log('');

  // Q3: btree_gist extension state
  log('=== Q3: btree_gist extension state ===');
  const q3 = await prisma.$queryRaw`
    SELECT extname, extversion
    FROM pg_extension
    WHERE extname = 'btree_gist'
  `;
  if (q3.length === 0) {
    log('Result: 0 rows — btree_gist NOT installed on production');
    log('Migration will install it via CREATE EXTENSION IF NOT EXISTS btree_gist');
  } else {
    log(`Result: ${JSON.stringify(q3)}`);
    log(`btree_gist version: ${q3[0].extversion}`);
  }
  log('');

  // Q2: expired reservation count
  log('=== Q2: Expired reservation count ===');
  const q2 = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS expired_row_count
    FROM "SlotReservation"
    WHERE "expiresAt" < NOW()
  `;
  const expiredCount = q2[0].expired_row_count;
  log(`Result: ${expiredCount} expired row(s)`);
  if (expiredCount > 0) {
    log('ACTION REQUIRED: Delete expired rows before migration, then re-run Q1');
    log('  DELETE FROM "SlotReservation" WHERE "expiresAt" < NOW();');
  } else {
    log('No expired rows — no pre-migration cleanup needed for Q2');
  }
  log('');

  // Active (non-expired) count for context
  log('=== Context: Active (non-expired) reservation count ===');
  const activeQ = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS active_count
    FROM "SlotReservation"
    WHERE "expiresAt" >= NOW()
  `;
  log(`Active reservations: ${activeQ[0].active_count}`);
  log('');

  // Q1: existing overlap check — MUST be 0 rows
  log('=== Q1: Existing overlapping reservations (MUST be 0 rows) ===');
  const q1 = await prisma.$queryRaw`
    SELECT
        a.id            AS reservation_a,
        b.id            AS reservation_b,
        a."providerId",
        a."startTime"   AS a_start,
        a."endTime"     AS a_end,
        b."startTime"   AS b_start,
        b."endTime"     AS b_end
    FROM "SlotReservation" a
    JOIN "SlotReservation" b
      ON a."providerId" = b."providerId"
     AND a.id < b.id
     AND a."startTime" < b."endTime"
     AND b."startTime" < a."endTime"
  `;
  log(`Result: ${q1.length} overlapping row pair(s)`);
  if (q1.length === 0) {
    log('Q1 PASS: No overlapping reservations — migration can proceed');
  } else {
    log('Q1 FAIL: Overlapping reservations found — migration would fail');
    log('Pairs:');
    q1.forEach(r => log(`  ${JSON.stringify(r)}`));
  }
  log('');

  // Summary
  log('=== Migration Readiness Summary ===');
  log(`Q3 btree_gist:   ${q3.length > 0 ? `PRESENT (v${q3[0].extversion})` : 'ABSENT (will be installed by migration)'}`);
  log(`Q2 expired rows: ${expiredCount} (${expiredCount === 0 ? 'OK' : 'CLEANUP REQUIRED then re-check Q1'})`);
  log(`Q1 overlaps:     ${q1.length} (${q1.length === 0 ? 'PASS — migration authorised' : 'FAIL — DO NOT MIGRATE'})`);
  log('');

  if (q1.length === 0 && expiredCount === 0) {
    log('VERDICT: Migration is authorised to proceed');
  } else if (q1.length === 0 && expiredCount > 0) {
    log('VERDICT: Delete expired rows, re-run Q1, then migrate if Q1 still 0 rows');
  } else {
    log('VERDICT: BLOCKED — resolve Q1 overlaps before migration');
  }

  // Write evidence file
  const fs = await import('fs');
  const outputPath = 'docs/audit/PAY-H-04-PRODUCTION-PREFLIGHT.txt';
  fs.writeFileSync(outputPath, lines.join('\n') + '\n', 'utf8');
  console.log(`\nEvidence written to: ${outputPath}`);
}

main()
  .catch(err => { console.error('Preflight failed:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
