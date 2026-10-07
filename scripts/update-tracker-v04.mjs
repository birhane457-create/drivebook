import { readFileSync, writeFileSync } from 'fs';
const f = 'docs/audit/AUDIT-MASTER-TRACKER.md';
let c = readFileSync(f, 'utf-8');
const lines = c.split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].startsWith('| BRAND-V-04 |') &&
      !lines[i].includes('| Render Business Setup') &&
      !lines[i].includes('| SOURCE-CONFIRMED @')) {
    const parts = lines[i].split('|');
    if (parts.length >= 10) {
      parts[7] = ' fix/brand-v04 — `app/business-setup/domain/page.tsx`: CNAME value changed from `cname.${rootDomain}` to literal `cname.vercel-dns.com` on both @ and www records ';
      parts[8] = ' 4/4 PASS exit 0 @ 2026-10-07T13:22Z (V04-FV-1 old target absent; V04-FV-2 correct target present; V04-FV-3 both records correct; V04-FV-4 revert-detection). Script: `scripts/fix-verify-v04.mjs` ';
      parts[9] = ' ✅ FIX-VERIFIED ';
      lines[i] = parts.join('|');
      console.log('V-04 finding row updated');
    }
    break;
  }
}

// Update queue entry
for (let i = 0; i < lines.length; i++) {
  if (lines[i].startsWith('| BRAND-V-04 | Render Business Setup')) {
    const parts = lines[i].split('|');
    if (parts.length >= 4) {
      parts[parts.length - 2] = ' ✅ FIX-VERIFIED — cname.vercel-dns.com confirmed in both CNAME records @ and www. Script: fix-verify-v04.mjs 4/4 PASS @ 2026-10-07 ';
      lines[i] = parts.join('|');
      console.log('V-04 queue entry updated');
    }
    break;
  }
}

c = lines.join('\n');
c = c.replace(
  '9 CLOSED (V-01, V-02, V-03, V-05, V-06, V-07, V-15, V-16, V-17). 8 SOURCE-CONFIRMED / FINDING (V-04, V-08\u2013V-14)',
  '9 CLOSED (V-01, V-02, V-03, V-05, V-06, V-07, V-15, V-16, V-17). 1 FIX-VERIFIED (V-04). 7 SOURCE-CONFIRMED / FINDING (V-08\u2013V-14)'
);
c = c.replace(
  /\*\*Version:\*\*.*$/m,
  '**Version:** 5.22 (V-04 FIX-VERIFIED: correct CNAME target in Business Setup domain page)'
);
writeFileSync(f, c, 'utf-8');
console.log('Done.');
