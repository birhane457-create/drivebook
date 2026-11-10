/**
 * industry-backfill-marketplace.cjs
 *
 * Targeted industry backfill for the 5 MARKETPLACE provider records.
 *
 * AWAITING EXPLICIT APPROVAL — DO NOT RUN WITHOUT AUTHORIZATION.
 *
 * Uses the exact provider IDs from the Phase 1 classification evidence
 * (scripts/classify-saas-providers.cjs, 2026-11-10) rather than a broad
 * businessModel = 'MARKETPLACE' condition.
 *
 * Does NOT modify the 8 SAAS test fixture records. Those accounts have
 * industry = null and are not real customer accounts; no backfill is needed.
 *
 * Guards (run inside a serializable transaction):
 *  G1. All 5 target IDs exist in the database
 *  G2. All 5 have businessModel = 'MARKETPLACE'
 *  G3. All 5 have industry = NULL before the update (safe to overwrite)
 *  G4. No SAAS provider IDs are in the target list (belt-and-suspenders)
 *  G5. Exactly 5 rows are updated
 *  G6. Post-update: all 5 have industry = 'driving'
 *  G7. No other provider records were modified (total industry changes = 5)
 *  G8. The 8 SAAS fixture IDs still have industry = NULL (unchanged)
 *
 * If any guard fails the transaction is rolled back; no data is changed.
 */

'use strict';

const { PrismaClient } = require('@prisma/client');
process.env.DATABASE_URL = process.env.DIRECT_URL || process.env.DATABASE_URL;
const prisma = new PrismaClient();

// Exact IDs from classify-saas-providers.cjs output 2026-11-10
const TARGET_IDS = [
  'cmuuxw8jb0002zxy882y5vn4l',   // Phase3B Test User / phase3b-test-...@example.com
  'cmuuxy5c300021wy5toyluih7',   // Phase3B Test User / phase3b-test-...@example.com
  'cmuuy7d8n000i1wy5cx85ergg',   // Birhane Test / birhane157@gmail.com
  'cmuuyc03e000x1wy5cnlqyjdw',   // Phase3B Test User / phase3b-test-...@example.com
  'cmuv3q0ct0004pf9m2zsy1k2t',   // Debesay Weldegebeiel Birhane / birhane457@gmail.com
];

// The 8 SAAS fixture IDs — must remain untouched
const SAAS_FIXTURE_IDS = [
  'prov_a1_1791031232425',
  'prov_a2_1791031241867',
  'prov_a3_1791031245247',
  'prov_c1_1791031247635',
  'prov_c2_1791031248429',
  'prov_d1_1791031249512',
  'prov_e1_1791031252505',
  'v07fv2-p-1791344962235',
];

function abort(reason) {
  console.error(`\nABORT: ${reason}`);
  console.error('Transaction rolled back. No changes made.');
  process.exit(1);
}

