/**
 * FIX-VERIFIED test for BRAND-V-09
 * BusinessWebsitePage must apply fontFamily and theme from branding config.
 *
 * Tests (source inspection — SSR component, rendering not inspectable via HTTP body):
 *   V09-FV-1: BusinessWebsitePage reads branding.fontFamily and uses it in style/class
 *   V09-FV-2: BusinessWebsitePage reads branding.theme and applies it as a class
 *   V09-FV-3: Root <div> receives both fontStyle and themeClass
 *   V09-FV-4: Revert-detection — would FAIL if fontFamily/theme become unused again
 */

import { readFileSync } from 'fs';

const FILE = 'components/website/BusinessWebsitePage.tsx';
const src  = readFileSync(FILE, 'utf-8');
const codeLines = src.split('\n').filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*'));

const results = [];
function record(id, status, evidence, details = {}) {
  results.push({ id, status, evidence, ...details });
  const icon = status === 'PASS' ? '✅' : '❌';
  console.log(`\n${icon}  ${id}: ${status}`);
  console.log(`   Evidence: ${evidence}`);
  if (details.actual) console.log(`   Actual:   ${details.actual}`);
}

console.log('╔══════════════════════════════════════════════════════════════════╗');
console.log('║   FIX-VERIFIED: BRAND-V-09 fontFamily and theme applied         ║');
console.log('╚══════════════════════════════════════════════════════════════════╝');
console.log(`\nStarted: ${new Date().toISOString()}`);

// V09-FV-1: fontFamily is read from branding and used in a style variable
const fontFamilyRead = codeLines.some(l => l.includes('branding.fontFamily'));
const fontStyleDefined = codeLines.some(l => l.includes('fontFamily:') && l.includes('branding.fontFamily'));
if (fontFamilyRead && fontStyleDefined) {
  record('V09-FV-1', 'PASS',
    'branding.fontFamily is read and assigned to a style object in BusinessWebsitePage.',
    { actual: `fontFamilyRead=${fontFamilyRead} fontStyleDefined=${fontStyleDefined}` }
  );
} else {
  record('V09-FV-1', 'FAIL',
    'branding.fontFamily is not read or not applied in BusinessWebsitePage.',
    { actual: `fontFamilyRead=${fontFamilyRead} fontStyleDefined=${fontStyleDefined}` }
  );
}

// V09-FV-2: theme is read from branding and used to set a CSS class
const themeRead = codeLines.some(l => l.includes('branding.theme'));
const themeClass = codeLines.some(l => (l.includes("theme === 'dark'") || l.includes('branding.theme')) && (l.includes('dark') || l.includes('light')));
if (themeRead && themeClass) {
  record('V09-FV-2', 'PASS',
    'branding.theme is read and used to derive a CSS class in BusinessWebsitePage.',
    { actual: `themeRead=${themeRead} themeClass=${themeClass}` }
  );
} else {
  record('V09-FV-2', 'FAIL',
    'branding.theme is not read or not applied as a class.',
    { actual: `themeRead=${themeRead} themeClass=${themeClass}` }
  );
}

// V09-FV-3: Root <div> receives the style and theme class
const rootDivHasStyle = codeLines.some(l =>
  l.includes('<div') && l.includes('min-h-screen') && l.includes('style=')
);
const rootDivHasTheme = codeLines.some(l =>
  l.includes('<div') && l.includes('min-h-screen') && (l.includes('themeClass') || l.includes('dark') || l.includes('light'))
);
if (rootDivHasStyle && rootDivHasTheme) {
  record('V09-FV-3', 'PASS',
    'Root <div> with min-h-screen receives both style (fontFamily) and themeClass.',
    { actual: `rootDivHasStyle=${rootDivHasStyle} rootDivHasTheme=${rootDivHasTheme}` }
  );
} else {
  record('V09-FV-3', 'FAIL',
    'Root <div> does not receive fontFamily style or themeClass.',
    { actual: `rootDivHasStyle=${rootDivHasStyle} rootDivHasTheme=${rootDivHasTheme}` }
  );
}

// V09-FV-4: Revert-detection — fontFamily and theme must NOT be unused
const fontUnused = !codeLines.some(l => l.includes('fontFamily') && l.includes('branding'));
const themeUnused = !codeLines.some(l => l.includes('branding.theme') || (l.includes('themeClass') && l.includes('<div')));
if (!fontUnused && !themeUnused) {
  record('V09-FV-4', 'PASS',
    'Revert-detection: fontFamily and theme are both referenced in non-comment code. Fix is stable.',
    { actual: `fontUnused=${fontUnused} themeUnused=${themeUnused}` }
  );
} else {
  record('V09-FV-4', 'FAIL',
    'Revert-detection: fontFamily or theme is no longer used — fix may have been reverted.',
    { actual: `fontUnused=${fontUnused} themeUnused=${themeUnused}` }
  );
}

console.log('\n' + '═'.repeat(68));
const passed = results.filter(r => r.status === 'PASS').length;
const failed = results.filter(r => r.status === 'FAIL').length;
console.log(`  FIX-VERIFIED V-09: ${passed} PASS / ${failed} FAIL`);
results.forEach(r => console.log(`  ${r.status === 'PASS' ? '✅' : '❌'}  ${r.id}: ${r.evidence.substring(0, 100)}`));
console.log('═'.repeat(68));
console.log(`\nCompleted: ${new Date().toISOString()}`);
process.exit(failed > 0 ? 1 : 0);
