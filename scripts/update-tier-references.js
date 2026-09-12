/**
 * Script to update BUSINESS tier references to PREMIUM throughout the codebase
 * 
 * Run: node scripts/update-tier-references.js --dry-run (to preview)
 *      node scripts/update-tier-references.js (to apply changes)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const isDryRun = process.argv.includes('--dry-run');

console.log(isDryRun ? '🔍 DRY RUN - Preview only\n' : '✏️  APPLYING CHANGES\n');

// Patterns to update
const patterns = [
  {
    find: /(['"])BUSINESS(['"])/g,
    replace: "$1PREMIUM$2",
    description: "Tier string literals 'BUSINESS' -> 'PREMIUM'",
    exclude: ['deprecated', 'backward', 'legacy', 'migration']
  },
  {
    find: /(subscriptionTier|tier)\s*===\s*['"]BUSINESS['"]/g,
    replace: "$1 === 'PREMIUM'",
    description: "Tier comparisons === 'BUSINESS' -> === 'PREMIUM'"
  },
  {
    find: /\['BASIC',\s*'PRO',\s*'STUDIO',\s*'BUSINESS'\]/g,
    replace: "['BASIC', 'PRO', 'STUDIO', 'PREMIUM', 'BUSINESS']",
    description: "Tier arrays (add PREMIUM, keep BUSINESS for backward compat)"
  },
  {
    find: /Business tier/g,
    replace: "Premium tier",
    description: "Comments and labels"
  },
];

// Files to update (exclude certain patterns)
const filesToUpdate = execSync(
  'git ls-files "*.ts" "*.tsx" "*.js" "*.jsx"',
  { encoding: 'utf-8', cwd: path.join(__dirname, '..') }
)
  .split('\n')
  .filter(f => f.trim())
  .filter(f => !f.includes('node_modules'))
  .filter(f => !f.includes('.next'))
  .filter(f => !f.includes('migrations'))
  .filter(f => !f.includes('lib/config/subscriptions.ts')) // Already updated manually
  .map(f => path.join(__dirname, '..', f));

let totalChanges = 0;

filesToUpdate.forEach(file => {
  if (!fs.existsSync(file)) return;
  
  let content = fs.readFileSync(file, 'utf-8');
  let originalContent = content;
  let fileChanged = false;
  
  patterns.forEach(pattern => {
    // Skip if file contains exclusion keywords near the match
    if (pattern.exclude) {
      const hasExclusion = pattern.exclude.some(keyword => 
        content.toLowerCase().includes(keyword)
      );
      if (hasExclusion && content.match(pattern.find)) {
        console.log(`⏭️  Skipping ${path.relative(__dirname, file)} (contains: ${pattern.exclude.join(', ')})`);
        return;
      }
    }
    
    const matches = content.match(pattern.find);
    if (matches) {
      content = content.replace(pattern.find, pattern.replace);
      fileChanged = true;
      console.log(`   ${pattern.description}: ${matches.length} match(es)`);
    }
  });
  
  if (fileChanged) {
    console.log(`📝 ${path.relative(__dirname, file)}`);
    if (!isDryRun) {
      fs.writeFileSync(file, content, 'utf-8');
    }
    totalChanges++;
  }
});

console.log(`\n${isDryRun ? '🔍' : '✅'} Total files affected: ${totalChanges}`);

if (isDryRun) {
  console.log('\nℹ️  This was a dry run. Run without --dry-run to apply changes.');
} else {
  console.log('\n✅ Changes applied! Review with: git diff');
}