async function main() {
  console.log('='.repeat(72));
  console.log('Industry backfill — 5 MARKETPLACE providers (GUARDED)');
  console.log('AWAITING APPROVAL — DO NOT RUN WITHOUT AUTHORIZATION');
  console.log('='.repeat(72));
  console.log(`\nTarget IDs (${TARGET_IDS.length}):`);
  TARGET_IDS.forEach(id => console.log(`  ${id}`));

  await prisma.$transaction(async (tx) => {

    // ── G1: All 5 target IDs exist ───────────────────────────────────────
    const existing = await tx.provider.findMany({
      where: { id: { in: TARGET_IDS } },
      select: { id: true, businessModel: true, industry: true },
    });
    if (existing.length !== TARGET_IDS.length) {
      const found = existing.map(r => r.id);
      const missing = TARGET_IDS.filter(id => !found.includes(id));
      abort(`G1 FAIL: ${missing.length} target ID(s) not found in DB: ${missing.join(', ')}`);
    }
    console.log(`\nG1 PASS: all ${TARGET_IDS.length} target IDs exist in DB`);

    // ── G2: All 5 have businessModel = 'MARKETPLACE' ─────────────────────
    const nonMarketplace = existing.filter(r => r.businessModel !== 'MARKETPLACE');
    if (nonMarketplace.length > 0) {
      abort(`G2 FAIL: ${nonMarketplace.length} target ID(s) do not have businessModel='MARKETPLACE': ` +
            nonMarketplace.map(r => `${r.id}=${r.businessModel}`).join(', '));
    }
    console.log(`G2 PASS: all ${TARGET_IDS.length} have businessModel='MARKETPLACE'`);

    // ── G3: All 5 have industry = NULL ────────────────────────────────────
    const nonNull = existing.filter(r => r.industry !== null);
    if (nonNull.length > 0) {
      abort(`G3 FAIL: ${nonNull.length} target ID(s) already have industry set: ` +
            nonNull.map(r => `${r.id}=${r.industry}`).join(', '));
    }
    console.log(`G3 PASS: all ${TARGET_IDS.length} have industry=NULL (safe to overwrite)`);

    // ── G4: No SAAS IDs in target list ───────────────────────────────────
    const overlap = TARGET_IDS.filter(id => SAAS_FIXTURE_IDS.includes(id));
    if (overlap.length > 0) abort(`G4 FAIL: SAAS fixture IDs found in target list: ${overlap.join(', ')}`);
    console.log(`G4 PASS: no SAAS fixture IDs in target list`);

    // ── Execute the UPDATE ────────────────────────────────────────────────
    console.log('\nExecuting UPDATE...');
    const updateResult = await tx.provider.updateMany({
      where: {
        id:            { in: TARGET_IDS },
        businessModel: 'MARKETPLACE',
        industry:      null,
      },
      data: { industry: 'driving' },
    });

    // ── G5: Exactly 5 rows updated ────────────────────────────────────────
    if (updateResult.count !== TARGET_IDS.length) {
      abort(`G5 FAIL: UPDATE affected ${updateResult.count} row(s) — expected ${TARGET_IDS.length}`);
    }
    console.log(`G5 PASS: exactly ${updateResult.count} row(s) updated`);

    // ── G6: Post-update — all 5 have industry = 'driving' ─────────────────
    const postUpdate = await tx.provider.findMany({
      where: { id: { in: TARGET_IDS } },
      select: { id: true, industry: true },
    });
    const notDriving = postUpdate.filter(r => r.industry !== 'driving');
    if (notDriving.length > 0) {
      abort(`G6 FAIL: ${notDriving.length} record(s) do not have industry='driving' after update: ` +
            notDriving.map(r => `${r.id}=${r.industry}`).join(', '));
    }
    console.log(`G6 PASS: all ${TARGET_IDS.length} records have industry='driving'`);

    // ── G7: Total providers with industry = 'driving' = exactly 5 ─────────
    const totalDriving = await tx.provider.count({ where: { industry: 'driving' } });
    if (totalDriving !== TARGET_IDS.length) {
      abort(`G7 FAIL: ${totalDriving} provider(s) now have industry='driving' — expected exactly ${TARGET_IDS.length}. ` +
            `Unexpected records may have been updated.`);
    }
    console.log(`G7 PASS: total providers with industry='driving' = ${totalDriving} (expected ${TARGET_IDS.length})`);

    // ── G8: SAAS fixtures still have industry = NULL ──────────────────────
    const saasCheck = await tx.provider.findMany({
      where: { id: { in: SAAS_FIXTURE_IDS } },
      select: { id: true, industry: true },
    });
    const saasModified = saasCheck.filter(r => r.industry !== null);
    if (saasModified.length > 0) {
      abort(`G8 FAIL: ${saasModified.length} SAAS fixture(s) were unexpectedly modified: ` +
            saasModified.map(r => `${r.id}=${r.industry}`).join(', '));
    }
    console.log(`G8 PASS: all ${SAAS_FIXTURE_IDS.length} SAAS fixtures still have industry=NULL`);

    // ── All guards passed ─────────────────────────────────────────────────
    console.log('\n' + '='.repeat(72));
    console.log('All 8 guards passed. Transaction committing...');
    console.log('='.repeat(72));

  }, { isolationLevel: 'Serializable' });

  console.log('\nBackfill complete.');
  console.log(`${TARGET_IDS.length} MARKETPLACE providers now have industry='driving'.`);
  console.log('8 SAAS test fixtures unchanged (industry=NULL).');
}

main()
  .catch(e => { console.error('\nScript error or rollback:', e.message); process.exit(2); })
  .finally(() => prisma.$disconnect());
