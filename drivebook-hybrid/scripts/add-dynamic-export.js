const fs = require('fs');
const path = require('path');

/**
 * Add "export const dynamic = 'force-dynamic';" to all API routes that use Prisma
 */

function findRouteFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      findRouteFiles(filePath, fileList);
    } else if (file === 'route.ts' || file === 'route.js') {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

function addDynamicExport(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Skip if already has dynamic export
  if (content.includes('export const dynamic')) {
    return { modified: false, reason: 'already has dynamic export' };
  }
  
  // Skip if doesn't use prisma
  if (!content.includes('prisma')) {
    return { modified: false, reason: 'does not use prisma' };
  }
  
  // Find the position after imports
  const lines = content.split('\n');
  let insertIndex = 0;
  let lastImportIndex = -1;
  
  // Find last import statement
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('import ') || line.startsWith('import{')) {
      lastImportIndex = i;
    }
  }
  
  if (lastImportIndex >= 0) {
    insertIndex = lastImportIndex + 1;
    
    // Skip empty lines after imports
    while (insertIndex < lines.length && lines[insertIndex].trim() === '') {
      insertIndex++;
    }
    
    // Insert the dynamic export
    lines.splice(insertIndex, 0, '', 'export const dynamic = \'force-dynamic\';');
    
    const newContent = lines.join('\n');
    fs.writeFileSync(filePath, newContent, 'utf8');
    
    return { modified: true, reason: 'added dynamic export' };
  }
  
  return { modified: false, reason: 'could not find import section' };
}

// Main execution
const apiDir = path.join(__dirname, '..', 'app', 'api');
const routeFiles = findRouteFiles(apiDir);

console.log(`Found ${routeFiles.length} route files\n`);

let modifiedCount = 0;
let skippedCount = 0;
const results = [];

routeFiles.forEach(filePath => {
  const relativePath = path.relative(path.join(__dirname, '..'), filePath);
  const result = addDynamicExport(filePath);
  
  if (result.modified) {
    modifiedCount++;
    console.log(`✓ Modified: ${relativePath}`);
  } else {
    skippedCount++;
    console.log(`- Skipped: ${relativePath} (${result.reason})`);
  }
  
  results.push({ path: relativePath, ...result });
});

console.log(`\n${'='.repeat(60)}`);
console.log(`Summary:`);
console.log(`  Total files: ${routeFiles.length}`);
console.log(`  Modified: ${modifiedCount}`);
console.log(`  Skipped: ${skippedCount}`);
console.log(`${'='.repeat(60)}\n`);

// Save results to file
const reportPath = path.join(__dirname, '..', 'DYNAMIC_EXPORT_REPORT.json');
fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
console.log(`Report saved to: DYNAMIC_EXPORT_REPORT.json`);
