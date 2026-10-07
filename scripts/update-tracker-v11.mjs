import { readFileSync, writeFileSync } from 'fs';
const f = 'docs/audit/AUDIT-MASTER-TRACKER.md';
let c = readFileSync(f, 'utf-8');
const lines = c.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].startsWith('| BRAND-V-11 |') && !lines[i].includes('Attempt') && !lines[i].includes('SOURCE-CONFIRMED @')) {
    const parts = lines[i].split('|');
    if (parts.length >= 10) {
      parts[7] = ' fix/brand-v11 — `prisma/schema.prisma`: @unique added to Provider.customSlug; migration 20261007222011 applied to Supabase test DB ';
      parts[8] = ' 4/4 PASS exit 0 @ 2026-10-07T16:19Z (V11-FV-1 schema @unique; V11-FV-2 DB index exists; V11-FV-3 API 400 on duplicate; V11-FV-4 revert-detection). Script: `scripts/fix-verify-v11.mjs` ';
      parts[9] = ' ✅ FIX-VERIFIED ';
      lines[i] = parts.join('|');
      break;
    }
  }
}
c = lines.join('\n');
c = c.replace('5 FIX-VERIFIED (V-04, V-09, V-10, V-12, V-13). 3 SOURCE-CONFIRMED / FINDING (V-08, V-11, V-14)', '6 FIX-VERIFIED (V-04, V-09, V-10, V-11, V-12, V-13). 2 SOURCE-CONFIRMED / FINDING (V-08, V-14)');
c = c.replace(/\*\*Version:\*\*.*$/m, '**Version:** 5.27 (V-11 FIX-VERIFIED: Provider.customSlug @unique + DB index)');
writeFileSync(f, c, 'utf-8');
console.log('Done.');
