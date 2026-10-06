import { readFileSync, writeFileSync } from 'fs';

const f = 'docs/audit/AUDIT-MASTER-TRACKER.md';
let content = readFileSync(f, 'utf-8');

// Fix V-15 finding row: replace everything between the verification column start and the status column
// The row starts with "| BRAND-V-15 | Legacy branding PUT..."
// We need to replace the verification column content (between the 5th and 6th pipes)
const findingRowPattern = /(\| BRAND-V-15 \| Legacy branding PUT writes.*?\| YES[^|]+\|)([^|]*\|)(\s*NOT-STARTED \| NOT-STARTED \| VERIFIED \|)/;
const match = content.match(findingRowPattern);
if (match) {
  const newVerification = ' ✅ VERIFIED — Runtime exploit chain reproduced from seeded previously-verified state @ 2026-10-06T13:54Z. Test seeded domainVerified=true in DB (simulating prior verification), then: (1) Baseline /custom-domain with seeded-verified domain → HTTP 200. (2) Legacy PUT changed customDomain to new value (HTTP 200). (3) DB after PUT: domainVerified=true NOT cleared — stale flag persists. (4) Public /custom-domain with new UNVERIFIED domain → HTTP 200 — domain publicly active without DNS verification. Step 1 used direct DB seed, not the real /api/instructor/domain/verify endpoint; exploit chain is proven, simulation acknowledged. `baseline-HTTP=200 PUT-HTTP=200 domainVerified-after=true newDomain-HTTP=200` ';
  content = content.replace(findingRowPattern, `$1${newVerification}$3`);
  console.log('V-15 finding row updated');
} else {
  console.log('V-15 finding row pattern not matched — trying line-by-line');
  // Line-by-line fallback
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('| BRAND-V-15 | Legacy branding PUT')) {
      // Replace everything after the last | YES ... | up to NOT-STARTED
      lines[i] = line.replace(
        /(\| YES[^|]+\|).*?(\| NOT-STARTED \| NOT-STARTED \| VERIFIED \|)/,
        '$1 ✅ VERIFIED — Runtime exploit chain reproduced from seeded previously-verified state. Seeded domainVerified=true in DB, then legacy PUT changed domain without clearing the flag; public /custom-domain returned HTTP 200 for unverified domain. `baseline-HTTP=200 PUT-HTTP=200 domainVerified-after=true newDomain-HTTP=200` $2'
      );
      console.log('V-15 finding row updated (line-by-line)');
      break;
    }
  }
  content = lines.join('\n');
}

// Fix V-15 queue row
const queueLines = content.split('\n');
for (let i = 0; i < queueLines.length; i++) {
  if (queueLines[i].startsWith('| BRAND-V-15 | Set domain via verify endpoint')) {
    const orig = queueLines[i];
    queueLines[i] = '| BRAND-V-15 | Set domain via verify endpoint → change via legacy branding PUT → confirm public resolution uses new unverified domain | HTTP sequence via authenticated session | ✅ VERIFIED — runtime exploit chain reproduced from seeded previously-verified state. PUT changed domain; domainVerified NOT cleared; public /custom-domain returned HTTP 200 for unverified domain. See V-15 finding row for full evidence. |';
    console.log('V-15 queue row updated');
    console.log('  Was:', orig.substring(0, 100));
    console.log('  Now:', queueLines[i].substring(0, 100));
    break;
  }
}
content = queueLines.join('\n');

writeFileSync(f, content, 'utf-8');
console.log('Done.');
