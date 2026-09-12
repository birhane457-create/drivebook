const fs = require('fs');
const path = require('path');

/**
 * Check which API routes are missing "export const dynamic = 'force-dynamic';"
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

function checkRoute(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  
  const hasDynamic = content.includes('export const dynamic');
  const usesPrisma = content.includes('prisma');
  const usesGetServerSession = content.includes('getServerSession');
  const hasExportFunction = content.match(/export\s+(async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH)/);
  
  return {
    hasDynamic,
    usesPrisma,
    usesGetServerSession,
    hasExportFunction: !!hasExportFunction,
    needsDynamic: (usesPrisma || usesGetServerSession) && !hasDynamic
  };
}

// Main execution
const apiDir = path.join(__dirname, '..', 'app', 'api');
const routeFiles = findRouteFiles(apiDir);

console.log(`Checking ${routeFiles.length} route files...\n`);

const missing = [];
const hasIt = [];
const notNeeded = [];

routeFiles.forEach(filePath => {
  const relativePath = path.relative(path.join(__dirname, '..'), filePath);
  const check = checkRoute(filePath);
  
  if (check.needsDynamic) {
    missing.push(relativePath);
  } else if (check.hasDynamic) {
    hasIt.push(relativePath);
  } else {
    notNeeded.push(relativePath);
  }
});

console.log(`${'='.repeat(70)}`);
console.log(`ROUTES MISSING "export const dynamic = 'force-dynamic';":`);
console.log(`${'='.repeat(70)}`);
missing.forEach(path => console.log(`  ❌ ${path}`));

console.log(`\n${'='.repeat(70)}`);
console.log(`ROUTES THAT ALREADY HAVE IT:`);
console.log(`${'='.repeat(70)}`);
hasIt.forEach(path => console.log(`  ✓ ${path}`));

console.log(`\n${'='.repeat(70)}`);
console.log(`ROUTES THAT DON'T NEED IT (no Prisma/auth):`);
console.log(`${'='.repeat(70)}`);
notNeeded.forEach(path => console.log(`  - ${path}`));

console.log(`\n${'='.repeat(70)}`);
console.log(`SUMMARY:`);
console.log(`${'='.repeat(70)}`);
console.log(`  Total routes: ${routeFiles.length}`);
console.log(`  Missing dynamic export: ${missing.length}`);
console.log(`  Already have it: ${hasIt.length}`);
console.log(`  Don't need it: ${notNeeded.length}`);
console.log(`${'='.repeat(70)}\n`);

// Save detailed report
const report = {
  timestamp: new Date().toISOString(),
  summary: {
    total: routeFiles.length,
    missing: missing.length,
    hasIt: hasIt.length,
    notNeeded: notNeeded.length
  },
  missing,
  hasIt,
  notNeeded
};

const reportPath = path.join(__dirname, '..', 'DYNAMIC_EXPORT_CHECK.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(`Detailed report saved to: DYNAMIC_EXPORT_CHECK.json\n`);
