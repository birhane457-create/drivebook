'use strict';
/**
 * Adds missing columns that exist in schema.prisma but not yet in the DB.
 * These are columns added after the initial migration that failed to deploy
 * via prisma migrate deploy due to connection restrictions.
 *
 * Run: node scripts/add-missing-columns.js
 */
const fs = require('fs'), path = require('path');
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const t = line.trim(); if (!t || t.startsWith('#')) return;
    const eq = t.indexOf('='); if (eq < 0) return;
    const k = t.slice(0, eq).trim(), v = t.slice(eq+1).trim().replace(/^["']|["']$/g,'');
    if (!process.env[k]) process.env[k] = v;
  });
}
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const migrations = [
  // Instructor columns missing from DB
  { table: 'Instructor', col: 'timezone',         sql: `ALTER TABLE "Instructor" ADD COLUMN IF NOT EXISTS "timezone" TEXT` },
  { table: 'Instructor', col: 'suburb',           sql: `ALTER TABLE "Instructor" ADD COLUMN IF NOT EXISTS "suburb" TEXT` },
  { table: 'Instructor', col: 'state',            sql: `ALTER TABLE "Instructor" ADD COLUMN IF NOT EXISTS "state" TEXT` },
  { table: 'Instructor', col: 'postcode',         sql: `ALTER TABLE "Instructor" ADD COLUMN IF NOT EXISTS "postcode" TEXT` },
  { table: 'Instructor', col: 'videoUrl',         sql: `ALTER TABLE "Instructor" ADD COLUMN IF NOT EXISTS "videoUrl" TEXT` },
  { table: 'Instructor', col: 'specialties',      sql: `ALTER TABLE "Instructor" ADD COLUMN IF NOT EXISTS "specialties" TEXT` },
  // Booking columns
  { table: 'Booking', col: 'timezone',            sql: `ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "timezone" TEXT` },
  // Notification columns
  { table: 'Notification', col: 'reminderStage',  sql: `ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "reminderStage" TEXT` },
  { table: 'Notification', col: 'channel',        sql: `ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "channel" TEXT` },
  // Indexes
  { table: 'INDEX', col: 'Instructor_state_suburb',
    sql: `CREATE INDEX IF NOT EXISTS "Instructor_state_suburb_idx" ON "Instructor" ("state", "suburb")` },
  { table: 'INDEX', col: 'Booking_review_once',
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS "Booking_review_once_idx" ON "Booking" ("id") WHERE "reviewGivenAt" IS NOT NULL` },
  { table: 'INDEX', col: 'Booking_instructorId_clientRating',
    sql: `CREATE INDEX IF NOT EXISTS "Booking_instructorId_clientRating_idx" ON "Booking" ("instructorId", "clientRating")` },
];

async function run() {
  let ok = 0, failed = 0;
  for (const m of migrations) {
    try {
      await p.$executeRawUnsafe(m.sql);
      console.log(`✅ ${m.table}.${m.col}`);
      ok++;
    } catch (e) {
      const msg = e.message || String(e);
      if (msg.includes('already exists') || msg.includes('duplicate')) {
        console.log(`✓  ${m.table}.${m.col} (already exists)`);
        ok++;
      } else {
        console.error(`❌ ${m.table}.${m.col}: ${msg}`);
        failed++;
      }
    }
  }
  console.log(`\nDone. ${ok} applied, ${failed} failed.`);
}

run()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => p.$disconnect());
