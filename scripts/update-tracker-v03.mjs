import { readFileSync, writeFileSync } from 'fs';
const f = 'docs/audit/AUDIT-MASTER-TRACKER.md';
let c = readFileSync(f, 'utf-8');
const lines = c.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].startsWith('| BRAND-V-03 |')) {
    lines[i] = lines[i].replace(
      '| NOT-STARTED | NOT-STARTED | VERIFIED |',
      '| fix/brand-v03 — `app/api/business/branding/route.ts`: customDomain in Zod schema; extracted before upsert; mirrored to Provider | 4/4 PASS exit 0 @ 2026-10-07T02:52Z. Script: `scripts/fix-verify-v03.mjs` | ✅ FIX-VERIFIED |'
    );
    break;
  }
}
c = lines.join('\n');
c = c.replace('6 FIX-VERIFIED (V-01, V-02, V-06, V-15, V-16, V-17)', '7 FIX-VERIFIED (V-01, V-02, V-03, V-06, V-15, V-16, V-17)');
c = c.replace('Version: 5.15', 'Version: 5.16 (V-01, V-02, V-03, V-06, V-15, V-16, V-17 FIX-VERIFIED)');
writeFileSync(f, c, 'utf-8');
console.log('Done.');
