import { readFileSync, writeFileSync } from 'fs';
const f = 'docs/audit/AUDIT-MASTER-TRACKER.md';
let c = readFileSync(f, 'utf-8');
const lines = c.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].startsWith('| BRAND-V-07 |')) {
    lines[i] = lines[i].replace(
      '| NOT-STARTED | NOT-STARTED | VERIFIED |',
      '| fix/brand-v07 — `app/api/instructor/branding/route.ts`: reverse sync from Provider to BusinessBranding after legacy PUT (logo, primaryColour, secondaryColour, customSlug, showPlatformBranding inversion, customDomain) | 4/4 PASS exit 0 @ 2026-10-07T03:11Z (V07-FV-1 logo sync; V07-FV-2 primaryColour match; V07-FV-3 inversion confirmed; V07-FV-4 graceful when missing). Script: `scripts/fix-verify-v07.mjs` | ✅ FIX-VERIFIED |'
    );
    break;
  }
}
c = lines.join('\n');
c = c.replace('8 FIX-VERIFIED (V-01, V-02, V-03, V-05, V-06, V-15, V-16, V-17)', '9 FIX-VERIFIED (V-01, V-02, V-03, V-05, V-06, V-07, V-15, V-16, V-17)');
c = c.replace('Version: 5.17', 'Version: 5.18 (all 9 priority findings FIX-VERIFIED; 8 SOURCE-CONFIRMED product/architecture findings remain)');
writeFileSync(f, c, 'utf-8');
console.log('Done.');
