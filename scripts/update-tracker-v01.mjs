import { readFileSync, writeFileSync } from 'fs';

const f = 'docs/audit/AUDIT-MASTER-TRACKER.md';
let content = readFileSync(f, 'utf-8');
const lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].startsWith('| BRAND-V-01 | Custom-domain ownership invariant')) {
    // Replace the last three columns: Fix | Fix-Verified | Status
    lines[i] = lines[i]
      .replace('| NOT-STARTED | NOT-STARTED | VERIFIED |',
        '| fix/brand-v01 — `app/api/instructor/domain/verify/route.ts` ownership check before DNS; `app/custom-domain/page.tsx` orderBy domainVerifiedAt DESC | 3/3 PASS exit 0 @ 2026-10-06T15:01Z (V01-FV-1 HTTP 409 owned domain rejected; V01-FV-2 HTTP 200 own domain allowed; V01-FV-3 HTTP 200 deterministic resolver). Script: `scripts/fix-verify-v01.mjs` | ✅ FIX-VERIFIED |');
    console.log('V-01 row updated');
    break;
  }
}

content = lines.join('\n');

// Also update Section 7 preamble counts
content = content.replace(
  '17 findings registered. 8 VERIFIED at runtime. 9 SOURCE-CONFIRMED (source inspection only, runtime test incomplete or requires external infrastructure). 0 fixes started. See individual rows for evidence detail.',
  '17 findings registered. 8 VERIFIED at runtime. 9 SOURCE-CONFIRMED. 1 FIX-VERIFIED (V-01). 0 CLOSED. See individual rows for evidence detail.'
);

// Version bump
content = content.replace(
  'Version: 5.9 (8 VERIFIED at runtime; 9 SOURCE-CONFIRMED; V-15 exploit-chain reproduced; V-08 RSC body-marker limitation documented)',
  'Version: 5.10 (V-01 FIX-VERIFIED: domain ownership check + deterministic resolver)'
);

writeFileSync(f, content, 'utf-8');
console.log('Done.');
