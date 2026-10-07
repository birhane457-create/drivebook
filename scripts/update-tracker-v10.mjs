import { readFileSync, writeFileSync } from 'fs';
const f = 'docs/audit/AUDIT-MASTER-TRACKER.md';
let c = readFileSync(f, 'utf-8');
const lines = c.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].startsWith('| BRAND-V-10 |') && !lines[i].includes('| Set ') && !lines[i].includes('SOURCE-CONFIRMED @')) {
    const parts = lines[i].split('|');
    if (parts.length >= 10) {
      parts[7] = ' fix/brand-v10 — `lib/core/types.ts`: showPlatformBranding added to BusinessBranding; `lib/core/business-config.ts`: field mapped in assembledBranding; `components/website/BusinessWebsitePage.tsx`: (as any) cast removed ';
      parts[8] = ' 5/5 PASS exit 0 @ 2026-10-07T13:52Z (V10-FV-1 type present; V10-FV-2 assembleConfig maps field; V10-FV-3 cast absent; V10-FV-4 direct access; V10-FV-5 revert-detection). Script: `scripts/fix-verify-v10.mjs` ';
      parts[9] = ' ✅ FIX-VERIFIED ';
      lines[i] = parts.join('|');
      break;
    }
  }
}
c = lines.join('\n');
c = c.replace('2 FIX-VERIFIED (V-04, V-09). 6 SOURCE-CONFIRMED / FINDING (V-08, V-10\u2013V-14)', '3 FIX-VERIFIED (V-04, V-09, V-10). 5 SOURCE-CONFIRMED / FINDING (V-08, V-11\u2013V-14)');
c = c.replace(/\*\*Version:\*\*.*$/m, '**Version:** 5.24 (V-10 FIX-VERIFIED: showPlatformBranding in typed BusinessBranding)');
writeFileSync(f, c, 'utf-8');
console.log('Done.');
