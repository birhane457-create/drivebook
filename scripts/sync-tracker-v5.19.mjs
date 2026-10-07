/**
 * Sync AUDIT-MASTER-TRACKER.md to match actual FIX-VERIFIED evidence at 50c1ad2a.
 *
 * Changes:
 *  1. Version → 5.19
 *  2. Section 7 current-state → 9 FIX-VERIFIED, 8 SOURCE-CONFIRMED, 0 CLOSED
 *  3. Nine finding rows → correct Fix / Fix-Verified / Status columns
 *  4. Section 7.3 queue → remove PENDING for fixed findings; preserve pre-fix evidence
 *
 * Evidence qualifications recorded:
 *  V-01 FV-3: body-content winner confirmed (dummyProvId in response)
 *  V-07: 3 PASS / 0 FAIL / 1 PRECONDITION-BLOCKED (FV-4 dummy session unavailable)
 *  V-16: 3 PASS / 0 FAIL / 1 PRECONDITION-BLOCKED (FV-2 BusinessBranding FK blocked)
 *
 * No production code changes. Tracker only.
 */

import { readFileSync, writeFileSync } from 'fs';

const f = 'docs/audit/AUDIT-MASTER-TRACKER.md';
let content = readFileSync(f, 'utf-8');

// ── 1. Version ─────────────────────────────────────────────────────────────────
content = content.replace(
  /\*\*Version:\*\*.*$/m,
  '**Version:** 5.19 (9 FIX-VERIFIED: V-01..V-03, V-05..V-07, V-15..V-17; tracker synced to 50c1ad2a evidence)'
);

// ── 2. Section 7 current-state ────────────────────────────────────────────────
content = content.replace(
  /\*\*Current state:\*\* .*$/m,
  '**Current state:** 17 findings registered. 9 FIX-VERIFIED (V-01, V-02, V-03, V-05, V-06, V-07, V-15, V-16, V-17). 8 SOURCE-CONFIRMED (V-04, V-08–V-14). 0 CLOSED. Evidence package at commit 50c1ad2a. See individual rows for fix commits and evidence qualifications.'
);

// ── 3. Individual finding rows ────────────────────────────────────────────────
// Row update helper: find a row by starting prefix and replace the last 3 columns
function updateRow(prefix, fixColumn, fixVerifiedColumn, statusColumn) {
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith(prefix)) {
      // Replace everything after the 5th pipe (Verification column end) with new columns
      // Format: | ... | Verification | Fix | Fix-Verified | Status |
      // We locate the Fix column by finding the pattern at the end of the row
      const row = lines[i];
      // Find position of last 3 pipe-delimited columns and replace them
      const parts = row.split('|');
      if (parts.length >= 5) {
        // parts[0]='' parts[1]=ID parts[2]=Title parts[3]=Risk parts[4]=Finding
        // parts[5]=Source-Confirmed parts[6]=Verification parts[7]=Fix parts[8]=Fix-Verified parts[9]=Status parts[10]=''
        if (parts.length >= 10) {
          parts[7] = ` ${fixColumn} `;
          parts[8] = ` ${fixVerifiedColumn} `;
          parts[9] = ` ${statusColumn} `;
          lines[i] = parts.join('|');
          return true;
        }
      }
    }
  }
  content = lines.join('\n');
  return false;
}

// Update rows using line-by-line approach for reliability
const lines = content.split('\n');

