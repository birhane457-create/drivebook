/**
 * Closure commit script — advances nine BRAND findings from FIX-VERIFIED to CLOSED.
 * Tracker-only. No production code changes.
 *
 * CLOSED requirements per AUDIT-PROCESS.md:
 *   verified finding + fix commit + targeted test (exit 0) + no known bypass.
 *
 * Two explicit qualifications preserved (not hidden):
 *   V-07: FV-4 PRECONDITION-BLOCKED (no-BusinessBranding test; 3 executable tests cover the fix)
 *   V-16: FV-2 PRECONDITION-BLOCKED (BusinessBranding FK; cross-model protection tested by FV-1)
 *
 * Acceptance declared by project owner at commit c2ffd70c.
 */

import { readFileSync, writeFileSync } from 'fs';

const f = 'docs/audit/AUDIT-MASTER-TRACKER.md';
let content = readFileSync(f, 'utf-8');

// ── 1. Version and current-state ──────────────────────────────────────────────
content = content.replace(
  /\*\*Version:\*\*.*$/m,
  '**Version:** 5.20 (9 CLOSED: V-01, V-02, V-03, V-05, V-06, V-07, V-15, V-16, V-17; closure accepted by project owner at c2ffd70c)'
);
content = content.replace(
  /\*\*Current state:\*\*.*$/m,
  '**Current state:** 17 findings registered. 9 CLOSED (V-01, V-02, V-03, V-05, V-06, V-07, V-15, V-16, V-17). 8 SOURCE-CONFIRMED (V-04, V-08–V-14). 0 FIX-VERIFIED pending closure. CLOSED acceptance by project owner 2026-10-07.'
);
content = content.replace(
  /\*\*Last Updated:\*\*.*$/m,
  '**Last Updated:** 2026-10-07'
);

// ── 2. Advance each FIX-VERIFIED status column to CLOSED ─────────────────────
// Each row ends with: | ✅ FIX-VERIFIED ... | or | ✅ FIX-VERIFIED (qualification) |
// Change the Status column (last pipe-delimited cell before trailing |) to ✅ CLOSED

const closureFindings = ['BRAND-V-01', 'BRAND-V-02', 'BRAND-V-03', 'BRAND-V-05',
                         'BRAND-V-06', 'BRAND-V-07', 'BRAND-V-15', 'BRAND-V-16', 'BRAND-V-17'];

const closureNotes = {
  'BRAND-V-07':  'V-07 FV-4 PRECONDITION-BLOCKED: no-BusinessBranding test infrastructure unavailable; 3 executable tests confirmed sync behaviour. Accepted as sufficient by project owner.',
  'BRAND-V-16':  'V-16 FV-2 PRECONDITION-BLOCKED: BusinessBranding FK requires full business-setup flow; cross-model Provider slug protection confirmed by FV-1. Accepted as sufficient by project owner.',
  'BRAND-V-02':  'V-02: DNS runtime test requires external DNS control infrastructure; source+logic verification accepted. Accepted by project owner.',
};

const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  for (const finding of closureFindings) {
    // Match only Section 7.1 finding rows (not queue rows)
    if (line.startsWith(`| ${finding} |`) &&
        !line.includes('| DB direct insert') &&
        !line.includes('| HTTP POST') &&
        !line.includes('| HTTP GET') &&
        !line.includes('| HTTP sequence') &&
        !line.includes('| HTTP PUT') &&
        !line.includes('| HTTP PUT + DB') &&
        !line.includes('| Source inspection') &&
        !line.includes('| source inspection')) {

      const parts = line.split('|');
      if (parts.length >= 10) {
        const note = closureNotes[finding]
          ? ` CLOSED — ${closureNotes[finding]}`
          : ' CLOSED — accepted by project owner 2026-10-07 ';
        parts[9] = ` ✅${note} `;
        lines[i] = parts.join('|');
      }
      break;
    }
  }
}
content = lines.join('\n');

writeFileSync(f, content, 'utf-8');

// ── 3. Spot-checks ────────────────────────────────────────────────────────────
console.log('Spot-checking closure...');
const checks = [
  ['Version 5.20',               content.includes('5.20')],
  ['Current state 9 CLOSED',     content.includes('9 CLOSED')],
  ['0 FIX-VERIFIED pending',     content.includes('0 FIX-VERIFIED pending')],
  ['V-01 CLOSED',                content.match(/BRAND-V-01.*✅ CLOSED/)],
  ['V-02 CLOSED',                content.match(/BRAND-V-02.*✅ CLOSED/)],
  ['V-07 CLOSED with note',      content.includes('V-07 FV-4 PRECONDITION-BLOCKED')],
  ['V-16 CLOSED with note',      content.includes('V-16 FV-2 PRECONDITION-BLOCKED')],
  ['V-15 CLOSED',                content.match(/BRAND-V-15.*✅ CLOSED/)],
  ['V-17 CLOSED',                content.match(/BRAND-V-17.*✅ CLOSED/)],
  ['8 SOURCE-CONFIRMED preserved', content.includes('8 SOURCE-CONFIRMED')],
];

let allPassed = true;
for (const [label, result] of checks) {
  const ok = !!result;
  console.log(`  ${ok ? '✅' : '❌'}  ${label}`);
  if (!ok) allPassed = false;
}

if (!allPassed) { console.log('\nSome checks failed.'); process.exit(1); }
console.log('\nAll checks passed. Tracker v5.20 ready for commit.');
