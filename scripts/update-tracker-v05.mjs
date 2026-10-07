import { readFileSync, writeFileSync } from 'fs';
const f = 'docs/audit/AUDIT-MASTER-TRACKER.md';
let c = readFileSync(f, 'utf-8');
const lines = c.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].startsWith('| BRAND-V-05 |')) {
    lines[i] = lines[i].replace(
      '| NOT-STARTED | NOT-STARTED | VERIFIED |',
      '| fix/brand-v05 — `app/dashboard/branding/page.tsx`: STUDIO-only gate replaced with [STUDIO, PREMIUM].includes(tier) | 3/3 PASS exit 0 @ 2026-10-07T03:01Z. Script: `scripts/fix-verify-v05.mjs` | ✅ FIX-VERIFIED |'
    );
    break;
  }
}
c = lines.join('\n');
c = c.replace('7 FIX-VERIFIED (V-01, V-02, V-03, V-06, V-15, V-16, V-17)', '8 FIX-VERIFIED (V-01, V-02, V-03, V-05, V-06, V-15, V-16, V-17)');
c = c.replace('Version: 5.16', 'Version: 5.17 (V-01–V-06, V-15–V-17 FIX-VERIFIED; V-07 remaining)');
writeFileSync(f, c, 'utf-8');
console.log('Done.');
