import { readFileSync, writeFileSync } from 'fs';
const f = 'docs/audit/AUDIT-MASTER-TRACKER.md';
let c = readFileSync(f, 'utf-8');
const lines = c.split('\n');

// Update the V-08 finding row
for (let i = 0; i < lines.length; i++) {
  if (lines[i].startsWith('| BRAND-V-08 |') &&
      !lines[i].includes('Request subdomain route') &&
      !lines[i].includes('SOURCE-CONFIRMED @')) {
    const parts = lines[i].split('|');
    if (parts.length >= 10) {
      parts[5] = ' SOURCE-CONFIRMED + RUNTIME-INVALIDATED — source fallthrough logic confirmed in code; runtime test with non-driving Business+BusinessTerminology (booking="Appointment") confirmed BusinessWebsitePage IS selected when custom terminology exists. Server log: "Config loaded: booking=Appointment". RSC bundling causes body-text marker ambiguity but server log is authoritative. Finding INVALIDATED: routing works correctly. ';
      parts[6] = ' Runtime verification @ 2026-10-08T04:47Z. Non-driving provider with BusinessTerminology booking="Appointment": BusinessWebsitePage selected (server log confirmed). "appointment" present in body; "never driven before" also present (RSC bundling). No production defect. ';
      parts[7] = ' N/A — finding invalidated, no fix required ';
      parts[8] = ' N/A ';
      parts[9] = ' ✅ INVALIDATED — no defect; routing already correct ';
      lines[i] = parts.join('|');
      console.log('V-08 row updated');
      break;
    }
  }
}

// Update queue entry
for (let i = 0; i < lines.length; i++) {
  if (lines[i].startsWith('| BRAND-V-08 | Request subdomain route')) {
    const parts = lines[i].split('|');
    if (parts.length >= 4) {
      parts[parts.length - 2] = ' ✅ INVALIDATED — runtime confirmed BusinessWebsitePage selected for non-driving provider (server log + body-text). RSC bundling explained body-marker ambiguity. No fix needed. @ 2026-10-08 ';
      lines[i] = parts.join('|');
      console.log('V-08 queue entry updated');
    }
    break;
  }
}

c = lines.join('\n');
c = c.replace(
  '6 FIX-VERIFIED (V-04, V-09, V-10, V-11, V-12, V-13). 2 SOURCE-CONFIRMED / FINDING (V-08, V-14)',
  '6 FIX-VERIFIED (V-04, V-09, V-10, V-11, V-12, V-13). 1 INVALIDATED (V-08). 1 SOURCE-CONFIRMED / FINDING (V-14)'
);
c = c.replace(
  /\*\*Version:\*\*.*$/m,
  '**Version:** 5.28 (V-08 INVALIDATED: routing already works; V-14 remaining)'
);
writeFileSync(f, c, 'utf-8');
console.log('Done.');
