import { readFileSync, writeFileSync } from 'fs';
const f = 'docs/audit/AUDIT-MASTER-TRACKER.md';
let c = readFileSync(f, 'utf-8');
const lines = c.split('\n');

// Update V-14 finding row
for (let i = 0; i < lines.length; i++) {
  if (lines[i].startsWith('| BRAND-V-14 |') &&
      !lines[i].includes('Load BusinessWebsitePage') &&
      !lines[i].includes('SOURCE-CONFIRMED @')) {
    const parts = lines[i].split('|');
    if (parts.length >= 10) {
      parts[5] = ' SOURCE-CONFIRMED + PRODUCT-CONTRACT REVIEW — repository searched for page-builder, full-white-label, or unrestricted-editor claims. No such claims found. "full white-label" in DOCROLEBASE/07-subscriptions/TIERS.md PREMIUM section was vague and inconsistent; corrected to accurate description. Product contract confirmed: DriveBook provides a branded configured renderer, not a page builder. ';
      parts[6] = ' 2026-10-08: product documentation reviewed; no false claims of page-builder capability found. docs/DOCROLEBASE/07-subscriptions/TIERS.md "full white-label" clarified. ';
      parts[7] = ' docs correction: TIERS.md PREMIUM description updated to remove vague "full white-label" claim — replaced with accurate "enhanced branded booking experience" + roadmap note ';
      parts[8] = ' Documentation-only. No code change required. ';
      parts[9] = ' ✅ INVALIDATED / RECLASSIFIED — product-scope observation; system correctly implements configured renderer matching actual product contract; no page-builder claim exists in repository ';
      lines[i] = parts.join('|');
      console.log('V-14 row updated');
      break;
    }
  }
}

// Update queue entry
for (let i = 0; i < lines.length; i++) {
  if (lines[i].startsWith('| BRAND-V-14 | Load BusinessWebsitePage')) {
    const parts = lines[i].split('|');
    if (parts.length >= 4) {
      parts[parts.length - 2] = ' ✅ INVALIDATED — product contract review confirmed no page-builder claim. Configured renderer matches intended product scope. TIERS.md documentation corrected. @ 2026-10-08 ';
      lines[i] = parts.join('|');
      console.log('V-14 queue entry updated');
    }
    break;
  }
}

c = lines.join('\n');
c = c.replace(
  '6 FIX-VERIFIED (V-04, V-09, V-10, V-11, V-12, V-13). 1 INVALIDATED (V-08). 1 SOURCE-CONFIRMED / FINDING (V-14)',
  '6 FIX-VERIFIED (V-04, V-09, V-10, V-11, V-12, V-13). 2 INVALIDATED (V-08, V-14). 0 SOURCE-CONFIRMED / FINDING'
);
c = c.replace(/\*\*Version:\*\*.*$/m, '**Version:** 5.29 (V-14 INVALIDATED: configured renderer matches product contract; TIERS.md "full white-label" claim corrected)');
c = c.replace(/\*\*Last Updated:\*\*.*$/m, '**Last Updated:** 2026-10-08');
writeFileSync(f, c, 'utf-8');
console.log('Done.');
