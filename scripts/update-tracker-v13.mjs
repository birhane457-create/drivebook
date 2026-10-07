import { readFileSync, writeFileSync } from 'fs';
const f = 'docs/audit/AUDIT-MASTER-TRACKER.md';
let c = readFileSync(f, 'utf-8');
const lines = c.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].startsWith('| BRAND-V-13 |') && !lines[i].includes('Load Business Setup without') && !lines[i].includes('SOURCE-CONFIRMED @')) {
    const parts = lines[i].split('|');
    if (parts.length >= 10) {
      parts[7] = ' fix/brand-v13 — `app/business-setup/page.tsx`: primaryColour completion check compares against default #3B82F6 (not !!value) ';
      parts[8] = ' 5/5 PASS exit 0 @ 2026-10-07T14:06Z (V13-FV-1 simple check absent; V13-FV-2 default comparison present; V13-FV-3 default→false; V13-FV-4 custom→true; V13-FV-5 revert-detection). Script: `scripts/fix-verify-v13.mjs` ';
      parts[9] = ' ✅ FIX-VERIFIED ';
      lines[i] = parts.join('|');
      break;
    }
  }
}
c = lines.join('\n');
c = c.replace('4 FIX-VERIFIED (V-04, V-09, V-10, V-12). 4 SOURCE-CONFIRMED / FINDING (V-08, V-11, V-13, V-14)', '5 FIX-VERIFIED (V-04, V-09, V-10, V-12, V-13). 3 SOURCE-CONFIRMED / FINDING (V-08, V-11, V-14)');
c = c.replace(/\*\*Version:\*\*.*$/m, '**Version:** 5.26 (V-13 FIX-VERIFIED: primaryColour completion check uses default comparison)');
writeFileSync(f, c, 'utf-8');
console.log('Done.');