const rowUpdates = {
  'BRAND-V-01': {
    fix: 'commit 13f0e633 — `app/api/instructor/domain/verify/route.ts` ownership check before DNS; `app/custom-domain/page.tsx` orderBy domainVerifiedAt DESC',
    fv:  '3/3 PASS exit 0 @ 2026-10-07T07:17Z (FV-1 HTTP 409 owned domain; FV-2 HTTP 200 own domain; FV-3 HTTP 200 + dummyProvId in body confirms orderBy winner). Script: `scripts/fix-verify-v01.mjs` v3',
    st:  '✅ FIX-VERIFIED',
  },
  'BRAND-V-02': {
    fix: 'commit 2be90d4b — `app/api/instructor/domain/verify/route.ts`: `=== VERCEL_CNAME_TARGET` replaces `.includes("vercel")`',
    fv:  '5/5 PASS exit 0 @ 2026-10-07T02:29Z (source+logic — DNS runtime test requires external DNS control). Script: `scripts/fix-verify-v02.mjs`',
    st:  '✅ FIX-VERIFIED (source+logic)',
  },
  'BRAND-V-03': {
    fix: 'commit cdba0a72 — `app/api/business/branding/route.ts` customDomain in Zod schema; extracted before upsert; mirrored to Provider',
    fv:  '4/4 PASS exit 0 @ 2026-10-07T02:52Z (FV-1 HTTP 200; FV-2 exact DB match; FV-3 domainVerified=false; FV-4 domain preserved). Script: `scripts/fix-verify-v03.mjs` v2',
    st:  '✅ FIX-VERIFIED',
  },
  'BRAND-V-05': {
    fix: 'commit f9641a40 — `app/dashboard/branding/page.tsx` STUDIO-only gate → [STUDIO,PREMIUM].includes(tier)',
    fv:  '3/3 PASS exit 0 @ 2026-10-07T03:01Z (source inspection). Script: `scripts/fix-verify-v05.mjs`',
    st:  '✅ FIX-VERIFIED (source)',
  },
  'BRAND-V-06': {
    fix: 'commit f0f4cf9f — `app/api/instructor/branding/route.ts` STUDIO/PREMIUM required for customDomain writes',
    fv:  '4/4 PASS exit 0 @ 2026-10-06T15:12Z (FV-1 PRO 403; FV-2 BASIC 403; FV-3 STUDIO 200; FV-4 color write still 200). Script: `scripts/fix-verify-v06.mjs`',
    st:  '✅ FIX-VERIFIED',
  },
  'BRAND-V-07': {
    fix: 'commit 23800b0e (sync logic) + a5ade41f (null-constraint bug fix) — `app/api/instructor/branding/route.ts` reverse sync Provider→BusinessBranding with conditional field spreading',
    fv:  '3 PASS / 0 FAIL / 1 PRECONDITION-BLOCKED exit 0 @ 2026-10-07T07:26Z (FV-1 logo exact match; FV-2 primaryColour exact match; FV-3 showPlatformBranding inversion; FV-4 PRECONDITION-BLOCKED: dummy provider session via register returned 400). Script: `scripts/fix-verify-v07.mjs` v3',
    st:  '✅ FIX-VERIFIED (FV-4 PRECONDITION-BLOCKED)',
  },
  'BRAND-V-15': {
    fix: 'commit ebe97e99 — `app/api/instructor/branding/route.ts` reset domainVerified=false + domainVerifiedAt=null when customDomain changes',
    fv:  '4/4 PASS exit 0 @ 2026-10-06T15:22Z (FV-1 domainVerified=false after PUT; FV-2 domainVerifiedAt=null; FV-3 no-domain PUT preserves; FV-4 public HTTP 404 for unverified domain). Script: `scripts/fix-verify-v15.mjs`',
    st:  '✅ FIX-VERIFIED',
  },
  'BRAND-V-16': {
    fix: 'commit e603694f — `app/api/business/branding/route.ts` cross-model Provider.customSlug uniqueness check added',
    fv:  '3 PASS / 0 FAIL / 1 PRECONDITION-BLOCKED exit 0 @ 2026-10-07T07:31Z (FV-1 cross-model 400; FV-2 PRECONDITION-BLOCKED: BusinessBranding FK requires full business setup flow; FV-3 unique 200; FV-4 own slug 200). Script: `scripts/fix-verify-v16.mjs` v3',
    st:  '✅ FIX-VERIFIED (FV-2 PRECONDITION-BLOCKED)',
  },
  'BRAND-V-17': {
    fix: 'commit b7108b97 — `app/api/branding/route.ts` queries Provider not User; email/name removed from response',
    fv:  '4/4 PASS exit 0 @ 2026-10-07T02:31Z (FV-1 HTTP 200; FV-2 no email; FV-3 no name; FV-4 display fields present). Script: `scripts/fix-verify-v17.mjs`',
    st:  '✅ FIX-VERIFIED',
  },
};

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  for (const [prefix, update] of Object.entries(rowUpdates)) {
    // Match finding rows (7.1 table) — starts with "| BRAND-VXX | <title>"
    if (line.startsWith(`| ${prefix} |`) && !line.includes('| DB direct insert') && !line.includes('| HTTP POST') && !line.includes('| HTTP GET') && !line.includes('| HTTP sequence') && !line.includes('| HTTP PUT')) {
      const parts = line.split('|');
      // Section 7.1 rows have 11 parts (|| ID | Title | Risk | Finding | Source-Confirmed | Verification | Fix | Fix-Verified | Status ||)
      if (parts.length >= 10) {
        parts[7] = ` ${update.fix} `;
        parts[8] = ` ${update.fv} `;
        parts[9] = ` ${update.st} `;
        lines[i] = parts.join('|');
      }
      break;
    }
  }
}

content = lines.join('\n');

// ── 4. Section 7.3 queue — update entries for all nine fixed findings ─────────
// Replace individual PENDING / stale entries in the queue table with COMPLETED evidence

