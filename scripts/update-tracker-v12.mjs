import { readFileSync, writeFileSync } from 'fs';
const f = 'docs/audit/AUDIT-MASTER-TRACKER.md';
let c = readFileSync(f, 'utf-8');
const lines = c.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].startsWith('| BRAND-V-12 |') && !lines[i].includes('Load Business Setup') && !lines[i].includes('SOURCE-CONFIRMED @')) {
    const parts = lines[i].split('|');
    if (parts.length >= 10) {
      parts[7] = ' fix/brand-v12 — `app/business-setup/branding/page.tsx`: input suffix changed from rootDomain/ prefix to .rootDomain suffix; preview shows slug.rootDomain ';
      parts[8] = ' 4/4 PASS exit 0 @ 2026-10-07T13:59Z (V12-FV-1 old prefix absent; V12-FV-2 suffix present; V12-FV-3 preview shows slug.rootDomain; V12-FV-4 revert-detection). Script: `scripts/fix-verify-v12.mjs` ';
      parts[9] = ' ✅ FIX-VERIFIED ';
      lines[i] = parts.join('|');
      break;
    }
  }
}
c = lines.join('\n');
c = c.replace('3 FIX-VERIFIED (V-04, V-09, V-10). 5 SOURCE-CONFIRMED / FINDING (V-08, V-11\u2013V-14)', '4 FIX-VERIFIED (V-04, V-09, V-10, V-12). 4 SOURCE-CONFIRMED / FINDING (V-08, V-11, V-13, V-14)');
c = c.replace(/\*\*Version:\*\*.*$/m, '**Version:** 5.25 (V-12 FIX-VERIFIED: correct URL format in Business Setup branding page)');
writeFileSync(f, c, 'utf-8');
console.log('Done.');
