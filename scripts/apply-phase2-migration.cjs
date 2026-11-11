'use strict';
const { PrismaClient } = require('@prisma/client');
process.env.DATABASE_URL = process.env.DIRECT_URL || process.env.DATABASE_URL;
const p = new PrismaClient();
async function main() {
  await p.$executeRawUnsafe(`
    ALTER TABLE "Provider"
      ADD COLUMN IF NOT EXISTS "organisationType"             TEXT NOT NULL DEFAULT 'SOLE_TRADER',
      ADD COLUMN IF NOT EXISTS "commercialAgreementType"      TEXT,
      ADD COLUMN IF NOT EXISTS "commercialAgreementStatus"    TEXT NOT NULL DEFAULT 'PENDING',
      ADD COLUMN IF NOT EXISTS "commercialAgreementVersion"   TEXT,
      ADD COLUMN IF NOT EXISTS "commercialAgreementAcceptedAt" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "privacyPolicyVersion"         TEXT,
      ADD COLUMN IF NOT EXISTS "privacyPolicyAcceptedAt"      TIMESTAMP(3)
  `);
  console.log('Phase 2 migration applied.');
}
main().catch(e => { console.error(e.message); process.exit(1); }).finally(() => p.$disconnect());