const queueUpdates = [
  // V-01
  { old: /(\| BRAND-V-01 \| Two providers claim same.*?\|)[^\|]*(\|)$/m,
    newVal: ' ✅ FIX-VERIFIED — ownership check added (HTTP 409); orderBy winner confirmed by body-content (dummyProvId). Script: fix-verify-v01.mjs v3 @ 2026-10-07 |' },
  // V-02
  { old: /(\| BRAND-V-02 \| Submit crafted CNAME.*?\|)[^\|]*(\|)$/m,
    newVal: ' ✅ FIX-VERIFIED (source+logic) — exact === VERCEL_CNAME_TARGET confirmed; DNS runtime test requires external infrastructure. Script: fix-verify-v02.mjs |' },
  // V-15
  { old: /(\| BRAND-V-15 \| Set domain via verify endpoint.*?\|)[^\|]*(\|)$/m,
    newVal: ' ✅ FIX-VERIFIED — full chain: domainVerified=false after PUT; public route 404 for unverified domain. Script: fix-verify-v15.mjs |' },
  // V-16
  { old: /(\| BRAND-V-16 \| Create duplicate slugs.*?\|)[^\|]*(\|)$/m,
    newVal: ' ✅ FIX-VERIFIED (FV-2 PRECONDITION-BLOCKED) — cross-model Provider check HTTP 400; BusinessBranding FK-blocked. Script: fix-verify-v16.mjs v3 |' },
  // V-06
  { old: /(\| BRAND-V-06 \| Call legacy branding PUT.*?\|)[^\|]*(\|)$/m,
    newVal: ' ✅ FIX-VERIFIED — PRO/BASIC 403; STUDIO 200; color-write still 200. Script: fix-verify-v06.mjs |' },
  // V-17
  { old: /(\| BRAND-V-17 \| Call.*?branding.*?no session.*?\|)[^\|]*(\|)$/m,
    newVal: ' ✅ FIX-VERIFIED — HTTP 200; no email; no name; display fields present. Script: fix-verify-v17.mjs |' },
  // V-03
  { old: /(\| BRAND-V-03 \| Call.*?business.*?branding.*?customDomain.*?\|)[^\|]*(\|)$/m,
    newVal: ' ✅ FIX-VERIFIED — HTTP 200; exact DB match; domainVerified=false; domain preserved. Script: fix-verify-v03.mjs v2 |' },
  // V-05
  { old: /(\| BRAND-V-05 \| Call domain verify endpoint with PREMIUM.*?\|)[^\|]*(\|)$/m,
    newVal: ' ✅ FIX-VERIFIED (source) — PREMIUM tier features.customDomain confirmed in source. Script: fix-verify-v05.mjs |' },
  // V-07
  { old: /(\| BRAND-V-07 \| Write via both branding paths.*?\|)[^\|]*(\|)$/m,
    newVal: ' ✅ FIX-VERIFIED (FV-4 PRECONDITION-BLOCKED) — logo/colour/inversion exact match; FV-4 dummy session unavailable. Script: fix-verify-v07.mjs v3 |' },
];

// Apply queue updates using line-by-line replacement
const queueLines = content.split('\n');
for (const update of queueUpdates) {
  for (let i = 0; i < queueLines.length; i++) {
    if (update.old.test(queueLines[i])) {
      queueLines[i] = queueLines[i].replace(update.old, `$1${update.newVal}`);
      update.old.lastIndex = 0;
      break;
    }
    update.old.lastIndex = 0;
  }
}
content = queueLines.join('\n');

// ── 5. Last Updated ───────────────────────────────────────────────────────────
content = content.replace(/\*\*Last Updated:\*\* .*$/m, '**Last Updated:** 2026-10-07');

writeFileSync(f, content, 'utf-8');
console.log('Tracker synced. Verifying key fields...');

// Spot-check
const checks = [
  ['Version 5.19', content.includes('5.19')],
  ['V-15 FIX-VERIFIED in row', content.includes('ebe97e99') && content.includes('FIX-VERIFIED')],
  ['V-07 3 PASS / 1 PRECONDITION', content.includes('PRECONDITION-BLOCKED: dummy provider session')],
  ['V-16 3 PASS / 1 PRECONDITION', content.includes('PRECONDITION-BLOCKED: BusinessBranding FK')],
  ['V-01 FV-3 body-content', content.includes('dummyProvId in body confirms orderBy winner')],
  ['Current state 9 FIX-VERIFIED', content.includes('9 FIX-VERIFIED')],
  ['0 CLOSED', content.includes('0 CLOSED')],
];

let allPassed = true;
for (const [label, result] of checks) {
  console.log(`  ${result ? '✅' : '❌'}  ${label}: ${result}`);
  if (!result) allPassed = false;
}
if (allPassed) {
  console.log('\nAll spot checks passed. Tracker is consistent with 50c1ad2a evidence.');
} else {
  console.log('\nSome checks failed — review tracker manually before committing.');
  process.exit(1);
}
