import { readFileSync, writeFileSync } from 'fs';
const f = 'docs/audit/AUDIT-MASTER-TRACKER.md';
let content = readFileSync(f, 'utf-8');
const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].startsWith('| BRAND-V-06 |')) {
    lines[i] = lines[i].replace(
      '| NOT-STARTED | NOT-STARTED | VERIFIED |',
      '| fix/brand-v06 — `app/api/instructor/branding/route.ts`: added STUDIO/PREMIUM tier check before customDomain write; other branding fields remain ungated | 4/4 PASS exit 0 @ 2026-10-06T15:12Z (V06-FV-1 PRO blocked 403; V06-FV-2 BASIC blocked 403; V06-FV-3 STUDIO allowed 200; V06-FV-4 PRO color write still 200). Script: `scripts/fix-verify-v06.mjs` | ✅ FIX-VERIFIED |'
    );
    console.log('V-06 row updated');
    break;
  }
}
content = lines.join('\n');
content = content.replace(
  '17 findings registered. 8 VERIFIED at runtime. 9 SOURCE-CONFIRMED. 1 FIX-VERIFIED (V-01). 0 CLOSED.',
  '17 findings registered. 8 VERIFIED at runtime. 9 SOURCE-CONFIRMED. 2 FIX-VERIFIED (V-01, V-06). 0 CLOSED.'
);
content = content.replace(
  'Version: 5.10 (V-01 FIX-VERIFIED: domain ownership check + deterministic resolver)',
  'Version: 5.11 (V-01, V-06 FIX-VERIFIED)'
);
writeFileSync(f, content, 'utf-8');
console.log('Done.');
