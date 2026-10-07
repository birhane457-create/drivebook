import { readFileSync, writeFileSync } from 'fs';
const f = 'docs/audit/AUDIT-MASTER-TRACKER.md';
let c = readFileSync(f, 'utf-8');

// Version + current state
c = c.replace(/\*\*Version:\*\*.*$/m,
  '**Version:** 5.21 (V-04, V-08–V-14 SOURCE-CONFIRMED by verification script; product/architecture remediation pending)');
c = c.replace('17 findings registered. 9 CLOSED (V-01, V-02, V-03, V-05, V-06, V-07, V-15, V-16, V-17). 8 SOURCE-CONFIRMED (V-04, V-08\u2013V-14). 0 FIX-VERIFIED pending closure. CLOSED acceptance by project owner 2026-10-07.',
  '17 findings registered. 9 CLOSED (V-01, V-02, V-03, V-05, V-06, V-07, V-15, V-16, V-17). 8 SOURCE-CONFIRMED / FINDING (V-04, V-08\u2013V-14) \u2014 source re-confirmed by scripts/verify-v04-v08-v14.mjs @ 2026-10-07, exit 0. 0 FIX-VERIFIED. Remediation pending for V-04/V-08\u2013V-14.');
c = c.replace(/\*\*Last Updated:\*\*.*$/m, '**Last Updated:** 2026-10-07');

// Update Section 7.3 queue entries for the eight remaining findings to record SOURCE-CONFIRMED
const queuePairs = [
  ['BRAND-V-04 | Render Business Setup domain section', 'SOURCE-CONFIRMED @ 2026-10-07 \u2014 hasWrong=true hasRight=false. Script: verify-v04-v08-v14.mjs'],
  ['BRAND-V-08 | Request subdomain route', 'SOURCE-CONFIRMED @ 2026-10-07 \u2014 hasBothImports=true isCustomisedCheck=true. HTTP smoke returned 500 (provider state issue). Script: verify-v04-v08-v14.mjs'],
  ['BRAND-V-09 | Set', 'SOURCE-CONFIRMED @ 2026-10-07 \u2014 pageUsesFontFamily=false pageUsesTheme=false configHasFont=true. Script: verify-v04-v08-v14.mjs'],
  ['BRAND-V-10 | Set', 'SOURCE-CONFIRMED @ 2026-10-07 \u2014 usesAsAnyCast=true typesHasFlag=false assembleHasFlag=false. Script: verify-v04-v08-v14.mjs'],
  ['BRAND-V-11 | Attempt', 'SOURCE-CONFIRMED @ 2026-10-07 \u2014 Provider.customSlug @unique=false BusinessBranding.customSlug @unique=true. Script: verify-v04-v08-v14.mjs'],
  ['BRAND-V-12 | Load Business Setup', 'SOURCE-CONFIRMED @ 2026-10-07 \u2014 brandingPage-pathFormat=true domainPage-subdomainFormat=true. Script: verify-v04-v08-v14.mjs'],
  ['BRAND-V-13 | Load Business Setup without', 'SOURCE-CONFIRMED @ 2026-10-07 \u2014 checksColour=true assembleHasDefault=true. Script: verify-v04-v08-v14.mjs'],
  ['BRAND-V-14 | Load BusinessWebsitePage', 'SOURCE-CONFIRMED @ 2026-10-07 \u2014 hasSectionOrder=false hasPageBuilder=false. Script: verify-v04-v08-v14.mjs'],
];
const lines = c.split('\n');
for (const [prefix, result] of queuePairs) {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith(`| ${prefix}`)) {
      const parts = lines[i].split('|');
      if (parts.length >= 4) {
        parts[parts.length - 2] = ` ${result} `;
        lines[i] = parts.join('|');
        break;
      }
    }
  }
}
c = lines.join('\n');
writeFileSync(f, c, 'utf-8');
console.log('Done.');
