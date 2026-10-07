import { readFileSync, writeFileSync } from 'fs';
const f = 'docs/audit/AUDIT-MASTER-TRACKER.md';
let c = readFileSync(f, 'utf-8');
const lines = c.split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].startsWith('| BRAND-V-09 |') &&
      !lines[i].includes('Set `fontFamily`') && !lines[i].includes('SOURCE-CONFIRMED @')) {
    const parts = lines[i].split('|');
    if (parts.length >= 10) {
      parts[7] = ' fix/brand-v09 — `components/website/BusinessWebsitePage.tsx`: fontFamily applied via style prop; theme applied as CSS class on root <div> ';
      parts[8] = ' 4/4 PASS exit 0 @ 2026-10-07T13:44Z (V09-FV-1 fontFamily read+applied; V09-FV-2 theme class applied; V09-FV-3 root div updated; V09-FV-4 revert-detection). Script: `scripts/fix-verify-v09.mjs` ';
      parts[9] = ' ✅ FIX-VERIFIED ';
      lines[i] = parts.join('|');
      break;
    }
  }
}
c = lines.join('\n');
c = c.replace(
  '1 FIX-VERIFIED (V-04). 7 SOURCE-CONFIRMED / FINDING (V-08\u2013V-14)',
  '2 FIX-VERIFIED (V-04, V-09). 6 SOURCE-CONFIRMED / FINDING (V-08, V-10\u2013V-14)'
);
c = c.replace(/\*\*Version:\*\*.*$/m, '**Version:** 5.23 (V-09 FIX-VERIFIED: fontFamily + theme applied in BusinessWebsitePage)');
writeFileSync(f, c, 'utf-8');
console.log('Done.');
